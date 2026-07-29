import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, getPagination, isPrismaError, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import { moneyEquals, moneyToNumber } from '@/lib/money';
import { leaseSchema, leaseUpdateSchema } from '@/lib/validation';

const leaseInclude = {
  tenant: { select: { id: true, name: true, nameAr: true, email: true, phone: true } },
  unit: {
    include: {
      property: { select: { id: true, name: true, nameAr: true } },
    },
  },
  _count: { select: { payments: true } },
} satisfies Prisma.LeaseInclude;

function isValidDateRange(startDate: Date, endDate: Date) {
  return Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime()) && endDate > startDate;
}

async function syncUnitStatus(transaction: Prisma.TransactionClient, unitId: string) {
  const [unit, activeLeaseCount] = await Promise.all([
    transaction.unit.findUnique({ where: { id: unitId }, select: { status: true } }),
    transaction.lease.count({ where: { unitId, status: 'active' } }),
  ]);

  if (!unit) return;
  const status = activeLeaseCount > 0 ? 'rented' : unit.status === 'maintenance' ? 'maintenance' : 'available';
  if (status !== unit.status) {
    await transaction.unit.update({ where: { id: unitId }, data: { status } });
  }
}

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'leases:read');
    if (!limitResult.success) return apiError('Too many requests', 429);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    const status = searchParams.get('status') || '';
    const { page, limit, skip } = getPagination(searchParams);
    const where: Prisma.LeaseWhereInput = {};
    if (id) where.id = id;
    if (status && status !== 'all') where.status = status;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [leases, total, activeLeases, expiringSoon, activeRevenue] = await Promise.all([
      db.lease.findMany({ where, skip, take: limit, include: leaseInclude, orderBy: { createdAt: 'desc' } }),
      db.lease.count({ where }),
      db.lease.count({ where: { status: 'active' } }),
      db.lease.count({
        where: { status: 'active', endDate: { gte: now, lte: thirtyDaysFromNow } },
      }),
      db.lease.aggregate({ where: { status: 'active' }, _sum: { rentAmount: true } }),
    ]);

    const response = NextResponse.json({
      data: leases,
      stats: {
        activeLeases,
        expiringSoon,
        totalMonthlyRevenue: moneyToNumber(activeRevenue._sum.rentAmount),
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return response;
  } catch (error) {
    console.error('Leases GET error:', error);
    return apiError('Failed to fetch leases', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'leases:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = leaseSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);

    const data = parsed.data;
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (!isValidDateRange(startDate, endDate)) {
      return apiError('The lease end date must be after the start date.', 400);
    }

    const lease = await db.$transaction(async (transaction) => {
      const [unit, tenant] = await Promise.all([
        transaction.unit.findUnique({ where: { id: data.unitId }, select: { id: true } }),
        transaction.tenant.findUnique({ where: { id: data.tenantId }, select: { id: true, status: true } }),
      ]);
      if (!unit) throw new Error('UNIT_NOT_FOUND');
      if (!tenant) throw new Error('TENANT_NOT_FOUND');

      const status = data.status || 'active';
      if (status === 'active' && tenant.status !== 'active') throw new Error('TENANT_INACTIVE');
      if (status === 'active') {
        const activeLease = await transaction.lease.findFirst({
          where: { unitId: data.unitId, status: 'active' },
          select: { id: true },
        });
        if (activeLease) throw new Error('UNIT_ALREADY_LEASED');
      }

      const created = await transaction.lease.create({
        data: {
          unitId: data.unitId,
          tenantId: data.tenantId,
          startDate,
          endDate,
          rentAmount: data.rentAmount,
          deposit: data.deposit ?? null,
          status,
        },
        include: leaseInclude,
      });
      await syncUnitStatus(transaction, data.unitId);
      await transaction.activityLog.create({
        data: auditEntry('create', 'lease', created.id, {
          unitId: created.unitId,
          tenantId: created.tenantId,
          status: created.status,
        }),
      });
      return created;
    });

    return NextResponse.json(lease, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNIT_NOT_FOUND') return apiError('Unit not found', 404);
      if (error.message === 'TENANT_NOT_FOUND') return apiError('Tenant not found', 404);
      if (error.message === 'TENANT_INACTIVE') return apiError('Inactive tenants cannot hold an active lease.', 409);
      if (error.message === 'UNIT_ALREADY_LEASED') return apiError('This unit already has an active lease.', 409);
    }
    if (isPrismaError(error, 'P2002')) return apiError('This unit already has an active lease.', 409);
    console.error('Leases POST error:', error);
    return apiError('Failed to create lease', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'leases:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = leaseUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const existing = await db.lease.findUnique({
      where: { id: data.id },
      include: { _count: { select: { payments: true } } },
    });
    if (!existing) return apiError('Lease not found', 404);

    if (existing._count.payments > 0) {
      const protectedChange =
        (data.unitId !== undefined && data.unitId !== existing.unitId) ||
        (data.tenantId !== undefined && data.tenantId !== existing.tenantId) ||
        (data.startDate !== undefined && new Date(data.startDate).getTime() !== existing.startDate.getTime()) ||
        (data.rentAmount !== undefined && !moneyEquals(data.rentAmount, existing.rentAmount)) ||
        (data.deposit !== undefined && !moneyEquals(data.deposit, existing.deposit));
      if (protectedChange) {
        return apiError('A lease with payment history can only change its end date or status.', 409);
      }
    }

    const nextUnitId = data.unitId ?? existing.unitId;
    const nextTenantId = data.tenantId ?? existing.tenantId;
    const nextStatus = data.status ?? existing.status;
    const nextStartDate = data.startDate ? new Date(data.startDate) : existing.startDate;
    const nextEndDate = data.endDate ? new Date(data.endDate) : existing.endDate;
    if (!isValidDateRange(nextStartDate, nextEndDate)) {
      return apiError('The lease end date must be after the start date.', 400);
    }

    const lease = await db.$transaction(async (transaction) => {
      const [unit, tenant] = await Promise.all([
        transaction.unit.findUnique({ where: { id: nextUnitId }, select: { id: true } }),
        transaction.tenant.findUnique({ where: { id: nextTenantId }, select: { id: true, status: true } }),
      ]);
      if (!unit) throw new Error('UNIT_NOT_FOUND');
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      if (nextStatus === 'active' && tenant.status !== 'active') throw new Error('TENANT_INACTIVE');

      if (nextStatus === 'active') {
        const conflictingLease = await transaction.lease.findFirst({
          where: { unitId: nextUnitId, status: 'active', NOT: { id: existing.id } },
          select: { id: true },
        });
        if (conflictingLease) throw new Error('UNIT_ALREADY_LEASED');
      }

      const updateData: Prisma.LeaseUncheckedUpdateInput = {
        unitId: nextUnitId,
        tenantId: nextTenantId,
        startDate: nextStartDate,
        endDate: nextEndDate,
        rentAmount: data.rentAmount ?? existing.rentAmount,
        status: nextStatus,
      };
      if (data.deposit !== undefined) updateData.deposit = data.deposit;

      await transaction.lease.update({ where: { id: existing.id }, data: updateData });
      await syncUnitStatus(transaction, existing.unitId);
      if (nextUnitId !== existing.unitId) await syncUnitStatus(transaction, nextUnitId);
      await transaction.activityLog.create({
        data: auditEntry('update', 'lease', existing.id, {
          fields: Object.keys(data).filter((key) => key !== 'id'),
          unitId: nextUnitId,
          tenantId: nextTenantId,
          status: nextStatus,
        }),
      });

      return transaction.lease.findUniqueOrThrow({ where: { id: existing.id }, include: leaseInclude });
    });

    return NextResponse.json(lease);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNIT_NOT_FOUND') return apiError('Unit not found', 404);
      if (error.message === 'TENANT_NOT_FOUND') return apiError('Tenant not found', 404);
      if (error.message === 'TENANT_INACTIVE') return apiError('Inactive tenants cannot hold an active lease.', 409);
      if (error.message === 'UNIT_ALREADY_LEASED') return apiError('This unit already has an active lease.', 409);
    }
    if (isPrismaError(error, 'P2002')) return apiError('This unit already has an active lease.', 409);
    console.error('Leases PUT error:', error);
    return apiError('Failed to update lease', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'leases:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiError('Lease ID is required', 400);

    const existing = await db.lease.findUnique({
      where: { id },
      include: { _count: { select: { payments: true } } },
    });
    if (!existing) return apiError('Lease not found', 404);
    if (existing._count.payments > 0) {
      return apiError('Leases with payment history cannot be deleted. Terminate the lease instead.', 409);
    }

    await db.$transaction(async (transaction) => {
      await transaction.lease.delete({ where: { id } });
      await syncUnitStatus(transaction, existing.unitId);
      await transaction.activityLog.create({
        data: auditEntry('delete', 'lease', id, {
          unitId: existing.unitId,
          tenantId: existing.tenantId,
          status: existing.status,
        }),
      });
    });

    return NextResponse.json({ message: 'Lease deleted successfully' });
  } catch (error) {
    console.error('Leases DELETE error:', error);
    return apiError('Failed to delete lease', 500);
  }
}
