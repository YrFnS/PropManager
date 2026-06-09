import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, leaseSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [leases, total] = await Promise.all([
      db.lease.findMany({
        where,
        skip,
        take: limit,
        include: {
          tenant: { select: { id: true, name: true, nameAr: true, email: true, phone: true } },
          unit: {
            include: {
              property: { select: { id: true, name: true, nameAr: true } },
            },
          },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.lease.count({ where }),
    ]);

    // Compute stats from fetched data
    const activeLeasesList = leases.filter((l: any) => l.status === 'active');
    const activeLeases = activeLeasesList.length;

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = activeLeasesList.filter(
      (l: any) => new Date(l.endDate) <= thirtyDaysFromNow
    ).length;

    const totalMonthlyRevenue = activeLeasesList.reduce(
      (sum: number, l: any) => sum + l.rentAmount,
      0
    );

    const response = NextResponse.json({
      data: leases,
      stats: { activeLeases, expiringSoon, totalMonthlyRevenue },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return response;
  } catch (error) {
    console.error('Leases API error:', error);
    return NextResponse.json({ error: 'Failed to fetch leases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = leaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const lease = await db.lease.create({
      data: {
        unitId: data.unitId,
        tenantId: data.tenantId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        rentAmount: data.rentAmount,
        deposit: data.deposit || null,
        status: data.status || 'active',
      },
      include: { tenant: true, unit: true },
    });

    // Update unit status to rented
    await db.unit.update({
      where: { id: data.unitId },
      data: { status: 'rented' },
    });

    return NextResponse.json(lease, { status: 201 });
  } catch (error) {
    console.error('Leases POST error:', error);
    return NextResponse.json({ error: 'Failed to create lease' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = leaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Lease ID is required' }, { status: 400 });
    }

    // Check if lease exists
    const existing = await db.lease.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    const lease = await db.lease.update({
      where: { id },
      data: {
        unitId: data.unitId,
        tenantId: data.tenantId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        rentAmount: data.rentAmount,
        deposit: data.deposit !== undefined ? data.deposit || null : undefined,
        status: data.status,
      },
      include: { tenant: true, unit: true },
    });

    // If lease is terminated/expired, update unit status back to available
    if (data.status && (data.status === 'terminated' || data.status === 'expired') && existing.status === 'active') {
      await db.unit.update({
        where: { id: lease.unitId },
        data: { status: 'available' },
      });
    }

    // If lease is reactivated, update unit status to rented
    if (data.status === 'active' && existing.status !== 'active') {
      await db.unit.update({
        where: { id: lease.unitId },
        data: { status: 'rented' },
      });
    }

    return NextResponse.json(lease);
  } catch (error) {
    console.error('Leases PUT error:', error);
    return NextResponse.json({ error: 'Failed to update lease' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Lease ID is required' }, { status: 400 });
    }

    // Check if lease exists
    const existing = await db.lease.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    const unitId = existing.unitId;

    // Delete lease (cascades to payments)
    await db.lease.delete({ where: { id } });

    // Update unit status back to available if lease was active
    if (existing.status === 'active') {
      await db.unit.update({
        where: { id: unitId },
        data: { status: 'available' },
      });
    }

    return NextResponse.json({ message: 'Lease deleted successfully' });
  } catch (error) {
    console.error('Leases DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete lease' }, { status: 500 });
  }
}
