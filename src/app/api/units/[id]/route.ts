import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, requestRateLimit } from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limitResult = requestRateLimit(request, 'units:detail');
    if (!limitResult.success) return apiError('Too many requests', 429);

    const { id } = await params;
    const unit = await db.unit.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            address: true,
            addressAr: true,
            city: true,
            cityAr: true,
          },
        },
        leases: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            tenant: { select: { id: true, name: true, nameAr: true, email: true, phone: true } },
          },
        },
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            property: { select: { name: true, nameAr: true } },
            tenant: { select: { name: true, nameAr: true } },
          },
        },
      },
    });

    if (!unit) return apiError('Unit not found', 404);

    const activeLease = unit.leases[0] ?? null;
    const recentPayments = activeLease
      ? await db.payment.findMany({
          where: { leaseId: activeLease.id },
          orderBy: { dueDate: 'desc' },
          take: 5,
          include: { tenant: { select: { id: true, name: true, nameAr: true } } },
        })
      : [];

    const currentLease = activeLease
      ? {
          id: activeLease.id,
          startDate: activeLease.startDate,
          endDate: activeLease.endDate,
          rentAmount: activeLease.rentAmount,
          deposit: activeLease.deposit,
          status: activeLease.status,
          tenant: activeLease.tenant,
        }
      : null;

    const { leases: _leases, maintenanceRequests, ...unitData } = unit;
    const status = activeLease ? 'rented' : unitData.status === 'rented' ? 'available' : unitData.status;
    return NextResponse.json({ ...unitData, status, currentLease, recentPayments, maintenanceRequests });
  } catch (error) {
    console.error('Unit detail API error:', error);
    return apiError('Failed to fetch unit', 500);
  }
}
