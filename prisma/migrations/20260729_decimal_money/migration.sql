-- Store financial values with fixed decimal precision instead of floating point.

ALTER TABLE "Unit"
  ALTER COLUMN "rentAmount" TYPE DECIMAL(18, 2)
  USING ROUND("rentAmount"::numeric, 2);

ALTER TABLE "Lease"
  ALTER COLUMN "rentAmount" TYPE DECIMAL(18, 2)
  USING ROUND("rentAmount"::numeric, 2),
  ALTER COLUMN "deposit" TYPE DECIMAL(18, 2)
  USING CASE WHEN "deposit" IS NULL THEN NULL ELSE ROUND("deposit"::numeric, 2) END;

ALTER TABLE "Payment"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2)
  USING ROUND("amount"::numeric, 2);
