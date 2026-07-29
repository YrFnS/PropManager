const encoder = new TextEncoder();

export const SESSION_COOKIE_NAME = 'pm_session';
export const SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;
export const APP_ROLES = ['owner', 'manager', 'accountant', 'maintenance', 'viewer'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface SessionPayload {
  userId: string;
  membershipId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: AppRole;
  currency: string;
  locale: string;
  exp: number;
}

export type SessionInput = Omit<SessionPayload, 'exp'>;

function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodePayload(payload: SessionPayload): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
}

function isRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(value));
    const payload = JSON.parse(decoded) as Partial<SessionPayload>;
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.membershipId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.organizationId !== 'string' ||
      typeof payload.organizationName !== 'string' ||
      !isRole(payload.role) ||
      typeof payload.currency !== 'string' ||
      typeof payload.locale !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

export function getAuthConfigurationError(): string | null {
  if (!getSecret()) return 'AUTH_SECRET must contain at least 32 characters.';
  return null;
}

export function validateBootstrapAdminCredentials(email: string, password: string): boolean {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredEmail || !configuredPassword) return false;
  return constantTimeEqual(email.trim().toLowerCase(), configuredEmail) && constantTimeEqual(password, configuredPassword);
}

export function normalizeRole(value: string): AppRole | null {
  return isRole(value) ? value : null;
}

export function hasRole(session: SessionPayload, allowedRoles: readonly AppRole[]): boolean {
  return allowedRoles.includes(session.role);
}

export async function createSessionToken(input: SessionInput): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error('Authentication is not configured.');

  const payload = encodePayload({
    ...input,
    email: input.email.trim().toLowerCase(),
    currency: input.currency.trim().toUpperCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
  const signature = await sign(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  const secret = getSecret();
  if (!secret || !token) return null;

  const [payloadPart, signaturePart, extra] = token.split('.');
  if (!payloadPart || !signaturePart || extra) return null;

  const expectedSignature = await sign(payloadPart, secret);
  if (!constantTimeEqual(signaturePart, expectedSignature)) return null;

  const payload = decodePayload(payloadPart);
  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}
