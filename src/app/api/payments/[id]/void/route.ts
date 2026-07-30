import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import { getRequestSession } from '@/lib/server-session';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limit = requestRateLimit(request, 'payments:void', { maxRequests: 30 });
  if (!limit.success) return apiError('Too many requests', 429);
  const session = await getRequestSession(request);
  if (!session) return apiError('Authentication required.', 401);
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 3 || reason.length > 500) return apiError('A void reason between 3 and 500 characters is required.', 400);
  const { id } = await params;

  const payment = await db.payment.findUnique({ where: { id }, include: { adjustments: true } });
  if (!payment) return apiError('Payment not found.', 404);
  if (!['pending', 'late'].includes(payment.status)) {
    return apiError('Only unsettled payments can be voided. Use a refund for collected money.', 409);
  }

  const updated = await db.$transaction(async (transaction) => {
    const result = await transaction.payment.update({ where: { id }, data: { status: 'voided', paidDate: null } });
    await transaction.paymentAdjustment.create({
      data: { paymentId: id, type: 'void', amount: 0, reason, createdByUserId: session.userId },
    });
    await transaction.activityLog.create({
      data: auditEntry('void', 'payment', id, { reason, previousStatus: payment.status, amount: Number(payment.amount) }),
    });
    return result;
  });
  return NextResponse.json({ payment: { ...updated, amount: Number(updated.amount), netAmount: 0 } });
}
