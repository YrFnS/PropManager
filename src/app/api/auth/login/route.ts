import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  getAuthConfigurationError,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  validateAdminCredentials,
} from '@/lib/auth';
import { getClientAddress } from '@/lib/api';
import { rateLimit } from '@/lib/validation';

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

  const email = typeof body === 'object' && body !== null && 'email' in body ? String(body.email) : '';
  const password = typeof body === 'object' && body !== null && 'password' in body ? String(body.password) : '';

  if (!validateAdminCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const token = await createSessionToken(email);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
