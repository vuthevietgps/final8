import {
  ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY,
  buildAdsAutomationDecisionFoundationReviewExportFixtureRows,
} from "./ads-automation-decision-foundation-read-model-review-export.fixture";
import { AdsAutomationApiReadinessGapReportService } from "./ads-automation-api-readiness-gap-report.service";
import { ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE } from "./ads-automation-loss-limit-policy.fixture";
import { AdsAutomationLossLimitPolicyService } from "./ads-automation-loss-limit-policy.service";
import { AdsAutomationDecisionDraftPreviewService } from "./ads-automation-decision-draft-preview.service";
import { AdsAutomationDecisionFoundationSnapshotService } from "./ads-automation-decision-foundation-snapshot.service";
import { AdsAutomationDecisionReadModelQueryService } from "./ads-automation-decision-read-model-query.service";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationPendingErpActionNormalizerService } from "./ads-automation-pending-erp-action-normalizer.service";
import { AdsAutomationProviderValidateOnlyPlannerService } from "./ads-automation-provider-validate-only-planner.service";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import { ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE } from "./ads-automation-readonly-platform-import-readiness.fixture";
import { AdsAutomationSourceReadinessReviewExportService } from "./ads-automation-source-readiness-review-export.service";
import { buildAdsAutomationSourceReadinessReviewSourceSyncStatus } from "./ads-automation-source-readiness-review-export.fixture";
import type { AdsAutomationDecisionReadModelRepository } from "./contracts/ads-automation-decision-read-model-query.contract";
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from "./source-sync/source-sync-result.types";

