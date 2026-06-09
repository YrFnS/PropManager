// Rate limiting using in-memory store (per-IP)
// For production, replace with Redis-backed store

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs?: number;  // Time window in milliseconds (default: 60_000 = 1 minute)
  maxRequests?: number; // Max requests per window (default: 60)
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 60_000,
  maxRequests: 60,
};

export function rateLimit(options?: RateLimitOptions): { success: boolean; remaining: number; resetMs: number } {
  const windowMs = options?.windowMs ?? DEFAULT_OPTIONS.windowMs ?? 60_000;
  const maxRequests = options?.maxRequests ?? DEFAULT_OPTIONS.maxRequests ?? 60;

  // Use a key that includes the window and max to separate different limit types
  const key = `global_${windowMs}_${maxRequests}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: maxRequests - 1, resetMs: windowMs };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetMs: entry.resetTime - now };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetMs: entry.resetTime - now };
}

// Stricter rate limit for dangerous operations (reset, seed)
export function strictRateLimit(): { success: boolean; remaining: number; resetMs: number } {
  return rateLimit({ windowMs: 60_000, maxRequests: 5 });
}

// Input sanitization helpers
export function sanitizeString(input: string, maxLength: number = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .trim();
}

export function validateEnum(value: string, allowed: string[], fieldName: string): string | null {
  if (!allowed.includes(value)) {
    return `${fieldName} must be one of: ${allowed.join(', ')}`;
  }
  return null;
}

// Common validation schemas
import { z } from 'zod/v4';

export const propertySchema = z.object({
  name: z.string().min(1).max(200),
  nameAr: z.string().max(200).optional(),
  address: z.string().min(1).max(500),
  addressAr: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  cityAr: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  description: z.string().max(2000).optional(),
  descriptionAr: z.string().max(2000).optional(),
  type: z.enum(['residential', 'commercial', 'mixed']).optional(),
  totalUnits: z.number().int().min(0).optional(),
});

export const unitSchema = z.object({
  propertyId: z.string().min(1),
  unitNumber: z.string().min(1).max(50),
  floor: z.number().int().optional(),
  rooms: z.number().int().min(0),
  bathrooms: z.number().min(0).optional(),
  area: z.number().min(0).optional(),
  rentAmount: z.number().min(0),
  status: z.enum(['available', 'rented', 'maintenance']).optional(),
});

export const tenantSchema = z.object({
  name: z.string().min(1).max(200),
  nameAr: z.string().max(200).optional(),
  email: z.string().email().max(200),
  phone: z.string().max(50).optional(),
  nationalId: z.string().max(50).optional(),
  emergencyContact: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const leaseSchema = z.object({
  unitId: z.string().min(1),
  tenantId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  rentAmount: z.number().min(0),
  deposit: z.number().min(0).optional(),
  status: z.enum(['active', 'expired', 'terminated']).optional(),
});

export const paymentSchema = z.object({
  leaseId: z.string().min(1),
  tenantId: z.string().min(1),
  amount: z.number().min(0),
  dueDate: z.string().min(1),
  paidDate: z.string().optional(),
  status: z.enum(['pending', 'paid', 'late', 'partial']).optional(),
  method: z.enum(['cash', 'bank_transfer', 'online', 'check']).optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const maintenanceSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  tenantId: z.string().optional(),
  title: z.string().min(1).max(300),
  titleAr: z.string().max(300).optional(),
  description: z.string().min(1).max(3000),
  descriptionAr: z.string().max(3000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  category: z.enum(['plumbing', 'electrical', 'structural', 'appliance', 'hvac', 'other']).optional(),
  assignedTo: z.string().max(200).optional(),
});

export const messageSchema = z.object({
  senderName: z.string().min(1).max(200),
  senderEmail: z.string().email().max(200),
  subject: z.string().min(1).max(300),
  content: z.string().min(1).max(5000),
  category: z.enum(['general', 'maintenance', 'payment', 'lease', 'other']).optional(),
});
