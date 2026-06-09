import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, maintenanceSchema, sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const category = searchParams.get('category') || '';
    const propertyId = searchParams.get('propertyId') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (propertyId) where.propertyId = propertyId;

    const [requests, total] = await Promise.all([
      db.maintenanceRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          property: { select: { id: true, name: true, nameAr: true } },
          unit: { select: { id: true, unitNumber: true } },
          tenant: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.maintenanceRequest.count({ where }),
    ]);

    // Stats
    const openCount = await db.maintenanceRequest.count({ where: { status: 'open' } });
    const inProgressCount = await db.maintenanceRequest.count({ where: { status: 'in_progress' } });
    const resolvedCount = await db.maintenanceRequest.count({ where: { status: 'resolved' } });
    const urgentCount = await db.maintenanceRequest.count({ where: { priority: 'urgent' } });

    const response = NextResponse.json({
      data: requests,
      stats: { openCount, inProgressCount, resolvedCount, urgentCount },
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
    console.error('Maintenance API error:', error);
    return NextResponse.json({ error: 'Failed to fetch maintenance requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = maintenanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const maintenanceRequest = await db.maintenanceRequest.create({
      data: {
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        tenantId: data.tenantId || null,
        title: sanitizeString(data.title, 300),
        titleAr: data.titleAr ? sanitizeString(data.titleAr, 300) : null,
        description: sanitizeString(data.description, 3000),
        descriptionAr: data.descriptionAr ? sanitizeString(data.descriptionAr, 3000) : null,
        priority: data.priority || 'medium',
        status: data.status || 'open',
        category: data.category || 'other',
        assignedTo: data.assignedTo ? sanitizeString(data.assignedTo, 200) : null,
      },
      include: { property: true, unit: true, tenant: true },
    });

    return NextResponse.json(maintenanceRequest, { status: 201 });
  } catch (error) {
    console.error('Maintenance POST error:', error);
    return NextResponse.json({ error: 'Failed to create maintenance request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = maintenanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Maintenance request ID is required' }, { status: 400 });
    }

    // Check if maintenance request exists
    const existing = await db.maintenanceRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
    }

    const maintenanceRequest = await db.maintenanceRequest.update({
      where: { id },
      data: {
        propertyId: data.propertyId,
        unitId: data.unitId !== undefined ? data.unitId || null : undefined,
        tenantId: data.tenantId !== undefined ? data.tenantId || null : undefined,
        title: data.title ? sanitizeString(data.title, 300) : undefined,
        titleAr: data.titleAr !== undefined ? data.titleAr ? sanitizeString(data.titleAr, 300) : null : undefined,
        description: data.description ? sanitizeString(data.description, 3000) : undefined,
        descriptionAr: data.descriptionAr !== undefined ? data.descriptionAr ? sanitizeString(data.descriptionAr, 3000) : null : undefined,
        priority: data.priority,
        status: data.status,
        category: data.category,
        assignedTo: data.assignedTo !== undefined ? data.assignedTo ? sanitizeString(data.assignedTo, 200) : null : undefined,
        completedAt: data.status === 'resolved' || data.status === 'closed' ? new Date() : undefined,
      },
      include: { property: true, unit: true, tenant: true },
    });

    return NextResponse.json(maintenanceRequest);
  } catch (error) {
    console.error('Maintenance PUT error:', error);
    return NextResponse.json({ error: 'Failed to update maintenance request' }, { status: 500 });
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
      return NextResponse.json({ error: 'Maintenance request ID is required' }, { status: 400 });
    }

    // Check if maintenance request exists
    const existing = await db.maintenanceRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
    }

    await db.maintenanceRequest.delete({ where: { id } });

    return NextResponse.json({ message: 'Maintenance request deleted successfully' });
  } catch (error) {
    console.error('Maintenance DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete maintenance request' }, { status: 500 });
  }
}
