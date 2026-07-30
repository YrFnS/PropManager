-- Immutable payment lifecycle adjustments. Original payments remain intact.
CREATE TABLE IF NOT EXISTS "PaymentAdjustment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL DEFAULT 'org_default',
  "paymentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentAdjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentAdjustment_type_amount_check" CHECK (
    ("type" = 'void' AND "amount" = 0) OR
    ("type" = 'refund' AND "amount" > 0)
  )
);

CREATE INDEX IF NOT EXISTS "PaymentAdjustment_organizationId_paymentId_idx"
  ON "PaymentAdjustment"("organizationId", "paymentId");
CREATE INDEX IF NOT EXISTS "PaymentAdjustment_organizationId_type_createdAt_idx"
  ON "PaymentAdjustment"("organizationId", "type", "createdAt");

CREATE OR REPLACE FUNCTION "PropManager_scope_payment_adjustment"()
RETURNS TRIGGER AS $$
DECLARE payment_org TEXT;
BEGIN
  SELECT "organizationId" INTO payment_org FROM "Payment" WHERE "id" = NEW."paymentId";
  IF payment_org IS NULL THEN
    RAISE EXCEPTION 'Payment % does not exist', NEW."paymentId";
  END IF;
  NEW."organizationId" := payment_org;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PaymentAdjustment_scope_organization" ON "PaymentAdjustment";
CREATE TRIGGER "PaymentAdjustment_scope_organization"
BEFORE INSERT OR UPDATE OF "paymentId", "organizationId" ON "PaymentAdjustment"
FOR EACH ROW EXECUTE FUNCTION "PropManager_scope_payment_adjustment"();
