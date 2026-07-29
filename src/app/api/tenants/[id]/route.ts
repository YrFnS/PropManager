import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';
import { moneyToNumber } from '@/lib/money';

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

    const tenant = await db.tenant.findUnique({
      where: { id },
      include: {
        leases: {
          include: {
            unit: {
              include: {
                property: { select: { name: true, nameAr: true } },
              },
            },
          },
          orderBy: { startDate: 'desc' },
        },
        payments: {
          include: {
            lease: {
              include: {
                unit: {
                  include: {
                    property: { select: { name: true, nameAr: true } },
                  },
                },
              },
            },
          },
          orderBy: { dueDate: 'desc' },
          take: 20,
        },
        maintenanceRequests: {
          include: {
            property: { select: { name: true, nameAr: true } },
            unit: { select: { unitNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Calculate summary stats
    const totalPaid = tenant.payments
      .filter((p) => p.status === 'paid' || p.status === 'partial')
      .reduce((sum, p) => sum + moneyToNumber(p.amount), 0);

    const totalPending = tenant.payments
      .filter((p) => p.status === 'pending' || p.status === 'late')
      .reduce((sum, p) => sum + moneyToNumber(p.amount), 0);

    const openMaintenanceCount = tenant.maintenanceRequests.filter(
      (m) => m.status === 'open' || m.status === 'in_progress'
    ).length;

    return NextResponse.json({
      ...tenant,
      summary: {
        totalPaid,
        totalPending,
        openMaintenanceCount,
      },
    });
  } catch (error) {
    console.error('Tenant detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 500 });
  }
}
