import { PERMISSIONS_KEY } from '../auth/decorators/auth.decorator';
import { FinanceController } from './finance.controller';

describe('FinanceController write authorization', () => {
  it.each([
    'createFundingSource',
    'updateFundingSource',
    'createCashflow',
    'captureAvailable',
  ] as const)('requires granular cashflow permission for %s', (method) => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, FinanceController.prototype[method]),
    ).toEqual(['finance.cashflow.manage']);
  });

  it.each([
    'createLoan',
    'updateLoan',
    'createRepayment',
    'recordDisbursement',
    'markRepaymentPaid',
  ] as const)('requires granular loan permission for %s', (method) => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, FinanceController.prototype[method]),
    ).toEqual(['finance.loan.manage']);
  });
});
