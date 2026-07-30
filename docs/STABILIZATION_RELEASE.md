# PropManager stabilization release

This release converts the original single-user prototype into an authenticated, organization-scoped property-management application with fixed-precision financial storage and an immutable payment lifecycle.

## Release contents

- Database-backed users and salted `scrypt` password hashes
- Signed, HTTP-only organization sessions
- Owner, manager, accountant, maintenance, and viewer roles
- Automatic organization scoping for business records
- PostgreSQL constraints and triggers that reject cross-organization relationships
- Historical leases with at most one active lease per unit
- `DECIMAL(18,2)` money storage
- Immutable payment void and refund adjustments
- Net-cash dashboard and reports after refunds
- Role-aware UI controls and API enforcement
- English and Arabic login/RTL coverage
- Fresh-install and populated legacy-database migration rehearsal

## Required environment

Create the production environment from `.env.example` and set at least:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="at-least-32-random-characters"
ADMIN_EMAIL="initial-owner@example.com"
ADMIN_PASSWORD="strong-bootstrap-password"
ADMIN_NAME="Initial Owner"
DEFAULT_ORGANIZATION_NAME="Property Company"
DEFAULT_CURRENCY="USD"
DEFAULT_TIMEZONE="UTC"
ENABLE_DANGEROUS_ADMIN_ACTIONS="false"
ENABLE_AI_COPILOT="false"
```

The administrator credentials bootstrap only the first database-backed owner. Rotate or remove the bootstrap password after confirming another owner account and a recovery process.

## Pre-deployment checks

1. Take a verified PostgreSQL backup and record its restore command.
2. Restore the backup into an isolated staging database.
3. Check for duplicate unit numbers inside a property:

```sql
SELECT "propertyId", "unitNumber", COUNT(*)
FROM "Unit"
GROUP BY "propertyId", "unitNumber"
HAVING COUNT(*) > 1;
```

The migration intentionally stops when duplicates exist; correct them before deployment.

4. Confirm the staging application uses a staging `DATABASE_URL`, not production.
5. Keep seed/reset and AI features disabled during the migration.

## Validation sequence

```bash
bun ci
bun run db:generate
bun run db:migrate:deploy
bun run typecheck
bun test tests
bun run lint
bun run build
bunx playwright install --with-deps chromium
bun run test:e2e
```

The repository's `Browser and migration rehearsal` workflow performs this sequence against both a fresh PostgreSQL database and a populated legacy prototype schema.

## Post-migration verification

Run these checks before directing traffic to the new deployment:

```sql
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT COUNT(*) AS missing_organization
FROM "Property"
WHERE "organizationId" IS NULL;

SELECT COUNT(*) AS mismatched_payment_tenant
FROM "Payment" payment
JOIN "Lease" lease ON lease.id = payment."leaseId"
WHERE payment."tenantId" <> lease."tenantId";

SELECT "unitId", COUNT(*)
FROM "Lease"
WHERE status = 'active'
GROUP BY "unitId"
HAVING COUNT(*) > 1;
```

All result counts in the last three checks must be zero.

Then verify in the browser:

1. The initial owner can sign in and see mutation controls.
2. A viewer cannot see mutation controls and receives `403` for direct writes.
3. Organization switching does not expose records from another organization.
4. Lease creation changes only the selected unit's occupancy.
5. Pending payments can be voided but not deleted.
6. Paid payments can be partially and fully refunded without changing their original amount.
7. Dashboard and reports show net collected cash after refunds.
8. Arabic pages remain RTL and preserve localized navigation.

## Deployment

After staging passes, deploy the exact reviewed commit:

```bash
bun ci
bun run db:generate
bun run db:migrate:deploy
bun run build
bun run start
```

Do not use `prisma db push` for production deployment.

## Rollback

Application rollback and database rollback are separate decisions.

1. Stop writes or place the application in maintenance mode.
2. Capture a new backup of the failed post-migration state for investigation.
3. Roll the application back to the previous image/commit only when its schema remains compatible.
4. When schema rollback is required, restore the verified pre-deployment database backup rather than manually reversing organization ownership, decimal conversions, or payment-adjustment history.
5. Re-run record-count and relationship checks before reopening traffic.

Never delete payment adjustments to simulate a rollback; restore the database backup or add a correcting business transaction after review.
