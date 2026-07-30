import { describe, expect, test } from 'bun:test';
import { netCollectedAmount, refundableAmount, refundTotal, statusAfterRefund } from '../src/lib/payment-ledger';

describe('payment adjustment ledger', () => {
  test('keeps the original payment immutable while calculating net cash', () => {
    const payment = {
      amount: '1000.00',
      status: 'partially_refunded',
      adjustments: [{ type: 'refund', amount: '125.50' }],
    };
    expect(refundTotal(payment.adjustments).toFixed(2)).toBe('125.50');
    expect(netCollectedAmount(payment).toFixed(2)).toBe('874.50');
    expect(refundableAmount(payment).toFixed(2)).toBe('874.50');
  });

  test('recognizes a full refund without floating-point drift', () => {
    const payment = {
      amount: '0.30',
      status: 'paid',
      adjustments: [{ type: 'refund', amount: '0.10' }],
    };
    expect(statusAfterRefund(payment, '0.20')).toBe('refunded');
  });

  test('voided and unsettled entries contribute no refundable cash', () => {
    expect(refundableAmount({ amount: '50.00', status: 'pending' }).toFixed(2)).toBe('0.00');
    expect(netCollectedAmount({ amount: '50.00', status: 'voided' }).toFixed(2)).toBe('0.00');
  });
});
