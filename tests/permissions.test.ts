import { describe, expect, test } from 'bun:test';
import { canAdministerOrganization, canWriteResource } from '../src/lib/permissions';

describe('role permissions', () => {
  test('owner can administer users and operational records', () => {
    expect(canAdministerOrganization('owner')).toBe(true);
    expect(canWriteResource('owner', 'payments')).toBe(true);
    expect(canWriteResource('owner', 'users')).toBe(true);
  });

  test('accountant is limited to finance-adjacent workflows', () => {
    expect(canWriteResource('accountant', 'payments')).toBe(true);
    expect(canWriteResource('accountant', 'leases')).toBe(true);
    expect(canWriteResource('accountant', 'properties')).toBe(false);
    expect(canAdministerOrganization('accountant')).toBe(false);
  });

  test('maintenance and viewer roles cannot mutate finance', () => {
    expect(canWriteResource('maintenance', 'maintenance')).toBe(true);
    expect(canWriteResource('maintenance', 'payments')).toBe(false);
    expect(canWriteResource('viewer', 'messages')).toBe(false);
    expect(canWriteResource(undefined, 'payments')).toBe(false);
  });
});
