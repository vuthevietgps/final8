import { BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';

describe('FinanceService cashflow transaction boundary', () => {
  const session = {
    withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  function createService() {
    const save = jest.fn().mockResolvedValue({ _id: 'cashflow-1' });
    const cashflowModel: any = jest.fn().mockImplementation((payload) => ({
      ...payload,
      _id: 'cashflow-1',
      save,
    }));
    cashflowModel.exists = jest.fn().mockResolvedValue(null);
    cashflowModel.db = { startSession: jest.fn().mockResolvedValue(session) };

    const service = Object.create(FinanceService.prototype) as FinanceService;
    (service as any).cashflowModel = cashflowModel;
    (service as any).fundingSourceModel = {
      updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    };
    (service as any).eventEmitter = { emit: jest.fn() };
    (service as any).acquireCashflowSerializationLock = jest.fn().mockResolvedValue(undefined);

    return { service, cashflowModel, save };
  }

  beforeEach(() => jest.clearAllMocks());

  it('atomically saves cashflow and funding-source balance with one session', async () => {
    const { service, save } = createService();

    await service.createCashflow({
      idempotencyKey: 'manual-cashflow:test-1',
      direction: 'out',
      sourceType: 'other',
      amount: 10,
      fundingSourceId: '507f1f77bcf86cd799439011',
    });

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect((service as any).acquireCashflowSerializationLock).toHaveBeenCalledWith(session);
    expect(save).toHaveBeenCalledWith({ session });
    expect((service as any).fundingSourceModel.updateOne).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439011' },
      { $inc: { availableBalance: -10 } },
      { session },
    );
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('fails closed before writes without an idempotency key', async () => {
    const { service, save } = createService();

    await expect(service.createCashflow({
      direction: 'out',
      sourceType: 'other',
      amount: 10,
      fundingSourceId: '507f1f77bcf86cd799439011',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  function createDisbursementService(loan: Record<string, any>) {
    const service = Object.create(FinanceService.prototype) as FinanceService;
    const lean = jest.fn().mockResolvedValue({ _id: 'loan-1' });
    const findByIdAndUpdate = jest.fn().mockReturnValue({ lean });
    (service as any).loanModel = {
      db: { startSession: jest.fn().mockResolvedValue(session) },
      findById: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(loan),
      }),
      findByIdAndUpdate,
    };
    (service as any).cashflowModel = { exists: jest.fn().mockResolvedValue(null) };
    (service as any).acquireCashflowSerializationLock = jest.fn().mockResolvedValue(undefined);
    (service as any).createCashflow = jest.fn().mockResolvedValue({ _id: 'cashflow-1' });
    (service as any).eventEmitter = { emit: jest.fn() };
    return { service, findByIdAndUpdate };
  }

  it('rejects cumulative disbursement above loan principal', async () => {
    const { service, findByIdAndUpdate } = createDisbursementService({
      principal: 100,
      disbursedAmount: 90,
      principalRemaining: 70,
    });

    await expect(service.recordDisbursement('loan-1', {
      amount: 20,
      idempotencyKey: 'over-principal',
    })).rejects.toThrow('exceed the loan principal');
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
    expect((service as any).createCashflow).not.toHaveBeenCalled();
  });

  it('increments principal remaining instead of resetting already-paid principal', async () => {
    const { service, findByIdAndUpdate } = createDisbursementService({
      name: 'Loan A',
      principal: 100,
      disbursedAmount: 40,
      principalRemaining: 30,
    });

    await service.recordDisbursement('loan-1', {
      amount: 20,
      idempotencyKey: 'partial-disbursement',
    });

    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      'loan-1',
      expect.objectContaining({
        $set: expect.objectContaining({
          disbursedAmount: 60,
          principalRemaining: 50,
        }),
      }),
      { new: true, session },
    );
  });
});
