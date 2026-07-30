import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const targets = {
  properties: 'src/components/properties/properties-section.tsx',
  units: 'src/components/units/units-section.tsx',
  tenants: 'src/components/tenants/tenants-section.tsx',
  maintenance: 'src/components/maintenance/maintenance-section.tsx',
  messages: 'src/components/messages/messages-section.tsx',
} as const;

describe('role-aware legacy controls', () => {
  for (const [resource, file] of Object.entries(targets)) {
    test(`${resource} mutation controls are permission tagged`, () => {
      expect(readFileSync(file, 'utf8')).toContain(`data-pm-write-resource="${resource}"`);
    });
  }

  test('visibility rules preserve accountant and maintenance responsibilities', () => {
    const css = readFileSync('src/app/stabilization.css', 'utf8');
    expect(css).toContain("data-pm-role='viewer'");
    expect(css).toContain("data-pm-role='maintenance'");
    expect(css).toContain("data-pm-write-resource='maintenance'");
    expect(css).toContain("data-pm-role='accountant'");
    expect(css).toContain("data-pm-write-resource='payments'");
  });
});
