import { BadRequestException, Injectable } from "@nestjs/common";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import type {
  AdsAutomationCategoryKey,
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
} from "./contracts/ads-automation-decision.contract";
import type {
  AdsAutomationAdGroupReadRow,
  AdsAutomationDecisionSourceAdapterResult,
  AdsAutomationProductReadRow,
  AdsAutomationSupplierReadRow,
} from "./contracts/ads-automation-decision-source-adapter.contract";
import type { SourceSyncDecisionEvidence } from "./source-sync/source-sync-result.types";
import type {
  AdsAutomationReadonlyCashflowFirstGateCheck,
  AdsAutomationReadonlyDecisionCandidateEffectiveStatus,
  AdsAutomationReadonlyDecisionReadiness,
  AdsAutomationReadonlyDecisionReadinessCandidate,
  AdsAutomationReadonlyDecisionReadinessCategoryGate,
  AdsAutomationReadonlyDecisionReadinessSourceBlocker,
  AdsAutomationReadonlyDecisionSafetyInput,
  AdsAutomationReadonlyImportAccountInput,
  AdsAutomationReadonlyImportAccountReadiness,
  AdsAutomationReadonlyImportRetryState,
  AdsAutomationReadonlyMetricReadinessRow,
  AdsAutomationReadonlyMetricRowInput,
  AdsAutomationReadonlyPlatformEntityCoverage,
  AdsAutomationReadonlyPlatformMetricEntityCoverageRow,
  AdsAutomationReadonlyPlatformImportReadinessInput,
  AdsAutomationReadonlyPlatformImportReadinessResponse,
  AdsAutomationReadonlyProductMappingCoverageRow,
  AdsAutomationReadonlyInventoryProfitCoverageRow,
  AdsAutomationReadonlySupplierSafetyCoverageRow,
  AdsAutomationReadonlySourceTrustLevel,
  AdsAutomationReadonlySourceImportCoverage,
} from "./contracts/ads-automation-readonly-platform-import-readiness.contract";

const TRUSTED_SOURCE_LEVELS: AdsAutomationReadonlySourceTrustLevel[] = [
  "provider_verified",
  "erp_local_verified",
  "fixture_verified",
];

const SOURCE_DECISION_CATEGORIES: Record<string, AdsAutomationCategoryKey[]> = {
  google_ads: [
    "scale_ads",
    "scale_amount",
    "target_ad_groups",
    "campaign_or_ad_group_pause",
  ],
  advertising_costs: [
    "scale_ads",
    "scale_amount",
    "target_ad_groups",
    "campaign_or_ad_group_pause",
  ],
  product_mapping: [
    "scale_ads",
    "scale_amount",
    "target_ad_groups",
    "product_budget_allocation",
    "product_kill_or_stop_review",
  ],
  inventory_profit: [
    "scale_ads",
    "scale_amount",
    "target_ad_groups",
    "product_budget_allocation",
    "product_kill_or_stop_review",
  ],
  supplier_safety: [
    "scale_ads",
    "scale_amount",
    "target_ad_groups",
    "product_budget_allocation",
    "supplier_gate",
  ],
};

const REQUIRED_DECISION_SOURCE_KEYS = [
  "google_ads",
  "advertising_costs",
  "product_mapping",
  "inventory_profit",
  "supplier_safety",
] as const;

type RequiredDecisionSourceKey = (typeof REQUIRED_DECISION_SOURCE_KEYS)[number];

const DECISION_CATEGORIES: AdsAutomationCategoryKey[] = [
  "scale_ads",
  "scale_amount",
  "target_ad_groups",
  "product_budget_allocation",
  "supplier_gate",
  "product_kill_or_stop_review",
  "campaign_or_ad_group_pause",
];

@Injectable()
export class AdsAutomationReadonlyPlatformImportReadinessService {
  constructor(
    private readonly decisionSourceAdapter: AdsAutomationDecisionSourceAdapterService = new AdsAutomationDecisionSourceAdapterService(),
    private readonly decisionService: AdsAutomationDecisionService = new AdsAutomationDecisionService(),
  ) {}

  build(
    input: AdsAutomationReadonlyPlatformImportReadinessInput,
  ): AdsAutomationReadonlyPlatformImportReadinessResponse {
    const reportDate = this.isoDate(input.reportDate, "reportDate");
    const generatedAt = (
      input.now ? this.dateTime(input.now, "now") : new Date()
    ).toISOString();
    const now = new Date(generatedAt);
    const accounts = this.accounts(input.accounts);
    const metricRows = this.metricRows(input.metricRows);
    const normalizedMetricRows = metricRows.map((row) =>
      this.metricRowReadiness(row),
    );
    const sourceSyncBlockers = this.sourceSyncBlockers(input);
    const accountReadiness = accounts.map((account) =>
      this.accountReadiness({
        account,
        reportDate,
        now,
        metricRows,
        sourceSyncBlockers,
      }),
    );
    const readonlyImportBlockers = this.readonlyImportBlockers(
      accountReadiness,
      normalizedMetricRows,
    );
    const cashflowFirstGate = this.cashflowFirstGate(
      input.decisionSafety,
      accountReadiness,
      sourceSyncBlockers,
      input.lossLimitPolicy || null,
    );
    const initialDecisionReadiness = this.decisionReadiness({
      input,
      reportDate,
      now,
      sourceSyncBlockers,
      readonlyImportBlockers,
      cashflowFirstGate,
    });
    const initialPlatformEntityCoverage = this.platformEntityCoverage(
      input,
      normalizedMetricRows,
      initialDecisionReadiness,
    );
    const platformEntityCoverageBlockers = this.platformEntityReadinessBlockers(
      initialPlatformEntityCoverage,
    );
    const decisionReadiness = platformEntityCoverageBlockers.length
      ? this.decisionReadiness({
          input,
          reportDate,
          now,
          sourceSyncBlockers,
          readonlyImportBlockers,
          platformEntityCoverageBlockers,
          cashflowFirstGate,
        })
      : initialDecisionReadiness;
    const platformEntityCoverage = initialPlatformEntityCoverage;
    const blockers = this.unique([
      ...sourceSyncBlockers,
      ...accountReadiness.flatMap((account) => account.blockers),
      ...normalizedMetricRows.flatMap((row) => row.blockers),
      ...cashflowFirstGate.blockers,
      ...decisionReadiness.read_model_blockers,
      ...platformEntityCoverageBlockers,
    ]);
    const readyAccountCount = accountReadiness.filter(
      (account) => account.canUseForAdsAutomationDecision,
    ).length;
    const readyMetricRows = normalizedMetricRows.filter(
      (row) => row.canUseForAdsAutomationDecision,
    ).length;
    const campaignBudgetMissingCount = normalizedMetricRows.filter((row) =>
      row.blockers.includes("campaignBudgetId_missing_no_fallback"),
    ).length;
    const requiredSourceCoverage = this.requiredSourceCoverage(
      decisionReadiness.sourceImportCoverage,
    );
    const requiredSourceReadyCount = requiredSourceCoverage.filter(
      (source) => source.canUseForAdsAutomationDecision,
    ).length;
    const requiredSourceReportDateCoveredCount = requiredSourceCoverage.filter(
      (source) => this.sourceCoverageCoversReportDate(source),
    ).length;
    const missingRequiredSourceEvidence = requiredSourceCoverage
      .filter((source) =>
        source.blockingReasons.some((blocker) =>
          blocker.endsWith(
            "_source_evidence_missing_for_ads_automation_decision",
          ),
        ),
      )
      .map((source) => String(source.sourceKey));
    const sourceCoverageBlockingReasons = this.unique(
      requiredSourceCoverage.flatMap((source) => source.blockingReasons),
    );
    const blocked = blockers.length > 0;

    return {
      schemaVersion: "ads_automation_readonly_platform_import_readiness.v1",
      generatedAt,
      reportDate,
      safety: {
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
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        campaignBudgetId_no_fallback: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      },
      summary: {
        status: blocked ? "blocked" : "ready_for_local_decision_review",
        fixture_mode: input.fixtureMode || "custom_local_payload",
        account_count: accountReadiness.length,
        ready_account_count: readyAccountCount,
        blocked_account_count: accountReadiness.length - readyAccountCount,
        metric_row_count: normalizedMetricRows.length,
        metric_rows_ready: readyMetricRows,
        required_source_count: REQUIRED_DECISION_SOURCE_KEYS.length,
        required_source_ready_count: requiredSourceReadyCount,
        required_source_blocked_count:
          requiredSourceCoverage.length - requiredSourceReadyCount,
        required_source_report_date_covered_count:
          requiredSourceReportDateCoveredCount,
        required_source_report_date_blocked_count:
          requiredSourceCoverage.length - requiredSourceReportDateCoveredCount,
        missing_required_source_evidence: missingRequiredSourceEvidence,
        source_coverage_blocking_reasons: sourceCoverageBlockingReasons,
        stale_or_missing_imports: accountReadiness
          .filter(
            (account) =>
              account.freshness.status !== "fresh" ||
              account.coverage.status !== "covered",
          )
          .map(
            (account) =>
              account.accountId || account.customerId || "unmapped_account",
          ),
        missing_account_mapping: accountReadiness
          .filter((account) =>
            account.blockers.some((blocker) => blocker.includes("mapping")),
          )
          .map(
            (account) =>
              account.accountId || account.customerId || "unmapped_account",
          ),
        retry_blocked_accounts: accountReadiness
          .filter((account) => account.retryBackoffState.status !== "idle")
          .map(
            (account) =>
              account.accountId || account.customerId || "unmapped_account",
          ),
        campaignBudgetId_missing_rows: campaignBudgetMissingCount,
        source_sync_blocker_count: sourceSyncBlockers.length,
        cashflow_first_scale_all_safe: cashflowFirstGate.all_safe,
        scale_up_execution_mode: decisionReadiness.scale_up_execution_mode,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: blocked
          ? "resolve_readonly_import_readiness_blockers"
          : "review_local_readonly_import_evidence",
      },
      sourceSyncSummary: input.sourceSyncStatus
        ? {
            status: input.sourceSyncStatus.summary.status,
            blocked_sources: [
              ...input.sourceSyncStatus.summary.blocked_sources,
            ],
            stale_sources: [...input.sourceSyncStatus.summary.stale_sources],
            missing_config_sources: [
              ...input.sourceSyncStatus.summary.missing_config_sources,
            ],
            missing_coverage_sources: [
              ...input.sourceSyncStatus.summary.missing_coverage_sources,
            ],
            not_synced_sources: [
              ...input.sourceSyncStatus.summary.not_synced_sources,
            ],
          }
        : null,
      sourceImportCoverage: decisionReadiness.sourceImportCoverage,
      platformEntityCoverage,
      accounts: accountReadiness,
      metricRows: normalizedMetricRows,
      cashflowFirstGate,
      decisionReadiness,
      lossLimitPolicy: input.lossLimitPolicy
        ? {
            schemaVersion: input.lossLimitPolicy.schemaVersion,
            summary: input.lossLimitPolicy.summary,
            scaleBlockers: [...input.lossLimitPolicy.scaleBlockers],
          }
        : null,
      blockers,
      warnings: this.unique(
        accountReadiness.flatMap((account) => account.warnings),
      ),
      markdownPreview: this.markdownPreview({
        reportDate,
        accounts: accountReadiness,
        metricRows: normalizedMetricRows,
        blockers,
        cashflowBlockers: cashflowFirstGate.blockers,
        decisionReadiness,
        platformEntityCoverage,
      }),
    };
  }

