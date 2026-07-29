import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { type SessionInput } from '@/lib/auth';
import { getRequestSession, setSessionCookie } from '@/lib/server-session';
import { sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const organization = await db.organization.findUnique({ where: { id: session.organizationId } });
  if (!organization) return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
  return NextResponse.json({ organization });
}

export async function PATCH(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'Owner permission is required.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const name = sanitizeString(String(body.name || ''), 120);
  const nameAr = body.nameAr ? sanitizeString(String(body.nameAr), 120) : null;
  const currency = String(body.currency || '').trim().toUpperCase();
  const locale = body.locale === 'ar' ? 'ar' : 'en';
  const timezone = sanitizeString(String(body.timezone || 'UTC'), 100) || 'UTC';

  if (name.length < 2) return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'Currency must be a three-letter ISO code.' }, { status: 400 });
  }

  const organization = await db.organization.update({
    where: { id: session.organizationId },
    data: { name, nameAr, currency, locale, timezone },
  });

  const nextSession: SessionInput = {
    userId: session.userId,
    membershipId: session.membershipId,
    email: session.email,
    name: session.name,
    organizationId: organization.id,
    organizationName: organization.name,
    role: session.role,
    currency: organization.currency,
    locale: organization.locale,
  };
  const response = NextResponse.json({ organization, session: nextSession });
  return setSessionCookie(response, nextSession);
}
