import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import { ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE } from "./ads-automation-readonly-platform-import-readiness.fixture";
import { ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE } from "./ads-automation-loss-limit-policy.fixture";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationLossLimitPolicyService } from "./ads-automation-loss-limit-policy.service";
import type {
  AdsAutomationPlatformSourceSyncStatusResponse,
  AdsAutomationPlatformSourceSyncStatusSourceKey,
} from "./contracts/ads-automation-platform-source-sync-status.contract";
import type { AdsAutomationReadonlyPlatformImportReadinessInput } from "./contracts/ads-automation-readonly-platform-import-readiness.contract";
import type { AdsAutomationCategoryKey } from "./contracts/ads-automation-decision.contract";

type RequiredDecisionSourceKey = Extract<
  AdsAutomationPlatformSourceSyncStatusSourceKey,
  | "google_ads"
  | "advertising_costs"
  | "product_mapping"
  | "inventory_profit"
  | "supplier_safety"
>;

function sourceSyncStatus(
  overrides: Partial<
    AdsAutomationPlatformSourceSyncStatusResponse["summary"]
  > = {},
): AdsAutomationPlatformSourceSyncStatusResponse {
  return {
    schemaVersion: "ads_automation_platform_source_sync_status.v1",
    generatedAt: "2026-07-04T05:00:00.000Z",
    reportDate: "2026-07-04",
    safety: {
      read_only: true,
      dry_run: true,
      local_only: true,
      source_registry_reused: true,
      freshness_gate_reused: true,
      adapter_boundary_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      production_ready: false,
      execution_allowed_now: false,
      google_ads_production_enabled: false,
    },
    summary: {
      status: "ready",
      source_count: 5,
      ready_source_count: 5,
      blocked_source_count: 0,
      blocked_sources: [],
      missing_config_sources: [],
      stale_sources: [],
      missing_coverage_sources: [],
      not_synced_sources: [],
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      next_required_action: "ready_for_ads_automation_decision_review",
      ...overrides,
    },
    decisionGates: {
      canUseGoogleAdsDataClaim: true,
      canGenerateActionDraft: true,
      canRecommendAdsScale: true,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
    decisionEvidence: [
      {
        sourceKey: "google_ads",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: "2026-07-04T04:30:00.000Z",
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: "advertising_costs",
        reportDate: "2026-07-04",
        freshnessStatus: overrides.stale_sources?.includes("advertising_costs")
          ? "stale"
          : "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: null,
        latestRecordDate: "2026-07-04",
        blockingReason: overrides.stale_sources?.includes("advertising_costs")
          ? "advertising_costs_not_ready_for_ads_automation_decision"
          : null,
        blockingReasons: overrides.stale_sources?.includes("advertising_costs")
          ? [
              "advertising_costs_not_ready_for_ads_automation_decision",
              "freshness_stale",
            ]
          : [],
        canUseForAdsAutomationDecision:
          !overrides.stale_sources?.includes("advertising_costs"),
      },
      {
        sourceKey: "product_mapping",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "not_applicable",
        lastSuccessfulSyncAt: null,
        latestRecordDate: null,
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: "inventory_profit",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: null,
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: "supplier_safety",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: null,
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
    ],
    sources: [],
  };
}

function readyInput(
  overrides: Partial<AdsAutomationReadonlyPlatformImportReadinessInput> = {},
): AdsAutomationReadonlyPlatformImportReadinessInput {
  return {
    ...ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE,
    accounts: [
      ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.accounts[0],
    ],
    metricRows:
      ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.metricRows.slice(
        0,
        2,
      ),
    sourceSyncStatus: sourceSyncStatus(),
    decisionSafety: {
      grossMarginSafe: true,
      contributionProfitPositive: true,
      cashConversionWorkingCapitalSafe: true,
      stockCoverageSafe: true,
      supplierReliabilitySafe: true,
      fulfillmentCapacitySafe: true,
      returnRefundRiskSafe: true,
      dataFreshnessSafe: true,
      dailyLossLimitSafe: true,
      monthlyLossLimitSafe: true,
    },
    ...overrides,
  };
}

function blockedRequiredSourceSyncStatus(): AdsAutomationPlatformSourceSyncStatusResponse {
  const result = sourceSyncStatus({
    status: "blocked",
    ready_source_count: 0,
    blocked_source_count: 5,
    blocked_sources: [
      "google_ads",
      "advertising_costs",
      "product_mapping",
      "inventory_profit",
      "supplier_safety",
    ],
    stale_sources: ["google_ads", "inventory_profit"],
    missing_coverage_sources: ["advertising_costs"],
    not_synced_sources: ["product_mapping", "supplier_safety"],
    next_required_action: "resolve_source_sync_blockers",
  });

  result.decisionGates = {
    canUseGoogleAdsDataClaim: false,
    canGenerateActionDraft: false,
    canRecommendAdsScale: false,
    canImportActionFile: false,
    canDryRun: false,
    canExecuteLive: false,
  };
  result.decisionEvidence = [
    {
      sourceKey: "google_ads",
      reportDate: "2026-07-04",
      freshnessStatus: "stale",
      coverageStatus: "covered",
      lastSuccessfulSyncAt: "2026-07-02T04:30:00.000Z",
      latestRecordDate: "2026-07-04",
      blockingReason: "google_ads_not_ready_for_ads_automation_decision",
      blockingReasons: [
        "google_ads_not_ready_for_ads_automation_decision",
        "freshness_stale",
      ],
      canUseForAdsAutomationDecision: false,
    },
    {
      sourceKey: "advertising_costs",
      reportDate: "2026-07-04",
      freshnessStatus: "fresh",
      coverageStatus: "no_records_for_report_date",
      lastSuccessfulSyncAt: null,
      latestRecordDate: null,
      blockingReason: "advertising_costs_not_ready_for_ads_automation_decision",
      blockingReasons: [
        "advertising_costs_not_ready_for_ads_automation_decision",
        "coverage_no_records_for_report_date",
      ],
      canUseForAdsAutomationDecision: false,
    },
    {
      sourceKey: "product_mapping",
      reportDate: "2026-07-04",
      freshnessStatus: "missing",
      coverageStatus: "missing",
      lastSuccessfulSyncAt: null,
      latestRecordDate: null,
      blockingReason: "product_mapping_not_ready_for_ads_automation_decision",
      blockingReasons: [
        "product_mapping_not_ready_for_ads_automation_decision",
        "freshness_missing",
        "coverage_missing",
      ],
      canUseForAdsAutomationDecision: false,
    },
    {
      sourceKey: "inventory_profit",
      reportDate: "2026-07-04",
      freshnessStatus: "stale",
      coverageStatus: "covered",
      lastSuccessfulSyncAt: null,
      latestRecordDate: "2026-07-04",
      blockingReason: "inventory_profit_not_ready_for_ads_automation_decision",
      blockingReasons: [
        "inventory_profit_not_ready_for_ads_automation_decision",
        "freshness_stale",
      ],
      canUseForAdsAutomationDecision: false,
    },
    {
      sourceKey: "supplier_safety",
      reportDate: "2026-07-04",
      freshnessStatus: "missing",
      coverageStatus: "missing",
      lastSuccessfulSyncAt: null,
      latestRecordDate: null,
      blockingReason: "supplier_safety_not_ready_for_ads_automation_decision",
      blockingReasons: [
        "supplier_safety_not_ready_for_ads_automation_decision",
        "freshness_missing",
        "coverage_missing",
      ],
      canUseForAdsAutomationDecision: false,
    },
  ];

  return result;
}

function sourceSyncStatusWithBlockedSource(input: {
  sourceKey: RequiredDecisionSourceKey;
  freshnessStatus: "fresh" | "stale" | "missing";
  coverageStatus: "covered" | "missing" | "no_records_for_report_date";
  blockingReasons: string[];
  latestRecordDate?: string | null;
}): AdsAutomationPlatformSourceSyncStatusResponse {
  const blocker = `${input.sourceKey}_not_ready_for_ads_automation_decision`;
  const result = sourceSyncStatus({
    status: "blocked",
    ready_source_count: 4,
    blocked_source_count: 1,
    blocked_sources: [input.sourceKey],
    stale_sources: input.freshnessStatus === "stale" ? [input.sourceKey] : [],
    missing_coverage_sources:
      input.coverageStatus === "covered" ? [] : [input.sourceKey],
    not_synced_sources:
      input.freshnessStatus === "missing" ? [input.sourceKey] : [],
    next_required_action: "resolve_source_sync_blockers",
  });

  result.decisionGates = {
    canUseGoogleAdsDataClaim: input.sourceKey !== "google_ads",
    canGenerateActionDraft: false,
    canRecommendAdsScale: false,
    canImportActionFile: false,
    canDryRun: false,
    canExecuteLive: false,
  };
  result.decisionEvidence = result.decisionEvidence.map((evidence) =>
    evidence.sourceKey === input.sourceKey
      ? {
          ...evidence,
          freshnessStatus: input.freshnessStatus,
          coverageStatus: input.coverageStatus,
          lastSuccessfulSyncAt:
            input.freshnessStatus === "stale"
              ? "2026-07-02T04:30:00.000Z"
              : null,
          latestRecordDate:
            input.latestRecordDate ??
            (input.coverageStatus === "covered" ? "2026-07-04" : null),
          blockingReason: blocker,
          blockingReasons: [blocker, ...input.blockingReasons],
          canUseForAdsAutomationDecision: false,
        }
      : evidence,
  );

  return result;
}

describe("AdsAutomationReadonlyPlatformImportReadinessService", () => {
  const service = new AdsAutomationReadonlyPlatformImportReadinessService(
    new AdsAutomationDecisionSourceAdapterService(),
    new AdsAutomationDecisionService(),
  );
  const lossLimitPolicy = new AdsAutomationLossLimitPolicyService();

  it("returns local read-only import readiness with account mapping, scheduler window, metrics, and safety flags", () => {
    const result = service.build(readyInput());

    expect(result.schemaVersion).toBe(
      "ads_automation_readonly_platform_import_readiness.v1",
    );
    expect(result.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        fixture_or_payload_only: true,
        persistence_used: false,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
        campaignBudgetId_no_fallback: true,
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_local_decision_review",
        account_count: 1,
        ready_account_count: 1,
        blocked_account_count: 0,
        metric_row_count: 2,
        metric_rows_ready: 2,
        required_source_count: 5,
        required_source_ready_count: 5,
        required_source_blocked_count: 0,
        required_source_report_date_covered_count: 5,
        required_source_report_date_blocked_count: 0,
        missing_required_source_evidence: [],
        source_coverage_blocking_reasons: [],
        campaignBudgetId_missing_rows: 0,
        source_sync_blocker_count: 0,
        cashflow_first_scale_all_safe: true,
        scale_up_execution_mode: "pending_validation",
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "ready_for_local_decision_review",
        source_gate_status: "ready",
        readonly_import_status: "ready",
        read_model_status: "ready",
        readonly_import_blockers: [],
        action_generation_allowed_for_review: true,
        can_generate_action_draft: true,
        can_increase_ads: true,
        max_increase_vnd: 200000,
        scale_up_execution_mode: "pending_validation",
        execution_allowed_now: false,
      }),
    );
    expect(
      result.decisionReadiness.required_source_evidence
        .map((item) => item.sourceKey)
        .sort(),
    ).toEqual([
      "advertising_costs",
      "google_ads",
      "inventory_profit",
      "product_mapping",
      "supplier_safety",
    ]);
    expect(result.sourceImportCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          reportDate: "2026-07-04",
          expectedReportDate: "2026-07-04",
          reportDateMatches: true,
          latestRecordDate: "2026-07-04",
          latestRecordDateCoversReportDate: true,
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "product_mapping",
          coverageStatus: "not_applicable",
          latestRecordDate: null,
          latestRecordDateCoversReportDate: true,
          canUseForAdsAutomationDecision: true,
        }),
      ]),
    );
    expect(result.decisionReadiness.answers).toEqual(
      expect.objectContaining({
        may_increase_ads: true,
        max_increase_vnd: 200000,
        scale_up_execution_mode: "pending_validation",
        supplier_choice_safe: true,
        product_kill_or_stop_review_needed: true,
        campaign_or_ad_group_pause_recommended: true,
        blocking_reasons: [],
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness.answers.ad_groups_to_increase).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          campaignBudgetId: "3001",
          increaseVnd: 200000,
          effectiveStatus: "candidate_for_review",
        }),
      ]),
    );
    expect(
      result.decisionReadiness.answers.products_can_receive_budget,
    ).toEqual([
      expect.objectContaining({
        entityId: "P_SCALE",
        productId: "P_SCALE",
        effectiveStatus: "candidate_for_review",
      }),
    ]);
    expect(
      result.decisionReadiness.answers.blocked_product_budget_candidates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_BAD",
          blockers: expect.arrayContaining(["product_net_profit_not_positive"]),
        }),
      ]),
    );
    expect(result.decisionReadiness.answers.safe_supplier_choices).toEqual([
      expect.objectContaining({
        entityId: "SUP_SAFE",
        supplierId: "SUP_SAFE",
        effectiveStatus: "candidate_for_review",
      }),
    ]);
    expect(result.decisionReadiness.answers.blocked_supplier_choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "SUP_WEAK_1",
          blockers: expect.arrayContaining(["margin_after_cost_below_minimum"]),
        }),
      ]),
    );
    expect(
      result.decisionReadiness.answers.product_kill_or_stop_review,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_BAD",
          proposedAction: "stop_ads_review",
        }),
      ]),
    );
    expect(result.decisionReadiness.answers.campaign_or_ad_group_pause).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2002",
          proposedAction: "pause_ad_group_draft",
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.adGroupsToIncrease).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionType: "scale_amount",
          entityId: "2001",
          effectiveStatus: "candidate_for_review",
          campaignBudgetId: "3001",
          currentBudgetVnd: 1000000,
          proposedBudgetVnd: 1200000,
          increaseVnd: 200000,
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.campaignOrAdGroupPause).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2002",
          proposedAction: "pause_ad_group_draft",
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.productKillOrStopReview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_BAD",
          proposedAction: "stop_ads_review",
          blockers: expect.arrayContaining(["negative_product_economics"]),
        }),
      ]),
    );
    expect(
      result.decisionReadiness.candidates.productsEligibleForBudget,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_SCALE",
          effectiveStatus: "candidate_for_review",
        }),
        expect.objectContaining({
          entityId: "P_BAD",
          status: "blocked",
          blockers: expect.arrayContaining(["product_net_profit_not_positive"]),
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.supplierChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "SUP_SAFE",
          status: "safe",
          effectiveStatus: "candidate_for_review",
        }),
        expect.objectContaining({
          entityId: "SUP_WEAK_1",
          status: "blocked",
          blockers: expect.arrayContaining(["margin_after_cost_below_minimum"]),
        }),
      ]),
    );
    expect(result.accounts[0]).toEqual(
      expect.objectContaining({
        platform: "google_ads",
        accountId: "HTX-GADS-PRIMARY",
        customerId: "1234567890",
        loginCustomerId: "5555555555",
        status: "ready_for_local_decision_review",
        sourceTrustLevel: "erp_local_verified",
        canUseForReadOnlyImport: true,
        canUseForAdsAutomationDecision: true,
        canRecommendAdsScale: false,
        execution_allowed_now: false,
      }),
    );
    expect(result.accounts[0].importWindow).toEqual(
      expect.objectContaining({
        from: "2026-07-03",
        to: "2026-07-04",
        cadence: "hourly",
        maxRangeDays: 31,
      }),
    );
    expect(result.accounts[0].metricCoverage).toEqual(
      expect.objectContaining({
        rows: 2,
        spendVnd: 530000,
        clicks: 226,
        impressions: 10300,
        conversions: 21,
        conversionValueVnd: 6800000,
      }),
    );
    expect(result.metricRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campaignId: "1001",
          adGroupId: "2001",
          campaignBudgetId: "3001",
          spendVnd: 320000,
          clicks: 132,
          impressions: 6200,
          conversions: 13,
          canUseForAdsAutomationDecision: true,
        }),
      ]),
    );
    expect(result.platformEntityCoverage).toEqual(
      expect.objectContaining({
        metrics: expect.objectContaining({
          rows: 2,
          readyRows: 2,
          spendVnd: 530000,
          costVnd: 530000,
          clicks: 226,
          impressions: 10300,
          conversions: 21,
          conversionValueVnd: 6800000,
        }),
        campaigns: expect.objectContaining({
          campaignIds: ["1001", "1002"],
          coveredCampaignCount: 2,
          missingCampaignIdRows: 0,
          coveredForDecision: true,
        }),
        adGroups: expect.objectContaining({
          adGroupIds: ["2001", "2002"],
          coveredAdGroupCount: 2,
          missingAdGroupIdRows: 0,
          coveredForDecision: true,
        }),
        campaignBudgets: expect.objectContaining({
          campaignBudgetIds: ["3001", "3002"],
          missingCampaignBudgetIdRows: 0,
          campaignBudgetId_required: true,
          campaignBudgetId_no_fallback: true,
          campaignBudgetId_fallback_used: false,
          coveredForDecision: true,
        }),
        productMapping: expect.objectContaining({
          mappedProductIds: ["P_BAD", "P_SCALE"],
          mappedAdGroupIds: ["2001", "2002"],
          unmappedAdGroupIds: [],
          sourceReady: true,
          blockers: [],
          coveredForDecision: true,
        }),
        inventoryProfit: expect.objectContaining({
          profitableProductIds: ["P_SCALE"],
          blockedProductIds: ["P_BAD"],
          sourceReady: true,
          blockers: expect.arrayContaining([
            "negative_product_margin",
            "product_net_profit_not_positive",
          ]),
          coveredForDecision: true,
        }),
        supplierContext: expect.objectContaining({
          safeSupplierIds: ["SUP_SAFE"],
          blockedSupplierIds: ["SUP_WEAK_1", "SUP_WEAK_2"],
          supplierChoiceSafe: true,
          sourceReady: true,
          blockers: expect.arrayContaining(["margin_after_cost_below_minimum"]),
          coveredForDecision: true,
        }),
        freshnessCoverage: expect.objectContaining({
          latestSuccessfulSyncAt: "2026-07-04T04:30:00.000Z",
          latestRecordDate: "2026-07-04",
          blockingReasons: [],
        }),
      }),
    );
    expect(result.markdownPreview).toContain("provider_api_called=false");
    expect(result.markdownPreview).toContain("Required sources ready: 5/5");
    expect(result.markdownPreview).toContain(
      "Required sources report-date covered: 5/5",
    );
    expect(result.markdownPreview).toContain("Required source blockers: none");
    expect(result.markdownPreview).toContain("Campaigns covered: 2");
    expect(result.markdownPreview).toContain("Ad groups covered: 2");
    expect(result.markdownPreview).toContain("Product mappings covered: 2");
    expect(result.markdownPreview).toContain("Safe suppliers: 1");
  });

  it("exposes per-entity metric, product, and supplier coverage for local decision review", () => {
    const result = service.build(readyInput());

    expect(result.platformEntityCoverage.adGroups.metricRollups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          campaignIds: ["1001"],
          adGroupIds: ["2001"],
          campaignBudgetIds: ["3001"],
          mappedProductIds: ["P_SCALE"],
          supplierIds: ["SUP_SAFE"],
          dates: ["2026-07-04"],
          reportDateCovered: true,
          rows: 1,
          readyRows: 1,
          spendVnd: 320000,
          costVnd: 320000,
          clicks: 132,
          impressions: 6200,
          conversions: 13,
          conversionValueVnd: 4300000,
          linkedDecisionTypes: expect.arrayContaining(["scale_amount"]),
          linkedDecisionEffectiveStatuses: expect.arrayContaining([
            "candidate_for_review",
          ]),
          coveredForDecision: true,
        }),
        expect.objectContaining({
          entityId: "2002",
          campaignIds: ["1002"],
          adGroupIds: ["2002"],
          campaignBudgetIds: ["3002"],
          mappedProductIds: ["P_BAD"],
          dates: ["2026-07-03"],
          reportDateCovered: false,
          linkedDecisionTypes: expect.arrayContaining([
            "campaign_or_ad_group_pause",
          ]),
          linkedDecisionEffectiveStatuses: expect.arrayContaining([
            "candidate_for_review",
          ]),
          coveredForDecision: true,
        }),
      ]),
    );
    expect(result.platformEntityCoverage.campaignBudgets.metricRollups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "3001",
          adGroupIds: ["2001"],
          mappedProductIds: ["P_SCALE"],
          spendVnd: 320000,
          linkedDecisionTypes: expect.arrayContaining(["scale_amount"]),
          coveredForDecision: true,
        }),
      ]),
    );
    expect(
      result.platformEntityCoverage.productMapping.productMappings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: "P_SCALE",
          mappedAdGroupIds: ["2001"],
          campaignBudgetIds: ["3001"],
          supplierIds: ["SUP_SAFE"],
          coveredForDecision: true,
        }),
        expect.objectContaining({
          productId: "P_BAD",
          mappedAdGroupIds: ["2002"],
          campaignBudgetIds: ["3002"],
          supplierIds: ["SUP_WEAK_1", "SUP_WEAK_2"],
          blockers: expect.arrayContaining([
            "negative_product_margin",
            "product_net_profit_not_positive",
          ]),
          coveredForDecision: true,
        }),
      ]),
    );
    expect(
      result.platformEntityCoverage.inventoryProfit.productReadiness,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: "P_SCALE",
          netProfitVnd: 1250000,
          marginPercent: 45,
          stockAvailable: 120,
          daysOfCover: 20,
          canReceiveBudget: true,
          needsKillOrStopReview: false,
          coveredForDecision: true,
        }),
        expect.objectContaining({
          productId: "P_BAD",
          netProfitVnd: -450000,
          marginPercent: -5,
          canReceiveBudget: false,
          needsKillOrStopReview: true,
          blockers: expect.arrayContaining([
            "negative_product_margin",
            "product_net_profit_not_positive",
          ]),
          coveredForDecision: true,
        }),
      ]),
    );
    expect(
      result.platformEntityCoverage.supplierContext.supplierReadiness,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          supplierId: "SUP_SAFE",
          productId: "P_SCALE",
          quoteApproved: true,
          marginAfterCostPercent: 42,
          leadTimeDays: 4,
          capacityStatus: "available",
          safeForBudgetAllocation: true,
          coveredForDecision: true,
        }),
        expect.objectContaining({
          supplierId: "SUP_WEAK_1",
          productId: "P_BAD",
          quoteApproved: true,
          marginAfterCostPercent: 8,
          leadTimeDays: 14,
          capacityStatus: "constrained",
          safeForBudgetAllocation: false,
          blockers: expect.arrayContaining(["margin_after_cost_below_minimum"]),
          coveredForDecision: true,
        }),
      ]),
    );
    expect(result.decisionReadiness.answers).toEqual(
      expect.objectContaining({
        may_increase_ads: true,
        product_kill_or_stop_review_needed: true,
        supplier_choice_safe: true,
        campaign_or_ad_group_pause_recommended: true,
        execution_allowed_now: false,
      }),
    );
  });

  it("blocks decision readiness when source evidence is marked usable but does not cover the requested report date", () => {
    const mismatchedSourceSyncStatus = sourceSyncStatus();
    mismatchedSourceSyncStatus.decisionEvidence =
      mismatchedSourceSyncStatus.decisionEvidence.map((evidence) =>
        evidence.sourceKey === "google_ads"
          ? {
              ...evidence,
              reportDate: "2026-07-03",
              latestRecordDate: "2026-07-03",
              blockingReason: null,
              blockingReasons: [],
              canUseForAdsAutomationDecision: true,
            }
          : evidence,
      );

    const result = service.build(
      readyInput({
        sourceSyncStatus: mismatchedSourceSyncStatus,
      }),
    );

    expect(result.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_sync_blocker_count: 2,
        required_source_count: 5,
        required_source_ready_count: 4,
        required_source_blocked_count: 1,
        required_source_report_date_covered_count: 4,
        required_source_report_date_blocked_count: 1,
        missing_required_source_evidence: [],
        source_coverage_blocking_reasons: expect.arrayContaining([
          "google_ads_report_date_mismatch",
          "google_ads_latest_record_date_not_report_date",
        ]),
        cashflow_first_scale_all_safe: false,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.sourceImportCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          reportDate: "2026-07-03",
          expectedReportDate: "2026-07-04",
          reportDateMatches: false,
          latestRecordDate: "2026-07-03",
          latestRecordDateCoversReportDate: false,
          blockingReasons: expect.arrayContaining([
            "google_ads_not_ready_for_ads_automation_decision",
            "google_ads_report_date_mismatch",
            "google_ads_latest_record_date_not_report_date",
          ]),
          affectedDecisionCategories: expect.arrayContaining([
            "scale_amount",
            "target_ad_groups",
            "campaign_or_ad_group_pause",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(result.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "blocked",
        readonly_import_status: "blocked",
        read_model_status: "ready",
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness.answers).toEqual(
      expect.objectContaining({
        may_increase_ads: false,
        max_increase_vnd: 0,
        ad_groups_to_increase: [],
        target_ad_groups: [],
        campaign_or_ad_group_pause_recommended: false,
        blocking_reasons: expect.arrayContaining([
          "google_ads_report_date_mismatch",
          "google_ads_latest_record_date_not_report_date",
          "source_sync.google_ads_report_date_mismatch",
          "source_sync.google_ads_latest_record_date_not_report_date",
          "data_freshness_or_coverage_not_safe",
        ]),
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness.decision_categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "scale_amount",
          canGenerateActionDraft: false,
          sourceBlockers: expect.arrayContaining([
            "google_ads_report_date_mismatch",
            "google_ads_latest_record_date_not_report_date",
          ]),
        }),
        expect.objectContaining({
          key: "campaign_or_ad_group_pause",
          canGenerateActionDraft: false,
          sourceBlockers: expect.arrayContaining([
            "google_ads_report_date_mismatch",
          ]),
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.adGroupsToIncrease).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          effectiveStatus: "blocked",
          campaignBudgetId: "3001",
          blockers: expect.arrayContaining([
            "google_ads_report_date_mismatch",
            "google_ads_latest_record_date_not_report_date",
          ]),
          approval_required: true,
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(result.platformEntityCoverage.freshnessCoverage).toEqual(
      expect.objectContaining({
        latestRecordDate: "2026-07-04",
        blockingReasons: expect.arrayContaining([
          "google_ads_report_date_mismatch",
          "google_ads_latest_record_date_not_report_date",
        ]),
      }),
    );
  });

  it("blocks decision readiness when imported ad groups are not covered by product mapping", () => {
    const result = service.build(
      readyInput({
        metricRows: [
          ...readyInput().metricRows,
          {
            platform: "google_ads",
            accountId: "HTX-GADS-PRIMARY",
            customerId: "1234567890",
            campaignId: "1003",
            adGroupId: "2999",
            campaignBudgetId: "3999",
            date: "2026-07-04",
            spendVnd: 125000,
            clicks: 44,
            impressions: 1800,
            conversions: 4,
            conversionValueVnd: 1200000,
          },
        ],
      }),
    );

    expect(result.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        metric_row_count: 3,
        metric_rows_ready: 3,
        campaignBudgetId_missing_rows: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.platformEntityCoverage.productMapping).toEqual(
      expect.objectContaining({
        mappedProductIds: ["P_BAD", "P_SCALE"],
        mappedAdGroupIds: ["2001", "2002"],
        unmappedAdGroupIds: ["2999"],
        sourceReady: true,
        blockers: expect.arrayContaining([
          "product_mapping_unmapped_ad_groups",
        ]),
        coveredForDecision: false,
      }),
    );
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "product_mapping_unmapped_ad_groups",
        "product_mapping_not_covered_for_decision",
      ]),
    );
    expect(result.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "ready",
        readonly_import_status: "blocked",
        read_model_status: "ready",
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness.readonly_import_blockers).toEqual(
      expect.arrayContaining([
        "product_mapping_unmapped_ad_groups",
        "product_mapping_not_covered_for_decision",
      ]),
    );
    expect(result.decisionReadiness.answers).toEqual(
      expect.objectContaining({
        may_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        ad_groups_to_increase: [],
        products_can_receive_budget: [],
        supplier_choice_safe: false,
        blocking_reasons: expect.arrayContaining([
          "product_mapping_unmapped_ad_groups",
          "product_mapping_not_covered_for_decision",
        ]),
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness.candidates.adGroupsToIncrease).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          campaignBudgetId: "3001",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            "product_mapping_unmapped_ad_groups",
            "product_mapping_not_covered_for_decision",
          ]),
        }),
      ]),
    );
    expect(result.markdownPreview).toContain("Decision readiness: blocked");
    expect(result.markdownPreview).toContain(
      "Blockers: product_mapping_not_covered_for_decision, product_mapping_unmapped_ad_groups",
    );
  });

  it("blocks fresh imported metrics when the Google Ads read model omits imported campaign, ad group, or budget rows", () => {
    const input = readyInput();
    const result = service.build(
      readyInput({
        decisionReadModel: {
          ...input.decisionReadModel!,
          adGroups: input.decisionReadModel!.adGroups!.filter(
            (adGroup) => adGroup.adGroupId !== "2001",
          ),
        },
      }),
    );

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        metric_row_count: 2,
        metric_rows_ready: 2,
        source_sync_blocker_count: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "ready",
        readonly_import_status: "blocked",
        read_model_status: "ready",
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.platformEntityCoverage.campaigns).toEqual(
      expect.objectContaining({
        campaignIds: ["1001", "1002"],
        readModelCampaignIds: ["1002"],
        missingReadModelCampaignIds: ["1001"],
        blockers: ["read_model.google_ads_missing_imported_campaigns"],
        coveredForDecision: false,
      }),
    );
    expect(result.platformEntityCoverage.adGroups).toEqual(
      expect.objectContaining({
        adGroupIds: ["2001", "2002"],
        readModelAdGroupIds: ["2002"],
        missingReadModelAdGroupIds: ["2001"],
        blockers: ["read_model.google_ads_missing_imported_ad_groups"],
        coveredForDecision: false,
      }),
    );
    expect(result.platformEntityCoverage.campaignBudgets).toEqual(
      expect.objectContaining({
        campaignBudgetIds: ["3001", "3002"],
        readModelCampaignBudgetIds: ["3002"],
        missingReadModelCampaignBudgetIds: ["3001"],
        blockers: ["read_model.campaign_budgets_missing_imported_budget_ids"],
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        coveredForDecision: false,
      }),
    );
    expect(result.decisionReadiness.readonly_import_blockers).toEqual(
      expect.arrayContaining([
        "read_model.campaign_budgets_missing_imported_budget_ids",
        "read_model.google_ads_missing_imported_ad_groups",
        "read_model.google_ads_missing_imported_campaigns",
      ]),
    );
    expect(result.decisionReadiness.answers).toEqual(
      expect.objectContaining({
        may_increase_ads: false,
        ad_groups_to_increase: [],
        supplier_choice_safe: false,
        blocking_reasons: expect.arrayContaining([
          "read_model.campaign_budgets_missing_imported_budget_ids",
          "read_model.google_ads_missing_imported_ad_groups",
          "read_model.google_ads_missing_imported_campaigns",
        ]),
        execution_allowed_now: false,
      }),
    );
  });

  it("blocks mapped product and supplier allocation gaps even when source-sync evidence is fresh", () => {
    const input = readyInput();
    const [scaleAdGroup, pauseAdGroup] = input.decisionReadModel!.adGroups!;
    const [scaleProduct] = input.decisionReadModel!.products!;
    const [safeSupplier] = input.decisionReadModel!.suppliers!;
    const supplierGapProduct = {
      ...scaleProduct,
      productId: "P_SUP_ALLOC",
      sku: "SKU-SUP-ALLOC",
      productName: "Supplier allocation fixture",
      mappedAdGroupIds: ["2002"],
      supplierIds: ["SUP_MISSING"],
    };

    const result = service.build(
      readyInput({
        decisionReadModel: {
          ...input.decisionReadModel!,
          adGroups: [
            {
              ...scaleAdGroup,
              productIds: ["P_SCALE"],
            },
            {
              ...pauseAdGroup,
              productIds: ["P_SUP_ALLOC"],
            },
          ],
          products: [supplierGapProduct],
          suppliers: [
            {
              ...safeSupplier,
              productId: "P_OTHER",
              supplierId: "SUP_OTHER",
            },
          ],
        },
      }),
    );

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_sync_blocker_count: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(
      result.sourceImportCoverage.every(
        (source) => source.canUseForAdsAutomationDecision === true,
      ),
    ).toBe(true);
    expect(result.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "ready",
        readonly_import_status: "blocked",
        read_model_status: "ready",
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.platformEntityCoverage.productMapping).toEqual(
      expect.objectContaining({
        mappedProductIds: ["P_SCALE", "P_SUP_ALLOC"],
        mappedAdGroupIds: ["2001", "2002"],
        unmappedAdGroupIds: [],
        sourceReady: true,
        coveredForDecision: true,
      }),
    );
    expect(result.platformEntityCoverage.inventoryProfit).toEqual(
      expect.objectContaining({
        missingMappedProductIds: ["P_SCALE"],
        sourceReady: true,
        blockers: expect.arrayContaining([
          "read_model.inventory_profit_missing_mapped_products",
        ]),
        coveredForDecision: false,
      }),
    );
    expect(result.platformEntityCoverage.supplierContext).toEqual(
      expect.objectContaining({
        safeSupplierIds: ["SUP_OTHER"],
        missingMappedSupplierIds: ["SUP_MISSING"],
        sourceReady: true,
        blockers: expect.arrayContaining([
          "read_model.supplier_safety_missing_mapped_suppliers",
        ]),
        coveredForDecision: false,
      }),
    );
    expect(result.decisionReadiness.readonly_import_blockers).toEqual(
      expect.arrayContaining([
        "read_model.inventory_profit_missing_mapped_products",
        "read_model.supplier_safety_missing_mapped_suppliers",
      ]),
    );
    expect(result.decisionReadiness.answers).toEqual(
      expect.objectContaining({
        may_increase_ads: false,
        products_can_receive_budget: [],
        supplier_choice_safe: false,
        blocking_reasons: expect.arrayContaining([
          "read_model.inventory_profit_missing_mapped_products",
          "read_model.supplier_safety_missing_mapped_suppliers",
        ]),
        execution_allowed_now: false,
      }),
    );
  });

  it("blocks a ready-labeled source-sync envelope when required decision evidence is omitted", () => {
    const incompleteSourceSyncStatus = sourceSyncStatus();
    incompleteSourceSyncStatus.decisionEvidence =
      incompleteSourceSyncStatus.decisionEvidence.filter(
        (evidence) =>
          !["product_mapping", "supplier_safety"].includes(evidence.sourceKey),
      );

    const result = service.build(
      readyInput({
        sourceSyncStatus: incompleteSourceSyncStatus,
      }),
    );
    const productMappingMissing =
      "product_mapping_source_evidence_missing_for_ads_automation_decision";
    const supplierSafetyMissing =
      "supplier_safety_source_evidence_missing_for_ads_automation_decision";

    expect(result.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_sync_blocker_count: 2,
        required_source_count: 5,
        required_source_ready_count: 3,
        required_source_blocked_count: 2,
        required_source_report_date_covered_count: 3,
        required_source_report_date_blocked_count: 2,
        missing_required_source_evidence: [
          "product_mapping",
          "supplier_safety",
        ],
        source_coverage_blocking_reasons: expect.arrayContaining([
          productMappingMissing,
          supplierSafetyMissing,
        ]),
        cashflow_first_scale_all_safe: false,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.sourceSyncSummary).toEqual(
      expect.objectContaining({
        status: "ready",
        blocked_sources: [],
        stale_sources: [],
        missing_coverage_sources: [],
        not_synced_sources: [],
      }),
    );
    expect(result.sourceImportCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "product_mapping",
          freshnessStatus: "missing",
          coverageStatus: "missing",
          lastSuccessfulSyncAt: null,
          latestRecordDate: null,
          blockingReason: productMappingMissing,
          blockingReasons: [productMappingMissing],
          affectedDecisionCategories: expect.arrayContaining([
            "product_budget_allocation",
            "product_kill_or_stop_review",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          freshnessStatus: "missing",
          coverageStatus: "missing",
          lastSuccessfulSyncAt: null,
          latestRecordDate: null,
          blockingReason: supplierSafetyMissing,
          blockingReasons: [supplierSafetyMissing],
          affectedDecisionCategories: expect.arrayContaining([
            "supplier_gate",
            "product_budget_allocation",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(result.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "blocked",
        readonly_import_status: "blocked",
        read_model_status: "ready",
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness.source_gate_blockers).toEqual(
      expect.arrayContaining([productMappingMissing, supplierSafetyMissing]),
    );
    expect(result.decisionReadiness.answers).toEqual(
      expect.objectContaining({
        may_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        ad_groups_to_increase: [],
        target_ad_groups: [],
        products_can_receive_budget: [],
        supplier_choice_safe: false,
        safe_supplier_choices: [],
        product_kill_or_stop_review_needed: false,
        campaign_or_ad_group_pause_recommended: false,
        blocking_reasons: expect.arrayContaining([
          productMappingMissing,
          supplierSafetyMissing,
          `source_sync.${productMappingMissing}`,
          `source_sync.${supplierSafetyMissing}`,
          "data_freshness_or_coverage_not_safe",
        ]),
        execution_allowed_now: false,
      }),
    );
    expect(
      result.decisionReadiness.answers.blocked_product_budget_candidates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_SCALE",
          blockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
        }),
      ]),
    );
    expect(result.decisionReadiness.answers.blocked_supplier_choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "SUP_SAFE",
          blockers: expect.arrayContaining([supplierSafetyMissing]),
        }),
      ]),
    );
    expect(result.decisionReadiness.readonly_import_blockers).toEqual(
      expect.arrayContaining([
        `source_sync.${productMappingMissing}`,
        `source_sync.${supplierSafetyMissing}`,
      ]),
    );
    expect(result.decisionReadiness.source_to_decision_blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "product_mapping",
          blockedCategories: expect.arrayContaining([
            "scale_amount",
            "product_budget_allocation",
            "product_kill_or_stop_review",
          ]),
          blockingReasons: [productMappingMissing],
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          blockedCategories: expect.arrayContaining([
            "scale_amount",
            "supplier_gate",
            "product_budget_allocation",
          ]),
          blockingReasons: [supplierSafetyMissing],
        }),
      ]),
    );
    expect(result.decisionReadiness.decision_categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "scale_amount",
          canGenerateActionDraft: false,
          sourceBlockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
        }),
        expect.objectContaining({
          key: "product_budget_allocation",
          canGenerateActionDraft: false,
          sourceBlockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
        }),
        expect.objectContaining({
          key: "supplier_gate",
          canGenerateActionDraft: false,
          sourceBlockers: expect.arrayContaining([supplierSafetyMissing]),
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.adGroupsToIncrease).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          status: "scale_ready",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
        }),
      ]),
    );
    expect(
      result.decisionReadiness.candidates.productsEligibleForBudget,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_SCALE",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.supplierChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "SUP_SAFE",
          status: "safe",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([supplierSafetyMissing]),
        }),
      ]),
    );
  });

  it("blocks stale or missing imports and retry backoff without calling any provider or live collaborator", () => {
    const provider = {
      syncReadOnly: jest.fn(),
      validateOnly: jest.fn(),
      executeLive: jest.fn(),
    };

    const result = service.build({
      ...ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE,
      sourceSyncStatus: sourceSyncStatus({
        status: "blocked",
        blocked_source_count: 1,
        ready_source_count: 4,
        blocked_sources: ["advertising_costs"],
        stale_sources: ["advertising_costs"],
        next_required_action: "resolve_source_sync_blockers",
      }),
    });

    expect(provider.syncReadOnly).not.toHaveBeenCalled();
    expect(provider.validateOnly).not.toHaveBeenCalled();
    expect(provider.executeLive).not.toHaveBeenCalled();
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        ready_account_count: 0,
        blocked_account_count: 2,
        stale_or_missing_imports: expect.arrayContaining([
          "HTX-GADS-SECONDARY",
        ]),
        retry_blocked_accounts: ["HTX-GADS-SECONDARY"],
        source_sync_blocker_count: 1,
        scale_up_execution_mode: "monitor_only",
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(result.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: "HTX-GADS-SECONDARY",
          status: "blocked",
          freshness: expect.objectContaining({ status: "stale" }),
          coverage: expect.objectContaining({ status: "partial" }),
          retryBackoffState: expect.objectContaining({
            status: "retry_scheduled",
            nextRetryAt: "2026-07-04T06:00:00.000Z",
            backoffMs: 3600000,
          }),
          blockers: expect.arrayContaining([
            "freshness_stale",
            "coverage_partial",
            "retry_state_retry_scheduled",
            "source_sync.advertising_costs_not_ready",
          ]),
        }),
      ]),
    );
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "source_sync.advertising_costs_not_ready",
        "data_freshness_or_coverage_not_safe",
        "daily_loss_limit_missing",
        "monthly_loss_limit_missing",
      ]),
    );
  });

  it("blocks decision readiness when required source gates are stale, missing, or uncovered", () => {
    const result = service.build(
      readyInput({
        sourceSyncStatus: blockedRequiredSourceSyncStatus(),
      }),
    );

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_sync_blocker_count: 5,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.sourceSyncSummary).toEqual(
      expect.objectContaining({
        status: "blocked",
        blocked_sources: [
          "google_ads",
          "advertising_costs",
          "product_mapping",
          "inventory_profit",
          "supplier_safety",
        ],
        stale_sources: ["google_ads", "inventory_profit"],
        missing_coverage_sources: ["advertising_costs"],
        not_synced_sources: ["product_mapping", "supplier_safety"],
      }),
    );
    expect(result.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "blocked",
        read_model_status: "ready",
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness.source_gate_blockers).toEqual(
      expect.arrayContaining([
        "google_ads_not_ready_for_ads_automation_decision",
        "advertising_costs_not_ready_for_ads_automation_decision",
        "product_mapping_not_ready_for_ads_automation_decision",
        "inventory_profit_not_ready_for_ads_automation_decision",
        "supplier_safety_not_ready_for_ads_automation_decision",
      ]),
    );
    expect(result.decisionReadiness.source_to_decision_blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          blockedCategories: expect.arrayContaining([
            "scale_ads",
            "scale_amount",
            "target_ad_groups",
            "campaign_or_ad_group_pause",
          ]),
        }),
        expect.objectContaining({
          sourceKey: "product_mapping",
          blockedCategories: expect.arrayContaining([
            "product_budget_allocation",
            "product_kill_or_stop_review",
          ]),
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          blockedCategories: expect.arrayContaining([
            "supplier_gate",
            "product_budget_allocation",
          ]),
        }),
      ]),
    );
    expect(result.decisionReadiness.decision_categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "scale_amount",
          canGenerateActionDraft: false,
          sourceBlockers: expect.arrayContaining([
            "google_ads_not_ready_for_ads_automation_decision",
            "advertising_costs_not_ready_for_ads_automation_decision",
            "product_mapping_not_ready_for_ads_automation_decision",
            "inventory_profit_not_ready_for_ads_automation_decision",
            "supplier_safety_not_ready_for_ads_automation_decision",
          ]),
        }),
        expect.objectContaining({
          key: "product_kill_or_stop_review",
          canGenerateActionDraft: false,
          sourceBlockers: expect.arrayContaining([
            "product_mapping_not_ready_for_ads_automation_decision",
            "inventory_profit_not_ready_for_ads_automation_decision",
          ]),
        }),
        expect.objectContaining({
          key: "supplier_gate",
          canGenerateActionDraft: false,
          sourceBlockers: expect.arrayContaining([
            "supplier_safety_not_ready_for_ads_automation_decision",
          ]),
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.adGroupsToIncrease).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          status: "scale_ready",
          effectiveStatus: "blocked",
          campaignBudgetId: "3001",
          blockers: expect.arrayContaining([
            "google_ads_not_ready_for_ads_automation_decision",
            "advertising_costs_not_ready_for_ads_automation_decision",
            "supplier_safety_not_ready_for_ads_automation_decision",
          ]),
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.productKillOrStopReview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_BAD",
          status: "needs_review",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            "product_mapping_not_ready_for_ads_automation_decision",
            "inventory_profit_not_ready_for_ads_automation_decision",
          ]),
        }),
      ]),
    );
  });

  it.each([
    {
      sourceKey: "google_ads" as const,
      freshnessStatus: "stale" as const,
      coverageStatus: "covered" as const,
      blockingReasons: ["freshness_stale"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "campaign_or_ad_group_pause",
      ] as AdsAutomationCategoryKey[],
      candidateGroup: "campaignOrAdGroupPause" as const,
      candidateEntityId: "2002",
    },
    {
      sourceKey: "advertising_costs" as const,
      freshnessStatus: "fresh" as const,
      coverageStatus: "no_records_for_report_date" as const,
      blockingReasons: ["coverage_no_records_for_report_date"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "campaign_or_ad_group_pause",
      ] as AdsAutomationCategoryKey[],
      candidateGroup: "adGroupsToIncrease" as const,
      candidateEntityId: "2001",
    },
    {
      sourceKey: "product_mapping" as const,
      freshnessStatus: "missing" as const,
      coverageStatus: "missing" as const,
      blockingReasons: ["freshness_missing", "coverage_missing"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "product_budget_allocation",
        "product_kill_or_stop_review",
      ] as AdsAutomationCategoryKey[],
      candidateGroup: "productKillOrStopReview" as const,
      candidateEntityId: "P_BAD",
    },
    {
      sourceKey: "inventory_profit" as const,
      freshnessStatus: "stale" as const,
      coverageStatus: "covered" as const,
      blockingReasons: ["freshness_stale"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "product_budget_allocation",
        "product_kill_or_stop_review",
      ] as AdsAutomationCategoryKey[],
      candidateGroup: "productsEligibleForBudget" as const,
      candidateEntityId: "P_SCALE",
    },
    {
      sourceKey: "supplier_safety" as const,
      freshnessStatus: "missing" as const,
      coverageStatus: "missing" as const,
      blockingReasons: ["freshness_missing", "coverage_missing"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "product_budget_allocation",
        "supplier_gate",
      ] as AdsAutomationCategoryKey[],
      candidateGroup: "supplierChoices" as const,
      candidateEntityId: "SUP_SAFE",
    },
  ])(
    "maps $sourceKey source gaps to blocked decision categories and local candidates",
    (scenario) => {
      const result = service.build(
        readyInput({
          sourceSyncStatus: sourceSyncStatusWithBlockedSource(scenario),
        }),
      );
      const blocker = `${scenario.sourceKey}_not_ready_for_ads_automation_decision`;

      expect(result.safety).toEqual(
        expect.objectContaining({
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          GOOGLE_ADS_PRODUCTION_ENABLED: false,
        }),
      );
      expect(result.summary).toEqual(
        expect.objectContaining({
          status: "blocked",
          source_sync_blocker_count: 1,
          cashflow_first_scale_all_safe: false,
          scale_up_execution_mode: "monitor_only",
          execution_allowed_now: false,
        }),
      );
      expect(result.decisionReadiness).toEqual(
        expect.objectContaining({
          status: "blocked",
          source_gate_status: "blocked",
          readonly_import_status: "blocked",
          read_model_status: "ready",
          action_generation_allowed_for_review: false,
          can_generate_action_draft: false,
          can_increase_ads: false,
          max_increase_vnd: 0,
          scale_up_execution_mode: "monitor_only",
          execution_allowed_now: false,
        }),
      );
      expect(result.decisionReadiness.answers).toEqual(
        expect.objectContaining({
          may_increase_ads: false,
          max_increase_vnd: 0,
          scale_up_execution_mode: "monitor_only",
          ad_groups_to_increase: [],
          target_ad_groups: [],
          products_can_receive_budget: [],
          supplier_choice_safe: false,
          safe_supplier_choices: [],
          product_kill_or_stop_review_needed: false,
          campaign_or_ad_group_pause_recommended: false,
          blocking_reasons: expect.arrayContaining([
            blocker,
            `source_sync.${scenario.sourceKey}_not_ready`,
            "data_freshness_or_coverage_not_safe",
          ]),
          execution_allowed_now: false,
        }),
      );
      expect(result.decisionReadiness.readonly_import_blockers).toEqual(
        expect.arrayContaining([`source_sync.${scenario.sourceKey}_not_ready`]),
      );
      expect(result.sourceImportCoverage).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceKey: scenario.sourceKey,
            freshnessStatus: scenario.freshnessStatus,
            coverageStatus: scenario.coverageStatus,
            blockingReason: blocker,
            blockingReasons: expect.arrayContaining([
              blocker,
              ...scenario.blockingReasons,
            ]),
            affectedDecisionCategories: expect.arrayContaining(
              scenario.blockedCategories,
            ),
            canUseForAdsAutomationDecision: false,
          }),
        ]),
      );
      expect(result.platformEntityCoverage.freshnessCoverage).toEqual(
        expect.objectContaining({
          blockingReasons: expect.arrayContaining([blocker]),
        }),
      );
      expect(result.platformEntityCoverage.campaignBudgets).toEqual(
        expect.objectContaining({
          campaignBudgetId_no_fallback: true,
          campaignBudgetId_fallback_used: false,
        }),
      );
      if (scenario.sourceKey === "product_mapping") {
        expect(result.platformEntityCoverage.productMapping).toEqual(
          expect.objectContaining({
            sourceReady: false,
            blockers: expect.arrayContaining([blocker]),
            coveredForDecision: false,
          }),
        );
      }
      if (scenario.sourceKey === "inventory_profit") {
        expect(result.platformEntityCoverage.inventoryProfit).toEqual(
          expect.objectContaining({
            sourceReady: false,
            blockers: expect.arrayContaining([blocker]),
            coveredForDecision: false,
          }),
        );
      }
      if (scenario.sourceKey === "supplier_safety") {
        expect(result.platformEntityCoverage.supplierContext).toEqual(
          expect.objectContaining({
            sourceReady: false,
            blockers: expect.arrayContaining([blocker]),
            coveredForDecision: false,
          }),
        );
      }
      expect(result.decisionReadiness.source_to_decision_blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceKey: scenario.sourceKey,
            blockedCategories: expect.arrayContaining(
              scenario.blockedCategories,
            ),
            blockingReasons: expect.arrayContaining([
              blocker,
              ...scenario.blockingReasons,
            ]),
          }),
        ]),
      );
      for (const category of scenario.blockedCategories) {
        expect(result.decisionReadiness.decision_categories).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: category,
              canGenerateActionDraft: false,
              sourceBlockers: expect.arrayContaining([blocker]),
            }),
          ]),
        );
      }
      expect(
        result.decisionReadiness.candidates[scenario.candidateGroup],
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entityId: scenario.candidateEntityId,
            effectiveStatus: "blocked",
            blockers: expect.arrayContaining([blocker]),
            approval_required: true,
            execution_allowed_now: false,
          }),
        ]),
      );
    },
  );

  it("blocks account/customer mapping and production-enabled payloads without exposing execution gates", () => {
    const input = readyInput({
      accounts: [
        {
          ...readyInput().accounts[0],
          accountId: null,
          customerId: "bad-customer",
          isActive: false,
          approvedForReadOnlyImport: false,
          configuredForReadOnlyImport: false,
          googleAdsProductionEnabled: true,
          sourceTrustLevel: "unknown",
        },
      ],
      metricRows: [
        {
          ...readyInput().metricRows[0],
          accountId: null,
          customerId: "bad-customer",
        },
      ],
    });

    const result = service.build(input);

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        missing_account_mapping: ["unmapped_account"],
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.safety).toEqual(
      expect.objectContaining({
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.accounts[0].blockers).toEqual(
      expect.arrayContaining([
        "account_mapping.accountId_missing",
        "account_mapping.customerId_missing_or_malformed",
        "account_mapping.account_not_active",
        "account_mapping.readonly_import_not_approved",
        "account_mapping.readonly_import_not_configured",
        "GOOGLE_ADS_PRODUCTION_ENABLED_must_be_false_or_absent",
        "source_trust_level_not_verified",
      ]),
    );
  });

  it("requires campaignBudgetId and never falls back to campaignId or adGroupId", () => {
    const result = service.build(
      readyInput({
        metricRows: [
          {
            ...readyInput().metricRows[0],
            campaignId: "1001",
            adGroupId: "2001",
            campaignBudgetId: null,
          },
        ],
        accounts: [
          {
            ...readyInput().accounts[0],
            importWindow: {
              ...readyInput().accounts[0].importWindow,
              from: "2026-07-04",
              to: "2026-07-04",
            },
          },
        ],
      }),
    );

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        campaignBudgetId_missing_rows: 1,
      }),
    );
    expect(result.metricRows[0]).toEqual(
      expect.objectContaining({
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        blockers: ["campaignBudgetId_missing_no_fallback"],
        canUseForAdsAutomationDecision: false,
      }),
    );
    expect(result.metricRows[0].campaignBudgetId).not.toBe("1001");
    expect(result.metricRows[0].campaignBudgetId).not.toBe("2001");
    expect(result.safety.campaignBudgetId_no_fallback).toBe(true);
    expect(result.platformEntityCoverage.campaignBudgets).toEqual(
      expect.objectContaining({
        campaignBudgetIds: [],
        missingCampaignBudgetIdRows: 1,
        campaignBudgetId_required: true,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        blockers: ["campaignBudgetId_missing_no_fallback"],
        coveredForDecision: false,
      }),
    );
    expect(result.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "ready",
        readonly_import_status: "blocked",
        read_model_status: "ready",
        readonly_import_blockers: ["campaignBudgetId_missing_no_fallback"],
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionReadiness.decision_categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "scale_amount",
          canGenerateActionDraft: false,
          readonlyImportBlockers: ["campaignBudgetId_missing_no_fallback"],
        }),
        expect.objectContaining({
          key: "campaign_or_ad_group_pause",
          canGenerateActionDraft: false,
          readonlyImportBlockers: ["campaignBudgetId_missing_no_fallback"],
        }),
      ]),
    );
    expect(result.decisionReadiness.candidates.adGroupsToIncrease).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          status: "scale_ready",
          effectiveStatus: "blocked",
          campaignBudgetId: "3001",
          blockers: expect.arrayContaining([
            "campaignBudgetId_missing_no_fallback",
          ]),
        }),
      ]),
    );
  });

  it("downgrades otherwise ready import data to monitor-only when cashflow-first safety is missing", () => {
    const result = service.build(
      readyInput({
        decisionSafety: {
          grossMarginSafe: true,
          contributionProfitPositive: true,
          stockCoverageSafe: true,
          returnRefundRiskSafe: true,
          dataFreshnessSafe: true,
        },
      }),
    );

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        ready_account_count: 1,
        cashflow_first_scale_all_safe: false,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.cashflowFirstGate).toEqual(
      expect.objectContaining({
        all_safe: false,
        scale_up_execution_mode: "monitor_only",
        can_recommend_scale_from_import_readiness: false,
        execution_allowed_now: false,
      }),
    );
    expect(result.cashflowFirstGate.blockers).toEqual(
      expect.arrayContaining([
        "cash_conversion_or_working_capital_health_missing",
        "supplier_reliability_missing_or_unsafe",
        "fulfillment_capacity_missing",
        "daily_loss_limit_missing",
        "monthly_loss_limit_missing",
      ]),
    );
  });

  it("integrates local loss-limit policy evidence into import readiness scale blockers", () => {
    const policy = lossLimitPolicy.build(
      ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE,
    );
    const result = service.build(
      readyInput({
        lossLimitPolicy: policy,
        decisionSafety: {
          grossMarginSafe: true,
          contributionProfitPositive: true,
          cashConversionWorkingCapitalSafe: true,
          stockCoverageSafe: true,
          supplierReliabilitySafe: true,
          fulfillmentCapacitySafe: true,
          returnRefundRiskSafe: true,
          dataFreshnessSafe: true,
          dailyLossLimitSafe: true,
          monthlyLossLimitSafe: true,
        },
      }),
    );

    expect(result.lossLimitPolicy).toEqual(
      expect.objectContaining({
        schemaVersion: "ads_automation_loss_limit_policy.v1",
        summary: expect.objectContaining({
          all_safe_for_increase: false,
          scale_up_execution_mode: "monitor_only",
          daily_loss_limit_safe: false,
          monthly_loss_limit_safe: false,
          spend_caps_safe: false,
        }),
        scaleBlockers: expect.arrayContaining([
          "daily_loss_limit_breached",
          "monthly_loss_limit_breached",
          "campaign.1001.daily_spend_cap_exceeded",
        ]),
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        cashflow_first_scale_all_safe: false,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(result.cashflowFirstGate.blockers).toEqual(
      expect.arrayContaining([
        "daily_loss_limit_breached",
        "monthly_loss_limit_breached",
        "spend_caps_missing_or_unsafe",
        "campaign.1001.daily_spend_cap_exceeded",
        "contribution_profit_missing_or_unsafe",
        "cash_conversion_or_working_capital_health_missing",
      ]),
    );
  });
});