  private decisionReadiness(input: {
    input: AdsAutomationReadonlyPlatformImportReadinessInput;
    reportDate: string;
    now: Date;
    sourceSyncBlockers: string[];
    cashflowFirstGate: AdsAutomationReadonlyPlatformImportReadinessResponse["cashflowFirstGate"];
    readonlyImportBlockers: string[];
    platformEntityCoverageBlockers?: string[];
  }): AdsAutomationReadonlyDecisionReadiness {
    const sourceImportCoverage = this.sourceImportCoverage(input.input);
    const sourceGateBlockers = this.sourceGateBlockers(
      input.input,
      sourceImportCoverage,
    );
    const sourceToDecisionBlockers = this.sourceToDecisionBlockers(
      input.input,
      sourceImportCoverage,
    );
    const adapterResult = input.input.decisionReadModel
      ? this.decisionSourceAdapter.build(input.input.decisionReadModel, {
          snapshotDate: input.reportDate,
          now: input.now,
        })
      : null;
    const snapshot = adapterResult
      ? this.decisionService.build(adapterResult.snapshotInput)
      : null;
    const readModelBlockers = this.readModelBlockers(adapterResult);
    if (!adapterResult) readModelBlockers.push("decision_read_model_missing");

    const cashflowBlockers = input.cashflowFirstGate.blockers;
    const readonlyImportBlockers = this.unique([
      ...input.readonlyImportBlockers,
      ...(input.platformEntityCoverageBlockers || []),
    ]);
    const sourceGateReady =
      sourceGateBlockers.length === 0 &&
      input.input.sourceSyncStatus?.decisionGates.canGenerateActionDraft ===
        true &&
      input.input.sourceSyncStatus?.decisionGates.canRecommendAdsScale === true;
    const readonlyImportReady = readonlyImportBlockers.length === 0;
    const readModelReady =
      Boolean(adapterResult) && readModelBlockers.length === 0;
    const allGatesReady =
      sourceGateReady &&
      readonlyImportReady &&
      readModelReady &&
      input.cashflowFirstGate.all_safe;
    const decisions = snapshot?.decisions || [];
    const categoryGates = DECISION_CATEGORIES.map((category) =>
      this.decisionCategoryGate({
        category,
        snapshot,
        sourceToDecisionBlockers,
        readonlyImportBlockers,
        readModelBlockers,
        cashflowBlockers,
        allGatesReady,
      }),
    );
    const candidates = {
      adGroupsToIncrease: this.candidates(
        decisions,
        "scale_amount",
        categoryGates,
        allGatesReady,
      ),
      targetAdGroups: this.candidates(
        decisions,
        "target_ad_groups",
        categoryGates,
        allGatesReady,
      ),
      productsEligibleForBudget: this.candidates(
        decisions,
        "product_budget_allocation",
        categoryGates,
        allGatesReady,
      ),
      supplierChoices: this.candidates(
        decisions,
        "supplier_gate",
        categoryGates,
        allGatesReady,
      ),
      productKillOrStopReview: this.candidates(
        decisions,
        "product_kill_or_stop_review",
        categoryGates,
        allGatesReady,
      ),
      campaignOrAdGroupPause: this.candidates(
        decisions,
        "campaign_or_ad_group_pause",
        categoryGates,
        allGatesReady,
      ),
    };
    const scaleCandidates = candidates.adGroupsToIncrease.filter(
      (candidate) =>
        candidate.status === "scale_ready" &&
        candidate.effectiveStatus === "candidate_for_review",
    );
    const maxIncreaseVnd = scaleCandidates.reduce(
      (sum, candidate) => sum + (candidate.increaseVnd || 0),
      0,
    );
    const scaleUpExecutionMode = allGatesReady
      ? "pending_validation"
      : "monitor_only";
    const answers = this.decisionAnswers({
      candidates,
      scaleCandidates,
      maxIncreaseVnd,
      scaleUpExecutionMode,
      sourceGateBlockers,
      readonlyImportBlockers,
      readModelBlockers,
      cashflowBlockers,
    });

    return {
      status: allGatesReady ? "ready_for_local_decision_review" : "blocked",
      source_gate_status: sourceGateReady ? "ready" : "blocked",
      readonly_import_status: readonlyImportReady ? "ready" : "blocked",
      read_model_status: !adapterResult
        ? "missing"
        : readModelReady
          ? "ready"
          : "blocked",
      source_gate_blockers: sourceGateBlockers,
      readonly_import_blockers: readonlyImportBlockers,
      read_model_blockers: this.unique(readModelBlockers),
      cashflow_blockers: cashflowBlockers,
      required_source_evidence:
        input.input.sourceSyncStatus?.decisionEvidence || [],
      sourceImportCoverage,
      source_to_decision_blockers: sourceToDecisionBlockers,
      decision_categories: categoryGates,
      action_generation_allowed_for_review: allGatesReady,
      can_generate_action_draft: allGatesReady,
      can_increase_ads: scaleCandidates.length > 0,
      max_increase_vnd: maxIncreaseVnd,
      scale_up_execution_mode: scaleUpExecutionMode,
      execution_allowed_now: false,
      answers,
      candidates,
      readModelEvidence: {
        sourceEvidence: adapterResult?.sourceEvidence || [],
        missingFieldEvidence: adapterResult?.missingFieldEvidence || [],
      },
    };
  }

