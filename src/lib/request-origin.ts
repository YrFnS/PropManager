const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface RequestOriginInput {
  method: string;
  originHeader: string | null;
  hostHeader: string | null;
  forwardedHostHeader: string | null;
  forwardedProtoHeader: string | null;
  requestOrigin: string;
}

function firstHeaderValue(value: string | null) {
  const first = value?.split(',')[0]?.trim();
  return first || null;
}

function normalizeProtocol(value: string | null) {
  const protocol = firstHeaderValue(value)?.replace(/:$/, '').toLowerCase();
  return protocol === 'http' || protocol === 'https' ? protocol : null;
}

function normalizeOrigin(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function addHostOrigin(origins: Set<string>, protocol: string | null, host: string | null) {
  if (!protocol || !host) return;
  const origin = normalizeOrigin(`${protocol}://${host}`);
  if (origin) origins.add(origin);
}

export function hasValidRequestOrigin(input: RequestOriginInput) {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;
  if (!input.originHeader) return true;

  const submittedOrigin = normalizeOrigin(input.originHeader);
  if (!submittedOrigin) return false;

  const acceptedOrigins = new Set<string>();
  const requestOrigin = normalizeOrigin(input.requestOrigin);
  if (requestOrigin) acceptedOrigins.add(requestOrigin);

  let requestProtocol: string | null = null;
  try {
    requestProtocol = normalizeProtocol(new URL(input.requestOrigin).protocol);
  } catch {
    // The host-derived origins below can still provide a safe comparison.
  }

  addHostOrigin(
    acceptedOrigins,
    requestProtocol,
    firstHeaderValue(input.hostHeader),
  );
  addHostOrigin(
    acceptedOrigins,
    normalizeProtocol(input.forwardedProtoHeader) || requestProtocol,
    firstHeaderValue(input.forwardedHostHeader),
  );

  return acceptedOrigins.has(submittedOrigin);
}
