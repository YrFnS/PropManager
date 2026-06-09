import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';

function getPeriodRange(period: string) {
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  switch (period) {
    case 'thisMonth': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'lastMonth': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'thisQuarter': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
      endDate = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
      break;
    }
    case 'thisYear': {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    }
    case 'allTime':
    default: {
      startDate = null;
      endDate = null;
      break;
    }
  }

  return { startDate, endDate };
}

export async function GET(request: Request) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'thisMonth';
    const { startDate, endDate } = getPeriodRange(period);

    const dateFilter = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;
    const paidDateFilter = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;

    // Batch 1: Independent count queries + property data (run in parallel)
    const [
      totalProperties,
      unitStatusCounts,
      totalTenants,
      activeTenants,
      activeLeaseCount,
      openMaintenance,
      properties,
      activeLeaseData,
      paymentStatusCounts,
      totalCollected,
      totalPending,
    ] = await Promise.all([
      db.property.count(),
      // Single groupBy instead of 3 separate counts
      db.unit.groupBy({ by: ['status'], _count: { status: true } }),
      db.tenant.count(),
      db.tenant.count({ where: { status: 'active' } }),
      db.lease.count({ where: { status: 'active' } }),
      db.maintenanceRequest.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      // Properties with minimal data for revenue chart
      db.property.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          units: {
            select: { rentAmount: true, status: true },
          },
        },
      }),
      // Active lease revenue
      db.lease.findMany({
        where: { status: 'active' },
        select: { rentAmount: true },
      }),
      // Payment status counts in one groupBy
      db.payment.groupBy({ by: ['status'], _count: { status: true } }),
      // Total collected (period-filtered)
      db.payment.aggregate({
        where: {
          status: 'paid',
          ...(paidDateFilter ? { paidDate: paidDateFilter } : {}),
        },
        _sum: { amount: true },
      }),
      // Total pending
      db.payment.aggregate({
        where: { status: { in: ['pending', 'late'] } },
        _sum: { amount: true },
      }),
    ]);

    // Compute unit stats from groupBy
    const totalUnits = unitStatusCounts.reduce((sum, s) => sum + s._count.status, 0);
    const occupiedUnits = unitStatusCounts.find(s => s.status === 'rented')?._count.status ?? 0;
    const vacantUnits = unitStatusCounts.find(s => s.status === 'available')?._count.status ?? 0;
    const maintenanceUnits = unitStatusCounts.find(s => s.status === 'maintenance')?._count.status ?? 0;

    const monthlyRevenue = activeLeaseData.reduce((sum, l) => sum + l.rentAmount, 0);

    // Compute payment stats from groupBy
    const paidPayments = paymentStatusCounts.find(s => s.status === 'paid')?._count.status ?? 0;
    const pendingPayments = paymentStatusCounts.find(s => s.status === 'pending')?._count.status ?? 0;
    const latePayments = paymentStatusCounts.find(s => s.status === 'late')?._count.status ?? 0;

    // Batch 2: Dependent queries (need date filter, run in parallel)
    const [
      recentPayments,
      recentMaintenance,
      recentMessages,
      expiringLeases,
      paymentsByMonth,
    ] = await Promise.all([
      db.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: dateFilter ? { createdAt: dateFilter } : {},
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
              unit: {
                select: { unitNumber: true, property: { select: { name: true, nameAr: true } } },
              },
            },
          },
        },
      }),
      db.maintenanceRequest.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: dateFilter ? { createdAt: dateFilter } : {},
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
        where: dateFilter ? { createdAt: dateFilter } : {},
        select: {
          id: true,
          senderName: true,
          subject: true,
          createdAt: true,
        },
      }),
      // Expiring leases (next 30 days)
      db.lease.findMany({
        where: {
          status: 'active',
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          endDate: true,
          tenant: { select: { name: true, nameAr: true } },
          unit: {
            select: { unitNumber: true, property: { select: { name: true, nameAr: true } } },
          },
        },
        orderBy: { endDate: 'asc' },
        take: 10,
      }),
      // Revenue data by month
      db.payment.findMany({
        where: {
          status: 'paid',
          paidDate: {
            gte: (() => {
              const now = new Date();
              switch (period) {
                case 'thisMonth': return new Date(now.getFullYear(), now.getMonth(), 1);
                case 'lastMonth': return new Date(now.getFullYear(), now.getMonth() - 1, 1);
                case 'thisQuarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                case 'thisYear': return new Date(now.getFullYear(), 0, 1);
                default: { const d = new Date(); d.setMonth(d.getMonth() - 12); return d; }
              }
            })(),
          },
        },
        select: { paidDate: true, amount: true },
      }),
    ]);

    // Compute revenue data
    const monthlyData: Record<string, number> = {};
    for (const p of paymentsByMonth) {
      if (p.paidDate) {
        const key = `${p.paidDate.getFullYear()}-${String(p.paidDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + p.amount;
      }
    }

    const revenueData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    // Property revenue comparison
    const propertyRevenueData = properties.map(p => ({
      name: p.name,
      nameAr: p.nameAr,
      revenue: p.units.reduce((sum, u) => sum + u.rentAmount, 0),
      occupied: p.units.filter(u => u.status === 'rented').length,
      total: p.units.length,
    }));

    // Chart data
    const paymentStatusData = [
      { name: 'paid', value: paidPayments, color: '#22c55e' },
      { name: 'pending', value: pendingPayments, color: '#eab308' },
      { name: 'late', value: latePayments, color: '#ef4444' },
    ];

    const unitStatusData = [
      { name: 'occupied', value: occupiedUnits, color: '#22c55e' },
      { name: 'vacant', value: vacantUnits, color: '#3b82f6' },
      { name: 'chartMaintenance', value: maintenanceUnits, color: '#f97316' },
    ];

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
        monthlyRevenue,
        pendingPayments,
        latePayments,
        openMaintenance,
        totalCollected: totalCollected._sum.amount || 0,
        totalPendingAmount: totalPending._sum.amount || 0,
      },
      recentPayments,
      recentMaintenance,
      recentMessages,
      expiringLeases,
      paymentStatusData,
      unitStatusData,
      revenueData,
      propertyRevenueData,
    });
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
