import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = await params;

    const property = await db.property.findUnique({
      where: { id },
      include: {
        manager: true,
        units: {
          include: {
            lease: {
              include: {
                tenant: true,
              },
            },
          },
          orderBy: { unitNumber: 'asc' },
        },
        maintenanceRequests: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            tenant: { select: { name: true, nameAr: true } },
            unit: { select: { unitNumber: true } },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const totalUnits = property.units.length;
    const occupiedUnits = property.units.filter((u) => u.status === 'rented').length;
    const availableUnits = property.units.filter((u) => u.status === 'available').length;
    const maintenanceUnits = property.units.filter((u) => u.status === 'maintenance').length;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const monthlyRevenue = property.units
      .filter((u) => u.status === 'rented')
      .reduce((sum, u) => sum + u.rentAmount, 0);
    const totalRent = property.units.reduce((sum, u) => sum + u.rentAmount, 0);
    const averageRent = totalUnits > 0 ? Math.round(totalRent / totalUnits) : 0;

    const unitsWithTenant = property.units.map((u) => ({
      id: u.id,
      unitNumber: u.unitNumber,
      floor: u.floor,
      rooms: u.rooms,
      bathrooms: u.bathrooms,
      area: u.area,
      rentAmount: u.rentAmount,
      status: u.status,
      tenant: u.lease?.tenant
        ? { name: u.lease.tenant.name, nameAr: u.lease.tenant.nameAr }
        : null,
    }));

    const recentMaintenance = property.maintenanceRequests.map((m) => ({
      id: m.id,
      title: m.title,
      titleAr: m.titleAr,
      status: m.status,
      priority: m.priority,
      category: m.category,
      unitNumber: m.unit?.unitNumber,
      tenantName: m.tenant?.name,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
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
      image: property.image,
      createdAt: property.createdAt,
      manager: property.manager,
      stats: {
        totalUnits,
        occupiedUnits,
        availableUnits,
        maintenanceUnits,
        occupancyRate,
        monthlyRevenue,
        averageRent,
        totalRent,
      },
      units: unitsWithTenant,
      recentMaintenance,
    });
  } catch (error) {
    console.error('Property detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch property' }, { status: 500 });
  }
}