  private platformEntityCoverage(
    input: AdsAutomationReadonlyPlatformImportReadinessInput,
    metricRows: AdsAutomationReadonlyMetricReadinessRow[],
    decisionReadiness: AdsAutomationReadonlyDecisionReadiness,
  ): AdsAutomationReadonlyPlatformEntityCoverage {
    const campaignIds = this.ids(metricRows.map((row) => row.campaignId));
    const adGroupIds = this.ids(metricRows.map((row) => row.adGroupId));
    const campaignBudgetIds = this.ids(
      metricRows.map((row) => row.campaignBudgetId),
    );
    const campaignBlockers = this.unique(
      metricRows.flatMap((row) =>
        row.blockers.filter((blocker) => blocker.includes("campaignId")),
      ),
    );
    const adGroupBlockers = this.unique(
      metricRows.flatMap((row) =>
        row.blockers.filter((blocker) => blocker.includes("adGroupId")),
      ),
    );
    const budgetBlockers = this.unique(
      metricRows.flatMap((row) =>
        row.blockers.filter((blocker) => blocker.includes("campaignBudgetId")),
      ),
    );
    const decisionCandidates = Object.values(
      decisionReadiness.candidates,
    ).flat();
    const allCandidateBlockers = this.unique([
      ...decisionCandidates.flatMap((candidate) => candidate.blockers),
      ...decisionReadiness.source_gate_blockers,
      ...decisionReadiness.readonly_import_blockers,
      ...decisionReadiness.read_model_blockers,
      ...decisionReadiness.cashflow_blockers,
    ]);
    const products = input.decisionReadModel?.products || [];
    const adGroups = input.decisionReadModel?.adGroups || [];
    const suppliers = input.decisionReadModel?.suppliers || [];
    const readModelCampaignIds = this.ids(
      adGroups.map((adGroup) => adGroup.campaignId),
    );
    const readModelAdGroupIds = this.ids(
      adGroups.map((adGroup) => adGroup.adGroupId),
    );
    const readModelCampaignBudgetIds = this.ids(
      adGroups.map((adGroup) => adGroup.campaignBudgetId),
    );
    const missingReadModelCampaignIds = campaignIds.filter(
      (campaignId) => !readModelCampaignIds.includes(campaignId),
    );
    const missingReadModelAdGroupIds = adGroupIds.filter(
      (adGroupId) => !readModelAdGroupIds.includes(adGroupId),
    );
    const missingReadModelCampaignBudgetIds = campaignBudgetIds.filter(
      (campaignBudgetId) =>
        !readModelCampaignBudgetIds.includes(campaignBudgetId),
    );
    const importedAdGroups = adGroups.filter(
      (adGroup) => adGroup.adGroupId && adGroupIds.includes(adGroup.adGroupId),
    );
    const productIdsFromImportedAdGroups = this.ids(
      importedAdGroups.flatMap((adGroup) => [
        ...(adGroup.productIds || []),
        ...(adGroup.internalProductIds || []),
        ...(adGroup.mappedProductIds || []),
      ]),
    );
    const readModelProductIds = this.ids(
      products.map((product) => product.productId),
    );
    const missingMappedProductIds = productIdsFromImportedAdGroups.filter(
      (productId) => !readModelProductIds.includes(productId),
    );
    const productsForImportedAdGroups = products.filter(
      (product) =>
        product.productId &&
        productIdsFromImportedAdGroups.includes(product.productId),
    );
    const requiredSupplierIdsForMappedProducts = this.ids(
      productsForImportedAdGroups.flatMap(
        (product) => product.supplierIds || [],
      ),
    );
    const readModelSupplierIds = this.ids(
      suppliers.map((supplier) => supplier.supplierId),
    );
    const missingMappedSupplierIds =
      requiredSupplierIdsForMappedProducts.filter(
        (supplierId) => !readModelSupplierIds.includes(supplierId),
      );
    const mappedAdGroupIds = this.ids([
      ...products.flatMap((product) => product.mappedAdGroupIds || []),
      ...adGroups
        .filter(
          (adGroup) =>
            this.ids([
              ...(adGroup.productIds || []),
              ...(adGroup.internalProductIds || []),
              ...(adGroup.mappedProductIds || []),
            ]).length > 0,
        )
        .map((adGroup) => adGroup.adGroupId),
    ]);
    const mappedProductIds = this.ids([
      ...products.map((product) => product.productId),
      ...adGroups.flatMap((adGroup) => [
        ...(adGroup.productIds || []),
        ...(adGroup.internalProductIds || []),
        ...(adGroup.mappedProductIds || []),
      ]),
      ...decisionReadiness.candidates.productsEligibleForBudget.map(
        (candidate) => candidate.productId || candidate.entityId,
      ),
      ...decisionReadiness.candidates.productKillOrStopReview.map(
        (candidate) => candidate.productId || candidate.entityId,
      ),
    ]);
    const unmappedAdGroupIds = adGroupIds.filter(
      (adGroupId) => !mappedAdGroupIds.includes(adGroupId),
    );
    const campaignCoverageBlockers = this.unique([
      ...campaignBlockers,
      ...(missingReadModelCampaignIds.length
        ? ["read_model.google_ads_missing_imported_campaigns"]
        : []),
    ]);
    const adGroupCoverageBlockers = this.unique([
      ...adGroupBlockers,
      ...(missingReadModelAdGroupIds.length
        ? ["read_model.google_ads_missing_imported_ad_groups"]
        : []),
    ]);
    const campaignBudgetCoverageBlockers = this.unique([
      ...budgetBlockers,
      ...(missingReadModelCampaignBudgetIds.length
        ? ["read_model.campaign_budgets_missing_imported_budget_ids"]
        : []),
    ]);
    const productMappingBlockers = this.unique([
      ...this.blockersMatching(allCandidateBlockers, [
        "product_mapping",
        "product_performance",
        "mappedAdGroupIds",
        "productId",
      ]),
      ...(unmappedAdGroupIds.length
        ? ["product_mapping_unmapped_ad_groups"]
        : []),
    ]);
    const inventoryProfitBlockers = this.unique([
      ...this.blockersMatching(allCandidateBlockers, [
        "inventory_profit",
        "profit",
        "margin",
        "stock",
        "daysOfCover",
        "return_cancel",
        "refund",
      ]),
      ...(missingMappedProductIds.length
        ? ["read_model.inventory_profit_missing_mapped_products"]
        : []),
    ]);
    const supplierBlockers = this.unique([
      ...this.blockersMatching(allCandidateBlockers, [
        "supplier_safety",
        "supplier",
        "margin_after_cost",
        "lead_time",
        "late_delivery",
        "payment_freshness",
        "capacity",
        "return_fault",
      ]),
      ...(missingMappedSupplierIds.length
        ? ["read_model.supplier_safety_missing_mapped_suppliers"]
        : []),
    ]);
    const sourceReady = (sourceKey: RequiredDecisionSourceKey) =>
      decisionReadiness.sourceImportCoverage.find(
        (source) => source.sourceKey === sourceKey,
      )?.canUseForAdsAutomationDecision === true;
    const campaignMetricRollups = this.metricEntityRollups({
      entityField: "campaignId",
      reportDate: input.reportDate,
      metricRows,
      adGroups,
      products,
      candidates: decisionCandidates,
    });
    const adGroupMetricRollups = this.metricEntityRollups({
      entityField: "adGroupId",
      reportDate: input.reportDate,
      metricRows,
      adGroups,
      products,
      candidates: decisionCandidates,
    });
    const campaignBudgetMetricRollups = this.metricEntityRollups({
      entityField: "campaignBudgetId",
      reportDate: input.reportDate,
      metricRows,
      adGroups,
      products,
      candidates: decisionCandidates,
    });

    return {
      metrics: {
        rows: metricRows.length,
        readyRows: metricRows.filter(
          (row) => row.canUseForAdsAutomationDecision,
        ).length,
        spendVnd: this.sum(metricRows, "spendVnd"),
        costVnd: this.sum(metricRows, "spendVnd"),
        clicks: this.sum(metricRows, "clicks"),
        impressions: this.sum(metricRows, "impressions"),
        conversions: this.sum(metricRows, "conversions"),
        conversionValueVnd: this.sum(metricRows, "conversionValueVnd"),
      },
      campaigns: {
        campaignIds,
        readModelCampaignIds,
        missingReadModelCampaignIds,
        coveredCampaignCount: campaignIds.length,
        missingCampaignIdRows: metricRows.filter((row) => !row.campaignId)
          .length,
        metricRollups: campaignMetricRollups,
        blockers: campaignCoverageBlockers,
        coveredForDecision:
          campaignIds.length > 0 && campaignCoverageBlockers.length === 0,
      },
      adGroups: {
        adGroupIds,
        readModelAdGroupIds,
        missingReadModelAdGroupIds,
        coveredAdGroupCount: adGroupIds.length,
        missingAdGroupIdRows: metricRows.filter((row) => !row.adGroupId).length,
        metricRollups: adGroupMetricRollups,
        blockers: adGroupCoverageBlockers,
        coveredForDecision:
          adGroupIds.length > 0 && adGroupCoverageBlockers.length === 0,
      },
      campaignBudgets: {
        campaignBudgetIds,
        readModelCampaignBudgetIds,
        missingReadModelCampaignBudgetIds,
        coveredCampaignBudgetCount: campaignBudgetIds.length,
        missingCampaignBudgetIdRows: metricRows.filter(
          (row) => !row.campaignBudgetId,
        ).length,
        campaignBudgetId_required: true,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        metricRollups: campaignBudgetMetricRollups,
        blockers: campaignBudgetCoverageBlockers,
        coveredForDecision:
          campaignBudgetIds.length > 0 &&
          campaignBudgetCoverageBlockers.length === 0,
      },
      productMapping: {
        mappedProductIds,
        mappedAdGroupIds,
        unmappedAdGroupIds,
        sourceReady: sourceReady("product_mapping"),
        productMappings: this.productMappingCoverage(
          products,
          adGroups,
          decisionCandidates,
          sourceReady("product_mapping"),
        ),
        blockers: productMappingBlockers,
        coveredForDecision:
          sourceReady("product_mapping") &&
          mappedProductIds.length > 0 &&
          unmappedAdGroupIds.length === 0 &&
          productMappingBlockers.length === 0,
      },
      inventoryProfit: {
        profitableProductIds: this.ids(
          decisionReadiness.candidates.productsEligibleForBudget
            .filter(
              (candidate) =>
                candidate.effectiveStatus === "candidate_for_review",
            )
            .map((candidate) => candidate.productId || candidate.entityId),
        ),
        blockedProductIds: this.ids([
          ...decisionReadiness.answers.blocked_product_budget_candidates.map(
            (candidate) => candidate.productId || candidate.entityId,
          ),
          ...decisionReadiness.answers.product_kill_or_stop_review.map(
            (candidate) => candidate.productId || candidate.entityId,
          ),
        ]),
        missingMappedProductIds,
        sourceReady: sourceReady("inventory_profit"),
        productReadiness: this.inventoryProfitCoverage(
          products,
          decisionCandidates,
          sourceReady("inventory_profit"),
        ),
        blockers: inventoryProfitBlockers,
        coveredForDecision:
          sourceReady("inventory_profit") &&
          missingMappedProductIds.length === 0 &&
          !this.blockersMatching(inventoryProfitBlockers, [
            "inventory_profit",
            "product_performance_missing",
            "product_performance_stale",
            "read_model.product_performance",
          ]).length,
      },
      supplierContext: {
        safeSupplierIds: this.ids(
          decisionReadiness.answers.safe_supplier_choices.map(
            (candidate) => candidate.supplierId || candidate.entityId,
          ),
        ),
        blockedSupplierIds: this.ids(
          decisionReadiness.answers.blocked_supplier_choices.map(
            (candidate) => candidate.supplierId || candidate.entityId,
          ),
        ),
        missingMappedSupplierIds,
        supplierChoiceSafe: decisionReadiness.answers.supplier_choice_safe,
        sourceReady: sourceReady("supplier_safety"),
        supplierReadiness: this.supplierSafetyCoverage(
          suppliers,
          decisionCandidates,
          sourceReady("supplier_safety"),
        ),
        blockers: supplierBlockers,
        coveredForDecision:
          sourceReady("supplier_safety") &&
          missingMappedSupplierIds.length === 0 &&
          decisionReadiness.answers.supplier_choice_safe &&
          !this.blockersMatching(supplierBlockers, [
            "supplier_safety",
            "supplier_safety_missing",
            "supplier_safety_stale",
            "read_model.supplier_safety",
          ]).length,
      },
      freshnessCoverage: {
        latestSuccessfulSyncAt: this.latestText(
          decisionReadiness.sourceImportCoverage.map(
            (source) => source.lastSuccessfulSyncAt,
          ),
        ),
        latestRecordDate: this.latestText(
          decisionReadiness.sourceImportCoverage.map(
            (source) => source.latestRecordDate,
          ),
        ),
        blockingReasons: this.unique(
          decisionReadiness.sourceImportCoverage.flatMap(
            (source) => source.blockingReasons,
          ),
        ),
      },
    };
  }

