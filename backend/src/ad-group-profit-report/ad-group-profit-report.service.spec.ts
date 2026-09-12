import { validate } from 'class-validator';
import { CreateAdvertisingCostDto } from '../advertising-cost/dto/create-advertising-cost.dto';
import { AdGroupProfitReportService } from './ad-group-profit-report.service';

const cursor = (rows: any[]) => ({
  sort() { return this; },
  lean: async () => rows,
  toArray: async () => rows,
});

describe('Ad group profit source-spend reconciliation', () => {
  it('deducts source spend from days without completed orders', async () => {
    const aggregateResult = [{
      _id: 'group-1', totalOrders: 1, totalRevenue: 300_000, totalNetProfit: 100_000,
      totalAdsSpent: 100_000, totalProductCost: 100_000, totalShippingFee: 0,
      successOrders: 1, returnOrders: 0, successProfit: 100_000, returnLoss: 0,
      realizedProfit: 100_000, pendingProfit: 0, riskyProfit: 0, ordersByStatus: [],
    }];
    const orderModel = {
      aggregate: async () => aggregateResult,
      db: { collection: (name: string) => name === 'windsor_ads_resources'
        ? { find: () => cursor([{ providerId: 'group-1', name: 'Windsor Group 1' }]) }
        : { aggregate: () => cursor([{ _id: 'group-1', totalAdsSpent: 600_000 }]) } },
    };
    const adGroupModel = { find: () => cursor([]) };
    const service = new AdGroupProfitReportService(orderModel as any, adGroupModel as any, {} as any);

    const [row] = await service.getAdGroupPerformanceReport({
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-08-31T23:59:59Z'),
    });

    expect(row.totalAdsSpent).toBe(600_000);
    expect(row.adGroupName).toBe('Windsor Group 1');
    expect(row.totalNetProfit).toBe(-400_000);
    expect(row.roi).toBeCloseTo(-66.666, 2);
    expect(row.ordersByStatus).toContainEqual(expect.objectContaining({
      status: 'Chi phí quảng cáo chưa phân bổ', profit: -500_000,
    }));
  });

  it('rejects a negative advertising spend at the API boundary', async () => {
    const dto = Object.assign(new CreateAdvertisingCostDto(), {
      adGroupId: 'group-1', spentAmount: -1,
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'spentAmount')).toBe(true);
  });
});
