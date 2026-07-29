import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, getPagination, isPrismaError, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import { sanitizeString, tenantSchema, tenantUpdateSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'tenants:read');
    if (!limitResult.success) return apiError('Too many requests', 429);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const { page, limit, skip } = getPagination(searchParams);
    const where: Prisma.TenantWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameAr: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'all') where.status = status;

    const activeStatsWhere: Prisma.TenantWhereInput = { ...where, status: 'active' };
    const leasedStatsWhere: Prisma.TenantWhereInput = {
      ...where,
      leases: { some: { status: 'active' } },
    };

    const [tenants, total, activeTenants, withActiveLeases] = await Promise.all([
      db.tenant.findMany({
        where,
        skip,
        take: limit,
        include: {
          leases: {
            where: { status: 'active' },
            include: { unit: { include: { property: { select: { name: true, nameAr: true } } } } },
          },
          _count: { select: { payments: true, maintenanceRequests: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.tenant.count({ where }),
      db.tenant.count({ where: activeStatsWhere }),
      db.tenant.count({ where: leasedStatsWhere }),
    ]);

    const response = NextResponse.json({
      data: tenants,
      stats: { totalTenants: total, activeTenants, withActiveLeases },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return response;
  } catch (error) {
    console.error('Tenants GET error:', error);
    return apiError('Failed to fetch tenants', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'tenants:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = tenantSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const tenant = await db.$transaction(async (transaction) => {
      const created = await transaction.tenant.create({
        data: {
          name: sanitizeString(data.name, 200),
          nameAr: data.nameAr ? sanitizeString(data.nameAr, 200) : null,
          email: sanitizeString(data.email, 200).toLowerCase(),
          phone: data.phone ? sanitizeString(data.phone, 50) : null,
          nationalId: data.nationalId ? sanitizeString(data.nationalId, 50) : null,
          emergencyContact: data.emergencyContact ? sanitizeString(data.emergencyContact, 200) : null,
          status: data.status || 'active',
        },
      });
      await transaction.activityLog.create({
        data: auditEntry('create', 'tenant', created.id, {
          email: created.email,
          status: created.status,
        }),
      });
      return created;
    });
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2002')) return apiError('A tenant with this email already exists.', 409);
    console.error('Tenants POST error:', error);
    return apiError('Failed to create tenant', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'tenants:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = tenantUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const existing = await db.tenant.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!existing) return apiError('Tenant not found', 404);

    const updateData: Prisma.TenantUncheckedUpdateInput = {};
    if (data.name !== undefined) updateData.name = sanitizeString(data.name, 200);
    if (data.nameAr !== undefined) updateData.nameAr = data.nameAr ? sanitizeString(data.nameAr, 200) : null;
    if (data.email !== undefined) updateData.email = sanitizeString(data.email, 200).toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone ? sanitizeString(data.phone, 50) : null;
    if (data.nationalId !== undefined) updateData.nationalId = data.nationalId ? sanitizeString(data.nationalId, 50) : null;
    if (data.emergencyContact !== undefined) {
      updateData.emergencyContact = data.emergencyContact ? sanitizeString(data.emergencyContact, 200) : null;
    }
    if (data.status !== undefined) updateData.status = data.status;

    const tenant = await db.$transaction(async (transaction) => {
      const updated = await transaction.tenant.update({ where: { id: data.id }, data: updateData });
      await transaction.activityLog.create({
        data: auditEntry('update', 'tenant', data.id, {
          fields: Object.keys(data).filter((key) => key !== 'id'),
          email: updated.email,
          status: updated.status,
        }),
      });
      return updated;
    });
    return NextResponse.json(tenant);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) return apiError('A tenant with this email already exists.', 409);
    console.error('Tenants PUT error:', error);
    return apiError('Failed to update tenant', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'tenants:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiError('Tenant ID is required', 400);

    const existing = await db.tenant.findUnique({
      where: { id },
      include: { _count: { select: { leases: true, payments: true, maintenanceRequests: true } } },
    });
    if (!existing) return apiError('Tenant not found', 404);
    if (existing._count.leases > 0 || existing._count.payments > 0 || existing._count.maintenanceRequests > 0) {
      return apiError('Tenants with lease, payment, or maintenance history cannot be deleted.', 409);
    }

    await db.$transaction(async (transaction) => {
      await transaction.tenant.delete({ where: { id } });
      await transaction.activityLog.create({
        data: auditEntry('delete', 'tenant', id, {
          email: existing.email,
          status: existing.status,
        }),
      });
    });
    return NextResponse.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Tenants DELETE error:', error);
    return apiError('Failed to delete tenant', 500);
  }
}
