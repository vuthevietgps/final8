import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AiOperatorModule } from './ai-operator.module';
import { AiOperatorService } from './ai-operator.service';
import { AiOperatorSessionService } from './ai-operator.session.service';
import { AiOperatorOperationsReader } from './ai-operator.operations-reader';
import { AiOperatorBusinessReader } from './ai-operator.business-reader';
import { AiOperatorAdsReader } from './ai-operator.ads-reader';
import { AiOperatorFinanceReader } from './ai-operator.finance-reader';
import { BudgetAllocationService } from '../finance/budget-allocation.service';
import { TestOrder2 } from '../test-order2/schemas/test-order2.schema';
import { dateRangeMatch, maskPhone } from './ai-operator.snapshot-utils';
import { ForbiddenException } from '@nestjs/common';
import { AiOperatorSession } from './schemas/ai-operator-session.schema';
import { AiOperatorMessage } from './schemas/ai-operator-message.schema';

describe('AI Operator snapshot reader integration', () => {
  let module: TestingModule;
  const readers = [AiOperatorOperationsReader, AiOperatorBusinessReader, AiOperatorAdsReader, AiOperatorFinanceReader];

  beforeEach(async () => {
    const dependencies = new Map<unknown, object>();
    module = await Test.createTestingModule({
      providers: Reflect.getMetadata('providers', AiOperatorModule),
    }).useMocker(token => {
      if (readers.includes(token as any) || token === AiOperatorSessionService) throw new Error('Internal provider missing from module providers');
      if (!dependencies.has(token)) dependencies.set(token, {});
      return dependencies.get(token);
    }).compile();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module.close();
  });

  it('wires real readers through Nest injection without a database or external API', () => {
    expect(module.get(AiOperatorService)).toBeInstanceOf(AiOperatorService);
    expect(module.get(AiOperatorSessionService)).toBeInstanceOf(AiOperatorSessionService);
    for (const reader of readers) expect(module.get(reader)).toBeInstanceOf(reader);
  });

  it('preserves session ownership checks through the existing orchestrator API', async () => {
    const sessionModel = module.get(getModelToken(AiOperatorSession.name));
    const messageModel = module.get(getModelToken(AiOperatorMessage.name));
    sessionModel.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ userId: '507f1f77bcf86cd799439011' }) });
    messageModel.find = jest.fn();

    await expect(module.get(AiOperatorService).getSessionDetail(
      { id: '507f1f77bcf86cd799439012', role: 'unknown-role' },
      '507f1f77bcf86cd799439013',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageModel.find).not.toHaveBeenCalled();
  });

  it('preserves order date fallback, active filtering and snapshot results', async () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-09-07T23:59:59Z');
    const model = module.get(getModelToken(TestOrder2.name));
    const recent = [{ customerName: 'Local fixture' }];
    const chain = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(recent) };
    model.countDocuments = jest.fn().mockResolvedValue(2);
    model.aggregate = jest.fn().mockResolvedValueOnce([{ _id: 'done', count: 2 }]).mockResolvedValueOnce([]);
    model.find = jest.fn().mockReturnValue(chain);

    const snapshot = await module.get(AiOperatorOperationsReader).buildOrderSnapshot(from, to);

    expect(model.countDocuments).toHaveBeenCalledWith({ isActive: { $ne: false }, ...dateRangeMatch(from, to) });
    expect(model.aggregate.mock.calls[0][0][0]).toEqual({ $match: { isActive: { $ne: false }, ...dateRangeMatch(from, to) } });
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(snapshot).toEqual({
      totalInWindow: 2,
      byStatus: [{ _id: 'done', count: 2 }],
      recentOrders: recent,
      pendingPayments: { count: 0, supplierPending: 0, agentPending: 0 },
    });
  });

  it('does not invoke a reader before source permission passes', async () => {
    const service = module.get(AiOperatorService);
    const reader = module.get(AiOperatorOperationsReader);
    const spy = jest.spyOn(reader, 'buildOrderSnapshot');
    const result = await service['safeSourceForAuth']('orders', {
      userId: null, role: null, permissions: [],
    }, () => reader.buildOrderSnapshot(new Date(), new Date()));

    expect(result).toEqual({ ok: false, error: 'permission_denied: orders|orders-test2' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps reader failures inside the existing source error boundary', async () => {
    const service = module.get(AiOperatorService);
    const reader = module.get(AiOperatorOperationsReader);
    jest.spyOn(reader, 'buildOrderSnapshot').mockRejectedValue(new Error('local fixture unavailable'));
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    const result = await service['safeSourceForAuth']('orders', {
      userId: null, role: null, permissions: ['orders'],
    }, () => reader.buildOrderSnapshot(new Date(), new Date()));

    expect(result).toEqual({ ok: false, error: 'local fixture unavailable' });
  });

  it('keeps the public snapshot path behind the source permission gate', async () => {
    const reader = module.get(AiOperatorOperationsReader);
    const spy = jest.spyOn(reader, 'buildOrderSnapshot');

    const snapshot = await module.get(AiOperatorService).getSnapshot(7, { role: 'unknown-role' });

    expect(snapshot.orders).toEqual({ ok: false, error: 'permission_denied: orders|orders-test2' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('retains dry-run mode for budget allocation previews', async () => {
    const budget = module.get(BudgetAllocationService);
    budget.autoAllocateBudget = jest.fn().mockResolvedValue({ totalAvailable: 100, totalAllocated: 0, allocations: [] });

    const result = await module.get(AiOperatorFinanceReader).getBudgetAllocationPreview();

    expect(budget.autoAllocateBudget).toHaveBeenCalledWith({ dryRun: true });
    expect(result.totalAllocated).toBe(0);
  });

  it('retains masked phone output and the legacy order date fallback', () => {
    expect(maskPhone('090-123-4567')).toBe('090***4567');
    expect(maskPhone('1234')).toBe('***');
    expect(maskPhone(null)).toBeNull();
    const date = new Date('2026-09-01T00:00:00Z');
    expect(dateRangeMatch(date, date).$or).toEqual([
      { orderDate: { $gte: date, $lte: date } },
      { orderDate: { $exists: false }, createdAt: { $gte: date, $lte: date } },
      { orderDate: null, createdAt: { $gte: date, $lte: date } },
    ]);
  });
});
