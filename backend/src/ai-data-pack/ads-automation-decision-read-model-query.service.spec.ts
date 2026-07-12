import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionMongoReadModelRepository } from './ads-automation-decision-mongo-read-model.repository';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import type {
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
} from './contracts/ads-automation-decision.contract';
import type {
  AdsAutomationCampaignBudgetReadRow,
  AdsAutomationDecisionReadModelRepository,
} from './contracts/ads-automation-decision-read-model-query.contract';
import type {
  AdsAutomationAdGroupReadRow,
  AdsAutomationCashflowPolicyReadRow,
  AdsAutomationProductReadRow,
  AdsAutomationSupplierReadRow,
} from './contracts/ads-automation-decision-source-adapter.contract';

const evidenceWindow = { from: '2026-06-21', to: '2026-07-04', days: 14 };
const freshAt = '2026-07-04T04:00:00.000Z';

function findDecision(
  snapshot: AdsAutomationDecisionSnapshot,
  type: AdsAutomationDecisionItem['decision_type'],
  entityId: string,
): AdsAutomationDecisionItem {
  const decision = snapshot.decisions.find((item) => item.decision_type === type && item.entity_id === entityId);
  if (!decision) throw new Error(`Missing ${type} decision for ${entityId}`);
  return decision;
}

function rows(overrides: Partial<{
  adGroups: AdsAutomationAdGroupReadRow[];
  campaignBudgets: AdsAutomationCampaignBudgetReadRow[];
  products: AdsAutomationProductReadRow[];
  suppliers: AdsAutomationSupplierReadRow[];
  policy: AdsAutomationCashflowPolicyReadRow;
  watermarks: Record<string, string>;
}> = {}) {
  const base = {
    adGroups: [
      {
        platform: 'google',
        customerId: '1234567890',
        campaignId: '1001',
        campaignName: 'Search - Scale',
        adGroupId: '2001',
        adGroupName: 'Rice cooker winning ad group',
        resourceName: 'customers/1234567890/adGroups/2001',
        campaignBudgetId: '3001',
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
        status: 'ENABLED',
        currentBudgetVnd: 1,
        spendVnd: 300000,
        clicks: 120,
        impressions: 5000,
        conversions: 12,
        conversionValueVnd: 4000000,
        orders: 12,
        revenueVnd: 4000000,
        grossProfitVnd: 1600000,
        netProfitAfterAdsVnd: 700000,
        returnRatePercent: 8,
        dataQualityScore: 0.92,
        labels: [],
        internalProductIds: ['P_SCALE'],
        bottlenecksChecked: true,
        lastSyncAt: freshAt,
      },
    ] as AdsAutomationAdGroupReadRow[],
    campaignBudgets: [
      {
        customerId: '1234567890',
        campaignBudgetId: '3001',
        resourceName: 'customers/1234567890/campaignBudgets/3001',
        amountVnd: 1000000,
        status: 'ENABLED',
        lastSyncAt: freshAt,
      },
    ] as AdsAutomationCampaignBudgetReadRow[],
    products: [
      {
        productId: 'P_SCALE',
        sku: 'SKU-SCALE',
        productName: 'Profitable cooker',
        netProfitVnd: 1250000,
        adAttributedNetProfitAfterAdsVnd: 700000,
        marginPercent: 45,
        returnCancelRefundRatePercent: 8,
        stockAvailable: 120,
        daysOfCover: 20,
        mediaReady: true,
        landingReady: true,
        offerReady: true,
        mappedAdGroupIds: ['2001'],
        supplierIds: ['SUP_SAFE'],
        updatedAt: freshAt,
      },
    ] as AdsAutomationProductReadRow[],
    suppliers: [
      {
        productId: 'P_SCALE',
        supplierId: 'SUP_SAFE',
        supplierName: 'Safe Supplier',
        quoteApproved: true,
        currentQuoteVnd: 180000,
        priorQuoteVnd: 185000,
        marginAfterCostPercent: 42,
        leadTimeDays: 4,
        lateDeliveryRatePercent: 3,
        paymentFreshnessDays: 5,
        capacityStatus: 'available',
        returnFaultRatePercent: 2,
        updatedAt: freshAt,
      },
    ] as AdsAutomationSupplierReadRow[],
    policy: {
      availableAdsCashVnd: 500000,
      cashflowGatePassed: true,
      maxBudgetIncreasePercent: 20,
      mediumConfidenceIncreasePercent: 10,
      minOrdersForScale: 5,
      minDataQualityScore: 0.75,
      minSpendForPauseVnd: 200000,
      maxReturnRatePercent: 25,
      minMarginPercent: 20,
      lastSyncAt: freshAt,
    } as AdsAutomationCashflowPolicyReadRow,
    watermarks: undefined as Record<string, string> | undefined,
  };
  return { ...base, ...overrides };
}

