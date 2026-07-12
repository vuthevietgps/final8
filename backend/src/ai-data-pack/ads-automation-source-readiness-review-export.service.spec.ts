import {
  ADS_AUTOMATION_SOURCE_READINESS_REVIEW_EXPORT_FIXTURE,
  buildAdsAutomationSourceReadinessReviewFixtureInput,
  buildAdsAutomationSourceReadinessReviewSourceSyncStatus,
} from "./ads-automation-source-readiness-review-export.fixture";
import { AdsAutomationSourceReadinessReviewExportService } from "./ads-automation-source-readiness-review-export.service";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import { ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE } from "./ads-automation-readonly-platform-import-readiness.fixture";
import type { AdsAutomationPlatformSourceSyncStatusResponse } from "./contracts/ads-automation-platform-source-sync-status.contract";

function allReadySourceSyncStatus(): AdsAutomationPlatformSourceSyncStatusResponse {
  const status = buildAdsAutomationSourceReadinessReviewSourceSyncStatus();
  status.summary = {
    ...status.summary,
    status: "ready",
    ready_source_count: 5,
    blocked_source_count: 0,
    blocked_sources: [],
    stale_sources: [],
    missing_coverage_sources: [],
    not_synced_sources: [],
    next_required_action: "ready_for_ads_automation_decision_review",
  };
  status.decisionGates = {
    ...status.decisionGates,
    canGenerateActionDraft: true,
    canRecommendAdsScale: true,
  };
  status.decisionEvidence = status.decisionEvidence.map((source) => ({
    ...source,
    freshnessStatus: "fresh",
    coverageStatus:
      source.sourceKey === "product_mapping" ? "not_applicable" : "covered",
    latestRecordDate:
      source.sourceKey === "product_mapping" ? null : status.reportDate,
    blockingReason: null,
    blockingReasons: [],
    canUseForAdsAutomationDecision: true,
  }));
  status.sources = status.sources.map((source) => ({
    ...source,
    status: "ready",
    sourceSyncBlockers: [],
    canUseForAdsAutomationDecision: true,
    usableForAdsAutomationDecisions: true,
    freshness: {
      ...source.freshness,
      freshnessStatus: "fresh",
      staleByMinutes: 0,
      latestRecordDate:
        source.sourceKey === "product_mapping" ? null : status.reportDate,
    },
    reportDateCoverage: {
      ...source.reportDateCoverage,
      coverageStatus:
        source.sourceKey === "product_mapping" ? "not_applicable" : "covered",
    },
  }));
  return status;
}

