import { WindsorAdsCostSyncService, configuredGoogleAdsCostSource } from './windsor-ads-cost-sync.service';

describe('Windsor Google Ads cost source', () => {
  const connectionId = '64b000000000000000000001';
  let connectionModel: any;
  let metricModel: any;
  let costModel: any;
  let readService: any;
  let service: WindsorAdsCostSyncService;
  let catalog: any;
  const previousSource = process.env.ADS_GOOGLE_COST_SOURCE;
  const previousCurrency = process.env.ADS_BASE_CURRENCY;

  beforeEach(() => {
    delete process.env.ADS_GOOGLE_COST_SOURCE;
    delete process.env.ADS_BASE_CURRENCY;
    connectionModel = { find: jest.fn() };
    metricModel = { find: jest.fn() };
    costModel = { find: jest.fn(), bulkWrite: jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 }) };
    readService = { sync: jest.fn().mockResolvedValue({
      runId: 'windsor-google-run-1', status: 'success', dateFrom: '2026-09-05', dateTo: '2026-09-05',
      accountIds: ['1396730688'], counts: { dailyMetrics: 1 }, errors: [],
    }) };
    costModel.db = { startSession: async () => ({ withTransaction: async work => work(), endSession: async () => {} }) };
    catalog = { reconcileSafely: jest.fn().mockResolvedValue({ status: 'success', accounts: 1, groups: 1, conflicts: [] }) };
    service = new WindsorAdsCostSyncService(connectionModel, metricModel, costModel, readService,
      { mark: jest.fn(), flush: jest.fn().mockResolvedValue(true) } as any, catalog);
  });

  afterAll(() => {
    if (previousSource === undefined) delete process.env.ADS_GOOGLE_COST_SOURCE;
    else process.env.ADS_GOOGLE_COST_SOURCE = previousSource;
    if (previousCurrency === undefined) delete process.env.ADS_BASE_CURRENCY;
    else process.env.ADS_BASE_CURRENCY = previousCurrency;
  });

  it('uses Windsor by default and requires an explicit native rollback setting', () => {
    expect(configuredGoogleAdsCostSource()).toBe('windsor');
    process.env.ADS_GOOGLE_COST_SOURCE = 'native';
    expect(configuredGoogleAdsCostSource()).toBe('native');
  });

  it('materializes exact VND metrics with an idempotent advertising-cost key and provenance', async () => {
    metricModel.find.mockReturnValue({ sort: () => ({ lean: async () => [{
      date: '2026-09-05', accountId: '1396730688', campaignId: '1001', adGroupId: '2001',
      campaignName: 'vui trần 1', adGroupName: 'Nhóm tìm kiếm', currency: 'VND', spend: 408312,
      impressions: 268, clicks: 41, conversions: 4, allConversions: 4, conversionValue: 4,
      costPerConversion: 102078, cpc: 9959, cpm: 1523552, fetchedAt: new Date('2026-09-06T01:00:00Z'),
    }] }) });

    const result = await service.syncConnection(connectionId, {}, 'director');

    expect(result.materialization).toMatchObject({ status: 'success', rows: 1, updated: 1, upserted: 1 });
    const operation = costModel.bulkWrite.mock.calls[0][0][0].updateOne;
    expect(operation.filter).toEqual({
      channel: 'google', customerId: '1396730688', adGroupId: '2001', date: new Date('2026-09-05T00:00:00.000Z'),
    });
    expect(operation.update.$set).toMatchObject({
      spentAmount: 408312, sourceSystem: 'windsor', sourceConnectionId: connectionId,
      sourceSyncRunId: 'windsor-google-run-1', campaignId: '1001', currency: 'VND',
    });
    expect(operation.update).not.toHaveProperty('$inc');
    expect(catalog.reconcileSafely).toHaveBeenCalledWith(connectionId);
    expect(result.catalog).toMatchObject({ accounts: 1, groups: 1 });
  });

  it('reports catalog failure without blocking financial cost refresh', async () => {
    catalog.reconcileSafely.mockResolvedValue({ status: 'failed', accounts: 0, groups: 0, conflicts: [] });
    metricModel.find.mockReturnValue({ sort: () => ({ lean: async () => [] }) });
    const result = await service.syncConnection(connectionId, {}, 'director');
    expect(result.catalog.status).toBe('failed');
    expect(result.projections).toEqual([{ day: '2026-09-05', complete: true }]);
  });

  it('blocks a currency mismatch before writing financial data', async () => {
    metricModel.find.mockReturnValue({ sort: () => ({ lean: async () => [{
      date: '2026-09-05', accountId: '1396730688', campaignId: '1001', adGroupId: '2001',
      currency: 'USD', spend: 20,
    }] }) });

    await expect(service.syncConnection(connectionId, {}, 'director')).rejects.toThrow('khác tiền tệ cơ sở VND');
    expect(costModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('does not fall back to native Google when no verified Windsor connection exists', async () => {
    connectionModel.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });

    const result = await service.syncConfiguredForDate('2026-09-05');

    expect(result).toMatchObject({ source: 'windsor', status: 'not_configured', connections: 0, updated: 0 });
    expect(readService.sync).not.toHaveBeenCalled();
  });

  it('does not materialize a failed provider read', async () => {
    readService.sync.mockResolvedValue({
      runId: 'failed-run', status: 'failed', dateFrom: '2026-09-05', dateTo: '2026-09-05', errors: [{ code: 'RATE_LIMITED' }],
    });

    const result = await service.syncConnection(connectionId, {}, 'director');

    expect(result.materialization).toEqual({ status: 'skipped', reason: 'READ_SYNC_FAILED', rows: 0, updated: 0 });
    expect(metricModel.find).not.toHaveBeenCalled();
    expect(costModel.bulkWrite).not.toHaveBeenCalled();
  });
});
