import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { APP_ROLES, normalizeRole } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { getRequestSession } from '@/lib/server-session';
import { sanitizeString } from '@/lib/validation';

async function requireOwner(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session) return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  if (session.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Owner permission is required.' }, { status: 403 }) };
  }
  return { session };
}

function serializeMembership(membership: {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  user: { id: string; name: string; email: string; isActive: boolean };
}) {
  return {
    id: membership.id,
    role: membership.role,
    isActive: membership.isActive,
    createdAt: membership.createdAt,
    user: membership.user,
  };
}

async function activeOwnerCount(organizationId: string) {
  return db.membership.count({
    where: {
      organizationId,
      role: 'owner',
      isActive: true,
      user: { isActive: true },
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('error' in auth) return auth.error;

  const memberships = await db.membership.findMany({
    where: { organizationId: auth.session.organizationId },
    include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ members: memberships.map(serializeMembership) });
}

export async function POST(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const email = String(body.email || '').trim().toLowerCase();
  const name = sanitizeString(String(body.name || ''), 120);
  const password = String(body.password || '');
  const role = normalizeRole(String(body.role || 'viewer'));

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (name.length < 2) return NextResponse.json({ error: 'User name is required.' }, { status: 400 });
  if (!role) return NextResponse.json({ error: `Role must be one of: ${APP_ROLES.join(', ')}` }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    const existingMembership = await db.membership.findUnique({
      where: { userId_organizationId: { userId: existing.id, organizationId: auth.session.organizationId } },
    });
    if (existingMembership) {
      return NextResponse.json({ error: 'This user already belongs to the organization.' }, { status: 409 });
    }
  } else if (password.length < 8) {
    return NextResponse.json({ error: 'A password with at least 8 characters is required for a new user.' }, { status: 400 });
  }

  const membership = await db.$transaction(async (transaction) => {
    const user = existing
      ? await transaction.user.update({
          where: { id: existing.id },
          data: { name, isActive: true },
        })
      : await transaction.user.create({
          data: { email, name, passwordHash: await hashPassword(password) },
        });

    return transaction.membership.create({
      data: {
        userId: user.id,
        organizationId: auth.session.organizationId,
        role,
      },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    });
  });

  return NextResponse.json({ member: serializeMembership(membership) }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  const membershipId = String(body.membershipId || '');
  if (!membershipId) return NextResponse.json({ error: 'Membership ID is required.' }, { status: 400 });

  const membership = await db.membership.findFirst({
    where: { id: membershipId, organizationId: auth.session.organizationId },
    include: { user: true },
  });
  if (!membership) return NextResponse.json({ error: 'Organization member not found.' }, { status: 404 });

  const nextRole = body.role === undefined ? normalizeRole(membership.role) : normalizeRole(String(body.role));
  if (!nextRole) return NextResponse.json({ error: `Role must be one of: ${APP_ROLES.join(', ')}` }, { status: 400 });
  const nextActive = body.isActive === undefined ? membership.isActive : Boolean(body.isActive);
  const changingOwnAccess = membership.id === auth.session.membershipId &&
    (nextRole !== membership.role || nextActive !== membership.isActive);
  if (changingOwnAccess) {
    return NextResponse.json({ error: 'You cannot change your own role or organization access.' }, { status: 409 });
  }

  if (membership.role === 'owner' && (nextRole !== 'owner' || !nextActive)) {
    if ((await activeOwnerCount(auth.session.organizationId)) <= 1) {
      return NextResponse.json({ error: 'The organization must keep at least one active owner.' }, { status: 409 });
    }
  }

  const password = body.password === undefined ? null : String(body.password);
  if (password !== null && password.length < 8) {
    return NextResponse.json({ error: 'New passwords must contain at least 8 characters.' }, { status: 400 });
  }
  const name = body.name === undefined ? null : sanitizeString(String(body.name), 120);
  if (name !== null && name.length < 2) return NextResponse.json({ error: 'User name is required.' }, { status: 400 });

  const updated = await db.$transaction(async (transaction) => {
    if (password !== null || name !== null) {
      await transaction.user.update({
        where: { id: membership.userId },
        data: {
          ...(name !== null ? { name } : {}),
          ...(password !== null ? { passwordHash: await hashPassword(password) } : {}),
        },
      });
    }
    return transaction.membership.update({
      where: { id: membership.id },
      data: { role: nextRole, isActive: nextActive },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    });
  });

  return NextResponse.json({ member: serializeMembership(updated) });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('error' in auth) return auth.error;

  const membershipId = new URL(request.url).searchParams.get('id');
  if (!membershipId) return NextResponse.json({ error: 'Membership ID is required.' }, { status: 400 });
  if (membershipId === auth.session.membershipId) {
    return NextResponse.json({ error: 'You cannot remove your own organization membership.' }, { status: 409 });
  }

  const membership = await db.membership.findFirst({
    where: { id: membershipId, organizationId: auth.session.organizationId },
  });
  if (!membership) return NextResponse.json({ error: 'Organization member not found.' }, { status: 404 });

  if (membership.role === 'owner' && membership.isActive && (await activeOwnerCount(auth.session.organizationId)) <= 1) {
    return NextResponse.json({ error: 'The organization must keep at least one active owner.' }, { status: 409 });
  }

  await db.membership.delete({ where: { id: membership.id } });
  return NextResponse.json({ success: true });
}
