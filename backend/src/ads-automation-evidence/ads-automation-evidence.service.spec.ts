import { AdsAutomationEvidenceService } from './ads-automation-evidence.service';

function leanQuery<T>(value: T) {
  return { lean: () => ({ exec: async () => value }) };
}

function sortedLeanQuery<T>(value: T) {
  return {
    sort: () => ({
      limit: () => leanQuery(value),
      ...leanQuery(value),
    }),
  };
}

function trackedQueryHarness(delayMs = 2) {
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  return {
    async run<T>(value: T): Promise<T> {
      active += 1;
      calls += 1;
      maxActive = Math.max(maxActive, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return value;
      } finally {
        active -= 1;
      }
    },
    stats: () => ({ active, maxActive, calls }),
  };
}

function trackedLeanQuery<T>(value: T, tracker: ReturnType<typeof trackedQueryHarness>) {
  return { lean: () => ({ exec: () => tracker.run(value) }) };
}

function trackedSortedLeanQuery<T>(value: T, tracker: ReturnType<typeof trackedQueryHarness>) {
  return {
    sort: () => ({
      limit: () => trackedLeanQuery(value, tracker),
      ...trackedLeanQuery(value, tracker),
    }),
  };
}

describe('AdsAutomationEvidenceService attribution identity', () => {
  const productId = '64b64b64b64b64b64b64b64b';
  const missingProductId = '64b64b64b64b64b64b64b64c';
  const legacyId = '64b64b64b64b64b64b64b64d';

  function service(models: Partial<Record<string, any>> = {}) {
    return new AdsAutomationEvidenceService(
      models.adGroup || {},
      models.adAccount || {},
      models.managerAccount || {},
      models.googleAdGroup || {},
      models.googleCampaign || {},
      models.googleBudget || {},
      models.actionPlan || {},
      models.product || {},
      models.order || {},
      models.report || {},
      models.advertisingCost || {},
      models.inventory || {},
      models.supplierQuote || {},
      models.supplierPayable || {},
      models.availableFund || {},
      models.budgetBucket || {},
      models.emergency || {},
    ) as any;
  }

  it('resolves internalAdGroupId by ERP _id and preserves same provider ID in different account scopes', async () => {
    const googleRows = [
      { customerId: '111', campaignId: '10', adGroupId: '30', internalAdGroupId: legacyId },
      { customerId: '222', campaignId: '20', adGroupId: '30' },
    ];
    const legacyRows = [
      { _id: legacyId, adGroupId: 'legacy-provider-id', platform: 'google', selectedProducts: [productId], adAccountId: 'account-1' },
      { _id: '64b64b64b64b64b64b64b64e', adGroupId: '30', platform: 'facebook', adAccountId: 'account-2' },
      { _id: '64b64b64b64b64b64b64b64f', adGroupId: '0', platform: 'google', adAccountId: 'account-3' },
    ];
    const campaigns = new Map([
      ['111:10', { customerId: '111', campaignId: '10', campaignBudgetId: '101' }],
      ['222:20', { customerId: '222', campaignId: '20', campaignBudgetId: '202' }],
    ]);

    const subject = service({
      googleAdGroup: { find: jest.fn(() => sortedLeanQuery(googleRows)) },
      adGroup: { find: jest.fn(() => sortedLeanQuery(legacyRows)) },
      adAccount: {
        find: jest.fn(() => leanQuery([
          { _id: 'account-1', accountId: '111', accountType: 'google', loginCustomerId: '999-888' },
        ])),
      },
      managerAccount: {
        find: jest.fn(() => leanQuery([
          { provider: 'google', managerAccountId: '999888', childAccountIds: ['111'] },
        ])),
      },
      googleCampaign: {
        find: jest.fn(() => leanQuery([...campaigns.values()])),
      },
      googleBudget: {
        find: jest.fn(() => leanQuery([
          { customerId: '111', campaignBudgetId: '101' },
          { customerId: '222', campaignBudgetId: '202' },
        ])),
      },
    });

    const candidates = await (subject as any).loadCandidates(20);

    expect(candidates).toHaveLength(3);
    expect(candidates.filter((item: any) => item.adGroupId === '30')).toHaveLength(3);
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        childAccountId: '111',
        managerAccountId: '999888',
        erpAdGroupId: legacyId,
        productIds: [productId],
        campaignBudgetId: '101',
      }),
      expect.objectContaining({ childAccountId: '222', campaignBudgetId: '202' }),
      expect.objectContaining({ platform: 'meta_ads', erpAdGroupId: '64b64b64b64b64b64b64b64e' }),
    ]));
    expect(candidates.some((item: any) => item.adGroupId === '0')).toBe(false);
  });

  it('uses product fallback only for unattributed orders and verifies product existence', async () => {
    const now = new Date('2026-07-10T10:00:00.000Z');
    const fallbackOrder = {
      _id: 'order-1',
      adGroupId: '0',
      productId,
      orderDate: now,
      codAmount: 500_000,
      grossProfit: 250_000,
      netProfit: 100_000,
    };
    const subject = service({
      product: { find: jest.fn(() => leanQuery([{ _id: productId, suppliers: [] }])) },
    });

    const result = await (subject as any).buildAdGroupEvidence({
      platform: 'google_ads',
      childAccountId: '111',
      campaignId: '10',
      campaignBudgetId: '101',
      adGroupId: '30',
      productIds: [productId, missingProductId],
    }, {
      now,
      lookbackDays: 30,
      safety: {
        googleAdsProductionEnabled: false,
        providerExecutionEnabled: false,
        dryRun: true,
      },
      killSwitchActive: false,
      shared: {
        productsById: new Map([[productId, { _id: productId, suppliers: [] }]]),
        inventoryByProductId: new Map(),
        supplierQuotesByProductId: new Map(),
        ordersByCandidateKey: new Map([['google_ads::111:10:30', [fallbackOrder]]]),
        latestReportByCandidateKey: new Map(),
        spendByCandidateKey: new Map(),
        supplierPayablesByCandidateKey: new Map(),
        latestActionPlanByCandidateKey: new Map(),
        latestAvailableFund: null,
        activeBudgetBuckets: [],
      },
      attribution: { adGroupIdUnique: true, uniqueProductIds: [productId] },
    });

    expect(result.productIds).toEqual([productId]);
    expect(result.commerceEvidence.orders).toBe(1);
    expect(result.mappingHealth.status).toBe('partial');
    expect(result.mappingHealth.confidence).toBe('low');
  });

  it('applies only global/matching budget buckets and uses the strictest positive cap', () => {
    const now = new Date('2026-07-10T10:00:00.000Z');
    const subject = service();

    const finance = (subject as any).financeEvidence({
      latestAvailableFund: { available: 50_000_000, capturedAt: now },
      activeBudgetBuckets: [
        { _id: 'global', productGroupIds: [], dailyCap: 1_000_000, monthlyCap: 20_000_000 },
        { _id: 'matching', productGroupIds: ['group-a'], dailyCap: 800_000, monthlyCap: 15_000_000 },
        { _id: 'unrelated', productGroupIds: ['group-b'], dailyCap: 100_000, monthlyCap: 1_000_000 },
        { _id: 'zero', productGroupIds: ['group-a'], dailyCap: 0, monthlyCap: 0 },
      ],
      productGroupIds: ['group-a'],
      dailySpend: 300_000,
      monthlySpend: 10_000_000,
      netProfitAfterAds: 1_000_000,
      now,
    });

    expect(finance.dailyCap).toBe(800_000);
    expect(finance.monthlyCap).toBe(15_000_000);
    expect(finance.cappedBudgetIncrease).toBe(500_000);
    expect(finance.dataFreshness).toBe('fresh');
  });

  it('evaluates only the candidate action item and requires real import/approval audit metadata', () => {
    const subject = service();
    const safety = {
      googleAdsProductionEnabled: true,
      providerExecutionEnabled: true,
      dryRun: false,
    };
    const candidate = {
      platform: 'google_ads',
      childAccountId: '111',
      adGroupId: '30',
      productIds: [productId],
    };
    const plan: any = {
      planId: 'PLAN-1',
      sourceExportId: 'EXP-1',
      originalZipSha256: 'hash-1',
      manifest: { exportId: 'EXP-1' },
      status: 'approved',
      providerValidationStatus: 'passed',
      items: [
        {
          actionId: 'TARGET',
          customerId: '111',
          typedPayload: { adGroupId: '30', beforeState: { budget: 100 } },
          idempotencyKey: 'target-key',
          status: 'pending',
          providerValidationStatus: 'pending',
        },
        {
          actionId: 'OTHER',
          customerId: '222',
          typedPayload: { adGroupId: '99', beforeState: { budget: 100 } },
          idempotencyKey: 'other-key',
          status: 'approved',
          providerValidationStatus: 'provider_validate_passed',
          approvedAt: new Date(),
          approvedBy: 'Director',
          approvalHistory: [{ decision: 'approved', at: new Date() }],
        },
      ],
    };

    const pendingGate = (subject as any).adsGateEvidence(safety, false, plan, candidate);
    expect(pendingGate.providerValidateOnlyPassed).toBe(false);
    expect(pendingGate.approved).toBe(false);
    expect(pendingGate.idempotencyReady).toBe(true);
    expect(pendingGate.auditReady).toBe(true);

    plan.items[0] = {
      ...plan.items[0],
      status: 'approved',
      providerValidationStatus: 'provider_validate_passed',
      approvedAt: new Date(),
      approvedBy: 'Director',
      approvalHistory: [{ decision: 'approved', at: new Date() }],
    };
    delete plan.originalZipSha256;
    const missingImportAudit = (subject as any).adsGateEvidence(safety, false, plan, candidate);
    expect(missingImportAudit.providerValidateOnlyPassed).toBe(true);
    expect(missingImportAudit.approved).toBe(true);
    expect(missingImportAudit.auditReady).toBe(false);

    plan.originalZipSha256 = 'hash-1';
    const readyGate = (subject as any).adsGateEvidence(safety, false, plan, candidate);
    expect(readyGate).toEqual(expect.objectContaining({
      providerValidateOnlyPassed: true,
      approved: true,
      idempotencyReady: true,
      beforeStateSnapshotReady: true,
      auditReady: true,
    }));
  });

  it('reports localOnly from the actual environment and includes execution summary counts', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const subject = service({
      googleAdGroup: { find: jest.fn(() => sortedLeanQuery([])) },
      adGroup: { find: jest.fn(() => sortedLeanQuery([])) },
      adAccount: { find: jest.fn(() => leanQuery([])) },
      managerAccount: { find: jest.fn(() => leanQuery([])) },
      emergency: { findOne: jest.fn(() => leanQuery(null)) },
      availableFund: { findOne: jest.fn(() => sortedLeanQuery(null)) },
      budgetBucket: { find: jest.fn(() => leanQuery([])) },
    });

    try {
      const snapshot = await subject.buildSnapshot();
      expect(snapshot.environment).toBe('production');
      expect(snapshot.safety.localOnly).toBe(false);
      expect(snapshot.summary).toEqual(expect.objectContaining({
        totalAdGroups: 0,
        executionReady: 0,
        executionBlocked: 0,
      }));
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('batch-loads all evidence with query count independent of Ad Group count', async () => {
    const previousConcurrency = process.env.ADS_EVIDENCE_QUERY_CONCURRENCY;
    process.env.ADS_EVIDENCE_QUERY_CONCURRENCY = '3';
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      customerId: '111',
      campaignId: String(100 + index),
      adGroupId: String(1000 + index),
      internalProductIds: [productId],
      lastSyncAt: new Date(),
    }));
    const campaigns = candidates.map((item, index) => ({
      customerId: item.customerId,
      campaignId: item.campaignId,
      campaignBudgetId: String(2000 + index),
    }));
    const budgets = campaigns.map((item) => ({
      customerId: item.customerId,
      campaignBudgetId: item.campaignBudgetId,
    }));
    const tracker = trackedQueryHarness();
    const orderFind = jest.fn(() => trackedSortedLeanQuery([], tracker));
    const models = {
      googleAdGroup: { find: jest.fn(() => trackedSortedLeanQuery(candidates, tracker)) },
      adGroup: { find: jest.fn(() => trackedSortedLeanQuery([], tracker)) },
      adAccount: { find: jest.fn(() => trackedLeanQuery([{ _id: 'account-1', accountId: '111', accountType: 'google' }], tracker)) },
      managerAccount: { find: jest.fn(() => trackedLeanQuery([], tracker)) },
      googleCampaign: { find: jest.fn(() => trackedLeanQuery(campaigns, tracker)) },
      googleBudget: { find: jest.fn(() => trackedLeanQuery(budgets, tracker)) },
      product: { find: jest.fn(() => trackedLeanQuery([{ _id: productId, categoryId: 'group-a', suppliers: [] }], tracker)) },
      inventory: { find: jest.fn(() => trackedLeanQuery([], tracker)) },
      supplierQuote: { find: jest.fn(() => trackedSortedLeanQuery([], tracker)) },
      availableFund: { findOne: jest.fn(() => trackedSortedLeanQuery({ available: 10_000_000, capturedAt: new Date() }, tracker)) },
      budgetBucket: { find: jest.fn(() => trackedLeanQuery([], tracker)) },
      actionPlan: { find: jest.fn(() => trackedSortedLeanQuery([], tracker)) },
      order: { find: orderFind },
      report: { find: jest.fn(() => trackedSortedLeanQuery([], tracker)) },
      advertisingCost: { aggregate: jest.fn(() => ({ exec: () => tracker.run([]) })) },
      supplierPayable: { find: jest.fn(() => trackedLeanQuery([], tracker)) },
      emergency: { findOne: jest.fn(() => trackedLeanQuery(null, tracker)) },
    };
    const subject = service(models);

    try {
      const snapshot = await subject.buildSnapshot({ limit: 20, lookbackDays: 30 });
      expect(snapshot.adGroups).toHaveLength(8);
      expect(models.googleCampaign.find).toHaveBeenCalledTimes(1);
      expect(models.googleBudget.find).toHaveBeenCalledTimes(1);
      expect(models.product.find).toHaveBeenCalledTimes(1);
      expect(models.inventory.find).toHaveBeenCalledTimes(1);
      expect(models.supplierQuote.find).toHaveBeenCalledTimes(1);
      expect(models.supplierQuote.find).toHaveBeenCalledWith(expect.objectContaining({
        approvalStatus: 'approved',
      }));
      expect(models.availableFund.findOne).toHaveBeenCalledTimes(1);
      expect(models.budgetBucket.find).toHaveBeenCalledTimes(1);
      expect(models.actionPlan.find).toHaveBeenCalledTimes(1);
      expect(orderFind).toHaveBeenCalledTimes(1);
      expect(models.report.find).toHaveBeenCalledTimes(1);
      expect(models.advertisingCost.aggregate).toHaveBeenCalledTimes(1);
      expect(models.supplierPayable.find).toHaveBeenCalledTimes(1);
      expect(tracker.stats().calls).toBeLessThan(25);
      expect(tracker.stats().maxActive).toBeGreaterThan(1);
      expect(tracker.stats().maxActive).toBeLessThanOrEqual(3);
    } finally {
      if (previousConcurrency === undefined) delete process.env.ADS_EVIDENCE_QUERY_CONCURRENCY;
      else process.env.ADS_EVIDENCE_QUERY_CONCURRENCY = previousConcurrency;
    }
  });

  it('keyset-paginates large order evidence and fails closed at the reviewed row bound', async () => {
    const previousPageSize = process.env.ADS_EVIDENCE_ORDER_PAGE_SIZE;
    const previousMaxRows = process.env.ADS_EVIDENCE_MAX_ORDER_ROWS;
    process.env.ADS_EVIDENCE_ORDER_PAGE_SIZE = '100';
    process.env.ADS_EVIDENCE_MAX_ORDER_ROWS = '1000';
    const allRows = Array.from({ length: 1001 }, (_, index) => ({
      _id: String(index + 1).padStart(6, '0'),
      adGroupId: '30',
    }));
    const orderFind = jest.fn((filter: any) => {
      const afterId = filter?.$and?.[1]?._id?.$gt;
      const matching = afterId ? allRows.filter((row) => row._id > afterId) : allRows;
      return {
        sort: () => ({
          limit: (limit: number) => leanQuery(matching.slice(0, limit)),
        }),
      };
    });
    const subject = service({ order: { find: orderFind } });
    const limiter = { run: (operation: () => Promise<any>) => operation() };

    try {
      await expect((subject as any).loadOrdersPaged({ adGroupId: '30' }, limiter))
        .rejects.toThrow('ADS_EVIDENCE_MAX_ORDER_ROWS=1000');
      expect(orderFind).toHaveBeenCalledTimes(11);
      expect(orderFind.mock.calls[1][0]).toEqual(expect.objectContaining({
        $and: expect.arrayContaining([{ _id: { $gt: '000100' } }]),
      }));
    } finally {
      if (previousPageSize === undefined) delete process.env.ADS_EVIDENCE_ORDER_PAGE_SIZE;
      else process.env.ADS_EVIDENCE_ORDER_PAGE_SIZE = previousPageSize;
      if (previousMaxRows === undefined) delete process.env.ADS_EVIDENCE_MAX_ORDER_ROWS;
      else process.env.ADS_EVIDENCE_MAX_ORDER_ROWS = previousMaxRows;
    }
  });
});
