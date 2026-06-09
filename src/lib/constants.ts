// Payment method types - shared between API and UI
export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'online', 'check'] as const;

// Maintenance categories
export const MAINTENANCE_CATEGORIES = ['plumbing', 'electrical', 'structural', 'appliance', 'hvac', 'other'] as const;

// Maintenance priorities
export const MAINTENANCE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

// Maintenance statuses
export const MAINTENANCE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

// Lease statuses
export const LEASE_STATUSES = ['active', 'expired', 'terminated'] as const;

// Payment statuses
export const PAYMENT_STATUSES = ['pending', 'paid', 'late', 'partial'] as const;

// Tenant statuses
export const TENANT_STATUSES = ['active', 'inactive'] as const;

// Unit statuses
export const UNIT_STATUSES = ['available', 'rented', 'maintenance'] as const;

// Property types
export const PROPERTY_TYPES = ['residential', 'commercial', 'mixed'] as const;

// App configuration
export const APP_CONFIG = {
  name: 'PropManager',
  description: 'Property Management System',
  contactEmail: 'support@propmanager.com',
  website: 'www.propmanager.com',
  maxNotificationDisplay: 99,
  notificationRefreshInterval: 60000, // 60 seconds
  expiringLeaseDays: 30,
  dashboardPeriod: 'thisMonth',
} as const;
