import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';

export async function GET() {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Fetch unread messages (last 5)
    const unreadMessages = await db.message.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Fetch late payments (last 5)
    const latePayments = await db.payment.findMany({
      where: { status: 'late' },
      include: {
        tenant: { select: { id: true, name: true, nameAr: true } },
      },
      orderBy: { dueDate: 'desc' },
      take: 5,
    });

    // Fetch open maintenance requests (last 5)
    const openMaintenance = await db.maintenanceRequest.findMany({
      where: { status: 'open' },
      include: {
        property: { select: { id: true, name: true, nameAr: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Count totals for unread count
    const unreadMessageCount = await db.message.count({ where: { isRead: false } });
    const latePaymentCount = await db.payment.count({ where: { status: 'late' } });
    const openMaintenanceCount = await db.maintenanceRequest.count({ where: { status: 'open' } });

    // Build notifications array with type and data instead of hardcoded titles
    const notifications: Array<{
      id: string;
      type: 'message' | 'payment' | 'maintenance';
      data: Record<string, string | number>;
      title: string;
      description: string;
      createdAt: string;
      section: string;
    }> = [];

    for (const msg of unreadMessages) {
      notifications.push({
        id: `msg_${msg.id}`,
        type: 'message',
        data: { senderName: msg.senderName, subject: msg.subject },
        title: `New message from ${msg.senderName}`,
        description: msg.subject,
        createdAt: msg.createdAt.toISOString(),
        section: 'messages',
      });
    }

    for (const pay of latePayments) {
      const tenantName = pay.tenant?.name || 'Unknown';
      notifications.push({
        id: `pay_${pay.id}`,
        type: 'payment',
        data: { tenantName, amount: pay.amount },
        title: 'Late payment',
        description: `$${pay.amount.toLocaleString()} from ${tenantName}`,
        createdAt: pay.dueDate.toISOString(),
        section: 'payments',
      });
    }

    for (const req of openMaintenance) {
      const unitInfo = req.unit ? `Unit ${req.unit.unitNumber}` : 'No unit';
      notifications.push({
        id: `maint_${req.id}`,
        type: 'maintenance',
        data: { title: req.title, unitInfo },
        title: 'Open maintenance request',
        description: `${req.title} - ${unitInfo}`,
        createdAt: req.createdAt.toISOString(),
        section: 'maintenance',
      });
    }

    // Sort by createdAt descending and limit to 5
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const limitedNotifications = notifications.slice(0, 5);

    const unreadCount = unreadMessageCount + latePaymentCount + openMaintenanceCount;

    const response = NextResponse.json({
      notifications: limitedNotifications,
      unreadCount,
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return response;
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
