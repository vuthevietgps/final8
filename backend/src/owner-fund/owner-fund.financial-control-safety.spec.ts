import { BadRequestException } from '@nestjs/common';
import { FinanceEvents } from '../finance/events/finance-events.constants';
import { OwnerFundService } from './owner-fund.service';

describe('OwnerFundService Financial Control safety', () => {
  const actorId = '507f1f77bcf86cd799439011';
  const session = {
    withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
    endSession: jest.fn(async () => undefined),
  };
  const account = { _id: 'account-1', balance: 20, save: jest.fn() };
  const query = (value: any) => ({
    session: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  });

  function createService(overrides: Record<string, any> = {}) {
    const fundTransactionSave = jest.fn().mockResolvedValue(undefined);
    const fundTransactionModel: any = jest.fn().mockImplementation((payload) => ({
      ...payload,
      _id: 'transaction-1',
      save: fundTransactionSave,
    }));
    fundTransactionModel.exists = jest.fn().mockResolvedValue(null);
    const fundAccountModel: any = {
      db: { startSession: jest.fn().mockResolvedValue(session) },
      findOne: jest.fn(() => query(account)),
      findOneAndUpdate: jest.fn(() => query(account)),
      findByIdAndUpdate: jest.fn(() => query({ ...account, balance: 70 })),
    };
    const financialControl = {
      invalidateCache: jest.fn(),
      getDashboard: jest.fn().mockResolvedValue({
        ownerWithdrawable: 100,
        dataQuality: { isDecisionLocked: false },
      }),
    };
    const financeService = {
      invalidateMasterBankBalanceCache: jest.fn().mockResolvedValue(undefined),
      acquireCashflowSerializationLock: jest.fn().mockResolvedValue(undefined),
      hasCashflowIdempotencyKey: jest.fn().mockResolvedValue(false),
      createCashflow: jest.fn().mockResolvedValue({ _id: 'cashflow-1' }),
    };
    const eventEmitter = { emit: jest.fn() };

    const service = new OwnerFundService(
      {} as any,
      {} as any,
      fundTransactionModel,
      fundAccountModel,
      overrides.financialControl || financialControl,
      overrides.financeService || financeService,
      eventEmitter as any,
    );

    return {
      service,
      financialControl: overrides.financialControl || financialControl,
      financeService: overrides.financeService || financeService,
      fundAccountModel,
      fundTransactionModel,
      fundTransactionSave,
      eventEmitter,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    session.withTransaction.mockImplementation(async (callback: () => Promise<void>) => callback());
  });

  it('fails closed before writes when Financial Control cannot be read', async () => {
    const financialControl = {
      invalidateCache: jest.fn(),
      getDashboard: jest.fn().mockRejectedValue(new Error('FC unavailable')),
    };
    const context = createService({ financialControl });

    await expect(
      context.service.transferToOwnerFund({ amount: 50, idempotencyKey: 'fc-read-failure' } as any, actorId),
    ).rejects.toThrow('Financial Control is unavailable');

    expect(context.financeService.createCashflow).not.toHaveBeenCalled();
    expect(context.fundAccountModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(context.eventEmitter.emit).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('serializes, re-checks, and commits all ledgers in one Mongo session', async () => {
    const context = createService();

    const result = await context.service.transferToOwnerFund(
      { amount: 50, idempotencyKey: 'successful-transfer' } as any,
      actorId,
    );

    expect(context.fundAccountModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: account._id },
      { $inc: { transferVersion: 1 } },
      { new: true, session },
    );
    expect(context.financialControl.getDashboard).toHaveBeenCalledWith(true);
    expect(context.financeService.acquireCashflowSerializationLock).toHaveBeenCalledWith(session);
    expect(context.financeService.createCashflow).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, category: 'owner_fund_transfer' }),
      { session, emitEvent: false },
    );
    expect(context.fundTransactionSave).toHaveBeenCalledWith({ session });
    expect(context.eventEmitter.emit).toHaveBeenCalledWith(
      FinanceEvents.FINANCE_STATE_CHANGED,
      expect.objectContaining({ source: 'owner_fund.transfer_in' }),
    );
    expect(result.newFundBalance).toBe(70);
  });

  it('rejects a locked Financial Control decision without financial writes', async () => {
    const financialControl = {
      invalidateCache: jest.fn(),
      getDashboard: jest.fn().mockResolvedValue({
        ownerWithdrawable: 100,
        dataQuality: { isDecisionLocked: true },
      }),
    };
    const context = createService({ financialControl });

    await expect(
      context.service.transferToOwnerFund({ amount: 50, idempotencyKey: 'locked-decision' } as any, actorId),
    ).rejects.toThrow('safe Owner withdrawal limit');
    expect(context.financeService.createCashflow).not.toHaveBeenCalled();
  });

  it('commits Owner-to-bank cashflow, balance, and ledger in one session', async () => {
    const context = createService();

    await context.service.transferFromOwnerFund(
      { amount: 10, idempotencyKey: 'owner-return' } as any,
      actorId,
    );

    expect(context.financeService.acquireCashflowSerializationLock).toHaveBeenCalledWith(session);
    expect(context.financeService.createCashflow).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10,
        category: 'owner_fund_return',
        idempotencyKey: 'owner-transfer-out:owner-return',
      }),
      { session, emitEvent: false },
    );
    expect(context.fundAccountModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: account._id, balance: { $gte: 10 } },
      { $inc: { balance: -10, totalReturnedToCompany: 10 } },
      { new: true, session },
    );
    expect(context.fundTransactionSave).toHaveBeenCalledWith({ session });
  });

  it('commits personal withdrawal balance and ledger in one session', async () => {
    const context = createService();

    await context.service.ownerWithdrawFromFund(
      { amount: 10, idempotencyKey: 'personal-withdrawal' } as any,
      actorId,
    );

    expect(context.fundAccountModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: account._id, balance: { $gte: 10 } },
      { $inc: { balance: -10, totalWithdrawn: 10 } },
      { new: true, session },
    );
    expect(context.fundTransactionSave).toHaveBeenCalledWith({ session });
  });
});
