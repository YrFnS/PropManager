import type { Prisma } from '@prisma/client';

function normalizeDetails(details: Record<string, unknown> | undefined) {
  return JSON.stringify({
    actor: process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'administrator',
    ...(details || {}),
  });
}

export function auditEntry(
  action: string,
  entity: string,
  entityId: string | null,
  details?: Record<string, unknown>,
): Prisma.ActivityLogCreateInput {
  return {
    action,
    entity,
    entityId,
    details: normalizeDetails(details),
  };
}