  private metricEntityRollups(input: {
    entityField: "campaignId" | "adGroupId" | "campaignBudgetId";
    reportDate: string;
    metricRows: AdsAutomationReadonlyMetricReadinessRow[];
    adGroups: AdsAutomationAdGroupReadRow[];
    products: AdsAutomationProductReadRow[];
    candidates: AdsAutomationReadonlyDecisionReadinessCandidate[];
  }): AdsAutomationReadonlyPlatformMetricEntityCoverageRow[] {
    return this.ids(input.metricRows.map((row) => row[input.entityField])).map(
      (entityId) => {
        const rows = input.metricRows.filter(
          (row) => row[input.entityField] === entityId,
        );
        const matchedAdGroups = this.matchingAdGroups(
          entityId,
          input.entityField,
          input.adGroups,
        );
        const mappedProductIds = this.ids(
          matchedAdGroups.flatMap((adGroup) => this.adGroupProductIds(adGroup)),
        );
        const supplierIds = this.ids(
          input.products
            .filter(
              (product) =>
                product.productId &&
                mappedProductIds.includes(product.productId),
            )
            .flatMap((product) => product.supplierIds || []),
        );
        const campaignBudgetIds = this.ids([
          ...rows.map((row) => row.campaignBudgetId),
          ...matchedAdGroups.map((adGroup) => adGroup.campaignBudgetId),
        ]);
        const linkedCandidates = input.candidates.filter((candidate) =>
          this.candidateMatchesMetricEntity({
            candidate,
            entityId,
            entityField: input.entityField,
            matchedAdGroups,
            mappedProductIds,
            campaignBudgetIds,
          }),
        );
        const metricRowBlockers = this.unique(
          rows.flatMap((row) => row.blockers),
        );
        const dates = this.ids(rows.map((row) => row.date));

        return {
          entityId,
          accountIds: this.ids(rows.map((row) => row.accountId)),
          customerIds: this.ids(rows.map((row) => row.customerId)),
          campaignIds: this.ids([
            ...rows.map((row) => row.campaignId),
            ...matchedAdGroups.map((adGroup) => adGroup.campaignId),
          ]),
          adGroupIds: this.ids([
            ...rows.map((row) => row.adGroupId),
            ...matchedAdGroups.map((adGroup) => adGroup.adGroupId),
          ]),
          campaignBudgetIds,
          mappedProductIds,
          supplierIds,
          dates,
          reportDateCovered: dates.includes(input.reportDate),
          rows: rows.length,
          readyRows: rows.filter((row) => row.canUseForAdsAutomationDecision)
            .length,
          spendVnd: this.sum(rows, "spendVnd"),
          costVnd: this.sum(rows, "spendVnd"),
          clicks: this.sum(rows, "clicks"),
          impressions: this.sum(rows, "impressions"),
          conversions: this.sum(rows, "conversions"),
          conversionValueVnd: this.sum(rows, "conversionValueVnd"),
          linkedDecisionTypes: this.unique(
            linkedCandidates.map((candidate) => candidate.decisionType),
          ) as AdsAutomationCategoryKey[],
          linkedDecisionEffectiveStatuses: this.unique(
            linkedCandidates.map((candidate) => candidate.effectiveStatus),
          ) as AdsAutomationReadonlyDecisionCandidateEffectiveStatus[],
          blockers: this.unique([
            ...metricRowBlockers,
            ...linkedCandidates.flatMap((candidate) => candidate.blockers),
          ]),
          coveredForDecision:
            rows.length > 0 &&
            rows.every((row) => row.canUseForAdsAutomationDecision) &&
            metricRowBlockers.length === 0,
        };
      },
    );
  }

  private productMappingCoverage(
    products: AdsAutomationProductReadRow[],
    adGroups: AdsAutomationAdGroupReadRow[],
    candidates: AdsAutomationReadonlyDecisionReadinessCandidate[],
    sourceReady: boolean,
  ): AdsAutomationReadonlyProductMappingCoverageRow[] {
    return this.ids([
      ...products.map((product) => product.productId),
      ...adGroups.flatMap((adGroup) => this.adGroupProductIds(adGroup)),
    ]).map((productId) => {
      const product = products.find(
        (candidate) => candidate.productId === productId,
      );
      const mappedAdGroupIds = this.ids([
        ...(product?.mappedAdGroupIds || []),
        ...adGroups
          .filter((adGroup) =>
            this.adGroupProductIds(adGroup).includes(productId),
          )
          .map((adGroup) => adGroup.adGroupId),
      ]);
      const campaignBudgetIds = this.ids(
        adGroups
          .filter((adGroup) =>
            this.adGroupProductIds(adGroup).includes(productId),
          )
          .map((adGroup) => adGroup.campaignBudgetId),
      );
      const supplierIds = this.ids(product?.supplierIds || []);
      const candidateBlockers = candidates
        .filter((candidate) =>
          this.candidateMatchesProduct(candidate, productId),
        )
        .flatMap((candidate) => candidate.blockers);

      return {
        productId,
        mappedAdGroupIds,
        campaignBudgetIds,
        supplierIds,
        blockers: this.unique([
          ...candidateBlockers,
          ...(sourceReady ? [] : ["product_mapping_source_not_ready"]),
          ...(mappedAdGroupIds.length
            ? []
            : ["read_model.product_mapping_missing_mapped_ad_groups"]),
          ...(supplierIds.length
            ? []
            : ["read_model.product_mapping_missing_supplier_ids"]),
        ]),
        coveredForDecision:
          sourceReady && mappedAdGroupIds.length > 0 && supplierIds.length > 0,
      };
    });
  }

  private inventoryProfitCoverage(
    products: AdsAutomationProductReadRow[],
    candidates: AdsAutomationReadonlyDecisionReadinessCandidate[],
    sourceReady: boolean,
  ): AdsAutomationReadonlyInventoryProfitCoverageRow[] {
    return this.ids([
      ...products.map((product) => product.productId),
      ...candidates
        .filter(
          (candidate) =>
            candidate.decisionType === "product_budget_allocation" ||
            candidate.decisionType === "product_kill_or_stop_review",
        )
        .map((candidate) => candidate.productId || candidate.entityId),
    ]).map((productId) => {
      const product = products.find(
        (candidate) => candidate.productId === productId,
      );
      const productCandidates = candidates.filter((candidate) =>
        this.candidateMatchesProduct(candidate, productId),
      );
      const canReceiveBudget = productCandidates.some(
        (candidate) =>
          candidate.decisionType === "product_budget_allocation" &&
          candidate.effectiveStatus === "candidate_for_review",
      );
      const needsKillOrStopReview = productCandidates.some(
        (candidate) =>
          candidate.decisionType === "product_kill_or_stop_review" &&
          candidate.status === "needs_review",
      );
      const requiredFieldsPresent =
        product &&
        product.netProfitVnd !== undefined &&
        product.marginPercent !== undefined &&
        product.stockAvailable !== undefined &&
        product.daysOfCover !== undefined;

      return {
        productId,
        netProfitVnd: this.numberOrNull(product?.netProfitVnd),
        adAttributedNetProfitAfterAdsVnd: this.numberOrNull(
          product?.adAttributedNetProfitAfterAdsVnd,
        ),
        marginPercent: this.numberOrNull(product?.marginPercent),
        stockAvailable: this.numberOrNull(product?.stockAvailable),
        daysOfCover: this.numberOrNull(product?.daysOfCover),
        canReceiveBudget,
        needsKillOrStopReview,
        blockers: this.unique([
          ...productCandidates.flatMap((candidate) => candidate.blockers),
          ...(sourceReady ? [] : ["inventory_profit_source_not_ready"]),
          ...(requiredFieldsPresent
            ? []
            : ["read_model.inventory_profit_missing_product_economics"]),
        ]),
        coveredForDecision: Boolean(sourceReady && requiredFieldsPresent),
      };
    });
  }

  private supplierSafetyCoverage(
    suppliers: AdsAutomationSupplierReadRow[],
    candidates: AdsAutomationReadonlyDecisionReadinessCandidate[],
    sourceReady: boolean,
  ): AdsAutomationReadonlySupplierSafetyCoverageRow[] {
    return this.ids([
      ...suppliers.map((supplier) => supplier.supplierId),
      ...candidates
        .filter((candidate) => candidate.decisionType === "supplier_gate")
        .map((candidate) => candidate.supplierId || candidate.entityId),
    ]).map((supplierId) => {
      const supplier = suppliers.find(
        (candidate) => candidate.supplierId === supplierId,
      );
      const supplierCandidates = candidates.filter((candidate) =>
        this.candidateMatchesSupplier(candidate, supplierId),
      );
      const requiredFieldsPresent =
        supplier &&
        supplier.quoteApproved !== undefined &&
        supplier.marginAfterCostPercent !== undefined &&
        supplier.leadTimeDays !== undefined &&
        supplier.lateDeliveryRatePercent !== undefined &&
        supplier.paymentFreshnessDays !== undefined &&
        supplier.capacityStatus !== undefined &&
        supplier.returnFaultRatePercent !== undefined;

      return {
        supplierId,
        productId: supplier?.productId || null,
        quoteApproved:
          typeof supplier?.quoteApproved === "boolean"
            ? supplier.quoteApproved
            : null,
        marginAfterCostPercent: this.numberOrNull(
          supplier?.marginAfterCostPercent,
        ),
        leadTimeDays: this.numberOrNull(supplier?.leadTimeDays),
        lateDeliveryRatePercent: this.numberOrNull(
          supplier?.lateDeliveryRatePercent,
        ),
        paymentFreshnessDays: this.numberOrNull(supplier?.paymentFreshnessDays),
        capacityStatus: this.text(supplier?.capacityStatus),
        returnFaultRatePercent: this.numberOrNull(
          supplier?.returnFaultRatePercent,
        ),
        safeForBudgetAllocation: supplierCandidates.some(
          (candidate) =>
            candidate.status === "safe" &&
            candidate.effectiveStatus === "candidate_for_review",
        ),
        blockers: this.unique([
          ...supplierCandidates.flatMap((candidate) => candidate.blockers),
          ...(sourceReady ? [] : ["supplier_safety_source_not_ready"]),
          ...(requiredFieldsPresent
            ? []
            : ["read_model.supplier_safety_missing_supplier_fields"]),
        ]),
        coveredForDecision: Boolean(sourceReady && requiredFieldsPresent),
      };
    });
  }

