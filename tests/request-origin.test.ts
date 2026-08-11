import { describe, expect, test } from 'bun:test';
import { hasValidRequestOrigin, type RequestOriginInput } from '../src/lib/request-origin';

const standaloneRequest: RequestOriginInput = {
  method: 'POST',
  originHeader: 'http://localhost:3000',
  hostHeader: 'localhost:3000',
  forwardedHostHeader: null,
  forwardedProtoHeader: null,
  requestOrigin: 'http://0.0.0.0:3000',
};

describe('same-origin request validation', () => {
  test('accepts the public Host origin when a standalone server binds internally', () => {
    expect(hasValidRequestOrigin(standaloneRequest)).toBe(true);
  });

  test('accepts a trusted reverse-proxy host and protocol', () => {
    expect(hasValidRequestOrigin({
      ...standaloneRequest,
      originHeader: 'https://properties.example.com',
      hostHeader: '127.0.0.1:3000',
      forwardedHostHeader: 'properties.example.com',
      forwardedProtoHeader: 'https',
      requestOrigin: 'http://127.0.0.1:3000',
    })).toBe(true);
  });

  test('rejects cross-site and malformed origins', () => {
    expect(hasValidRequestOrigin({
      ...standaloneRequest,
      originHeader: 'https://evil.example.com',
    })).toBe(false);
    expect(hasValidRequestOrigin({
      ...standaloneRequest,
      originHeader: 'null',
    })).toBe(false);
  });

  test('keeps safe methods and non-browser requests compatible', () => {
    expect(hasValidRequestOrigin({
      ...standaloneRequest,
      method: 'GET',
      originHeader: 'https://evil.example.com',
    })).toBe(true);
    expect(hasValidRequestOrigin({
      ...standaloneRequest,
      originHeader: null,
    })).toBe(true);
  });
});
