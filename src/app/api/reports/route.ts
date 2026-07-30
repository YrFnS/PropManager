import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, requestRateLimit } from '@/lib/api';
import { moneyDecimal, moneyNumber } from '@/lib/money';
import { netCollectedAmount } from '@/lib/payment-ledger';

function getPeriodRange(period: string) {
  const now = new Date();
  if (period === 'lastMonth') return { startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1), endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) };
  if (period === 'thisQuarter') {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    return { startDate: new Date(now.getFullYear(), startMonth, 1), endDate: new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999) };
  }
  if (period === 'thisYear') return { startDate: new Date(now.getFullYear(), 0, 1), endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
  return { startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
}

export async function GET(request: NextRequest) {
  try {
    const limit = requestRateLimit(request, 'reports:read', { maxRequests: 60 });
    if (!limit.success) return apiError('Too many requests', 429);
    const period = new URL(request.url).searchParams.get('period') || 'thisMonth';
    const { startDate, endDate } = getPeriodRange(period);
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [duePayments, collectedPayments, periodRefunds, trendPayments, trendRefunds] = await Promise.all([
      db.payment.findMany({
        where: { dueDate: { gte: startDate, lte: endDate }, status: { not: 'voided' } },
        include: { adjustments: true, lease: { select: { rentAmount: true } } },
      }),
      db.payment.findMany({
        where: { status: { in: ['paid', 'partial', 'partially_refunded', 'refunded'] }, paidDate: { gte: startDate, lte: endDate } },
        include: {
          tenant: { select: { id: true, name: true, nameAr: true } },
          lease: { select: { unit: { select: { property: { select: { id: true, name: true, nameAr: true } } } } } },
        },
      }),
      db.paymentAdjustment.findMany({
        where: { type: 'refund', createdAt: { gte: startDate, lte: endDate } },
        include: {
          payment: {
            include: {
              tenant: { select: { id: true, name: true, nameAr: true } },
              lease: { select: { unit: { select: { property: { select: { id: true, name: true, nameAr: true } } } } } },
            },
          },
        },
      }),
      db.payment.findMany({
        where: { status: { in: ['paid', 'partial', 'partially_refunded', 'refunded'] }, paidDate: { gte: twelveMonthsAgo } },
        select: { amount: true, paidDate: true },
      }),
      db.paymentAdjustment.findMany({
        where: { type: 'refund', createdAt: { gte: twelveMonthsAgo } },
        select: { amount: true, createdAt: true },
      }),
    ]);

    const expectedAmount = (payment: (typeof duePayments)[number]) =>
      payment.status === 'partial' || payment.status === 'partially_refunded' || payment.status === 'refunded'
        ? PrismaDecimalMax(payment.lease.rentAmount, payment.amount)
        : moneyDecimal(payment.amount);
    const totalExpected = duePayments.reduce((sum, payment) => sum.plus(expectedAmount(payment)), moneyDecimal(0));
    const collectedAgainstDue = duePayments.reduce((sum, payment) => sum.plus(netCollectedAmount(payment)), moneyDecimal(0));
    const outstandingAmount = PrismaDecimalMax(0, totalExpected.minus(collectedAgainstDue));

    const collectedGross = collectedPayments.reduce((sum, payment) => sum.plus(moneyDecimal(payment.amount)), moneyDecimal(0));
    const refundedInPeriod = periodRefunds.reduce((sum, adjustment) => sum.plus(moneyDecimal(adjustment.amount)), moneyDecimal(0));
    const totalRevenue = collectedGross.minus(refundedInPeriod);
    const collectionRate = totalExpected.greaterThan(0)
      ? Math.min(100, Math.round(collectedAgainstDue.dividedBy(totalExpected).times(100).toNumber()))
      : 0;

    const trendByMonth = new Map<string, number>();
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      trendByMonth.set(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const payment of trendPayments) {
      if (!payment.paidDate) continue;
      const key = `${payment.paidDate.getFullYear()}-${String(payment.paidDate.getMonth() + 1).padStart(2, '0')}`;
      if (trendByMonth.has(key)) trendByMonth.set(key, (trendByMonth.get(key) || 0) + moneyNumber(payment.amount));
    }
    for (const refund of trendRefunds) {
      const key = `${refund.createdAt.getFullYear()}-${String(refund.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (trendByMonth.has(key)) trendByMonth.set(key, (trendByMonth.get(key) || 0) - moneyNumber(refund.amount));
    }

    const propertyTotals = new Map<string, { name: string; nameAr: string | null; revenue: number }>();
    const methodTotals = new Map<string, { count: number; amount: number }>();
    const tenantTotals = new Map<string, { id: string; name: string; nameAr: string | null; totalPaid: number; paymentCount: number }>();
    const apply = (payment: (typeof collectedPayments)[number], amount: number, countDelta: number) => {
      const property = payment.lease.unit.property;
      const propertyEntry = propertyTotals.get(property.id) || { name: property.name, nameAr: property.nameAr, revenue: 0 };
      propertyEntry.revenue += amount;
      propertyTotals.set(property.id, propertyEntry);
      const method = payment.method || 'other';
      const methodEntry = methodTotals.get(method) || { count: 0, amount: 0 };
      methodEntry.count += countDelta;
      methodEntry.amount += amount;
      methodTotals.set(method, methodEntry);
      const tenant = payment.tenant;
      const tenantEntry = tenantTotals.get(tenant.id) || { id: tenant.id, name: tenant.name, nameAr: tenant.nameAr, totalPaid: 0, paymentCount: 0 };
      tenantEntry.totalPaid += amount;
      tenantEntry.paymentCount += countDelta;
      tenantTotals.set(tenant.id, tenantEntry);
    };
    for (const payment of collectedPayments) apply(payment, moneyNumber(payment.amount), 1);
    for (const refund of periodRefunds) apply(refund.payment as (typeof collectedPayments)[number], -moneyNumber(refund.amount), 0);

    const paymentMethods = ['cash', 'bank_transfer', 'online', 'check'].map((method) => ({
      method,
      count: Math.max(0, methodTotals.get(method)?.count || 0),
      amount: Math.max(0, methodTotals.get(method)?.amount || 0),
    }));
    const other = methodTotals.get('other');
    if (other && other.amount > 0) paymentMethods.push({ method: 'other', count: Math.max(0, other.count), amount: other.amount });

    return NextResponse.json({
      summary: {
        totalRevenue: totalRevenue.toNumber(),
        totalExpected: totalExpected.toNumber(),
        collectionRate,
        outstandingAmount: outstandingAmount.toNumber(),
        refundedAmount: refundedInPeriod.toNumber(),
      },
      monthlyRevenue: Array.from(trendByMonth, ([month, revenue]) => ({ month, revenue })),
      revenueByProperty: Array.from(propertyTotals.values()).sort((a, b) => b.revenue - a.revenue),
      paymentMethods,
      topTenants: Array.from(tenantTotals.values()).filter((entry) => entry.totalPaid > 0).sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 10),
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return apiError('Failed to generate reports', 500);
  }
}

function PrismaDecimalMax(left: Parameters<typeof moneyDecimal>[0], right: Parameters<typeof moneyDecimal>[0]) {
  const a = moneyDecimal(left);
  const b = moneyDecimal(right);
  return a.greaterThan(b) ? a : b;
}
