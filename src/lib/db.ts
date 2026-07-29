import { Prisma, PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

const ORGANIZATION_SCOPED_MODELS = new Set<string>([
  'Property',
  'PropertyManager',
  'Unit',
  'Tenant',
  'Lease',
  'Payment',
  'MaintenanceRequest',
  'Message',
  'ActivityLog',
]);

async function getRequestOrganizationId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);
    return session?.organizationId ?? null;
  } catch {
    // CLI scripts and build-time utilities run outside a Next.js request scope.
    return null;
  }
}

function withOrganizationWhere(where: unknown, organizationId: string) {
  if (!where || typeof where !== 'object') return { organizationId };
  return { AND: [where, { organizationId }] };
}

function withUniqueOrganizationWhere(where: unknown, organizationId: string) {
  return { ...((where && typeof where === 'object' ? where : {}) as Record<string, unknown>), organizationId };
}

function withOrganizationData(data: unknown, organizationId: string) {
  if (Array.isArray(data)) {
    return data.map((item) => ({ ...(item as Record<string, unknown>), organizationId }));
  }
  return { ...((data && typeof data === 'object' ? data : {}) as Record<string, unknown>), organizationId };
}

function withoutOrganizationMutation(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const next = { ...(data as Record<string, unknown>) };
  delete next.organizationId;
  delete next.organization;
  return next;
}

function scopeOperationArgs(operation: string, args: unknown, organizationId: string): unknown {
  const next = { ...((args && typeof args === 'object' ? args : {}) as Record<string, unknown>) };

  switch (operation) {
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'update':
    case 'delete':
      next.where = withUniqueOrganizationWhere(next.where, organizationId);
      if (operation === 'update') next.data = withoutOrganizationMutation(next.data);
      return next;

    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findMany':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'updateMany':
    case 'updateManyAndReturn':
    case 'deleteMany':
      next.where = withOrganizationWhere(next.where, organizationId);
      if (operation === 'updateMany' || operation === 'updateManyAndReturn') {
        next.data = withoutOrganizationMutation(next.data);
      }
      return next;

    case 'create':
      next.data = withOrganizationData(next.data, organizationId);
      return next;

    case 'createMany':
    case 'createManyAndReturn':
      next.data = withOrganizationData(next.data, organizationId);
      return next;

    case 'upsert':
      next.where = withUniqueOrganizationWhere(next.where, organizationId);
      next.create = withOrganizationData(next.create, organizationId);
      next.update = withoutOrganizationMutation(next.update);
      return next;

    default:
      return next;
  }
}

function createDatabaseClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  return client.$extends({
    name: 'organization-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!ORGANIZATION_SCOPED_MODELS.has(model)) return query(args);
          const organizationId = await getRequestOrganizationId();
          if (!organizationId) return query(args);
          return query(scopeOperationArgs(operation, args, organizationId) as typeof args);
        },
      },
    },
  });
}

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: DatabaseClient | undefined;
};

const databaseClient = globalForPrisma.prisma ?? createDatabaseClient();

// Keep Prisma's standard client type at call sites so transaction callbacks and
// helper functions continue to use Prisma.TransactionClient. The runtime value
// remains the organization-scoped extended client.
export const db = databaseClient as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = databaseClient;

export { Prisma };