function readinessRows(overrides: Partial<ReturnType<typeof rows>> = {}) {
  const base = rows();
  return rows({
    adGroups: [
      base.adGroups[0],
      {
        ...base.adGroups[0],
        campaignId: '1002',
        campaignName: 'Search - Refund Heavy',
        adGroupId: '2002',
        adGroupName: 'Refund-heavy ad group',
        resourceName: 'customers/1234567890/adGroups/2002',
        campaignBudgetId: '3002',
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3002',
        currentBudgetVnd: 500000,
        spendVnd: 350000,
        clicks: 88,
        impressions: 4100,
        conversions: 0,
        conversionValueVnd: 0,
        orders: 0,
        revenueVnd: 0,
        grossProfitVnd: 0,
        netProfitAfterAdsVnd: -350000,
        returnRatePercent: 40,
        dataQualityScore: 0.88,
        internalProductIds: ['P_BAD'],
      },
    ],
    campaignBudgets: [
      base.campaignBudgets[0],
      {
        customerId: '1234567890',
        campaignBudgetId: '3002',
        resourceName: 'customers/1234567890/campaignBudgets/3002',
        amountVnd: 500000,
        status: 'ENABLED',
        lastSyncAt: freshAt,
      },
    ],
    products: [
      base.products[0],
      {
        productId: 'P_BAD',
        sku: 'SKU-BAD',
        productName: 'Refund-heavy set',
        netProfitVnd: -450000,
        adAttributedNetProfitAfterAdsVnd: -350000,
        marginPercent: -5,
        returnCancelRefundRatePercent: 40,
        stockAvailable: 50,
        daysOfCover: 12,
        mediaReady: true,
        landingReady: true,
        offerReady: true,
        mappedAdGroupIds: ['2002'],
        supplierIds: ['SUP_WEAK_1', 'SUP_WEAK_2'],
        updatedAt: freshAt,
      },
    ],
    suppliers: [
      base.suppliers[0],
      {
        productId: 'P_BAD',
        supplierId: 'SUP_WEAK_1',
        supplierName: 'Weak Supplier 1',
        quoteApproved: true,
        currentQuoteVnd: 260000,
        priorQuoteVnd: 230000,
        marginAfterCostPercent: 8,
        leadTimeDays: 14,
        lateDeliveryRatePercent: 20,
        paymentFreshnessDays: 45,
        capacityStatus: 'constrained',
        returnFaultRatePercent: 14,
        updatedAt: freshAt,
      },
      {
        productId: 'P_BAD',
        supplierId: 'SUP_WEAK_2',
        supplierName: 'Weak Supplier 2',
        quoteApproved: false,
        currentQuoteVnd: 280000,
        priorQuoteVnd: 250000,
        marginAfterCostPercent: -2,
        leadTimeDays: 16,
        lateDeliveryRatePercent: 22,
        paymentFreshnessDays: 60,
        capacityStatus: 'blocked',
        returnFaultRatePercent: 18,
        updatedAt: freshAt,
      },
    ],
    ...overrides,
  });
}

function repository(source = rows()): AdsAutomationDecisionReadModelRepository {
  return {
    findAdGroupPerformanceRows: jest.fn().mockResolvedValue(source.adGroups),
    findCampaignBudgetRows: jest.fn().mockResolvedValue(source.campaignBudgets),
    findProductPerformanceRows: jest.fn().mockResolvedValue(source.products),
    findSupplierSafetyRows: jest.fn().mockResolvedValue(source.suppliers),
    findCashflowPolicyRow: jest.fn().mockResolvedValue(source.policy),
    findSourceWatermarks: source.watermarks
      ? jest.fn().mockResolvedValue(source.watermarks)
      : undefined,
  };
}

