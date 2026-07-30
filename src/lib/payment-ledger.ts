import { Prisma } from '@prisma/client';
import { moneyDecimal, type MoneyValue } from '@/lib/money';

export interface LedgerAdjustment {
  type: string;
  amount: MoneyValue;
}

export interface LedgerPayment {
  amount: MoneyValue;
  status: string;
  adjustments?: LedgerAdjustment[];
}

export const SETTLED_PAYMENT_STATUSES = ['paid', 'partial', 'partially_refunded', 'refunded'] as const;
export const LOCKED_PAYMENT_STATUSES = ['voided', 'partially_refunded', 'refunded'] as const;

export function refundTotal(adjustments: LedgerAdjustment[] | undefined) {
  return (adjustments || []).reduce(
    (total, adjustment) => adjustment.type === 'refund' ? total.plus(moneyDecimal(adjustment.amount)) : total,
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function netCollectedAmount(payment: LedgerPayment) {
  if (payment.status === 'voided') return new Prisma.Decimal(0);
  return Prisma.Decimal.max(
    new Prisma.Decimal(0),
    moneyDecimal(payment.amount).minus(refundTotal(payment.adjustments)),
  ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function refundableAmount(payment: LedgerPayment) {
  if (!SETTLED_PAYMENT_STATUSES.includes(payment.status as (typeof SETTLED_PAYMENT_STATUSES)[number])) {
    return new Prisma.Decimal(0);
  }
  return netCollectedAmount(payment);
}

export function statusAfterRefund(payment: LedgerPayment, refund: MoneyValue) {
  const nextTotal = refundTotal(payment.adjustments).plus(moneyDecimal(refund));
  return nextTotal.greaterThanOrEqualTo(moneyDecimal(payment.amount)) ? 'refunded' : 'partially_refunded';
}
