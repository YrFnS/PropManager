#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${LEGACY_DATABASE_URL:?LEGACY_DATABASE_URL is required}"
: "${LEGACY_PSQL_URL:?LEGACY_PSQL_URL is required}"

# Fresh-install rehearsal.
bun run db:migrate:deploy
bunx prisma migrate status

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y postgresql-client
fi

# Upgrade rehearsal: construct the relevant prototype-era schema and data first,
# then run the complete stabilization migration chain over it.
PGPASSWORD=postgres dropdb --if-exists -h localhost -U postgres propmanager_legacy
PGPASSWORD=postgres createdb -h localhost -U postgres propmanager_legacy

psql "${LEGACY_PSQL_URL}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE "Property" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "nameAr" TEXT,
  "address" TEXT NOT NULL,
  "addressAr" TEXT,
  "city" TEXT NOT NULL,
  "cityAr" TEXT,
  "state" TEXT,
  "zipCode" TEXT,
  "description" TEXT,
  "descriptionAr" TEXT,
  "type" TEXT NOT NULL DEFAULT 'residential',
  "totalUnits" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Tenant" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "nameAr" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "nationalId" TEXT,
  "emergencyContact" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Unit" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "unitNumber" TEXT NOT NULL,
  "floor" INTEGER,
  "rooms" INTEGER NOT NULL,
  "bathrooms" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "area" DOUBLE PRECISION,
  "rentAmount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'available',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Lease" (
  "id" TEXT PRIMARY KEY,
  "unitId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "rentAmount" DOUBLE PRECISION NOT NULL,
  "deposit" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Lease_unitId_key" ON "Lease"("unitId");

CREATE TABLE "Payment" (
  "id" TEXT PRIMARY KEY,
  "leaseId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "method" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "Property" ("id", "name", "address", "city", "type", "totalUnits", "createdAt", "updatedAt")
VALUES ('legacy_property', 'Legacy Tower', '1 Legacy Road', 'Baghdad', 'residential', 99, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Tenant" ("id", "name", "email", "status", "createdAt", "updatedAt") VALUES
  ('legacy_tenant', 'Legacy Tenant', 'legacy@example.com', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wrong_tenant', 'Wrong Tenant', 'wrong@example.com', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Unit" ("id", "propertyId", "unitNumber", "rooms", "bathrooms", "rentAmount", "status", "createdAt", "updatedAt")
VALUES ('legacy_unit', 'legacy_property', 'A-1', 2, 1, 1000.126, 'available', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Lease" ("id", "unitId", "tenantId", "startDate", "endDate", "rentAmount", "deposit", "status", "createdAt", "updatedAt")
VALUES ('legacy_lease', 'legacy_unit', 'legacy_tenant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', 1000.126, 2000.126, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Payment" ("id", "leaseId", "tenantId", "amount", "dueDate", "paidDate", "status", "method", "createdAt", "updatedAt")
VALUES ('legacy_payment', 'legacy_lease', 'wrong_tenant', 1000.126, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'paid', 'cash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
SQL

# Apply the first idempotent stabilization migration to the populated legacy DB,
# register it, and then let Prisma deploy the later migrations normally.
psql "${LEGACY_PSQL_URL}" -v ON_ERROR_STOP=1 \
  -f prisma/migrations/20260729_stabilize_relations/migration.sql
DATABASE_URL="${LEGACY_DATABASE_URL}" bunx prisma migrate resolve \
  --applied 20260729_stabilize_relations
DATABASE_URL="${LEGACY_DATABASE_URL}" bun run db:migrate:deploy
DATABASE_URL="${LEGACY_DATABASE_URL}" bunx prisma migrate status

psql "${LEGACY_PSQL_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF (SELECT "organizationId" FROM "Property" WHERE "id" = 'legacy_property') <> 'org_default' THEN
    RAISE EXCEPTION 'Legacy property was not assigned to the default organization';
  END IF;
  IF (SELECT "tenantId" FROM "Payment" WHERE "id" = 'legacy_payment') <> 'legacy_tenant' THEN
    RAISE EXCEPTION 'Legacy payment tenant was not repaired from its lease';
  END IF;
  IF (SELECT "amount" FROM "Payment" WHERE "id" = 'legacy_payment') <> 1000.13::numeric THEN
    RAISE EXCEPTION 'Legacy payment amount was not rounded to fixed precision';
  END IF;
  IF (SELECT "rentAmount" FROM "Unit" WHERE "id" = 'legacy_unit') <> 1000.13::numeric THEN
    RAISE EXCEPTION 'Legacy unit rent was not rounded to fixed precision';
  END IF;
  IF (SELECT "status" FROM "Unit" WHERE "id" = 'legacy_unit') <> 'rented' THEN
    RAISE EXCEPTION 'Legacy occupied unit status was not repaired';
  END IF;
  IF (SELECT "totalUnits" FROM "Property" WHERE "id" = 'legacy_property') <> 1 THEN
    RAISE EXCEPTION 'Legacy property unit total was not reconciled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PaymentAdjustment'
  ) THEN
    RAISE EXCEPTION 'PaymentAdjustment ledger table is missing';
  END IF;
END $$;

-- Historical leases must be allowed after the one-to-one prototype relation is removed.
INSERT INTO "Lease" (
  "id", "organizationId", "unitId", "tenantId", "startDate", "endDate",
  "rentAmount", "deposit", "status", "createdAt", "updatedAt"
) VALUES (
  'legacy_history', 'org_default', 'legacy_unit', 'legacy_tenant',
  CURRENT_TIMESTAMP - INTERVAL '2 years', CURRENT_TIMESTAMP - INTERVAL '1 year',
  900.00, 1800.00, 'expired', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- A second active lease for the same unit must still be rejected.
DO $$
BEGIN
  BEGIN
    INSERT INTO "Lease" (
      "id", "organizationId", "unitId", "tenantId", "startDate", "endDate",
      "rentAmount", "deposit", "status", "createdAt", "updatedAt"
    ) VALUES (
      'invalid_active', 'org_default', 'legacy_unit', 'legacy_tenant',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year',
      1000.00, 2000.00, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    RAISE EXCEPTION 'A second active lease was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;
SQL
