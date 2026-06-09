// Status colors for badges - used across all section components
export const STATUS_COLORS: Record<string, string> = {
  // Tenant statuses
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',

  // Payment statuses
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  late: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',

  // Unit statuses
  available: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  rented: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  maintenance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',

  // Lease statuses
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  terminated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',

  // Maintenance statuses
  open: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  maintenance: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  payment: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  lease: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

// Chart color hex values for recharts
export const CHART_COLORS = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  blue: '#3b82f6',
  orange: '#f97316',
  teal: '#14b8a6',
  amber: '#f59e0b',
  sky: '#0ea5e9',
};

// Default fallback color for unknown status
export const DEFAULT_STATUS_COLOR = 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

// Notification colors for notification bell
export const NOTIFICATION_COLORS: Record<string, string> = {
  message: 'text-blue-500 bg-blue-500/10',
  payment: 'text-red-500 bg-red-500/10',
  maintenance: 'text-orange-500 bg-orange-500/10',
};
