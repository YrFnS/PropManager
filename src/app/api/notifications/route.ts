import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, requestRateLimit } from '@/lib/api';
import { moneyToNumber } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'notifications:read', { maxRequests: 180 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
    const localeHeader = request.headers.get('accept-language') || '';
    const isArabic = localeCookie === 'ar' || (!localeCookie && localeHeader.toLowerCase().startsWith('ar'));

    const [unreadMessages, latePayments, openMaintenance, unreadMessageCount] = await Promise.all([
      db.message.findMany({ where: { isRead: false }, orderBy: { createdAt: 'desc' }, take: 5 }),
      db.payment.findMany({
        where: { status: 'late' },
        include: { tenant: { select: { id: true, name: true, nameAr: true } } },
        orderBy: { dueDate: 'desc' },
        take: 5,
      }),
      db.maintenanceRequest.findMany({
        where: { status: 'open' },
        include: {
          property: { select: { id: true, name: true, nameAr: true } },
          unit: { select: { id: true, unitNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.message.count({ where: { isRead: false } }),
    ]);

    const notifications: Array<{
      id: string;
      type: 'message' | 'payment' | 'maintenance';
      title: string;
      description: string;
      createdAt: string;
      section: string;
    }> = [];

    for (const message of unreadMessages) {
      notifications.push({
        id: `msg_${message.id}`,
        type: 'message',
        title: isArabic ? `رسالة جديدة من ${message.senderName}` : `New message from ${message.senderName}`,
        description: message.subject,
        createdAt: message.createdAt.toISOString(),
        section: 'messages',
      });
    }

    for (const payment of latePayments) {
      const tenantName = isArabic && payment.tenant?.nameAr ? payment.tenant.nameAr : payment.tenant?.name || (isArabic ? 'غير معروف' : 'Unknown');
      notifications.push({
        id: `pay_${payment.id}`,
        type: 'payment',
        title: isArabic ? 'دفعة متأخرة' : 'Late payment',
        description: isArabic
          ? `${moneyToNumber(payment.amount).toLocaleString('ar-IQ')} من ${tenantName}`
          : `$${moneyToNumber(payment.amount).toLocaleString('en-US')} from ${tenantName}`,
        createdAt: payment.dueDate.toISOString(),
        section: 'payments',
      });
    }

    for (const maintenance of openMaintenance) {
      const propertyName = isArabic && maintenance.property.nameAr ? maintenance.property.nameAr : maintenance.property.name;
      const unitInfo = maintenance.unit
        ? `${isArabic ? 'الوحدة' : 'Unit'} ${maintenance.unit.unitNumber}`
        : propertyName;
      notifications.push({
        id: `maint_${maintenance.id}`,
        type: 'maintenance',
        title: isArabic ? 'طلب صيانة مفتوح' : 'Open maintenance request',
        description: `${isArabic && maintenance.titleAr ? maintenance.titleAr : maintenance.title} · ${unitInfo}`,
        createdAt: maintenance.createdAt.toISOString(),
        section: 'maintenance',
      });
    }

    notifications.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const response = NextResponse.json({
      notifications: notifications.slice(0, 8),
      unreadCount: unreadMessageCount,
    });
    response.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
    return response;
  } catch (error) {
    console.error('Notifications API error:', error);
    return apiError('Failed to fetch notifications', 500);
  }
}
