from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise RuntimeError(f"Expected source fragment was not found in {path}: {old!r}")
    target.write_text(text.replace(old, new))


def add_money_import(path: str, anchor: str, names: str = "moneyToNumber") -> None:
    replace(
        path,
        anchor,
        f"{anchor}import {{ {names} }} from '@/lib/money';\n",
    )


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

# Dashboard calculations and responses.
add_money_import(
    "src/app/api/dashboard/route.ts",
    "import { apiError, requestRateLimit } from '@/lib/api';\n",
)
replace(
    "src/app/api/dashboard/route.ts",
    "if (payment.status === 'pending' || payment.status === 'late') return sum + payment.amount;",
    "if (payment.status === 'pending' || payment.status === 'late') return sum + moneyToNumber(payment.amount);",
)
replace(
    "src/app/api/dashboard/route.ts",
    "return sum + Math.max(0, Math.max(payment.lease.rentAmount, payment.amount) - payment.amount);",
    "return sum + Math.max(0, Math.max(moneyToNumber(payment.lease.rentAmount), moneyToNumber(payment.amount)) - moneyToNumber(payment.amount));",
)
replace(
    "src/app/api/dashboard/route.ts",
    "revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + payment.amount);",
    "revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + moneyToNumber(payment.amount));",
)
replace(
    "src/app/api/dashboard/route.ts",
    "revenueByProperty.set(propertyId, (revenueByProperty.get(propertyId) || 0) + payment.amount);",
    "revenueByProperty.set(propertyId, (revenueByProperty.get(propertyId) || 0) + moneyToNumber(payment.amount));",
)
replace(
    "src/app/api/dashboard/route.ts",
    "monthlyRevenue: totalCollected._sum.amount || 0,",
    "monthlyRevenue: moneyToNumber(totalCollected._sum.amount),",
)
replace(
    "src/app/api/dashboard/route.ts",
    "totalCollected: totalCollected._sum.amount || 0,",
    "totalCollected: moneyToNumber(totalCollected._sum.amount),",
)

# Health score collection math.
add_money_import(
    "src/app/api/health-score/route.ts",
    "import { apiError, requestRateLimit } from '@/lib/api';\n",
)
replace(
    "src/app/api/health-score/route.ts",
    "if (payment.status === 'partial') return sum + Math.max(payment.amount, payment.lease.rentAmount);",
    "if (payment.status === 'partial') return sum + Math.max(moneyToNumber(payment.amount), moneyToNumber(payment.lease.rentAmount));",
)
replace(
    "src/app/api/health-score/route.ts",
    "return sum + payment.amount;",
    "return sum + moneyToNumber(payment.amount);",
)
replace(
    "src/app/api/health-score/route.ts",
    "return payment.status === 'paid' || payment.status === 'partial' ? sum + payment.amount : sum;",
    "return payment.status === 'paid' || payment.status === 'partial' ? sum + moneyToNumber(payment.amount) : sum;",
)

