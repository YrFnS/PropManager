import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, propertySchema, sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameAr: { contains: search } },
        { city: { contains: search } },
        { address: { contains: search } },
      ];
    }
    if (type) {
      where.type = type;
    }

    const [properties, total] = await Promise.all([
      db.property.findMany({
        where,
        skip,
        take: limit,
        include: {
          manager: true,
          _count: { select: { units: true } },
          units: {
            select: { status: true, rentAmount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.property.count({ where }),
    ]);

    const data = properties.map((p) => {
      const occupied = p.units.filter((u) => u.status === 'rented').length;
      const available = p.units.filter((u) => u.status === 'available').length;
      const maintenance = p.units.filter((u) => u.status === 'maintenance').length;
      const totalRent = p.units.reduce((sum, u) => sum + u.rentAmount, 0);

      return {
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        address: p.address,
        addressAr: p.addressAr,
        city: p.city,
        cityAr: p.cityAr,
        state: p.state,
        zipCode: p.zipCode,
        description: p.description,
        descriptionAr: p.descriptionAr,
        type: p.type,
        totalUnits: p.totalUnits,
        image: p.image,
        createdAt: p.createdAt,
        manager: p.manager,
        unitCount: p._count.units,
        occupiedUnits: occupied,
        availableUnits: available,
        maintenanceUnits: maintenance,
        totalRent,
        occupancyRate: p._count.units > 0 ? Math.round((occupied / p._count.units) * 100) : 0,
      };
    });

    const response = NextResponse.json({
      data,
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
    console.error('Properties API error:', error);
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = propertySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    // Sanitize string inputs
    const { name, nameAr, address, addressAr, city, cityAr, state, zipCode, description, descriptionAr, image, type, totalUnits, manager } = {
      ...data,
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
      manager: body.manager,
    };

    const property = await db.property.create({
      data: {
        name,
        nameAr: nameAr || null,
        address,
        addressAr: addressAr || null,
        city,
        cityAr: cityAr || null,
        state: state || null,
        zipCode: zipCode || null,
        description: description || null,
        descriptionAr: descriptionAr || null,
        image: image || null,
        type: type || 'residential',
        totalUnits: totalUnits || 0,
        manager: manager ? {
          create: {
            name: sanitizeString(manager.name, 200),
            nameAr: manager.nameAr ? sanitizeString(manager.nameAr, 200) : null,
            email: sanitizeString(manager.email, 200),
            phone: manager.phone ? sanitizeString(manager.phone, 50) : null,
          },
        } : undefined,
      },
      include: { manager: true },
    });

    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    console.error('Properties POST error:', error);
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = propertySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
    }

    // Check if property exists
    const existing = await db.property.findUnique({ where: { id }, include: { manager: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Sanitize string inputs
    const sanitizedData = {
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
      totalUnits: data.totalUnits !== undefined ? data.totalUnits : undefined,
    };

    const property = await db.property.update({
      where: { id },
      data: sanitizedData,
      include: { manager: true },
    });

    // Handle manager update
    const manager = body.manager;
    if (manager !== undefined) {
      if (existing.manager) {
        // Update existing manager
        await db.propertyManager.update({
          where: { propertyId: id },
          data: {
            name: sanitizeString(manager.name, 200),
            nameAr: manager.nameAr ? sanitizeString(manager.nameAr, 200) : null,
            email: sanitizeString(manager.email, 200),
            phone: manager.phone ? sanitizeString(manager.phone, 50) : null,
          },
        });
      } else if (manager) {
        // Create new manager
        await db.propertyManager.create({
          data: {
            propertyId: id,
            name: sanitizeString(manager.name, 200),
            nameAr: manager.nameAr ? sanitizeString(manager.nameAr, 200) : null,
            email: sanitizeString(manager.email, 200),
            phone: manager.phone ? sanitizeString(manager.phone, 50) : null,
          },
        });
      }
    }

    // Fetch updated property with manager
    const updatedProperty = await db.property.findUnique({
      where: { id },
      include: { manager: true },
    });

    return NextResponse.json(updatedProperty);
  } catch (error) {
    console.error('Properties PUT error:', error);
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
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
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
    }

    // Check if property exists
    const existing = await db.property.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Delete property (cascades to manager, units, maintenance requests)
    await db.property.delete({ where: { id } });

    return NextResponse.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Properties DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
  }
}
