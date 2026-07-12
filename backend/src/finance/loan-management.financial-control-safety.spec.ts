import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LoanManagementService } from './loan-management.service';
import { LoanPaymentType, PaymentSource } from './schemas/loan-payment.schema';

describe('LoanManagementService Financial Control safety', () => {
  const loanId = new Types.ObjectId().toHexString();
  const repaymentId = new Types.ObjectId().toHexString();

  function createService(options: {
    dashboard?: any;
    dashboardError?: Error;
    repayment?: any;
  } = {}) {
    const repaymentModel = {
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(options.repayment ?? null),
      })),
    };
    const financialControl = {
      invalidateCache: jest.fn(),
      getDashboard: options.dashboardError
        ? jest.fn().mockRejectedValue(options.dashboardError)
        : jest.fn().mockResolvedValue(options.dashboard),
    };
    const service = new LoanManagementService(
      {} as any,
      repaymentModel as any,
      {} as any,
      {} as any,
      financialControl as any,
      {} as any,
      { acquireCashflowSerializationLock: jest.fn() } as any,
    );
    return { service, repaymentModel, financialControl };
  }

  async function validate(service: LoanManagementService, args: {
    amount: number;
    paymentType: LoanPaymentType;
    repaymentId?: string;
  }) {
    return (service as any).validatePaymentSource(
      loanId,
      PaymentSource.BANK_BALANCE,
      args.amount,
      undefined,
      args.paymentType,
      args.repaymentId,
    );
  }

  it('fails closed when Financial Control is unavailable', async () => {
    const { service } = createService({ dashboardError: new Error('timeout') });

    await expect(validate(service, {
      amount: 10,
      paymentType: LoanPaymentType.PRINCIPAL,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not subtract a committed scheduled repayment twice', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const { service, financialControl } = createService({
      dashboard: {
        bankBalance: 100,
        freeCash: 0,
        config: { CommittedWindowDays: 14 },
      },
      repayment: {
        amountPrincipal: 40,
        amountInterest: 10,
        dueDate,
      },
    });

    await expect(validate(service, {
      amount: 50,
      paymentType: LoanPaymentType.SCHEDULED,
      repaymentId,
    })).resolves.toBeUndefined();
    expect(financialControl.getDashboard).toHaveBeenCalledWith(true);
  });

  it('keeps discretionary payments constrained by free cash', async () => {
    const { service } = createService({
      dashboard: {
        bankBalance: 100,
        freeCash: 20,
        config: { CommittedWindowDays: 14 },
      },
    });

    await expect(validate(service, {
      amount: 50,
      paymentType: LoanPaymentType.PRINCIPAL,
    })).rejects.toThrow('Insufficient Bank Balance');
  });

  it('requires scheduled payment amount to match the unpaid repayment', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const { service } = createService({
      dashboard: {
        bankBalance: 100,
        freeCash: 20,
        config: { CommittedWindowDays: 14 },
      },
      repayment: {
        amountPrincipal: 40,
        amountInterest: 10,
        dueDate,
      },
    });

    await expect(validate(service, {
      amount: 40,
      paymentType: LoanPaymentType.SCHEDULED,
      repaymentId,
    })).rejects.toThrow('Scheduled payment must equal');
  });

  it('aborts every loan ledger write when Owner Fund deduction fails', async () => {
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
      inTransaction: jest.fn().mockReturnValue(true),
    };
    const loan = {
      _id: loanId,
      name: 'Loan A',
      lenderName: 'Bank A',
      status: 'active',
      principalRemaining: 100,
      totalPrincipalPaid: 0,
      totalInterestPaid: 0,
      interestRate: 12,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const loanModel = {
      findById: jest.fn()
        .mockReturnValueOnce(Promise.resolve(loan))
        .mockReturnValueOnce({
          session: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(loan),
        }),
    };
    const repaymentModel = {};
    const paymentSave = jest.fn().mockResolvedValue(undefined);
    const paymentModel: any = jest.fn().mockImplementation((payload) => ({
      ...payload,
      _id: new Types.ObjectId(),
      paymentDate: new Date(),
      save: paymentSave,
    }));
    paymentModel.db = { startSession: jest.fn().mockResolvedValue(session) };
    paymentModel.exists = jest.fn().mockResolvedValue(null);
    const cashflowSave = jest.fn().mockResolvedValue(undefined);
    const cashflowModel: any = jest.fn().mockImplementation((payload) => ({
      ...payload,
      save: cashflowSave,
    }));
    const ownerFund = {
      getFundAccountById: jest.fn().mockResolvedValue({ balance: 100 }),
      deductFromAccount: jest.fn().mockRejectedValue(new Error('deduction failed')),
    };
    const service = new LoanManagementService(
      loanModel as any,
      repaymentModel as any,
      paymentModel,
      cashflowModel,
      { invalidateCache: jest.fn() } as any,
      ownerFund as any,
      { acquireCashflowSerializationLock: jest.fn() } as any,
    );

    await expect(service.createPayment(loanId, {
      idempotencyKey: 'test-owner-deduction-failure',
      amount: 50,
      paymentType: LoanPaymentType.PRINCIPAL,
      source: PaymentSource.OWNER_FUND,
      sourceAccountId: 'owner-account-1',
    }, '507f1f77bcf86cd799439011')).rejects.toThrow('deduction failed');

    expect(paymentSave).toHaveBeenCalledWith({ session });
    expect(loan.save).toHaveBeenCalledWith({ session });
    expect(cashflowSave).toHaveBeenCalledWith({ session });
    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