  private matchingAdGroups(
    entityId: string,
    entityField: "campaignId" | "adGroupId" | "campaignBudgetId",
    adGroups: AdsAutomationAdGroupReadRow[],
  ): AdsAutomationAdGroupReadRow[] {
    return adGroups.filter((adGroup) => adGroup[entityField] === entityId);
  }

  private adGroupProductIds(adGroup: AdsAutomationAdGroupReadRow): string[] {
    return this.ids([
      ...(adGroup.productIds || []),
      ...(adGroup.internalProductIds || []),
      ...(adGroup.mappedProductIds || []),
    ]);
  }

  private candidateMatchesMetricEntity(input: {
    candidate: AdsAutomationReadonlyDecisionReadinessCandidate;
    entityId: string;
    entityField: "campaignId" | "adGroupId" | "campaignBudgetId";
    matchedAdGroups: AdsAutomationAdGroupReadRow[];
    mappedProductIds: string[];
    campaignBudgetIds: string[];
  }): boolean {
    const adGroupIds = this.ids(
      input.matchedAdGroups.map((adGroup) => adGroup.adGroupId),
    );
    if (input.entityField === "adGroupId") {
      return (
        input.candidate.entityId === input.entityId ||
        input.candidate.campaignBudgetId === input.entityId
      );
    }
    if (input.entityField === "campaignBudgetId") {
      return input.candidate.campaignBudgetId === input.entityId;
    }
    return (
      adGroupIds.includes(input.candidate.entityId) ||
      input.campaignBudgetIds.includes(
        input.candidate.campaignBudgetId || "",
      ) ||
      input.mappedProductIds.includes(
        input.candidate.productId || input.candidate.entityId,
      )
    );
  }

  private candidateMatchesProduct(
    candidate: AdsAutomationReadonlyDecisionReadinessCandidate,
    productId: string,
  ): boolean {
    return (
      candidate.productId === productId || candidate.entityId === productId
    );
  }

  private candidateMatchesSupplier(
    candidate: AdsAutomationReadonlyDecisionReadinessCandidate,
    supplierId: string,
  ): boolean {
    return (
      candidate.supplierId === supplierId || candidate.entityId === supplierId
    );
  }

  private sourceImportCoverage(
    input: AdsAutomationReadonlyPlatformImportReadinessInput,
  ): AdsAutomationReadonlySourceImportCoverage[] {
    const evidenceRows = input.sourceSyncStatus?.decisionEvidence || [];
    const presentSources = new Set(
      evidenceRows.map((evidence) => evidence.sourceKey),
    );
    const missingRequiredSourceCoverage = REQUIRED_DECISION_SOURCE_KEYS.filter(
      (sourceKey) => !presentSources.has(sourceKey),
    ).map((sourceKey) => {
      const blockingReason = this.missingSourceEvidenceReason(sourceKey);
      return {
        sourceKey,
        reportDate: input.reportDate,
        expectedReportDate: input.reportDate,
        reportDateMatches: true,
        freshnessStatus: "missing" as const,
        coverageStatus: "missing" as const,
        lastSuccessfulSyncAt: null,
        latestRecordDate: null,
        latestRecordDateCoversReportDate: false,
        blockingReason,
        blockingReasons: [blockingReason],
        affectedDecisionCategories: [
          ...(SOURCE_DECISION_CATEGORIES[sourceKey] || DECISION_CATEGORIES),
        ],
        canUseForAdsAutomationDecision: false,
      };
    });

    return [
      ...evidenceRows.map((evidence) =>
        this.sourceImportCoverageRow(evidence, input.reportDate),
      ),
      ...missingRequiredSourceCoverage,
    ];
  }

  private sourceImportCoverageRow(
    evidence: SourceSyncDecisionEvidence,
    expectedReportDate: string,
  ): AdsAutomationReadonlySourceImportCoverage {
    const sourceKey = evidence.sourceKey;
    const reportDate = evidence.reportDate || expectedReportDate;
    const freshnessStatus = evidence.freshnessStatus || "unknown";
    const coverageStatus = evidence.coverageStatus || "unknown";
    const lastSuccessfulSyncAt = evidence.lastSuccessfulSyncAt ?? null;
    const latestRecordDate = evidence.latestRecordDate ?? null;
    const reportDateMatches = reportDate === expectedReportDate;
    const reportDateCoverageStatusOk = ["covered", "not_applicable"].includes(
      coverageStatus,
    );
    const latestRecordDateCoversReportDate =
      !this.sourceRequiresReportDateRecord(sourceKey, coverageStatus) ||
      latestRecordDate === expectedReportDate;
    const freshnessOk = freshnessStatus === "fresh";
    const sourceReady =
      evidence.canUseForAdsAutomationDecision === true &&
      reportDateMatches &&
      reportDateCoverageStatusOk &&
      latestRecordDateCoversReportDate &&
      freshnessOk;
    const sourceNotReady = `${sourceKey}_not_ready_for_ads_automation_decision`;
    const generatedBlockers = this.unique([
      ...(reportDateMatches ? [] : [`${sourceKey}_report_date_mismatch`]),
      ...(reportDateCoverageStatusOk ? [] : [`coverage_${coverageStatus}`]),
      ...(latestRecordDateCoversReportDate
        ? []
        : [`${sourceKey}_latest_record_date_not_report_date`]),
      ...(freshnessOk ? [] : [`freshness_${freshnessStatus}`]),
    ]);
    const rawBlockers = evidence.blockingReasons || [];
    const blockingReasons = sourceReady
      ? []
      : this.orderedUnique([
          sourceNotReady,
          ...(evidence.blockingReason ? [evidence.blockingReason] : []),
          ...rawBlockers,
          ...generatedBlockers,
        ]);

    return {
      sourceKey,
      reportDate,
      expectedReportDate,
      reportDateMatches,
      freshnessStatus,
      coverageStatus,
      lastSuccessfulSyncAt,
      latestRecordDate,
      latestRecordDateCoversReportDate,
      blockingReason: blockingReasons[0] || null,
      blockingReasons,
      affectedDecisionCategories: [
        ...(SOURCE_DECISION_CATEGORIES[sourceKey] || DECISION_CATEGORIES),
      ],
      canUseForAdsAutomationDecision: sourceReady,
    };
  }

  private sourceRequiresReportDateRecord(
    sourceKey: string,
    coverageStatus: string,
  ): boolean {
    if (coverageStatus !== "covered") return false;
    return [
      "google_ads",
      "advertising_costs",
      "inventory_profit",
      "supplier_safety",
    ].includes(sourceKey);
  }

  private requiredSourceCoverage(
    coverage: AdsAutomationReadonlySourceImportCoverage[],
  ): AdsAutomationReadonlySourceImportCoverage[] {
    const bySourceKey = new Map(
      coverage.map((source) => [String(source.sourceKey), source]),
    );
    return REQUIRED_DECISION_SOURCE_KEYS.flatMap((sourceKey) => {
      const source = bySourceKey.get(sourceKey);
      return source ? [source] : [];
    });
  }

  private sourceCoverageCoversReportDate(
    source: AdsAutomationReadonlySourceImportCoverage,
  ): boolean {
    return (
      source.reportDateMatches &&
      ["covered", "not_applicable"].includes(source.coverageStatus) &&
      source.latestRecordDateCoversReportDate
    );
  }

  private platformEntityReadinessBlockers(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage,
  ): string[] {
    return this.unique([
      ...coverage.campaigns.blockers,
      ...coverage.adGroups.blockers,
      ...coverage.campaignBudgets.blockers,
      ...coverage.productMapping.blockers,
      ...(coverage.productMapping.coveredForDecision
        ? []
        : ["product_mapping_not_covered_for_decision"]),
      ...coverage.inventoryProfit.blockers.filter(
        (blocker) =>
          blocker.includes("inventory_profit") ||
          blocker.includes("product_performance_missing") ||
          blocker.includes("product_performance_stale") ||
          blocker.includes("read_model.product_performance"),
      ),
      ...(coverage.inventoryProfit.coveredForDecision ||
      coverage.inventoryProfit.sourceReady
        ? []
        : ["inventory_profit_not_covered_for_decision"]),
      ...coverage.supplierContext.blockers.filter(
        (blocker) =>
          blocker.includes("supplier_safety") ||
          blocker.includes("supplier_safety_missing") ||
          blocker.includes("supplier_safety_stale") ||
          blocker.includes("read_model.supplier_safety"),
      ),
      ...(coverage.supplierContext.coveredForDecision ||
      coverage.supplierContext.sourceReady
        ? []
        : ["supplier_safety_not_covered_for_decision"]),
      ...coverage.freshnessCoverage.blockingReasons,
    ]);
  }

  private sourceGateBlockers(
    input: AdsAutomationReadonlyPlatformImportReadinessInput,
    sourceImportCoverage = this.sourceImportCoverage(input),
  ): string[] {
    if (!input.sourceSyncStatus) return ["source_sync_status_missing"];
    return this.unique([
      ...sourceImportCoverage.flatMap((source) =>
        source.canUseForAdsAutomationDecision
          ? []
          : source.blockingReasons.length
            ? source.blockingReasons
            : [`${source.sourceKey}_not_ready_for_ads_automation_decision`],
      ),
      ...input.sourceSyncStatus.summary.blocked_sources.map(
        (source) => `${source}_not_ready_for_ads_automation_decision`,
      ),
    ]);
  }

