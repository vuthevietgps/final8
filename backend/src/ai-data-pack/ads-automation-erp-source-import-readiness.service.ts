import { Injectable } from "@nestjs/common";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationErpSourceProjectionRepository } from "./ads-automation-erp-source-projection.repository";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import type { AdsAutomationDecisionReadModelQuery } from "./contracts/ads-automation-decision-read-model-query.contract";
import type {
  AdsAutomationDecisionErpSourceAdapterInput,
  AdsAutomationDecisionSourceAdapterInput,
  AdsAutomationDecisionSourceAdapterResult,
  AdsAutomationDecisionSourceEvidence,
  AdsAutomationDecisionSourceKey,
  AdsAutomationErpAdGroupRecord,
  AdsAutomationErpAdvertisingCostRecord,
  AdsAutomationSourceStampedRow,
} from "./contracts/ads-automation-decision-source-adapter.contract";
import type {
  AdsAutomationPlatformSourceSyncStatusItem,
  AdsAutomationPlatformSourceSyncStatusResponse,
  AdsAutomationPlatformSourceSyncStatusSourceKey,
} from "./contracts/ads-automation-platform-source-sync-status.contract";
import type {
  AdsAutomationReadonlyImportAccountInput,
  AdsAutomationReadonlyMetricRowInput,
  AdsAutomationReadonlyPlatformImportReadinessResponse,
} from "./contracts/ads-automation-readonly-platform-import-readiness.contract";

const REQUIRED_SOURCES: AdsAutomationPlatformSourceSyncStatusSourceKey[] = [
  "google_ads",
  "advertising_costs",
  "product_mapping",
  "inventory_profit",
  "supplier_safety",
];

const SOURCE_TO_ADAPTER: Record<
  AdsAutomationPlatformSourceSyncStatusSourceKey,
  AdsAutomationDecisionSourceKey
> = {
  google_ads: "ads_performance",
  advertising_costs: "ads_performance",
  product_mapping: "product_performance",
  inventory_profit: "product_performance",
  supplier_safety: "supplier_safety",
};

const DEFAULT_MAX_STALENESS_MINUTES: Record<
  AdsAutomationPlatformSourceSyncStatusSourceKey,
  number
> = {
  google_ads: 24 * 60,
  advertising_costs: 24 * 60,
  product_mapping: 48 * 60,
  inventory_profit: 48 * 60,
  supplier_safety: 72 * 60,
};

export interface AdsAutomationErpSourceImportReadinessResponse {
  schemaVersion: "ads_automation_erp_source_import_readiness.v1";
  generatedAt: string;
  query: AdsAutomationDecisionReadModelQuery;
  safety: {
    read_only: true;
    dry_run: true;
    local_only: true;
    erp_projection_repository_reused: true;
    readonly_import_readiness_reused: true;
    provider_api_called: false;
    provider_api_used: false;
    google_ads_api_called: false;
    google_ads_api_used: false;
    validateOnly_called: false;
    live_ads_execution_used: false;
    erp_mutation_used: false;
    payment_mutation_used: false;
    order_mutation_used: false;
    inventory_mutation_used: false;
    campaignBudgetId_required: true;
    campaignBudgetId_no_fallback: true;
    campaignBudgetId_fallback_used: false;
    GOOGLE_ADS_PRODUCTION_ENABLED: false;
    execution_allowed_now: false;
    production_ready: false;
  };
  summary: {
    status: AdsAutomationReadonlyPlatformImportReadinessResponse["summary"]["status"];
    reportDate: string;
    source_sync_status: AdsAutomationPlatformSourceSyncStatusResponse["summary"]["status"];
    platform_metric_rows: number;
    platform_metric_rows_ready: number;
    source_blocker_count: number;
    may_increase_ads: boolean;
    max_increase_vnd: number;
    ad_groups_to_increase: string[];
    products_can_receive_budget: string[];
    supplier_choice_safe: boolean;
    safe_supplier_choices: string[];
    required_source_count: number;
    required_source_ready_count: number;
    required_source_blocked_count: number;
    required_source_report_date_covered_count: number;
    required_source_report_date_blocked_count: number;
    missing_required_source_evidence: string[];
    source_coverage_blocking_reasons: string[];
    product_kill_or_stop_review_needed: boolean;
    product_kill_or_stop_review: string[];
    campaign_or_ad_group_pause_recommended: boolean;
    campaign_or_ad_group_pause: string[];
    blocking_reasons: string[];
    scale_up_execution_mode: "monitor_only" | "pending_validation";
    execution_allowed_now: false;
    production_ready: false;
  };
  sourceSyncStatus: AdsAutomationPlatformSourceSyncStatusResponse;
  readonlyImportReadiness: AdsAutomationReadonlyPlatformImportReadinessResponse;
  adapterResult: AdsAutomationDecisionSourceAdapterResult;
}