describe("AdsAutomationSourceReadinessReviewExportService", () => {
  const readonlyImportReadiness =
    new AdsAutomationReadonlyPlatformImportReadinessService(
      new AdsAutomationDecisionSourceAdapterService(),
      new AdsAutomationDecisionService(),
    );
  const service = new AdsAutomationSourceReadinessReviewExportService();

  it("builds a manager review export with source coverage, conversions, budget evidence, candidates, and blockers", () => {
    const sourceSyncStatus =
      ADS_AUTOMATION_SOURCE_READINESS_REVIEW_EXPORT_FIXTURE.sourceSyncStatus;
    const readonlyReadiness = readonlyImportReadiness.build({
      ...ADS_AUTOMATION_SOURCE_READINESS_REVIEW_EXPORT_FIXTURE.readonlyImportReadinessInput,
      sourceSyncStatus,
    });
    const result = service.build(
      buildAdsAutomationSourceReadinessReviewFixtureInput(readonlyReadiness),
    );

    expect(result.schemaVersion).toBe(
      "ads_automation_source_readiness_review_export.v1",
    );
    expect(result.exportMode).toBe("local_demo_fixture");
    expect(result.query).toEqual({
      reportDate: "2026-07-04",
      fixture: "htx_ads_source_readiness_review_demo",
    });
    expect(result.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        source_sync_status_reused: true,
        readonly_import_readiness_reused: true,
        decision_read_model_evidence_reused: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        export_status: "needs_attention",
        source_sync_status: "blocked",
        readonly_import_status: "blocked",
        source_count: 5,
        fresh_source_count: 2,
        stale_source_count: 2,
        missing_source_count: 1,
        required_source_count: readonlyReadiness.summary.required_source_count,
        required_source_ready_count:
          readonlyReadiness.summary.required_source_ready_count,
        required_source_blocked_count:
          readonlyReadiness.summary.required_source_blocked_count,
        required_source_report_date_covered_count:
          readonlyReadiness.summary.required_source_report_date_covered_count,
        required_source_report_date_blocked_count:
          readonlyReadiness.summary.required_source_report_date_blocked_count,
        missing_required_source_evidence:
          readonlyReadiness.summary.missing_required_source_evidence,
        source_coverage_blocking_reasons:
          readonlyReadiness.summary.source_coverage_blocking_reasons,
        total_conversions: 23,
        total_conversion_value_vnd: 7400000,
        platform_metric_row_count: 3,
        platform_metric_ready_row_count: 2,
        platform_campaign_count: 3,
        platform_ad_group_count: 3,
        platform_campaignBudget_count: 2,
        platform_campaignBudgetId_missing_rows: 1,
        platform_mapped_product_count: 2,
        platform_mapped_ad_group_count: 2,
        platform_unmapped_ad_group_count: 1,
        platform_blocked_product_count: 2,
        platform_latest_successful_sync_at: "2026-07-04T04:30:00.000Z",
        platform_latest_record_date: "2026-07-04",
        campaignBudgetId_missing_rows: 1,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        scale_up_candidate_count: 1,
        scale_up_candidates_blocked: 1,
        pause_candidate_count: 2,
        product_kill_candidate_count: 1,
        cashflow_first_scale_mode: "monitor_only",
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "resolve_source_readiness_blockers",
      }),
    );
    expect(result.platformEntityCoverage).toBe(
      readonlyReadiness.platformEntityCoverage,
    );
    expect(result.platformEntityCoverage).toEqual(
      expect.objectContaining({
        metrics: expect.objectContaining({
          rows: 3,
          readyRows: 2,
          conversions: 23,
          conversionValueVnd: 7400000,
        }),
        campaigns: expect.objectContaining({
          campaignIds: ["1001", "1002", "9001"],
          coveredCampaignCount: 3,
        }),
        adGroups: expect.objectContaining({
          adGroupIds: ["2001", "2002", "9002"],
          coveredAdGroupCount: 3,
        }),
        campaignBudgets: expect.objectContaining({
          campaignBudgetIds: ["3001", "3002"],
          missingCampaignBudgetIdRows: 1,
          campaignBudgetId_required: true,
          campaignBudgetId_no_fallback: true,
          campaignBudgetId_fallback_used: false,
          blockers: ["campaignBudgetId_missing_no_fallback"],
        }),
        productMapping: expect.objectContaining({
          mappedProductIds: ["P_BAD", "P_SCALE"],
          mappedAdGroupIds: ["2001", "2002"],
          unmappedAdGroupIds: ["9002"],
          sourceReady: true,
          blockers: expect.arrayContaining([
            "product_mapping_unmapped_ad_groups",
          ]),
        }),
        inventoryProfit: expect.objectContaining({
          blockedProductIds: expect.arrayContaining(["P_BAD", "P_SCALE"]),
          sourceReady: false,
          blockers: expect.arrayContaining([
            "inventory_profit_not_ready_for_ads_automation_decision",
          ]),
        }),
        supplierContext: expect.objectContaining({
          sourceReady: false,
          blockers: expect.arrayContaining([
            "supplier_safety_not_ready_for_ads_automation_decision",
          ]),
        }),
        freshnessCoverage: expect.objectContaining({
          latestSuccessfulSyncAt: "2026-07-04T04:30:00.000Z",
          latestRecordDate: "2026-07-04",
          blockingReasons: expect.arrayContaining([
            "freshness_stale",
            "supplier_safety_not_ready_for_ads_automation_decision",
          ]),
        }),
      }),
    );
    expect(result.sourceCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          coverageBucket: "fresh",
          freshnessStatus: "fresh",
          coverageStatus: "covered",
          lastSuccessfulSyncAt: "2026-07-04T04:30:00.000Z",
          latestRecordDate: "2026-07-04",
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "advertising_costs",
          coverageBucket: "stale",
          blockingReasons: expect.arrayContaining([
            "advertising_costs_not_ready_for_ads_automation_decision",
            "freshness_stale",
          ]),
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          coverageBucket: "missing",
          latestRecordDate: null,
          blockingReasons: expect.arrayContaining([
            "supplier_safety_not_ready_for_ads_automation_decision",
            "coverage_missing",
          ]),
          affectedDecisionCategories: expect.arrayContaining([
            "supplier_gate",
            "product_budget_allocation",
          ]),
        }),
      ]),
    );
    expect(result.conversionMetrics).toEqual(
      expect.objectContaining({
        rows: 3,
        readyRows: 2,
        spendVnd: 710000,
        clicks: 278,
        impressions: 12200,
        conversions: 23,
        conversionValueVnd: 7400000,
        campaignBudgetIdMissingRows: 1,
      }),
    );
    expect(result.conversionMetrics.byAdGroup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "2001",
          conversions: 13,
          conversionValueVnd: 4300000,
          campaignBudgetId: "3001",
        }),
        expect.objectContaining({
          key: "9002",
          campaignBudgetIdMissingRows: 1,
        }),
      ]),
    );
    expect(result.campaignBudgetEvidence).toEqual(
      expect.objectContaining({
        campaignBudgetId_required: true,
        no_fallback_from_campaignId_or_adGroupId: true,
        fallback_used: false,
        missing_row_count: 1,
      }),
    );
    expect(result.campaignBudgetEvidence.missing_rows[0]).toEqual(
      expect.objectContaining({
        key: "9002",
        campaignId: "9001",
        adGroupId: "9002",
        campaignBudgetId: null,
      }),
    );
    expect(result.managerCandidateReview.scaleUpCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          effectiveStatus: "blocked",
          campaignBudgetId: "3001",
          conversions: 13,
          conversionValueVnd: 4300000,
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(result.managerCandidateReview.pauseCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2002",
          proposedAction: "pause_ad_group_draft",
        }),
      ]),
    );
    expect(result.managerCandidateReview.productKillCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_BAD",
          blockers: expect.arrayContaining(["negative_product_economics"]),
        }),
      ]),
    );
    expect(result.decisionAnswerReview).toBe(
      readonlyReadiness.decisionReadiness.answers,
    );
    expect(result.decisionAnswerReview).toEqual(
      expect.objectContaining({
        may_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        product_kill_or_stop_review_needed: false,
        campaign_or_ad_group_pause_recommended: false,
        execution_allowed_now: false,
      }),
    );
    expect(result.blockerReview.productAllocationBlockers).toEqual(
      expect.arrayContaining([
        "product_net_profit_not_positive",
        "inventory_profit_not_ready_for_ads_automation_decision",
      ]),
    );
    expect(result.blockerReview.supplierSafetyBlockers).toEqual(
      expect.arrayContaining([
        "supplier_safety_not_ready_for_ads_automation_decision",
        "supplier_reliability_missing_or_unsafe",
      ]),
    );
    expect(result.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "source_coverage",
          status: "attention",
        }),
        expect.objectContaining({
          section_id: "platform_entity_coverage",
          status: "attention",
          lines: expect.arrayContaining([
            expect.stringContaining("Metrics rows=3"),
            expect.stringContaining("Campaigns covered=3"),
            expect.stringContaining("Ad groups covered=3"),
            expect.stringContaining("Campaign budgets covered=2"),
            expect.stringContaining("campaignBudgetId_required=true"),
            expect.stringContaining("campaignBudgetId_fallback_used=false"),
            expect.stringContaining("unmappedAdGroupIds=9002"),
            expect.stringContaining("Inventory/profit"),
            expect.stringContaining("Supplier context"),
            expect.stringContaining(
              "Freshness latestSuccessfulSyncAt=2026-07-04T04:30:00.000Z",
            ),
            expect.stringContaining("Ad group metric rollup: entityId=2001"),
            expect.stringContaining("scale_amount"),
            expect.stringContaining("Ad group metric rollup: entityId=2002"),
            expect.stringContaining("campaign_or_ad_group_pause"),
            expect.stringContaining(
              "Campaign budget metric rollup: entityId=3001",
            ),
            expect.stringContaining("Product mapping row: productId=P_BAD"),
            expect.stringContaining("Product readiness row: productId=P_BAD"),
            expect.stringContaining("canReceiveBudget=false"),
            expect.stringContaining(
              "Supplier readiness row: supplierId=SUP_WEAK_1",
            ),
            expect.stringContaining("safeForBudgetAllocation=false"),
          ]),
        }),
        expect.objectContaining({
          section_id: "campaign_budget_join",
          lines: expect.arrayContaining([
            "campaignBudgetId_fallback_used=false",
          ]),
        }),
        expect.objectContaining({
          section_id: "decision_answers",
          lines: expect.arrayContaining([
            "may_increase_ads=false",
            "max_increase_vnd=0",
            "ad_groups_to_increase=none",
            "products_can_receive_budget=none",
            expect.stringContaining("blocked_product_budget_candidates="),
            expect.stringContaining("safe_supplier_choices="),
            expect.stringContaining("blocked_supplier_choices="),
            "product_kill_or_stop_review_needed=false",
            "campaign_or_ad_group_pause_recommended=false",
            expect.stringContaining("blocking_reasons="),
          ]),
        }),
        expect.objectContaining({
          section_id: "safety_gates",
          lines: expect.arrayContaining([
            "provider_api_called=false",
            "google_ads_api_called=false",
            "validateOnly_called=false",
            "live_ads_execution_used=false",
            "execution_allowed_now=false",
          ]),
        }),
      ]),
    );
    expect(result.markdownPreview).toContain(
      "Source coverage: google_ads:fresh",
    );
    expect(result.markdownPreview).toContain(
      `Required sources: ready=${readonlyReadiness.summary.required_source_ready_count}/${readonlyReadiness.summary.required_source_count}`,
    );
    expect(result.markdownPreview).toContain(
      `Required report-date coverage: covered=${readonlyReadiness.summary.required_source_report_date_covered_count}/${readonlyReadiness.summary.required_source_count}`,
    );
    expect(result.markdownPreview).toContain(
      "Platform entity coverage: campaigns=3, adGroups=3, metricRows=3, metricRowsReady=2",
    );
    expect(result.markdownPreview).toContain(
      "Platform campaignBudgetId: required=true, noFallback=true, fallbackUsed=false, missingRows=1",
    );
    expect(result.markdownPreview).toContain(
      "Platform product mapping: mappedProducts=P_BAD, P_SCALE",
    );
    expect(result.markdownPreview).toContain("Platform inventory/profit:");
    expect(result.markdownPreview).toContain("Platform supplier context:");
    expect(result.markdownPreview).toContain(
      "Platform freshness coverage: latestSuccessfulSyncAt=2026-07-04T04:30:00.000Z",
    );
    expect(result.markdownPreview).toContain(
      "Ad group metric rollup: entityId=2001",
    );
    expect(result.markdownPreview).toContain("scale_amount");
    expect(result.markdownPreview).toContain(
      "Ad group metric rollup: entityId=2002",
    );
    expect(result.markdownPreview).toContain("campaign_or_ad_group_pause");
    expect(result.markdownPreview).toContain(
      "Product mapping row: productId=P_BAD",
    );
    expect(result.markdownPreview).toContain(
      "Product readiness row: productId=P_BAD",
    );
    expect(result.markdownPreview).toContain("canReceiveBudget=false");
    expect(result.markdownPreview).toContain(
      "Supplier readiness row: supplierId=SUP_WEAK_1",
    );
    expect(result.markdownPreview).toContain("safeForBudgetAllocation=false");
    expect(result.markdownPreview).toContain(
      "Campaign budget rule: campaignBudgetId is required; campaignId/adGroupId are not fallback budget IDs",
    );
    expect(result.markdownPreview).toContain("may_increase_ads=false");
    expect(result.markdownPreview).toContain(
      "blocked_product_budget_candidates=",
    );
    expect(result.markdownPreview).toContain(
      "campaign_or_ad_group_pause_recommended=false",
    );
    expect(result.markdownPreview).toContain(
      "Cashflow-first scale mode: monitor_only",
    );
  });

  it("marks the export ready when gate-level source, import, budget, and cashflow readiness is safe", () => {
    const sourceSyncStatus = allReadySourceSyncStatus();
    const readonlyReadiness = readonlyImportReadiness.build({
      ...ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE,
      accounts: [
        ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.accounts[0],
      ],
      metricRows:
        ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.metricRows.slice(
          0,
          2,
        ),
      sourceSyncStatus,
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
    });
    const result = service.build({
      reportDate: "2026-07-04",
      now: "2026-07-04T05:00:00.000Z",
      exportMode: "local_payload",
      sourceSyncStatus,
      readonlyImportReadiness: readonlyReadiness,
    });

    expect(result.summary).toEqual(
      expect.objectContaining({
        export_status: "ready_for_review",
        source_sync_status: "ready",
        readonly_import_status: "ready_for_local_decision_review",
        fresh_source_count: 5,
        stale_source_count: 0,
        missing_source_count: 0,
        campaignBudgetId_missing_rows: 0,
        platform_metric_row_count: 2,
        platform_metric_ready_row_count: 2,
        platform_campaignBudgetId_missing_rows: 0,
        platform_unmapped_ad_group_count: 0,
        platform_latest_successful_sync_at: "2026-07-04T04:30:00.000Z",
        platform_latest_record_date: "2026-07-04",
        scale_up_candidate_count: 1,
        scale_up_candidates_blocked: 0,
        cashflow_first_scale_mode: "pending_validation",
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "inspect_source_readiness_review_export",
      }),
    );
    expect(
      result.sourceCoverage.every(
        (source) => source.coverageBucket === "fresh",
      ),
    ).toBe(true);
    expect(result.campaignBudgetEvidence.missing_rows).toEqual([]);
    expect(result.platformEntityCoverage.campaignBudgets).toEqual(
      expect.objectContaining({
        campaignBudgetIds: ["3001", "3002"],
        missingCampaignBudgetIdRows: 0,
        campaignBudgetId_required: true,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        blockers: [],
      }),
    );
    expect(result.platformEntityCoverage.productMapping).toEqual(
      expect.objectContaining({
        mappedProductIds: ["P_BAD", "P_SCALE"],
        mappedAdGroupIds: ["2001", "2002"],
        unmappedAdGroupIds: [],
        sourceReady: true,
      }),
    );
    expect(result.platformEntityCoverage.inventoryProfit).toEqual(
      expect.objectContaining({
        blockedProductIds: ["P_BAD"],
        sourceReady: true,
      }),
    );
    expect(result.platformEntityCoverage.supplierContext).toEqual(
      expect.objectContaining({
        safeSupplierIds: ["SUP_SAFE"],
        blockedSupplierIds: ["SUP_WEAK_1", "SUP_WEAK_2"],
        sourceReady: true,
      }),
    );
    expect(result.managerCandidateReview.scaleUpCandidates[0]).toEqual(
      expect.objectContaining({
        entityId: "2001",
        effectiveStatus: "candidate_for_review",
        campaignBudgetId: "3001",
        conversions: 13,
        execution_allowed_now: false,
      }),
    );
    expect(result.decisionAnswerReview).toEqual(
      expect.objectContaining({
        may_increase_ads: true,
        max_increase_vnd: 200000,
        scale_up_execution_mode: "pending_validation",
        product_kill_or_stop_review_needed: true,
        campaign_or_ad_group_pause_recommended: true,
        blocking_reasons: [],
        execution_allowed_now: false,
      }),
    );
    expect(result.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "decision_answers",
          status: "ready_for_review",
          lines: expect.arrayContaining([
            "may_increase_ads=true",
            "max_increase_vnd=200000",
            expect.stringContaining("ad_groups_to_increase=2001"),
            expect.stringContaining("products_can_receive_budget=P_SCALE"),
            expect.stringContaining("blocked_product_budget_candidates=P_BAD"),
            expect.stringContaining("safe_supplier_choices=SUP_SAFE"),
            expect.stringContaining("blocked_supplier_choices=SUP_WEAK_1"),
            "product_kill_or_stop_review_needed=true",
            "campaign_or_ad_group_pause_recommended=true",
            "blocking_reasons=none",
          ]),
        }),
      ]),
    );
    expect(result.blockerReview.productAllocationBlockers).toEqual(
      expect.arrayContaining(["product_net_profit_not_positive"]),
    );
    expect(result.blockerReview.supplierSafetyBlockers).toEqual(
      expect.arrayContaining(["margin_after_cost_below_minimum"]),
    );
    expect(result.markdownPreview).toContain("Export status: ready_for_review");
    expect(result.markdownPreview).toContain(
      "Cashflow-first scale mode: pending_validation",
    );
  });
});
