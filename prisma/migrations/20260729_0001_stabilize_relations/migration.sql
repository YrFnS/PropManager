-- PropManager baseline + stabilization migration.
-- It can initialize a new PostgreSQL database and can also be applied to the
-- pre-migration schema previously managed with `prisma db push`.

CREATE TABLE IF NOT EXISTS "Property" (
  "id" TEXT NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameAr" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "nationalId" TEXT,
  "emergencyContact" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "senderEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "category" TEXT NOT NULL DEFAULT 'general',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PropertyManager" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameAr" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  CONSTRAINT "PropertyManager_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyManager_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Unit" (
  "id" TEXT NOT NULL,
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
  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Unit_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Lease" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "rentAmount" DOUBLE PRECISION NOT NULL,
  "deposit" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lease_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Lease_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Lease_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT NOT NULL,
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
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MaintenanceRequest" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "tenantId" TEXT,
  "title" TEXT NOT NULL,
  "titleAr" TEXT,
  "description" TEXT NOT NULL,
  "descriptionAr" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "category" TEXT NOT NULL DEFAULT 'other',
  "assignedTo" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaintenanceRequest_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaintenanceRequest_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaintenanceRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Upgrade the two relationships that previously cascaded financial history.
ALTER TABLE "Lease" DROP CONSTRAINT IF EXISTS "Lease_unitId_fkey";
ALTER TABLE "Lease"
  ADD CONSTRAINT "Lease_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_leaseId_fkey";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_leaseId_fkey"
  FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve historical leases while allowing only one active lease per unit.
DROP INDEX IF EXISTS "Lease_unitId_key";
CREATE INDEX IF NOT EXISTS "Lease_unitId_idx" ON "Lease"("unitId");
CREATE UNIQUE INDEX IF NOT EXISTS "Lease_one_active_per_unit_key"
  ON "Lease"("unitId") WHERE "status" = 'active';

-- A unit number is unique inside a property.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Unit"
    GROUP BY "propertyId", "unitNumber"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate unit numbers exist inside the same property. Resolve them before deploying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Unit_propertyId_unitNumber_key"
  ON "Unit"("propertyId", "unitNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyManager_propertyId_key" ON "PropertyManager"("propertyId");
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_email_key" ON "Tenant"("email");
CREATE INDEX IF NOT EXISTS "Property_type_idx" ON "Property"("type");
CREATE INDEX IF NOT EXISTS "Property_city_idx" ON "Property"("city");
CREATE INDEX IF NOT EXISTS "Unit_propertyId_idx" ON "Unit"("propertyId");
CREATE INDEX IF NOT EXISTS "Unit_status_idx" ON "Unit"("status");
CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant"("status");
CREATE INDEX IF NOT EXISTS "Lease_tenantId_idx" ON "Lease"("tenantId");
CREATE INDEX IF NOT EXISTS "Lease_status_idx" ON "Lease"("status");
CREATE INDEX IF NOT EXISTS "Lease_endDate_idx" ON "Lease"("endDate");
CREATE INDEX IF NOT EXISTS "Payment_leaseId_idx" ON "Payment"("leaseId");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_dueDate_idx" ON "Payment"("dueDate");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_propertyId_idx" ON "MaintenanceRequest"("propertyId");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_status_idx" ON "MaintenanceRequest"("status");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_priority_idx" ON "MaintenanceRequest"("priority");
CREATE INDEX IF NOT EXISTS "Message_isRead_idx" ON "Message"("isRead");
CREATE INDEX IF NOT EXISTS "Message_category_idx" ON "Message"("category");
CREATE INDEX IF NOT EXISTS "ActivityLog_entity_idx" ON "ActivityLog"("entity");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- Repair denormalized and historically inconsistent values created by the
-- prototype APIs and demo seeders.
UPDATE "Payment" AS payment
SET "tenantId" = lease."tenantId"
FROM "Lease" AS lease
WHERE payment."leaseId" = lease."id"
  AND payment."tenantId" <> lease."tenantId";

UPDATE "Unit" AS unit
SET "status" = 'rented'
WHERE EXISTS (
  SELECT 1 FROM "Lease" AS lease
  WHERE lease."unitId" = unit."id" AND lease."status" = 'active'
);

UPDATE "Unit" AS unit
SET "status" = 'available'
WHERE unit."status" = 'rented'
  AND NOT EXISTS (
    SELECT 1 FROM "Lease" AS lease
    WHERE lease."unitId" = unit."id" AND lease."status" = 'active'
  );

UPDATE "Property" AS property
SET "totalUnits" = (
  SELECT COUNT(*)::INTEGER FROM "Unit" AS unit
  WHERE unit."propertyId" = property."id"
);

-- Keep the denormalized Payment.tenantId field aligned with its lease even
-- when legacy scripts or seeders submit a conflicting tenant ID.
CREATE OR REPLACE FUNCTION "PropManager_sync_payment_tenant"()
RETURNS TRIGGER AS $$
BEGIN
  SELECT "tenantId" INTO NEW."tenantId"
  FROM "Lease"
  WHERE "id" = NEW."leaseId";

  IF NEW."tenantId" IS NULL THEN
    RAISE EXCEPTION 'Payment lease % does not exist', NEW."leaseId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Payment_sync_tenant" ON "Payment";
CREATE TRIGGER "Payment_sync_tenant"
BEFORE INSERT OR UPDATE OF "leaseId", "tenantId" ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "PropManager_sync_payment_tenant"();
