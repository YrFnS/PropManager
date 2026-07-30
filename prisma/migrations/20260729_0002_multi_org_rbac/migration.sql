-- Multi-organization ownership and role-based access foundation.

CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameAr" TEXT,
  "slug" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "locale" TEXT NOT NULL DEFAULT 'en',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Membership_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_organizationId_key"
  ON "Membership"("userId", "organizationId");
CREATE INDEX IF NOT EXISTS "Membership_organizationId_role_idx"
  ON "Membership"("organizationId", "role");
CREATE INDEX IF NOT EXISTS "Membership_userId_isActive_idx"
  ON "Membership"("userId", "isActive");

INSERT INTO "Organization" (
  "id", "name", "slug", "currency", "locale", "timezone", "createdAt", "updatedAt"
)
VALUES (
  'org_default', 'Default Organization', 'default', 'USD', 'en', 'UTC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "PropertyManager" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "Property" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "PropertyManager" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Unit" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Tenant" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Lease" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Payment" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "MaintenanceRequest" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Message" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "ActivityLog" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;

ALTER TABLE "Property" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';
ALTER TABLE "PropertyManager" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';
ALTER TABLE "Unit" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';
ALTER TABLE "Tenant" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';
ALTER TABLE "Lease" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';
ALTER TABLE "Payment" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';
ALTER TABLE "MaintenanceRequest" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';
ALTER TABLE "Message" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';
ALTER TABLE "ActivityLog" ALTER COLUMN "organizationId" SET DEFAULT 'org_default';

ALTER TABLE "Property" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PropertyManager" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Unit" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Lease" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "MaintenanceRequest" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Message" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ActivityLog" ALTER COLUMN "organizationId" SET NOT NULL;

DO $$
DECLARE
  table_name TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Property', 'PropertyManager', 'Unit', 'Tenant', 'Lease', 'Payment',
    'MaintenanceRequest', 'Message', 'ActivityLog'
  ]
  LOOP
    constraint_name := table_name || '_organizationId_fkey';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE',
        table_name,
        constraint_name
      );
    END IF;
  END LOOP;
END $$;

DROP INDEX IF EXISTS "Tenant_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_organizationId_email_key"
  ON "Tenant"("organizationId", "email");

DROP INDEX IF EXISTS "Property_type_idx";
DROP INDEX IF EXISTS "Property_city_idx";
DROP INDEX IF EXISTS "Unit_status_idx";
DROP INDEX IF EXISTS "Tenant_status_idx";
DROP INDEX IF EXISTS "Lease_status_idx";
DROP INDEX IF EXISTS "Payment_status_idx";
DROP INDEX IF EXISTS "MaintenanceRequest_status_idx";
DROP INDEX IF EXISTS "Message_isRead_idx";
DROP INDEX IF EXISTS "Message_category_idx";
DROP INDEX IF EXISTS "ActivityLog_entity_idx";
DROP INDEX IF EXISTS "ActivityLog_createdAt_idx";

CREATE INDEX IF NOT EXISTS "Property_organizationId_type_idx" ON "Property"("organizationId", "type");
CREATE INDEX IF NOT EXISTS "Property_organizationId_city_idx" ON "Property"("organizationId", "city");
CREATE INDEX IF NOT EXISTS "PropertyManager_organizationId_idx" ON "PropertyManager"("organizationId");
CREATE INDEX IF NOT EXISTS "Unit_organizationId_status_idx" ON "Unit"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Tenant_organizationId_status_idx" ON "Tenant"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Lease_organizationId_status_idx" ON "Lease"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Payment_organizationId_status_idx" ON "Payment"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_organizationId_status_idx"
  ON "MaintenanceRequest"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Message_organizationId_isRead_idx" ON "Message"("organizationId", "isRead");
CREATE INDEX IF NOT EXISTS "Message_organizationId_category_idx" ON "Message"("organizationId", "category");
CREATE INDEX IF NOT EXISTS "ActivityLog_organizationId_entity_idx"
  ON "ActivityLog"("organizationId", "entity");
CREATE INDEX IF NOT EXISTS "ActivityLog_organizationId_createdAt_idx"
  ON "ActivityLog"("organizationId", "createdAt");

-- Derive organization ownership from parent relationships so nested writes and
-- legacy integrations cannot cross organization boundaries.
CREATE OR REPLACE FUNCTION "PropManager_scope_property_manager"()
RETURNS TRIGGER AS $$
BEGIN
  SELECT "organizationId" INTO NEW."organizationId"
  FROM "Property" WHERE "id" = NEW."propertyId";
  IF NEW."organizationId" IS NULL THEN
    RAISE EXCEPTION 'Property % does not exist', NEW."propertyId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PropertyManager_scope_organization" ON "PropertyManager";
