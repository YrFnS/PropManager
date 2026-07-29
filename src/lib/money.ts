import { Prisma } from '@prisma/client';

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
