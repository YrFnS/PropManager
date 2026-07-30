import type { AppRole } from '@/lib/auth';

export type AppResource =
  | 'dashboard' | 'properties' | 'units' | 'tenants' | 'leases' | 'payments'
  | 'maintenance' | 'messages' | 'reports' | 'settings' | 'organization' | 'users';

const WRITE_RESOURCES: Record<AppRole, readonly AppResource[]> = {
  owner: ['properties', 'units', 'tenants', 'leases', 'payments', 'maintenance', 'messages', 'settings', 'organization', 'users'],
  manager: ['properties', 'units', 'tenants', 'leases', 'payments', 'maintenance', 'messages'],
  accountant: ['tenants', 'leases', 'payments', 'messages'],
  maintenance: ['maintenance', 'messages'],
  viewer: [],
};

export function canWriteResource(role: AppRole | null | undefined, resource: AppResource) {
  return Boolean(role && WRITE_RESOURCES[role].includes(resource));
}

export function canAdministerOrganization(role: AppRole | null | undefined) {
  return role === 'owner';
}
