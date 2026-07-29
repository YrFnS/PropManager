import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, requestRateLimit } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'health-score:read', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const [
      totalUnits,
      occupiedUnits,
      duePayments,
      openMaintenance,
      urgentOpen,
      totalMaintenance,
      resolvedMaintenance,
      activeLeases,
      expiredLeases,
      terminatedLeases,
      properties,
      maintenanceByProperty,
    ] = await Promise.all([
      db.unit.count(),
      db.unit.count({ where: { leases: { some: { status: 'active' } } } }),
      db.payment.findMany({
        select: { amount: true, status: true, lease: { select: { rentAmount: true } } },
      }),
      db.maintenanceRequest.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      db.maintenanceRequest.count({
        where: { status: { in: ['open', 'in_progress'] }, priority: 'urgent' },
      }),
      db.maintenanceRequest.count(),
      db.maintenanceRequest.count({ where: { status: { in: ['resolved', 'closed'] } } }),
      db.lease.count({ where: { status: 'active' } }),
      db.lease.count({ where: { status: 'expired' } }),
      db.lease.count({ where: { status: 'terminated' } }),
      db.property.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          units: {
            select: {
              leases: { where: { status: 'active' }, select: { id: true }, take: 1 },
            },
          },
        },
      }),
      db.maintenanceRequest.groupBy({
        by: ['propertyId'],
        _count: { id: true },
        where: { status: { in: ['open', 'in_progress'] } },
      }),
    ]);

    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
    const expectedPayments = duePayments.reduce((sum, payment) => {
      if (payment.status === 'partial') return sum + Math.max(payment.amount, payment.lease.rentAmount);
      return sum + payment.amount;
    }, 0);
    const collectedPayments = duePayments.reduce((sum, payment) => {
      return payment.status === 'paid' || payment.status === 'partial' ? sum + payment.amount : sum;
    }, 0);
    const collectionRate = expectedPayments > 0 ? Math.min(100, (collectedPayments / expectedPayments) * 100) : 100;
    const maintenanceRate = totalMaintenance > 0 ? (resolvedMaintenance / totalMaintenance) * 100 : 100;
    const leaseHistoryCount = activeLeases + expiredLeases + terminatedLeases;
    const renewalRate = leaseHistoryCount > 0 ? (activeLeases / leaseHistoryCount) * 100 : 100;

    const weights = { occupancy: 0.3, collection: 0.3, maintenance: 0.25, renewal: 0.15 };
    const score = Math.round(
      occupancyRate * weights.occupancy +
      collectionRate * weights.collection +
      maintenanceRate * weights.maintenance +
      renewalRate * weights.renewal,
    );

    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    const gradeColor = score >= 90
      ? '#22c55e'
      : score >= 80
        ? '#14b8a6'
        : score >= 70
          ? '#f59e0b'
          : score >= 60
            ? '#f97316'
            : '#ef4444';

    const maintenanceMap = new Map(
      maintenanceByProperty.map((entry) => [entry.propertyId, entry._count.id]),
    );
    const propertyScores = properties.map((property) => {
      const propertyUnits = property.units.length;
      const propertyOccupied = property.units.filter((unit) => unit.leases.length > 0).length;
      const propertyOccupancy = propertyUnits > 0 ? (propertyOccupied / propertyUnits) * 100 : 0;
      const propertyOpenMaintenance = maintenanceMap.get(property.id) ?? 0;
      const maintenanceComponent = propertyOpenMaintenance === 0
        ? 100
        : Math.max(0, 100 - propertyOpenMaintenance * 20);
      const propertyScore = Math.round(propertyOccupancy * 0.65 + maintenanceComponent * 0.35);

      return {
        id: property.id,
        name: property.name,
        nameAr: property.nameAr,
        score: propertyScore,
        grade: propertyScore >= 90 ? 'A' : propertyScore >= 80 ? 'B' : propertyScore >= 70 ? 'C' : propertyScore >= 60 ? 'D' : 'F',
        occupancy: propertyOccupancy,
        totalUnits: propertyUnits,
        occupiedUnits: propertyOccupied,
        openMaintenance: propertyOpenMaintenance,
      };
    });

    const response = NextResponse.json({
      score,
      grade,
      gradeColor,
      metrics: {
        occupancy: { value: occupancyRate, weight: weights.occupancy },
        collection: { value: collectionRate, weight: weights.collection },
        maintenance: { value: maintenanceRate, weight: weights.maintenance },
        renewal: { value: renewalRate, weight: weights.renewal },
      },
      summary: {
        totalProperties: properties.length,
        totalUnits,
        occupiedUnits,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        totalMonthlyRevenue: collectedPayments,
        collectionRate: Math.round(collectionRate * 10) / 10,
        openMaintenance,
        urgentOpen,
        maintenanceRate: Math.round(maintenanceRate * 10) / 10,
        activeLeases,
        renewalRate: Math.round(renewalRate * 10) / 10,
      },
      propertyScores,
    });
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Health score error:', error);
    return apiError('Failed to calculate health score', 500);
  }
}
