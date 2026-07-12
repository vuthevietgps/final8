import { AdsAutomationDecisionFoundationSnapshotService } from './ads-automation-decision-foundation-snapshot.service';
import { ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE } from './ads-automation-decision-foundation-snapshot.fixture';
import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import type {
  AdsAutomationCampaignBudgetReadRow,
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelRepository,
} from './contracts/ads-automation-decision-read-model-query.contract';
import type {
  AdsAutomationAdGroupReadRow,
  AdsAutomationCashflowPolicyReadRow,
  AdsAutomationDecisionSourceKey,
  AdsAutomationProductReadRow,
  AdsAutomationSupplierReadRow,
} from './contracts/ads-automation-decision-source-adapter.contract';

describe('AdsAutomationDecisionFoundationSnapshotService', () => {
  const service = new AdsAutomationDecisionFoundationSnapshotService(new AdsAutomationDecisionService());
  const readModelQuery = new AdsAutomationDecisionReadModelQueryService(
    new AdsAutomationDecisionSourceAdapterService(),
  );
  const evidenceWindow = { from: '2026-06-21', to: '2026-07-04', days: 14 };
  const freshAt = '2026-07-04T04:00:00.000Z';
  const query: AdsAutomationDecisionReadModelQuery = {
    snapshotDate: '2026-07-04',
    evidenceWindow,
    now: '2026-07-04T05:00:00.000Z',
  };

  function readModelRows(overrides: Partial<{
    adGroups: AdsAutomationAdGroupReadRow[];
    campaignBudgets: AdsAutomationCampaignBudgetReadRow[];
    products: AdsAutomationProductReadRow[];
    suppliers: AdsAutomationSupplierReadRow[];
    policy: AdsAutomationCashflowPolicyReadRow;
    watermarks: Partial<Record<AdsAutomationDecisionSourceKey, string>>;
  }> = {}) {
    const base = {
      adGroups: [
        {
          platform: 'google',
          customerId: '1234567890',
          accountId: '1234567890',
          campaignId: '1001',
          campaignName: 'Search - Scale',
          adGroupId: '2001',
          adGroupName: 'Rice cooker winning ad group',
          resourceName: 'customers/1234567890/adGroups/2001',
          campaignBudgetId: '3001',
          campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
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
      watermarks: undefined as Partial<Record<AdsAutomationDecisionSourceKey, string>> | undefined,
    };

    return { ...base, ...overrides };
  }

  function repository(source = readModelRows()): AdsAutomationDecisionReadModelRepository {
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

  async function buildReadModelFoundation(
    source = readModelRows(),
    input: AdsAutomationDecisionReadModelQuery = query,
  ) {
    const readModel = await readModelQuery.buildFromRepository(repository(source), input);
    return service.fromReadModelQueryResult(readModel, input);
  }

  it('exposes the BA decision foundation fields from realistic local ERP fixtures', () => {
    const snapshot = service.build(ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE);

    expect(snapshot.schemaVersion).toBe('ads_automation_decision_foundation_snapshot.v1');
    expect(snapshot.summary.explicit_ba_fields_present).toBe(true);
    expect(snapshot.safety).toEqual({
      read_only: true,
      dry_run: true,
      local_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      production_ready: false,
      approval_required_for_future_actions: true,
      execution_allowed_now: false,
      future_provider_validateOnly_required_before_execution: true,
    });

    expect(snapshot.scale_ads_decision.decision).toBe('increase');
    expect(snapshot.scale_ads_decision.candidates[0]).toEqual(expect.objectContaining({
      entity_id: 'AG_SCALE',
      status: 'scale_ready',
      execution_allowed_now: false,
    }));

    expect(snapshot.scale_amount.total_increase_vnd).toBe(200000);
    expect(snapshot.scale_amount.items[0].proposedValue).toEqual(expect.objectContaining({
      action: 'update_campaign_budget_draft',
      campaignBudgetId: 'BUDGET_SCALE',
      currentBudgetVnd: 1000000,
      proposedBudgetVnd: 1200000,
      increaseVnd: 200000,
      increasePercent: 20,
    }));

    expect(snapshot.target_ad_groups.items[0]).toEqual(expect.objectContaining({
      entity_id: 'AG_SCALE',
      rank: 1,
      status: 'scale_ready',
    }));

    expect(snapshot.product_budget_allocation.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entity_id: 'P_SCALE',
        status: 'scale_ready',
        proposedValue: expect.objectContaining({ action: 'productScaleCandidate' }),
      }),
      expect.objectContaining({
        entity_id: 'P_BAD',
        status: 'blocked',
        blockers: expect.arrayContaining(['product_net_profit_not_positive']),
      }),
    ]));

    expect(snapshot.supplier_gate.safe_suppliers).toEqual([
      expect.objectContaining({
        entity_id: 'SUP_SAFE',
        status: 'safe',
        proposedValue: expect.objectContaining({ action: 'preferredSupplierCandidate' }),
      }),
    ]);
    expect(snapshot.supplier_gate.review_suppliers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entity_id: 'SUP_WEAK_2',
        blockers: expect.arrayContaining(['capacity_blocked', 'quote_not_approved']),
      }),
    ]));

    expect(snapshot.product_kill_review.product_delete_allowed).toBe(false);
    expect(snapshot.product_kill_review.candidates).toEqual([
      expect.objectContaining({
        entity_id: 'P_BAD',
        proposedValue: expect.objectContaining({
          action: 'stop_ads_review',
          disallowedActions: expect.arrayContaining(['delete_product']),
        }),
      }),
    ]);

    expect(snapshot.campaign_or_ad_group_pause_candidates.candidates).toEqual([
      expect.objectContaining({
        entity_id: 'AG_PAUSE',
        proposedValue: expect.objectContaining({ action: 'pause_ad_group_draft' }),
        execution_allowed_now: false,
      }),
    ]);
    expect(snapshot.blockers.global).toEqual(expect.arrayContaining([
      'capacity_blocked',
      'margin_after_cost_below_minimum',
      'return_cancel_refund_rate_too_high',
    ]));
    expect(snapshot.evidence_links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        evidence_link_id: 'evidence:ADSDEC-20260704-scale_amount-AG_SCALE',
        decision_type: 'scale_amount',
        entity_id: 'AG_SCALE',
      }),
      expect.objectContaining({
        decision_type: 'campaign_or_ad_group_pause',
        entity_id: 'AG_PAUSE',
      }),
    ]));
  });

  it('keeps campaignBudgetId mandatory and never falls back to campaignId or adGroupId', () => {
    const snapshot = service.build({
      ...ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE,
      adGroups: [
        {
          ...ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE.adGroups![0],
          adGroupId: 'AG_NO_BUDGET',
          campaignId: 'CAMP_SHOULD_NOT_BE_BUDGET',
          campaignBudgetId: undefined,
          campaignBudgetResourceName: undefined,
        },
      ],
      products: [ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE.products![0]],
      suppliers: [ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE.suppliers![0]],
    });

    expect(snapshot.scale_ads_decision.decision).toBe('insufficient_data');
    expect(snapshot.scale_amount.total_increase_vnd).toBe(0);
    expect(snapshot.scale_amount.items).toEqual([]);
    expect(snapshot.blockers.missing_fields).toContain('campaignBudgetId_or_campaignBudgetResourceName');
    expect(snapshot.evidence_links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        decision_type: 'scale_ads',
        entity_id: 'AG_NO_BUDGET',
      }),
    ]));
    expect(snapshot.evidence_links.some((link) => (
      link.decision_type === 'scale_amount'
      && (link as any).campaignBudgetId === 'CAMP_SHOULD_NOT_BE_BUDGET'
    ))).toBe(false);
  });

  it('builds the BA foundation snapshot from fresh read-model repository rows with evidence', async () => {
    const snapshot = await buildReadModelFoundation();

    expect(snapshot.schemaVersion).toBe('ads_automation_decision_foundation_snapshot.v1');
    expect(snapshot.source).toBe('mongo_read_model');
    expect(snapshot.query).toEqual(query);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(snapshot.scale_ads_decision.decision).toBe('increase');
    expect(snapshot.scale_amount.items[0].proposedValue).toEqual(expect.objectContaining({
      action: 'update_campaign_budget_draft',
      campaignBudgetId: '3001',
      proposedBudgetVnd: 1200000,
    }));
    expect(snapshot.sourceEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        status: 'fresh',
        canUseForDecision: 'yes',
      }),
    ]));
    expect(snapshot.queryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        entityId: '2001',
        status: 'loaded',
        rowCount: 1,
        missingFields: [],
      }),
    ]));
  });

  it('keeps missing read-model campaignBudgetId blocked and never falls back to campaign or ad group IDs', async () => {
    const source = readModelRows({
      adGroups: [
        {
          ...readModelRows().adGroups[0],
          campaignId: '1001',
          adGroupId: '2001',
          campaignBudgetId: undefined,
          campaignBudgetResourceName: undefined,
          currentBudgetVnd: 1000000,
        },
      ],
    });
    const snapshot = await buildReadModelFoundation(source);

    expect(snapshot.scale_ads_decision.decision).toBe('insufficient_data');
    expect(snapshot.scale_amount.total_increase_vnd).toBe(0);
    expect(snapshot.scale_amount.items).toEqual([]);
    expect(snapshot.blockers.missing_fields).toContain('campaignBudgetId_or_campaignBudgetResourceName');
    expect(snapshot.queryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        entityId: '2001',
        status: 'missing',
        missingFields: ['campaignBudgetId_or_campaignBudgetResourceName'],
      }),
    ]));
    expect(snapshot.evidence_links.some((link) => (
      link.decision_type === 'scale_amount'
      && (link as any).campaignBudgetId === '1001'
    ))).toBe(false);
    expect(snapshot.evidence_links.some((link) => (
      link.decision_type === 'scale_amount'
      && (link as any).campaignBudgetId === '2001'
    ))).toBe(false);
  });

  it('surfaces stale read-model source evidence on the foundation response', async () => {
    const staleAt = '2026-06-30T00:00:00.000Z';
    const snapshot = await buildReadModelFoundation(
      readModelRows({
        watermarks: {
          ads_performance: freshAt,
          campaign_budgets: staleAt,
          product_performance: staleAt,
          supplier_safety: freshAt,
          pause_review: freshAt,
          cashflow_policy: freshAt,
        },
      }),
      {
        ...query,
        maxAgeHours: {
          campaign_budgets: 24,
          product_performance: 24,
        },
      },
    );

    expect(snapshot.sourceEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        status: 'stale',
        canUseForDecision: 'cautious',
        latestObservedAt: staleAt,
        maxAgeHours: 24,
      }),
      expect.objectContaining({
        sourceKey: 'product_performance',
        status: 'stale',
        canUseForDecision: 'cautious',
        latestObservedAt: staleAt,
        maxAgeHours: 24,
      }),
    ]));
  });

  it('preserves all explicit BA fields when the foundation snapshot comes from the read model', async () => {
    const snapshot = await buildReadModelFoundation();

    expect(snapshot.summary.explicit_ba_fields_present).toBe(true);
    expect(Object.keys(snapshot)).toEqual(expect.arrayContaining([
      'scale_ads_decision',
      'scale_amount',
      'target_ad_groups',
      'product_budget_allocation',
      'supplier_gate',
      'product_kill_review',
      'campaign_or_ad_group_pause_candidates',
      'blockers',
      'evidence_links',
      'sourceEvidence',
      'missingFieldEvidence',
      'queryEvidence',
    ]));
    expect(snapshot.product_budget_allocation.items[0]).toEqual(expect.objectContaining({
      entity_id: 'P_SCALE',
      status: 'scale_ready',
    }));
    expect(snapshot.supplier_gate.safe_suppliers[0]).toEqual(expect.objectContaining({
      entity_id: 'SUP_SAFE',
      status: 'safe',
    }));
  });
});
