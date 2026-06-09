import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

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
        lease: {
          where: { status: 'active' },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                nameAr: true,
                email: true,
                phone: true,
              },
            },
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

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Get recent payments for this unit's lease
    let recentPayments: any[] = [];
    if (unit.lease) {
      recentPayments = await db.payment.findMany({
        where: { leaseId: unit.lease.id },
        orderBy: { dueDate: 'desc' },
        take: 5,
        include: {
          tenant: { select: { id: true, name: true, nameAr: true } },
        },
      });
    }

    // Current lease with tenant
    const currentLease = unit.lease
      ? {
          id: unit.lease.id,
          startDate: unit.lease.startDate,
          endDate: unit.lease.endDate,
          rentAmount: unit.lease.rentAmount,
          deposit: unit.lease.deposit,
          status: unit.lease.status,
          tenant: unit.lease.tenant,
        }
      : null;

    // Remove lease from unit to avoid duplication
    const { lease: _lease, maintenanceRequests, ...unitData } = unit;

    return NextResponse.json({
      ...unitData,
      currentLease,
      recentPayments,
      maintenanceRequests,
    });
  } catch (error) {
    console.error('Unit detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch unit' }, { status: 500 });
  }
}
