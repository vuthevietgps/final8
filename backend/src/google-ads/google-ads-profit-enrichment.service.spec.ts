import { GoogleAdsProfitEnrichmentService } from './google-ads-profit-enrichment.service';

function query<T>(value: T) {
  return { lean: () => ({ exec: async () => value }) };
}

describe('GoogleAdsProfitEnrichmentService', () => {
  it('enriches only uniquely mapped account/ad-group metrics and clears ambiguous scopes', async () => {
    const adGroups = [
      { customerId: '111', campaignId: '10', adGroupId: '30' },
      { customerId: '111', campaignId: '20', adGroupId: '40' },
      { customerId: '222', campaignId: '99', adGroupId: '40' },
    ];
    const metrics = [
      { _id: 'm-ag-safe', level: 'ad_group', date: '2026-07-10', customerId: '111', campaignId: '10', adGroupId: '30', costVnd: 100 },
      { _id: 'm-campaign-safe', level: 'campaign', date: '2026-07-10', customerId: '111', campaignId: '10', costVnd: 100 },
      { _id: 'm-ag-ambiguous', level: 'ad_group', date: '2026-07-10', customerId: '111', campaignId: '20', adGroupId: '40', costVnd: 100, erpEnrichedAt: new Date() },
      { _id: 'm-campaign-ambiguous', level: 'campaign', date: '2026-07-10', customerId: '111', campaignId: '20', costVnd: 100, erpEnrichedAt: new Date() },
    ];
    const orders = [
      {
        _id: 'order-safe',
        adGroupId: '30',
        orderDate: new Date('2026-07-10T03:00:00.000Z'),
        depositAmount: 100,
        codAmount: 900,
        manualPayment: 50,
        grossProfit: 600,
        netProfit: 450,
        orderStatus: 'Giao thành công',
      },
      {
        _id: 'order-return',
        adGroupId: '30',
        orderDate: new Date('2026-07-10T04:00:00.000Z'),
        grossProfit: -100,
        netProfit: -150,
        orderStatus: 'Hàng hoàn',
      },
    ];
    const dailyMetricModel = {
      find: jest.fn(() => query(metrics)),
      bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 4 }),
    };
    const service = new GoogleAdsProfitEnrichmentService(
      { find: jest.fn(() => query(adGroups)) } as any,
      dailyMetricModel as any,
      { find: jest.fn(() => query(orders)) } as any,
    );

    const result = await service.enrich({
      customerIds: ['111'],
      dateFrom: '2026-07-10',
      dateTo: '2026-07-10',
    });

    expect(result).toEqual(expect.objectContaining({
      scannedOrders: 2,
      attributedOrders: 2,
      enrichedMetrics: 2,
      clearedUnsafeMetrics: 2,
      updatedMetrics: 4,
      ambiguousAdGroupIds: ['40'],
      providerApiCalled: false,
      adsMutated: false,
    }));
    const operations = dailyMetricModel.bulkWrite.mock.calls[0][0];
    const safeUpdates = operations.filter((operation: any) =>
      ['m-ag-safe', 'm-campaign-safe'].includes(operation.updateOne.filter._id));
    for (const operation of safeUpdates) {
      expect(operation.updateOne).toEqual(expect.objectContaining({
        upsert: false,
        update: {
          $set: expect.objectContaining({
            revenue: 1_050,
            grossProfit: 500,
            netProfit: 300,
            orders: 2,
            returnedOrders: 1,
            cancelledOrders: 0,
            roas: 10.5,
            profitPerSpend: 3,
            erpEnrichedAt: expect.any(Date),
            profitUpdatedAt: expect.any(Date),
          }),
        },
      }));
    }
    const unsafeUpdates = operations.filter((operation: any) =>
      ['m-ag-ambiguous', 'm-campaign-ambiguous'].includes(operation.updateOne.filter._id));
    for (const operation of unsafeUpdates) {
      expect(operation.updateOne.update).toEqual({
        $set: {
          revenue: 0,
          grossProfit: 0,
          netProfit: 0,
          orders: 0,
          cancelledOrders: 0,
          returnedOrders: 0,
        },
        $unset: { erpEnrichedAt: '', profitUpdatedAt: '' },
      });
    }
    expect(JSON.stringify(operations)).not.toContain('order-safe');
  });

  it('does not treat sentinel adGroupId=0 as an attributable order source', async () => {
    const orderModel = { find: jest.fn() };
    const dailyMetricModel = {
      find: jest.fn(() => query([])),
      bulkWrite: jest.fn(),
    };
    const service = new GoogleAdsProfitEnrichmentService(
      { find: jest.fn(() => query([{ customerId: '111', campaignId: '10', adGroupId: '0' }])) } as any,
      dailyMetricModel as any,
      orderModel as any,
    );

    const result = await service.enrich({
      customerIds: ['111'],
      dateFrom: '2026-07-10',
      dateTo: '2026-07-10',
    });

    expect(orderModel.find).not.toHaveBeenCalled();
    expect(result.attributedOrders).toBe(0);
    expect(result.updatedMetrics).toBe(0);
  });
});
