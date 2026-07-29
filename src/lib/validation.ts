import { z } from 'zod/v4';

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  key?: string;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 120;
let callsSinceCleanup = 0;

function cleanupExpiredEntries(now: number) {
  callsSinceCleanup += 1;
  if (callsSinceCleanup < 250) return;
  callsSinceCleanup = 0;

  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetTime <= now) rateLimitMap.delete(key);
  }
}

export function rateLimit(options: RateLimitOptions = {}): {
  success: boolean;
  remaining: number;
  resetMs: number;
} {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const key = `${options.key ?? 'application'}:${windowMs}:${maxRequests}`;
  const now = Date.now();
  cleanupExpiredEntries(now);

  const entry = rateLimitMap.get(key);
  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: Math.max(0, maxRequests - 1), resetMs: windowMs };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetMs: Math.max(0, entry.resetTime - now) };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: Math.max(0, maxRequests - entry.count),
    resetMs: Math.max(0, entry.resetTime - now),
  };
}

export function strictRateLimit(key = 'administrative'): {
  success: boolean;
  remaining: number;
  resetMs: number;
} {
  return rateLimit({ key: `strict:${key}`, windowMs: 60_000, maxRequests: 5 });
}

export function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function validateEnum(value: string, allowed: string[], fieldName: string): string | null {
  if (!allowed.includes(value)) return `${fieldName} must be one of: ${allowed.join(', ')}`;
  return null;
}

const optionalText = (max: number) => z.string().max(max).nullable().optional();

export const propertyManagerSchema = z.object({
  name: z.string().min(1).max(200),
  nameAr: optionalText(200),
  email: z.string().email().max(200),
  phone: optionalText(50),
});

export const propertySchema = z.object({
  name: z.string().min(1).max(200),
  nameAr: optionalText(200),
  address: z.string().min(1).max(500),
  addressAr: optionalText(500),
  city: z.string().min(1).max(100),
  cityAr: optionalText(100),
  state: optionalText(100),
  zipCode: optionalText(20),
  description: optionalText(2000),
  descriptionAr: optionalText(2000),
  image: z.union([z.string().url().max(2000), z.literal(''), z.null()]).optional(),
  type: z.enum(['residential', 'commercial', 'mixed']).optional(),
});

export const propertyUpdateSchema = propertySchema.partial().extend({
  id: z.string().min(1),
});

export const unitSchema = z.object({
  propertyId: z.string().min(1),
  unitNumber: z.string().min(1).max(50),
  floor: z.number().int().nullable().optional(),
  rooms: z.number().int().min(0),
  bathrooms: z.number().min(0).optional(),
  area: z.number().min(0).nullable().optional(),
  rentAmount: z.number().min(0),
  status: z.enum(['available', 'rented', 'maintenance']).optional(),
});

export const unitUpdateSchema = unitSchema.partial().extend({
  id: z.string().min(1),
});

export const tenantSchema = z.object({
  name: z.string().min(1).max(200),
  nameAr: optionalText(200),
  email: z.string().email().max(200),
  phone: optionalText(50),
  nationalId: optionalText(50),
  emergencyContact: optionalText(200),
  status: z.enum(['active', 'inactive']).optional(),
});

export const tenantUpdateSchema = tenantSchema.partial().extend({
  id: z.string().min(1),
});

export const leaseSchema = z.object({
  unitId: z.string().min(1),
  tenantId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  rentAmount: z.number().min(0),
  deposit: z.number().min(0).nullable().optional(),
  status: z.enum(['active', 'expired', 'terminated']).optional(),
});

export const leaseUpdateSchema = leaseSchema.partial().extend({
  id: z.string().min(1),
});

export const paymentSchema = z.object({
  leaseId: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  amount: z.number().positive(),
  dueDate: z.string().min(1),
  paidDate: z.string().nullable().optional(),
  status: z.enum(['pending', 'paid', 'late', 'partial']).optional(),
  method: z.enum(['cash', 'bank_transfer', 'online', 'check']).nullable().optional(),
  reference: optionalText(100),
  notes: optionalText(1000),
});

export const paymentUpdateSchema = paymentSchema.partial().extend({
  id: z.string().min(1),
});

export const maintenanceSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  title: z.string().min(1).max(300),
  titleAr: optionalText(300),
  description: optionalText(3000),
  descriptionAr: optionalText(3000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  category: z.enum(['plumbing', 'electrical', 'structural', 'appliance', 'hvac', 'other']).optional(),
  assignedTo: optionalText(200),
});

export const maintenanceUpdateSchema = maintenanceSchema.partial().extend({
  id: z.string().min(1),
});

export const messageSchema = z.object({
  senderName: z.string().min(1).max(200),
  senderEmail: z.string().email().max(200),
  subject: z.string().min(1).max(300),
  content: z.string().min(1).max(5000),
  category: z.enum(['general', 'maintenance', 'payment', 'lease', 'other']).optional(),
});
