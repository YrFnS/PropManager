import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

const intlMiddleware = createMiddleware(routing);
const AUTH_API_PREFIX = '/api/auth/';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getRequestLocale(request: NextRequest): 'en' | 'ar' {
  const firstSegment = request.nextUrl.pathname.split('/').filter(Boolean)[0];
  if (firstSegment === 'ar' || firstSegment === 'en') return firstSegment;
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  return cookieLocale === 'ar' ? 'ar' : 'en';
}

function getLocaleStrippedPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'en' || segments[0] === 'ar') {
    return `/${segments.slice(1).join('/')}`.replace(/\/$/, '') || '/';
  }
  return pathname;
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

function hasValidOrigin(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith('/api/');
  const isAuthApi = pathname.startsWith(AUTH_API_PREFIX);
  const locale = getRequestLocale(request);
  const localeStrippedPath = getLocaleStrippedPath(pathname);
  const isLoginPage = localeStrippedPath === '/login';

  if (isAuthApi) {
    if (!hasValidOrigin(request)) {
      return withSecurityHeaders(NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403 }));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (isApi) {
    if (!session) {
      return withSecurityHeaders(NextResponse.json({ error: 'Authentication required.' }, { status: 401 }));
    }
    if (!hasValidOrigin(request)) {
      return withSecurityHeaders(NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403 }));
    }

    if (
      process.env.NODE_ENV === 'production' &&
      /^\/api\/settings\/(seed|reset)$/.test(pathname) &&
      process.env.ENABLE_DANGEROUS_ADMIN_ACTIONS !== 'true'
    ) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: 'This administrative action is disabled in production.' },
          { status: 403 },
        ),
      );
    }

    if (pathname.startsWith('/api/ai/') && process.env.ENABLE_AI_COPILOT !== 'true') {
      return withSecurityHeaders(
        NextResponse.json(
          { error: 'AI Copilot is disabled. Review the data-sharing policy before enabling it.' },
          { status: 403 },
        ),
      );
    }

    return withSecurityHeaders(NextResponse.next());
  }

  if (isLoginPage) {
    if (session) {
      return withSecurityHeaders(NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url)));
    }
    return withSecurityHeaders(intlMiddleware(request));
  }

  if (!session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    if (localeStrippedPath !== '/') loginUrl.searchParams.set('next', localeStrippedPath);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return withSecurityHeaders(intlMiddleware(request));
}

export const config = {
  matcher: ['/', '/(en|ar)/:path*', '/api/:path*'],
};