# Financial reporting.
add_money_import(
    "src/app/api/reports/route.ts",
    "import { apiError, requestRateLimit } from '@/lib/api';\n",
)
replace(
    "src/app/api/reports/route.ts",
    "const totalRevenue = collectedPayments.reduce((sum, payment) => sum + payment.amount, 0);",
    "const totalRevenue = collectedPayments.reduce((sum, payment) => sum + moneyToNumber(payment.amount), 0);",
)
replace(
    "src/app/api/reports/route.ts",
    "      payment.status === 'partial'\n        ? Math.max(payment.lease.rentAmount, payment.amount)\n        : payment.amount;",
    "      payment.status === 'partial'\n        ? Math.max(moneyToNumber(payment.lease.rentAmount), moneyToNumber(payment.amount))\n        : moneyToNumber(payment.amount);",
)
replace(
    "src/app/api/reports/route.ts",
    ".reduce((sum, payment) => sum + payment.amount, 0);",
    ".reduce((sum, payment) => sum + moneyToNumber(payment.amount), 0);",
)
replace(
    "src/app/api/reports/route.ts",
    "if (payment.status === 'pending' || payment.status === 'late') return sum + payment.amount;",
    "if (payment.status === 'pending' || payment.status === 'late') return sum + moneyToNumber(payment.amount);",
)
replace(
    "src/app/api/reports/route.ts",
    "if (payment.status === 'partial') return sum + Math.max(0, expectedAmount(payment) - payment.amount);",
    "if (payment.status === 'partial') return sum + Math.max(0, expectedAmount(payment) - moneyToNumber(payment.amount));",
)
replace(
    "src/app/api/reports/route.ts",
    "if (trendByMonth.has(key)) trendByMonth.set(key, (trendByMonth.get(key) || 0) + payment.amount);",
    "if (trendByMonth.has(key)) trendByMonth.set(key, (trendByMonth.get(key) || 0) + moneyToNumber(payment.amount));",
)
replace(
    "src/app/api/reports/route.ts",
    "propertyEntry.revenue += payment.amount;",
    "propertyEntry.revenue += moneyToNumber(payment.amount);",
)
replace(
    "src/app/api/reports/route.ts",
    "methodEntry.amount += payment.amount;",
    "methodEntry.amount += moneyToNumber(payment.amount);",
)
replace(
    "src/app/api/reports/route.ts",
    "tenantEntry.totalPaid += payment.amount;",
    "tenantEntry.totalPaid += moneyToNumber(payment.amount);",
)

# Property summaries.
add_money_import(
    "src/app/api/properties/route.ts",
    "import { auditEntry } from '@/lib/audit';\n",
)
replace(
    "src/app/api/properties/route.ts",
    "(sum, unit) => sum + (unit.leases[0]?.rentAmount ?? 0),",
    "(sum, unit) => sum + moneyToNumber(unit.leases[0]?.rentAmount),",
)
add_money_import(
    "src/app/api/properties/[id]/route.ts",
    "import { apiError, requestRateLimit } from '@/lib/api';\n",
)
replace(
    "src/app/api/properties/[id]/route.ts",
    "const totalRent = property.units.reduce((sum, unit) => sum + unit.rentAmount, 0);",
    "const totalRent = property.units.reduce((sum, unit) => sum + moneyToNumber(unit.rentAmount), 0);",
)
replace(
    "src/app/api/properties/[id]/route.ts",
    "(sum, unit) => sum + (unit.leases[0]?.rentAmount ?? 0),",
    "(sum, unit) => sum + moneyToNumber(unit.leases[0]?.rentAmount),",
)

# Lease and payment comparisons plus aggregate response values.
add_money_import(
    "src/app/api/leases/route.ts",
    "import { auditEntry } from '@/lib/audit';\n",
    "moneyEquals, moneyToNumber",
)
replace(
    "src/app/api/leases/route.ts",
    "totalMonthlyRevenue: activeRevenue._sum.rentAmount || 0,",
    "totalMonthlyRevenue: moneyToNumber(activeRevenue._sum.rentAmount),",
)
replace(
    "src/app/api/leases/route.ts",
    "(data.rentAmount !== undefined && data.rentAmount !== existing.rentAmount) ||",
    "(data.rentAmount !== undefined && !moneyEquals(data.rentAmount, existing.rentAmount)) ||",
)
replace(
    "src/app/api/leases/route.ts",
    "(data.deposit !== undefined && data.deposit !== existing.deposit);",
    "(data.deposit !== undefined && !moneyEquals(data.deposit, existing.deposit));",
)
add_money_import(
    "src/app/api/payments/route.ts",
    "import { auditEntry } from '@/lib/audit';\n",
    "moneyEquals, moneyToNumber",
)
replace(
    "src/app/api/payments/route.ts",
    "totalCollected: totalCollected._sum.amount || 0,",
    "totalCollected: moneyToNumber(totalCollected._sum.amount),",
)
replace(
    "src/app/api/payments/route.ts",
    "totalPending: totalPending._sum.amount || 0,",
    "totalPending: moneyToNumber(totalPending._sum.amount),",
)
replace(
    "src/app/api/payments/route.ts",
    "totalLate: totalLate._sum.amount || 0,",
    "totalLate: moneyToNumber(totalLate._sum.amount),",
)
replace(
    "src/app/api/payments/route.ts",
    "const changesSettledAmount = data.amount !== undefined && data.amount !== existing.amount;",
    "const changesSettledAmount = data.amount !== undefined && !moneyEquals(data.amount, existing.amount);",
)

