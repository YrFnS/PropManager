import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, getPagination, isPrismaError, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import { sanitizeString, unitSchema, unitUpdateSchema } from '@/lib/validation';

const activeLeaseInclude = {
  where: { status: 'active' },
  take: 1,
  orderBy: { createdAt: 'desc' },
  include: { tenant: { select: { id: true, name: true, nameAr: true } } },
} satisfies Prisma.LeaseFindManyArgs;

async function updatePropertyUnitCount(transaction: Prisma.TransactionClient, propertyId: string) {
  const count = await transaction.unit.count({ where: { propertyId } });
  await transaction.property.update({ where: { id: propertyId }, data: { totalUnits: count } });
}

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'units:read');
    if (!limitResult.success) return apiError('Too many requests', 429);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const propertyId = searchParams.get('propertyId') || '';
    const { page, limit, skip } = getPagination(searchParams);

    const where: Prisma.UnitWhereInput = {};
    if (search) {
      where.OR = [
        { unitNumber: { contains: search, mode: 'insensitive' } },
        { property: { name: { contains: search, mode: 'insensitive' } } },
        { property: { nameAr: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status && status !== 'all') where.status = status;
    if (propertyId && propertyId !== 'all') where.propertyId = propertyId;

    const [units, total] = await Promise.all([
      db.unit.findMany({
        where,
        skip,
        take: limit,
        include: {
          property: { select: { id: true, name: true, nameAr: true, city: true } },
          leases: activeLeaseInclude,
        },
        orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
      }),
      db.unit.count({ where }),
    ]);

    const data = units.map(({ leases, ...unit }) => ({ ...unit, lease: leases }));
    const response = NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return response;
  } catch (error) {
    console.error('Units GET error:', error);
    return apiError('Failed to fetch units', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'units:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = unitSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    if (data.status === 'rented') {
      return apiError('A unit becomes rented when an active lease is created.', 400);
    }

    const unit = await db.$transaction(async (transaction) => {
      const property = await transaction.property.findUnique({ where: { id: data.propertyId }, select: { id: true } });
      if (!property) throw new Error('PROPERTY_NOT_FOUND');

      const created = await transaction.unit.create({
        data: {
          propertyId: data.propertyId,
          unitNumber: sanitizeString(data.unitNumber, 50),
          floor: data.floor ?? null,
          rooms: data.rooms,
          bathrooms: data.bathrooms ?? 1,
          area: data.area ?? null,
          rentAmount: data.rentAmount,
          status: data.status || 'available',
        },
        include: { property: true },
      });
      await updatePropertyUnitCount(transaction, data.propertyId);
      await transaction.activityLog.create({
        data: auditEntry('create', 'unit', created.id, {
          propertyId: created.propertyId,
          unitNumber: created.unitNumber,
        }),
      });
      return created;
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROPERTY_NOT_FOUND') return apiError('Property not found', 404);
    if (isPrismaError(error, 'P2002')) return apiError('This unit number already exists in the selected property.', 409);
    console.error('Units POST error:', error);
    return apiError('Failed to create unit', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'units:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = unitUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const existing = await db.unit.findUnique({
      where: { id: data.id },
      include: { leases: { select: { id: true, status: true } } },
    });
    if (!existing) return apiError('Unit not found', 404);

    const nextPropertyId = data.propertyId ?? existing.propertyId;
    const activeLease = existing.leases.some((lease) => lease.status === 'active');
    if (nextPropertyId !== existing.propertyId && existing.leases.length > 0) {
      return apiError('A unit with lease history cannot be moved to another property.', 409);
    }
    if (data.status === 'rented' && !activeLease) {
      return apiError('A unit becomes rented when an active lease is created.', 400);
    }
    if (activeLease && data.status && data.status !== 'rented') {
      return apiError('End or terminate the active lease before changing this unit status.', 409);
    }

    const unit = await db.$transaction(async (transaction) => {
      const property = await transaction.property.findUnique({ where: { id: nextPropertyId }, select: { id: true } });
      if (!property) throw new Error('PROPERTY_NOT_FOUND');

      const updateData: Prisma.UnitUncheckedUpdateInput = {};
      if (data.propertyId !== undefined) updateData.propertyId = data.propertyId;
      if (data.unitNumber !== undefined) updateData.unitNumber = sanitizeString(data.unitNumber, 50);
      if (data.floor !== undefined) updateData.floor = data.floor;
      if (data.rooms !== undefined) updateData.rooms = data.rooms;
      if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
      if (data.area !== undefined) updateData.area = data.area;
      if (data.rentAmount !== undefined) updateData.rentAmount = data.rentAmount;
      if (data.status !== undefined) updateData.status = data.status;
      else if (activeLease) updateData.status = 'rented';
      else if (existing.status === 'rented') updateData.status = 'available';

      const updated = await transaction.unit.update({
        where: { id: data.id },
        data: updateData,
        include: { property: true },
      });

      if (nextPropertyId !== existing.propertyId) {
        await updatePropertyUnitCount(transaction, existing.propertyId);
        await updatePropertyUnitCount(transaction, nextPropertyId);
      }
      await transaction.activityLog.create({
        data: auditEntry('update', 'unit', data.id, {
          fields: Object.keys(data).filter((key) => key !== 'id'),
          propertyId: updated.propertyId,
          unitNumber: updated.unitNumber,
        }),
      });
      return updated;
    });

    return NextResponse.json(unit);
  } catch (error) {
    if (error instanceof Error && error.message === 'PROPERTY_NOT_FOUND') return apiError('Property not found', 404);
    if (isPrismaError(error, 'P2002')) return apiError('This unit number already exists in the selected property.', 409);
    console.error('Units PUT error:', error);
    return apiError('Failed to update unit', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'units:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiError('Unit ID is required', 400);

    const existing = await db.unit.findUnique({
      where: { id },
      include: { _count: { select: { leases: true, maintenanceRequests: true } } },
    });
    if (!existing) return apiError('Unit not found', 404);
    if (existing._count.leases > 0 || existing._count.maintenanceRequests > 0) {
      return apiError('Units with lease or maintenance history cannot be deleted.', 409);
    }

    await db.$transaction(async (transaction) => {
      await transaction.unit.delete({ where: { id } });
      await updatePropertyUnitCount(transaction, existing.propertyId);
      await transaction.activityLog.create({
        data: auditEntry('delete', 'unit', id, {
          propertyId: existing.propertyId,
          unitNumber: existing.unitNumber,
        }),
      });
    });
    return NextResponse.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Units DELETE error:', error);
    return apiError('Failed to delete unit', 500);
  }
}
