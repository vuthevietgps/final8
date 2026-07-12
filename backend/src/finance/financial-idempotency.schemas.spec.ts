import { CashflowEntrySchema } from './schemas/cashflow-entry.schema';
import { LoanPaymentSchema } from './schemas/loan-payment.schema';
import { FundTransactionSchema } from '../owner-fund/schemas/fund-transaction.schema';
import { OwnerFundAccountSchema } from '../owner-fund/schemas/owner-fund-account.schema';

describe('financial ledger idempotency indexes', () => {
  const hasIndex = (
    indexes: Array<[Record<string, number>, Record<string, any>]>,
    key: Record<string, number>,
    partialFilterExpression: Record<string, any>,
  ) => indexes.some(([actualKey, options]) => (
    JSON.stringify(actualKey) === JSON.stringify(key)
    && options.unique === true
    && JSON.stringify(options.partialFilterExpression) === JSON.stringify(partialFilterExpression)
  ));

  it('enforces one processing result per cashflow and fund transaction key', () => {
    expect(hasIndex(
      CashflowEntrySchema.indexes() as any,
      { idempotencyKey: 1 },
      { idempotencyKey: { $type: 'string' } },
    )).toBe(true);
    expect(hasIndex(
      FundTransactionSchema.indexes() as any,
      { idempotencyKey: 1 },
      { idempotencyKey: { $type: 'string' } },
    )).toBe(true);
  });

  it('prevents duplicate loan-payment retries and duplicate scheduled repayment payment', () => {
    expect(hasIndex(
      LoanPaymentSchema.indexes() as any,
      { idempotencyKey: 1 },
      { idempotencyKey: { $type: 'string' } },
    )).toBe(true);
    expect(hasIndex(
      LoanPaymentSchema.indexes() as any,
      { repaymentId: 1 },
      { repaymentId: { $type: 'objectId' } },
    )).toBe(true);
  });

  it('allows historical accounts but only one active Owner Fund balance', () => {
    expect(hasIndex(
      OwnerFundAccountSchema.indexes() as any,
      { isActive: 1 },
      { isActive: true },
    )).toBe(true);
  });
});
