import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdGroupManagementService } from './ad-group-management.service';

const period = { from: '2026-08-01', to: '2026-09-05', maturityDays: 7 };

function cursor(rows: any[]) {
  const value: any = {
    limit: jest.fn(() => value),
    toArray: jest.fn(async () => rows),
  };
  return value;
}

function financial(overrides: Record<string, any> = {}) {
  return {
    key: 'AG-1',
    name: 'Nhóm thẻ tập huấn',
    orders: 3,
    quantity: 3,
    revenue: 900_000,
    cogs: 400_000,
    expense: 100_000,
    advertisingCost: 100_000,
    recordedNetProfit: 300_000,
    needsReview: 0,
    cashIn: 900_000,
    customerCashCollected: 900_000,
    cashOut: 500_000,
    receivable: 0,
    payable: 0,
    unallocatedAdvertisingCost: 0,
    ...overrides,
  };
}

function report(group = financial(), quality: Record<string, any> = {}) {
  return {
    adGroups: [group],
    orders: [1, 2, 3].map((index) => ({
      orderId: `ORDER-${index}`,
      orderDay: '2026-08-10',
      adGroupId: 'AG-1',
      orderStatus: 'Hoàn thành',
      adsOnly: false,
    })),
    quality: { ambiguousAdGroupIds: [], ...quality },
  };
}

function harness(reportValue = report()) {
  const collections: Record<string, any[]> = {
    adgroups: [{
      _id: 'ad-group-doc', adGroupId: 'AG-1', name: 'Nhóm thẻ tập huấn',
      platform: 'google', dailyBudget: 150_000, isActive: true,
      productCategoryId: 'category-1', selectedProducts: ['product-1'],
      assignedEmployeeId: 'user-1', agentId: 'user-2', adAccountId: 'account-1',
    }],
    productcategories: [{ _id: 'category-1', name: 'Thẻ tập huấn', code: 'TTH' }],
    products: [{ _id: 'product-1', name: 'Thẻ tập huấn 1 năm', sku: 'TTH-1Y-NCC01' }],
    users: [
      { _id: 'user-1', fullName: 'Nhân viên A' },
      { _id: 'user-2', fullName: 'Công ty' },
    ],
    adaccounts: [{ _id: 'account-1', name: 'Google Ads chính' }],
  };
  const orders: any = {
    db: {
      collection: jest.fn((name: string) => ({
        find: jest.fn(() => cursor(collections[name] || [])),
      })),
    },
  };
  let saved: any = null;
  const reviews: any = {
    find: jest.fn(() => ({ sort: jest.fn(() => ({ lean: async () => [] })) })),
    findOne: jest.fn(() => ({ lean: async () => saved })),
    create: jest.fn(async (value: any) => {
      saved = { _id: new Types.ObjectId().toString(), ...value };
      return saved;
    }),
  };
  const ledger: any = { report: jest.fn(async () => reportValue) };
  return { service: new AdGroupManagementService(ledger, orders, reviews), reviews };
}

