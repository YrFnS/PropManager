import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, tenantSchema, sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameAr: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const [tenants, total] = await Promise.all([
      db.tenant.findMany({
        where,
        skip,
        take: limit,
        include: {
          leases: {
            where: { status: 'active' },
            include: {
              unit: { include: { property: { select: { name: true, nameAr: true } } } },
            },
          },
          _count: { select: { payments: true, maintenanceRequests: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.tenant.count({ where }),
    ]);

    // Compute stats from fetched data
    const totalTenants = total;
    const activeTenants = tenants.filter((t: any) => t.status === 'active').length;
    const withActiveLeases = tenants.filter(
      (t: any) => t.leases && t.leases.length > 0
    ).length;

    const response = NextResponse.json({
      data: tenants,
      stats: { totalTenants, activeTenants, withActiveLeases },
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
    console.error('Tenants API error:', error);
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = tenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const tenant = await db.tenant.create({
      data: {
        name: sanitizeString(data.name, 200),
        nameAr: data.nameAr ? sanitizeString(data.nameAr, 200) : null,
        email: sanitizeString(data.email, 200),
        phone: data.phone ? sanitizeString(data.phone, 50) : null,
        nationalId: data.nationalId ? sanitizeString(data.nationalId, 50) : null,
        emergencyContact: data.emergencyContact ? sanitizeString(data.emergencyContact, 200) : null,
        status: data.status || 'active',
      },
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    console.error('Tenants POST error:', error);
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = tenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Check if tenant exists
    const existing = await db.tenant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const tenant = await db.tenant.update({
      where: { id },
      data: {
        name: sanitizeString(data.name, 200),
        nameAr: data.nameAr !== undefined ? data.nameAr ? sanitizeString(data.nameAr, 200) : null : undefined,
        email: sanitizeString(data.email, 200),
        phone: data.phone !== undefined ? data.phone ? sanitizeString(data.phone, 50) : null : undefined,
        nationalId: data.nationalId !== undefined ? data.nationalId ? sanitizeString(data.nationalId, 50) : null : undefined,
        emergencyContact: data.emergencyContact !== undefined ? data.emergencyContact ? sanitizeString(data.emergencyContact, 200) : null : undefined,
        status: data.status,
      },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    console.error('Tenants PUT error:', error);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
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
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Check if tenant exists
    const existing = await db.tenant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    await db.tenant.delete({ where: { id } });

    return NextResponse.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Tenants DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 });
  }
}
