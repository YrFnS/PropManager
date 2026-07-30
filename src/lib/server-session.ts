import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createSessionToken,
  normalizeRole,
  type SessionInput,
  type SessionPayload,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from '@/lib/auth';

export async function getRequestSession(request: NextRequest): Promise<SessionPayload | null> {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function getFreshSession(session: SessionPayload): Promise<SessionInput | null> {
  const membership = await db.membership.findFirst({
    where: {
      id: session.membershipId,
      userId: session.userId,
      organizationId: session.organizationId,
      isActive: true,
      user: { isActive: true },
    },
    include: { user: true, organization: true },
  });
  if (!membership) return null;
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

export async function setSessionCookie(response: NextResponse, session: SessionInput) {
  const token = await createSessionToken(session);
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
