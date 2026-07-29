import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, requestRateLimit } from '@/lib/api';
import { sanitizeString } from '@/lib/validation';
import { moneyToNumber } from '@/lib/money';

interface SearchResultItem {
  id: string;
  type: string;
  label: string;
  sublabel: string;
  section: string;
}

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'search:read', { maxRequests: 180 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const { searchParams } = new URL(request.url);
    const query = sanitizeString(searchParams.get('q') || '', 200);
    if (query.length < 2) {
      return NextResponse.json({ properties: [], tenants: [], units: [], leases: [], payments: [], maintenance: [], messages: [] });
    }

    const isArabic = request.cookies.get('NEXT_LOCALE')?.value === 'ar';
    const contains = { contains: query, mode: 'insensitive' as const };
    const [properties, tenants, units, leases, payments, maintenance, messages] = await Promise.all([
      db.property.findMany({
        where: { OR: [{ name: contains }, { nameAr: contains }, { address: contains }, { addressAr: contains }, { city: contains }, { cityAr: contains }] },
        take: 5,
        select: { id: true, name: true, nameAr: true, address: true, addressAr: true },
      }),
      db.tenant.findMany({
        where: { OR: [{ name: contains }, { nameAr: contains }, { email: contains }, { phone: contains }] },
        take: 5,
        select: { id: true, name: true, nameAr: true, email: true },
      }),
      db.unit.findMany({
        where: { OR: [{ unitNumber: contains }, { property: { name: contains } }, { property: { nameAr: contains } }] },
        take: 5,
        select: { id: true, unitNumber: true, property: { select: { name: true, nameAr: true } } },
      }),
      db.lease.findMany({
        where: {
          OR: [
            { status: contains },
            { tenant: { name: contains } },
            { tenant: { nameAr: contains } },
            { unit: { unitNumber: contains } },
            { unit: { property: { name: contains } } },
            { unit: { property: { nameAr: contains } } },
          ],
        },
        take: 5,
        include: {
          tenant: { select: { name: true, nameAr: true } },
          unit: { select: { unitNumber: true, property: { select: { name: true, nameAr: true } } } },
        },
      }),
      db.payment.findMany({
        where: {
          OR: [
            { status: contains },
            { method: contains },
            { reference: contains },
            { tenant: { name: contains } },
            { tenant: { nameAr: contains } },
            { lease: { unit: { unitNumber: contains } } },
            { lease: { unit: { property: { name: contains } } } },
            { lease: { unit: { property: { nameAr: contains } } } },
          ],
        },
        take: 5,
        select: {
          id: true,
          amount: true,
          tenant: { select: { name: true, nameAr: true } },
          lease: { select: { unit: { select: { unitNumber: true, property: { select: { name: true, nameAr: true } } } } } },
        },
      }),
      db.maintenanceRequest.findMany({
        where: { OR: [{ title: contains }, { titleAr: contains }, { description: contains }, { assignedTo: contains }] },
        take: 5,
        select: { id: true, title: true, titleAr: true, property: { select: { name: true, nameAr: true } }, unit: { select: { unitNumber: true } } },
      }),
      db.message.findMany({
        where: { OR: [{ subject: contains }, { senderName: contains }, { senderEmail: contains }, { content: contains }] },
        take: 5,
        select: { id: true, subject: true, senderName: true },
      }),
    ]);

    const propertyResults: SearchResultItem[] = properties.map((item) => ({
      id: item.id,
      type: 'property',
      label: isArabic && item.nameAr ? item.nameAr : item.name,
      sublabel: isArabic && item.addressAr ? item.addressAr : item.address,
      section: 'properties',
    }));
    const tenantResults: SearchResultItem[] = tenants.map((item) => ({
      id: item.id,
      type: 'tenant',
      label: isArabic && item.nameAr ? item.nameAr : item.name,
      sublabel: item.email,
      section: 'tenants',
    }));
    const unitResults: SearchResultItem[] = units.map((item) => ({
      id: item.id,
      type: 'unit',
      label: item.unitNumber,
      sublabel: isArabic && item.property.nameAr ? item.property.nameAr : item.property.name,
      section: 'units',
    }));
    const leaseResults: SearchResultItem[] = leases.map((item) => ({
      id: item.id,
      type: 'lease',
      label: isArabic && item.tenant.nameAr ? item.tenant.nameAr : item.tenant.name,
      sublabel: `${item.unit.unitNumber} · ${isArabic && item.unit.property.nameAr ? item.unit.property.nameAr : item.unit.property.name}`,
      section: 'leases',
    }));
    const paymentResults: SearchResultItem[] = payments.map((item) => ({
      id: item.id,
      type: 'payment',
      label: `${moneyToNumber(item.amount).toLocaleString(isArabic ? 'ar-IQ' : 'en-US')} · ${isArabic && item.tenant.nameAr ? item.tenant.nameAr : item.tenant.name}`,
      sublabel: `${item.lease.unit.unitNumber} · ${isArabic && item.lease.unit.property.nameAr ? item.lease.unit.property.nameAr : item.lease.unit.property.name}`,
      section: 'payments',
    }));
    const maintenanceResults: SearchResultItem[] = maintenance.map((item) => ({
      id: item.id,
      type: 'maintenance',
      label: isArabic && item.titleAr ? item.titleAr : item.title,
      sublabel: `${isArabic && item.property.nameAr ? item.property.nameAr : item.property.name}${item.unit ? ` · ${item.unit.unitNumber}` : ''}`,
      section: 'maintenance',
    }));
    const messageResults: SearchResultItem[] = messages.map((item) => ({
      id: item.id,
      type: 'message',
      label: item.subject,
      sublabel: item.senderName,
      section: 'messages',
    }));

    return NextResponse.json({
      properties: propertyResults,
      tenants: tenantResults,
      units: unitResults,
      leases: leaseResults,
      payments: paymentResults,
      maintenance: maintenanceResults,
      messages: messageResults,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return apiError('Failed to search', 500);
  }
}