  private sourceToDecisionBlockers(
    input: AdsAutomationReadonlyPlatformImportReadinessInput,
    sourceImportCoverage = this.sourceImportCoverage(input),
  ): AdsAutomationReadonlyDecisionReadinessSourceBlocker[] {
    if (!input.sourceSyncStatus) {
      return [
        {
          sourceKey: "source_sync_status_missing",
          blockedCategories: [...DECISION_CATEGORIES],
          blockingReasons: ["source_sync_status_missing"],
        },
      ];
    }

    return sourceImportCoverage
      .filter((source) => source.canUseForAdsAutomationDecision !== true)
      .map((source) => ({
        sourceKey: source.sourceKey,
        blockedCategories: [
          ...(SOURCE_DECISION_CATEGORIES[source.sourceKey] ||
            DECISION_CATEGORIES),
        ],
        blockingReasons: source.blockingReasons.length
          ? source.blockingReasons
          : [`${source.sourceKey}_not_ready_for_ads_automation_decision`],
      }));
  }

  private readModelBlockers(
    adapterResult: AdsAutomationDecisionSourceAdapterResult | null,
  ): string[] {
    if (!adapterResult) return [];
    return this.unique([
      ...adapterResult.sourceEvidence.flatMap((evidence) => {
        const blockers =
          evidence.status === "fresh" && evidence.canUseForDecision === "yes"
            ? []
            : [`read_model.${evidence.sourceKey}_${evidence.status}`];
        return [
          ...blockers,
          ...evidence.missingFields.map(
            (field) => `read_model.${evidence.sourceKey}_missing_${field}`,
          ),
        ];
      }),
      ...adapterResult.missingFieldEvidence.flatMap((evidence) =>
        evidence.missingFields.map(
          (field) =>
            `read_model.${evidence.sourceKey}.${evidence.entityId}_missing_${field}`,
        ),
      ),
    ]);
  }

  private decisionCategoryGate(input: {
    category: AdsAutomationCategoryKey;
    snapshot: AdsAutomationDecisionSnapshot | null;
    sourceToDecisionBlockers: AdsAutomationReadonlyDecisionReadinessSourceBlocker[];
    readonlyImportBlockers: string[];
    readModelBlockers: string[];
    cashflowBlockers: string[];
    allGatesReady: boolean;
  }): AdsAutomationReadonlyDecisionReadinessCategoryGate {
    const sourceBlockers = this.unique(
      input.sourceToDecisionBlockers
        .filter((blocker) => blocker.blockedCategories.includes(input.category))
        .flatMap((blocker) => blocker.blockingReasons),
    );
    const snapshotStatus =
      input.snapshot?.categories[input.category]?.status || "no_candidates";
    const scaleSensitive = [
      "scale_ads",
      "scale_amount",
      "target_ad_groups",
      "product_budget_allocation",
    ].includes(input.category);

    return {
      key: input.category,
      snapshotStatus,
      canGenerateActionDraft:
        input.allGatesReady && sourceBlockers.length === 0,
      sourceBlockers,
      readonlyImportBlockers: input.readonlyImportBlockers,
      readModelBlockers: input.readModelBlockers,
      cashflowBlockers: scaleSensitive ? input.cashflowBlockers : [],
    };
  }

  private candidates(
    decisions: AdsAutomationDecisionItem[],
    decisionType: AdsAutomationCategoryKey,
    categoryGates: AdsAutomationReadonlyDecisionReadinessCategoryGate[],
    allGatesReady: boolean,
  ): AdsAutomationReadonlyDecisionReadinessCandidate[] {
    const gate = categoryGates.find(
      (category) => category.key === decisionType,
    );
    return decisions
      .filter((decision) => decision.decision_type === decisionType)
      .map((decision) => this.candidate(decision, gate, allGatesReady));
  }

  private candidate(
    decision: AdsAutomationDecisionItem,
    gate: AdsAutomationReadonlyDecisionReadinessCategoryGate | undefined,
    allGatesReady: boolean,
  ): AdsAutomationReadonlyDecisionReadinessCandidate {
    const currentValue = decision.currentValue || {};
    const proposedValue = decision.proposedValue || {};
    const gateBlockers = this.unique([
      ...(gate?.sourceBlockers || []),
      ...(gate?.readonlyImportBlockers || []),
      ...(gate?.readModelBlockers || []),
      ...(gate?.cashflowBlockers || []),
      ...decision.blockers,
    ]);
    const candidateStatus = ["scale_ready", "safe", "needs_review"].includes(
      decision.status,
    );
    return {
      decisionType: decision.decision_type,
      entityType: decision.entity_type,
      entityId: decision.entity_id,
      platform: decision.platform,
      accountId: decision.accountId,
      productId: decision.productId,
      supplierId: decision.supplierId,
      status: decision.status,
      effectiveStatus:
        allGatesReady && candidateStatus
          ? "candidate_for_review"
          : decision.status === "blocked" ||
              decision.status === "insufficient_data" ||
              gateBlockers.length
            ? "blocked"
            : "monitor_only",
      proposedAction: this.text((proposedValue as any).action),
      campaignBudgetId:
        this.text((proposedValue as any).campaignBudgetId) ||
        this.text((currentValue as any).campaignBudgetId),
      currentBudgetVnd: this.numberOrNull(
        (proposedValue as any).currentBudgetVnd ??
          (currentValue as any).currentBudgetVnd,
      ),
      proposedBudgetVnd: this.numberOrNull(
        (proposedValue as any).proposedBudgetVnd,
      ),
      increaseVnd: this.numberOrNull((proposedValue as any).increaseVnd),
      blockers: gateBlockers,
      missingFields: decision.missing_fields,
      approval_required: true,
      execution_allowed_now: false,
    };
  }

  private decisionAnswers(input: {
    candidates: AdsAutomationReadonlyDecisionReadiness["candidates"];
    scaleCandidates: AdsAutomationReadonlyDecisionReadinessCandidate[];
    maxIncreaseVnd: number;
    scaleUpExecutionMode: "monitor_only" | "pending_validation";
    sourceGateBlockers: string[];
    readonlyImportBlockers: string[];
    readModelBlockers: string[];
    cashflowBlockers: string[];
  }): AdsAutomationReadonlyDecisionReadiness["answers"] {
    const candidateForReview = (
      candidate: AdsAutomationReadonlyDecisionReadinessCandidate,
    ) => candidate.effectiveStatus === "candidate_for_review";
    const blockedCandidate = (
      candidate: AdsAutomationReadonlyDecisionReadinessCandidate,
    ) =>
      candidate.effectiveStatus === "blocked" || candidate.blockers.length > 0;

    const safeSupplierChoices =
      input.candidates.supplierChoices.filter(candidateForReview);
    const productKillOrStopReview = input.candidates.productKillOrStopReview;
    const campaignOrAdGroupPause = input.candidates.campaignOrAdGroupPause;

    return {
      may_increase_ads: input.scaleCandidates.length > 0,
      max_increase_vnd: input.maxIncreaseVnd,
      scale_up_execution_mode: input.scaleUpExecutionMode,
      ad_groups_to_increase: input.scaleCandidates,
      target_ad_groups:
        input.candidates.targetAdGroups.filter(candidateForReview),
      products_can_receive_budget:
        input.candidates.productsEligibleForBudget.filter(candidateForReview),
      blocked_product_budget_candidates:
        input.candidates.productsEligibleForBudget.filter(blockedCandidate),
      supplier_choice_safe: safeSupplierChoices.length > 0,
      safe_supplier_choices: safeSupplierChoices,
      blocked_supplier_choices:
        input.candidates.supplierChoices.filter(blockedCandidate),
      product_kill_or_stop_review_needed:
        productKillOrStopReview.some(candidateForReview),
      product_kill_or_stop_review: productKillOrStopReview,
      campaign_or_ad_group_pause_recommended:
        campaignOrAdGroupPause.some(candidateForReview),
      campaign_or_ad_group_pause: campaignOrAdGroupPause,
      blocking_reasons: this.unique([
        ...input.sourceGateBlockers,
        ...input.readonlyImportBlockers,
        ...input.readModelBlockers,
        ...input.cashflowBlockers,
      ]),
      execution_allowed_now: false,
    };
  }

  private accountReadiness(input: {
    account: AdsAutomationReadonlyImportAccountInput;
    reportDate: string;
    now: Date;
    metricRows: AdsAutomationReadonlyMetricRowInput[];
    sourceSyncBlockers: string[];
  }): AdsAutomationReadonlyImportAccountReadiness {
    const accountId = this.text(input.account.accountId);
    const customerId = this.customerId(input.account.customerId);
    const loginCustomerId = this.customerId(input.account.loginCustomerId);
    const importWindow = this.importWindow(input.account.importWindow);
    const accountMetricRows = input.metricRows.filter((row) =>
      this.rowMatchesAccount(row, accountId, customerId),
    );
    const expectedDates = this.expectedDates(
      importWindow.from,
      importWindow.to,
    );
    const coveredDates = this.unique(
      accountMetricRows.map((row) => this.isoDate(row.date, "metricRows.date")),
    ).filter((date) => expectedDates.includes(date));
    const missingDates = expectedDates.filter(
      (date) => !coveredDates.includes(date),
    );
    const coverageStatus =
      accountMetricRows.length === 0
        ? "missing"
        : missingDates.length
          ? "partial"
          : "covered";
    const freshness = this.freshness(input.account, input.now);
    const retryBackoffState = this.retryState(input.account.retryState);
    const sourceTrustLevel = input.account.sourceTrustLevel || "unknown";
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!accountId) blockers.push("account_mapping.accountId_missing");
    if (!customerId)
      blockers.push("account_mapping.customerId_missing_or_malformed");
    if (input.account.isActive !== true)
      blockers.push("account_mapping.account_not_active");
    if (input.account.approvedForReadOnlyImport !== true) {
      blockers.push("account_mapping.readonly_import_not_approved");
    }
    if (input.account.configuredForReadOnlyImport !== true) {
      blockers.push("account_mapping.readonly_import_not_configured");
    }
    if (input.account.googleAdsProductionEnabled === true) {
      blockers.push("GOOGLE_ADS_PRODUCTION_ENABLED_must_be_false_or_absent");
    }
    if (!TRUSTED_SOURCE_LEVELS.includes(sourceTrustLevel)) {
      blockers.push("source_trust_level_not_verified");
    }
    if (freshness.status !== "fresh") {
      blockers.push(`freshness_${freshness.status}`);
    }
    if (coverageStatus !== "covered") {
      blockers.push(`coverage_${coverageStatus}`);
    }
    if (retryBackoffState.status !== "idle") {
      blockers.push(`retry_state_${retryBackoffState.status}`);
    }
    if (input.sourceSyncBlockers.length) {
      blockers.push(...input.sourceSyncBlockers);
    }
    if (input.account.failureReason && retryBackoffState.status === "idle") {
      warnings.push(`previous_failure:${input.account.failureReason}`);
    }

