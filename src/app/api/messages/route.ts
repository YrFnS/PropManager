import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, messageSchema, sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    const category = searchParams.get('category') || '';
    const isRead = searchParams.get('isRead');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (id) where.id = id;
    if (category && category !== 'all') where.category = category;
    if (isRead !== null && isRead !== '') where.isRead = isRead === 'true';

    const [messages, total] = await Promise.all([
      db.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.message.count({ where }),
    ]);

    const unreadCount = await db.message.count({ where: { isRead: false } });

    const response = NextResponse.json({
      data: messages,
      unreadCount,
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
    console.error('Messages API error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const message = await db.message.create({
      data: {
        senderName: sanitizeString(data.senderName, 200),
        senderEmail: sanitizeString(data.senderEmail, 200),
        subject: sanitizeString(data.subject, 300),
        content: sanitizeString(data.content, 5000),
        isRead: false,
        category: data.category || 'general',
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Messages POST error:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();

    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { id, isRead } = body;
    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Check if message exists
    const existing = await db.message.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const message = await db.message.update({
      where: { id },
      data: {
        senderName: sanitizeString(data.senderName, 200),
        senderEmail: sanitizeString(data.senderEmail, 200),
        subject: sanitizeString(data.subject, 300),
        content: sanitizeString(data.content, 5000),
        isRead: isRead !== undefined ? isRead : undefined,
        category: data.category,
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error('Messages PUT error:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { id, isRead, markAllRead } = body;

    if (markAllRead) {
      await db.message.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const message = await db.message.update({
      where: { id },
      data: { isRead },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error('Messages PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
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
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Check if message exists
    const existing = await db.message.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    await db.message.delete({ where: { id } });

    return NextResponse.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Messages DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}