CREATE TRIGGER "PropertyManager_scope_organization"
BEFORE INSERT OR UPDATE OF "propertyId", "organizationId" ON "PropertyManager"
FOR EACH ROW EXECUTE FUNCTION "PropManager_scope_property_manager"();

CREATE OR REPLACE FUNCTION "PropManager_scope_unit"()
RETURNS TRIGGER AS $$
BEGIN
  SELECT "organizationId" INTO NEW."organizationId"
  FROM "Property" WHERE "id" = NEW."propertyId";
  IF NEW."organizationId" IS NULL THEN
    RAISE EXCEPTION 'Property % does not exist', NEW."propertyId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Unit_scope_organization" ON "Unit";
CREATE TRIGGER "Unit_scope_organization"
BEFORE INSERT OR UPDATE OF "propertyId", "organizationId" ON "Unit"
FOR EACH ROW EXECUTE FUNCTION "PropManager_scope_unit"();

CREATE OR REPLACE FUNCTION "PropManager_scope_lease"()
RETURNS TRIGGER AS $$
DECLARE
  unit_org TEXT;
  tenant_org TEXT;
BEGIN
  SELECT "organizationId" INTO unit_org FROM "Unit" WHERE "id" = NEW."unitId";
  SELECT "organizationId" INTO tenant_org FROM "Tenant" WHERE "id" = NEW."tenantId";
  IF unit_org IS NULL OR tenant_org IS NULL THEN
    RAISE EXCEPTION 'Lease unit or tenant does not exist';
  END IF;
  IF unit_org <> tenant_org THEN
    RAISE EXCEPTION 'Lease unit and tenant belong to different organizations';
  END IF;
  NEW."organizationId" := unit_org;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Lease_scope_organization" ON "Lease";
CREATE TRIGGER "Lease_scope_organization"
BEFORE INSERT OR UPDATE OF "unitId", "tenantId", "organizationId" ON "Lease"
FOR EACH ROW EXECUTE FUNCTION "PropManager_scope_lease"();

DROP TRIGGER IF EXISTS "Payment_sync_tenant" ON "Payment";
DROP FUNCTION IF EXISTS "PropManager_sync_payment_tenant"();

CREATE OR REPLACE FUNCTION "PropManager_scope_payment"()
RETURNS TRIGGER AS $$
DECLARE
  lease_org TEXT;
  lease_tenant TEXT;
BEGIN
  SELECT "organizationId", "tenantId" INTO lease_org, lease_tenant
  FROM "Lease" WHERE "id" = NEW."leaseId";
  IF lease_org IS NULL THEN
    RAISE EXCEPTION 'Payment lease % does not exist', NEW."leaseId";
  END IF;
  NEW."organizationId" := lease_org;
  NEW."tenantId" := lease_tenant;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Payment_scope_organization" ON "Payment";
CREATE TRIGGER "Payment_scope_organization"
BEFORE INSERT OR UPDATE OF "leaseId", "tenantId", "organizationId" ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "PropManager_scope_payment"();

CREATE OR REPLACE FUNCTION "PropManager_scope_maintenance"()
RETURNS TRIGGER AS $$
DECLARE
  property_org TEXT;
  related_org TEXT;
  unit_property TEXT;
BEGIN
  SELECT "organizationId" INTO property_org FROM "Property" WHERE "id" = NEW."propertyId";
  IF property_org IS NULL THEN
    RAISE EXCEPTION 'Maintenance property % does not exist', NEW."propertyId";
  END IF;

  IF NEW."unitId" IS NOT NULL THEN
    SELECT "organizationId", "propertyId" INTO related_org, unit_property
    FROM "Unit" WHERE "id" = NEW."unitId";
    IF related_org IS NULL OR related_org <> property_org OR unit_property <> NEW."propertyId" THEN
      RAISE EXCEPTION 'Maintenance unit does not belong to the selected property organization';
    END IF;
  END IF;

  IF NEW."tenantId" IS NOT NULL THEN
    SELECT "organizationId" INTO related_org FROM "Tenant" WHERE "id" = NEW."tenantId";
    IF related_org IS NULL OR related_org <> property_org THEN
      RAISE EXCEPTION 'Maintenance tenant belongs to another organization';
    END IF;
  END IF;

  NEW."organizationId" := property_org;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Maintenance_scope_organization" ON "MaintenanceRequest";
CREATE TRIGGER "Maintenance_scope_organization"
BEFORE INSERT OR UPDATE OF "propertyId", "unitId", "tenantId", "organizationId" ON "MaintenanceRequest"
FOR EACH ROW EXECUTE FUNCTION "PropManager_scope_maintenance"();
