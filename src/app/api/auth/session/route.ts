import { NextRequest, NextResponse } from 'next/server';
import { getFreshSession, getRequestSession, setSessionCookie } from '@/lib/server-session';

export async function GET(request: NextRequest) {
  const current = await getRequestSession(request);
  if (!current) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const fresh = await getFreshSession(current);
  if (!fresh) return NextResponse.json({ error: 'This session is no longer active.' }, { status: 401 });

  const response = NextResponse.json({ session: fresh });
  return setSessionCookie(response, fresh);
}
