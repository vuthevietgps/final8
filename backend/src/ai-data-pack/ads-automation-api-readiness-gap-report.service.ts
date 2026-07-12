import { Injectable } from "@nestjs/common";
import { AdsAutomationPendingErpActionNormalizerService } from "./ads-automation-pending-erp-action-normalizer.service";
import { AdsAutomationProviderValidateOnlyPlannerService } from "./ads-automation-provider-validate-only-planner.service";
import type {
  AdsAutomationApiReadinessGapReportInput,
  AdsAutomationApiReadinessGapReportResponse,
  AdsAutomationApiReadinessGapReportSummary,
  AdsAutomationApiReadinessGapReportStage,
  AdsAutomationApiSourceImportCoverage,
  AdsAutomationApiReadinessPrerequisite,
  AdsAutomationBaControlAnswers,
  AdsAutomationCashflowFirstSafetyCheck,
  AdsAutomationApiPlatformEntityCoverageReview,
} from "./contracts/ads-automation-api-readiness-gap-report.contract";
import type { AdsAutomationDecisionDraftPreview } from "./contracts/ads-automation-decision-draft-preview.contract";
import type {
  AdsAutomationDecisionFoundationReadModelSnapshotResponse,
  AdsAutomationDecisionFoundationSnapshotItem,
} from "./contracts/ads-automation-decision-foundation-snapshot.contract";
import type {
  AdsAutomationPendingErpActionNormalizationResponse,
  AdsAutomationPendingErpActionIdentifiers,
  AdsAutomationPlatformEntityCoverageActionBlocker,
} from "./contracts/ads-automation-pending-erp-action.contract";
import type {
  AdsAutomationProviderValidateOnlyLaneResponse,
  AdsAutomationProviderValidateOnlyMvpActionContractReview,
} from "./contracts/ads-automation-provider-validate-only.contract";
import type { AdsAutomationProviderAccountReadinessResponse } from "./contracts/ads-automation-provider-account-readiness.contract";
import type {
  AdsAutomationReadonlyInventoryProfitCoverageRow,
  AdsAutomationReadonlyPlatformEntityCoverage,
  AdsAutomationReadonlyPlatformMetricEntityCoverageRow,
  AdsAutomationReadonlyProductMappingCoverageRow,
  AdsAutomationReadonlySupplierSafetyCoverageRow,
} from "./contracts/ads-automation-readonly-platform-import-readiness.contract";
import type { AdsAutomationSourceReadinessReviewExportResponse } from "./contracts/ads-automation-source-readiness-review-export.contract";

const PROVIDER_MVP_ACTION_TYPES = [
  "update_campaign_budget",
  "pause_campaign",
  "pause_ad_group",
];

@Injectable()
export class AdsAutomationApiReadinessGapReportService {
  constructor(
    private readonly normalizer: AdsAutomationPendingErpActionNormalizerService,
    private readonly validateOnlyPlanner: AdsAutomationProviderValidateOnlyPlannerService,
  ) {}

