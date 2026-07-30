import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeRole, type SessionInput } from '@/lib/auth';
import { getRequestSession, setSessionCookie } from '@/lib/server-session';
import { sanitizeString } from '@/lib/validation';

function sessionFromMembership(membership: {
  id: string;
  role: string;
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; currency: string; locale: string; timezone: string };
}): SessionInput | null {
  const role = normalizeRole(membership.role);
  if (!role) return null;
  return {
    userId: membership.user.id,
    membershipId: membership.id,
    email: membership.user.email,
    name: membership.user.name,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    role,
    currency: membership.organization.currency,
    locale: membership.organization.locale,
    timezone: membership.organization.timezone,
  };
}

async function uniqueSlug(name: string) {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'organization';

  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const exists = await db.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function GET(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const memberships = await db.membership.findMany({
    where: { userId: session.userId, isActive: true, user: { isActive: true } },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    currentOrganizationId: session.organizationId,
    memberships: memberships.map((membership) => ({
      membershipId: membership.id,
      role: membership.role,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        nameAr: membership.organization.nameAr,
        slug: membership.organization.slug,
        currency: membership.organization.currency,
        locale: membership.organization.locale,
        timezone: membership.organization.timezone,
      },
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = String(body.action || 'switch');

  if (action === 'switch') {
    const organizationId = String(body.organizationId || '');
    const membership = await db.membership.findFirst({
      where: {
        userId: session.userId,
        organizationId,
        isActive: true,
        user: { isActive: true },
      },
      include: { user: true, organization: true },
    });
    if (!membership) return NextResponse.json({ error: 'Organization membership not found.' }, { status: 404 });

    const nextSession = sessionFromMembership(membership);
    if (!nextSession) return NextResponse.json({ error: 'Invalid membership role.' }, { status: 500 });
    const response = NextResponse.json({ success: true, session: nextSession });
    return setSessionCookie(response, nextSession);
  }

  if (action === 'create') {
    const name = sanitizeString(String(body.name || ''), 120);
    const nameAr = body.nameAr ? sanitizeString(String(body.nameAr), 120) : null;
    const currency = String(body.currency || 'USD').trim().toUpperCase();
    const locale = body.locale === 'ar' ? 'ar' : 'en';
    const timezone = sanitizeString(String(body.timezone || 'UTC'), 100) || 'UTC';

    if (name.length < 2) return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: 'Currency must be a three-letter ISO code.' }, { status: 400 });
    }

    const slug = await uniqueSlug(name);
    const membership = await db.$transaction(async (transaction) => {
      const organization = await transaction.organization.create({
        data: { name, nameAr, slug, currency, locale, timezone },
      });
      return transaction.membership.create({
        data: {
          userId: session.userId,
          organizationId: organization.id,
          role: 'owner',
        },
        include: { user: true, organization: true },
      });
    });

    const nextSession = sessionFromMembership(membership);
    if (!nextSession) return NextResponse.json({ error: 'Failed to create organization session.' }, { status: 500 });
    const response = NextResponse.json({ success: true, session: nextSession }, { status: 201 });
    return setSessionCookie(response, nextSession);
  }

  return NextResponse.json({ error: 'Unsupported organization action.' }, { status: 400 });
}
