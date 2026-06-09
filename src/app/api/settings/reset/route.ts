import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { strictRateLimit } from '@/lib/validation';

export async function POST() {
  try {
    const rateLimitResult = strictRateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Delete in correct order to respect foreign key constraints
    await db.message.deleteMany();
    await db.payment.deleteMany();
    await db.lease.deleteMany();
    await db.maintenanceRequest.deleteMany();
    await db.propertyManager.deleteMany();
    await db.unit.deleteMany();
    await db.tenant.deleteMany();
    await db.activityLog.deleteMany();
    await db.property.deleteMany();

    return NextResponse.json({ success: true, message: 'Database reset successfully' });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ success: false, error: 'Failed to reset database' }, { status: 500 });
  }
}