@Injectable()
export class AdsAutomationErpSourceImportReadinessService {
  constructor(
    private readonly projectionRepository: AdsAutomationErpSourceProjectionRepository,
    private readonly decisionSourceAdapter: AdsAutomationDecisionSourceAdapterService,
    private readonly readonlyImportReadiness: AdsAutomationReadonlyPlatformImportReadinessService,
  ) {}

  async build(
    query: AdsAutomationDecisionReadModelQuery = {},
  ): Promise<AdsAutomationErpSourceImportReadinessResponse> {
    const adapterInput =
      await this.projectionRepository.buildAdapterInput(query);
    const reportDate = this.reportDate(query, adapterInput);
    const now = this.now(query.now);
    const adapterResult = this.decisionSourceAdapter.buildFromErpRecords(
      adapterInput,
      {
        snapshotDate: reportDate,
        evidenceWindow: query.evidenceWindow || adapterInput.evidenceWindow,
        now,
        maxAgeHours: query.maxAgeHours,
      },
    );
    const metricRows = this.metricRows(adapterInput, reportDate);
    const accounts = this.accounts(adapterInput, metricRows, reportDate, query);
    const decisionReadModel = this.decisionReadModel(
      adapterInput,
      adapterResult,
      reportDate,
    );
    const sourceSyncStatus = this.sourceSyncStatus({
      adapterInput,
      adapterResult,
      metricRows,
      reportDate,
      now,
    });
    const readiness = this.readonlyImportReadiness.build({
      reportDate,
      now,
      fixtureMode: "custom_local_payload",
      accounts,
      metricRows,
      decisionReadModel,
      sourceSyncStatus,
      decisionSafety: this.decisionSafety(
        sourceSyncStatus,
        adapterResult.snapshotInput.policy,
      ),
    });

    return {
      schemaVersion: "ads_automation_erp_source_import_readiness.v1",
      generatedAt: new Date(now).toISOString(),
      query,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        erp_projection_repository_reused: true,
        readonly_import_readiness_reused: true,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        campaignBudgetId_required: true,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      },
      summary: {
        status: readiness.summary.status,
        reportDate,
        source_sync_status: sourceSyncStatus.summary.status,
        platform_metric_rows: readiness.metricRows.length,
        platform_metric_rows_ready: readiness.metricRows.filter(
          (row) => row.canUseForAdsAutomationDecision,
        ).length,
        source_blocker_count: sourceSyncStatus.summary.blocked_source_count,
        may_increase_ads: readiness.decisionReadiness.answers.may_increase_ads,
        max_increase_vnd: readiness.decisionReadiness.answers.max_increase_vnd,
        ad_groups_to_increase:
          readiness.decisionReadiness.answers.ad_groups_to_increase.map(
            (candidate) => candidate.entityId,
          ),
        products_can_receive_budget:
          readiness.decisionReadiness.answers.products_can_receive_budget.map(
            (candidate) => candidate.entityId,
          ),
        supplier_choice_safe:
          readiness.decisionReadiness.answers.supplier_choice_safe,
        safe_supplier_choices:
          readiness.decisionReadiness.answers.safe_supplier_choices.map(
            (candidate) => candidate.entityId,
          ),
        required_source_count: readiness.summary.required_source_count,
        required_source_ready_count:
          readiness.summary.required_source_ready_count,
        required_source_blocked_count:
          readiness.summary.required_source_blocked_count,
        required_source_report_date_covered_count:
          readiness.summary.required_source_report_date_covered_count,
        required_source_report_date_blocked_count:
          readiness.summary.required_source_report_date_blocked_count,
        missing_required_source_evidence: [
          ...readiness.summary.missing_required_source_evidence,
        ],
        source_coverage_blocking_reasons: [
          ...readiness.summary.source_coverage_blocking_reasons,
        ],
        product_kill_or_stop_review_needed:
          readiness.decisionReadiness.answers
            .product_kill_or_stop_review_needed,
        product_kill_or_stop_review:
          readiness.decisionReadiness.answers.product_kill_or_stop_review.map(
            (candidate) => candidate.entityId,
          ),
        campaign_or_ad_group_pause_recommended:
          readiness.decisionReadiness.answers
            .campaign_or_ad_group_pause_recommended,
        campaign_or_ad_group_pause:
          readiness.decisionReadiness.answers.campaign_or_ad_group_pause.map(
            (candidate) => candidate.entityId,
          ),
        blocking_reasons: readiness.decisionReadiness.answers.blocking_reasons,
        scale_up_execution_mode:
          readiness.decisionReadiness.answers.scale_up_execution_mode,
        execution_allowed_now: false,
        production_ready: false,
      },
      sourceSyncStatus,
      readonlyImportReadiness: readiness,
      adapterResult,
    };
  }

  private decisionReadModel(
    input: AdsAutomationDecisionErpSourceAdapterInput,
    result: AdsAutomationDecisionSourceAdapterResult,
    reportDate: string,
  ): AdsAutomationDecisionSourceAdapterInput {
    const watermark = (sourceKey: AdsAutomationDecisionSourceKey) =>
      input.sourceWatermarks?.[sourceKey];
    const stamp = (sourceKey: AdsAutomationDecisionSourceKey) => {
      const value = watermark(sourceKey);
      return value ? { lastSyncAt: value, updatedAt: value } : {};
    };

    return {
      snapshotDate: reportDate,
      evidenceWindow: result.snapshotInput.evidenceWindow,
      policy: result.snapshotInput.policy
        ? ({
            ...result.snapshotInput.policy,
            ...stamp("cashflow_policy"),
          } as AdsAutomationDecisionSourceAdapterInput["policy"])
        : undefined,
      adGroups: (result.snapshotInput.adGroups || []).map((row) => ({
        ...row,
        ...stamp("ads_performance"),
      })),
      products: (result.snapshotInput.products || []).map((row) => ({
        ...row,
        ...stamp("product_performance"),
      })),
      suppliers: (result.snapshotInput.suppliers || []).map((row) => ({
        ...row,
        ...stamp("supplier_safety"),
      })),
      sourceWatermarks: input.sourceWatermarks,
    };
  }

  private sourceSyncStatus(input: {
    adapterInput: AdsAutomationDecisionErpSourceAdapterInput;
    adapterResult: AdsAutomationDecisionSourceAdapterResult;
    metricRows: AdsAutomationReadonlyMetricRowInput[];
    reportDate: string;
    now: string;
  }): AdsAutomationPlatformSourceSyncStatusResponse {
    const evidence = new Map(
      input.adapterResult.sourceEvidence.map((row) => [row.sourceKey, row]),
    );
    const sources = REQUIRED_SOURCES.map((sourceKey) =>
      this.sourceStatus({
        sourceKey,
        adapterEvidence: evidence.get(SOURCE_TO_ADAPTER[sourceKey]) || null,
        adapterInput: input.adapterInput,
        adapterResult: input.adapterResult,
        metricRows: input.metricRows,
        reportDate: input.reportDate,
        now: input.now,
      }),
    );
    const blockedSources = sources
      .filter((source) => !source.canUseForAdsAutomationDecision)
      .map((source) => source.sourceKey);
    const ready = blockedSources.length === 0;

    return {
      schemaVersion: "ads_automation_platform_source_sync_status.v1",
      generatedAt: input.now,
      reportDate: input.reportDate,
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
        status: ready ? "ready" : "blocked",
        source_count: sources.length,
        ready_source_count: sources.length - blockedSources.length,
        blocked_source_count: blockedSources.length,
        blocked_sources: blockedSources,
        missing_config_sources: [],
        stale_sources: sources
          .filter((source) => source.status === "stale")
          .map((source) => source.sourceKey),
        missing_coverage_sources: sources
          .filter((source) => source.status === "missing_coverage")
          .map((source) => source.sourceKey),
        not_synced_sources: sources
          .filter((source) => source.status === "not_synced")
          .map((source) => source.sourceKey),
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: ready
          ? "ready_for_ads_automation_decision_review"
          : "resolve_source_sync_blockers",
      },
      decisionGates: {
        canUseGoogleAdsDataClaim:
          sources.find((source) => source.sourceKey === "google_ads")
            ?.canUseForAdsAutomationDecision === true,
        canGenerateActionDraft: ready,
        canRecommendAdsScale: ready,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      },
      decisionEvidence: sources.map((source) => {
        const blockingReasons = source.canUseForAdsAutomationDecision
          ? []
          : [
              `${source.sourceKey}_not_ready_for_ads_automation_decision`,
              ...source.sourceSyncBlockers,
            ];
        return {
          sourceKey: source.sourceKey,
          reportDate: input.reportDate,
          freshnessStatus: source.freshness.freshnessStatus,
          coverageStatus: source.reportDateCoverage.coverageStatus,
          lastSuccessfulSyncAt: source.freshness.lastSuccessfulSyncAt,
          latestRecordDate: source.freshness.latestRecordDate,
          blockingReason: blockingReasons[0] || null,
          blockingReasons: this.unique(blockingReasons),
          canUseForAdsAutomationDecision: source.canUseForAdsAutomationDecision,
        };
      }),
      sources,
    };
  }

  private sourceStatus(input: {
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey;
    adapterEvidence: AdsAutomationDecisionSourceEvidence | null;
    adapterInput: AdsAutomationDecisionErpSourceAdapterInput;
    adapterResult: AdsAutomationDecisionSourceAdapterResult;
    metricRows: AdsAutomationReadonlyMetricRowInput[];
    reportDate: string;
    now: string;
  }): AdsAutomationPlatformSourceSyncStatusItem {
    const rows = this.rowsForSource(input.sourceKey, input.adapterInput);
    const latestRecordDate = this.latestRecordDate(input.sourceKey, input);
    const latestSuccessfulSyncAt = this.latestObservedAt(rows);
    const freshnessStatus = this.sourceFreshnessStatus(
      rows,
      latestSuccessfulSyncAt,
      input.now,
      DEFAULT_MAX_STALENESS_MINUTES[input.sourceKey],
    );
    const coverageStatus = this.coverageStatus(
      input.sourceKey,
      input,
      latestRecordDate,
    );
    const sourceSpecificBlockers = this.sourceSpecificBlockers(input);
    const sourceMissingFields =
      input.adapterEvidence?.missingFields.map(
        (field) => `${input.sourceKey}_missing_${field}`,
      ) || [];
    const sourceSyncBlockers = this.unique([
      ...(freshnessStatus === "fresh" ? [] : [`freshness_${freshnessStatus}`]),
      ...(["covered", "not_applicable"].includes(coverageStatus)
        ? []
        : [`coverage_${coverageStatus}`]),
      ...(this.latestRecordDateRequired(input.sourceKey, coverageStatus) &&
      latestRecordDate !== input.reportDate
        ? [`${input.sourceKey}_latest_record_date_not_report_date`]
        : []),
      ...sourceMissingFields,
      ...sourceSpecificBlockers,
    ]);
    const canUseForAdsAutomationDecision =
      freshnessStatus === "fresh" &&
      ["covered", "not_applicable"].includes(coverageStatus) &&
      sourceSyncBlockers.length === 0;
    const status = canUseForAdsAutomationDecision
      ? "ready"
      : freshnessStatus === "stale"
        ? "stale"
        : freshnessStatus === "missing" || !rows.length
          ? "not_synced"
          : coverageStatus === "no_records_for_report_date" ||
              coverageStatus === "missing"
            ? "missing_coverage"
            : sourceSyncBlockers.length
              ? "missing_coverage"
              : "unknown";

    return {
      sourceKey: input.sourceKey,
      provider: input.sourceKey === "google_ads" ? "google_ads" : "erp_local",
      platform: this.platform(input.sourceKey),
      domain:
        input.sourceKey === "google_ads" ||
        input.sourceKey === "advertising_costs"
          ? "ads"
          : input.sourceKey === "product_mapping"
            ? "mapping"
            : input.sourceKey === "inventory_profit"
              ? "operations"
              : "operations",
      businessImportance: "critical",
      status,
      requiredConfigPresence: [],
      missingCredentialOrConfigBlockers: [],
      reportDateCoverage: {
        reportDate: input.reportDate,
        coverageStatus,
        reportDateRecordCount: this.reportDateRecordCount(input),
        expectedRecordCount: input.sourceKey === "product_mapping" ? null : 1,
      },
      freshness: {
        freshnessStatus,
        maxStalenessMinutes: DEFAULT_MAX_STALENESS_MINUTES[input.sourceKey],
        freshnessMinutes: latestSuccessfulSyncAt
          ? this.ageMinutes(latestSuccessfulSyncAt, input.now)
          : null,
        staleByMinutes:
          freshnessStatus === "stale" && latestSuccessfulSyncAt
            ? Math.max(
                0,
                this.ageMinutes(latestSuccessfulSyncAt, input.now) -
                  DEFAULT_MAX_STALENESS_MINUTES[input.sourceKey],
              )
            : null,
        lastSuccessfulSyncAt: latestSuccessfulSyncAt,
        latestRecordUpdatedAt: latestSuccessfulSyncAt,
        latestRecordDate,
        latestSuccessfulSyncOrReadModelWatermark:
          latestSuccessfulSyncAt || latestRecordDate,
      },
      sourceSyncBlockers,
      warnings: [],
      canUseForAdsAutomationDecision,
      usableForAdsAutomationDecisions: canUseForAdsAutomationDecision,
    };
  }

  private metricRows(
    input: AdsAutomationDecisionErpSourceAdapterInput,
    reportDate: string,
  ): AdsAutomationReadonlyMetricRowInput[] {
    const adGroups = new Map(
      (input.adGroups || []).map((adGroup) => [
        this.text(adGroup.adGroupId || adGroup._id),
        adGroup,
      ]),
    );
    return (input.advertisingCosts || []).map((row) => {
      const adGroup = adGroups.get(this.text(row.adGroupId));
      return {
        platform: "google_ads",
        accountId: this.text(
          row.accountId ||
            row.customerId ||
            adGroup?.accountId ||
            adGroup?.customerId ||
            adGroup?.adAccountId,
        ),
        customerId: this.text(
          row.customerId || adGroup?.customerId || adGroup?.accountId,
        ),
        campaignId: this.text(adGroup?.campaignId),
        adGroupId: this.text(row.adGroupId || adGroup?.adGroupId),
        campaignBudgetId: this.text(adGroup?.campaignBudgetId),
        date: this.isoDate(row.date) || reportDate,
        spendVnd: this.nonNegative(
          row.spendVnd ?? row.costVnd ?? row.spentAmount,
        ),
        clicks: this.nonNegative(row.clicks),
        impressions: this.nonNegative(row.impressions),
        conversions: this.nonNegative(row.conversions),
        conversionValueVnd: this.nonNegative(
          row.conversionValueVnd ?? row.conversionValue,
        ),
      };
    });
  }

  private accounts(
    input: AdsAutomationDecisionErpSourceAdapterInput,
    metricRows: AdsAutomationReadonlyMetricRowInput[],
    reportDate: string,
    query: AdsAutomationDecisionReadModelQuery,
  ): AdsAutomationReadonlyImportAccountInput[] {
    const sourceRows = metricRows.length
      ? metricRows
      : (input.adGroups || []).map((adGroup) => ({
          accountId: this.text(
            adGroup.accountId || adGroup.customerId || adGroup.adAccountId,
          ),
          customerId: this.text(adGroup.customerId || adGroup.accountId),
        }));
    const fallbackRows = sourceRows.length
      ? sourceRows
      : [
          {
            accountId: this.text(query.accountIds?.[0]),
            customerId: this.text(query.customerIds?.[0]),
          },
        ];
    const accountKeys = new Set<string>();
    const latestSync = this.latestObservedAt([
      ...(input.adGroups || []),
      ...(input.advertisingCosts || []),
    ]);

    return fallbackRows.flatMap((row) => {
      const accountId = this.text(row.accountId);
      const customerId = this.text(row.customerId);
      const key = accountId || customerId;
      if (!key || accountKeys.has(key)) return [];
      accountKeys.add(key);

      const account: AdsAutomationReadonlyImportAccountInput = {
        platform: "google_ads",
        accountId,
        customerId,
        loginCustomerId: customerId,
        accountName: "ERP local projected Google Ads account",
        isActive: true,
        approvedForReadOnlyImport: true,
        configuredForReadOnlyImport: true,
        googleAdsProductionEnabled: false,
        sourceTrustLevel: "erp_local_verified",
        importWindow: {
          from: reportDate,
          to: reportDate,
          timezone: "Asia/Bangkok",
          cadence: "daily",
          maxRangeDays: 31,
        },
        lastSuccessfulSyncAt: latestSync,
        latestMetricDate:
          this.latestMetricDate(metricRows, accountId, customerId) || null,
        retryState: {
          status: "idle",
          attempts: 0,
          maxAttempts: 3,
          nextRetryAt: null,
          backoffMs: null,
          lastFailureCategory: null,
        },
        freshnessMaxAgeMinutes: DEFAULT_MAX_STALENESS_MINUTES.google_ads,
      };
      return [account];
    });
  }

  private decisionSafety(
    sourceSyncStatus: AdsAutomationPlatformSourceSyncStatusResponse,
    policy: AdsAutomationDecisionSourceAdapterResult["snapshotInput"]["policy"],
  ) {
    const sourcesReady = sourceSyncStatus.summary.status === "ready";
    const cashflowReady =
      policy?.cashflowGatePassed === true &&
      Number(policy.availableAdsCashVnd || 0) > 0;
    const safe = sourcesReady && cashflowReady;
    return {
      grossMarginSafe: safe,
      contributionProfitPositive: safe,
      cashConversionWorkingCapitalSafe: safe,
      stockCoverageSafe: safe,
      supplierReliabilitySafe: safe,
      fulfillmentCapacitySafe: safe,
      returnRefundRiskSafe: safe,
      dataFreshnessSafe: safe,
      dailyLossLimitSafe: safe,
      monthlyLossLimitSafe: safe,
    };
  }

  private sourceSpecificBlockers(input: {
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey;
    adapterInput: AdsAutomationDecisionErpSourceAdapterInput;
    adapterResult: AdsAutomationDecisionSourceAdapterResult;
    metricRows: AdsAutomationReadonlyMetricRowInput[];
    reportDate: string;
  }): string[] {
    if (input.sourceKey === "google_ads") {
      return this.unique(
        input.metricRows.flatMap((row) => [
          row.campaignId ? "" : "google_ads_campaignId_missing",
          row.adGroupId ? "" : "google_ads_adGroupId_missing",
          row.campaignBudgetId
            ? ""
            : "google_ads_campaignBudgetId_missing_no_fallback",
        ]),
      );
    }
    if (input.sourceKey === "advertising_costs") {
      return input.adapterInput.advertisingCosts?.length
        ? []
        : ["advertising_costs_records_missing"];
    }
    if (input.sourceKey === "product_mapping") {
      return this.unique(
        input.adapterResult.mappingEvidence.productMappings.flatMap(
          (row) => row.blockers,
        ),
      );
    }
    if (input.sourceKey === "inventory_profit") {
      return input.adapterInput.inventorySummaries?.length
        ? []
        : ["inventory_profit_inventory_summary_missing"];
    }
    if (input.sourceKey === "supplier_safety") {
      return input.adapterInput.supplierQuotes?.length &&
        input.adapterInput.suppliers?.length
        ? []
        : ["supplier_safety_context_missing"];
    }
    return [];
  }

  private rowsForSource(
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey,
    input: AdsAutomationDecisionErpSourceAdapterInput,
  ): AdsAutomationSourceStampedRow[] {
    if (sourceKey === "google_ads") {
      return [...(input.adGroups || []), ...(input.advertisingCosts || [])];
    }
    if (sourceKey === "advertising_costs") {
      return input.advertisingCosts || [];
    }
    if (sourceKey === "product_mapping") {
      return [...(input.adGroups || []), ...(input.products || [])];
    }
    if (sourceKey === "inventory_profit") {
      return [
        ...(input.products || []),
        ...(input.inventorySummaries || []),
        ...(input.orders || []),
      ];
    }
    return [
      ...(input.supplierQuotes || []),
      ...(input.supplierPayables || []),
      ...(input.suppliers || []),
    ];
  }

  private coverageStatus(
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey,
    input: {
      adapterInput: AdsAutomationDecisionErpSourceAdapterInput;
      metricRows: AdsAutomationReadonlyMetricRowInput[];
      reportDate: string;
    },
    latestRecordDate: string | null,
  ) {
    if (sourceKey === "product_mapping") return "not_applicable" as const;
    if (sourceKey === "google_ads") {
      return input.metricRows.some((row) => row.date === input.reportDate)
        ? "covered"
        : "no_records_for_report_date";
    }
    if (sourceKey === "advertising_costs") {
      return (input.adapterInput.advertisingCosts || []).some(
        (row) => this.isoDate(row.date) === input.reportDate,
      )
        ? "covered"
        : "no_records_for_report_date";
    }
    if (!this.rowsForSource(sourceKey, input.adapterInput).length) {
      return "missing" as const;
    }
    return latestRecordDate === input.reportDate
      ? "covered"
      : "no_records_for_report_date";
  }

  private latestRecordDate(
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey,
    input: {
      adapterInput: AdsAutomationDecisionErpSourceAdapterInput;
      metricRows: AdsAutomationReadonlyMetricRowInput[];
    },
  ): string | null {
    if (sourceKey === "google_ads") {
      return this.maxIsoDate(input.metricRows.map((row) => row.date));
    }
    if (sourceKey === "advertising_costs") {
      return this.maxIsoDate(
        (input.adapterInput.advertisingCosts || []).map((row) =>
          this.isoDate(row.date),
        ),
      );
    }
    return this.maxIsoDate(
      this.rowsForSource(sourceKey, input.adapterInput).flatMap((row) => [
        this.isoDate(row.lastSyncAt),
        this.isoDate(row.updatedAt),
        this.isoDate(row.createdAt),
      ]),
    );
  }

  private latestRecordDateRequired(
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey,
    coverageStatus: string,
  ): boolean {
    return coverageStatus === "covered" && sourceKey !== "product_mapping";
  }

  private reportDateRecordCount(input: {
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey;
    adapterInput: AdsAutomationDecisionErpSourceAdapterInput;
    metricRows: AdsAutomationReadonlyMetricRowInput[];
    reportDate: string;
  }): number | null {
    if (input.sourceKey === "product_mapping") return null;
    if (input.sourceKey === "google_ads") {
      return input.metricRows.filter((row) => row.date === input.reportDate)
        .length;
    }
    if (input.sourceKey === "advertising_costs") {
      return (input.adapterInput.advertisingCosts || []).filter(
        (row) => this.isoDate(row.date) === input.reportDate,
      ).length;
    }
    return this.rowsForSource(input.sourceKey, input.adapterInput).filter(
      (row) =>
        this.maxIsoDate([
          this.isoDate(row.lastSyncAt),
          this.isoDate(row.updatedAt),
          this.isoDate(row.createdAt),
        ]) === input.reportDate,
    ).length;
  }

  private platform(
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey,
  ): AdsAutomationPlatformSourceSyncStatusItem["platform"] {
    if (sourceKey === "google_ads") return "google_ads";
    if (sourceKey === "advertising_costs") return "erp_advertising_costs";
    if (sourceKey === "product_mapping") return "erp_product_mapping";
    if (sourceKey === "inventory_profit") return "erp_inventory_profit";
    return "erp_supplier_safety";
  }

  private reportDate(
    query: AdsAutomationDecisionReadModelQuery,
    input: AdsAutomationDecisionErpSourceAdapterInput,
  ): string {
    return (
      this.isoDate(query.snapshotDate) ||
      this.isoDate(input.snapshotDate) ||
      new Date().toISOString().slice(0, 10)
    );
  }

  private now(value: string | Date | undefined): string {
    const timestamp = this.timestamp(value);
    return new Date(timestamp || Date.now()).toISOString();
  }

  private latestMetricDate(
    rows: AdsAutomationReadonlyMetricRowInput[],
    accountId: string | null,
    customerId: string | null,
  ): string | null {
    return this.maxIsoDate(
      rows
        .filter(
          (row) =>
            (accountId && row.accountId === accountId) ||
            (customerId && row.customerId === customerId),
        )
        .map((row) => row.date),
    );
  }

  private latestObservedAt(
    rows: AdsAutomationSourceStampedRow[],
  ): string | null {
    const timestamps = rows
      .flatMap((row) => [
        row.lastSyncAt,
        row.lastSyncedAt,
        row.sourceUpdatedAt,
        row.updatedAt,
        row.createdAt,
      ])
      .map((value) => this.timestamp(value))
      .filter((value): value is number => value !== null);
    return timestamps.length
      ? new Date(Math.max(...timestamps)).toISOString()
      : null;
  }

  private sourceFreshnessStatus(
    rows: AdsAutomationSourceStampedRow[],
    latestSuccessfulSyncAt: string | null,
    now: string,
    maxStalenessMinutes: number,
  ): AdsAutomationPlatformSourceSyncStatusItem["freshness"]["freshnessStatus"] {
    if (!rows.length) return "missing";
    if (!latestSuccessfulSyncAt) return "unknown";
    return this.ageMinutes(latestSuccessfulSyncAt, now) <= maxStalenessMinutes
      ? "fresh"
      : "stale";
  }

  private ageMinutes(value: string, now: string): number {
    return Math.max(
      0,
      Math.floor((new Date(now).getTime() - new Date(value).getTime()) / 60000),
    );
  }

  private maxIsoDate(values: Array<string | null | undefined>): string | null {
    const dates = values
      .map((value) => this.isoDate(value))
      .filter((value): value is string => Boolean(value))
      .sort();
    return dates[dates.length - 1] || null;
  }

  private isoDate(value: unknown): string | null {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      const text = String(value || "").trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
    }
    return parsed.toISOString().slice(0, 10);
  }

  private nonNegative(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  private timestamp(value: unknown): number | null {
    if (!value) return null;
    const timestamp =
      value instanceof Date
        ? value.getTime()
        : new Date(String(value)).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  private text(value: unknown): string | null {
    const text = String(value ?? "").trim();
    return text ? text : null;
  }

  private unique(values: string[]): string[] {
    return [
      ...new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    ].sort();
  }
}
