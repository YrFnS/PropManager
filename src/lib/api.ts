import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );
}

export function getPagination(searchParams: URLSearchParams, defaultLimit = 100, maxLimit = 200) {
  const pageValue = Number.parseInt(searchParams.get('page') || '1', 10);
  const limitValue = Number.parseInt(searchParams.get('limit') || String(defaultLimit), 10);
  const page = Number.isFinite(pageValue) ? Math.max(1, pageValue) : 1;
  const limit = Number.isFinite(limitValue) ? Math.min(maxLimit, Math.max(1, limitValue)) : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

export function isPrismaError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);
}

export function getClientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    forwarded ||
    'unknown'
  );
}

export function requestRateLimit(
  request: Request,
  bucket: string,
  options: { windowMs?: number; maxRequests?: number } = {},
) {
  return rateLimit({
    key: `${bucket}:${getClientAddress(request)}`,
    windowMs: options.windowMs,
    maxRequests: options.maxRequests,
  });
}
