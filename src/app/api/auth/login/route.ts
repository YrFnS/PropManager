import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createSessionToken,
  getAuthConfigurationError,
  normalizeRole,
  type SessionInput,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  validateBootstrapAdminCredentials,
} from '@/lib/auth';
import { getClientAddress } from '@/lib/api';
import { hashPassword, verifyPassword } from '@/lib/password';
import { rateLimit } from '@/lib/validation';

const rolePriority: Record<string, number> = {
  owner: 0,
  manager: 1,
  accountant: 2,
  maintenance: 3,
  viewer: 4,
};

type LoginMembership = {
  id: string;
  role: string;
  organization: {
    id: string;
    name: string;
    currency: string;
    locale: string;
    timezone: string;
  };
};

function buildSession(
  user: { id: string; email: string; name: string },
  membership: LoginMembership,
): SessionInput | null {
  const role = normalizeRole(membership.role);
  if (!role) return null;
  return {
    userId: user.id,
    membershipId: membership.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    role,
    currency: membership.organization.currency,
    locale: membership.organization.locale,
    timezone: membership.organization.timezone,
  };
}

function chooseMembership(memberships: LoginMembership[], preferredOrganizationId?: string) {
  if (preferredOrganizationId) {
    const preferred = memberships.find((membership) => membership.organization.id === preferredOrganizationId);
    if (preferred) return preferred;
  }
  return [...memberships].sort(
    (left, right) => (rolePriority[left.role] ?? 99) - (rolePriority[right.role] ?? 99),
  )[0];
}

export async function POST(request: NextRequest) {
  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return NextResponse.json(
      { error: 'Authentication is not configured on the server.', details: configurationError },
      { status: 503 },
    );
  }

  const address = getClientAddress(request);
  const limit = rateLimit({
    key: `login:${address}`,
    windowMs: 10 * 60_000,
    maxRequests: 10,
  });

  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil(limit.resetMs / 1000))) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const preferredOrganizationId = input.organizationId ? String(input.organizationId) : undefined;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  let user = await db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { isActive: true },
        include: { organization: true },
      },
    },
  });

  if (user) {
    if (!user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
  } else {
    if (!validateBootstrapAdminCredentials(email, password)) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const passwordHash = await hashPassword(password);
    const bootstrapName = process.env.ADMIN_NAME?.trim() || email.split('@')[0] || 'Administrator';

    user = await db.$transaction(async (transaction) => {
      const organization = await transaction.organization.upsert({
        where: { id: 'org_default' },
        update: {},
        create: {
          id: 'org_default',
          name: process.env.DEFAULT_ORGANIZATION_NAME?.trim() || 'Default Organization',
          slug: 'default',
          currency: process.env.DEFAULT_CURRENCY?.trim().toUpperCase() || 'USD',
          locale: 'en',
          timezone: process.env.DEFAULT_TIMEZONE?.trim() || 'UTC',
        },
      });
      const createdUser = await transaction.user.create({
        data: { email, name: bootstrapName, passwordHash },
      });
      await transaction.membership.create({
        data: {
          userId: createdUser.id,
          organizationId: organization.id,
          role: 'owner',
        },
      });
      return transaction.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: {
          memberships: {
            where: { isActive: true },
            include: { organization: true },
          },
        },
      });
    });
  }

  const membership = chooseMembership(user.memberships, preferredOrganizationId);
  if (!membership) {
    return NextResponse.json({ error: 'This account has no active organization membership.' }, { status: 403 });
  }

  const session = buildSession(user, membership);
  if (!session) {
    return NextResponse.json({ error: 'This account has an invalid role assignment.' }, { status: 500 });
  }

  const token = await createSessionToken(session);
  const response = NextResponse.json({ success: true, session });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
