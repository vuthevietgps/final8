import type {
  AdsAutomationCampaignBudgetReadRow,
  AdsAutomationDecisionReadModelQuery,
} from './contracts/ads-automation-decision-read-model-query.contract';
import type {
  AdsAutomationAdGroupReadRow,
  AdsAutomationCashflowPolicyReadRow,
  AdsAutomationDecisionSourceKey,
  AdsAutomationProductReadRow,
  AdsAutomationSupplierReadRow,
} from './contracts/ads-automation-decision-source-adapter.contract';

export type AdsAutomationDecisionFoundationReviewExportFixtureScenario =
  | 'ready_for_review'
  | 'missing_campaign_budget'
  | 'stale_sources';

export interface AdsAutomationDecisionFoundationReviewExportFixtureRows {
  adGroups: AdsAutomationAdGroupReadRow[];
  campaignBudgets: AdsAutomationCampaignBudgetReadRow[];
  products: AdsAutomationProductReadRow[];
  suppliers: AdsAutomationSupplierReadRow[];
  policy: AdsAutomationCashflowPolicyReadRow;
  watermarks: Partial<Record<AdsAutomationDecisionSourceKey, string>>;
}

export const ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY: AdsAutomationDecisionReadModelQuery = {
  snapshotDate: '2026-07-04',
  evidenceWindow: { from: '2026-06-21', to: '2026-07-04', days: 14 },
  customerIds: ['1234567890'],
  productIds: ['P_SCALE'],
  maxAgeHours: { campaign_budgets: 24, product_performance: 24 },
  now: '2026-07-04T05:00:00.000Z',
};

export function buildAdsAutomationDecisionFoundationReviewExportFixtureRows(
  scenario: AdsAutomationDecisionFoundationReviewExportFixtureScenario = 'ready_for_review',
): AdsAutomationDecisionFoundationReviewExportFixtureRows {
  const freshAt = '2026-07-04T04:00:00.000Z';
  const staleAt = '2026-06-30T00:00:00.000Z';
  const missingCampaignBudget = scenario === 'missing_campaign_budget';
  const staleSources = scenario === 'stale_sources';

  return {
    adGroups: [
      {
        platform: 'google',
        customerId: '1234567890',
        accountId: '1234567890',
        campaignId: '1001',
        campaignName: 'Search - Rice Cooker Scale',
        adGroupId: '2001',
        adGroupName: 'Rice cooker winning ad group',
        resourceName: 'customers/1234567890/adGroups/2001',
        campaignBudgetId: missingCampaignBudget ? undefined : '3001',
        campaignBudgetResourceName: missingCampaignBudget
          ? undefined
          : 'customers/1234567890/campaignBudgets/3001',
        currentBudgetVnd: missingCampaignBudget ? 1000000 : undefined,
        status: 'ENABLED',
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
        internalProductIds: ['P_SCALE'],
        bottlenecksChecked: true,
        lastSyncAt: freshAt,
      },
    ],
    campaignBudgets: missingCampaignBudget
      ? []
      : [
          {
            customerId: '1234567890',
            campaignBudgetId: '3001',
            resourceName: 'customers/1234567890/campaignBudgets/3001',
            amountVnd: 1000000,
            status: 'ENABLED',
            lastSyncAt: staleSources ? staleAt : freshAt,
          },
        ],
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
        updatedAt: staleSources ? staleAt : freshAt,
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
        updatedAt: freshAt,
      },
    ],
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
    },
    watermarks: {
      ads_performance: freshAt,
      campaign_budgets: staleSources ? staleAt : freshAt,
      product_performance: staleSources ? staleAt : freshAt,
      supplier_safety: freshAt,
      pause_review: freshAt,
      cashflow_policy: freshAt,
    },
  };
}
