import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, unitSchema, sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const propertyId = searchParams.get('propertyId') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { unitNumber: { contains: search } },
        { property: { name: { contains: search } } },
      ];
    }
    if (status) where.status = status;
    if (propertyId) where.propertyId = propertyId;

    const [units, total] = await Promise.all([
      db.unit.findMany({
        where,
        skip,
        take: limit,
        include: {
          property: { select: { id: true, name: true, nameAr: true, city: true } },
          lease: {
            where: { status: 'active' },
            include: { tenant: { select: { id: true, name: true, nameAr: true } } },
          },
        },
        orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
      }),
      db.unit.count({ where }),
    ]);

    const response = NextResponse.json({
      data: units,
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
    console.error('Units API error:', error);
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = unitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const unit = await db.unit.create({
      data: {
        propertyId: data.propertyId,
        unitNumber: sanitizeString(data.unitNumber, 50),
        floor: data.floor || null,
        rooms: data.rooms,
        bathrooms: data.bathrooms || 1,
        area: data.area || null,
        rentAmount: data.rentAmount,
        status: data.status || 'available',
      },
      include: { property: true },
    });

    // Update property totalUnits
    const unitCount = await db.unit.count({ where: { propertyId: data.propertyId } });
    await db.property.update({
      where: { id: data.propertyId },
      data: { totalUnits: unitCount },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    console.error('Units POST error:', error);
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = unitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Unit ID is required' }, { status: 400 });
    }

    // Check if unit exists
    const existing = await db.unit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const unit = await db.unit.update({
      where: { id },
      data: {
        propertyId: data.propertyId,
        unitNumber: sanitizeString(data.unitNumber, 50),
        floor: data.floor !== undefined ? data.floor : undefined,
        rooms: data.rooms,
        bathrooms: data.bathrooms,
        area: data.area !== undefined ? data.area : undefined,
        rentAmount: data.rentAmount,
        status: data.status,
      },
      include: { property: true },
    });

    // If property changed, update totalUnits for both old and new properties
    if (data.propertyId && data.propertyId !== existing.propertyId) {
      const oldCount = await db.unit.count({ where: { propertyId: existing.propertyId } });
      await db.property.update({
        where: { id: existing.propertyId },
        data: { totalUnits: oldCount },
      });

      const newCount = await db.unit.count({ where: { propertyId: data.propertyId } });
      await db.property.update({
        where: { id: data.propertyId },
        data: { totalUnits: newCount },
      });
    }

    return NextResponse.json(unit);
  } catch (error) {
    console.error('Units PUT error:', error);
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
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
      return NextResponse.json({ error: 'Unit ID is required' }, { status: 400 });
    }

    // Check if unit exists
    const existing = await db.unit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const propertyId = existing.propertyId;

    // Delete unit (cascades to lease)
    await db.unit.delete({ where: { id } });

    // Update property totalUnits count
    const unitCount = await db.unit.count({ where: { propertyId } });
    await db.property.update({
      where: { id: propertyId },
      data: { totalUnits: unitCount },
    });

    return NextResponse.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Units DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 });
  }
}
