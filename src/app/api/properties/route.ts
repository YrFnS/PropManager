import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, getPagination, isPrismaError, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import { moneyToNumber } from '@/lib/money';
import {
  propertyManagerSchema,
  propertySchema,
  propertyUpdateSchema,
  sanitizeString,
} from '@/lib/validation';

function sanitizeManager(manager: unknown) {
  if (manager === null || manager === undefined) return manager;
  if (typeof manager === 'object') {
    const values = Object.values(manager as Record<string, unknown>);
    if (values.every((value) => value === null || value === undefined || String(value).trim() === '')) return null;
  }
  const parsed = propertyManagerSchema.safeParse(manager);
  if (!parsed.success) return parsed;
  return {
    success: true as const,
    data: {
      name: sanitizeString(parsed.data.name, 200),
      nameAr: parsed.data.nameAr ? sanitizeString(parsed.data.nameAr, 200) : null,
      email: sanitizeString(parsed.data.email, 200),
      phone: parsed.data.phone ? sanitizeString(parsed.data.phone, 50) : null,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'properties:read');
    if (!limitResult.success) return apiError('Too many requests', 429);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const { page, limit, skip } = getPagination(searchParams);
    const where: Prisma.PropertyWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameAr: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { cityAr: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { addressAr: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type && type !== 'all') where.type = type;

    const [properties, total] = await Promise.all([
      db.property.findMany({
        where,
        skip,
        take: limit,
        include: {
          manager: true,
          _count: { select: { units: true } },
          units: {
            select: {
              status: true,
              rentAmount: true,
              leases: { where: { status: 'active' }, select: { rentAmount: true }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.property.count({ where }),
    ]);

    const data = properties.map((property) => {
      const occupiedUnits = property.units.filter((unit) => unit.leases.length > 0).length;
      const maintenanceUnits = property.units.filter(
        (unit) => unit.leases.length === 0 && unit.status === 'maintenance',
      ).length;
      const unitCount = property._count.units;
      const availableUnits = Math.max(0, unitCount - occupiedUnits - maintenanceUnits);
      const totalRent = property.units.reduce(
        (sum, unit) => sum + moneyToNumber(unit.leases[0]?.rentAmount),
        0,
      );

      return {
        id: property.id,
        name: property.name,
        nameAr: property.nameAr,
        address: property.address,
        addressAr: property.addressAr,
        city: property.city,
        cityAr: property.cityAr,
        state: property.state,
        zipCode: property.zipCode,
        description: property.description,
        descriptionAr: property.descriptionAr,
        type: property.type,
        totalUnits: unitCount,
        image: property.image,
        createdAt: property.createdAt,
        manager: property.manager,
        unitCount,
        occupiedUnits,
        availableUnits,
        maintenanceUnits,
        totalRent,
        occupancyRate: unitCount > 0 ? Math.round((occupiedUnits / unitCount) * 100) : 0,
      };
    });

    const response = NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return response;
  } catch (error) {
    console.error('Properties GET error:', error);
    return apiError('Failed to fetch properties', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'properties:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = propertySchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);

    const manager = sanitizeManager(body.manager);
    if (manager && 'success' in manager && !manager.success) {
      return apiError('Manager validation failed', 400, manager.error.issues);
    }

    const data = parsed.data;
    const property = await db.$transaction(async (transaction) => {
      const created = await transaction.property.create({
        data: {
          name: sanitizeString(data.name, 200),
          nameAr: data.nameAr ? sanitizeString(data.nameAr, 200) : null,
          address: sanitizeString(data.address, 500),
          addressAr: data.addressAr ? sanitizeString(data.addressAr, 500) : null,
          city: sanitizeString(data.city, 100),
          cityAr: data.cityAr ? sanitizeString(data.cityAr, 100) : null,
          state: data.state ? sanitizeString(data.state, 100) : null,
          zipCode: data.zipCode ? sanitizeString(data.zipCode, 20) : null,
          description: data.description ? sanitizeString(data.description, 2000) : null,
          descriptionAr: data.descriptionAr ? sanitizeString(data.descriptionAr, 2000) : null,
          image: data.image ? sanitizeString(data.image, 2000) : null,
          type: data.type || 'residential',
          totalUnits: 0,
          manager: manager && 'data' in manager ? { create: manager.data } : undefined,
        },
        include: { manager: true },
      });
      await transaction.activityLog.create({
        data: auditEntry('create', 'property', created.id, { name: created.name }),
      });
      return created;
    });

    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2002')) return apiError('A property or manager with this unique value already exists.', 409);
    console.error('Properties POST error:', error);
    return apiError('Failed to create property', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'properties:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = propertyUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const existing = await db.property.findUnique({ where: { id: data.id }, include: { manager: true } });
    if (!existing) return apiError('Property not found', 404);

    const manager = body.manager === undefined ? undefined : sanitizeManager(body.manager);
    if (manager && 'success' in manager && !manager.success) {
      return apiError('Manager validation failed', 400, manager.error.issues);
    }

    const property = await db.$transaction(async (transaction) => {
      const updateData: Prisma.PropertyUncheckedUpdateInput = {};
      if (data.name !== undefined) updateData.name = sanitizeString(data.name, 200);
      if (data.nameAr !== undefined) updateData.nameAr = data.nameAr ? sanitizeString(data.nameAr, 200) : null;
      if (data.address !== undefined) updateData.address = sanitizeString(data.address, 500);
      if (data.addressAr !== undefined) updateData.addressAr = data.addressAr ? sanitizeString(data.addressAr, 500) : null;
      if (data.city !== undefined) updateData.city = sanitizeString(data.city, 100);
      if (data.cityAr !== undefined) updateData.cityAr = data.cityAr ? sanitizeString(data.cityAr, 100) : null;
      if (data.state !== undefined) updateData.state = data.state ? sanitizeString(data.state, 100) : null;
      if (data.zipCode !== undefined) updateData.zipCode = data.zipCode ? sanitizeString(data.zipCode, 20) : null;
      if (data.description !== undefined) updateData.description = data.description ? sanitizeString(data.description, 2000) : null;
      if (data.descriptionAr !== undefined) updateData.descriptionAr = data.descriptionAr ? sanitizeString(data.descriptionAr, 2000) : null;
      if (data.image !== undefined) updateData.image = data.image ? sanitizeString(data.image, 2000) : null;
      if (data.type !== undefined) updateData.type = data.type;

      await transaction.property.update({ where: { id: data.id }, data: updateData });

      if (manager === null) {
        await transaction.propertyManager.deleteMany({ where: { propertyId: data.id } });
      } else if (manager && 'data' in manager) {
        await transaction.propertyManager.upsert({
          where: { propertyId: data.id },
          create: { propertyId: data.id, ...manager.data },
          update: manager.data,
        });
      }

      await transaction.activityLog.create({
        data: auditEntry('update', 'property', data.id, {
          fields: Object.keys(data).filter((key) => key !== 'id'),
          managerChanged: body.manager !== undefined,
        }),
      });
      return transaction.property.findUniqueOrThrow({ where: { id: data.id }, include: { manager: true } });
    });

    return NextResponse.json(property);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) return apiError('A property or manager with this unique value already exists.', 409);
    console.error('Properties PUT error:', error);
    return apiError('Failed to update property', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'properties:write', { maxRequests: 60 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiError('Property ID is required', 400);

    const existing = await db.property.findUnique({
      where: { id },
      include: { _count: { select: { units: true, maintenanceRequests: true } } },
    });
    if (!existing) return apiError('Property not found', 404);
    if (existing._count.units > 0 || existing._count.maintenanceRequests > 0) {
      return apiError('Properties with unit or maintenance history cannot be deleted.', 409);
    }

    await db.$transaction(async (transaction) => {
      await transaction.property.delete({ where: { id } });
      await transaction.activityLog.create({
        data: auditEntry('delete', 'property', id, { name: existing.name }),
      });
    });
    return NextResponse.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Properties DELETE error:', error);
    return apiError('Failed to delete property', 500);
  }
}
