import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimit, sanitizeString } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const q = sanitizeString(searchParams.get('q') || '', 200);

    if (q.length < 2) {
      return NextResponse.json({
        properties: [],
        tenants: [],
        units: [],
        leases: [],
        payments: [],
        maintenance: [],
        messages: [],
      });
    }

    const containsFilter = { contains: q, mode: 'insensitive' as const };

    const [properties, tenants, units, leases, payments, maintenance, messages] = await Promise.all([
      db.property.findMany({
        where: {
          OR: [
            { name: containsFilter },
            { nameAr: containsFilter },
            { address: containsFilter },
            { addressAr: containsFilter },
            { city: containsFilter },
            { cityAr: containsFilter },
          ],
        },
        take: 5,
        select: { id: true, name: true, nameAr: true, address: true, addressAr: true, type: true },
      }),
      db.tenant.findMany({
        where: {
          OR: [
            { name: containsFilter },
            { nameAr: containsFilter },
            { email: containsFilter },
            { phone: containsFilter },
          ],
        },
        take: 5,
        select: { id: true, name: true, nameAr: true, email: true, status: true },
      }),
      db.unit.findMany({
        where: {
          OR: [
            { unitNumber: containsFilter },
          ],
        },
        take: 5,
        select: {
          id: true, unitNumber: true, status: true, rentAmount: true,
          property: { select: { name: true, nameAr: true } },
        },
      }),
      db.lease.findMany({
        where: {
          OR: [
            { status: containsFilter },
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
            { status: containsFilter },
            { method: containsFilter },
            { reference: containsFilter },
          ],
        },
        take: 5,
        include: {
          tenant: { select: { name: true, nameAr: true } },
          lease: { select: { unit: { select: { property: { select: { name: true, nameAr: true } } } } } },
        },
      }),
      db.maintenanceRequest.findMany({
        where: {
          OR: [
            { title: containsFilter },
            { titleAr: containsFilter },
            { description: containsFilter },
            { assignedTo: containsFilter },
          ],
        },
        take: 5,
        select: {
          id: true, title: true, titleAr: true, status: true, priority: true,
          property: { select: { name: true, nameAr: true } },
          unit: { select: { unitNumber: true } },
        },
      }),
      db.message.findMany({
        where: {
          OR: [
            { subject: containsFilter },
            { senderName: containsFilter },
            { senderEmail: containsFilter },
            { content: containsFilter },
          ],
        },
        take: 5,
        select: { id: true, subject: true, senderName: true, category: true, isRead: true },
      }),
    ]);

    const formatResult = (items: any[], type: string, section: string) =>
      items.map((item: any) => {
        let label = '';
        let sublabel = '';
        switch (type) {
          case 'property':
            label = item.nameAr || item.name;
            sublabel = item.addressAr || item.address;
            break;
          case 'tenant':
            label = item.nameAr || item.name;
            sublabel = item.email;
            break;
          case 'unit':
            label = item.unitNumber;
            sublabel = item.property?.nameAr || item.property?.name || '';
            break;
          case 'lease':
            label = item.tenant?.nameAr || item.tenant?.name || '';
            sublabel = `${item.unit?.unitNumber || ''} · ${item.unit?.property?.nameAr || item.unit?.property?.name || ''}`;
            break;
          case 'payment':
            label = `$${item.amount?.toLocaleString() || 0} - ${item.tenant?.nameAr || item.tenant?.name || ''}`;
            sublabel = item.lease?.unit?.property?.nameAr || item.lease?.unit?.property?.name || '';
            break;
          case 'maintenance':
            label = item.titleAr || item.title;
            sublabel = item.property?.nameAr || item.property?.name || '';
            break;
          case 'message':
            label = item.subject;
            sublabel = item.senderName;
            break;
        }
        return { id: item.id, type, label, sublabel, section };
      });

    return NextResponse.json({
      properties: formatResult(properties, 'property', 'properties'),
      tenants: formatResult(tenants, 'tenant', 'tenants'),
      units: formatResult(units, 'unit', 'units'),
      leases: formatResult(leases, 'lease', 'leases'),
      payments: formatResult(payments, 'payment', 'payments'),
      maintenance: formatResult(maintenance, 'maintenance', 'maintenance'),
      messages: formatResult(messages, 'message', 'messages'),
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
