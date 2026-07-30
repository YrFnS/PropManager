import { Prisma } from '@prisma/client';

export type MoneyValue = Prisma.Decimal | number | string | null | undefined;

export function moneyDecimal(value: MoneyValue): Prisma.Decimal {
  if (value === null || value === undefined || value === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneyToNumber(value: MoneyValue): number {
  try {
    return moneyDecimal(value).toNumber();
  } catch {
    return 0;
  }
}

// Compatibility name used by financial APIs and reporting code.
export const moneyNumber = moneyToNumber;

export function moneyEquals(left: MoneyValue, right: MoneyValue): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return left === right;
  }
  return moneyDecimal(left).equals(moneyDecimal(right));
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
