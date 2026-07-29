import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, getPagination, requestRateLimit } from '@/lib/api';
import { auditEntry } from '@/lib/audit';
import { moneyEquals, moneyToNumber } from '@/lib/money';
import { paymentSchema, paymentUpdateSchema, sanitizeString } from '@/lib/validation';

const paymentInclude = {
  tenant: { select: { id: true, name: true, nameAr: true } },
  lease: {
    include: {
      unit: { include: { property: { select: { name: true, nameAr: true } } } },
    },
  },
} satisfies Prisma.PaymentInclude;

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
    const id = searchParams.get('id') || '';
    const status = searchParams.get('status') || '';
    const method = searchParams.get('method') || '';
    const { page, limit, skip } = getPagination(searchParams);
    const where: Prisma.PaymentWhereInput = {};
    if (id) where.id = id;
    if (status && status !== 'all') where.status = status;
    if (method && method !== 'all') where.method = method;

    const statsWhere: Prisma.PaymentWhereInput = {};
    if (method && method !== 'all') statsWhere.method = method;

    const [payments, total, totalCollected, totalPending, totalLate] = await Promise.all([
      db.payment.findMany({ where, skip, take: limit, include: paymentInclude, orderBy: { dueDate: 'desc' } }),
      db.payment.count({ where }),
      db.payment.aggregate({ where: { ...statsWhere, status: { in: ['paid', 'partial'] } }, _sum: { amount: true } }),
      db.payment.aggregate({ where: { ...statsWhere, status: 'pending' }, _sum: { amount: true } }),
      db.payment.aggregate({ where: { ...statsWhere, status: 'late' }, _sum: { amount: true } }),
    ]);

    const response = NextResponse.json({
      data: payments,
      stats: {
        totalCollected: moneyToNumber(totalCollected._sum.amount),
        totalPending: moneyToNumber(totalPending._sum.amount),
        totalLate: moneyToNumber(totalLate._sum.amount),
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
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

    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const lease = await db.lease.findUnique({ where: { id: data.leaseId }, select: { tenantId: true } });
    if (!lease) return apiError('Lease not found', 404);
    if (data.tenantId && data.tenantId !== lease.tenantId) {
      return apiError('The selected tenant does not belong to this lease.', 400);
    }

    const dueDate = new Date(data.dueDate);
    if (!Number.isFinite(dueDate.getTime())) return apiError('Invalid due date.', 400);
    const status = data.status || 'pending';
    const paidDate = resolvePaidDate(status, data.paidDate);

    const payment = await db.$transaction(async (transaction) => {
      const created = await transaction.payment.create({
        data: {
          leaseId: data.leaseId,
          tenantId: lease.tenantId,
          amount: data.amount,
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
          amount: created.amount,
          status: created.status,
        }),
      });
      return created;
    });

    return NextResponse.json(payment, { status: 201 });
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

    const body = await request.json();
    const parsed = paymentUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400, parsed.error.issues);
    const data = parsed.data;

    const existing = await db.payment.findUnique({ where: { id: data.id } });
    if (!existing) return apiError('Payment not found', 404);

    if (data.leaseId !== undefined && data.leaseId !== existing.leaseId) {
      return apiError('A recorded payment cannot be reassigned to another lease.', 409);
    }

    const leaseId = existing.leaseId;
    const lease = await db.lease.findUnique({ where: { id: leaseId }, select: { tenantId: true } });
    if (!lease) return apiError('Lease not found', 404);
    if (data.tenantId && data.tenantId !== lease.tenantId) {
      return apiError('The selected tenant does not belong to this lease.', 400);
    }

    const status = data.status ?? existing.status;
    const remainsSettled = status === 'paid' || status === 'partial';
    const wasSettled = existing.status === 'paid' || existing.status === 'partial';
    const changesSettledAmount = data.amount !== undefined && !moneyEquals(data.amount, existing.amount);
    const changesSettledDueDate = data.dueDate !== undefined && new Date(data.dueDate).getTime() !== existing.dueDate.getTime();
    if (wasSettled && remainsSettled && (changesSettledAmount || changesSettledDueDate)) {
      return apiError('Move the payment back to a pending status before correcting its amount or due date.', 409);
    }

    const updateData: Prisma.PaymentUncheckedUpdateInput = {
      leaseId,
      tenantId: lease.tenantId,
      status,
      paidDate: resolvePaidDate(status, data.paidDate, existing.paidDate),
    };

    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.dueDate !== undefined) {
      const dueDate = new Date(data.dueDate);
      if (!Number.isFinite(dueDate.getTime())) return apiError('Invalid due date.', 400);
      updateData.dueDate = dueDate;
    }
    if (data.method !== undefined) updateData.method = data.method;
    if (data.reference !== undefined) updateData.reference = data.reference ? sanitizeString(data.reference, 100) : null;
    if (data.notes !== undefined) updateData.notes = data.notes ? sanitizeString(data.notes, 1000) : null;

    const payment = await db.$transaction(async (transaction) => {
      const updated = await transaction.payment.update({
        where: { id: data.id },
        data: updateData,
        include: paymentInclude,
      });
      await transaction.activityLog.create({
        data: auditEntry('update', 'payment', data.id, {
          fields: Object.keys(data).filter((key) => key !== 'id'),
          leaseId: updated.leaseId,
          amount: updated.amount,
          status: updated.status,
        }),
      });
      return updated;
    });
    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PAID_DATE') return apiError('Invalid paid date.', 400);
    console.error('Payments PUT error:', error);
    return apiError('Failed to update payment', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limitResult = requestRateLimit(request, 'payments:write', { maxRequests: 90 });
    if (!limitResult.success) return apiError('Too many requests', 429);

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiError('Payment ID is required', 400);

    const existing = await db.payment.findUnique({
      where: { id },
      select: { id: true, leaseId: true, tenantId: true, amount: true, status: true },
    });
    if (!existing) return apiError('Payment not found', 404);
    if (existing.status === 'paid' || existing.status === 'partial') {
      return apiError('Settled payments cannot be deleted. Correct the status first so the audit trail is preserved.', 409);
    }

    await db.$transaction(async (transaction) => {
      await transaction.payment.delete({ where: { id } });
      await transaction.activityLog.create({
        data: auditEntry('delete', 'payment', id, {
          leaseId: existing.leaseId,
          tenantId: existing.tenantId,
          amount: existing.amount,
          status: existing.status,
        }),
      });
    });
    return NextResponse.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Payments DELETE error:', error);
    return apiError('Failed to delete payment', 500);
  }
}
