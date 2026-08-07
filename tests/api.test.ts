import { describe, expect, test } from 'bun:test';
import { parseJsonRequest } from '../src/lib/api';

describe('API request parsing', () => {
  test('accepts JSON and rejects malformed bodies', async () => {
    const valid = new Request('http://localhost', { method: 'POST', body: '{"ok":true}' });
    const malformed = new Request('http://localhost', { method: 'POST', body: '{' });

    expect(await parseJsonRequest(valid)).toEqual({ ok: true });
    expect(await parseJsonRequest(malformed)).toBeUndefined();
  }, 10_000);
});