describe("AdsAutomationApiReadinessGapReportService", () => {
  const decision = new AdsAutomationDecisionService();
  const decisionSourceAdapter = new AdsAutomationDecisionSourceAdapterService();
  const readModelQuery = new AdsAutomationDecisionReadModelQueryService(
    decisionSourceAdapter,
  );
  const readonlyImportReadinessService =
    new AdsAutomationReadonlyPlatformImportReadinessService(
      decisionSourceAdapter,
      decision,
    );
  const foundation = new AdsAutomationDecisionFoundationSnapshotService(
    decision,
  );
  const draftPreview = new AdsAutomationDecisionDraftPreviewService();
  const lossLimitPolicy = new AdsAutomationLossLimitPolicyService();
  const service = new AdsAutomationApiReadinessGapReportService(
    new AdsAutomationPendingErpActionNormalizerService(),
    new AdsAutomationProviderValidateOnlyPlannerService(),
  );
  const sourceReadinessReviewExport =
    new AdsAutomationSourceReadinessReviewExportService();

  function repository(
    rows = buildAdsAutomationDecisionFoundationReviewExportFixtureRows(),
  ): AdsAutomationDecisionReadModelRepository {
    return {
      findAdGroupPerformanceRows: jest.fn().mockResolvedValue(rows.adGroups),
      findCampaignBudgetRows: jest.fn().mockResolvedValue(rows.campaignBudgets),
      findProductPerformanceRows: jest.fn().mockResolvedValue(rows.products),
      findSupplierSafetyRows: jest.fn().mockResolvedValue(rows.suppliers),
      findCashflowPolicyRow: jest.fn().mockResolvedValue(rows.policy),
      findSourceWatermarks: jest.fn().mockResolvedValue(rows.watermarks),
    };
  }

  function sourceSyncEvidence(
    overrides: Partial<SourceSyncDecisionEvidence>[] = [],
  ): SourceSyncDecisionEvidence[] {
    const sources: SourceSyncDecisionEvidence[] = [
      {
        sourceKey: "google_ads",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: "2026-07-04T04:00:00.000Z",
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: "advertising_costs",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: "2026-07-04T04:00:00.000Z",
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: "product_mapping",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: "2026-07-04T04:00:00.000Z",
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: "inventory_profit",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: "2026-07-04T04:00:00.000Z",
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
        lastSuccessfulSyncAt: "2026-07-04T04:00:00.000Z",
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
    ];

    return sources.map((source, index) => ({
      ...source,
      ...(overrides[index] || {}),
    }));
  }

  function sourceSyncGates(
    overrides: Partial<SourceSyncDecisionGates> = {},
  ): Partial<SourceSyncDecisionGates> {
    return {
      canRecommendAdsScale: true,
      canConcludeProfitStrongly: true,
      canEvaluateSalesToday: true,
      canEvaluateFinanceStrongly: true,
      canUseLtvStrongly: true,
      canGenerateActionDraft: true,
      canUseGoogleAdsDataClaim: true,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
      ...overrides,
    };
  }

  function allReadyReadonlySourceSyncStatus() {
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
    return status;
  }

  function staleMissingReadonlyImportReadiness() {
    return readonlyImportReadinessService.build({
      ...ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE,
      sourceSyncStatus:
        buildAdsAutomationSourceReadinessReviewSourceSyncStatus(),
    });
  }

  function readyReadonlyImportReadiness() {
    return readonlyImportReadinessService.build({
      ...ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE,
      accounts: [
        ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.accounts[0],
      ],
      metricRows:
        ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.metricRows.slice(
          0,
          2,
        ),
      sourceSyncStatus: allReadyReadonlySourceSyncStatus(),
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
  }

  async function buildReportFromRows(
    rows = buildAdsAutomationDecisionFoundationReviewExportFixtureRows(),
    sourceOverrides: {
      evidence?: Partial<SourceSyncDecisionEvidence>[];
      gates?: Partial<SourceSyncDecisionGates>;
      lossLimitPolicy?: ReturnType<
        AdsAutomationLossLimitPolicyService["build"]
      >;
      readonlyImportReadiness?: ReturnType<
        AdsAutomationReadonlyPlatformImportReadinessService["build"]
      >;
      sourceReadinessReviewExport?: ReturnType<
        AdsAutomationSourceReadinessReviewExportService["build"]
      >;
    } = {},
  ) {
    const readModel = await readModelQuery.buildFromRepository(
      repository(rows),
      ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY,
    );
    const foundationSnapshot = foundation.fromReadModelQueryResult(
      readModel,
      ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY,
    );
    const snapshot = decision.build(readModel.snapshotInput);
    const preview = draftPreview.build(snapshot, {
      source: "mongo_read_model",
      query: ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY,
      sourceEvidence: readModel.sourceEvidence,
      sourceSyncDecisionEvidence: sourceSyncEvidence(
        sourceOverrides.evidence || [],
      ),
      sourceSyncDecisionGates: sourceSyncGates(sourceOverrides.gates || {}),
      missingFieldEvidence: readModel.missingFieldEvidence,
      queryEvidence: readModel.queryEvidence,
    });

    return service.build({
      reportDate: snapshot.snapshotDate,
      foundationSnapshot,
      draftPreview: preview,
      lossLimitPolicy: sourceOverrides.lossLimitPolicy || null,
      readonlyImportReadiness: sourceOverrides.readonlyImportReadiness || null,
      sourceReadinessReviewExport:
        sourceOverrides.sourceReadinessReviewExport || null,
    });
  }

  async function buildReport(
    scenario: Parameters<
      typeof buildAdsAutomationDecisionFoundationReviewExportFixtureRows
    >[0] = "ready_for_review",
    sourceOverrides: {
      evidence?: Partial<SourceSyncDecisionEvidence>[];
      gates?: Partial<SourceSyncDecisionGates>;
      lossLimitPolicy?: ReturnType<
        AdsAutomationLossLimitPolicyService["build"]
      >;
      readonlyImportReadiness?: ReturnType<
        AdsAutomationReadonlyPlatformImportReadinessService["build"]
      >;
      sourceReadinessReviewExport?: ReturnType<
        AdsAutomationSourceReadinessReviewExportService["build"]
      >;
    } = {},
  ) {
    return buildReportFromRows(
      buildAdsAutomationDecisionFoundationReviewExportFixtureRows(scenario),
      sourceOverrides,
    );
  }

  it("maps the local API chain while keeping scale-up monitor-only until go-live safety is complete", async () => {
    const response = await buildReport();

    expect(response.schemaVersion).toBe(
      "ads_automation_api_readiness_gap_report.v1",
    );
    expect(response.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        persistence_used: false,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
        campaignBudgetId_no_fallback: true,
      }),
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_blocker_count: 0,
        pending_actions_created: 2,
        provider_validateOnly_plans: 1,
        provider_validateOnly_pending: 1,
        provider_mvp_actions_requiring_validateOnly: 1,
        cashflow_first_scale_all_safe: false,
        scale_up_mode: "monitor_only",
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "resolve_api_readiness_gaps",
      }),
    );
    expect(response.baControlAnswers).toEqual(
      expect.objectContaining({
        increase_ads: "no_monitor_only",
        increase_amount_vnd: 0,
        blocked_increase_amount_vnd: 200000,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(response.baControlAnswers.target_ad_groups).toEqual([
      expect.objectContaining({
        adGroupId: "2001",
        campaignBudgetId: "3001",
      }),
    ]);
    expect(response.baControlAnswers.products_to_receive_budget).toEqual([
      expect.objectContaining({
        productId: "P_SCALE",
        status: "monitor_only",
      }),
    ]);
    expect(response.baControlAnswers.products_blocked_from_budget).toEqual([]);
    expect(response.sourceImportCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          reportDate: "2026-07-04",
          freshnessStatus: "fresh",
          coverageStatus: "covered",
          lastSuccessfulSyncAt: "2026-07-04T04:00:00.000Z",
          latestRecordDate: "2026-07-04",
          blockingReason: null,
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "advertising_costs",
          freshnessStatus: "fresh",
          coverageStatus: "covered",
          blockingReasons: [],
          canUseForAdsAutomationDecision: true,
        }),
      ]),
    );
    expect(response.cashflowFirstSafety.blockers).toEqual(
      expect.arrayContaining([
        "cash_conversion_or_working_capital_health_missing",
        "fulfillment_capacity_missing",
        "daily_loss_limit_missing",
        "monthly_loss_limit_missing",
      ]),
    );
    expect(response.remainingApiPrerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "oauth_account_readiness",
          status: "missing",
        }),
        expect.objectContaining({
          key: "provider_validateOnly_adapter",
          status: "contract_only",
        }),
        expect.objectContaining({
          key: "production_flag",
          status: "blocked_by_default",
        }),
        expect.objectContaining({ key: "loss_limits", status: "missing" }),
      ]),
    );
    expect(response.mvpActionContractReview).toEqual(
      expect.objectContaining({
        provider_mvp_actions_requiring_validateOnly: 1,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.mvpActionContractReview.action_contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "update_campaign_budget",
          source: "api_readiness_validateOnly_lane",
          mvp_action_contract: expect.objectContaining({
            action_scope: "provider_validateOnly_required",
            preflight_treatment: "eligible_for_future_provider_preflight",
            provider_validateOnly_required_before_future_execution: true,
            execution_allowed_now: false,
          }),
          evidence: expect.arrayContaining([
            "provider_mvp_action_requires_future_erp_owned_provider_validateOnly=true",
          ]),
        }),
      ]),
    );
    expect(response.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "source_import_readiness",
          status: "ready",
        }),
        expect.objectContaining({ stage: "pending_actions", status: "ready" }),
        expect.objectContaining({
          stage: "validate_only",
          status: "pending",
          evidence: expect.arrayContaining([
            "mvp_provider_validateOnly_required=1",
            "provider_validateOnly_lane_mocked=true",
          ]),
        }),
        expect.objectContaining({
          stage: "execution_preflight",
          status: "blocked",
          blockers: expect.arrayContaining([
            "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
            "future_executor_not_implemented",
          ]),
        }),
        expect.objectContaining({
          stage: "dry_run_audit",
          status: "blocked",
          blockers: ["dry_run_audit_record_not_created_by_report"],
        }),
      ]),
    );
    expect(response.pendingActionNormalization.created).toBe(true);
    expect(response.validateOnlyLane.created).toBe(true);
    expect(response.markdownPreview).toContain("provider_api_used=false");
    expect(response.markdownPreview).toContain(
      "MVP provider actions requiring future ERP validateOnly: 1",
    );
    expect(response.markdownPreview).toContain(
      "MVP contract scopes: update_campaign_budget=provider_validateOnly_required",
    );
  });

  it("blocks the API-readiness chain when source data is stale or source gates are closed", async () => {
    const response = await buildReport("stale_sources", {
      evidence: [
        {
          freshnessStatus: "stale",
          blockingReason: "google_ads_not_ready_for_ads_automation_decision",
          blockingReasons: [
            "freshness_stale",
            "google_ads_not_ready_for_ads_automation_decision",
          ],
          canUseForAdsAutomationDecision: false,
        },
      ],
      gates: {
        canRecommendAdsScale: false,
        canGenerateActionDraft: false,
        canUseGoogleAdsDataClaim: false,
      },
    });

    expect(response.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        pending_actions_created: 0,
        provider_validateOnly_plans: 0,
        provider_validateOnly_passed: 0,
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.sourceBlockers).toEqual(
      expect.arrayContaining([
        "source_sync.canGenerateActionDraft",
        "source_sync.canRecommendAdsScale",
        "source_sync.canUseGoogleAdsDataClaim",
        "source_sync.google_ads_not_ready",
        "source_sync.google_ads.freshness_stale",
        "read_model.campaign_budgets.stale",
        "read_model.product_performance.stale",
      ]),
    );
    expect(response.sourceImportCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          freshnessStatus: "stale",
          coverageStatus: "covered",
          blockingReason: "google_ads_not_ready_for_ads_automation_decision",
          blockingReasons: expect.arrayContaining([
            "freshness_stale",
            "google_ads_not_ready_for_ads_automation_decision",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(response.pendingActionNormalization).toEqual(
      expect.objectContaining({
        created: false,
        schemaVersion: null,
        summary: null,
      }),
    );
    expect(response.pendingActionNormalization.error).toContain(
      "source-sync gate does not allow pending action generation",
    );
    expect(response.cashflowFirstSafety.blockers).toContain(
      "data_freshness_or_coverage_not_safe",
    );
    expect(response.baControlAnswers).toEqual(
      expect.objectContaining({
        increase_ads: "no_monitor_only",
        increase_amount_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(response.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "source_import_readiness",
          status: "blocked",
        }),
        expect.objectContaining({
          stage: "pending_actions",
          status: "blocked",
        }),
        expect.objectContaining({
          stage: "validate_only",
          status: "blocked",
          blockers: ["pending_action_normalization_not_available"],
        }),
      ]),
    );
  });

  it("renders readonly platform entity coverage and blockers in the API-readiness gap report for stale or missing sources", async () => {
    const readonlyImportReadiness = staleMissingReadonlyImportReadiness();
    const response = await buildReport("ready_for_review", {
      readonlyImportReadiness,
    });

    expect(response.platformEntityCoverage).toBe(
      readonlyImportReadiness.platformEntityCoverage,
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        platform_entity_coverage_present: true,
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
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.platformEntityCoverage).toEqual(
      expect.objectContaining({
        metrics: expect.objectContaining({
          rows: 3,
          readyRows: 2,
          conversions: 23,
          conversionValueVnd: 7400000,
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
        }),
        inventoryProfit: expect.objectContaining({
          blockedProductIds: expect.arrayContaining(["P_BAD", "P_SCALE"]),
          sourceReady: false,
        }),
        supplierContext: expect.objectContaining({
          sourceReady: false,
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
    expect(response.platformEntityCoverageReview).toEqual(
      expect.objectContaining({
        adGroupMetricRollups: expect.arrayContaining([
          expect.stringContaining("Ad group metric rollup: entityId=2001"),
          expect.stringContaining("scale_amount"),
          expect.stringContaining("Ad group metric rollup: entityId=2002"),
          expect.stringContaining("campaign_or_ad_group_pause"),
        ]),
        campaignBudgetMetricRollups: expect.arrayContaining([
          expect.stringContaining(
            "Campaign budget metric rollup: entityId=3001",
          ),
        ]),
        productMappings: expect.arrayContaining([
          expect.stringContaining("Product mapping row: productId=P_BAD"),
        ]),
        productReadiness: expect.arrayContaining([
          expect.stringContaining("Product readiness row: productId=P_BAD"),
          expect.stringContaining("canReceiveBudget=false"),
        ]),
        supplierReadiness: expect.arrayContaining([
          expect.stringContaining(
            "Supplier readiness row: supplierId=SUP_WEAK_1",
          ),
          expect.stringContaining("safeForBudgetAllocation=false"),
        ]),
      }),
    );
    expect(response.platformEntityCoverageBlockers).toEqual(
      expect.arrayContaining([
        "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
        "platform_entity.productMapping.product_mapping_unmapped_ad_groups",
        "platform_entity.inventoryProfit.not_covered_for_decision",
        "platform_entity.supplierContext.not_covered_for_decision",
        "platform_entity.freshnessCoverage.freshness_stale",
      ]),
    );
    expect(response.sourceBlockers).toEqual(
      expect.arrayContaining([
        "readonly_import.advertising_costs_not_ready",
        "readonly_import.supplier_safety_not_ready",
        "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
        "platform_entity.productMapping.product_mapping_unmapped_ad_groups",
        "platform_entity.inventoryProfit.source_not_ready",
        "platform_entity.supplierContext.source_not_ready",
        "platform_entity.freshnessCoverage.freshness_stale",
      ]),
    );
    expect(response.sourceImportCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "supplier_safety",
          freshnessStatus: "missing",
          coverageStatus: "missing",
          latestRecordDate: null,
          blockingReasons: expect.arrayContaining([
            "supplier_safety_not_ready_for_ads_automation_decision",
            "coverage_missing",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(response.pendingActionNormalization).toEqual(
      expect.objectContaining({
        created: true,
        platformEntityCoverageBlockersApplied: expect.arrayContaining([
          "platform_entity.inventoryProfit.product_blocked_for_action",
          "platform_entity.inventoryProfit.not_covered_for_decision",
          "platform_entity.freshnessCoverage.freshness_stale",
        ]),
        scaleCandidatesBlockedByPlatformEntityCoverage: 1,
      }),
    );
    expect(
      response.pendingActionNormalization.platformEntityCoverageBlockersApplied,
    ).not.toContain(
      "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
    );
    expect(
      response.pendingActionNormalization
        .platformEntityCoverageActionBlockersApplied,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker: "platform_entity.inventoryProfit.product_blocked_for_action",
          scope: "productId",
          adGroupId: "2001",
          campaignBudgetId: "3001",
          productId: "P_SCALE",
        }),
        expect.objectContaining({
          blocker: "platform_entity.freshnessCoverage.freshness_stale",
          scope: "freshness",
          adGroupId: "2001",
          campaignBudgetId: "3001",
          productId: "P_SCALE",
        }),
      ]),
    );
    expect(response.pendingActionNormalization.summary).toEqual(
      expect.objectContaining({
        platform_entity_blocker_count:
          response.pendingActionNormalization
            .platformEntityCoverageBlockersApplied.length,
        scale_candidates_blocked_by_platform_entity_coverage: 1,
      }),
    );
    expect(
      response.validateOnlyLane.summary?.blocked_before_validate_only,
    ).toBeGreaterThanOrEqual(1);
    expect(response.markdownPreview).toContain(
      "Platform entity coverage: campaigns=3, adGroups=3, metricRows=3, metricRowsReady=2",
    );
    expect(response.markdownPreview).toContain(
      "Platform campaignBudgetId: required=true, noFallback=true, fallbackUsed=false, missingRows=1",
    );
    expect(response.markdownPreview).toContain(
      "Platform product mapping: mappedProducts=P_BAD, P_SCALE",
    );
    expect(response.markdownPreview).toContain("Platform inventory/profit:");
    expect(response.markdownPreview).toContain("Platform supplier context:");
    expect(response.markdownPreview).toContain(
      "Platform freshness coverage: latestSuccessfulSyncAt=2026-07-04T04:30:00.000Z",
    );
    expect(response.markdownPreview).toContain(
      "Ad group metric rollup: entityId=2001",
    );
    expect(response.markdownPreview).toContain("scale_amount");
    expect(response.markdownPreview).toContain(
      "Ad group metric rollup: entityId=2002",
    );
    expect(response.markdownPreview).toContain("campaign_or_ad_group_pause");
    expect(response.markdownPreview).toContain(
      "Product mapping row: productId=P_BAD",
    );
    expect(response.markdownPreview).toContain(
      "Product readiness row: productId=P_BAD",
    );
    expect(response.markdownPreview).toContain("canReceiveBudget=false");
    expect(response.markdownPreview).toContain(
      "Supplier readiness row: supplierId=SUP_WEAK_1",
    );
    expect(response.markdownPreview).toContain("safeForBudgetAllocation=false");
    expect(response.markdownPreview).toContain("Platform entity blockers:");
  });

  it("uses source readiness review export blockers to stop validateOnly planning and final go/no-go readiness", async () => {
    const readonlyImportReadiness = staleMissingReadonlyImportReadiness();
    const reviewExport = sourceReadinessReviewExport.build({
      reportDate: "2026-07-04",
      exportMode: "erp_source_import_readiness",
      sourceSyncStatus:
        buildAdsAutomationSourceReadinessReviewSourceSyncStatus(),
      readonlyImportReadiness,
    });
    const response = await buildReport("ready_for_review", {
      sourceReadinessReviewExport: reviewExport,
    });

    expect(response.platformEntityCoverage).toBe(
      readonlyImportReadiness.platformEntityCoverage,
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        source_readiness_review_export_consumed: true,
        source_readiness_review_export_mode: "erp_source_import_readiness",
        source_readiness_review_export_status: "needs_attention",
        required_source_count: reviewExport.summary.required_source_count,
        required_source_ready_count:
          reviewExport.summary.required_source_ready_count,
        required_source_blocked_count:
          reviewExport.summary.required_source_blocked_count,
        required_source_report_date_blocked_count:
          reviewExport.summary.required_source_report_date_blocked_count,
        source_readiness_validateOnly_blocker_count:
          response.sourceBlockers.filter((blocker) =>
            blocker.startsWith("source_readiness_review."),
          ).length,
        provider_validateOnly_plans: 0,
        provider_validateOnly_pending: 0,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.sourceBlockers).toEqual(
      expect.arrayContaining([
        "source_readiness_review.required_sources_blocked",
        "source_readiness_review.required_sources_report_date_not_covered",
        "source_readiness_review.campaignBudgetId_missing_no_fallback",
        "source_readiness_review.product_allocation_blockers",
        "source_readiness_review.supplier_safety_blockers",
      ]),
    );
    expect(response.validateOnlyLane).toEqual(
      expect.objectContaining({
        created: false,
        schemaVersion: null,
        summary: null,
      }),
    );
    expect(response.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "validate_only",
          status: "blocked",
          blockers: expect.arrayContaining([
            "source_readiness_review.required_sources_blocked",
            "source_readiness_review.campaignBudgetId_missing_no_fallback",
            "source_readiness_review.product_allocation_blockers",
            "source_readiness_review.supplier_safety_blockers",
          ]),
          next_required_action:
            "resolve_source_readiness_review_blockers_before_validateOnly",
        }),
        expect.objectContaining({
          stage: "final_go_no_go_readiness",
          status: "blocked",
          blockers: expect.arrayContaining([
            "source_readiness_review.required_sources_blocked",
            "source_readiness_review.campaignBudgetId_missing_no_fallback",
            "production_ready_false",
            "execution_allowed_now_false",
          ]),
          next_required_action:
            "resolve_source_readiness_review_blockers_before_go_no_go",
        }),
      ]),
    );
    expect(response.markdownPreview).toContain(
      "Source readiness review export consumed: true",
    );
    expect(response.markdownPreview).toContain(
      "Source readiness validateOnly blockers:",
    );
  });

  it("renders ready readonly platform entity coverage in the API-readiness gap report without budget fallback", async () => {
    const readonlyImportReadiness = readyReadonlyImportReadiness();
    const response = await buildReport("ready_for_review", {
      readonlyImportReadiness,
    });

    expect(response.summary).toEqual(
      expect.objectContaining({
        platform_entity_coverage_present: true,
        platform_metric_row_count: 2,
        platform_metric_ready_row_count: 2,
        platform_campaignBudgetId_missing_rows: 0,
        platform_unmapped_ad_group_count: 0,
        platform_latest_successful_sync_at: "2026-07-04T04:30:00.000Z",
        platform_latest_record_date: "2026-07-04",
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.platformEntityCoverage?.campaignBudgets).toEqual(
      expect.objectContaining({
        campaignBudgetIds: ["3001", "3002"],
        missingCampaignBudgetIdRows: 0,
        campaignBudgetId_required: true,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        blockers: [],
      }),
    );
    expect(response.platformEntityCoverage?.productMapping).toEqual(
      expect.objectContaining({
        mappedProductIds: ["P_BAD", "P_SCALE"],
        mappedAdGroupIds: ["2001", "2002"],
        unmappedAdGroupIds: [],
        sourceReady: true,
      }),
    );
    expect(response.platformEntityCoverage?.inventoryProfit).toEqual(
      expect.objectContaining({
        blockedProductIds: ["P_BAD"],
        sourceReady: true,
      }),
    );
    expect(response.platformEntityCoverage?.supplierContext).toEqual(
      expect.objectContaining({
        safeSupplierIds: ["SUP_SAFE"],
        blockedSupplierIds: ["SUP_WEAK_1", "SUP_WEAK_2"],
        supplierChoiceSafe: true,
        sourceReady: true,
      }),
    );
    expect(response.sourceBlockers).not.toContain(
      "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
    );
    expect(response.pendingActionNormalization).toEqual(
      expect.objectContaining({
        created: true,
        platformEntityCoverageBlockersApplied: [],
        platformEntityCoverageActionBlockersApplied: [],
        scaleCandidatesBlockedByPlatformEntityCoverage: 0,
      }),
    );
    expect(response.pendingActionNormalization.summary).toEqual(
      expect.objectContaining({
        scale_candidates_blocked_by_platform_entity_coverage: 0,
      }),
    );
    expect(response.markdownPreview).toContain(
      "Platform campaignBudgetId: required=true, noFallback=true, fallbackUsed=false, missingRows=0",
    );
    expect(response.markdownPreview).toContain(
      "Platform freshness coverage: latestSuccessfulSyncAt=2026-07-04T04:30:00.000Z, latestRecordDate=2026-07-04, blockingReasons=none",
    );
  });

  it("does not apply unrelated blocked products or suppliers to a safe scale pending action", async () => {
    const readonlyImportReadiness = readyReadonlyImportReadiness();
    readonlyImportReadiness.summary.scale_up_execution_mode = "monitor_only";
    readonlyImportReadiness.platformEntityCoverage.inventoryProfit = {
      ...readonlyImportReadiness.platformEntityCoverage.inventoryProfit,
      profitableProductIds: ["P_SCALE"],
      blockedProductIds: ["P_BAD"],
      sourceReady: true,
      blockers: ["product_net_profit_not_positive"],
      coveredForDecision: false,
    };
    readonlyImportReadiness.platformEntityCoverage.supplierContext = {
      ...readonlyImportReadiness.platformEntityCoverage.supplierContext,
      safeSupplierIds: ["SUP_SAFE"],
      blockedSupplierIds: ["SUP_WEAK_1"],
      supplierChoiceSafe: false,
      sourceReady: true,
      blockers: ["supplier_safety_not_ready_for_ads_automation_decision"],
      coveredForDecision: false,
    };

    const response = await buildReport("ready_for_review", {
      readonlyImportReadiness,
    });

    expect(response.platformEntityCoverageBlockers).toEqual(
      expect.arrayContaining([
        "platform_entity.inventoryProfit.product_net_profit_not_positive",
        "platform_entity.inventoryProfit.not_covered_for_decision",
        "platform_entity.supplierContext.supplier_safety_not_ready_for_ads_automation_decision",
        "platform_entity.supplierContext.not_covered_for_decision",
      ]),
    );
    expect(response.pendingActionNormalization).toEqual(
      expect.objectContaining({
        created: true,
        platformEntityCoverageBlockersApplied: [],
        platformEntityCoverageActionBlockersApplied: [],
        scaleCandidatesBlockedByPlatformEntityCoverage: 0,
      }),
    );
    expect(response.pendingActionNormalization.summary).toEqual(
      expect.objectContaining({
        platform_entity_blocker_count: 0,
        scale_candidates_blocked_by_platform_entity_coverage: 0,
      }),
    );
  });

  it("applies campaign, ad group, budget, product, and freshness blockers only when they match the scale action", async () => {
    const readonlyImportReadiness = readyReadonlyImportReadiness();
    readonlyImportReadiness.summary.scale_up_execution_mode = "monitor_only";
    readonlyImportReadiness.platformEntityCoverage.campaigns = {
      ...readonlyImportReadiness.platformEntityCoverage.campaigns,
      campaignIds: ["9001"],
      coveredCampaignCount: 1,
      blockers: ["campaignId_missing_rows"],
      coveredForDecision: false,
    };
    readonlyImportReadiness.platformEntityCoverage.adGroups = {
      ...readonlyImportReadiness.platformEntityCoverage.adGroups,
      adGroupIds: ["9002"],
      coveredAdGroupCount: 1,
      blockers: ["adGroupId_missing_rows"],
      coveredForDecision: false,
    };
    readonlyImportReadiness.platformEntityCoverage.campaignBudgets = {
      ...readonlyImportReadiness.platformEntityCoverage.campaignBudgets,
      campaignBudgetIds: ["9003"],
      coveredCampaignBudgetCount: 1,
      blockers: [],
      coveredForDecision: false,
    };
    readonlyImportReadiness.platformEntityCoverage.productMapping = {
      ...readonlyImportReadiness.platformEntityCoverage.productMapping,
      mappedProductIds: [],
      mappedAdGroupIds: [],
      unmappedAdGroupIds: ["2001"],
      sourceReady: true,
      blockers: ["product_mapping_unmapped_ad_groups"],
      coveredForDecision: false,
    };
    readonlyImportReadiness.platformEntityCoverage.inventoryProfit = {
      ...readonlyImportReadiness.platformEntityCoverage.inventoryProfit,
      profitableProductIds: [],
      blockedProductIds: ["P_SCALE"],
      sourceReady: true,
      blockers: ["product_net_profit_not_positive"],
      coveredForDecision: false,
    };
    readonlyImportReadiness.platformEntityCoverage.freshnessCoverage = {
      ...readonlyImportReadiness.platformEntityCoverage.freshnessCoverage,
      blockingReasons: ["freshness_stale"],
    };

    const response = await buildReport("ready_for_review", {
      readonlyImportReadiness,
    });

    expect(
      response.pendingActionNormalization.platformEntityCoverageBlockersApplied,
    ).toEqual(
      expect.arrayContaining([
        "platform_entity.adGroups.adGroupId_not_covered_for_action",
        "platform_entity.campaignBudgets.campaignBudgetId_not_covered_for_action",
        "platform_entity.productMapping.adGroupId_unmapped_for_action",
        "platform_entity.inventoryProfit.product_blocked_for_action",
        "platform_entity.freshnessCoverage.freshness_stale",
      ]),
    );
    expect(
      response.pendingActionNormalization
        .platformEntityCoverageActionBlockersApplied,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "adGroupId",
          adGroupId: "2001",
          blocker: "platform_entity.adGroups.adGroupId_not_covered_for_action",
        }),
        expect.objectContaining({
          scope: "campaignBudgetId",
          campaignBudgetId: "3001",
          blocker:
            "platform_entity.campaignBudgets.campaignBudgetId_not_covered_for_action",
        }),
        expect.objectContaining({
          scope: "productId",
          productId: "P_SCALE",
          blocker: "platform_entity.inventoryProfit.product_blocked_for_action",
        }),
        expect.objectContaining({
          scope: "freshness",
          adGroupId: "2001",
          campaignBudgetId: "3001",
          productId: "P_SCALE",
          blocker: "platform_entity.freshnessCoverage.freshness_stale",
        }),
      ]),
    );
    expect(response.pendingActionNormalization).toEqual(
      expect.objectContaining({
        scaleCandidatesBlockedByPlatformEntityCoverage: 1,
      }),
    );
    expect(response.pendingActionNormalization.summary).toEqual(
      expect.objectContaining({
        scale_candidates_blocked_by_platform_entity_coverage: 1,
      }),
    );
    expect(response.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
  });

  for (const scenario of [
    {
      gateName: "canGenerateActionDraft",
      gates: {
        canGenerateActionDraft: false,
        canRecommendAdsScale: true,
        canUseGoogleAdsDataClaim: true,
      },
      blocker: "source_sync.canGenerateActionDraft",
      otherGateBlockers: [
        "source_sync.canRecommendAdsScale",
        "source_sync.canUseGoogleAdsDataClaim",
      ],
      pendingActionsCreated: 0,
      providerValidateOnlyPlans: 0,
      pendingActionNormalizationCreated: false,
      pendingActionError:
        "source-sync gate does not allow pending action generation",
      pendingActionStageStatus: "blocked",
      validateOnlyStageStatus: "blocked",
    },
    {
      gateName: "canRecommendAdsScale",
      gates: {
        canGenerateActionDraft: true,
        canRecommendAdsScale: false,
        canUseGoogleAdsDataClaim: true,
      },
      blocker: "source_sync.canRecommendAdsScale",
      otherGateBlockers: [
        "source_sync.canGenerateActionDraft",
        "source_sync.canUseGoogleAdsDataClaim",
      ],
      pendingActionsCreated: 2,
      providerValidateOnlyPlans: 1,
      pendingActionNormalizationCreated: true,
      pendingActionError: null,
      pendingActionStageStatus: "ready",
      validateOnlyStageStatus: "pending",
    },
    {
      gateName: "canUseGoogleAdsDataClaim",
      gates: {
        canGenerateActionDraft: true,
        canRecommendAdsScale: true,
        canUseGoogleAdsDataClaim: false,
      },
      blocker: "source_sync.canUseGoogleAdsDataClaim",
      otherGateBlockers: [
        "source_sync.canGenerateActionDraft",
        "source_sync.canRecommendAdsScale",
      ],
      pendingActionsCreated: 2,
      providerValidateOnlyPlans: 1,
      pendingActionNormalizationCreated: true,
      pendingActionError: null,
      pendingActionStageStatus: "ready",
      validateOnlyStageStatus: "pending",
    },
  ] as const) {
    it(`blocks the API-readiness report when ${scenario.gateName} is closed despite complete usable source rows`, async () => {
      const response = await buildReport("ready_for_review", {
        gates: scenario.gates,
      });

      expect(response.summary).toEqual(
        expect.objectContaining({
          status: "blocked",
          source_blocker_count: 1,
          pending_actions_created: scenario.pendingActionsCreated,
          provider_validateOnly_plans: scenario.providerValidateOnlyPlans,
          provider_api_used: false,
          google_ads_api_used: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(response.sourceBlockers).toEqual([scenario.blocker]);
      for (const otherGateBlocker of scenario.otherGateBlockers) {
        expect(response.sourceBlockers).not.toContain(otherGateBlocker);
      }
      expect(response.sourceBlockers).not.toContain(
        "source_sync.google_ads_not_ready",
      );
      expect(response.sourceBlockers).not.toContain(
        "source_sync.inventory_profit_not_ready",
      );
      expect(response.sourceBlockers).not.toContain(
        "source_sync.supplier_safety_not_ready",
      );
      expect(
        response.sourceBlockers.some((blocker) =>
          blocker.startsWith("read_model."),
        ),
      ).toBe(false);
      expect(response.sourceImportCoverage).toHaveLength(5);
      expect(
        response.sourceImportCoverage.every(
          (source) =>
            source.freshnessStatus === "fresh" &&
            source.coverageStatus === "covered" &&
            source.blockingReason === null &&
            source.blockingReasons.length === 0 &&
            source.canUseForAdsAutomationDecision === true,
        ),
      ).toBe(true);
      expect(response.pendingActionNormalization).toEqual(
        expect.objectContaining({
          created: scenario.pendingActionNormalizationCreated,
          error: scenario.pendingActionError,
        }),
      );
      expect(response.validateOnlyLane.created).toBe(
        scenario.pendingActionNormalizationCreated,
      );
      expect(response.stages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            stage: "source_import_readiness",
            status: "blocked",
            blockers: [scenario.blocker],
          }),
          expect.objectContaining({
            stage: "pending_actions",
            status: scenario.pendingActionStageStatus,
          }),
          expect.objectContaining({
            stage: "validate_only",
            status: scenario.validateOnlyStageStatus,
          }),
          expect.objectContaining({
            stage: "execution_preflight",
            status: "blocked",
            blockers: expect.arrayContaining([
              scenario.blocker,
              "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
              "future_executor_not_implemented",
            ]),
          }),
        ]),
      );
      expect(response.cashflowFirstSafety.blockers).toContain(
        "data_freshness_or_coverage_not_safe",
      );
      expect(response.baControlAnswers).toEqual(
        expect.objectContaining({
          increase_ads: "no_monitor_only",
          scale_up_execution_mode: "monitor_only",
          execution_allowed_now: false,
        }),
      );
      expect(response.markdownPreview).toContain(
        `Source blockers: ${scenario.blocker}`,
      );
    });
  }

  it("uses loss-limit and spend-cap policy evidence to keep unsafe scale-up monitor-only", async () => {
    const policy = lossLimitPolicy.build(
      ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE,
    );
    const response = await buildReport("ready_for_review", {
      lossLimitPolicy: policy,
    });

    expect(response.lossLimitPolicy).toEqual(
      expect.objectContaining({
        schemaVersion: "ads_automation_loss_limit_policy.v1",
        summary: expect.objectContaining({
          requested_action_mode: "scale_up",
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
    expect(response.cashflowFirstSafety.blockers).toEqual(
      expect.arrayContaining([
        "daily_loss_limit_breached",
        "monthly_loss_limit_breached",
        "spend_caps_missing_or_unsafe",
        "campaign.1001.daily_spend_cap_exceeded",
        "cash_conversion_or_working_capital_health_missing",
        "contribution_profit_missing_or_unsafe",
      ]),
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        cashflow_first_scale_all_safe: false,
        scale_up_mode: "monitor_only",
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.remainingApiPrerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "spend_caps", status: "contract_only" }),
        expect.objectContaining({
          key: "loss_limits",
          status: "contract_only",
        }),
      ]),
    );
  });

  it("answers BA readiness from read-model rows with scale, pause, product kill, and supplier blockers", async () => {
    const rows = buildAdsAutomationDecisionFoundationReviewExportFixtureRows();
    const response = await buildReportFromRows({
      ...rows,
      adGroups: [
        ...rows.adGroups,
        {
          ...rows.adGroups[0],
          campaignId: "1002",
          campaignName: "Search - Refund Heavy",
          adGroupId: "2002",
          adGroupName: "Refund-heavy ad group",
          resourceName: "customers/1234567890/adGroups/2002",
          campaignBudgetId: "3002",
          campaignBudgetResourceName:
            "customers/1234567890/campaignBudgets/3002",
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
          internalProductIds: ["P_BAD"],
        },
      ],
      campaignBudgets: [
        ...rows.campaignBudgets,
        {
          customerId: "1234567890",
          campaignBudgetId: "3002",
          resourceName: "customers/1234567890/campaignBudgets/3002",
          amountVnd: 500000,
          status: "ENABLED",
          lastSyncAt: "2026-07-04T04:00:00.000Z",
        },
      ],
      products: [
        ...rows.products,
        {
          productId: "P_BAD",
          sku: "SKU-BAD",
          productName: "Refund-heavy set",
          netProfitVnd: -450000,
          adAttributedNetProfitAfterAdsVnd: -350000,
          marginPercent: -5,
          returnCancelRefundRatePercent: 40,
          stockAvailable: 50,
          daysOfCover: 12,
          mediaReady: true,
          landingReady: true,
          offerReady: true,
          mappedAdGroupIds: ["2002"],
          supplierIds: ["SUP_WEAK_1", "SUP_WEAK_2"],
          updatedAt: "2026-07-04T04:00:00.000Z",
        },
      ],
      suppliers: [
        ...rows.suppliers,
        {
          productId: "P_BAD",
          supplierId: "SUP_WEAK_1",
          supplierName: "Weak Supplier 1",
          quoteApproved: true,
          currentQuoteVnd: 260000,
          priorQuoteVnd: 230000,
          marginAfterCostPercent: 8,
          leadTimeDays: 14,
          lateDeliveryRatePercent: 20,
          paymentFreshnessDays: 45,
          capacityStatus: "constrained",
          returnFaultRatePercent: 14,
          updatedAt: "2026-07-04T04:00:00.000Z",
        },
        {
          productId: "P_BAD",
          supplierId: "SUP_WEAK_2",
          supplierName: "Weak Supplier 2",
          quoteApproved: false,
          currentQuoteVnd: 280000,
          priorQuoteVnd: 250000,
          marginAfterCostPercent: -2,
          leadTimeDays: 16,
          lateDeliveryRatePercent: 22,
          paymentFreshnessDays: 60,
          capacityStatus: "blocked",
          returnFaultRatePercent: 18,
          updatedAt: "2026-07-04T04:00:00.000Z",
        },
      ],
    });

    expect(response.baControlAnswers).toEqual(
      expect.objectContaining({
        increase_ads: "no_monitor_only",
        increase_amount_vnd: 0,
        blocked_increase_amount_vnd: 200000,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(response.baControlAnswers.target_ad_groups).toEqual([
      expect.objectContaining({
        adGroupId: "2001",
        campaignBudgetId: "3001",
        status: "scale_ready",
      }),
    ]);
    expect(response.baControlAnswers.products_to_receive_budget).toEqual([
      expect.objectContaining({
        productId: "P_SCALE",
        status: "monitor_only",
      }),
    ]);
    expect(response.baControlAnswers.products_blocked_from_budget).toEqual([
      expect.objectContaining({
        productId: "P_BAD",
        status: "blocked",
        blockers: expect.arrayContaining([
          "product_net_profit_not_positive",
          "no_safe_supplier_for_scale",
        ]),
      }),
    ]);
    expect(response.baControlAnswers.supplier_safety).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: "P_SCALE",
          supplierId: "SUP_SAFE",
          status: "safe",
        }),
        expect.objectContaining({
          productId: "P_BAD",
          supplierId: "SUP_WEAK_2",
          status: "blocked",
          blockers: expect.arrayContaining([
            "capacity_blocked",
            "quote_not_approved",
          ]),
        }),
      ]),
    );
    expect(
      response.baControlAnswers.product_kill_or_stop_import_review,
    ).toEqual([
      expect.objectContaining({
        productId: "P_BAD",
        status: "needs_review",
        blockers: expect.arrayContaining([
          "negative_product_economics",
          "return_cancel_refund_rate_too_high",
        ]),
      }),
    ]);
    expect(response.baControlAnswers.campaign_or_ad_group_pause).toEqual([
      expect.objectContaining({
        campaignId: "1002",
        adGroupId: "2002",
        status: "needs_review",
      }),
    ]);
    expect(response.pendingActionNormalization.summary).toEqual(
      expect.objectContaining({
        pending_actions_created: 7,
        provider_action_records: 2,
        internal_task_records: 3,
        monitoring_records: 2,
      }),
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        provider_mvp_actions_requiring_validateOnly: 2,
        monitor_only_mvp_safety_actions: 2,
        out_of_scope_non_provider_actions: 3,
      }),
    );
    expect(response.mvpActionContractReview).toEqual(
      expect.objectContaining({
        provider_mvp_actions_requiring_validateOnly: 2,
        monitor_only_mvp_safety_actions: 2,
        out_of_scope_non_provider_actions: 3,
        supported_mvp_actions: 4,
        unsupported_mvp_actions: 3,
      }),
    );
    expect(response.mvpActionContractReview.action_contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "pause_ad_group",
          mvp_action_contract: expect.objectContaining({
            action_scope: "provider_validateOnly_required",
            provider_validateOnly_required_before_future_execution: true,
          }),
        }),
        expect.objectContaining({
          action_type: "monitor_only",
          mvp_action_contract: expect.objectContaining({
            action_scope: "monitor_only_safety_action",
            preflight_treatment: "visible_non_executable_safety_action",
          }),
          evidence: expect.arrayContaining([
            "monitor_only_visible_non_executable_safety_action=true",
          ]),
        }),
        expect.objectContaining({
          action_type: "supplier_sourcing",
          mvp_action_contract: expect.objectContaining({
            action_scope: "out_of_scope_non_provider_action",
            preflight_treatment: "not_in_mvp_validateOnly_contract",
          }),
          evidence: expect.arrayContaining([
            "non_mvp_internal_action_out_of_scope=true",
          ]),
        }),
      ]),
    );
    expect(response.safety).toEqual(
      expect.objectContaining({
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
  });
});
