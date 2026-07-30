import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import { getRequestSession } from '@/lib/server-session';
import { moneyDecimal } from '@/lib/money';
import { refundableAmount, refundTotal, statusAfterRefund } from '@/lib/payment-ledger';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limit = requestRateLimit(request, 'payments:refund', { maxRequests: 30 });
  if (!limit.success) return apiError('Too many requests', 429);
  const session = await getRequestSession(request);
  if (!session) return apiError('Authentication required.', 401);
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 3 || reason.length > 500) return apiError('A refund reason between 3 and 500 characters is required.', 400);
  let requested;
  try { requested = moneyDecimal(String(body.amount ?? '')); } catch { return apiError('A valid refund amount is required.', 400); }
  if (requested.lessThanOrEqualTo(0)) return apiError('Refund amount must be greater than zero.', 400);
  const { id } = await params;

  const payment = await db.payment.findUnique({ where: { id }, include: { adjustments: true } });
  if (!payment) return apiError('Payment not found.', 404);
  const available = refundableAmount(payment);
  if (available.lessThanOrEqualTo(0)) return apiError('This payment has no refundable balance.', 409);
  if (requested.greaterThan(available)) {
    return apiError(`Refund exceeds the available balance of ${available.toFixed(2)}.`, 409);
  }
  const nextStatus = statusAfterRefund(payment, requested);

  const result = await db.$transaction(async (transaction) => {
    const adjustment = await transaction.paymentAdjustment.create({
      data: { paymentId: id, type: 'refund', amount: requested, reason, createdByUserId: session.userId },
    });
    const updated = await transaction.payment.update({ where: { id }, data: { status: nextStatus } });
    await transaction.activityLog.create({
      data: auditEntry('refund', 'payment', id, {
        adjustmentId: adjustment.id,
        amount: requested.toNumber(),
        reason,
        status: nextStatus,
      }),
    });
    return { adjustment, updated };
  });

  const refunded = refundTotal([...payment.adjustments, result.adjustment]);
  return NextResponse.json({
    payment: {
      ...result.updated,
      amount: Number(result.updated.amount),
      refundedAmount: refunded.toNumber(),
      netAmount: moneyDecimal(result.updated.amount).minus(refunded).toNumber(),
    },
  });
}
