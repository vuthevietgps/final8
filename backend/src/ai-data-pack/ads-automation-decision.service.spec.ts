import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import {
  AdsAutomationCategoryKey,
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
  AdsAutomationDecisionSnapshotInput,
} from './contracts/ads-automation-decision.contract';

const categories: AdsAutomationCategoryKey[] = [
  'scale_ads',
  'scale_amount',
  'target_ad_groups',
  'product_budget_allocation',
  'supplier_gate',
  'product_kill_or_stop_review',
  'campaign_or_ad_group_pause',
];

function findDecision(
  snapshot: AdsAutomationDecisionSnapshot,
  type: AdsAutomationCategoryKey,
  entityId: string,
): AdsAutomationDecisionItem {
  const decision = snapshot.decisions.find((item) => item.decision_type === type && item.entity_id === entityId);
  if (!decision) throw new Error(`Missing ${type} decision for ${entityId}`);
  return decision;
}

describe('AdsAutomationDecisionService', () => {
  const service = new AdsAutomationDecisionService();

  const baseInput: AdsAutomationDecisionSnapshotInput = {
    snapshotDate: '2026-07-04',
    evidenceWindow: { from: '2026-06-21', to: '2026-07-04', days: 14 },
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
    },
    adGroups: [
      {
        platform: 'google',
        accountId: '1234567890',
        campaignId: 'CAMP_SCALE',
        campaignName: 'Search - Scale',
        adGroupId: 'AG_SCALE',
        adGroupName: 'Rice cooker winning ad group',
        resourceName: 'customers/1234567890/adGroups/AG_SCALE',
        campaignBudgetId: 'BUDGET_SCALE',
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/BUDGET_SCALE',
        currentStatus: 'ENABLED',
        currentBudgetVnd: 1000000,
        spendVnd: 300000,
        clicks: 120,
        impressions: 5000,
        orders: 12,
        revenueVnd: 4000000,
        grossProfitVnd: 1600000,
        netProfitAfterAdsVnd: 700000,
        returnRatePercent: 8,
        dataQualityScore: 0.92,
        labels: [],
        productIds: ['P_SCALE'],
        bottlenecksChecked: true,
      },
      {
        platform: 'google',
        accountId: '1234567890',
        campaignId: 'CAMP_BAD',
        campaignName: 'Search - Bad',
        adGroupId: 'AG_PAUSE',
        adGroupName: 'Refund-heavy ad group',
        resourceName: 'customers/1234567890/adGroups/AG_PAUSE',
        campaignBudgetId: 'BUDGET_BAD',
        currentStatus: 'ENABLED',
        currentBudgetVnd: 500000,
        spendVnd: 350000,
        clicks: 88,
        impressions: 4100,
        orders: 0,
        revenueVnd: 0,
        grossProfitVnd: 0,
        netProfitAfterAdsVnd: -350000,
        returnRatePercent: 40,
        dataQualityScore: 0.88,
        labels: [],
        productIds: ['P_BAD'],
        bottlenecksChecked: true,
      },
    ],
    products: [
      {
        productId: 'P_SCALE',
        sku: 'SKU-SCALE',
        name: 'Profitable cooker',
        netProfitVnd: 1250000,
        adAttributedNetProfitAfterAdsVnd: 700000,
        marginPercent: 45,
        returnCancelRefundRatePercent: 8,
        stockAvailable: 120,
        daysOfCover: 20,
        mediaReady: true,
        landingReady: true,
        offerReady: true,
        mappedAdGroupIds: ['AG_SCALE'],
        supplierIds: ['SUP_SAFE'],
      },
      {
        productId: 'P_BAD',
        sku: 'SKU-BAD',
        name: 'Refund-heavy set',
        netProfitVnd: -450000,
        adAttributedNetProfitAfterAdsVnd: -350000,
        marginPercent: -5,
        returnCancelRefundRatePercent: 40,
        stockAvailable: 50,
        daysOfCover: 12,
        mediaReady: true,
        landingReady: true,
        offerReady: true,
        mappedAdGroupIds: ['AG_PAUSE'],
        supplierIds: ['SUP_WEAK_1', 'SUP_WEAK_2'],
      },
    ],
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
      },
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
      },
    ],
  };

  it('builds a read-only seven-category snapshot with scale, pause, supplier, and product stop-review decisions', () => {
    const snapshot = service.build(baseInput);

    expect(Object.keys(snapshot.categories).sort()).toEqual([...categories].sort());
    expect(snapshot.safety).toEqual({
      read_only: true,
      provider_api_used: false,
      google_ads_api_used: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_future_actions: true,
    });

    const scale = findDecision(snapshot, 'scale_ads', 'AG_SCALE');
    expect(scale.status).toBe('scale_ready');
    expect(scale.execution_allowed_now).toBe(false);

    const amount = findDecision(snapshot, 'scale_amount', 'AG_SCALE');
    expect(amount.proposedValue).toEqual(expect.objectContaining({
      action: 'update_campaign_budget_draft',
      currentBudgetVnd: 1000000,
      proposedBudgetVnd: 1200000,
      increasePercent: 20,
      campaignBudgetId: 'BUDGET_SCALE',
    }));
    expect(amount.idempotency_key).toBe('ads-decision:2026-07-04:scale_amount:AG_SCALE');

    const target = findDecision(snapshot, 'target_ad_groups', 'AG_SCALE');
    expect(target.status).toBe('scale_ready');

    const supplier = findDecision(snapshot, 'supplier_gate', 'SUP_SAFE');
    expect(supplier.status).toBe('safe');
    expect(supplier.proposedValue).toEqual(expect.objectContaining({ action: 'preferredSupplierCandidate' }));

    const productAllocation = findDecision(snapshot, 'product_budget_allocation', 'P_SCALE');
    expect(productAllocation.status).toBe('scale_ready');
    expect(productAllocation.proposedValue).toEqual(expect.objectContaining({ action: 'productScaleCandidate' }));

    const productStop = findDecision(snapshot, 'product_kill_or_stop_review', 'P_BAD');
    expect(productStop.status).toBe('needs_review');
    expect(productStop.proposedValue).toEqual(expect.objectContaining({ action: 'stop_ads_review' }));
    expect(productStop.proposedValue).not.toEqual(expect.objectContaining({ action: 'delete_product' }));
    expect(productStop.proposedValue?.disallowedActions).toContain('delete_product');

    const pause = findDecision(snapshot, 'campaign_or_ad_group_pause', 'AG_PAUSE');
    expect(pause.status).toBe('needs_review');
    expect(pause.proposedValue).toEqual(expect.objectContaining({ action: 'pause_ad_group_draft' }));
    expect(pause.execution_allowed_now).toBe(false);
    expect(pause.rollback_plan).toContain('Resume');
  });

  it('returns insufficient_data with missing fields when mandatory ERP inputs are absent', () => {
    const snapshot = service.build({
      snapshotDate: '2026-07-04',
      adGroups: [
        {
          platform: 'google',
          accountId: '1234567890',
          campaignId: 'CAMP_MISSING',
          adGroupId: 'AG_MISSING',
          resourceName: 'customers/1234567890/adGroups/AG_MISSING',
          currentStatus: 'ENABLED',
          currentBudgetVnd: 300000,
          spendVnd: 50000,
          orders: 2,
          revenueVnd: 400000,
          grossProfitVnd: 160000,
          netProfitAfterAdsVnd: 90000,
          dataQualityScore: 0.7,
          labels: [],
          productIds: ['P_UNKNOWN'],
          bottlenecksChecked: true,
        },
      ],
    });

    const scale = findDecision(snapshot, 'scale_ads', 'AG_MISSING');
    expect(scale.status).toBe('insufficient_data');
    expect(scale.missing_fields).toEqual(expect.arrayContaining([
      'campaignBudgetId_or_campaignBudgetResourceName',
      'policy.availableAdsCashVnd',
      'policy.cashflowGatePassed',
    ]));
    expect(snapshot.categories.product_budget_allocation.status).toBe('insufficient_data');
    expect(snapshot.categories.supplier_gate.status).toBe('insufficient_data');
  });

  it('does not use campaignId or adGroupId as a campaignBudgetId fallback', () => {
    const snapshot = service.build({
      ...baseInput,
      adGroups: [
        {
          ...baseInput.adGroups![0],
          adGroupId: 'AG_NO_BUDGET',
          campaignId: 'CAMP_SHOULD_NOT_BE_BUDGET',
          campaignBudgetId: undefined,
          campaignBudgetResourceName: undefined,
        },
      ],
    });

    const scale = findDecision(snapshot, 'scale_ads', 'AG_NO_BUDGET');
    expect(scale.status).toBe('insufficient_data');
    expect(scale.missing_fields).toContain('campaignBudgetId_or_campaignBudgetResourceName');
    expect(snapshot.decisions.some((item) => item.decision_type === 'scale_amount' && item.entity_id === 'AG_NO_BUDGET')).toBe(false);
  });
});
