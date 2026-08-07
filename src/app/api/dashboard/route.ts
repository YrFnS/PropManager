import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, requestRateLimit } from '@/lib/api';
import { moneyToNumber } from '@/lib/money';

function getPeriodRange(period: string): { startDate: Date | null; endDate: Date | null } {
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
    case 'allTime':
      return { startDate: null, endDate: null };
    default:
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
  }
}

function dateWhere(startDate: Date | null, endDate: Date | null) {
  return startDate && endDate ? { gte: startDate, lte: endDate } : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'dashboard:read', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const period = new URL(request.url).searchParams.get('period') || 'thisMonth';
    const { startDate, endDate } = getPeriodRange(period);
    const range = dateWhere(startDate, endDate);
    const now = new Date();
    const paymentPeriodWhere: Prisma.PaymentWhereInput = range ? { dueDate: range } : {};
    const paidPeriodWhere: Prisma.PaymentWhereInput = {
      status: { in: ['paid', 'partial'] },
      ...(range ? { paidDate: range } : {}),
    };
    const activityWhere = range ? { createdAt: range } : {};

    const [
      totalProperties,
      totalUnits,
      occupiedUnits,
      maintenanceUnits,
      totalTenants,
      activeTenants,
      activeLeaseCount,
      openMaintenance,
      properties,
      paymentStatusCounts,
      totalCollected,
      recentPayments,
      recentMaintenance,
      recentMessages,
      expiringLeases,
      collectedPayments,
      periodDues,
    ] = await Promise.all([
      db.property.count(),
      db.unit.count(),
      db.unit.count({ where: { leases: { some: { status: 'active' } } } }),
      db.unit.count({ where: { status: 'maintenance', leases: { none: { status: 'active' } } } }),
      db.tenant.count(),
      db.tenant.count({ where: { status: 'active' } }),
      db.lease.count({ where: { status: 'active' } }),
      db.maintenanceRequest.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      db.property.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          units: {
            select: {
              status: true,
              leases: { where: { status: 'active' }, select: { id: true }, take: 1 },
            },
          },
        },
      }),
      db.payment.groupBy({
        by: ['status'],
        where: paymentPeriodWhere,
        _count: { status: true },
      }),
      db.payment.aggregate({ where: paidPeriodWhere, _sum: { amount: true } }),
      db.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: activityWhere,
        select: {
          id: true,
          amount: true,
          dueDate: true,
          paidDate: true,
          status: true,
          method: true,
          createdAt: true,
          tenant: { select: { name: true, nameAr: true } },
          lease: {
            select: {
              unit: { select: { unitNumber: true, property: { select: { name: true, nameAr: true } } } },
            },
          },
        },
      }),
      db.maintenanceRequest.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: activityWhere,
        select: {
          id: true,
          title: true,
          titleAr: true,
          priority: true,
          status: true,
          category: true,
          createdAt: true,
          property: { select: { name: true, nameAr: true } },
          unit: { select: { unitNumber: true } },
        },
      }),
      db.message.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: activityWhere,
        select: { id: true, senderName: true, subject: true, createdAt: true },
      }),
      db.lease.findMany({
        where: {
          status: 'active',
          endDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          endDate: true,
          tenant: { select: { name: true, nameAr: true } },
          unit: { select: { unitNumber: true, property: { select: { name: true, nameAr: true } } } },
        },
        orderBy: { endDate: 'asc' },
        take: 10,
      }),
      db.payment.findMany({
        where: paidPeriodWhere,
        select: {
          amount: true,
          paidDate: true,
          lease: { select: { unit: { select: { propertyId: true } } } },
        },
      }),
      db.payment.findMany({
        where: paymentPeriodWhere,
        select: { amount: true, status: true, lease: { select: { rentAmount: true } } },
      }),
    ]);

    const vacantUnits = Math.max(0, totalUnits - occupiedUnits - maintenanceUnits);
    const paidPayments = paymentStatusCounts.find((item) => item.status === 'paid')?._count.status ?? 0;
    const partialPayments = paymentStatusCounts.find((item) => item.status === 'partial')?._count.status ?? 0;
    const pendingPayments = paymentStatusCounts.find((item) => item.status === 'pending')?._count.status ?? 0;
    const latePayments = paymentStatusCounts.find((item) => item.status === 'late')?._count.status ?? 0;

    const totalPendingAmount = periodDues.reduce((sum, payment) => {
      if (payment.status === 'pending' || payment.status === 'late') return sum + moneyToNumber(payment.amount);
      if (payment.status === 'partial') {
        return sum + Math.max(0, Math.max(moneyToNumber(payment.lease.rentAmount), moneyToNumber(payment.amount)) - moneyToNumber(payment.amount));
      }
      return sum;
    }, 0);

    const revenueByMonth = new Map<string, number>();
    const revenueByProperty = new Map<string, number>();
    for (const payment of collectedPayments) {
      if (payment.paidDate) {
        const month = `${payment.paidDate.getFullYear()}-${String(payment.paidDate.getMonth() + 1).padStart(2, '0')}`;
        revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + moneyToNumber(payment.amount));
      }
      const propertyId = payment.lease.unit.propertyId;
      revenueByProperty.set(propertyId, (revenueByProperty.get(propertyId) || 0) + moneyToNumber(payment.amount));
    }

    const revenueData = Array.from(revenueByMonth, ([month, revenue]) => ({ month, revenue })).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    const propertyRevenueData = properties.map((property) => ({
      name: property.name,
      nameAr: property.nameAr,
      revenue: revenueByProperty.get(property.id) || 0,
      occupied: property.units.filter((unit) => unit.leases.length > 0).length,
      total: property.units.length,
    }));

    const response = NextResponse.json({
      stats: {
        totalProperties,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        maintenanceUnits,
        occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
        totalTenants,
        activeTenants,
        activeLeases: activeLeaseCount,
        monthlyRevenue: moneyToNumber(totalCollected._sum.amount),
        pendingPayments,
        latePayments,
        openMaintenance,
        totalCollected: moneyToNumber(totalCollected._sum.amount),
        totalPendingAmount,
      },
      recentPayments,
      recentMaintenance,
      recentMessages,
      expiringLeases,
      paymentStatusData: [
        { name: 'paid', value: paidPayments + partialPayments, color: '#22c55e' },
        { name: 'pending', value: pendingPayments, color: '#eab308' },
        { name: 'late', value: latePayments, color: '#ef4444' },
      ],
      unitStatusData: [
        { name: 'occupied', value: occupiedUnits, color: '#22c55e' },
        { name: 'vacant', value: vacantUnits, color: '#3b82f6' },
        { name: 'chartMaintenance', value: maintenanceUnits, color: '#f97316' },
      ],
      revenueData,
      propertyRevenueData,
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    console.error('Dashboard API error:', error);
    return apiError('Failed to fetch dashboard data', 500);
  }
}