  build(
    input: AdsAutomationApiReadinessGapReportInput,
  ): AdsAutomationApiReadinessGapReportResponse {
    const generatedAt = new Date().toISOString();
    const sourceReadinessReviewExport =
      input.sourceReadinessReviewExport || null;
    const resolvedInput: AdsAutomationApiReadinessGapReportInput = {
      ...input,
      readonlyImportReadiness:
        sourceReadinessReviewExport?.readonlyImportReadiness ||
        input.readonlyImportReadiness ||
        null,
    };
    const platformEntityCoverage =
      resolvedInput.readonlyImportReadiness?.platformEntityCoverage || null;
    const platformEntityCoverageReview = this.platformEntityCoverageReview(
      platformEntityCoverage,
    );
    const platformEntityCoverageBlockers = this.platformEntityCoverageBlockers(
      platformEntityCoverage,
    );
    const platformEntityPendingActionBlockers =
      this.platformEntityPendingActionBlockers(
        resolvedInput,
        platformEntityCoverage,
      );
    const platformEntityPendingActionBlockerNames = this.unique(
      platformEntityPendingActionBlockers.map((blocker) => blocker.blocker),
    );
    const platformEntitySourceBlockers = this.platformEntitySourceBlockers(
      platformEntityCoverage,
    );
    const sourceReadinessSummary = this.sourceReadinessSummary(
      resolvedInput,
      sourceReadinessReviewExport,
    );
    const sourceReadinessReviewBlockers = this.sourceReadinessReviewBlockers(
      sourceReadinessReviewExport,
    );
    const sourceImportCoverage = this.sourceImportCoverage(resolvedInput);
    const sourceBlockers = this.sourceBlockers(
      resolvedInput,
      platformEntitySourceBlockers,
      sourceReadinessReviewBlockers,
    );
    const decisionInputBlockers = this.decisionInputBlockers(
      resolvedInput.foundationSnapshot,
    );
    const providerReadinessBlockers = this.providerReadinessBlockers(
      resolvedInput.providerAccountReadiness || null,
    );
    const normalizationResult = this.pendingActionNormalization(
      resolvedInput,
      platformEntityPendingActionBlockers,
    );
    const validateOnlyLane = normalizationResult.normalization
      ? sourceReadinessReviewBlockers.length
        ? null
        : this.validateOnlyPlanner.planValidateOnlyLane(
            normalizationResult.normalization,
            resolvedInput.mockedProviderResults || [],
            resolvedInput.providerAccountReadiness || null,
          )
      : null;
    const mvpActionContractReview =
      this.mvpActionContractReview(validateOnlyLane);
    const cashflowFirstSafety = this.cashflowFirstSafety(
      resolvedInput.foundationSnapshot,
      sourceBlockers,
      decisionInputBlockers,
      providerReadinessBlockers,
      resolvedInput.lossLimitPolicy || null,
    );
    const baControlAnswers = this.baControlAnswers(
      resolvedInput.foundationSnapshot,
      cashflowFirstSafety.all_safe,
    );
    const stages = this.stages({
      input: resolvedInput,
      sourceBlockers,
      sourceReadinessSummary,
      sourceReadinessReviewBlockers,
      decisionInputBlockers,
      normalization: normalizationResult.normalization,
      normalizationError: normalizationResult.error,
      validateOnlyLane,
      cashflowBlockers: cashflowFirstSafety.blockers,
      providerAccountReadiness: resolvedInput.providerAccountReadiness || null,
      providerReadinessBlockers,
      mvpActionContractReview,
    });
    const blocked =
      stages.some((stage) => stage.status === "blocked") ||
      baControlAnswers.scale_up_execution_mode === "monitor_only";

    return {
      schemaVersion: "ads_automation_api_readiness_gap_report.v1",
      generatedAt,
      reportDate: resolvedInput.reportDate,
      sourceFoundationSchemaVersion:
        resolvedInput.foundationSnapshot.schemaVersion,
      sourceDraftPreviewSchemaVersion: resolvedInput.draftPreview.schemaVersion,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        provider_persistence_used: false,
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
        direct_google_ads_api_call: false,
        provider_mutation_used: false,
        raw_provider_request_included: false,
        operation_builder_called: false,
        live_path_implemented: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
        approval_required_for_all_actions: true,
        campaignBudgetId_no_fallback: true,
      },
      summary: {
        status: blocked ? "blocked" : "ready_for_local_review",
        reportDate: resolvedInput.reportDate,
        source_blocker_count: sourceBlockers.length,
        decision_input_blocker_count: decisionInputBlockers.length,
        ...sourceReadinessSummary,
        ...this.platformEntityCoverageSummary(platformEntityCoverage),
        pending_actions_created:
          normalizationResult.normalization?.summary.pending_actions_created ||
          0,
        provider_validateOnly_plans:
          validateOnlyLane?.summary.provider_actions_received || 0,
        provider_validateOnly_passed:
          validateOnlyLane?.summary.validate_only_passed || 0,
        provider_validateOnly_pending:
          validateOnlyLane?.summary.validate_only_pending || 0,
        provider_account_readiness_status:
          resolvedInput.providerAccountReadiness?.summary.status || "missing",
        provider_actions_ready_for_future_validate_only:
          resolvedInput.providerAccountReadiness?.summary
            .provider_actions_ready_for_future_validate_only || 0,
        provider_actions_blocked_before_boundary:
          resolvedInput.providerAccountReadiness?.summary
            .provider_actions_blocked_before_boundary || 0,
        provider_account_readiness_blocker_count:
          providerReadinessBlockers.length,
        provider_mvp_actions_requiring_validateOnly:
          mvpActionContractReview.provider_mvp_actions_requiring_validateOnly,
        monitor_only_mvp_safety_actions:
          mvpActionContractReview.monitor_only_mvp_safety_actions,
        out_of_scope_non_provider_actions:
          mvpActionContractReview.out_of_scope_non_provider_actions,
        approval_can_be_considered_executable:
          validateOnlyLane?.summary.approval_can_be_considered_executable || 0,
        cashflow_first_scale_all_safe: cashflowFirstSafety.all_safe,
        scale_up_mode: baControlAnswers.scale_up_execution_mode,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        next_required_action: blocked
          ? "resolve_api_readiness_gaps"
          : "review_local_api_readiness_report",
      },
      stages,
      cashflowFirstSafety,
      lossLimitPolicy: resolvedInput.lossLimitPolicy
        ? {
            schemaVersion: resolvedInput.lossLimitPolicy.schemaVersion,
            summary: resolvedInput.lossLimitPolicy.summary,
            scaleBlockers: [...resolvedInput.lossLimitPolicy.scaleBlockers],
          }
        : null,
      baControlAnswers,
      sourceImportCoverage,
      platformEntityCoverage,
      platformEntityCoverageReview,
      platformEntityCoverageBlockers,
      remainingApiPrerequisites: this.remainingApiPrerequisites(
        resolvedInput.lossLimitPolicy || null,
        resolvedInput.providerAccountReadiness || null,
      ),
      sourceBlockers,
      decisionInputBlockers,
      pendingActionNormalization: {
        schemaVersion: normalizationResult.normalization?.schemaVersion || null,
        created: Boolean(normalizationResult.normalization),
        error: normalizationResult.error,
        summary: normalizationResult.normalization?.summary || null,
        platformEntityCoverageBlockersApplied: normalizationResult.normalization
          ? this.unique(
              normalizationResult.normalization.pendingActions.flatMap(
                (action) => action.platform_entity_coverage_blockers,
              ),
            )
          : platformEntityPendingActionBlockerNames,
        platformEntityCoverageActionBlockersApplied:
          normalizationResult.normalization
            ? normalizationResult.normalization.pendingActions.flatMap(
                (action) => action.platform_entity_coverage_action_blockers,
              )
            : platformEntityPendingActionBlockers,
        scaleCandidatesBlockedByPlatformEntityCoverage:
          normalizationResult.normalization?.summary
            .scale_candidates_blocked_by_platform_entity_coverage || 0,
      },
      validateOnlyLane: {
        schemaVersion: validateOnlyLane?.schemaVersion || null,
        created: Boolean(validateOnlyLane),
        summary: validateOnlyLane?.summary || null,
      },
      providerAccountReadiness: resolvedInput.providerAccountReadiness
        ? {
            schemaVersion: resolvedInput.providerAccountReadiness.schemaVersion,
            summary: resolvedInput.providerAccountReadiness.summary,
            safety: resolvedInput.providerAccountReadiness.safety,
            blockers: [...resolvedInput.providerAccountReadiness.blockers],
          }
        : null,
      mvpActionContractReview,
      markdownPreview: this.markdownPreview({
        reportDate: resolvedInput.reportDate,
        sourceBlockers,
        sourceReadinessSummary,
        sourceReadinessReviewBlockers,
        decisionInputBlockers,
        providerReadinessBlockers,
        cashflowBlockers: cashflowFirstSafety.blockers,
        baControlAnswers,
        validateOnlyLane,
        mvpActionContractReview,
        platformEntityCoverage,
        platformEntityCoverageReview,
        platformEntityCoverageBlockers,
        platformEntityCoverageActionBlockers:
          platformEntityPendingActionBlockers,
      }),
    };
  }

  private platformEntityCoverageSummary(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
  ): Pick<
    AdsAutomationApiReadinessGapReportSummary,
    | "platform_entity_coverage_present"
    | "platform_metric_row_count"
    | "platform_metric_ready_row_count"
    | "platform_campaign_count"
    | "platform_ad_group_count"
    | "platform_campaignBudget_count"
    | "platform_campaignBudgetId_missing_rows"
    | "platform_mapped_product_count"
    | "platform_mapped_ad_group_count"
    | "platform_unmapped_ad_group_count"
    | "platform_profitable_product_count"
    | "platform_blocked_product_count"
    | "platform_safe_supplier_count"
    | "platform_blocked_supplier_count"
    | "platform_supplier_choice_safe"
    | "platform_latest_successful_sync_at"
    | "platform_latest_record_date"
    | "platform_entity_blocker_count"
  > {
    if (!coverage) {
      return {
        platform_entity_coverage_present: false,
        platform_metric_row_count: 0,
        platform_metric_ready_row_count: 0,
        platform_campaign_count: 0,
        platform_ad_group_count: 0,
        platform_campaignBudget_count: 0,
        platform_campaignBudgetId_missing_rows: 0,
        platform_mapped_product_count: 0,
        platform_mapped_ad_group_count: 0,
        platform_unmapped_ad_group_count: 0,
        platform_profitable_product_count: 0,
        platform_blocked_product_count: 0,
        platform_safe_supplier_count: 0,
        platform_blocked_supplier_count: 0,
        platform_supplier_choice_safe: null,
        platform_latest_successful_sync_at: null,
        platform_latest_record_date: null,
        platform_entity_blocker_count: 0,
      };
    }

    return {
      platform_entity_coverage_present: true,
      platform_metric_row_count: coverage.metrics.rows,
      platform_metric_ready_row_count: coverage.metrics.readyRows,
      platform_campaign_count: coverage.campaigns.coveredCampaignCount,
      platform_ad_group_count: coverage.adGroups.coveredAdGroupCount,
      platform_campaignBudget_count:
        coverage.campaignBudgets.coveredCampaignBudgetCount,
      platform_campaignBudgetId_missing_rows:
        coverage.campaignBudgets.missingCampaignBudgetIdRows,
      platform_mapped_product_count:
        coverage.productMapping.mappedProductIds.length,
      platform_mapped_ad_group_count:
        coverage.productMapping.mappedAdGroupIds.length,
      platform_unmapped_ad_group_count:
        coverage.productMapping.unmappedAdGroupIds.length,
      platform_profitable_product_count:
        coverage.inventoryProfit.profitableProductIds.length,
      platform_blocked_product_count:
        coverage.inventoryProfit.blockedProductIds.length,
      platform_safe_supplier_count:
        coverage.supplierContext.safeSupplierIds.length,
      platform_blocked_supplier_count:
        coverage.supplierContext.blockedSupplierIds.length,
      platform_supplier_choice_safe:
        coverage.supplierContext.supplierChoiceSafe,
      platform_latest_successful_sync_at:
        coverage.freshnessCoverage.latestSuccessfulSyncAt,
      platform_latest_record_date: coverage.freshnessCoverage.latestRecordDate,
      platform_entity_blocker_count:
        this.platformEntityCoverageBlockers(coverage).length,
    };
  }

  private platformEntityCoverageBlockers(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
  ): string[] {
    if (!coverage) return [];

    return this.unique([
      ...coverage.campaigns.blockers.map(
        (blocker) => `platform_entity.campaigns.${blocker}`,
      ),
      ...coverage.adGroups.blockers.map(
        (blocker) => `platform_entity.adGroups.${blocker}`,
      ),
      ...coverage.campaignBudgets.blockers.map(
        (blocker) => `platform_entity.campaignBudgets.${blocker}`,
      ),
      ...coverage.productMapping.blockers.map(
        (blocker) => `platform_entity.productMapping.${blocker}`,
      ),
      ...coverage.inventoryProfit.blockers.map(
        (blocker) => `platform_entity.inventoryProfit.${blocker}`,
      ),
      ...coverage.supplierContext.blockers.map(
        (blocker) => `platform_entity.supplierContext.${blocker}`,
      ),
      ...coverage.freshnessCoverage.blockingReasons.map(
        (blocker) => `platform_entity.freshnessCoverage.${blocker}`,
      ),
      ...(coverage.campaigns.missingCampaignIdRows
        ? ["platform_entity.campaigns.campaignId_missing_rows"]
        : []),
      ...(coverage.adGroups.missingAdGroupIdRows
        ? ["platform_entity.adGroups.adGroupId_missing_rows"]
        : []),
      ...(coverage.campaignBudgets.missingCampaignBudgetIdRows
        ? [
            "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
          ]
        : []),
      ...(coverage.productMapping.coveredForDecision
        ? []
        : ["platform_entity.productMapping.not_covered_for_decision"]),
      ...(coverage.inventoryProfit.coveredForDecision
        ? []
        : ["platform_entity.inventoryProfit.not_covered_for_decision"]),
      ...(coverage.supplierContext.coveredForDecision
        ? []
        : ["platform_entity.supplierContext.not_covered_for_decision"]),
    ]);
  }

  private platformEntitySourceBlockers(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
  ): string[] {
    if (!coverage) return [];

    return this.unique([
      ...coverage.campaigns.blockers.map(
        (blocker) => `platform_entity.campaigns.${blocker}`,
      ),
      ...coverage.adGroups.blockers.map(
        (blocker) => `platform_entity.adGroups.${blocker}`,
      ),
      ...coverage.campaignBudgets.blockers.map(
        (blocker) => `platform_entity.campaignBudgets.${blocker}`,
      ),
      ...coverage.productMapping.blockers.map(
        (blocker) => `platform_entity.productMapping.${blocker}`,
      ),
      ...coverage.freshnessCoverage.blockingReasons.map(
        (blocker) => `platform_entity.freshnessCoverage.${blocker}`,
      ),
      ...(coverage.campaigns.missingCampaignIdRows
        ? ["platform_entity.campaigns.campaignId_missing_rows"]
        : []),
      ...(coverage.adGroups.missingAdGroupIdRows
        ? ["platform_entity.adGroups.adGroupId_missing_rows"]
        : []),
      ...(coverage.campaignBudgets.missingCampaignBudgetIdRows
        ? [
            "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
          ]
        : []),
      ...(coverage.productMapping.sourceReady
        ? []
        : ["platform_entity.productMapping.source_not_ready"]),
      ...(coverage.inventoryProfit.sourceReady
        ? []
        : ["platform_entity.inventoryProfit.source_not_ready"]),
      ...(coverage.supplierContext.sourceReady
        ? []
        : ["platform_entity.supplierContext.source_not_ready"]),
    ]);
  }

  private platformEntityPendingActionBlockers(
    input: AdsAutomationApiReadinessGapReportInput,
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
  ): AdsAutomationPlatformEntityCoverageActionBlocker[] {
    if (
      input.readonlyImportReadiness?.summary.scale_up_execution_mode !==
      "monitor_only"
    ) {
      return [];
    }
    return input.draftPreview.drafts
      .filter((draft) => draft.action_type === "update_campaign_budget")
      .flatMap((draft) =>
        this.platformEntityCoverageActionBlockers(
          coverage,
          this.draftIdentifiers(draft),
        ),
      );
  }

  private pendingActionNormalization(
    input: AdsAutomationApiReadinessGapReportInput,
    platformEntityCoverageActionBlockers: AdsAutomationPlatformEntityCoverageActionBlocker[],
  ): {
    normalization: AdsAutomationPendingErpActionNormalizationResponse | null;
    error: string | null;
  } {
    try {
      return {
        normalization: this.normalizer.normalizePreview(input.draftPreview, {
          platformEntityCoverageBlockers: this.unique(
            platformEntityCoverageActionBlockers.map(
              (blocker) => blocker.blocker,
            ),
          ),
          platformEntityCoverageActionBlockers,
        }),
        error: null,
      };
    } catch (error) {
      return {
        normalization: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private draftIdentifiers(
    draft: AdsAutomationDecisionDraftPreview,
  ): AdsAutomationPendingErpActionIdentifiers {
    const payload = draft.typedPayload || {};
    return {
      customerId: this.text(payload.customerId) || this.text(draft.accountId),
      campaignId:
        this.text(payload.campaignId) ||
        (draft.entity_type === "campaign" ? this.text(draft.entity_id) : null),
      adGroupId:
        this.text(payload.adGroupId) ||
        (draft.entity_type === "ad_group" ? this.text(draft.entity_id) : null),
      campaignBudgetId: this.text(payload.campaignBudgetId),
      campaignBudgetResourceName: this.text(payload.campaignBudgetResourceName),
      productId: this.text(draft.productId) || this.text(payload.productId),
      supplierId: this.text(draft.supplierId) || this.text(payload.supplierId),
    };
  }

  private platformEntityCoverageActionBlockers(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
    identifiers: AdsAutomationPendingErpActionIdentifiers,
  ): AdsAutomationPlatformEntityCoverageActionBlocker[] {
    if (!coverage) return [];
    const blockers: AdsAutomationPlatformEntityCoverageActionBlocker[] = [];
    const add = (
      family: AdsAutomationPlatformEntityCoverageActionBlocker["family"],
      scope: AdsAutomationPlatformEntityCoverageActionBlocker["scope"],
      values: string[],
    ) => {
      for (const blocker of this.unique(values)) {
        blockers.push({
          blocker,
          family,
          scope,
          campaignId: identifiers.campaignId,
          adGroupId: identifiers.adGroupId,
          campaignBudgetId: identifiers.campaignBudgetId,
          productId: identifiers.productId,
          supplierId: identifiers.supplierId,
        });
      }
    };

    if (
      identifiers.campaignId &&
      !coverage.campaigns.campaignIds.includes(identifiers.campaignId)
    ) {
      add("campaigns", "campaignId", [
        ...this.prefixedBlockers("campaigns", coverage.campaigns.blockers),
        "platform_entity.campaigns.campaignId_not_covered_for_action",
      ]);
    }

    if (
      identifiers.adGroupId &&
      !coverage.adGroups.adGroupIds.includes(identifiers.adGroupId)
    ) {
      add("adGroups", "adGroupId", [
        ...this.prefixedBlockers("adGroups", coverage.adGroups.blockers),
        "platform_entity.adGroups.adGroupId_not_covered_for_action",
      ]);
    }

    if (!identifiers.campaignBudgetId) {
      add("campaignBudgets", "campaignBudgetId", [
        "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
      ]);
    } else if (
      !coverage.campaignBudgets.campaignBudgetIds.includes(
        identifiers.campaignBudgetId,
      )
    ) {
      add("campaignBudgets", "campaignBudgetId", [
        ...this.prefixedBlockers(
          "campaignBudgets",
          coverage.campaignBudgets.blockers,
        ),
        "platform_entity.campaignBudgets.campaignBudgetId_not_covered_for_action",
      ]);
    }

    const productMappingBlockers: string[] = [];
    if (
      identifiers.adGroupId &&
      coverage.productMapping.unmappedAdGroupIds.includes(identifiers.adGroupId)
    ) {
      productMappingBlockers.push(
        ...this.prefixedBlockers(
          "productMapping",
          coverage.productMapping.blockers,
        ),
        "platform_entity.productMapping.adGroupId_unmapped_for_action",
      );
    }
    if (
      identifiers.productId &&
      !coverage.productMapping.mappedProductIds.includes(identifiers.productId)
    ) {
      productMappingBlockers.push(
        "platform_entity.productMapping.productId_not_mapped_for_action",
      );
    }
    if (productMappingBlockers.length && !coverage.productMapping.sourceReady) {
      productMappingBlockers.push(
        "platform_entity.productMapping.source_not_ready",
      );
    }
    if (
      productMappingBlockers.length &&
      !coverage.productMapping.coveredForDecision
    ) {
      productMappingBlockers.push(
        "platform_entity.productMapping.not_covered_for_decision",
      );
    }
    add("productMapping", "productId", productMappingBlockers);

    const inventoryBlockers: string[] = [];
    if (
      identifiers.productId &&
      coverage.inventoryProfit.blockedProductIds.includes(identifiers.productId)
    ) {
      inventoryBlockers.push(
        ...this.prefixedBlockers(
          "inventoryProfit",
          coverage.inventoryProfit.blockers,
        ),
        "platform_entity.inventoryProfit.product_blocked_for_action",
      );
    }
    if (
      identifiers.productId &&
      !coverage.inventoryProfit.profitableProductIds.includes(
        identifiers.productId,
      ) &&
      !coverage.inventoryProfit.coveredForDecision
    ) {
      inventoryBlockers.push(
        "platform_entity.inventoryProfit.product_profit_not_covered_for_action",
      );
    }
    if (inventoryBlockers.length && !coverage.inventoryProfit.sourceReady) {
      inventoryBlockers.push(
        "platform_entity.inventoryProfit.source_not_ready",
      );
    }
    if (
      inventoryBlockers.length &&
      !coverage.inventoryProfit.coveredForDecision
    ) {
      inventoryBlockers.push(
        "platform_entity.inventoryProfit.not_covered_for_decision",
      );
    }
    add("inventoryProfit", "productId", inventoryBlockers);

    const supplierBlockers: string[] = [];
    if (
      identifiers.supplierId &&
      coverage.supplierContext.blockedSupplierIds.includes(
        identifiers.supplierId,
      )
    ) {
      supplierBlockers.push(
        ...this.prefixedBlockers(
          "supplierContext",
          coverage.supplierContext.blockers,
        ),
        "platform_entity.supplierContext.supplier_blocked_for_action",
      );
    }
    if (
      identifiers.supplierId &&
      !coverage.supplierContext.safeSupplierIds.includes(
        identifiers.supplierId,
      ) &&
      !coverage.supplierContext.coveredForDecision
    ) {
      supplierBlockers.push(
        "platform_entity.supplierContext.supplier_not_safe_for_action",
      );
    }
    if (supplierBlockers.length && !coverage.supplierContext.sourceReady) {
      supplierBlockers.push("platform_entity.supplierContext.source_not_ready");
    }
    if (
      supplierBlockers.length &&
      !coverage.supplierContext.coveredForDecision
    ) {
      supplierBlockers.push(
        "platform_entity.supplierContext.not_covered_for_decision",
      );
    }
    add("supplierContext", "supplierId", supplierBlockers);

    add(
      "freshnessCoverage",
      "freshness",
      coverage.freshnessCoverage.blockingReasons.map(
        (blocker) => `platform_entity.freshnessCoverage.${blocker}`,
      ),
    );

    return this.dedupeActionBlockers(blockers);
  }

  private prefixedBlockers(
    family: AdsAutomationPlatformEntityCoverageActionBlocker["family"],
    blockers: string[],
  ): string[] {
    return blockers.map((blocker) => `platform_entity.${family}.${blocker}`);
  }

  private dedupeActionBlockers(
    blockers: AdsAutomationPlatformEntityCoverageActionBlocker[],
  ): AdsAutomationPlatformEntityCoverageActionBlocker[] {
    const seen = new Set<string>();
    return blockers.filter((blocker) => {
      const key = [
        blocker.blocker,
        blocker.scope,
        blocker.campaignId,
        blocker.adGroupId,
        blocker.campaignBudgetId,
        blocker.productId,
        blocker.supplierId,
      ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private sourceReadinessSummary(
    input: AdsAutomationApiReadinessGapReportInput,
    reviewExport: AdsAutomationSourceReadinessReviewExportResponse | null,
  ): Pick<
    AdsAutomationApiReadinessGapReportSummary,
    | "source_readiness_review_export_consumed"
    | "source_readiness_review_export_mode"
    | "source_readiness_review_export_status"
    | "required_source_count"
    | "required_source_ready_count"
    | "required_source_blocked_count"
    | "required_source_report_date_covered_count"
    | "required_source_report_date_blocked_count"
    | "missing_required_source_evidence"
    | "source_coverage_blocking_reasons"
    | "source_readiness_validateOnly_blocker_count"
    | "source_readiness_final_go_no_go_blocker_count"
  > {
    const summary =
      reviewExport?.summary || input.readonlyImportReadiness?.summary || null;
    const blockers = this.sourceReadinessReviewBlockers(reviewExport);

    return {
      source_readiness_review_export_consumed: Boolean(reviewExport),
      source_readiness_review_export_mode: reviewExport?.exportMode || null,
      source_readiness_review_export_status:
        reviewExport?.summary.export_status || null,
      required_source_count: summary?.required_source_count || 0,
      required_source_ready_count: summary?.required_source_ready_count || 0,
      required_source_blocked_count:
        summary?.required_source_blocked_count || 0,
      required_source_report_date_covered_count:
        summary?.required_source_report_date_covered_count || 0,
      required_source_report_date_blocked_count:
        summary?.required_source_report_date_blocked_count || 0,
      missing_required_source_evidence: [
        ...(summary?.missing_required_source_evidence || []),
      ],
      source_coverage_blocking_reasons: [
        ...(summary?.source_coverage_blocking_reasons || []),
      ],
      source_readiness_validateOnly_blocker_count: blockers.length,
      source_readiness_final_go_no_go_blocker_count: blockers.length,
    };
  }

  private sourceReadinessReviewBlockers(
    reviewExport: AdsAutomationSourceReadinessReviewExportResponse | null,
  ): string[] {
    if (!reviewExport) return [];

    const summary = reviewExport.summary;
    const blockerReview = reviewExport.blockerReview;
    const blockers: string[] = [];

    if (summary.export_status === "needs_attention") {
      blockers.push("source_readiness_review.export_needs_attention");
    }
    if (summary.export_status === "empty") {
      blockers.push("source_readiness_review.export_empty");
    }
    if (summary.required_source_blocked_count > 0) {
      blockers.push("source_readiness_review.required_sources_blocked");
    }
    if (summary.required_source_report_date_blocked_count > 0) {
      blockers.push(
        "source_readiness_review.required_sources_report_date_not_covered",
      );
    }
    if (summary.campaignBudgetId_missing_rows > 0) {
      blockers.push(
        "source_readiness_review.campaignBudgetId_missing_no_fallback",
      );
    }
    if (summary.product_allocation_blocker_count > 0) {
      blockers.push("source_readiness_review.product_allocation_blockers");
    }
    if (summary.supplier_safety_blocker_count > 0) {
      blockers.push("source_readiness_review.supplier_safety_blockers");
    }

    blockers.push(
      ...summary.missing_required_source_evidence.map(
        (sourceKey) =>
          `source_readiness_review.missing_required_source_evidence.${sourceKey}`,
      ),
      ...summary.source_coverage_blocking_reasons.map(
        (reason) => `source_readiness_review.source_coverage.${reason}`,
      ),
      ...reviewExport.campaignBudgetEvidence.missing_rows.map(
        (row) =>
          `source_readiness_review.campaignBudgetId_missing_no_fallback.${row.key}`,
      ),
      ...blockerReview.productAllocationBlockers.map(
        (blocker) =>
          `source_readiness_review.product_inventory_profit.${blocker}`,
      ),
      ...blockerReview.supplierSafetyBlockers.map(
        (blocker) => `source_readiness_review.supplier_safety.${blocker}`,
      ),
    );

    return this.unique(blockers);
  }

  private sourceBlockers(
    input: AdsAutomationApiReadinessGapReportInput,
    platformEntityCoverageBlockers: string[],
    sourceReadinessReviewBlockers: string[] = [],
  ): string[] {
    const blockers: string[] = [];
    const gates = input.draftPreview.sourceSyncDecisionGates || {};
    if (gates.canGenerateActionDraft === false) {
      blockers.push("source_sync.canGenerateActionDraft");
    }
    if (gates.canRecommendAdsScale === false) {
      blockers.push("source_sync.canRecommendAdsScale");
    }
    if (gates.canUseGoogleAdsDataClaim === false) {
      blockers.push("source_sync.canUseGoogleAdsDataClaim");
    }

    for (const evidence of input.draftPreview.sourceSyncDecisionEvidence ||
      []) {
      if (evidence.canUseForAdsAutomationDecision === true) continue;
      blockers.push(`source_sync.${evidence.sourceKey}_not_ready`);
      blockers.push(
        ...(evidence.blockingReasons || []).map(
          (reason) => `source_sync.${evidence.sourceKey}.${reason}`,
        ),
      );
    }

    for (const evidence of input.foundationSnapshot.sourceEvidence || []) {
      if (evidence.status === "fresh" && evidence.canUseForDecision === "yes")
        continue;
      blockers.push(`read_model.${evidence.sourceKey}.${evidence.status}`);
      for (const field of evidence.missingFields || []) {
        blockers.push(`read_model.${evidence.sourceKey}.missing.${field}`);
      }
    }

    for (const evidence of input.foundationSnapshot.missingFieldEvidence ||
      []) {
      blockers.push(
        `missing_field.${evidence.sourceKey}.${evidence.entityId}.${evidence.missingFields.join("+")}`,
      );
    }

    for (const evidence of input.foundationSnapshot.queryEvidence || []) {
      if (evidence.status === "loaded" && !evidence.missingFields.length)
        continue;
      blockers.push(
        `query.${evidence.sourceKey}.${evidence.entityId}.${evidence.status}`,
      );
      for (const field of evidence.missingFields || []) {
        blockers.push(
          `query.${evidence.sourceKey}.${evidence.entityId}.missing.${field}`,
        );
      }
    }

    for (const evidence of input.readonlyImportReadiness
      ?.sourceImportCoverage || []) {
      if (evidence.canUseForAdsAutomationDecision === true) continue;
      blockers.push(`readonly_import.${evidence.sourceKey}_not_ready`);
      blockers.push(
        ...(evidence.blockingReasons || []).map(
          (reason) => `readonly_import.${evidence.sourceKey}.${reason}`,
        ),
      );
    }

    blockers.push(...platformEntityCoverageBlockers);
    blockers.push(...sourceReadinessReviewBlockers);

    return this.unique(blockers);
  }

  private decisionInputBlockers(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
  ): string[] {
    return this.unique([
      ...foundationSnapshot.blockers.global,
      ...foundationSnapshot.blockers.missing_fields.map(
        (field) => `missing.${field}`,
      ),
      ...Object.entries(foundationSnapshot.blockers.by_category).flatMap(
        ([category, blockers]) =>
          blockers.map((blocker) => `${category}.${blocker}`),
      ),
    ]);
  }

  private cashflowFirstSafety(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
    sourceBlockers: string[],
    decisionInputBlockers: string[],
    providerReadinessBlockers: string[],
    lossLimitPolicy: AdsAutomationApiReadinessGapReportInput["lossLimitPolicy"],
  ): {
    all_safe: boolean;
    checks: AdsAutomationCashflowFirstSafetyCheck[];
    blockers: string[];
  } {
    const itemBlockers = this.unique([
      ...decisionInputBlockers,
      ...this.allFoundationItems(foundationSnapshot).flatMap(
        (item) => item.blockers,
      ),
    ]);
    const sourceSafe = sourceBlockers.length === 0;
    const hasScaleCandidate = foundationSnapshot.scale_amount.items.length > 0;
    const policy = lossLimitPolicy?.summary;
    const policyScaleBlockers = lossLimitPolicy?.scaleBlockers || [];

    const checks: AdsAutomationCashflowFirstSafetyCheck[] = [
      this.check(
        "gross_margin_safe",
        policy
          ? policy.gross_margin_safe
          : !this.includesAny(itemBlockers, [
              "product_margin_below_minimum",
              "margin_after_cost_below_minimum",
              "negative_product_margin",
            ]),
        ["gross_margin_or_supplier_margin_not_safe"],
        "Product and supplier margin blockers must be absent.",
      ),
      this.check(
        "contribution_profit_positive",
        policy
          ? policy.contribution_profit_safe
          : hasScaleCandidate &&
              !this.includesAny(itemBlockers, [
                "net_profit_after_ads_not_positive",
                "product_net_profit_not_positive",
                "negative_product_economics",
              ]),
        ["contribution_profit_or_net_profit_not_safe"],
        "Scale candidates must have positive profit after ads.",
      ),
      this.check(
        "cash_conversion_working_capital_safe",
        policy ? policy.cash_conversion_working_capital_safe : false,
        ["cash_conversion_or_working_capital_health_missing"],
        "Cash conversion and working-capital health are not proven by this local API-readiness report.",
      ),
      this.check(
        "stock_coverage_safe",
        policy
          ? policy.stock_coverage_safe
          : !this.includesAny(itemBlockers, [
              "stock_below_minimum",
              "days_of_cover_below_minimum",
            ]),
        ["stock_coverage_not_safe"],
        "Stock available and days-of-cover blockers must be absent.",
      ),
      this.check(
        "supplier_reliability_safe",
        policy
          ? policy.supplier_reliability_safe
          : foundationSnapshot.supplier_gate.safe_suppliers.length > 0 &&
              !this.includesAny(itemBlockers, [
                "lead_time_too_high",
                "late_delivery_rate_too_high",
                "payment_data_not_fresh",
                "capacity_blocked",
                "capacity_constrained",
                "return_fault_rate_too_high",
                "no_safe_supplier_for_scale",
              ]),
        ["supplier_reliability_not_safe"],
        "Supplier quote, lead-time, payment freshness, capacity, and return-fault gates must be safe.",
      ),
      this.check(
        "fulfillment_capacity_safe",
        policy ? policy.fulfillment_capacity_safe : false,
        ["fulfillment_capacity_missing"],
        "Warehouse or fulfillment capacity is not proven by this local API-readiness report.",
      ),
      this.check(
        "return_refund_risk_safe",
        policy
          ? policy.return_refund_risk_safe
          : !this.includesAny(itemBlockers, [
              "return_cancel_refund_rate_too_high",
              "return_fault_rate_too_high",
            ]),
        ["return_refund_risk_not_safe"],
        "Return, refund, cancel, and supplier fault blockers must be absent.",
      ),
      this.check(
        "data_freshness_safe",
        policy ? policy.data_freshness_safe && sourceSafe : sourceSafe,
        ["data_freshness_or_coverage_not_safe"],
        "Source-sync and read-model freshness/coverage blockers must be absent.",
      ),
      this.check(
        "spend_caps_safe",
        policy ? policy.spend_caps_safe : true,
        ["spend_caps_missing_or_unsafe"],
        "Campaign, ad group, and product spend caps must be safe before any scale-up can execute.",
      ),
      this.check(
        "emergency_stop_clear",
        policy ? !policy.emergency_stop_active : true,
        ["emergency_stop_or_kill_switch_active"],
        "Emergency stop and kill-switch state must be clear before any scale-up can execute.",
      ),
      this.check(
        "daily_loss_limit_safe",
        policy ? policy.daily_loss_limit_safe : false,
        ["daily_loss_limit_missing"],
        "Daily loss limit evidence is required before any scale-up can execute.",
      ),
      this.check(
        "monthly_loss_limit_safe",
        policy ? policy.monthly_loss_limit_safe : false,
        ["monthly_loss_limit_missing"],
        "Monthly loss limit evidence is required before any scale-up can execute.",
      ),
    ];

    const blockers = this.unique([
      ...checks.flatMap((check) => check.blockers),
      ...policyScaleBlockers,
      ...providerReadinessBlockers,
    ]);

    return {
      all_safe:
        checks.every((check) => check.passed) &&
        providerReadinessBlockers.length === 0,
      checks,
      blockers,
    };
  }

  private check(
    key: AdsAutomationCashflowFirstSafetyCheck["key"],
    passed: boolean,
    blockers: string[],
    evidence: string,
  ): AdsAutomationCashflowFirstSafetyCheck {
    return {
      key,
      passed,
      blockers: passed ? [] : blockers,
      evidence,
    };
  }

  private baControlAnswers(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
    cashflowAllSafe: boolean,
  ): AdsAutomationBaControlAnswers {
    const pendingValidationScale =
      cashflowAllSafe && foundationSnapshot.scale_amount.items.length > 0;
    const productAllocationItems =
      foundationSnapshot.product_budget_allocation.items;
    return {
      increase_ads: pendingValidationScale
        ? "yes_pending_validation"
        : "no_monitor_only",
      increase_amount_vnd: pendingValidationScale
        ? foundationSnapshot.scale_amount.total_increase_vnd
        : 0,
      blocked_increase_amount_vnd: pendingValidationScale
        ? 0
        : foundationSnapshot.scale_amount.total_increase_vnd,
      target_ad_groups: foundationSnapshot.target_ad_groups.items.map(
        (item) => ({
          adGroupId: item.entity_id,
          campaignBudgetId: this.text(item.currentValue?.campaignBudgetId),
          status: item.status,
          blockers: [...item.blockers],
        }),
      ),
      products_to_receive_budget: productAllocationItems
        .filter((item) => item.status === "scale_ready")
        .map((item) => ({
          productId: item.productId,
          status: pendingValidationScale ? item.status : "monitor_only",
          blockers: [...item.blockers],
        })),
      products_blocked_from_budget: productAllocationItems
        .filter((item) => item.status !== "scale_ready")
        .map((item) => ({
          productId: item.productId,
          status: item.status,
          blockers: [...item.blockers],
        })),
      supplier_safety: [
        ...foundationSnapshot.supplier_gate.safe_suppliers.map((item) => ({
          productId: item.productId,
          supplierId: item.supplierId,
          status: "safe",
          blockers: [...item.blockers],
        })),
        ...foundationSnapshot.supplier_gate.review_suppliers.map((item) => ({
          productId: item.productId,
          supplierId: item.supplierId,
          status: item.status,
          blockers: [...item.blockers],
        })),
      ],
      product_kill_or_stop_import_review:
        foundationSnapshot.product_kill_review.candidates.map((item) => ({
          productId: item.productId,
          status: item.status,
          blockers: [...item.blockers],
        })),
      campaign_or_ad_group_pause:
        foundationSnapshot.campaign_or_ad_group_pause_candidates.candidates.map(
          (item) => ({
            campaignId: this.text(item.currentValue?.campaignId),
            adGroupId:
              this.text(item.currentValue?.adGroupId) || item.entity_id,
            status: item.status,
            blockers: [...item.blockers],
          }),
        ),
      scale_up_execution_mode: pendingValidationScale
        ? "pending_validation"
        : "monitor_only",
      execution_allowed_now: false,
    };
  }

  private sourceImportCoverage(
    input: AdsAutomationApiReadinessGapReportInput,
  ): AdsAutomationApiSourceImportCoverage[] {
    const readonlyRows =
      input.readonlyImportReadiness?.sourceImportCoverage || [];
    const rows: Array<{
      sourceKey: AdsAutomationApiSourceImportCoverage["sourceKey"] | string;
      reportDate?: string;
      freshnessStatus?: string;
      coverageStatus?: string;
      lastSuccessfulSyncAt?: string | null;
      latestRecordDate?: string | null;
      blockingReason?: string | null;
      blockingReasons?: string[];
      canUseForAdsAutomationDecision?: boolean;
    }> = [...readonlyRows];
    const sourceKeys = new Set(rows.map((row) => row.sourceKey));
    for (const evidence of input.draftPreview.sourceSyncDecisionEvidence ||
      []) {
      if (sourceKeys.has(evidence.sourceKey)) continue;
      rows.push(evidence);
      sourceKeys.add(evidence.sourceKey);
    }

    return rows.map((evidence) => ({
      sourceKey: evidence.sourceKey,
      reportDate: evidence.reportDate || input.reportDate,
      freshnessStatus: evidence.freshnessStatus || "unknown",
      coverageStatus: evidence.coverageStatus || "unknown",
      lastSuccessfulSyncAt: evidence.lastSuccessfulSyncAt ?? null,
      latestRecordDate: evidence.latestRecordDate ?? null,
      blockingReason:
        evidence.blockingReason || evidence.blockingReasons?.[0] || null,
      blockingReasons: [...(evidence.blockingReasons || [])],
      canUseForAdsAutomationDecision:
        evidence.canUseForAdsAutomationDecision === true,
    }));
  }

  private mvpActionContractReview(
    validateOnlyLane: AdsAutomationProviderValidateOnlyLaneResponse | null,
  ): AdsAutomationProviderValidateOnlyMvpActionContractReview {
    const actionContracts = (validateOnlyLane?.validationPlans || []).map(
      (plan) => {
        const mvpActionContract =
          plan.mvp_action_contract || this.defaultMvpActionContract(plan);
        return {
          source: "api_readiness_validateOnly_lane" as const,
          action_id: plan.validation_id,
          pending_action_id: plan.pending_action_id,
          approval_id: plan.approval_id,
          action_type: plan.action_type,
          provider: plan.provider,
          mvp_action_contract: mvpActionContract,
          evidence: this.mvpActionContractEvidence(mvpActionContract),
        };
      },
    );

    return {
      provider_mvp_actions_requiring_validateOnly: actionContracts.filter(
        (item) =>
          item.mvp_action_contract.action_scope ===
          "provider_validateOnly_required",
      ).length,
      monitor_only_mvp_safety_actions: actionContracts.filter(
        (item) =>
          item.mvp_action_contract.action_scope ===
          "monitor_only_safety_action",
      ).length,
      out_of_scope_non_provider_actions: actionContracts.filter(
        (item) =>
          item.mvp_action_contract.action_scope ===
          "out_of_scope_non_provider_action",
      ).length,
      supported_mvp_actions: actionContracts.filter(
        (item) => item.mvp_action_contract.supported_mvp_action,
      ).length,
      unsupported_mvp_actions: actionContracts.filter(
        (item) => !item.mvp_action_contract.supported_mvp_action,
      ).length,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      action_contracts: actionContracts,
    };
  }

  private defaultMvpActionContract(
    plan: AdsAutomationProviderValidateOnlyLaneResponse["validationPlans"][number],
  ): AdsAutomationProviderValidateOnlyMvpActionContractReview["action_contracts"][number]["mvp_action_contract"] {
    const providerAction =
      plan.action_family === "provider_google_ads" &&
      plan.provider === "google" &&
      PROVIDER_MVP_ACTION_TYPES.includes(plan.action_type);
    const monitorOnly = plan.action_type === "monitor_only";

    return {
      supported_mvp_action: providerAction || monitorOnly,
      action_scope: providerAction
        ? "provider_validateOnly_required"
        : monitorOnly
          ? "monitor_only_safety_action"
          : "out_of_scope_non_provider_action",
      preflight_treatment: providerAction
        ? "eligible_for_future_provider_preflight"
        : monitorOnly
          ? "visible_non_executable_safety_action"
          : "not_in_mvp_validateOnly_contract",
      provider_validateOnly_required_before_future_execution: providerAction,
      monitor_only_safety_action: monitorOnly,
      visible_as_safety_action: monitorOnly,
      approval_required_before_execution: true,
      future_live_execution_allowed: false,
      executable_now: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private mvpActionContractEvidence(
    contract: AdsAutomationProviderValidateOnlyMvpActionContractReview["action_contracts"][number]["mvp_action_contract"],
  ): string[] {
    const evidence = [
      `action_scope=${contract.action_scope}`,
      `preflight_treatment=${contract.preflight_treatment}`,
      "provider_api_called=false",
      "google_ads_api_called=false",
      "validateOnly_called=false",
      "execution_allowed_now=false",
    ];

    if (contract.action_scope === "provider_validateOnly_required") {
      evidence.push(
        "provider_mvp_action_requires_future_erp_owned_provider_validateOnly=true",
      );
    }
    if (contract.action_scope === "monitor_only_safety_action") {
      evidence.push("monitor_only_visible_non_executable_safety_action=true");
    }
    if (contract.action_scope === "out_of_scope_non_provider_action") {
      evidence.push("non_mvp_internal_action_out_of_scope=true");
    }

    return evidence;
  }

  private stages(input: {
    input: AdsAutomationApiReadinessGapReportInput;
    sourceBlockers: string[];
    sourceReadinessSummary: Pick<
      AdsAutomationApiReadinessGapReportSummary,
      | "source_readiness_review_export_consumed"
      | "required_source_count"
      | "required_source_ready_count"
      | "required_source_blocked_count"
      | "required_source_report_date_covered_count"
      | "required_source_report_date_blocked_count"
    >;
    sourceReadinessReviewBlockers: string[];
    decisionInputBlockers: string[];
    normalization: AdsAutomationPendingErpActionNormalizationResponse | null;
    normalizationError: string | null;
    validateOnlyLane: AdsAutomationProviderValidateOnlyLaneResponse | null;
    cashflowBlockers: string[];
    providerAccountReadiness: AdsAutomationProviderAccountReadinessResponse | null;
    providerReadinessBlockers: string[];
    mvpActionContractReview: AdsAutomationProviderValidateOnlyMvpActionContractReview;
  }): AdsAutomationApiReadinessGapReportStage[] {
    const validateOnlyBlockers = input.validateOnlyLane
      ? this.unique([
          ...input.sourceReadinessReviewBlockers,
          ...input.validateOnlyLane.validationPlans.flatMap(
            (plan) => plan.blockers,
          ),
        ])
      : this.unique([
          ...input.sourceReadinessReviewBlockers,
          ...(input.normalization
            ? input.sourceReadinessReviewBlockers.length
              ? []
              : ["validateOnly_lane_not_available"]
            : ["pending_action_normalization_not_available"]),
        ]);
    const preflightBlockers = this.unique([
      ...input.sourceBlockers,
      ...input.decisionInputBlockers,
      ...input.cashflowBlockers,
      ...(input.validateOnlyLane?.summary.validate_only_passed
        ? []
        : ["validateOnly_passed"]),
      "approved_action",
      "policy_allowed",
      "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
      "future_executor_not_implemented",
    ]);
    const finalGoNoGoBlockers = this.unique([
      ...preflightBlockers,
      ...input.sourceReadinessReviewBlockers,
      "production_ready_false",
      "execution_allowed_now_false",
    ]);

    return [
      {
        stage: "source_import_readiness",
        status: input.sourceBlockers.length ? "blocked" : "ready",
        blockers: input.sourceBlockers,
        evidence: [
          `source_sync_records=${input.input.draftPreview.sourceSyncDecisionEvidence?.length || 0}`,
          `read_model_source_records=${input.input.foundationSnapshot.sourceEvidence.length}`,
          `source_readiness_review_export_consumed=${input.sourceReadinessSummary.source_readiness_review_export_consumed}`,
          `required_sources_ready=${input.sourceReadinessSummary.required_source_ready_count}/${input.sourceReadinessSummary.required_source_count}`,
          `required_sources_blocked=${input.sourceReadinessSummary.required_source_blocked_count}`,
          `required_sources_report_date_covered=${input.sourceReadinessSummary.required_source_report_date_covered_count}/${input.sourceReadinessSummary.required_source_count}`,
          `required_sources_report_date_blocked=${input.sourceReadinessSummary.required_source_report_date_blocked_count}`,
        ],
        next_required_action: input.sourceBlockers.length
          ? "refresh_or_complete_source_imports"
          : "review_decision_inputs",
      },
      {
        stage: "decision_inputs",
        status: input.decisionInputBlockers.length ? "blocked" : "ready",
        blockers: input.decisionInputBlockers,
        evidence: [
          `foundation_decisions=${input.input.foundationSnapshot.summary.decisions}`,
          `missing_field_evidence=${input.input.foundationSnapshot.missingFieldEvidence.length}`,
        ],
        next_required_action: input.decisionInputBlockers.length
          ? "resolve_decision_input_gaps"
          : "review_pending_actions",
      },
      {
        stage: "provider_account_readiness",
        status: input.providerReadinessBlockers.length ? "blocked" : "ready",
        blockers: input.providerReadinessBlockers,
        evidence: [
          `provider_account_readiness_status=${input.providerAccountReadiness?.summary.status || "missing"}`,
          `provider_actions_ready=${input.providerAccountReadiness?.summary.provider_actions_ready_for_future_validate_only || 0}`,
          `provider_actions_blocked=${input.providerAccountReadiness?.summary.provider_actions_blocked_before_boundary || 0}`,
          "provider_api_called=false",
        ],
        next_required_action: input.providerReadinessBlockers.length
          ? "resolve_provider_account_readiness"
          : "review_validateOnly_lane",
      },
      {
        stage: "pending_actions",
        status: input.normalization ? "ready" : "blocked",
        blockers: input.normalizationError ? [input.normalizationError] : [],
        evidence: [
          `drafts=${input.input.draftPreview.summary.drafts_created}`,
          `pending_actions=${input.normalization?.summary.pending_actions_created || 0}`,
        ],
        next_required_action: input.normalization
          ? "review_validateOnly_lane"
          : "fix_draft_or_source_gate_blockers",
      },
      {
        stage: "validate_only",
        status:
          input.sourceReadinessReviewBlockers.length || !input.normalization
            ? "blocked"
            : input.validateOnlyLane?.summary.validate_only_passed
              ? "ready"
              : input.validateOnlyLane
                ? "pending"
                : "blocked",
        blockers: validateOnlyBlockers,
        evidence: [
          `provider_actions=${input.validateOnlyLane?.summary.provider_actions_received || 0}`,
          `validate_only_passed=${input.validateOnlyLane?.summary.validate_only_passed || 0}`,
          `source_readiness_review_blockers=${input.sourceReadinessReviewBlockers.length}`,
          `mvp_provider_validateOnly_required=${input.mvpActionContractReview.provider_mvp_actions_requiring_validateOnly}`,
          `monitor_only_visible_non_executable_safety_actions=${input.mvpActionContractReview.monitor_only_mvp_safety_actions}`,
          `non_mvp_internal_actions_out_of_scope=${input.mvpActionContractReview.out_of_scope_non_provider_actions}`,
          "provider_validateOnly_lane_mocked=true",
        ],
        next_required_action: input.sourceReadinessReviewBlockers.length
          ? "resolve_source_readiness_review_blockers_before_validateOnly"
          : input.validateOnlyLane?.summary.validate_only_passed
            ? "continue_human_approval_flow"
            : "run_future_erp_validateOnly_after_adapter_exists",
      },
      {
        stage: "approval_gate",
        status: "blocked",
        blockers: ["approved_action", "policy_allowed"],
        evidence: [
          "approval_required_for_all_actions=true",
          "report_does_not_mutate_approval_status=true",
        ],
        next_required_action: "complete_human_approval_and_policy_evidence",
      },
      {
        stage: "execution_preflight",
        status: "blocked",
        blockers: preflightBlockers,
        evidence: [
          "existing_preflight_dry_run_endpoint_required_for_audit_record=true",
          "future_live_execution_allowed=false",
          "execution_allowed_now=false",
        ],
        next_required_action:
          "resolve_preflight_blockers_before_future_live_branch",
      },
      {
        stage: "final_go_no_go_readiness",
        status: "blocked",
        blockers: finalGoNoGoBlockers,
        evidence: [
          `source_readiness_review_export_consumed=${input.sourceReadinessSummary.source_readiness_review_export_consumed}`,
          `source_readiness_review_blockers=${input.sourceReadinessReviewBlockers.length}`,
          `required_sources_blocked=${input.sourceReadinessSummary.required_source_blocked_count}`,
          "future_live_execution_allowed=false",
          "execution_allowed_now=false",
          "production_ready=false",
        ],
        next_required_action: input.sourceReadinessReviewBlockers.length
          ? "resolve_source_readiness_review_blockers_before_go_no_go"
          : "complete_preflight_approval_audit_before_go_no_go",
      },
      {
        stage: "dry_run_audit",
        status: "blocked",
        blockers: ["dry_run_audit_record_not_created_by_report"],
        evidence: [
          "report_only=true",
          "persistence_used=false",
          "use_existing_execution_preflight_dry_run_endpoint_after_approval",
        ],
        next_required_action:
          "create_dry_run_audit_via_existing_preflight_endpoint_when_ready",
      },
    ];
  }

  private remainingApiPrerequisites(
    lossLimitPolicy: AdsAutomationApiReadinessGapReportInput["lossLimitPolicy"],
    providerAccountReadiness: AdsAutomationProviderAccountReadinessResponse | null,
  ): AdsAutomationApiReadinessPrerequisite[] {
    const policyStatus = lossLimitPolicy ? "contract_only" : "missing";
    const policyBlocker = lossLimitPolicy
      ? "Local loss-limit and spend-cap policy evidence exists, but live enforcement remains blocked by default."
      : "Daily/monthly loss limits and spend caps are required before live execution.";
    const providerReadinessStatus = !providerAccountReadiness
      ? "missing"
      : providerAccountReadiness.summary.status ===
          "ready_for_local_validate_only"
        ? "contract_only"
        : "partial";
    const providerReadinessBlocker = !providerAccountReadiness
      ? "Provider adapter registry, account mapping, OAuth metadata, permission scopes, and capability readiness are required before provider validateOnly or live execution."
      : providerAccountReadiness.summary.status ===
          "ready_for_local_validate_only"
        ? "Provider readiness is ERP-local contract evidence only; live execution remains blocked by default."
        : `Provider readiness has ${providerAccountReadiness.blockers.length} local blockers.`;
    return [
      {
        key: "oauth_account_readiness",
        status: providerReadinessStatus,
        required_before_live: true,
        blocker: providerReadinessBlocker,
      },
      {
        key: "readonly_import_scheduler",
        status: "partial",
        required_before_live: true,
        blocker:
          "Read-only import contracts exist, but production scheduler readiness is not proven here.",
      },
      {
        key: "provider_validateOnly_adapter",
        status: "contract_only",
        required_before_live: true,
        blocker:
          "Current validate-only lane is ERP-local mocked evidence only.",
      },
      {
        key: "approval_policy",
        status: "required_not_executed_by_report",
        required_before_live: true,
        blocker:
          "Human approval and policy evidence must be durable before preflight.",
      },
      {
        key: "production_flag",
        status: "blocked_by_default",
        required_before_live: true,
        blocker:
          "GOOGLE_ADS_PRODUCTION_ENABLED must stay false or absent in this slice.",
      },
      {
        key: "idempotency",
        status: "partial",
        required_before_live: true,
        blocker:
          "Dry-run idempotency exists; future live request replay semantics still need final approval.",
      },
      {
        key: "rollback",
        status: "partial",
        required_before_live: true,
        blocker:
          "Rollback plans are carried in drafts, but live rollback execution is not implemented.",
      },
      {
        key: "monitoring",
        status: "missing",
        required_before_live: true,
        blocker: "Live execution monitoring and alerting are not implemented.",
      },
      {
        key: "rate_limits",
        status: "missing",
        required_before_live: true,
        blocker: "Provider rate-limit handling is not implemented.",
      },
      {
        key: "spend_caps",
        status: policyStatus,
        required_before_live: true,
        blocker: policyBlocker,
      },
      {
        key: "loss_limits",
        status: policyStatus,
        required_before_live: true,
        blocker: policyBlocker,
      },
    ];
  }

  private platformEntityCoverageMarkdownLines(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
    review: AdsAutomationApiPlatformEntityCoverageReview | null,
    blockers: string[],
  ): string[] {
    if (!coverage) {
      return [
        "Platform entity coverage: none",
        "Platform entity blockers: none",
      ];
    }

    return [
      `Platform entity coverage: campaigns=${coverage.campaigns.coveredCampaignCount}, adGroups=${coverage.adGroups.coveredAdGroupCount}, metricRows=${coverage.metrics.rows}, metricRowsReady=${coverage.metrics.readyRows}`,
      `Platform campaignBudgetId: required=${coverage.campaignBudgets.campaignBudgetId_required}, noFallback=${coverage.campaignBudgets.campaignBudgetId_no_fallback}, fallbackUsed=${coverage.campaignBudgets.campaignBudgetId_fallback_used}, missingRows=${coverage.campaignBudgets.missingCampaignBudgetIdRows}`,
      `Platform product mapping: mappedProducts=${this.joinOrNone(coverage.productMapping.mappedProductIds)}, mappedAdGroups=${this.joinOrNone(coverage.productMapping.mappedAdGroupIds)}, unmappedAdGroups=${this.joinOrNone(coverage.productMapping.unmappedAdGroupIds)}, sourceReady=${coverage.productMapping.sourceReady}, blockers=${this.joinOrNone(coverage.productMapping.blockers)}`,
      `Platform inventory/profit: profitableProducts=${this.joinOrNone(coverage.inventoryProfit.profitableProductIds)}, blockedProducts=${this.joinOrNone(coverage.inventoryProfit.blockedProductIds)}, sourceReady=${coverage.inventoryProfit.sourceReady}, blockers=${this.joinOrNone(coverage.inventoryProfit.blockers)}`,
      `Platform supplier context: safeSuppliers=${this.joinOrNone(coverage.supplierContext.safeSupplierIds)}, blockedSuppliers=${this.joinOrNone(coverage.supplierContext.blockedSupplierIds)}, supplierChoiceSafe=${coverage.supplierContext.supplierChoiceSafe}, sourceReady=${coverage.supplierContext.sourceReady}, blockers=${this.joinOrNone(coverage.supplierContext.blockers)}`,
      `Platform freshness coverage: latestSuccessfulSyncAt=${coverage.freshnessCoverage.latestSuccessfulSyncAt || "none"}, latestRecordDate=${coverage.freshnessCoverage.latestRecordDate || "none"}, blockingReasons=${this.joinOrNone(coverage.freshnessCoverage.blockingReasons)}`,
      ...(review ? this.platformEntityCoverageReviewLines(review) : []),
      `Platform entity blockers: ${this.joinOrNone(blockers)}`,
    ];
  }

  private markdownPreview(input: {
    reportDate: string;
    sourceBlockers: string[];
    sourceReadinessSummary: Pick<
      AdsAutomationApiReadinessGapReportSummary,
      | "source_readiness_review_export_consumed"
      | "source_readiness_review_export_mode"
      | "source_readiness_review_export_status"
      | "required_source_count"
      | "required_source_ready_count"
      | "required_source_blocked_count"
      | "required_source_report_date_covered_count"
      | "required_source_report_date_blocked_count"
      | "missing_required_source_evidence"
      | "source_coverage_blocking_reasons"
    >;
    sourceReadinessReviewBlockers: string[];
    decisionInputBlockers: string[];
    providerReadinessBlockers: string[];
    cashflowBlockers: string[];
    baControlAnswers: AdsAutomationBaControlAnswers;
    validateOnlyLane: AdsAutomationProviderValidateOnlyLaneResponse | null;
    mvpActionContractReview: AdsAutomationProviderValidateOnlyMvpActionContractReview;
    platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage | null;
    platformEntityCoverageReview: AdsAutomationApiPlatformEntityCoverageReview | null;
    platformEntityCoverageBlockers: string[];
    platformEntityCoverageActionBlockers: AdsAutomationPlatformEntityCoverageActionBlocker[];
  }): string {
    return [
      "# Ads Automation API Readiness Gap Report",
      `Report date: ${input.reportDate}`,
      `Increase ads: ${input.baControlAnswers.increase_ads}`,
      `Increase amount VND: ${input.baControlAnswers.increase_amount_vnd}`,
      `Blocked increase amount VND: ${input.baControlAnswers.blocked_increase_amount_vnd}`,
      `Target ad groups: ${this.joinOrNone(input.baControlAnswers.target_ad_groups.map((item) => item.adGroupId))}`,
      `Products to receive budget: ${this.joinOrNone(input.baControlAnswers.products_to_receive_budget.map((item) => item.productId || ""))}`,
      `Source readiness review export consumed: ${input.sourceReadinessSummary.source_readiness_review_export_consumed}`,
      `Source readiness review mode: ${input.sourceReadinessSummary.source_readiness_review_export_mode || "none"}`,
      `Source readiness review status: ${input.sourceReadinessSummary.source_readiness_review_export_status || "none"}`,
      `Required sources: ready=${input.sourceReadinessSummary.required_source_ready_count}/${input.sourceReadinessSummary.required_source_count}, blocked=${input.sourceReadinessSummary.required_source_blocked_count}`,
      `Required report-date coverage: covered=${input.sourceReadinessSummary.required_source_report_date_covered_count}/${input.sourceReadinessSummary.required_source_count}, blocked=${input.sourceReadinessSummary.required_source_report_date_blocked_count}`,
      `Missing required source evidence: ${this.joinOrNone(input.sourceReadinessSummary.missing_required_source_evidence)}`,
      `Source coverage blocking reasons: ${this.joinOrNone(input.sourceReadinessSummary.source_coverage_blocking_reasons)}`,
      `Source readiness validateOnly blockers: ${this.joinOrNone(input.sourceReadinessReviewBlockers)}`,
      ...this.platformEntityCoverageMarkdownLines(
        input.platformEntityCoverage,
        input.platformEntityCoverageReview,
        input.platformEntityCoverageBlockers,
      ),
      `Action-scoped platform entity blockers: ${this.joinOrNone(
        input.platformEntityCoverageActionBlockers.map((blocker) =>
          [
            blocker.scope,
            blocker.campaignId || "no-campaign",
            blocker.adGroupId || "no-ad-group",
            blocker.campaignBudgetId || "no-budget",
            blocker.productId || "no-product",
            blocker.supplierId || "no-supplier",
            blocker.blocker,
          ].join(":"),
        ),
      )}`,
      `Source blockers: ${this.joinOrNone(input.sourceBlockers)}`,
      `Decision blockers: ${this.joinOrNone(input.decisionInputBlockers)}`,
      `Provider readiness blockers: ${this.joinOrNone(input.providerReadinessBlockers)}`,
      `Cashflow-first blockers: ${this.joinOrNone(input.cashflowBlockers)}`,
      `Validate-only passed: ${input.validateOnlyLane?.summary.validate_only_passed || 0}`,
      `MVP provider actions requiring future ERP validateOnly: ${input.mvpActionContractReview.provider_mvp_actions_requiring_validateOnly}`,
      `MVP monitor-only visible safety actions: ${input.mvpActionContractReview.monitor_only_mvp_safety_actions}`,
      `Non-MVP internal actions out of scope: ${input.mvpActionContractReview.out_of_scope_non_provider_actions}`,
      `MVP contract scopes: ${this.joinOrNone(input.mvpActionContractReview.action_contracts.map((item) => `${item.action_type}=${item.mvp_action_contract.action_scope}`))}`,
      "Safety gates: provider_api_used=false, google_ads_api_used=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false",
    ].join("\n");
  }

  private platformEntityCoverageReview(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
  ): AdsAutomationApiPlatformEntityCoverageReview | null {
    if (!coverage) return null;

    return {
      campaignMetricRollups: this.metricRollupLines(
        "Campaign metric rollup",
        coverage.campaigns.metricRollups,
      ),
      adGroupMetricRollups: this.metricRollupLines(
        "Ad group metric rollup",
        coverage.adGroups.metricRollups,
      ),
      campaignBudgetMetricRollups: this.metricRollupLines(
        "Campaign budget metric rollup",
        coverage.campaignBudgets.metricRollups,
      ),
      productMappings: coverage.productMapping.productMappings.map((row) =>
        this.productMappingLine(row),
      ),
      productReadiness: coverage.inventoryProfit.productReadiness.map((row) =>
        this.productReadinessLine(row),
      ),
      supplierReadiness: coverage.supplierContext.supplierReadiness.map((row) =>
        this.supplierReadinessLine(row),
      ),
    };
  }

  private platformEntityCoverageReviewLines(
    review: AdsAutomationApiPlatformEntityCoverageReview,
  ): string[] {
    return [
      ...review.campaignMetricRollups,
      ...review.adGroupMetricRollups,
      ...review.campaignBudgetMetricRollups,
      ...review.productMappings,
      ...review.productReadiness,
      ...review.supplierReadiness,
    ];
  }

  private metricRollupLines(
    label: string,
    rows: AdsAutomationReadonlyPlatformMetricEntityCoverageRow[],
  ): string[] {
    return rows.map((row) =>
      [
        `${label}: entityId=${row.entityId}`,
        `campaignIds=${this.joinOrNone(row.campaignIds)}`,
        `adGroupIds=${this.joinOrNone(row.adGroupIds)}`,
        `campaignBudgetIds=${this.joinOrNone(row.campaignBudgetIds)}`,
        `mappedProductIds=${this.joinOrNone(row.mappedProductIds)}`,
        `supplierIds=${this.joinOrNone(row.supplierIds)}`,
        `dates=${this.joinOrNone(row.dates)}`,
        `reportDateCovered=${row.reportDateCovered}`,
        `rows=${row.rows}`,
        `readyRows=${row.readyRows}`,
        `spendVnd=${row.spendVnd}`,
        `costVnd=${row.costVnd}`,
        `clicks=${row.clicks}`,
        `impressions=${row.impressions}`,
        `conversions=${row.conversions}`,
        `conversionValueVnd=${row.conversionValueVnd}`,
        `linkedDecisionTypes=${this.joinOrNone(row.linkedDecisionTypes)}`,
        `linkedDecisionEffectiveStatuses=${this.joinOrNone(row.linkedDecisionEffectiveStatuses)}`,
        `blockers=${this.joinOrNone(row.blockers)}`,
        `coveredForDecision=${row.coveredForDecision}`,
      ].join(", "),
    );
  }

  private productMappingLine(
    row: AdsAutomationReadonlyProductMappingCoverageRow,
  ): string {
    return [
      `Product mapping row: productId=${row.productId}`,
      `mappedAdGroupIds=${this.joinOrNone(row.mappedAdGroupIds)}`,
      `campaignBudgetIds=${this.joinOrNone(row.campaignBudgetIds)}`,
      `supplierIds=${this.joinOrNone(row.supplierIds)}`,
      `blockers=${this.joinOrNone(row.blockers)}`,
      `coveredForDecision=${row.coveredForDecision}`,
    ].join(", ");
  }

  private productReadinessLine(
    row: AdsAutomationReadonlyInventoryProfitCoverageRow,
  ): string {
    return [
      `Product readiness row: productId=${row.productId}`,
      `netProfitVnd=${this.nullable(row.netProfitVnd)}`,
      `adAttributedNetProfitAfterAdsVnd=${this.nullable(row.adAttributedNetProfitAfterAdsVnd)}`,
      `marginPercent=${this.nullable(row.marginPercent)}`,
      `stockAvailable=${this.nullable(row.stockAvailable)}`,
      `daysOfCover=${this.nullable(row.daysOfCover)}`,
      `canReceiveBudget=${row.canReceiveBudget}`,
      `needsKillOrStopReview=${row.needsKillOrStopReview}`,
      `blockers=${this.joinOrNone(row.blockers)}`,
      `coveredForDecision=${row.coveredForDecision}`,
    ].join(", ");
  }

  private supplierReadinessLine(
    row: AdsAutomationReadonlySupplierSafetyCoverageRow,
  ): string {
    return [
      `Supplier readiness row: supplierId=${row.supplierId}`,
      `productId=${row.productId || "none"}`,
      `quoteApproved=${this.nullable(row.quoteApproved)}`,
      `marginAfterCostPercent=${this.nullable(row.marginAfterCostPercent)}`,
      `leadTimeDays=${this.nullable(row.leadTimeDays)}`,
      `lateDeliveryRatePercent=${this.nullable(row.lateDeliveryRatePercent)}`,
      `paymentFreshnessDays=${this.nullable(row.paymentFreshnessDays)}`,
      `capacityStatus=${row.capacityStatus || "none"}`,
      `returnFaultRatePercent=${this.nullable(row.returnFaultRatePercent)}`,
      `safeForBudgetAllocation=${row.safeForBudgetAllocation}`,
      `blockers=${this.joinOrNone(row.blockers)}`,
      `coveredForDecision=${row.coveredForDecision}`,
    ].join(", ");
  }

  private allFoundationItems(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
  ): AdsAutomationDecisionFoundationSnapshotItem[] {
    return [
      ...foundationSnapshot.scale_ads_decision.candidates,
      ...foundationSnapshot.scale_amount.items,
      ...foundationSnapshot.target_ad_groups.items,
      ...foundationSnapshot.product_budget_allocation.items,
      ...foundationSnapshot.supplier_gate.safe_suppliers,
      ...foundationSnapshot.supplier_gate.review_suppliers,
      ...foundationSnapshot.product_kill_review.candidates,
      ...foundationSnapshot.campaign_or_ad_group_pause_candidates.candidates,
    ];
  }

  private providerReadinessBlockers(
    providerAccountReadiness: AdsAutomationProviderAccountReadinessResponse | null,
  ): string[] {
    if (!providerAccountReadiness) {
      return ["provider_account_readiness_missing"];
    }
    const blockers = [...providerAccountReadiness.blockers];
    if (
      providerAccountReadiness.summary.status !==
      "ready_for_local_validate_only"
    ) {
      blockers.push(
        `provider_account_readiness_status.${providerAccountReadiness.summary.status}`,
      );
    }
    if (providerAccountReadiness.safety.provider_api_called !== false) {
      blockers.push("provider_account_readiness.provider_api_called");
    }
    if (providerAccountReadiness.safety.google_ads_api_called !== false) {
      blockers.push("provider_account_readiness.google_ads_api_called");
    }
    if (providerAccountReadiness.safety.live_ads_execution_used !== false) {
      blockers.push("provider_account_readiness.live_ads_execution_used");
    }
    if (providerAccountReadiness.safety.execution_allowed_now !== false) {
      blockers.push("provider_account_readiness.execution_allowed_now");
    }
    return this.unique(blockers);
  }

  private includesAny(values: string[], needles: string[]): boolean {
    return values.some((value) =>
      needles.some((needle) => value.includes(needle)),
    );
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized : null;
  }

  private nullable(
    value: string | number | boolean | null | undefined,
  ): string {
    return value === null || value === undefined ? "none" : String(value);
  }

  private unique(values: string[]): string[] {
    return [
      ...new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    ].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return normalized.length ? normalized.join(", ") : "none";
  }
}