    const canUse = blockers.length === 0;
    return {
      platform: "google_ads",
      accountId,
      customerId,
      loginCustomerId,
      accountName: this.text(input.account.accountName),
      status: canUse ? "ready_for_local_decision_review" : "blocked",
      sourceTrustLevel,
      importWindow,
      freshness,
      coverage: {
        status: coverageStatus,
        reportDate: input.reportDate,
        expectedDates,
        coveredDates,
        missingDates,
      },
      metricCoverage: {
        rows: accountMetricRows.length,
        coveredDates,
        missingDates,
        spendVnd: this.sum(accountMetricRows, "spendVnd"),
        clicks: this.sum(accountMetricRows, "clicks"),
        impressions: this.sum(accountMetricRows, "impressions"),
        conversions: this.sum(accountMetricRows, "conversions"),
        conversionValueVnd: accountMetricRows.reduce(
          (sum, row) =>
            sum +
            this.nonNegativeNumber(
              row.conversionValueVnd || 0,
              "metricRows.conversionValueVnd",
            ),
          0,
        ),
        campaignBudgetIdMissingRows: accountMetricRows.filter(
          (row) => !this.text(row.campaignBudgetId),
        ).length,
      },
      retryBackoffState,
      failureReason: this.text(input.account.failureReason),
      blockers: this.unique(blockers),
      warnings: this.unique(warnings),
      canUseForReadOnlyImport: canUse,
      canUseForAdsAutomationDecision: canUse,
      canRecommendAdsScale: false,
      execution_allowed_now: false,
    };
  }

  private metricRowReadiness(
    row: AdsAutomationReadonlyMetricRowInput,
  ): AdsAutomationReadonlyMetricReadinessRow {
    const accountId = this.text(row.accountId);
    const customerId = this.customerId(row.customerId);
    const campaignId = this.text(row.campaignId);
    const adGroupId = this.text(row.adGroupId);
    const campaignBudgetId = this.text(row.campaignBudgetId);
    const blockers: string[] = [];

    if (row.platform !== "google_ads") blockers.push("platform_unsupported");
    if (!accountId) blockers.push("accountId_missing");
    if (!customerId) blockers.push("customerId_missing_or_malformed");
    if (!campaignId) blockers.push("campaignId_missing");
    if (!adGroupId) blockers.push("adGroupId_missing");
    if (!campaignBudgetId)
      blockers.push("campaignBudgetId_missing_no_fallback");
    const date = this.isoDate(row.date, "metricRows.date");

    return {
      platform: "google_ads",
      accountId,
      customerId,
      campaignId,
      adGroupId,
      campaignBudgetId,
      date,
      spendVnd: this.nonNegativeNumber(row.spendVnd, "metricRows.spendVnd"),
      clicks: this.nonNegativeNumber(row.clicks, "metricRows.clicks"),
      impressions: this.nonNegativeNumber(
        row.impressions,
        "metricRows.impressions",
      ),
      conversions: this.nonNegativeNumber(
        row.conversions,
        "metricRows.conversions",
      ),
      conversionValueVnd: this.nonNegativeNumber(
        row.conversionValueVnd || 0,
        "metricRows.conversionValueVnd",
      ),
      blockers,
      canUseForAdsAutomationDecision: blockers.length === 0,
    };
  }

  private sourceSyncBlockers(
    input: AdsAutomationReadonlyPlatformImportReadinessInput,
  ): string[] {
    if (!input.sourceSyncStatus) return [];
    const summary = input.sourceSyncStatus.summary;
    const sourceBlockers = [
      ...summary.blocked_sources,
      ...summary.stale_sources,
      ...summary.missing_config_sources,
      ...summary.missing_coverage_sources,
      ...summary.not_synced_sources,
    ];
    const coverageContractBlockers = this.sourceImportCoverage(input)
      .flatMap((source) => source.blockingReasons)
      .filter((blocker) => this.sourceCoverageContractBlocker(blocker))
      .map((blocker) => `source_sync.${blocker}`);
    return this.unique([
      ...sourceBlockers.map((source) => `source_sync.${source}_not_ready`),
      ...this.missingRequiredSourceEvidence(input).map(
        (sourceKey) =>
          `source_sync.${this.missingSourceEvidenceReason(sourceKey)}`,
      ),
      ...coverageContractBlockers,
    ]);
  }

  private sourceCoverageContractBlocker(blocker: string): boolean {
    return (
      blocker.endsWith("_report_date_mismatch") ||
      blocker.endsWith("_latest_record_date_not_report_date")
    );
  }

  private missingRequiredSourceEvidence(
    input: AdsAutomationReadonlyPlatformImportReadinessInput,
  ): RequiredDecisionSourceKey[] {
    if (!input.sourceSyncStatus) return [];
    const evidenceSources = new Set(
      input.sourceSyncStatus.decisionEvidence.map(
        (evidence) => evidence.sourceKey,
      ),
    );
    return REQUIRED_DECISION_SOURCE_KEYS.filter(
      (sourceKey) => !evidenceSources.has(sourceKey),
    );
  }

  private missingSourceEvidenceReason(
    sourceKey: RequiredDecisionSourceKey,
  ): string {
    return `${sourceKey}_source_evidence_missing_for_ads_automation_decision`;
  }

  private readonlyImportBlockers(
    accounts: AdsAutomationReadonlyImportAccountReadiness[],
    metricRows: AdsAutomationReadonlyMetricReadinessRow[],
  ): string[] {
    return this.unique([
      ...accounts.flatMap((account) =>
        account.canUseForAdsAutomationDecision ? [] : account.blockers,
      ),
      ...metricRows.flatMap((row) =>
        row.canUseForAdsAutomationDecision ? [] : row.blockers,
      ),
    ]);
  }

  private cashflowFirstGate(
    decisionSafety: AdsAutomationReadonlyDecisionSafetyInput | undefined,
    accounts: AdsAutomationReadonlyImportAccountReadiness[],
    sourceSyncBlockers: string[],
    lossLimitPolicy: AdsAutomationReadonlyPlatformImportReadinessInput["lossLimitPolicy"],
  ): AdsAutomationReadonlyPlatformImportReadinessResponse["cashflowFirstGate"] {
    const dataFreshnessSafe =
      sourceSyncBlockers.length === 0 &&
      accounts.every((account) => account.canUseForAdsAutomationDecision) &&
      (lossLimitPolicy
        ? lossLimitPolicy.summary.data_freshness_safe
        : decisionSafety?.dataFreshnessSafe === true);
    const policy = lossLimitPolicy?.summary;
    const policyScaleBlockers = lossLimitPolicy?.scaleBlockers || [];
    const checks: AdsAutomationReadonlyCashflowFirstGateCheck[] = [
      this.check(
        "gross_margin_safe",
        policy
          ? policy.gross_margin_safe
          : decisionSafety?.grossMarginSafe === true,
        "gross_margin_missing_or_unsafe",
      ),
      this.check(
        "contribution_profit_positive",
        policy
          ? policy.contribution_profit_safe
          : decisionSafety?.contributionProfitPositive === true,
        "contribution_profit_missing_or_unsafe",
      ),
      this.check(
        "cash_conversion_working_capital_safe",
        policy
          ? policy.cash_conversion_working_capital_safe
          : decisionSafety?.cashConversionWorkingCapitalSafe === true,
        "cash_conversion_or_working_capital_health_missing",
      ),
      this.check(
        "stock_coverage_safe",
        decisionSafety?.stockCoverageSafe === true,
        "stock_coverage_missing_or_unsafe",
      ),
      this.check(
        "supplier_reliability_safe",
        decisionSafety?.supplierReliabilitySafe === true,
        "supplier_reliability_missing_or_unsafe",
      ),
      this.check(
        "fulfillment_capacity_safe",
        policy
          ? policy.fulfillment_capacity_safe
          : decisionSafety?.fulfillmentCapacitySafe === true,
        "fulfillment_capacity_missing",
      ),
      this.check(
        "return_refund_risk_safe",
        policy
          ? policy.return_refund_risk_safe
          : decisionSafety?.returnRefundRiskSafe === true,
        "return_refund_risk_missing_or_unsafe",
      ),
      this.check(
        "data_freshness_safe",
        dataFreshnessSafe,
        "data_freshness_or_coverage_not_safe",
      ),
      this.check(
        "spend_caps_safe",
        policy ? policy.spend_caps_safe : true,
        "spend_caps_missing_or_unsafe",
      ),
      this.check(
        "emergency_stop_clear",
        policy ? !policy.emergency_stop_active : true,
        "emergency_stop_or_kill_switch_active",
      ),
      this.check(
        "daily_loss_limit_safe",
        policy
          ? policy.daily_loss_limit_safe
          : decisionSafety?.dailyLossLimitSafe === true,
        "daily_loss_limit_missing",
      ),
      this.check(
        "monthly_loss_limit_safe",
        policy
          ? policy.monthly_loss_limit_safe
          : decisionSafety?.monthlyLossLimitSafe === true,
        "monthly_loss_limit_missing",
      ),
    ];
    const blockers = this.unique([
      ...checks
        .map((check) => check.blocker)
        .filter((blocker): blocker is string => Boolean(blocker)),
      ...policyScaleBlockers,
    ]);
    const allSafe = checks.every((check) => check.passed);
    return {
      all_safe: allSafe,
      checks,
      blockers,
      scale_up_execution_mode: allSafe ? "pending_validation" : "monitor_only",
      can_recommend_scale_from_import_readiness: allSafe,
      execution_allowed_now: false,
    };
  }

  private check(
    key: AdsAutomationReadonlyCashflowFirstGateCheck["key"],
    passed: boolean,
    blocker: string,
  ): AdsAutomationReadonlyCashflowFirstGateCheck {
    return {
      key,
      passed,
      blocker: passed ? null : blocker,
    };
  }

  private freshness(
    account: AdsAutomationReadonlyImportAccountInput,
    now: Date,
  ): AdsAutomationReadonlyImportAccountReadiness["freshness"] {
    const maxAgeMinutes = account.freshnessMaxAgeMinutes ?? 120;
    const syncAt = this.optionalDateTime(
      account.lastSuccessfulSyncAt,
      "lastSuccessfulSyncAt",
    );
    const latestMetricDate = account.latestMetricDate
      ? this.isoDate(account.latestMetricDate, "latestMetricDate")
      : null;
    const candidateTimes = [
      syncAt?.getTime(),
      latestMetricDate
        ? new Date(`${latestMetricDate}T00:00:00.000Z`).getTime()
        : undefined,
    ].filter((value): value is number => typeof value === "number");
    if (!candidateTimes.length) {
      return {
        status: "missing",
        maxAgeMinutes,
        ageMinutes: null,
        staleByMinutes: null,
        lastSuccessfulSyncAt: null,
        latestMetricDate,
      };
    }
    const newest = Math.max(...candidateTimes);
    const ageMinutes = Math.max(
      0,
      Math.floor((now.getTime() - newest) / 60000),
    );
    const staleByMinutes = Math.max(0, ageMinutes - maxAgeMinutes);
    return {
      status: staleByMinutes > 0 ? "stale" : "fresh",
      maxAgeMinutes,
      ageMinutes,
      staleByMinutes,
      lastSuccessfulSyncAt: syncAt ? syncAt.toISOString() : null,
      latestMetricDate,
    };
  }

  private importWindow(
    window: AdsAutomationReadonlyImportAccountInput["importWindow"],
  ): AdsAutomationReadonlyImportAccountReadiness["importWindow"] {
    if (!window || typeof window !== "object") {
      throw new BadRequestException("accounts.importWindow is required");
    }
    const from = this.isoDate(window.from, "accounts.importWindow.from");
    const to = this.isoDate(window.to, "accounts.importWindow.to");
    if (new Date(`${from}T00:00:00.000Z`) > new Date(`${to}T00:00:00.000Z`)) {
      throw new BadRequestException(
        "accounts.importWindow.from must not be after to",
      );
    }
    const maxRangeDays = this.positiveNumber(
      window.maxRangeDays,
      "accounts.importWindow.maxRangeDays",
    );
    const rangeDays = this.expectedDates(from, to).length;
    if (rangeDays > maxRangeDays) {
      throw new BadRequestException(
        "accounts.importWindow exceeds maxRangeDays",
      );
    }
    const cadence = ["hourly", "daily", "manual"].includes(window.cadence)
      ? window.cadence
      : null;
    if (!cadence) {
      throw new BadRequestException(
        "accounts.importWindow.cadence is unsupported",
      );
    }
    const timezone = this.text(window.timezone);
    if (!timezone) {
      throw new BadRequestException(
        "accounts.importWindow.timezone is required",
      );
    }
    return { from, to, timezone, cadence, maxRangeDays };
  }

  private retryState(
    state?: AdsAutomationReadonlyImportRetryState,
  ): Required<AdsAutomationReadonlyImportRetryState> {
    const status = state?.status || "idle";
    if (!["idle", "retry_scheduled", "blocked", "exhausted"].includes(status)) {
      throw new BadRequestException(
        "accounts.retryState.status is unsupported",
      );
    }
    return {
      status,
      attempts: this.nonNegativeNumber(
        state?.attempts || 0,
        "accounts.retryState.attempts",
      ),
      maxAttempts: this.positiveNumber(
        state?.maxAttempts || 3,
        "accounts.retryState.maxAttempts",
      ),
      nextRetryAt: state?.nextRetryAt
        ? this.dateTime(
            state.nextRetryAt,
            "accounts.retryState.nextRetryAt",
          ).toISOString()
        : null,
      backoffMs:
        state?.backoffMs == null
          ? null
          : this.nonNegativeNumber(
              state.backoffMs,
              "accounts.retryState.backoffMs",
            ),
      lastFailureCategory: this.text(state?.lastFailureCategory),
    };
  }

  private accounts(
    accounts: AdsAutomationReadonlyImportAccountInput[],
  ): AdsAutomationReadonlyImportAccountInput[] {
    if (!Array.isArray(accounts) || !accounts.length) {
      throw new BadRequestException("accounts must be a non-empty array");
    }
    return accounts;
  }

  private metricRows(
    rows: AdsAutomationReadonlyMetricRowInput[],
  ): AdsAutomationReadonlyMetricRowInput[] {
    if (!Array.isArray(rows)) {
      throw new BadRequestException("metricRows must be an array");
    }
    return rows;
  }

  private rowMatchesAccount(
    row: AdsAutomationReadonlyMetricRowInput,
    accountId: string | null,
    customerId: string | null,
  ): boolean {
    return Boolean(
      (accountId && this.text(row.accountId) === accountId) ||
      (customerId && this.customerId(row.customerId) === customerId),
    );
  }

  private expectedDates(from: string, to: string): string[] {
    const result: string[] = [];
    const cursor = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (cursor <= end) {
      result.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }

  private sum(
    rows: AdsAutomationReadonlyMetricRowInput[],
    key: keyof AdsAutomationReadonlyMetricRowInput,
  ): number {
    return rows.reduce(
      (total, row) =>
        total +
        this.nonNegativeNumber(row[key] || 0, `metricRows.${String(key)}`),
      0,
    );
  }

  private markdownPreview(input: {
    reportDate: string;
    accounts: AdsAutomationReadonlyImportAccountReadiness[];
    metricRows: AdsAutomationReadonlyMetricReadinessRow[];
    blockers: string[];
    cashflowBlockers: string[];
    decisionReadiness: AdsAutomationReadonlyDecisionReadiness;
    platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage;
  }): string {
    const requiredSourceCoverage = this.requiredSourceCoverage(
      input.decisionReadiness.sourceImportCoverage,
    );
    const requiredSourceReadyCount = requiredSourceCoverage.filter(
      (source) => source.canUseForAdsAutomationDecision,
    ).length;
    const requiredSourceReportDateCoveredCount = requiredSourceCoverage.filter(
      (source) => this.sourceCoverageCoversReportDate(source),
    ).length;
    const sourceCoverageBlockingReasons = this.unique(
      requiredSourceCoverage.flatMap((source) => source.blockingReasons),
    );

    return [
      "# Read-only Platform Import Readiness",
      `Report date: ${input.reportDate}`,
      `Accounts ready: ${input.accounts.filter((account) => account.canUseForAdsAutomationDecision).length}/${input.accounts.length}`,
      `Metric rows ready: ${input.metricRows.filter((row) => row.canUseForAdsAutomationDecision).length}/${input.metricRows.length}`,
      `Required sources ready: ${requiredSourceReadyCount}/${REQUIRED_DECISION_SOURCE_KEYS.length}`,
      `Required sources report-date covered: ${requiredSourceReportDateCoveredCount}/${REQUIRED_DECISION_SOURCE_KEYS.length}`,
      `Required source blockers: ${this.joinOrNone(sourceCoverageBlockingReasons)}`,
      `Campaign budget ID missing rows: ${input.metricRows.filter((row) => !row.campaignBudgetId).length}`,
      `Campaigns covered: ${input.platformEntityCoverage.campaigns.coveredCampaignCount}`,
      `Ad groups covered: ${input.platformEntityCoverage.adGroups.coveredAdGroupCount}`,
      `Product mappings covered: ${input.platformEntityCoverage.productMapping.mappedProductIds.length}`,
      `Safe suppliers: ${input.platformEntityCoverage.supplierContext.safeSupplierIds.length}`,
      `Decision readiness: ${input.decisionReadiness.status}`,
      `Scale candidates: ${input.decisionReadiness.candidates.adGroupsToIncrease.length}`,
      `Pause candidates: ${input.decisionReadiness.candidates.campaignOrAdGroupPause.length}`,
      `Blockers: ${this.joinOrNone(input.blockers)}`,
      `Cashflow-first blockers: ${this.joinOrNone(input.cashflowBlockers)}`,
      "Safety gates: provider_api_called=false, google_ads_api_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false",
    ].join("\n");
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== text
    ) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return text;
  }

  private optionalDateTime(value: unknown, field: string): Date | null {
    if (value === undefined || value === null || value === "") return null;
    return this.dateTime(value, field);
  }

  private dateTime(value: unknown, field: string): Date {
    const parsed = new Date(value as string | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return parsed;
  }

  private customerId(value: unknown): string | null {
    const text = this.text(value);
    if (!text) return null;
    const digits = text.replace(/\D/g, "");
    return /^\d{10}$/.test(digits) ? digits : null;
  }

  private text(value: unknown): string | null {
    const text = String(value ?? "").trim();
    return text ? text : null;
  }

  private nonNegativeNumber(value: unknown, field: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
    return number;
  }

  private numberOrNull(value: unknown): number | null {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private positiveNumber(value: unknown, field: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new BadRequestException(`${field} must be a positive number`);
    }
    return number;
  }

  private ids(values: unknown[]): string[] {
    return this.unique(
      values
        .map((value) => this.text(value))
        .filter((value): value is string => Boolean(value)),
    );
  }

  private blockersMatching(values: string[], tokens: string[]): string[] {
    return this.unique(
      values.filter((value) =>
        tokens.some((token) =>
          value.toLowerCase().includes(token.toLowerCase()),
        ),
      ),
    );
  }

  private latestText(values: Array<string | null | undefined>): string | null {
    const normalized = values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .sort();
    return normalized[normalized.length - 1] || null;
  }

  private unique(values: string[]): string[] {
    return [
      ...new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    ].sort();
  }

  private orderedUnique(values: string[]): string[] {
    return [
      ...new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    ];
  }

  private joinOrNone(values: string[]): string {
    const normalized = values
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return normalized.length ? normalized.join(", ") : "none";
  }
}
