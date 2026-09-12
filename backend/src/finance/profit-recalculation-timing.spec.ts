import { DataCollectionService } from './data-collection.service';
import { FinanceEventListenerService } from './events/finance-event-listener.service';
import { LaborCost1Service } from '../labor-cost1/labor-cost1.service';
import { OrderCronService } from '../test-order2/services/order-cron.service';
import { TestOrder2Service } from '../test-order2/test-order2.service';
import { AdvertisingCostRecalculationQueueService } from '../advertising-cost/advertising-cost.recalculation-queue.service';

const silentLogger = () => ({ log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() });

describe('Profit recalculation timing in the Vietnam business calendar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    ['2026-09-06T06:00:00+07:00', '2026-09-05'],
    ['2026-10-01T06:00:00+07:00', '2026-09-30'],
    ['2027-01-01T06:00:00+07:00', '2026-12-31'],
    ['2028-03-01T06:00:00+07:00', '2028-02-29'],
  ])('syncs, recalculates and snapshots the same preceding day at %s', async (now, day) => {
    jest.setSystemTime(new Date(now));
    const operations: string[] = [];
    const providers = ['facebook', 'google', 'tiktok'].map(name => ({
      syncForDate: jest.fn(async (date: string) => {
        operations.push(`${name}:${date}`);
        return { updated: 1 };
      }),
    }));
    const calculation = { recalculateOrdersForDate: jest.fn(async (date: string) => {
      operations.push(`calculate:${date}`);
      return { date, updated: 2 };
    }) };
    const reports = { syncFromOrderTest2: jest.fn(async (date: string) => {
      operations.push(`report:${date}`);
      return { date, recordsProcessed: 1 };
    }) };
    const windsor = { syncConfiguredForDate: jest.fn(async (date: string) => {
      operations.push(`windsor:${date}`);
      return { updated: 1 };
    }) };
    const service = new DataCollectionService(
      providers[0] as any, providers[1] as any, providers[2] as any, calculation as any, reports as any, windsor as any,
    );
    Object.assign(service, { logger: silentLogger(), syncReceivables: jest.fn(),
      syncPayables: jest.fn(), updateDailyReports: jest.fn() });

    await service.runDataCollection();

    expect(operations).toEqual([
      `facebook:${day}`, `windsor:${day}`, `tiktok:${day}`, `calculate:${day}`, `report:${day}`,
    ]);
    expect(providers[1].syncForDate).not.toHaveBeenCalled();
  });

  it('generates labor costs at 00:30 for the preceding Vietnam day', async () => {
    jest.setSystemTime(new Date('2026-09-06T00:30:00+07:00'));
    const service = new LaborCost1Service({} as any, {} as any, {} as any, {} as any, {} as any);
    Object.assign(service, { logger: silentLogger() });
    const generate = jest.spyOn(service, 'generateFromSessionLogs').mockResolvedValue({ created: 0, total: 0 });

    await service.autoGenerateLaborCostFromSessions();

    expect(generate).toHaveBeenCalledWith(undefined, '2026-09-05');
  });

  it('uses the same preceding day for manual fallback recalculation', async () => {
    jest.setSystemTime(new Date('2026-09-06T00:30:00+07:00'));
    const calculation = { recalculateOrdersForDate: jest.fn().mockResolvedValue({ updated: 0, date: '2026-09-05' }) };
    const service = new OrderCronService(calculation as any);
    Object.assign(service, { logger: silentLogger() });

    await service.recalculateYesterdayCosts();

    expect(calculation.recalculateOrdersForDate).toHaveBeenCalledWith('2026-09-05');
  });

  const listenerFixture = () => {
    const queue = { scheduleRecalculation: jest.fn() };
    const service = new FinanceEventListenerService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, queue as any,
    );
    Object.assign(service, { logger: silentLogger(), invalidateFinanceCaches: jest.fn(),
      queueAgentSnapshotRefresh: jest.fn(), queueSupplierSnapshotRefresh: jest.fn() });
    return { service, queue };
  };

  it('recalculates a retroactive order against its Vietnam day, including the early morning', () => {
    jest.setSystemTime(new Date('2026-09-06T10:00:00+07:00'));
    const { service, queue } = listenerFixture();

    service.onOrderCompleted({ orderId: 'order', orderDate: new Date('2026-09-05T00:30:00+07:00') });

    expect(queue.scheduleRecalculation).toHaveBeenCalledWith('2026-09-05', 'retroactive-order-change');
  });

  it('does not treat an early morning order today as a retroactive change', () => {
    jest.setSystemTime(new Date('2026-09-06T10:00:00+07:00'));
    const { service, queue } = listenerFixture();

    service.onOrderCompleted({ orderId: 'order', orderDate: new Date('2026-09-06T00:30:00+07:00') });

    expect(queue.scheduleRecalculation).not.toHaveBeenCalled();
  });

  it('refreshes both Vietnam days when an order moves between dates', async () => {
    const service: any = Object.create(TestOrder2Service.prototype);
    service.calculationService = { recalculateOrdersForDate: jest.fn().mockResolvedValue({ updated: 0 }) };
    await service.refreshOrderAllocationsForDates([
      new Date('2026-09-05T00:30:00+07:00'), new Date('2026-09-06T00:30:00+07:00'), '2026-09-06',
    ]);
    expect(service.calculationService.recalculateOrdersForDate.mock.calls).toEqual([
      ['2026-09-05'], ['2026-09-06'],
    ]);
  });

  it('batches repeated advertising updates until the debounce window after the last update', async () => {
    const previous = process.env.ADS_RECALCULATE_DEBOUNCE_MS;
    process.env.ADS_RECALCULATE_DEBOUNCE_MS = String(20 * 60 * 1000);
    const calculation = { recalculateOrdersForDate: jest.fn().mockResolvedValue({ updated: 2 }) };
    const queue = new AdvertisingCostRecalculationQueueService(calculation as any);
    Object.assign(queue, { logger: silentLogger() });
    try {
      queue.scheduleRecalculation('2026-09-05', 'facebook-cron');
      await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
      queue.scheduleRecalculation('2026-09-05', 'google-cron');
      await jest.advanceTimersByTimeAsync(20 * 60 * 1000 - 1);
      expect(calculation.recalculateOrdersForDate).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(calculation.recalculateOrdersForDate).toHaveBeenCalledTimes(1);
      expect(calculation.recalculateOrdersForDate).toHaveBeenCalledWith('2026-09-05');
    } finally {
      queue.onModuleDestroy();
      if (previous === undefined) delete process.env.ADS_RECALCULATE_DEBOUNCE_MS;
      else process.env.ADS_RECALCULATE_DEBOUNCE_MS = previous;
    }
  });
});
