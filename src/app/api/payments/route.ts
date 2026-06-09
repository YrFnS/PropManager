import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, paymentSchema, sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const method = searchParams.get('method') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (method) where.method = method;

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          tenant: { select: { id: true, name: true, nameAr: true } },
          lease: {
            include: {
              unit: {
                include: { property: { select: { name: true, nameAr: true } } },
              },
            },
          },
        },
        orderBy: { dueDate: 'desc' },
      }),
      db.payment.count({ where }),
    ]);

    // Stats
    const totalCollected = await db.payment.aggregate({
      where: { status: 'paid' },
      _sum: { amount: true },
    });
    const totalPending = await db.payment.aggregate({
      where: { status: 'pending' },
      _sum: { amount: true },
    });
    const totalLate = await db.payment.aggregate({
      where: { status: 'late' },
      _sum: { amount: true },
    });

    const response = NextResponse.json({
      data: payments,
      stats: {
        totalCollected: totalCollected._sum.amount || 0,
        totalPending: totalPending._sum.amount || 0,
        totalLate: totalLate._sum.amount || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return response;
  } catch (error) {
    console.error('Payments API error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const payment = await db.payment.create({
      data: {
        leaseId: data.leaseId,
        tenantId: data.tenantId,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        paidDate: data.paidDate ? new Date(data.paidDate) : null,
        status: data.status || 'pending',
        method: data.method || null,
        reference: data.reference ? sanitizeString(data.reference, 100) : null,
        notes: data.notes ? sanitizeString(data.notes, 1000) : null,
      },
      include: { tenant: true },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Payments POST error:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    // Check if payment exists
    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const payment = await db.payment.update({
      where: { id },
      data: {
        leaseId: data.leaseId,
        tenantId: data.tenantId,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        paidDate: data.paidDate ? new Date(data.paidDate) : data.paidDate === null ? null : undefined,
        status: data.status,
        method: data.method !== undefined ? data.method || null : undefined,
        reference: data.reference !== undefined ? data.reference ? sanitizeString(data.reference, 100) : null : undefined,
        notes: data.notes !== undefined ? data.notes ? sanitizeString(data.notes, 1000) : null : undefined,
      },
      include: { tenant: true },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Payments PUT error:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    // Check if payment exists
    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    await db.payment.delete({ where: { id } });

    return NextResponse.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Payments DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
