import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { strictRateLimit } from '@/lib/validation';

export async function GET() {
  try {
    const rateLimitResult = strictRateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const [
      properties,
      units,
      tenants,
      leases,
      payments,
      maintenanceRequests,
      messages,
      activityLogs,
      propertyManagers,
    ] = await Promise.all([
      db.property.findMany(),
      db.unit.findMany(),
      db.tenant.findMany(),
      db.lease.findMany(),
      db.payment.findMany(),
      db.maintenanceRequest.findMany(),
      db.message.findMany(),
      db.activityLog.findMany(),
      db.propertyManager.findMany(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      properties,
      propertyManagers,
      units,
      tenants,
      leases,
      payments,
      maintenanceRequests,
      messages,
      activityLogs,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
