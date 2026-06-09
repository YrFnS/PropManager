import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Run all independent queries in parallel
    const [
      unitStats,
      activeLeases,
      paidCount,
      totalPaymentCount,
      openMaintenance,
      urgentOpen,
      totalMaintenance,
      expiredLeases,
      terminatedLeases,
      propertyData,
      maintenanceByProperty,
    ] = await Promise.all([
      // Unit stats via groupBy (1 query instead of loading all units)
      db.unit.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      // Active leases for revenue (select only needed fields)
      db.lease.findMany({
        where: { status: 'active' },
        select: { rentAmount: true },
      }),
      db.payment.count({ where: { status: 'paid' } }),
      db.payment.count(),
      db.maintenanceRequest.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      db.maintenanceRequest.count({ where: { status: { in: ['open', 'in_progress'] }, priority: 'urgent' } }),
      db.maintenanceRequest.count(),
      db.lease.count({ where: { status: 'expired' } }),
      db.lease.count({ where: { status: 'terminated' } }),
      // Properties with unit counts (select only needed fields)
      db.property.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          units: {
            select: { status: true },
          },
        },
      }),
      // Maintenance counts grouped by property (1 query instead of N)
      db.maintenanceRequest.groupBy({
        by: ['propertyId'],
        _count: { id: true },
        where: { status: { in: ['open', 'in_progress'] } },
      }),
    ]);

    // Compute unit stats from groupBy result
    const totalUnits = unitStats.reduce((sum, s) => sum + s._count.status, 0);
    const occupiedUnits = unitStats.find(s => s.status === 'rented')?._count.status ?? 0;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const totalMonthlyRevenue = activeLeases.reduce((sum, l) => sum + l.rentAmount, 0);
    const collectionRate = totalPaymentCount > 0 ? (paidCount / totalPaymentCount) * 100 : 100;
    const maintenanceRate = totalMaintenance > 0 ? ((totalMaintenance - openMaintenance) / totalMaintenance) * 100 : 100;

    const totalLeaseHistory = activeLeases.length + expiredLeases + terminatedLeases;
    const renewalRate = totalLeaseHistory > 0 ? (activeLeases.length / totalLeaseHistory) * 100 : 100;

    // Calculate weighted health score (0-100)
    const weights = {
      occupancy: 0.30,
      collection: 0.25,
      maintenance: 0.25,
      renewal: 0.20,
    };

    const score = Math.round(
      occupancyRate * weights.occupancy +
      collectionRate * weights.collection +
      maintenanceRate * weights.maintenance +
      renewalRate * weights.renewal
    );

    // Determine grade
    let grade: string;
    let gradeColor: string;
    if (score >= 90) { grade = 'A'; gradeColor = '#22c55e'; }
    else if (score >= 80) { grade = 'B'; gradeColor = '#14b8a6'; }
    else if (score >= 70) { grade = 'C'; gradeColor = '#f59e0b'; }
    else if (score >= 60) { grade = 'D'; gradeColor = '#f97316'; }
    else { grade = 'F'; gradeColor = '#ef4444'; }

    // Build maintenance lookup from groupBy result
    const maintenanceMap = new Map(maintenanceByProperty.map(m => [m.propertyId, m._count.id]));

    // Per-property scores (no N+1 — uses pre-fetched data)
    const propertyScores = propertyData.map((p) => {
      const pUnits = p.units.length;
      const pOccupied = p.units.filter(u => u.status === 'rented').length;
      const pOccupancy = pUnits > 0 ? (pOccupied / pUnits) * 100 : 0;
      const pOpenMaintenance = maintenanceMap.get(p.id) ?? 0;

      const pScore = Math.round(pOccupancy * 0.6 + (pOpenMaintenance === 0 ? 100 : Math.max(0, 100 - pOpenMaintenance * 20)) * 0.4);
      let pGrade: string;
      if (pScore >= 90) pGrade = 'A';
      else if (pScore >= 80) pGrade = 'B';
      else if (pScore >= 70) pGrade = 'C';
      else if (pScore >= 60) pGrade = 'D';
      else pGrade = 'F';

      return {
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        score: pScore,
        grade: pGrade,
        occupancy: pOccupancy,
        totalUnits: pUnits,
        occupiedUnits: pOccupied,
        openMaintenance: pOpenMaintenance,
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
        totalProperties: propertyData.length,
        totalUnits,
        occupiedUnits,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        totalMonthlyRevenue,
        collectionRate: Math.round(collectionRate * 10) / 10,
        openMaintenance,
        urgentOpen,
        maintenanceRate: Math.round(maintenanceRate * 10) / 10,
        activeLeases: activeLeases.length,
        renewalRate: Math.round(renewalRate * 10) / 10,
      },
      propertyScores,
    });
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Health score error:', error);
    return NextResponse.json({ error: 'Failed to calculate health score' }, { status: 500 });
  }
}