# Formatting boundaries.
add_money_import(
    "src/app/api/notifications/route.ts",
    "import { apiError, requestRateLimit } from '@/lib/api';\n",
)
replace(
    "src/app/api/notifications/route.ts",
    "payment.amount.toLocaleString('ar-IQ')",
    "moneyToNumber(payment.amount).toLocaleString('ar-IQ')",
)
replace(
    "src/app/api/notifications/route.ts",
    "payment.amount.toLocaleString('en-US')",
    "moneyToNumber(payment.amount).toLocaleString('en-US')",
)
add_money_import(
    "src/app/api/search/route.ts",
    "import { sanitizeString } from '@/lib/validation';\n",
)
replace(
    "src/app/api/search/route.ts",
    "item.amount.toLocaleString(isArabic ? 'ar-IQ' : 'en-US')",
    "moneyToNumber(item.amount).toLocaleString(isArabic ? 'ar-IQ' : 'en-US')",
)

# Tenant detail totals.
add_money_import(
    "src/app/api/tenants/[id]/route.ts",
    "import { rateLimit } from '@/lib/validation';\n",
)
replace(
    "src/app/api/tenants/[id]/route.ts",
    ".reduce((sum, p) => sum + p.amount, 0);",
    ".reduce((sum, p) => sum + moneyToNumber(p.amount), 0);",
)

# AI context uses safe numeric formatting at the external-provider boundary.
add_money_import(
    "src/app/api/ai/copilot/route.ts",
    "import ZAI from 'z-ai-web-dev-sdk';\n",
)
replace(
    "src/app/api/ai/copilot/route.ts",
    "const totalRevenue = activeLeases.reduce((sum, l) => sum + l.rentAmount, 0);",
    "const totalRevenue = activeLeases.reduce((sum, l) => sum + moneyToNumber(l.rentAmount), 0);",
)
replace(
    "src/app/api/ai/copilot/route.ts",
    "`- ${l.tenant.name} in ${l.unit.unitNumber} at ${l.unit.property.name}: $${l.rentAmount}/month, ends ${l.endDate.toISOString().split('T')[0]}`",
    "`- ${l.tenant.name} in ${l.unit.unitNumber} at ${l.unit.property.name}: $${moneyToNumber(l.rentAmount).toLocaleString()}/month, ends ${l.endDate.toISOString().split('T')[0]}`",
)
replace(
    "src/app/api/ai/copilot/route.ts",
    ".map((p) => `- ${p.tenant.name}: $${p.amount} (${p.status})`)",
    ".map((p) => `- ${p.tenant.name}: $${moneyToNumber(p.amount).toLocaleString()} (${p.status})`)",
)

# Demo data generation.
replace(
    "prisma/seed.ts",
    "deposit: unit.rentAmount * 2,",
    "deposit: Number(unit.rentAmount) * 2,",
)
replace(
    "src/app/api/settings/seed/route.ts",
    "deposit: unit.rentAmount * 2,",
    "deposit: Number(unit.rentAmount) * 2,",
)
replace(
    "src/app/api/settings/seed/route.ts",
    "amount: lease.rentAmount,",
    "amount: Number(lease.rentAmount),",
)
