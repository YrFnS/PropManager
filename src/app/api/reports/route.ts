import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, requestRateLimit } from '@/lib/api';
import { moneyToNumber } from '@/lib/money';

function getPeriodRange(period: string) {
  const now = new Date();
  switch (period) {
    case 'lastMonth':
      return {
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case 'thisQuarter': {
      const startMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        startDate: new Date(now.getFullYear(), startMonth, 1),
        endDate: new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999),
      };
    }
    case 'thisYear':
      return {
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    default:
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
  }
}

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'reports:read', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const period = new URL(request.url).searchParams.get('period') || 'thisMonth';
    const { startDate, endDate } = getPeriodRange(period);
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [duePayments, collectedPayments, trendPayments] = await Promise.all([
      db.payment.findMany({
        where: { dueDate: { gte: startDate, lte: endDate } },
        select: {
          amount: true,
          status: true,
          lease: { select: { rentAmount: true } },
        },
      }),
      db.payment.findMany({
        where: {
          status: { in: ['paid', 'partial'] },
          paidDate: { gte: startDate, lte: endDate },
        },
        include: {
          tenant: { select: { id: true, name: true, nameAr: true } },
          lease: {
            select: {
              unit: { select: { property: { select: { id: true, name: true, nameAr: true } } } },
            },
          },
        },
      }),
      db.payment.findMany({
        where: {
          status: { in: ['paid', 'partial'] },
          paidDate: { gte: twelveMonthsAgo },
        },
        select: { amount: true, paidDate: true },
      }),
    ]);

    const totalRevenue = collectedPayments.reduce((sum, payment) => sum + moneyToNumber(payment.amount), 0);
    const expectedAmount = (payment: (typeof duePayments)[number]) =>
      payment.status === 'partial'
        ? Math.max(moneyToNumber(payment.lease.rentAmount), moneyToNumber(payment.amount))
        : moneyToNumber(payment.amount);
    const totalExpected = duePayments.reduce((sum, payment) => sum + expectedAmount(payment), 0);
    const collectedAgainstDue = duePayments
      .filter((payment) => payment.status === 'paid' || payment.status === 'partial')
      .reduce((sum, payment) => sum + moneyToNumber(payment.amount), 0);
    const outstandingAmount = duePayments.reduce((sum, payment) => {
      if (payment.status === 'pending' || payment.status === 'late') return sum + moneyToNumber(payment.amount);
      if (payment.status === 'partial') return sum + Math.max(0, expectedAmount(payment) - moneyToNumber(payment.amount));
      return sum;
    }, 0);
    const collectionRate = totalExpected > 0
      ? Math.min(100, Math.round((collectedAgainstDue / totalExpected) * 100))
      : 0;

    const trendByMonth = new Map<string, number>();
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      trendByMonth.set(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const payment of trendPayments) {
      if (!payment.paidDate) continue;
      const key = `${payment.paidDate.getFullYear()}-${String(payment.paidDate.getMonth() + 1).padStart(2, '0')}`;
      if (trendByMonth.has(key)) trendByMonth.set(key, (trendByMonth.get(key) || 0) + moneyToNumber(payment.amount));
    }
    const monthlyRevenue = Array.from(trendByMonth, ([month, revenue]) => ({ month, revenue }));

    const propertyTotals = new Map<string, { name: string; nameAr: string | null; revenue: number }>();
    const methodTotals = new Map<string, { count: number; amount: number }>();
    const tenantTotals = new Map<string, { id: string; name: string; nameAr: string | null; totalPaid: number; paymentCount: number }>();

    for (const payment of collectedPayments) {
      const property = payment.lease.unit.property;
      const propertyEntry = propertyTotals.get(property.id) || { name: property.name, nameAr: property.nameAr, revenue: 0 };
      propertyEntry.revenue += moneyToNumber(payment.amount);
      propertyTotals.set(property.id, propertyEntry);

      const method = payment.method || 'other';
      const methodEntry = methodTotals.get(method) || { count: 0, amount: 0 };
      methodEntry.count += 1;
      methodEntry.amount += moneyToNumber(payment.amount);
      methodTotals.set(method, methodEntry);

      const tenant = payment.tenant;
      const tenantEntry = tenantTotals.get(tenant.id) || {
        id: tenant.id,
        name: tenant.name,
        nameAr: tenant.nameAr,
        totalPaid: 0,
        paymentCount: 0,
      };
      tenantEntry.totalPaid += moneyToNumber(payment.amount);
      tenantEntry.paymentCount += 1;
      tenantTotals.set(tenant.id, tenantEntry);
    }

    const paymentMethods = ['cash', 'bank_transfer', 'online', 'check'].map((method) => ({
      method,
      count: methodTotals.get(method)?.count || 0,
      amount: methodTotals.get(method)?.amount || 0,
    }));
    const otherMethod = methodTotals.get('other');
    if (otherMethod) paymentMethods.push({ method: 'other', ...otherMethod });

    return NextResponse.json({
      summary: { totalRevenue, totalExpected, collectionRate, outstandingAmount },
      monthlyRevenue,
      revenueByProperty: Array.from(propertyTotals.values()).sort((a, b) => b.revenue - a.revenue),
      paymentMethods,
      topTenants: Array.from(tenantTotals.values())
        .sort((a, b) => b.totalPaid - a.totalPaid)
        .slice(0, 10),
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return apiError('Failed to generate reports', 500);
  }
}