describe('Ad group management', () => {
  it('combines product scope, profit, cash and attribution into a scale-safe view', async () => {
    const { service } = harness();
    const result = await service.summary(period);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(expect.objectContaining({
      adGroupId: 'AG-1',
      category: expect.objectContaining({ code: 'TTH' }),
      product: expect.objectContaining({ sku: 'TTH-1Y-NCC01' }),
      canProposeScale: true,
      recommendedAction: expect.stringContaining('đề xuất tăng'),
    }));
    expect(result.rows[0].financial).toEqual(expect.objectContaining({
      revenue: 900_000,
      advertisingCost: 100_000,
      profitAfterAds: 300_000,
      roas: 9,
      cashConversion: 1,
    }));
    expect(result.rows[0].quality).toEqual(expect.objectContaining({
      status: 'profitable', confidence: 100, maturedOrders: 3,
      attributionCoverage: 100,
    }));
    expect(result.quality.automaticExecutionAllowed).toBe(false);
  });

  it('blocks scale proposals when attribution or identity needs review', async () => {
    const group = financial({ unallocatedAdvertisingCost: 40_000, needsReview: 1 });
    const { service } = harness(report(group, { ambiguousAdGroupIds: ['AG-1'] }));
    const result = await service.summary(period);

    expect(result.rows[0].quality.status).toBe('data_issue');
    expect(result.rows[0].quality.confidence).toBe(0);
    expect(result.rows[0].canProposeScale).toBe(false);
    expect(result.quality.unattributedAdvertisingCost).toBe(40_000);
  });

  it.each([0, 200_000, 900_000])('keeps ad effectiveness independent of collected cash %s', async (collected) => {
    const group = financial({ cashIn: collected, customerCashCollected: collected, receivable: 900_000 - collected, payable: 400_000 });
    const { service } = harness(report(group));
    const result = await service.summary(period);
    const paid = await harness().service.summary(period);

    expect(result.rows[0].financial.profitAfterAds).toBe(300_000);
    expect(result.rows[0].quality).toEqual(paid.rows[0].quality);
    expect(result.rows[0].canProposeScale).toBe(true);
    expect(result.rows[0].recommendedAction).toBe(paid.rows[0].recommendedAction);
    expect(result.rows[0].financial.cashConversion).toBe(collected / 900_000);
    expect(result.rows[0].financial.receivable).toBe(900_000 - collected);
    expect(result.rows[0].financial.payable).toBe(400_000);
    expect(result.quality.automaticExecutionAllowed).toBe(false);
  });

  it('estimates marginal profit only after enough daily spend variation', async () => {
    const levels = [
      { spend: 50_000, contribution: 120_000 },
      { spend: 100_000, contribution: 220_000 },
      { spend: 150_000, contribution: 260_000 },
      { spend: 200_000, contribution: 275_000 },
    ];
    const daily = Array.from({ length: 36 }, (_, index) => {
      const level = levels[Math.floor(index / 9)];
      const date = new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10);
      return {
        orderId: `ORDER-DAY-${index}`, orderDay: date, adGroupId: 'AG-1',
        orderStatus: 'Hoàn thành', adsOnly: false, quantity: 1,
        revenue: level.contribution, cogs: 0, expense: 0,
        advertisingCost: level.spend,
        recordedNetProfit: level.contribution - level.spend,
        cashIn: level.contribution, receivable: 0, needsReview: false,
      };
    });
    const totals = daily.reduce((sum: any, day: any) => ({
      revenue: sum.revenue + day.revenue,
      advertisingCost: sum.advertisingCost + day.advertisingCost,
      recordedNetProfit: sum.recordedNetProfit + day.recordedNetProfit,
      cashIn: sum.cashIn + day.cashIn,
    }), { revenue: 0, advertisingCost: 0, recordedNetProfit: 0, cashIn: 0 });
    const group = financial({
      orders: daily.length, quantity: daily.length,
      revenue: totals.revenue, advertisingCost: totals.advertisingCost,
      recordedNetProfit: totals.recordedNetProfit, cashIn: totals.cashIn,
      cogs: 0, expense: 0, cashOut: 0,
    });
    const { service } = harness({
      adGroups: [group], orders: daily,
      quality: { ambiguousAdGroupIds: [] },
    });
    const result = await service.summary(period);
    const marginal = result.rows[0].marginalAnalysis;

    expect(marginal.status).toBe('ready');
    expect(marginal.validSpendDays).toBe(36);
    expect(marginal.bands).toHaveLength(4);
    expect(marginal.optimalDailySpendEstimate).toBe(100_000);
    expect(marginal.optimalSpendRange).toEqual({ min: 100_000, max: 100_000 });
    expect(marginal.marginalProfitPerAdditionalVnd).toBeCloseTo(-0.7);
    expect(result.quality.marginalReadyGroups).toBe(1);

    const pendingCash = await harness({
      adGroups: [financial({ ...group, cashIn: 0, customerCashCollected: 0,
        receivable: totals.revenue, needsReview: daily.length, profitNeedsReview: 0 })],
      orders: daily.map(day => ({ ...day, cashIn: 0, receivable: day.revenue,
        needsReview: true, profitNeedsReview: false })),
      quality: { ambiguousAdGroupIds: [] },
    }).service.summary(period);
    expect(pendingCash.rows[0].quality).toEqual(result.rows[0].quality);
    expect(pendingCash.rows[0].marginalAnalysis).toEqual(marginal);
    expect(pendingCash.rows[0].canProposeScale).toBe(true);
  });

  it('records an idempotent internal review without nesting the previous review', async () => {
    const { service, reviews } = harness();
    const row: any = {
      adGroupId: 'AG-1',
      financial: { revenue: 900_000, profitAfterAds: 300_000 },
      quality: { status: 'profitable', confidence: 90 },
      latestReview: { decision: 'observe', metricsSnapshot: { old: true } },
    };
    jest.spyOn(service, 'summary').mockResolvedValue({ rows: [row] } as any);
    const dto: any = {
      requestKey: 'review-AG-1-20260905',
      periodFrom: period.from,
      periodTo: period.to,
      decision: 'propose_increase',
      rationale: 'Lợi nhuận dương và dữ liệu đủ trưởng thành',
      evidence: 'ROAS 9; lợi nhuận sau quảng cáo 300.000 đồng',
    };
    const actor = new Types.ObjectId().toString();

    const first = await service.createReview('AG-1', dto, actor);
    const second = await service.createReview('AG-1', dto, actor);

    expect(second).toEqual(first);
    expect(reviews.create).toHaveBeenCalledTimes(1);
    expect(first.metricsSnapshot.latestReview).toBeUndefined();
    expect(first.createdBy).toBe(actor);

    await expect(service.createReview('AG-1', { ...dto, rationale: 'Khác' }, actor))
      .rejects.toThrow(ConflictException);
  });
});
