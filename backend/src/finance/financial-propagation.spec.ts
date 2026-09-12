import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderCalculationService } from '../test-order2/services/order-calculation.service';
import { AdGroupDailyReportService } from './ad-group-daily-report.service';
import { AdsCostProjectionService } from './ads-cost-projection.service';
import { ORDER_COST_ALLOCATED } from '../advertising-cost/advertising-cost-refresh.module';

describe('financial propagation after source changes', () => {
  it('updates allocated, net and realized profit for increases, decreases and zero, awaiting downstream projections', async () => {
    let spend = 100;
    const orders: any[] = [
      { _id: '1', adGroupId: 'g', quantity: 1, grossProfit: 1000, realizedGrossProfit: 900 },
      { _id: '2', adGroupId: 'g', quantity: 3, grossProfit: 3000 },
    ];
    const writes: any[] = [];
    const model: any = {
      find: () => ({ select: () => ({ lean: async () => orders }) }),
      aggregate: () => ({ exec: async () => [{ totalQuantity: 4 }] }),
      db: { collection: name => ({ aggregate: () => ({ toArray: async () => name === 'advertisingcosts'
        ? [{ _id: 'g', totalCost: spend, estimatedRows: spend === 100 ? 1 : 0 }] : [] }) }) },
      bulkWrite: async operations => { writes.push(operations); operations.forEach(op => Object.assign(orders.find(o => o._id === op.updateOne.filter._id), op.updateOne.update.$set)); },
    };
    const events = new EventEmitter2();
    const projection = jest.fn(async () => { expect(orders[0].netProfit).toBe(1000 - Math.round(spend / 4)); });
    events.on(ORDER_COST_ALLOCATED, projection);
    const service = new OrderCalculationService(model, {} as any, {} as any, {} as any, {} as any, { set: jest.fn() } as any, events);
    for (const amount of [100, 200, 40, 0, 0]) {
      spend = amount;
      await service.recalculateOrdersForDate('2026-09-05');
      expect(orders.reduce((sum, order) => sum + order.advertisingCost, 0)).toBe(spend);
      expect(orders[0].realizedNetProfit).toBe(900 - spend / 4);
      expect(orders[1]).not.toHaveProperty('realizedNetProfit');
      expect(orders[0].advertisingCostEstimated).toBe(spend === 100);
    }
    expect(projection).toHaveBeenCalledTimes(5);
    expect(writes).toHaveLength(5);
  });

  it('refreshes reports even on a day with advertising spend but no orders, and surfaces downstream failure', async () => {
    const events = new EventEmitter2();
    const projection = jest.fn().mockRejectedValue(new Error('projection unavailable'));
    events.on(ORDER_COST_ALLOCATED, projection);
    const service = new OrderCalculationService({ find: () => ({ select: () => ({ lean: async () => [] }) }) } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, events);
    await expect(service.recalculateOrdersForDate('2026-09-05')).rejects.toThrow('projection unavailable');
    expect(projection).toHaveBeenCalledWith({ day: '2026-09-05' });
  });

  it('applies only the delta to the original capital snapshot and reverses the full amount when cost becomes zero', async () => {
    let tracking: any;
    let used = 500; // Already used by unrelated days.
    const session = { withTransaction: async work => work(), endSession: jest.fn() };
    const query = value => ({ sort: () => query(value), session: () => query(value), lean: async () => value });
    const snapshots: any = {
      db: { startSession: async () => session },
      findOne: jest.fn(() => query({ _id: 'original' })),
      findById: jest.fn(id => query({ _id: id })),
      updateOne: jest.fn(async (filter, update, options) => {
        expect(filter._id).toBe('original'); expect(options.session).toBe(session);
        used += update.$inc.reinvestmentUsed;
      }),
    };
    const spendings: any = { findOne: () => query(tracking), updateOne: async (key, update, options) => {
      expect(options.session).toBe(session); tracking = { ...key, ...update.$set };
    } };
    const reports: any = { find: () => query([]) };
    const service: any = new AdGroupDailyReportService({} as any, {} as any, {} as any, reports, snapshots, spendings);
    for (const amount of [100, 150, 150, 30, 0, 0]) {
      await service.updateReinvestmentUsed('2026-09-05', amount);
      expect(used).toBe(500 + amount);
      expect(tracking.totalAdsCost).toBe(amount);
    }
    expect(snapshots.findOne).toHaveBeenCalledTimes(1);
    expect(snapshots.findById).toHaveBeenCalledTimes(5);
    expect(session.endSession).toHaveBeenCalledTimes(6);
  });

  it('queues both old/new dates in Vietnam and revalues affected product days before allocation', async () => {
    const log: string[] = [];
    const order: any = { isModified: () => true, save: async () => log.push('saved') };
    const model: any = { distinct: jest.fn().mockResolvedValue([new Date('2026-09-04T17:30:00Z')]),
      find: () => ({ cursor: async function* () { yield order; } }) };
    const calc: any = { clearStatusCaches: jest.fn(), autoCalculateQuoteFields: async () => log.push('inputs'),
      recalculateOrdersForDate: async () => log.push('allocated') };
    const queue: any = { mark: jest.fn(), flush: jest.fn() };
    const cache: any = { invalidateCache: jest.fn(), invalidateMasterBankBalanceCache: jest.fn() };
    const service = new AdsCostProjectionService(calc, {} as any, cache, cache, cache, model, queue, {} as any);
    await service.inputsChanged({ productIds: ['64b000000000000000000001'],
      dates: ['2026-09-04', new Date('2026-09-05T18:00:00Z')] });
    expect(queue.mark).toHaveBeenCalledWith(['2026-09-04', '2026-09-06', '2026-09-05'], undefined, true);
    await service.refresh({ day: '2026-09-05', revalue: true });
    expect(log).toEqual(['inputs', 'saved', 'allocated']);
  });

  it('invalidates caches after a failed financial projection so retry cannot serve old cached totals', async () => {
    const cache: any = { invalidateCache: jest.fn(), invalidateMasterBankBalanceCache: jest.fn() };
    const service = new AdsCostProjectionService({} as any, { syncFromOrderTest2: async () => { throw new Error('failed'); } } as any,
      cache, cache, cache, {} as any, {} as any, {} as any);
    await expect(service.afterAllocation({ day: '2026-09-05' })).rejects.toThrow('failed');
    expect(cache.invalidateMasterBankBalanceCache).toHaveBeenCalled();
    expect(cache.invalidateCache).toHaveBeenCalledTimes(2);
  });
});
