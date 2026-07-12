import { FinanceService } from './finance.service';

describe('FinanceService master bank loan source reconciliation', () => {
  const reconcile = (
    contractTotalPaid: number,
    totalRecordedPayments: number,
    bankRecordedPayments: number,
  ) => {
    const service = Object.create(FinanceService.prototype) as FinanceService;
    return (service as any).reconcileBankFundedLoanPaid(
      contractTotalPaid,
      totalRecordedPayments,
      bankRecordedPayments,
    );
  };

  it('does not subtract an audited Owner Fund payment from bank balance', () => {
    expect(reconcile(1_000_000, 1_000_000, 0)).toBe(0);
  });

  it('subtracts only the audited bank-funded portion', () => {
    expect(reconcile(1_000_000, 1_000_000, 400_000)).toBe(400_000);
  });

  it('treats historical payments without source audit as bank-funded conservatively', () => {
    expect(reconcile(1_000_000, 600_000, 200_000)).toBe(600_000);
  });
});
