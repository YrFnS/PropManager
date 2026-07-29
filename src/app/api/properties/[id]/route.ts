import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, requestRateLimit } from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limitResult = requestRateLimit(request, 'properties:detail');
    if (!limitResult.success) return apiError('Too many requests', 429);

    const { id } = await params;
    const property = await db.property.findUnique({
      where: { id },
      include: {
        manager: true,
        units: {
          include: {
            leases: {
              where: { status: 'active' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { tenant: true },
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

    if (!property) return apiError('Property not found', 404);

    const totalUnits = property.units.length;
    const occupiedUnits = property.units.filter((unit) => unit.leases.length > 0).length;
    const maintenanceUnits = property.units.filter(
      (unit) => unit.leases.length === 0 && unit.status === 'maintenance',
    ).length;
    const availableUnits = Math.max(0, totalUnits - occupiedUnits - maintenanceUnits);
    const totalRent = property.units.reduce((sum, unit) => sum + unit.rentAmount, 0);
    const monthlyRevenue = property.units.reduce(
      (sum, unit) => sum + (unit.leases[0]?.rentAmount ?? 0),
      0,
    );

    const units = property.units.map(({ leases, ...unit }) => ({
      ...unit,
      status: leases.length > 0 ? 'rented' : unit.status === 'rented' ? 'available' : unit.status,
      tenant: leases[0]?.tenant
        ? { name: leases[0].tenant.name, nameAr: leases[0].tenant.nameAr }
        : null,
    }));

    const recentMaintenance = property.maintenanceRequests.map((requestItem) => ({
      id: requestItem.id,
      title: requestItem.title,
      titleAr: requestItem.titleAr,
      status: requestItem.status,
      priority: requestItem.priority,
      category: requestItem.category,
      unitNumber: requestItem.unit?.unitNumber,
      tenantName: requestItem.tenant?.name,
      createdAt: requestItem.createdAt,
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
        occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
        monthlyRevenue,
        averageRent: totalUnits > 0 ? Math.round(totalRent / totalUnits) : 0,
        totalRent,
      },
      units,
      recentMaintenance,
    });
  } catch (error) {
    console.error('Property detail API error:', error);
    return apiError('Failed to fetch property', 500);
  }
}
