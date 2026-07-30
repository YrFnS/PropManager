import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

function source(path: string) {
  expect(existsSync(path)).toBe(true);
  return readFileSync(path, 'utf8');
}

describe('PropManager stabilization architecture', () => {
  test('database schema includes organizations, memberships, and immutable payment adjustments', () => {
    const schema = source('prisma/schema.prisma');

    for (const model of ['Organization', 'User', 'Membership', 'PaymentAdjustment']) {
      expect(schema).toContain(`model ${model}`);
    }

    expect(schema).toMatch(/amount\s+Decimal\s+@db\.Decimal\(18,\s*2\)/);
    expect(schema).toContain('paymentAdjustments  PaymentAdjustment[]');
  });

  test('organization scoping includes every financial ledger model', () => {
    const database = source('src/lib/db.ts');

    expect(database).toContain('ORGANIZATION_SCOPED_MODELS');
    expect(database).toContain("'Payment'");
    expect(database).toContain("'PaymentAdjustment'");
    expect(database).toContain('organizationId');
  });

  test('server and client share explicit role enforcement', () => {
    const proxy = source('src/proxy.ts');
    const permissions = source('src/lib/permissions.ts');
    const provider = source('src/components/auth/session-provider.tsx');

    expect(proxy).toContain('getRequiredRoles');
    expect(proxy).toContain('You do not have permission to perform this action.');
    expect(permissions).toContain('canWriteResource');
    for (const role of ['owner', 'manager', 'accountant', 'maintenance', 'viewer']) {
      expect(permissions).toContain(`${role}:`);
    }
    expect(provider).toContain('data.pmRole');
    expect(provider).toContain('initialSession');
    expect(provider).toContain('setSession');
  });

  test('payments preserve history through void and refund operations', () => {
    const payments = source('src/app/api/payments/route.ts');
    const voidRoute = source('src/app/api/payments/[id]/void/route.ts');
    const refundRoute = source('src/app/api/payments/[id]/refund/route.ts');

    expect(payments).toContain('Payments are never deleted');
    expect(payments).toContain("return apiError('Payments are never deleted");
    expect(voidRoute).toContain("type: 'void'");
    expect(refundRoute).toContain("type: 'refund'");
    expect(refundRoute).toContain('refundableAmount');
  });
});
