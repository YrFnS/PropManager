from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise RuntimeError(f"Expected source fragment was not found in {path}: {old!r}")
    target.write_text(text.replace(old, new))


replace(
    "prisma/schema.prisma",
    "  rentAmount          Float\n",
    "  rentAmount          Decimal              @db.Decimal(18, 2)\n",
)
replace(
    "prisma/schema.prisma",
    "  rentAmount     Float\n  deposit        Float?\n",
    "  rentAmount     Decimal      @db.Decimal(18, 2)\n  deposit        Decimal?     @db.Decimal(18, 2)\n",
)
replace(
    "prisma/schema.prisma",
    "  amount         Float\n",
    "  amount         Decimal      @db.Decimal(18, 2)\n",
)

money_helper = """import { Prisma } from '@prisma/client';

export type MoneyValue = Prisma.Decimal | number | string | null | undefined;

export function moneyToNumber(value: MoneyValue): number {
  if (value === null || value === undefined) return 0;
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function moneyEquals(left: MoneyValue, right: MoneyValue): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return left === right;
  }
  return new Prisma.Decimal(left).equals(new Prisma.Decimal(right));
}

let decimalSerializationConfigured = false;

export function configureDecimalSerialization() {
  if (decimalSerializationConfigured) return;
  const prototype = Prisma.Decimal.prototype as unknown as {
    toJSON: (this: Prisma.Decimal) => number;
  };
  prototype.toJSON = function toJSON(this: Prisma.Decimal) {
    return this.toNumber();
  };
  decimalSerializationConfigured = true;
}
"""
(ROOT / "src/lib/money.ts").write_text(money_helper)

replace(
    "src/lib/db.ts",
    "import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';\n",
    "import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';\nimport { configureDecimalSerialization } from '@/lib/money';\n\nconfigureDecimalSerialization();\n",
)

migration = """-- Store financial values with fixed decimal precision instead of floating point.

ALTER TABLE \"Unit\"
  ALTER COLUMN \"rentAmount\" TYPE DECIMAL(18, 2)
  USING ROUND(\"rentAmount\"::numeric, 2);

ALTER TABLE \"Lease\"
  ALTER COLUMN \"rentAmount\" TYPE DECIMAL(18, 2)
  USING ROUND(\"rentAmount\"::numeric, 2),
  ALTER COLUMN \"deposit\" TYPE DECIMAL(18, 2)
  USING CASE WHEN \"deposit\" IS NULL THEN NULL ELSE ROUND(\"deposit\"::numeric, 2) END;

ALTER TABLE \"Payment\"
  ALTER COLUMN \"amount\" TYPE DECIMAL(18, 2)
  USING ROUND(\"amount\"::numeric, 2);
"""
migration_path = ROOT / "prisma/migrations/20260729_decimal_money/migration.sql"
migration_path.parent.mkdir(parents=True, exist_ok=True)
migration_path.write_text(migration)