describe('AdsAutomationDecisionReadModelQueryService', () => {
  const adapter = new AdsAutomationDecisionSourceAdapterService();
  const service = new AdsAutomationDecisionReadModelQueryService(adapter);
  const decisionService = new AdsAutomationDecisionService();
  const query = {
    snapshotDate: '2026-07-04',
    evidenceWindow,
    now: '2026-07-04T05:00:00.000Z',
  };

  it('looks up campaign budget rows with a valid budget ID and feeds scale amount decisions', async () => {
    const result = await service.buildFromRepository(repository(), query);
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.snapshotInput.adGroups?.[0]).toEqual(expect.objectContaining({
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      currentBudgetVnd: 1000000,
      clicks: 120,
      impressions: 5000,
      conversions: 12,
      conversionValueVnd: 4000000,
    }));
    expect(result.queryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        entityId: '2001',
        status: 'loaded',
        rowCount: 1,
        missingFields: [],
      }),
    ]));
    expect(findDecision(snapshot, 'scale_amount', '2001').proposedValue).toEqual(expect.objectContaining({
      campaignBudgetId: '3001',
      proposedBudgetVnd: 1200000,
    }));
    expect(findDecision(snapshot, 'scale_ads', '2001').evidence_metrics).toEqual(expect.objectContaining({
      clicks: 120,
      impressions: 5000,
      conversions: 12,
      conversionValueVnd: 4000000,
    }));
  });

  it('answers read-model decision readiness for scale-up, pause, product allocation, and supplier safety fixtures', async () => {
    const base = rows();
    const source = rows({
      adGroups: [
        base.adGroups[0],
        {
          ...base.adGroups[0],
          campaignId: '1002',
          campaignName: 'Search - Refund Heavy',
          adGroupId: '2002',
          adGroupName: 'Refund-heavy ad group',
          resourceName: 'customers/1234567890/adGroups/2002',
          campaignBudgetId: '3002',
          campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3002',
          currentBudgetVnd: 500000,
          spendVnd: 350000,
          clicks: 88,
          impressions: 4100,
          conversions: 0,
          conversionValueVnd: 0,
          orders: 0,
          revenueVnd: 0,
          grossProfitVnd: 0,
          netProfitAfterAdsVnd: -350000,
          returnRatePercent: 40,
          dataQualityScore: 0.88,
          internalProductIds: ['P_BAD'],
        },
      ],
      campaignBudgets: [
        base.campaignBudgets[0],
        {
          customerId: '1234567890',
          campaignBudgetId: '3002',
          resourceName: 'customers/1234567890/campaignBudgets/3002',
          amountVnd: 500000,
          status: 'ENABLED',
          lastSyncAt: freshAt,
        },
      ],
      products: [
        base.products[0],
        {
          productId: 'P_BAD',
          sku: 'SKU-BAD',
          productName: 'Refund-heavy set',
          netProfitVnd: -450000,
          adAttributedNetProfitAfterAdsVnd: -350000,
          marginPercent: -5,
          returnCancelRefundRatePercent: 40,
          stockAvailable: 50,
          daysOfCover: 12,
          mediaReady: true,
          landingReady: true,
          offerReady: true,
          mappedAdGroupIds: ['2002'],
          supplierIds: ['SUP_WEAK_1', 'SUP_WEAK_2'],
          updatedAt: freshAt,
        },
      ],
      suppliers: [
        base.suppliers[0],
        {
          productId: 'P_BAD',
          supplierId: 'SUP_WEAK_1',
          supplierName: 'Weak Supplier 1',
          quoteApproved: true,
          currentQuoteVnd: 260000,
          priorQuoteVnd: 230000,
          marginAfterCostPercent: 8,
          leadTimeDays: 14,
          lateDeliveryRatePercent: 20,
          paymentFreshnessDays: 45,
          capacityStatus: 'constrained',
          returnFaultRatePercent: 14,
          updatedAt: freshAt,
        },
        {
          productId: 'P_BAD',
          supplierId: 'SUP_WEAK_2',
          supplierName: 'Weak Supplier 2',
          quoteApproved: false,
          currentQuoteVnd: 280000,
          priorQuoteVnd: 250000,
          marginAfterCostPercent: -2,
          leadTimeDays: 16,
          lateDeliveryRatePercent: 22,
          paymentFreshnessDays: 60,
          capacityStatus: 'blocked',
          returnFaultRatePercent: 18,
          updatedAt: freshAt,
        },
      ],
    });

    const result = await service.buildFromRepository(repository(source), query);
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.sourceEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey: 'ads_performance', status: 'fresh', rowCount: 2 }),
      expect.objectContaining({ sourceKey: 'campaign_budgets', status: 'fresh', rowCount: 2 }),
      expect.objectContaining({ sourceKey: 'product_performance', status: 'fresh', rowCount: 2 }),
      expect.objectContaining({ sourceKey: 'supplier_safety', status: 'fresh', rowCount: 3 }),
    ]));
    expect(findDecision(snapshot, 'scale_amount', '2001').proposedValue).toEqual(expect.objectContaining({
      campaignBudgetId: '3001',
      proposedBudgetVnd: 1200000,
    }));
    expect(findDecision(snapshot, 'target_ad_groups', '2001').status).toBe('scale_ready');
    expect(findDecision(snapshot, 'product_budget_allocation', 'P_SCALE').status).toBe('scale_ready');
    expect(findDecision(snapshot, 'supplier_gate', 'SUP_SAFE').status).toBe('safe');
    expect(findDecision(snapshot, 'product_budget_allocation', 'P_BAD')).toEqual(expect.objectContaining({
      status: 'blocked',
      blockers: expect.arrayContaining([
        'product_net_profit_not_positive',
        'no_safe_supplier_for_scale',
      ]),
    }));
    expect(findDecision(snapshot, 'product_kill_or_stop_review', 'P_BAD').proposedValue).toEqual(expect.objectContaining({
      action: 'stop_ads_review',
    }));
    expect(findDecision(snapshot, 'campaign_or_ad_group_pause', '2002').proposedValue).toEqual(expect.objectContaining({
      action: 'pause_ad_group_draft',
    }));
  });

  it('blocks campaign budget lookup when budget ID is missing and never falls back to campaign or ad group ID', async () => {
    const source = rows({
      adGroups: [
        {
          ...rows().adGroups[0],
          campaignId: '1001',
          adGroupId: '2001',
          campaignBudgetId: undefined,
          campaignBudgetResourceName: undefined,
          currentBudgetVnd: 1000000,
        },
      ],
    });

    const result = await service.buildFromRepository(repository(source), query);
    const mappedGroup = result.snapshotInput.adGroups![0];
    const snapshot = decisionService.build(result.snapshotInput);

    expect(mappedGroup.campaignBudgetId).toBeUndefined();
    expect(mappedGroup.campaignBudgetResourceName).toBeUndefined();
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.campaignId);
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.adGroupId);
    expect(result.queryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        entityId: '2001',
        status: 'missing',
        missingFields: ['campaignBudgetId_or_campaignBudgetResourceName'],
      }),
    ]));
    expect(findDecision(snapshot, 'scale_ads', '2001').status).toBe('insufficient_data');
    expect(snapshot.decisions.some((item) => item.decision_type === 'scale_amount' && item.entity_id === '2001')).toBe(false);
  });

  it('maps ad group/product rows into usable adapter rows', async () => {
    const result = await service.buildFromRepository(repository(), query);
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.snapshotInput.adGroups?.[0].productIds).toEqual(['P_SCALE']);
    expect(result.snapshotInput.products?.[0]).toEqual(expect.objectContaining({
      productId: 'P_SCALE',
      name: 'Profitable cooker',
      mappedAdGroupIds: ['2001'],
      supplierIds: ['SUP_SAFE'],
    }));
    expect(findDecision(snapshot, 'product_budget_allocation', 'P_SCALE').status).toBe('scale_ready');
    expect(findDecision(snapshot, 'scale_ads', '2001').status).toBe('scale_ready');
  });

  it('feeds supplier safety rows into supplier gate evidence', async () => {
    const result = await service.buildFromRepository(repository(), query);
    const snapshot = decisionService.build(result.snapshotInput);
    const supplierEvidence = result.sourceEvidence.find((item) => item.sourceKey === 'supplier_safety');

    expect(supplierEvidence).toEqual(expect.objectContaining({
      status: 'fresh',
      canUseForDecision: 'yes',
      rowCount: 1,
      missingFields: [],
    }));
    expect(result.snapshotInput.suppliers?.[0]).toEqual(expect.objectContaining({
      supplierId: 'SUP_SAFE',
      quoteApproved: true,
      marginAfterCostPercent: 42,
    }));
    expect(findDecision(snapshot, 'supplier_gate', 'SUP_SAFE').status).toBe('safe');
  });

  it('feeds cashflow and policy rows into budget policy evidence', async () => {
    const result = await service.buildFromRepository(repository(), query);
    const snapshot = decisionService.build(result.snapshotInput);
    const policyEvidence = result.sourceEvidence.find((item) => item.sourceKey === 'cashflow_policy');

    expect(policyEvidence).toEqual(expect.objectContaining({
      status: 'fresh',
      canUseForDecision: 'yes',
      rowCount: 1,
      missingFields: [],
    }));
    expect(result.snapshotInput.policy).toEqual(expect.objectContaining({
      availableAdsCashVnd: 500000,
      cashflowGatePassed: true,
      maxBudgetIncreasePercent: 20,
    }));
    expect(findDecision(snapshot, 'scale_amount', '2001').status).toBe('scale_ready');
  });

  it('reflects stale source watermarks in freshness evidence', async () => {
    const source = rows({
      watermarks: {
        ads_performance: freshAt,
        campaign_budgets: '2026-06-30T00:00:00.000Z',
        product_performance: '2026-06-30T00:00:00.000Z',
        supplier_safety: freshAt,
        pause_review: freshAt,
        cashflow_policy: freshAt,
      },
    });

    const result = await service.buildFromRepository(repository(source), {
      ...query,
      maxAgeHours: {
        campaign_budgets: 24,
        product_performance: 24,
      },
    });
    const budgetEvidence = result.sourceEvidence.find((item) => item.sourceKey === 'campaign_budgets');
    const productEvidence = result.sourceEvidence.find((item) => item.sourceKey === 'product_performance');

    expect(budgetEvidence).toEqual(expect.objectContaining({
      status: 'stale',
      canUseForDecision: 'cautious',
      latestObservedAt: '2026-06-30T00:00:00.000Z',
      maxAgeHours: 24,
    }));
    expect(productEvidence).toEqual(expect.objectContaining({
      status: 'stale',
      canUseForDecision: 'cautious',
      latestObservedAt: '2026-06-30T00:00:00.000Z',
      maxAgeHours: 24,
    }));
    expect(budgetEvidence?.ageHours).toBeGreaterThan(24);
    expect(productEvidence?.ageHours).toBeGreaterThan(24);
  });

  it('blocks scale and pause action decisions when Google Ads ad-group performance evidence is stale', async () => {
    const staleAt = '2026-06-30T00:00:00.000Z';
    const source = readinessRows({
      watermarks: {
        ads_performance: staleAt,
        campaign_budgets: freshAt,
        product_performance: freshAt,
        supplier_safety: freshAt,
        pause_review: freshAt,
        cashflow_policy: freshAt,
      },
    });

    const result = await service.buildFromRepository(repository(source), {
      ...query,
      maxAgeHours: { ads_performance: 24 },
    });
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.sourceEvidence.find((item) => item.sourceKey === 'ads_performance')).toEqual(expect.objectContaining({
      status: 'stale',
      canUseForDecision: 'cautious',
      latestObservedAt: staleAt,
    }));
    expect(findDecision(snapshot, 'scale_ads', '2001')).toEqual(expect.objectContaining({
      status: 'insufficient_data',
      missing_fields: expect.arrayContaining([
        'currentStatus',
        'spendVnd',
        'orders',
        'revenueVnd',
        'grossProfitVnd',
        'netProfitAfterAdsVnd',
        'dataQualityScore',
      ]),
      proposedValue: { action: 'monitor_only' },
    }));
    expect(snapshot.decisions.some((item) => item.decision_type === 'scale_amount' && item.entity_id === '2001')).toBe(false);
    expect(findDecision(snapshot, 'campaign_or_ad_group_pause', '2002')).toEqual(expect.objectContaining({
      status: 'insufficient_data',
      missing_fields: expect.arrayContaining([
        'currentStatus',
        'spendVnd',
        'orders',
        'netProfitAfterAdsVnd',
        'dataQualityScore',
      ]),
      proposedValue: { action: 'pause_review_data_completion' },
    }));
    expect(snapshot.decisions.some((item) => item.proposedValue?.action === 'pause_ad_group_draft')).toBe(false);
  });

  it('blocks scale amount decisions when campaign budget read-model evidence is stale', async () => {
    const staleAt = '2026-06-30T00:00:00.000Z';
    const source = rows({
      watermarks: {
        ads_performance: freshAt,
        campaign_budgets: staleAt,
        product_performance: freshAt,
        supplier_safety: freshAt,
        pause_review: freshAt,
        cashflow_policy: freshAt,
      },
    });

    const result = await service.buildFromRepository(repository(source), {
      ...query,
      maxAgeHours: { campaign_budgets: 24 },
    });
    const mappedGroup = result.snapshotInput.adGroups![0];
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.sourceEvidence.find((item) => item.sourceKey === 'campaign_budgets')).toEqual(expect.objectContaining({
      status: 'stale',
      canUseForDecision: 'cautious',
      latestObservedAt: staleAt,
    }));
    expect(mappedGroup.campaignBudgetId).toBeUndefined();
    expect(mappedGroup.campaignBudgetResourceName).toBeUndefined();
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.campaignId);
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.adGroupId);
    expect(findDecision(snapshot, 'scale_ads', '2001')).toEqual(expect.objectContaining({
      status: 'insufficient_data',
      missing_fields: expect.arrayContaining([
        'currentBudgetVnd',
        'campaignBudgetId_or_campaignBudgetResourceName',
      ]),
      proposedValue: { action: 'monitor_only' },
    }));
    expect(snapshot.decisions.some((item) => item.decision_type === 'scale_amount' && item.entity_id === '2001')).toBe(false);
  });

  it('blocks product allocation and ad-group scale when inventory/profit source evidence is stale', async () => {
    const staleAt = '2026-06-30T00:00:00.000Z';
    const source = rows({
      watermarks: {
        ads_performance: freshAt,
        campaign_budgets: freshAt,
        product_performance: staleAt,
        supplier_safety: freshAt,
        pause_review: freshAt,
        cashflow_policy: freshAt,
      },
    });

    const result = await service.buildFromRepository(repository(source), {
      ...query,
      maxAgeHours: { product_performance: 24 },
    });
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.sourceEvidence.find((item) => item.sourceKey === 'product_performance')).toEqual(expect.objectContaining({
      status: 'stale',
      canUseForDecision: 'cautious',
      latestObservedAt: staleAt,
    }));
    expect(findDecision(snapshot, 'product_budget_allocation', 'P_SCALE')).toEqual(expect.objectContaining({
      status: 'insufficient_data',
      missing_fields: expect.arrayContaining([
        'netProfitVnd',
        'stockAvailable',
        'daysOfCover',
      ]),
    }));
    expect(findDecision(snapshot, 'scale_ads', '2001')).toEqual(expect.objectContaining({
      status: 'blocked',
      blockers: expect.arrayContaining(['product_gate_insufficient_data']),
    }));
  });

  it('blocks supplier gate and product allocation when supplier safety rows are missing', async () => {
    const source = rows({ suppliers: [] });

    const result = await service.buildFromRepository(repository(source), query);
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.sourceEvidence.find((item) => item.sourceKey === 'supplier_safety')).toEqual(expect.objectContaining({
      status: 'missing',
      canUseForDecision: 'no',
      rowCount: 0,
    }));
    expect(snapshot.categories.supplier_gate.status).toBe('insufficient_data');
    expect(findDecision(snapshot, 'product_budget_allocation', 'P_SCALE')).toEqual(expect.objectContaining({
      status: 'blocked',
      blockers: expect.arrayContaining(['no_safe_supplier_for_scale']),
    }));
  });
});

