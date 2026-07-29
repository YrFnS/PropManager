import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, getPagination, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import {
  maintenanceSchema,
  maintenanceUpdateSchema,
  sanitizeString,
} from '@/lib/validation';

const maintenanceInclude = {
  property: { select: { id: true, name: true, nameAr: true } },
  unit: { select: { id: true, unitNumber: true } },
  tenant: { select: { id: true, name: true, nameAr: true } },
} satisfies Prisma.MaintenanceRequestInclude;

async function validateRelations(propertyId: string, unitId?: string | null, tenantId?: string | null) {
  const [property, unit, tenant] = await Promise.all([
    db.property.findUnique({ where: { id: propertyId }, select: { id: true } }),
    unitId ? db.unit.findUnique({ where: { id: unitId }, select: { id: true, propertyId: true } }) : null,
    tenantId ? db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }) : null,
  ]);

  if (!property) return 'PROPERTY_NOT_FOUND';
  if (unitId && !unit) return 'UNIT_NOT_FOUND';
  if (unit && unit.propertyId !== propertyId) return 'UNIT_PROPERTY_MISMATCH';
  if (tenantId && !tenant) return 'TENANT_NOT_FOUND';
  return null;
}

function relationError(code: string | null) {
  if (code === 'PROPERTY_NOT_FOUND') return apiError('Property not found', 404);
  if (code === 'UNIT_NOT_FOUND') return apiError('Unit not found', 404);
  if (code === 'TENANT_NOT_FOUND') return apiError('Tenant not found', 404);
  if (code === 'UNIT_PROPERTY_MISMATCH') return apiError('The selected unit does not belong to this property.', 400);
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'maintenance:read');
    if (!limitResult.success) return apiError('Too many requests', 429);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const category = searchParams.get('category') || '';
    const propertyId = searchParams.get('propertyId') || '';
    const { page, limit, skip } = getPagination(searchParams);

    const where: Prisma.MaintenanceRequestWhereInput = {};
    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;
    if (category && category !== 'all') where.category = category;
    if (propertyId && propertyId !== 'all') where.propertyId = propertyId;

    const statsBase: Prisma.MaintenanceRequestWhereInput = {};
    if (category && category !== 'all') statsBase.category = category;
    if (propertyId && propertyId !== 'all') statsBase.propertyId = propertyId;

    const [requests, total, openCount, inProgressCount, resolvedCount, urgentCount] = await Promise.all([
      db.maintenanceRequest.findMany({
        where,
        skip,
        take: limit,
        include: maintenanceInclude,
        orderBy: { createdAt: 'desc' },
      }),
      db.maintenanceRequest.count({ where }),
      db.maintenanceRequest.count({ where: { ...statsBase, status: 'open' } }),
      db.maintenanceRequest.count({ where: { ...statsBase, status: 'in_progress' } }),
      db.maintenanceRequest.count({ where: { ...statsBase, status: 'resolved' } }),
      db.maintenanceRequest.count({ where: { ...statsBase, priority: 'urgent' } }),
    ]);

    const response = NextResponse.json({
      data: requests,
      stats: { openCount, inProgressCount, resolvedCount, urgentCount },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return response;
  } catch (error) {
    console.error('Maintenance GET error:', error);
    return apiError('Failed to fetch maintenance requests', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'maintenance:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = maintenanceSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const invalidRelation = await validateRelations(data.propertyId, data.unitId, data.tenantId);
    const invalidRelationResponse = relationError(invalidRelation);
    if (invalidRelationResponse) return invalidRelationResponse;

    const maintenanceRequest = await db.$transaction(async (transaction) => {
      const created = await transaction.maintenanceRequest.create({
        data: {
          propertyId: data.propertyId,
          unitId: data.unitId || null,
          tenantId: data.tenantId || null,
          title: sanitizeString(data.title, 300),
          titleAr: data.titleAr ? sanitizeString(data.titleAr, 300) : null,
          description: data.description ? sanitizeString(data.description, 3000) : '',
          descriptionAr: data.descriptionAr ? sanitizeString(data.descriptionAr, 3000) : null,
          priority: data.priority || 'medium',
          status: data.status || 'open',
          category: data.category || 'other',
          assignedTo: data.assignedTo ? sanitizeString(data.assignedTo, 200) : null,
          completedAt: data.status === 'resolved' || data.status === 'closed' ? new Date() : null,
        },
        include: maintenanceInclude,
      });
      await transaction.activityLog.create({
        data: auditEntry('create', 'maintenance', created.id, {
          propertyId: created.propertyId,
          unitId: created.unitId,
          priority: created.priority,
          status: created.status,
        }),
      });
      return created;
    });

    return NextResponse.json(maintenanceRequest, { status: 201 });
  } catch (error) {
    console.error('Maintenance POST error:', error);
    return apiError('Failed to create maintenance request', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'maintenance:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const body = await request.json();
    const parsed = maintenanceUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const existing = await db.maintenanceRequest.findUnique({ where: { id: data.id } });
    if (!existing) return apiError('Maintenance request not found', 404);

    const propertyId = data.propertyId ?? existing.propertyId;
    const unitId = data.unitId !== undefined ? data.unitId : existing.unitId;
    const tenantId = data.tenantId !== undefined ? data.tenantId : existing.tenantId;
    const invalidRelation = await validateRelations(propertyId, unitId, tenantId);
    const invalidRelationResponse = relationError(invalidRelation);
    if (invalidRelationResponse) return invalidRelationResponse;

    const status = data.status ?? existing.status;
    const updateData: Prisma.MaintenanceRequestUncheckedUpdateInput = {
      propertyId,
      unitId,
      tenantId,
      status,
      completedAt: status === 'resolved' || status === 'closed' ? existing.completedAt ?? new Date() : null,
    };
    if (data.title !== undefined) updateData.title = sanitizeString(data.title, 300);
    if (data.titleAr !== undefined) updateData.titleAr = data.titleAr ? sanitizeString(data.titleAr, 300) : null;
    if (data.description !== undefined) updateData.description = data.description ? sanitizeString(data.description, 3000) : '';
    if (data.descriptionAr !== undefined) updateData.descriptionAr = data.descriptionAr ? sanitizeString(data.descriptionAr, 3000) : null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo ? sanitizeString(data.assignedTo, 200) : null;

    const maintenanceRequest = await db.$transaction(async (transaction) => {
      const updated = await transaction.maintenanceRequest.update({
        where: { id: data.id },
        data: updateData,
        include: maintenanceInclude,
      });
      await transaction.activityLog.create({
        data: auditEntry('update', 'maintenance', data.id, {
          fields: Object.keys(data).filter((key) => key !== 'id'),
          propertyId: updated.propertyId,
          unitId: updated.unitId,
          priority: updated.priority,
          status: updated.status,
        }),
      });
      return updated;
    });
    return NextResponse.json(maintenanceRequest);
  } catch (error) {
    console.error('Maintenance PUT error:', error);
    return apiError('Failed to update maintenance request', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'maintenance:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiError('Maintenance request ID is required', 400);

    const existing = await db.maintenanceRequest.findUnique({
      where: { id },
      select: { id: true, propertyId: true, unitId: true, priority: true, status: true },
    });
    if (!existing) return apiError('Maintenance request not found', 404);

    await db.$transaction(async (transaction) => {
      await transaction.maintenanceRequest.delete({ where: { id } });
      await transaction.activityLog.create({
        data: auditEntry('delete', 'maintenance', id, {
          propertyId: existing.propertyId,
          unitId: existing.unitId,
          priority: existing.priority,
          status: existing.status,
        }),
      });
    });
    return NextResponse.json({ message: 'Maintenance request deleted successfully' });
  } catch (error) {
    console.error('Maintenance DELETE error:', error);
    return apiError('Failed to delete maintenance request', 500);
  }
}
