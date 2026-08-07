import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, getPagination, parseJsonRequest, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import { moneyDecimal, moneyNumber } from '@/lib/money';
import { LOCKED_PAYMENT_STATUSES, netCollectedAmount, refundTotal } from '@/lib/payment-ledger';
import { paymentSchema, paymentUpdateSchema, sanitizeString } from '@/lib/validation';

const paymentInclude = {
  tenant: { select: { id: true, name: true, nameAr: true } },
  lease: { include: { unit: { include: { property: { select: { name: true, nameAr: true } } } } } },
  adjustments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

function serializePayment(payment: PaymentRow) {
  const refunded = refundTotal(payment.adjustments);
  return {
    ...payment,
    amount: moneyNumber(payment.amount),
    refundedAmount: refunded.toNumber(),
    netAmount: netCollectedAmount(payment).toNumber(),
    adjustments: payment.adjustments.map((adjustment) => ({ ...adjustment, amount: moneyNumber(adjustment.amount) })),
  };
}

function resolvePaidDate(status: string, requested: string | null | undefined, current: Date | null = null) {
  if (status === 'paid' || status === 'partial') {
    if (requested) {
      const parsed = new Date(requested);
      if (!Number.isFinite(parsed.getTime())) throw new Error('INVALID_PAID_DATE');
      return parsed;
    }
    return current ?? new Date();
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'payments:read');
    if (!limitResult.success) return apiError('Too many requests', 429);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const method = searchParams.get('method') || '';
    const { page, limit, skip } = getPagination(searchParams);
    const where: Prisma.PaymentWhereInput = {};
    if (status && status !== 'all') where.status = status;
    if (method && method !== 'all') where.method = method;
    const statsWhere: Prisma.PaymentWhereInput = {};
    if (method && method !== 'all') statsWhere.method = method;

    const [payments, total, statsPayments] = await Promise.all([
      db.payment.findMany({ where, skip, take: limit, include: paymentInclude, orderBy: { dueDate: 'desc' } }),
      db.payment.count({ where }),
      db.payment.findMany({ where: statsWhere, include: { adjustments: true } }),
    ]);
    const stats = statsPayments.reduce((result, payment) => {
      if (['paid', 'partial', 'partially_refunded', 'refunded'].includes(payment.status)) {
        result.totalCollected += netCollectedAmount(payment).toNumber();
      } else if (payment.status === 'pending') {
        result.totalPending += moneyNumber(payment.amount);
      } else if (payment.status === 'late') {
        result.totalLate += moneyNumber(payment.amount);
      }
      return result;
    }, { totalCollected: 0, totalPending: 0, totalLate: 0 });

    const response = NextResponse.json({
      data: payments.map(serializePayment),
      stats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    console.error('Payments GET error:', error);
    return apiError('Failed to fetch payments', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'payments:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);
    const body = await parseJsonRequest(request);
    if (body === undefined) return apiError('Invalid request body', 400);
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;
    const lease = await db.lease.findUnique({ where: { id: data.leaseId }, select: { tenantId: true } });
    if (!lease) return apiError('Lease not found', 404);
    if (data.tenantId && data.tenantId !== lease.tenantId) return apiError('The selected tenant does not belong to this lease.', 400);
    const dueDate = new Date(data.dueDate);
    if (!Number.isFinite(dueDate.getTime())) return apiError('Invalid due date.', 400);
    const status = data.status || 'pending';
    const paidDate = resolvePaidDate(status, data.paidDate);

    const payment = await db.$transaction(async (transaction) => {
      const created = await transaction.payment.create({
        data: {
          leaseId: data.leaseId,
          tenantId: lease.tenantId,
          amount: moneyDecimal(data.amount),
          dueDate,
          paidDate,
          status,
          method: data.method ?? null,
          reference: data.reference ? sanitizeString(data.reference, 100) : null,
          notes: data.notes ? sanitizeString(data.notes, 1000) : null,
        },
        include: paymentInclude,
      });
      await transaction.activityLog.create({
        data: auditEntry('create', 'payment', created.id, {
          leaseId: created.leaseId,
          tenantId: created.tenantId,
          amount: moneyNumber(created.amount),
          status: created.status,
        }),
      });
      return created;
    });
    return NextResponse.json(serializePayment(payment), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PAID_DATE') return apiError('Invalid paid date.', 400);
    console.error('Payments POST error:', error);
    return apiError('Failed to create payment', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'payments:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);
    const body = await parseJsonRequest(request);
    if (body === undefined) return apiError('Invalid request body', 400);
    const parsed = paymentUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;
    const existing = await db.payment.findUnique({ where: { id: data.id }, include: { adjustments: true } });
    if (!existing) return apiError('Payment not found', 404);
    if (LOCKED_PAYMENT_STATUSES.includes(existing.status as (typeof LOCKED_PAYMENT_STATUSES)[number])) {
      return apiError('Lifecycle-adjusted payments are immutable. Add another refund adjustment instead.', 409);
    }
    if (data.leaseId !== undefined && data.leaseId !== existing.leaseId) {
      return apiError('A recorded payment cannot be reassigned to another lease.', 409);
    }
    const lease = await db.lease.findUnique({ where: { id: existing.leaseId }, select: { tenantId: true } });
    if (!lease) return apiError('Lease not found', 404);
    if (data.tenantId && data.tenantId !== lease.tenantId) return apiError('The selected tenant does not belong to this lease.', 400);

    const status = data.status ?? existing.status;
    const remainsSettled = status === 'paid' || status === 'partial';
    const wasSettled = existing.status === 'paid' || existing.status === 'partial';
    const changesAmount = data.amount !== undefined && !moneyDecimal(data.amount).equals(existing.amount);
    const changesDueDate = data.dueDate !== undefined && new Date(data.dueDate).getTime() !== existing.dueDate.getTime();
    if (wasSettled && remainsSettled && (changesAmount || changesDueDate)) {
      return apiError('Move the payment back to pending before correcting its amount or due date.', 409);
    }

    const updateData: Prisma.PaymentUncheckedUpdateInput = {
      leaseId: existing.leaseId,
      tenantId: lease.tenantId,
      status,
      paidDate: resolvePaidDate(status, data.paidDate, existing.paidDate),
    };
    if (data.amount !== undefined) updateData.amount = moneyDecimal(data.amount);
    if (data.dueDate !== undefined) {
      const dueDate = new Date(data.dueDate);
      if (!Number.isFinite(dueDate.getTime())) return apiError('Invalid due date.', 400);
      updateData.dueDate = dueDate;
    }
    if (data.method !== undefined) updateData.method = data.method;
    if (data.reference !== undefined) updateData.reference = data.reference ? sanitizeString(data.reference, 100) : null;
    if (data.notes !== undefined) updateData.notes = data.notes ? sanitizeString(data.notes, 1000) : null;

    const payment = await db.$transaction(async (transaction) => {
      const updated = await transaction.payment.update({ where: { id: data.id }, data: updateData, include: paymentInclude });
      await transaction.activityLog.create({
        data: auditEntry('update', 'payment', data.id, {
          fields: Object.keys(data).filter((key) => key !== 'id'),
          amount: moneyNumber(updated.amount),
          status: updated.status,
        }),
      });
      return updated;
    });
    return NextResponse.json(serializePayment(payment));
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PAID_DATE') return apiError('Invalid paid date.', 400);
    console.error('Payments PUT error:', error);
    return apiError('Failed to update payment', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const limitResult = requestRateLimit(request, 'payments:write', { maxRequests: 90 });
  if (!limitResult.success) return apiError('Too many requests', 429);
  return apiError('Payments are never deleted. Void an unsettled entry or refund collected money to preserve the audit trail.', 405);
}