function mongoRows(overrides: Record<string, any[]> = {}) {
  const oldAt = '2026-06-30T00:00:00.000Z';
  return {
    google_ads_campaigns: [
      {
        customerId: '1234567890',
        campaignId: '1001',
        resourceName: 'customers/1234567890/campaigns/1001',
        campaignName: 'Search - Scale',
        status: 'ENABLED',
        campaignBudgetId: '3001',
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
        internalProductId: 'P_SCALE',
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    google_ads_campaign_budgets: [
      {
        customerId: '1234567890',
        campaignBudgetId: '3001',
        resourceName: 'customers/1234567890/campaignBudgets/3001',
        amountVnd: 1000000,
        status: 'ENABLED',
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    google_ads_ad_groups: [
      {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        resourceName: 'customers/1234567890/adGroups/2001',
        adGroupName: 'Rice cooker winning ad group',
        status: 'ENABLED',
        internalProductIds: ['P_SCALE'],
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    google_ads_daily_metrics: [
      {
        date: '2026-07-03',
        level: 'ad_group',
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        costVnd: 140000,
        impressions: 2400,
        clicks: 55,
        conversions: 5,
        conversionValue: 1700000,
        revenue: 1700000,
        grossProfit: 650000,
        netProfit: 280000,
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
      {
        date: '2026-07-04',
        level: 'ad_group',
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        costVnd: 160000,
        impressions: 2600,
        clicks: 65,
        conversions: 7,
        conversionValue: 2300000,
        orders: 7,
        revenue: 2300000,
        grossProfit: 950000,
        netProfit: 420000,
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    adgroups: [
      {
        adGroupId: '2001',
        name: 'ERP mapped Google group',
        platform: 'google',
        isActive: true,
        remoteStatus: 'ENABLED',
        effectiveStatus: 'ENABLED',
        dailyBudget: 800000,
        selectedProducts: ['P_SCALE'],
        bottlenecksChecked: true,
        updatedAt: freshAt,
      },
    ],
    products: [
      {
        _id: 'P_SCALE',
        sku: 'SKU-SCALE',
        name: 'Profitable cooker',
        importPrice: 180000,
        shippingCost: 10000,
        packagingCost: 5000,
        totalCost: 195000,
        salePrice: 400000,
        minStock: 10,
        maxStock: 500,
        status: 'active',
        assumedReturnRatePercent: 8,
        images: [{ url: 'https://example.test/product.jpg' }],
        suppliers: [
          {
            supplierId: 'SUP_SAFE',
            appliedPrice: 180000,
            appliedAt: freshAt,
            isDefault: true,
          },
        ],
        updatedAt: freshAt,
      },
    ],
    inventorysummaries: [
      {
        productId: 'P_SCALE',
        onHand: 120,
        avgCost: 180000,
        updatedAt: freshAt,
      },
    ],
    ordertest2: [
      {
        productId: 'P_SCALE',
        supplierId: 'SUP_SAFE',
        adGroupId: '2001',
        quantity: 12,
        orderStatus: 'completed',
        depositAmount: 1000000,
        codAmount: 3000000,
        manualPayment: 0,
        grossProfit: 1600000,
        netProfit: 1250000,
        supplierAppliedPrice: 180000,
        orderDate: new Date('2026-07-04T03:00:00.000Z'),
        updatedAt: freshAt,
      },
    ],
    supplierquotes: [
      {
        productId: 'P_SCALE',
        supplierId: 'SUP_SAFE',
        price: 180000,
        status: 'approved',
        effectiveAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: freshAt,
      },
      {
        productId: 'P_SCALE',
        supplierId: 'SUP_SAFE',
        price: 185000,
        status: 'approved',
        effectiveAt: new Date('2026-06-15T00:00:00.000Z'),
        updatedAt: oldAt,
      },
    ],
    purchaseorders: [
      {
        supplierId: 'SUP_SAFE',
        supplierNameSnap: 'Safe Supplier',
        status: 'received',
        expectedDeliveryDate: new Date('2026-07-02T00:00:00.000Z'),
        receivedDate: new Date('2026-07-01T00:00:00.000Z'),
        items: [
          {
            productId: 'P_SCALE',
            quantity: 100,
            unitPrice: 180000,
            quantityReceived: 100,
          },
        ],
        createdAt: new Date('2026-06-28T00:00:00.000Z'),
        updatedAt: freshAt,
      },
    ],
    supplierpayables: [
      {
        supplierId: 'SUP_SAFE',
        supplierNameSnap: 'Safe Supplier',
        status: 'paid',
        balance: 0,
        items: [{ productId: 'P_SCALE', amount: 300000 }],
        payments: [{ amount: 300000, paidAt: new Date('2026-07-03T00:00:00.000Z') }],
        updatedAt: freshAt,
      },
    ],
    supplierstatements: [
      {
        supplierId: 'SUP_SAFE',
        status: 'closed',
        closingBalance: 0,
        periodTo: new Date('2026-07-03T00:00:00.000Z'),
        payments: [{ amount: 300000, paidAt: new Date('2026-07-03T00:00:00.000Z') }],
        updatedAt: freshAt,
      },
    ],
    users: [
      {
        _id: 'SUP_SAFE',
        fullName: 'Safe Supplier',
        role: 'external_supplier',
        updatedAt: freshAt,
      },
    ],
    available_fund_snapshots: [
      {
        available: 900000,
        capturedAt: new Date('2026-07-04T04:00:00.000Z'),
        updatedAt: freshAt,
      },
    ],
    capital_allocation_snapshots: [
      {
        date: new Date('2026-07-04T00:00:00.000Z'),
        reinvestmentAmount: 1000000,
        reinvestmentUsed: 500000,
        updatedAt: freshAt,
      },
    ],
    cashflow_summary_snapshots: [],
    system_settings: [
      { key: 'max_budget_increase_percent', value: { value: 20 }, updatedAt: freshAt },
      { key: 'min_data_quality_score', value: { value: 0.75 }, updatedAt: freshAt },
      { key: 'min_orders_for_scale', value: { value: 5 }, updatedAt: freshAt },
    ],
    ...overrides,
  };
}

function mongoConnection(collections: Record<string, any[]>) {
  const calls: Array<{ collection: string; filter: any; options: any }> = [];
  const mutationCalls: string[] = [];
  const connection = {
    collection(name: string) {
      return {
        find(filter: any = {}, options: any = {}) {
          calls.push({ collection: name, filter, options });
          return {
            toArray: jest.fn().mockResolvedValue(applyMongoFind(collections[name] || [], filter, options)),
          };
        },
        insertOne: jest.fn(() => mutationCalls.push(`${name}.insertOne`)),
        updateOne: jest.fn(() => mutationCalls.push(`${name}.updateOne`)),
        findOneAndUpdate: jest.fn(() => mutationCalls.push(`${name}.findOneAndUpdate`)),
        deleteOne: jest.fn(() => mutationCalls.push(`${name}.deleteOne`)),
      };
    },
  };
  return { connection, calls, mutationCalls };
}

function applyMongoFind(rows: any[], filter: any, options: any) {
  let result = rows.filter((row) => matchesMongoFilter(row, filter));
  const sort = options?.sort || {};
  for (const [field, direction] of Object.entries(sort).reverse()) {
    result = [...result].sort((left, right) => compareMongoValues(left[field], right[field]) * (Number(direction) < 0 ? -1 : 1));
  }
  if (options?.limit) result = result.slice(0, Number(options.limit));
  return result;
}

function matchesMongoFilter(row: any, filter: any): boolean {
  return Object.entries(filter || {}).every(([field, expected]) => {
    const actual = row[field];
    if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
      const operator = expected as Record<string, any>;
      if ('$in' in operator && !operator.$in.map(String).includes(String(actual))) return false;
      if ('$ne' in operator && String(actual) === String(operator.$ne)) return false;
      if ('$gte' in operator && compareMongoValues(actual, operator.$gte) < 0) return false;
      if ('$lte' in operator && compareMongoValues(actual, operator.$lte) > 0) return false;
      return true;
    }
    return String(actual) === String(expected);
  });
}

function compareMongoValues(left: any, right: any): number {
  const leftTime = left instanceof Date ? left.getTime() : new Date(left).getTime();
  const rightTime = right instanceof Date ? right.getTime() : new Date(right).getTime();
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
  return String(left ?? '').localeCompare(String(right ?? ''));
}

describe('AdsAutomationDecisionMongoReadModelRepository', () => {
  const adapter = new AdsAutomationDecisionSourceAdapterService();
  const queryService = new AdsAutomationDecisionReadModelQueryService(adapter);
  const decisionService = new AdsAutomationDecisionService();
  const query = {
    snapshotDate: '2026-07-04',
    evidenceWindow,
    now: '2026-07-04T05:00:00.000Z',
  };

  it('maps real synced Mongo collection shapes into read-model rows without mutations', async () => {
    const mongo = mongoConnection(mongoRows());
    const repository = new AdsAutomationDecisionMongoReadModelRepository(mongo.connection as any);

    const [adGroups, budgets, products, suppliers, policy, watermarks] = await Promise.all([
      repository.findAdGroupPerformanceRows(query),
      repository.findCampaignBudgetRows(query),
      repository.findProductPerformanceRows(query),
      repository.findSupplierSafetyRows(query),
      repository.findCashflowPolicyRow(query),
      repository.findSourceWatermarks(query),
    ]);

    expect(adGroups[0]).toEqual(expect.objectContaining({
      platform: 'google',
      accountId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      spendVnd: 300000,
      clicks: 120,
      impressions: 5000,
      conversions: 12,
      conversionValueVnd: 4000000,
      orders: 12,
      netProfitAfterAdsVnd: 700000,
      productIds: ['P_SCALE'],
    }));
    expect(budgets[0]).toEqual(expect.objectContaining({
      campaignBudgetId: '3001',
      amountVnd: 1000000,
    }));
    expect(products[0]).toEqual(expect.objectContaining({
      productId: 'P_SCALE',
      mappedAdGroupIds: ['2001'],
      supplierIds: ['SUP_SAFE'],
      stockAvailable: 120,
    }));
    expect(suppliers[0]).toEqual(expect.objectContaining({
      productId: 'P_SCALE',
      supplierId: 'SUP_SAFE',
      quoteApproved: true,
      currentQuoteVnd: 180000,
      priorQuoteVnd: 185000,
      capacityStatus: 'available',
    }));
    expect(policy).toEqual(expect.objectContaining({
      availableAdsCashVnd: 500000,
      cashflowGatePassed: true,
      maxBudgetIncreasePercent: 20,
    }));
    expect(watermarks).toEqual(expect.objectContaining({
      campaign_budgets: freshAt,
      product_performance: freshAt,
      supplier_safety: freshAt,
    }));
    expect(mongo.mutationCalls).toEqual([]);
    expect(mongo.calls.map((call) => call.collection)).toEqual(expect.arrayContaining([
      'google_ads_campaigns',
      'google_ads_campaign_budgets',
      'google_ads_ad_groups',
      'google_ads_daily_metrics',
      'products',
      'supplierquotes',
      'available_fund_snapshots',
    ]));
  });

  it('feeds strict campaign budget join success through the query service', async () => {
    const mongo = mongoConnection(mongoRows());
    const repository = new AdsAutomationDecisionMongoReadModelRepository(mongo.connection as any);

    const result = await queryService.buildFromRepository(repository, query);
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.snapshotInput.adGroups?.[0]).toEqual(expect.objectContaining({
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      currentBudgetVnd: 1000000,
    }));
    expect(result.queryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        entityId: '2001',
        status: 'loaded',
        rowCount: 1,
      }),
    ]));
    expect(findDecision(snapshot, 'scale_amount', '2001').proposedValue).toEqual(expect.objectContaining({
      campaignBudgetId: '3001',
      proposedBudgetVnd: 1200000,
    }));
  });

  it('emits missing budget evidence and never falls back to campaign or ad group IDs', async () => {
    const source = mongoRows({
      google_ads_campaigns: mongoRows().google_ads_campaigns.map((campaign) => ({
        ...campaign,
        campaignBudgetId: undefined,
        campaignBudgetResourceName: undefined,
      })),
    });
    const mongo = mongoConnection(source);
    const repository = new AdsAutomationDecisionMongoReadModelRepository(mongo.connection as any);

    const result = await queryService.buildFromRepository(repository, query);
    const mappedGroup = result.snapshotInput.adGroups![0];
    const snapshot = decisionService.build(result.snapshotInput);

    expect(mappedGroup.campaignBudgetId).toBeUndefined();
    expect(mappedGroup.campaignBudgetResourceName).toBeUndefined();
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.campaignId);
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.adGroupId);
    expect(result.queryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        entityId: '2001',
        status: 'missing',
        missingFields: ['campaignBudgetId_or_campaignBudgetResourceName'],
      }),
    ]));
    expect(findDecision(snapshot, 'scale_ads', '2001').status).toBe('insufficient_data');
  });

  it('preserves stale Mongo source watermarks in adapter evidence', async () => {
    const staleAt = '2026-06-30T00:00:00.000Z';
    const source = mongoRows({
      google_ads_campaign_budgets: mongoRows().google_ads_campaign_budgets.map((budget) => ({
        ...budget,
        lastSyncAt: staleAt,
        updatedAt: staleAt,
      })),
      products: mongoRows().products.map((product) => ({
        ...product,
        updatedAt: staleAt,
      })),
      inventorysummaries: mongoRows().inventorysummaries.map((row) => ({
        ...row,
        updatedAt: staleAt,
      })),
      ordertest2: mongoRows().ordertest2.map((row) => ({
        ...row,
        updatedAt: staleAt,
      })),
    });
    const mongo = mongoConnection(source);
    const repository = new AdsAutomationDecisionMongoReadModelRepository(mongo.connection as any);

    const result = await queryService.buildFromRepository(repository, {
      ...query,
      maxAgeHours: {
        campaign_budgets: 24,
        product_performance: 24,
      },
    });

    expect(result.sourceEvidence.find((item) => item.sourceKey === 'campaign_budgets')).toEqual(expect.objectContaining({
      status: 'stale',
      latestObservedAt: staleAt,
      canUseForDecision: 'cautious',
    }));
    expect(result.sourceEvidence.find((item) => item.sourceKey === 'product_performance')).toEqual(expect.objectContaining({
      status: 'stale',
      latestObservedAt: staleAt,
      canUseForDecision: 'cautious',
    }));
    expect(mongo.mutationCalls).toEqual([]);
  });
});
