import { BadRequestException, Injectable } from "@nestjs/common";
import type { AdsAutomationCategoryKey } from "./contracts/ads-automation-decision.contract";
import type {
  AdsAutomationReadonlyDecisionReadinessCandidate,
  AdsAutomationReadonlyDecisionReadinessAnswers,
  AdsAutomationReadonlyInventoryProfitCoverageRow,
  AdsAutomationReadonlyMetricReadinessRow,
  AdsAutomationReadonlyPlatformEntityCoverage,
  AdsAutomationReadonlyPlatformImportReadinessResponse,
  AdsAutomationReadonlyPlatformMetricEntityCoverageRow,
  AdsAutomationReadonlyProductMappingCoverageRow,
  AdsAutomationReadonlySupplierSafetyCoverageRow,
} from "./contracts/ads-automation-readonly-platform-import-readiness.contract";
import type {
  AdsAutomationSourceReadinessBlockerReview,
  AdsAutomationSourceReadinessCampaignBudgetEvidence,
  AdsAutomationSourceReadinessCandidateReview,
  AdsAutomationSourceReadinessConversionMetricsReview,
  AdsAutomationSourceReadinessCoverageBucket,
  AdsAutomationSourceReadinessManagerCandidateReview,
  AdsAutomationSourceReadinessMetricRollup,
  AdsAutomationSourceReadinessReviewExportInput,
  AdsAutomationSourceReadinessReviewExportResponse,
  AdsAutomationSourceReadinessReviewExportStatus,
  AdsAutomationSourceReadinessReviewRouteExample,
  AdsAutomationSourceReadinessReviewSection,
  AdsAutomationSourceReadinessSourceCoverageReview,
} from "./contracts/ads-automation-source-readiness-review-export.contract";

@Injectable()
export class AdsAutomationSourceReadinessReviewExportService {
  build(
    input: AdsAutomationSourceReadinessReviewExportInput,
  ): AdsAutomationSourceReadinessReviewExportResponse {
    if (!input?.sourceSyncStatus) {
      throw new BadRequestException("sourceSyncStatus is required");
    }
    if (!input?.readonlyImportReadiness) {
      throw new BadRequestException("readonlyImportReadiness is required");
    }

    const reportDate =
      input.reportDate ||
      input.sourceSyncStatus.reportDate ||
      input.readonlyImportReadiness.reportDate;
    const exportMode = input.exportMode || "local_payload";
    const sourceCoverage = this.sourceCoverage(input);
    const platformEntityCoverage =
      input.readonlyImportReadiness.platformEntityCoverage;
    const platformEntityBlockers = this.platformEntityBlockers(
      platformEntityCoverage,
    );
    const conversionMetrics = this.conversionMetrics(
      input.readonlyImportReadiness.metricRows,
    );
    const campaignBudgetEvidence =
      this.campaignBudgetEvidence(conversionMetrics);
    const managerCandidateReview = this.managerCandidateReview(
      input,
      conversionMetrics,
    );
    const decisionAnswerReview =
      input.readonlyImportReadiness.decisionReadiness.answers;
    const blockerReview = this.blockerReview(input, managerCandidateReview);
    const requiredSourceSummary = input.readonlyImportReadiness.summary;
    const exportStatus = this.exportStatus(
      sourceCoverage,
      conversionMetrics,
      campaignBudgetEvidence,
      blockerReview,
      input.readonlyImportReadiness.summary.status,
      input.sourceSyncStatus.summary.status,
    );
    const latestSuccessfulSyncAt = this.latestText(
      sourceCoverage.map((source) => source.lastSuccessfulSyncAt),
    );
    const latestRecordDate = this.latestText(
      sourceCoverage.map((source) => source.latestRecordDate),
    );
    const renderedSections = this.renderedSections({
      sourceCoverage,
      platformEntityCoverage,
      conversionMetrics,
      campaignBudgetEvidence,
      managerCandidateReview,
      decisionAnswerReview,
      blockerReview,
      exportStatus,
      scaleMode: input.readonlyImportReadiness.summary.scale_up_execution_mode,
      requiredSourceSummary,
    });

    return {
      schemaVersion: "ads_automation_source_readiness_review_export.v1",
      generatedAt: new Date().toISOString(),
      exportMode,
      query: {
        reportDate,
        ...(input.fixtureName ? { fixture: input.fixtureName } : {}),
      },
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        fixture_or_payload_only: true,
        source_sync_status_reused: true,
        readonly_import_readiness_reused: true,
        decision_read_model_evidence_reused: true,
        repository_write_used: false,
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
        campaignBudgetId_required: true,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
      },
      summary: {
        export_status: exportStatus,
        export_mode: exportMode,
        reportDate,
        source_sync_status: input.sourceSyncStatus.summary.status,
        readonly_import_status: input.readonlyImportReadiness.summary.status,
        source_count: sourceCoverage.length,
        fresh_source_count: sourceCoverage.filter(
          (source) => source.coverageBucket === "fresh",
        ).length,
        stale_source_count: sourceCoverage.filter(
          (source) => source.coverageBucket === "stale",
        ).length,
        missing_source_count: sourceCoverage.filter(
          (source) => source.coverageBucket === "missing",
        ).length,
        blocked_source_count: sourceCoverage.filter(
          (source) => !source.canUseForAdsAutomationDecision,
        ).length,
        required_source_count: requiredSourceSummary.required_source_count,
        required_source_ready_count:
          requiredSourceSummary.required_source_ready_count,
        required_source_blocked_count:
          requiredSourceSummary.required_source_blocked_count,
        required_source_report_date_covered_count:
          requiredSourceSummary.required_source_report_date_covered_count,
        required_source_report_date_blocked_count:
          requiredSourceSummary.required_source_report_date_blocked_count,
        missing_required_source_evidence: [
          ...requiredSourceSummary.missing_required_source_evidence,
        ],
        source_coverage_blocking_reasons: [
          ...requiredSourceSummary.source_coverage_blocking_reasons,
        ],
        latest_successful_sync_at: latestSuccessfulSyncAt,
        latest_record_date: latestRecordDate,
        total_spend_vnd: conversionMetrics.spendVnd,
        total_clicks: conversionMetrics.clicks,
        total_impressions: conversionMetrics.impressions,
        total_conversions: conversionMetrics.conversions,
        total_conversion_value_vnd: conversionMetrics.conversionValueVnd,
        platform_metric_row_count: platformEntityCoverage.metrics.rows,
        platform_metric_ready_row_count:
          platformEntityCoverage.metrics.readyRows,
        platform_campaign_count:
          platformEntityCoverage.campaigns.coveredCampaignCount,
        platform_ad_group_count:
          platformEntityCoverage.adGroups.coveredAdGroupCount,
        platform_campaignBudget_count:
          platformEntityCoverage.campaignBudgets.coveredCampaignBudgetCount,
        platform_campaignBudgetId_missing_rows:
          platformEntityCoverage.campaignBudgets.missingCampaignBudgetIdRows,
        platform_mapped_product_count:
          platformEntityCoverage.productMapping.mappedProductIds.length,
        platform_mapped_ad_group_count:
          platformEntityCoverage.productMapping.mappedAdGroupIds.length,
        platform_unmapped_ad_group_count:
          platformEntityCoverage.productMapping.unmappedAdGroupIds.length,
        platform_profitable_product_count:
          platformEntityCoverage.inventoryProfit.profitableProductIds.length,
        platform_blocked_product_count:
          platformEntityCoverage.inventoryProfit.blockedProductIds.length,
        platform_safe_supplier_count:
          platformEntityCoverage.supplierContext.safeSupplierIds.length,
        platform_blocked_supplier_count:
          platformEntityCoverage.supplierContext.blockedSupplierIds.length,
        platform_supplier_choice_safe:
          platformEntityCoverage.supplierContext.supplierChoiceSafe,
        platform_latest_successful_sync_at:
          platformEntityCoverage.freshnessCoverage.latestSuccessfulSyncAt,
        platform_latest_record_date:
          platformEntityCoverage.freshnessCoverage.latestRecordDate,
        platform_entity_blocking_reason_count: platformEntityBlockers.length,
        campaignBudgetId_missing_rows: campaignBudgetEvidence.missing_row_count,
        campaignBudgetId_required: true,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        scale_up_candidate_count:
          managerCandidateReview.scaleUpCandidates.length,
        scale_up_candidates_blocked:
          managerCandidateReview.scaleUpCandidates.filter(
            (candidate) => candidate.effectiveStatus !== "candidate_for_review",
          ).length,
        pause_candidate_count: managerCandidateReview.pauseCandidates.length,
        product_kill_candidate_count:
          managerCandidateReview.productKillCandidates.length,
        product_allocation_blocker_count:
          blockerReview.productAllocationBlockers.length,
        supplier_safety_blocker_count:
          blockerReview.supplierSafetyBlockers.length,
        cashflow_first_scale_mode:
          input.readonlyImportReadiness.summary.scale_up_execution_mode,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action:
          exportStatus === "empty"
            ? "provide_source_readiness_evidence"
            : exportStatus === "needs_attention"
              ? "resolve_source_readiness_blockers"
              : "inspect_source_readiness_review_export",
      },
      sourceCoverage,
      platformEntityCoverage,
      conversionMetrics,
      campaignBudgetEvidence,
      managerCandidateReview,
      decisionAnswerReview,
      blockerReview,
      routeExamples: this.routeExamples(),
      renderedSections,
      markdownPreview: this.markdownPreview({
        reportDate,
        exportStatus,
        sourceCoverage,
        platformEntityCoverage,
        conversionMetrics,
        campaignBudgetEvidence,
        managerCandidateReview,
        decisionAnswerReview,
        blockerReview,
        scaleMode:
          input.readonlyImportReadiness.summary.scale_up_execution_mode,
        requiredSourceSummary,
      }),
      sourceSyncStatus: input.sourceSyncStatus,
      readonlyImportReadiness: input.readonlyImportReadiness,
    };
  }

  private sourceCoverage(
    input: AdsAutomationSourceReadinessReviewExportInput,
  ): AdsAutomationSourceReadinessSourceCoverageReview[] {
    const importCoverage =
      input.readonlyImportReadiness.sourceImportCoverage || [];
    const evidenceRows = [...input.sourceSyncStatus.decisionEvidence];
    const evidenceSourceKeys = new Set(
      evidenceRows.map((evidence) => evidence.sourceKey),
    );
    for (const coverage of importCoverage) {
      if (evidenceSourceKeys.has(coverage.sourceKey)) continue;
      evidenceRows.push({
        sourceKey: coverage.sourceKey,
        reportDate: coverage.reportDate,
        freshnessStatus: coverage.freshnessStatus,
        coverageStatus: coverage.coverageStatus,
        lastSuccessfulSyncAt: coverage.lastSuccessfulSyncAt,
        latestRecordDate: coverage.latestRecordDate,
        blockingReason: coverage.blockingReason,
        blockingReasons: [...coverage.blockingReasons],
        canUseForAdsAutomationDecision: coverage.canUseForAdsAutomationDecision,
      });
      evidenceSourceKeys.add(coverage.sourceKey);
    }

    return evidenceRows.map((evidence) => {
      const sourceStatus = input.sourceSyncStatus.sources.find(
        (source) => source.sourceKey === evidence.sourceKey,
      );
      const decisionCoverage = importCoverage.find(
        (source) => source.sourceKey === evidence.sourceKey,
      );
      const freshnessStatus =
        evidence.freshnessStatus ||
        sourceStatus?.freshness.freshnessStatus ||
        "unknown";
      const coverageStatus =
        evidence.coverageStatus ||
        sourceStatus?.reportDateCoverage.coverageStatus ||
        "unknown";
      const blockingReasons = this.unique([
        ...(evidence.blockingReasons || []),
        ...(sourceStatus?.sourceSyncBlockers || []),
        ...(decisionCoverage?.blockingReasons || []),
      ]);

      return {
        sourceKey: evidence.sourceKey,
        provider: sourceStatus?.provider || null,
        platform: sourceStatus?.platform || null,
        sourceStatus: sourceStatus?.status || "unknown",
        coverageBucket: this.coverageBucket(
          freshnessStatus,
          coverageStatus,
          evidence.canUseForAdsAutomationDecision,
        ),
        freshnessStatus,
        coverageStatus,
        reportDate: evidence.reportDate,
        reportDateRecordCount:
          sourceStatus?.reportDateCoverage.reportDateRecordCount ?? null,
        lastSuccessfulSyncAt:
          evidence.lastSuccessfulSyncAt ||
          sourceStatus?.freshness.lastSuccessfulSyncAt ||
          null,
        latestRecordDate:
          evidence.latestRecordDate ||
          sourceStatus?.freshness.latestRecordDate ||
          null,
        latestSuccessfulSyncOrReadModelWatermark:
          sourceStatus?.freshness.latestSuccessfulSyncOrReadModelWatermark ||
          null,
        blockingReasons,
        affectedDecisionCategories: [
          ...(decisionCoverage?.affectedDecisionCategories ||
            this.defaultAffectedCategories(evidence.sourceKey)),
        ],
        canUseForAdsAutomationDecision:
          evidence.canUseForAdsAutomationDecision === true,
      };
    });
  }

  private conversionMetrics(
    rows: AdsAutomationReadonlyMetricReadinessRow[],
  ): AdsAutomationSourceReadinessConversionMetricsReview {
    const byAccount = this.rollups(
      rows,
      (row) => row.accountId || row.customerId || "unmapped_account",
    );
    const byAdGroup = this.rollups(
      rows,
      (row) => row.adGroupId || row.campaignId || "unmapped_ad_group",
    );
    return {
      rows: rows.length,
      readyRows: rows.filter((row) => row.canUseForAdsAutomationDecision)
        .length,
      spendVnd: this.sum(rows, "spendVnd"),
      clicks: this.sum(rows, "clicks"),
      impressions: this.sum(rows, "impressions"),
      conversions: this.sum(rows, "conversions"),
      conversionValueVnd: this.sum(rows, "conversionValueVnd"),
      campaignBudgetIdMissingRows: rows.filter((row) => !row.campaignBudgetId)
        .length,
      byAccount,
      byAdGroup,
    };
  }

  private campaignBudgetEvidence(
    conversionMetrics: AdsAutomationSourceReadinessConversionMetricsReview,
  ): AdsAutomationSourceReadinessCampaignBudgetEvidence {
    return {
      campaignBudgetId_required: true,
      no_fallback_from_campaignId_or_adGroupId: true,
      fallback_used: false,
      missing_row_count: conversionMetrics.campaignBudgetIdMissingRows,
      missing_rows: conversionMetrics.byAdGroup.filter(
        (row) => row.campaignBudgetIdMissingRows > 0,
      ),
      rule: "campaignBudgetId is required for any future budget draft; campaignId and adGroupId are not fallback budget identifiers.",
    };
  }

  private managerCandidateReview(
    input: AdsAutomationSourceReadinessReviewExportInput,
    conversionMetrics: AdsAutomationSourceReadinessConversionMetricsReview,
  ): AdsAutomationSourceReadinessManagerCandidateReview {
    const candidates =
      input.readonlyImportReadiness.decisionReadiness.candidates;
    const metricsByAdGroup = new Map(
      conversionMetrics.byAdGroup.map((row) => [row.key, row]),
    );
    return {
      scaleUpCandidates: candidates.adGroupsToIncrease.map((candidate) =>
        this.candidateReview(candidate, metricsByAdGroup),
      ),
      pauseCandidates: candidates.campaignOrAdGroupPause.map((candidate) =>
        this.candidateReview(candidate, metricsByAdGroup),
      ),
      productKillCandidates: candidates.productKillOrStopReview.map(
        (candidate) => this.candidateReview(candidate, metricsByAdGroup),
      ),
      productAllocationCandidates: candidates.productsEligibleForBudget.map(
        (candidate) => this.candidateReview(candidate, metricsByAdGroup),
      ),
      supplierSafetyCandidates: candidates.supplierChoices.map((candidate) =>
        this.candidateReview(candidate, metricsByAdGroup),
      ),
    };
  }

  private candidateReview(
    candidate: AdsAutomationReadonlyDecisionReadinessCandidate,
    metricsByAdGroup: Map<string, AdsAutomationSourceReadinessMetricRollup>,
  ): AdsAutomationSourceReadinessCandidateReview {
    const metrics = metricsByAdGroup.get(candidate.entityId) || null;
    return {
      decisionType: candidate.decisionType,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      platform: candidate.platform,
      accountId: candidate.accountId,
      productId: candidate.productId,
      supplierId: candidate.supplierId,
      status: candidate.status,
      effectiveStatus: candidate.effectiveStatus,
      proposedAction: candidate.proposedAction,
      campaignBudgetId: candidate.campaignBudgetId,
      currentBudgetVnd: candidate.currentBudgetVnd,
      proposedBudgetVnd: candidate.proposedBudgetVnd,
      increaseVnd: candidate.increaseVnd,
      conversions: metrics?.conversions ?? null,
      conversionValueVnd: metrics?.conversionValueVnd ?? null,
      blockers: [...candidate.blockers],
      missingFields: [...candidate.missingFields],
      approval_required: true,
      execution_allowed_now: false,
    };
  }

  private blockerReview(
    input: AdsAutomationSourceReadinessReviewExportInput,
    candidates: AdsAutomationSourceReadinessManagerCandidateReview,
  ): AdsAutomationSourceReadinessBlockerReview {
    const decisionReadiness = input.readonlyImportReadiness.decisionReadiness;
    const sourceBlockers = this.unique([
      ...input.sourceSyncStatus.decisionEvidence.flatMap(
        (source) => source.blockingReasons || [],
      ),
      ...decisionReadiness.source_gate_blockers,
      ...decisionReadiness.source_to_decision_blockers.flatMap(
        (source) => source.blockingReasons,
      ),
    ]);
    const productAllocationBlockers = this.unique([
      ...candidates.productAllocationCandidates.flatMap(
        (candidate) => candidate.blockers,
      ),
      ...decisionReadiness.source_to_decision_blockers
        .filter((source) =>
          source.blockedCategories.includes("product_budget_allocation"),
        )
        .flatMap((source) => source.blockingReasons),
      ...decisionReadiness.read_model_blockers.filter(
        (blocker) =>
          blocker.includes("product") || blocker.includes("inventory"),
      ),
    ]);
    const supplierSafetyBlockers = this.unique([
      ...candidates.supplierSafetyCandidates.flatMap(
        (candidate) => candidate.blockers,
      ),
      ...decisionReadiness.source_to_decision_blockers
        .filter((source) => source.blockedCategories.includes("supplier_gate"))
        .flatMap((source) => source.blockingReasons),
      ...decisionReadiness.cashflow_blockers.filter((blocker) =>
        blocker.includes("supplier"),
      ),
    ]);
    const cashflowFirstBlockers = this.unique([
      ...input.readonlyImportReadiness.cashflowFirstGate.blockers,
      ...decisionReadiness.cashflow_blockers,
    ]);
    const readonlyImportBlockers = this.unique(
      decisionReadiness.readonly_import_blockers,
    );
    const readModelBlockers = this.unique(
      decisionReadiness.read_model_blockers,
    );

    return {
      sourceBlockers,
      readonlyImportBlockers,
      readModelBlockers,
      productAllocationBlockers,
      supplierSafetyBlockers,
      cashflowFirstBlockers,
      globalBlockers: this.unique([
        ...input.readonlyImportReadiness.blockers,
        ...sourceBlockers,
        ...readonlyImportBlockers,
        ...readModelBlockers,
        ...productAllocationBlockers,
        ...supplierSafetyBlockers,
        ...cashflowFirstBlockers,
      ]),
    };
  }

  private renderedSections(input: {
    sourceCoverage: AdsAutomationSourceReadinessSourceCoverageReview[];
    platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage;
    conversionMetrics: AdsAutomationSourceReadinessConversionMetricsReview;
    campaignBudgetEvidence: AdsAutomationSourceReadinessCampaignBudgetEvidence;
    managerCandidateReview: AdsAutomationSourceReadinessManagerCandidateReview;
    decisionAnswerReview: AdsAutomationReadonlyDecisionReadinessAnswers;
    blockerReview: AdsAutomationSourceReadinessBlockerReview;
    exportStatus: AdsAutomationSourceReadinessReviewExportStatus;
    scaleMode: "monitor_only" | "pending_validation";
    requiredSourceSummary: AdsAutomationReadonlyPlatformImportReadinessResponse["summary"];
  }): AdsAutomationSourceReadinessReviewSection[] {
    return [
      {
        section_id: "source_coverage",
        title: "Source Coverage",
        status: input.sourceCoverage.some(
          (source) => source.coverageBucket !== "fresh",
        )
          ? "attention"
          : input.sourceCoverage.length
            ? "ready_for_review"
            : "empty",
        lines: input.sourceCoverage.length
          ? [
              ...this.requiredSourceSummaryLines(input.requiredSourceSummary),
              ...input.sourceCoverage.map((source) =>
                [
                  `${source.sourceKey}: ${source.coverageBucket}`,
                  `freshness=${source.freshnessStatus}`,
                  `coverage=${source.coverageStatus}`,
                  `lastSuccessfulSyncAt=${source.lastSuccessfulSyncAt || "none"}`,
                  `latestRecordDate=${source.latestRecordDate || "none"}`,
                  `blockers=${this.joinOrNone(source.blockingReasons)}`,
                ].join(", "),
              ),
            ]
          : [
              ...this.requiredSourceSummaryLines(input.requiredSourceSummary),
              "No source coverage evidence was provided.",
            ],
        evidence_record_ids: input.sourceCoverage.map(
          (source) => source.sourceKey,
        ),
      },
      {
        section_id: "platform_entity_coverage",
        title: "Platform Entity Coverage",
        status: this.platformEntityStatus(input.platformEntityCoverage),
        lines: this.platformEntityLines(input.platformEntityCoverage),
        evidence_record_ids: this.unique([
          ...input.platformEntityCoverage.campaigns.campaignIds,
          ...input.platformEntityCoverage.adGroups.adGroupIds,
          ...input.platformEntityCoverage.campaignBudgets.campaignBudgetIds,
          ...input.platformEntityCoverage.productMapping.mappedProductIds,
          ...input.platformEntityCoverage.productMapping.unmappedAdGroupIds,
          ...input.platformEntityCoverage.inventoryProfit.blockedProductIds,
          ...input.platformEntityCoverage.supplierContext.safeSupplierIds,
          ...input.platformEntityCoverage.supplierContext.blockedSupplierIds,
        ]),
      },
      {
        section_id: "conversion_metrics",
        title: "Conversion Metrics",
        status: input.conversionMetrics.rows ? "ready_for_review" : "empty",
        lines: [
          `Rows: ${input.conversionMetrics.rows}`,
          `Spend VND: ${input.conversionMetrics.spendVnd}`,
          `Clicks: ${input.conversionMetrics.clicks}`,
          `Impressions: ${input.conversionMetrics.impressions}`,
          `Conversions: ${input.conversionMetrics.conversions}`,
          `Conversion value VND: ${input.conversionMetrics.conversionValueVnd}`,
        ],
        evidence_record_ids: input.conversionMetrics.byAdGroup.map(
          (row) => row.key,
        ),
      },
      {
        section_id: "campaign_budget_join",
        title: "Campaign Budget Join",
        status: input.campaignBudgetEvidence.missing_row_count
          ? "attention"
          : "passed",
        lines: [
          `Missing campaignBudgetId rows: ${input.campaignBudgetEvidence.missing_row_count}`,
          input.campaignBudgetEvidence.rule,
          "campaignBudgetId_fallback_used=false",
        ],
        evidence_record_ids: input.campaignBudgetEvidence.missing_rows.map(
          (row) => row.key,
        ),
      },
      {
        section_id: "manager_candidates",
        title: "Manager Candidates",
        status:
          input.managerCandidateReview.scaleUpCandidates.length ||
          input.managerCandidateReview.pauseCandidates.length ||
          input.managerCandidateReview.productKillCandidates.length
            ? "ready_for_review"
            : "empty",
        lines: [
          `Scale-up candidates: ${input.managerCandidateReview.scaleUpCandidates.length}`,
          `Pause candidates: ${input.managerCandidateReview.pauseCandidates.length}`,
          `Product kill/stop-review candidates: ${input.managerCandidateReview.productKillCandidates.length}`,
          `Product allocation candidates: ${input.managerCandidateReview.productAllocationCandidates.length}`,
          `Supplier safety candidates: ${input.managerCandidateReview.supplierSafetyCandidates.length}`,
          `Cashflow-first scale mode: ${input.scaleMode}`,
        ],
        evidence_record_ids: [
          ...input.managerCandidateReview.scaleUpCandidates,
          ...input.managerCandidateReview.pauseCandidates,
          ...input.managerCandidateReview.productKillCandidates,
        ].map((candidate) => candidate.entityId),
      },
      {
        section_id: "decision_answers",
        title: "Decision Answers",
        status: input.decisionAnswerReview.blocking_reasons.length
          ? "attention"
          : input.decisionAnswerReview.may_increase_ads ||
              input.decisionAnswerReview
                .campaign_or_ad_group_pause_recommended ||
              input.decisionAnswerReview.product_kill_or_stop_review_needed
            ? "ready_for_review"
            : "empty",
        lines: this.decisionAnswerLines(input.decisionAnswerReview),
        evidence_record_ids: this.unique(
          [
            ...input.decisionAnswerReview.ad_groups_to_increase,
            ...input.decisionAnswerReview.products_can_receive_budget,
            ...input.decisionAnswerReview.blocked_product_budget_candidates,
            ...input.decisionAnswerReview.safe_supplier_choices,
            ...input.decisionAnswerReview.blocked_supplier_choices,
            ...input.decisionAnswerReview.product_kill_or_stop_review,
            ...input.decisionAnswerReview.campaign_or_ad_group_pause,
          ].map((candidate) => candidate.entityId),
        ),
      },
      {
        section_id: "blockers",
        title: "Blockers",
        status: input.blockerReview.globalBlockers.length
          ? "attention"
          : "passed",
        lines: [
          `Source blockers: ${this.joinOrNone(input.blockerReview.sourceBlockers)}`,
          `Product allocation blockers: ${this.joinOrNone(input.blockerReview.productAllocationBlockers)}`,
          `Supplier safety blockers: ${this.joinOrNone(input.blockerReview.supplierSafetyBlockers)}`,
          `Cashflow-first blockers: ${this.joinOrNone(input.blockerReview.cashflowFirstBlockers)}`,
        ],
        evidence_record_ids: [],
      },
      {
        section_id: "safety_gates",
        title: "Safety Gates",
        status: "passed",
        lines: [
          "provider_api_called=false",
          "google_ads_api_called=false",
          "validateOnly_called=false",
          "live_ads_execution_used=false",
          "erp_mutation_used=false",
          "payment_mutation_used=false",
          "order_mutation_used=false",
          "inventory_mutation_used=false",
          "execution_allowed_now=false",
          "production_ready=false",
        ],
        evidence_record_ids: [],
      },
    ];
  }

  private markdownPreview(input: {
    reportDate: string;
    exportStatus: AdsAutomationSourceReadinessReviewExportStatus;
    sourceCoverage: AdsAutomationSourceReadinessSourceCoverageReview[];
    platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage;
    conversionMetrics: AdsAutomationSourceReadinessConversionMetricsReview;
    campaignBudgetEvidence: AdsAutomationSourceReadinessCampaignBudgetEvidence;
    managerCandidateReview: AdsAutomationSourceReadinessManagerCandidateReview;
    decisionAnswerReview: AdsAutomationReadonlyDecisionReadinessAnswers;
    blockerReview: AdsAutomationSourceReadinessBlockerReview;
    scaleMode: "monitor_only" | "pending_validation";
    requiredSourceSummary: AdsAutomationReadonlyPlatformImportReadinessResponse["summary"];
  }): string {
    return [
      "# Ads Automation Source Readiness Review Export",
      `Report date: ${input.reportDate}`,
      `Export status: ${input.exportStatus}`,
      `Source coverage: ${input.sourceCoverage.map((source) => `${source.sourceKey}:${source.coverageBucket}`).join(", ") || "none"}`,
      ...this.requiredSourceSummaryLines(input.requiredSourceSummary),
      `Latest successful sync: ${this.latestText(input.sourceCoverage.map((source) => source.lastSuccessfulSyncAt)) || "none"}`,
      `Latest record date: ${this.latestText(input.sourceCoverage.map((source) => source.latestRecordDate)) || "none"}`,
      `Platform entity coverage: campaigns=${input.platformEntityCoverage.campaigns.coveredCampaignCount}, adGroups=${input.platformEntityCoverage.adGroups.coveredAdGroupCount}, metricRows=${input.platformEntityCoverage.metrics.rows}, metricRowsReady=${input.platformEntityCoverage.metrics.readyRows}`,
      `Platform campaignBudgetId: required=${input.platformEntityCoverage.campaignBudgets.campaignBudgetId_required}, noFallback=${input.platformEntityCoverage.campaignBudgets.campaignBudgetId_no_fallback}, fallbackUsed=${input.platformEntityCoverage.campaignBudgets.campaignBudgetId_fallback_used}, missingRows=${input.platformEntityCoverage.campaignBudgets.missingCampaignBudgetIdRows}`,
      `Platform product mapping: mappedProducts=${this.joinOrNone(input.platformEntityCoverage.productMapping.mappedProductIds)}, mappedAdGroups=${this.joinOrNone(input.platformEntityCoverage.productMapping.mappedAdGroupIds)}, unmappedAdGroups=${this.joinOrNone(input.platformEntityCoverage.productMapping.unmappedAdGroupIds)}, sourceReady=${input.platformEntityCoverage.productMapping.sourceReady}, blockers=${this.joinOrNone(input.platformEntityCoverage.productMapping.blockers)}`,
      `Platform inventory/profit: profitableProducts=${this.joinOrNone(input.platformEntityCoverage.inventoryProfit.profitableProductIds)}, blockedProducts=${this.joinOrNone(input.platformEntityCoverage.inventoryProfit.blockedProductIds)}, sourceReady=${input.platformEntityCoverage.inventoryProfit.sourceReady}, blockers=${this.joinOrNone(input.platformEntityCoverage.inventoryProfit.blockers)}`,
      `Platform supplier context: safeSuppliers=${this.joinOrNone(input.platformEntityCoverage.supplierContext.safeSupplierIds)}, blockedSuppliers=${this.joinOrNone(input.platformEntityCoverage.supplierContext.blockedSupplierIds)}, supplierChoiceSafe=${input.platformEntityCoverage.supplierContext.supplierChoiceSafe}, sourceReady=${input.platformEntityCoverage.supplierContext.sourceReady}, blockers=${this.joinOrNone(input.platformEntityCoverage.supplierContext.blockers)}`,
      `Platform freshness coverage: latestSuccessfulSyncAt=${input.platformEntityCoverage.freshnessCoverage.latestSuccessfulSyncAt || "none"}, latestRecordDate=${input.platformEntityCoverage.freshnessCoverage.latestRecordDate || "none"}, blockingReasons=${this.joinOrNone(input.platformEntityCoverage.freshnessCoverage.blockingReasons)}`,
      ...this.platformEntityRowLines(input.platformEntityCoverage),
      `Conversions: ${input.conversionMetrics.conversions}`,
      `Conversion value VND: ${input.conversionMetrics.conversionValueVnd}`,
      `Campaign budget issue: ${input.campaignBudgetEvidence.missing_row_count ? `missing campaignBudgetId rows=${input.campaignBudgetEvidence.missing_row_count}` : "none"}`,
      "Campaign budget rule: campaignBudgetId is required; campaignId/adGroupId are not fallback budget IDs; campaignBudgetId_fallback_used=false",
      `Scale-up candidates: ${input.managerCandidateReview.scaleUpCandidates.length}`,
      `Pause candidates: ${input.managerCandidateReview.pauseCandidates.length}`,
      `Product kill/stop-review candidates: ${input.managerCandidateReview.productKillCandidates.length}`,
      ...this.decisionAnswerLines(input.decisionAnswerReview),
      `Product allocation blockers: ${this.joinOrNone(input.blockerReview.productAllocationBlockers)}`,
      `Supplier safety blockers: ${this.joinOrNone(input.blockerReview.supplierSafetyBlockers)}`,
      `Cashflow-first scale mode: ${input.scaleMode}`,
      "Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false",
    ].join("\n");
  }

  private platformEntityStatus(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage,
  ): AdsAutomationSourceReadinessReviewSection["status"] {
    if (!coverage.metrics.rows) return "empty";
    return this.platformEntityBlockers(coverage).length
      ? "attention"
      : "ready_for_review";
  }

  private platformEntityLines(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage,
  ): string[] {
    return [
      [
        `Metrics rows=${coverage.metrics.rows}`,
        `readyRows=${coverage.metrics.readyRows}`,
        `spendVnd=${coverage.metrics.spendVnd}`,
        `costVnd=${coverage.metrics.costVnd}`,
        `clicks=${coverage.metrics.clicks}`,
        `impressions=${coverage.metrics.impressions}`,
        `conversions=${coverage.metrics.conversions}`,
        `conversionValueVnd=${coverage.metrics.conversionValueVnd}`,
      ].join(", "),
      [
        `Campaigns covered=${coverage.campaigns.coveredCampaignCount}`,
        `campaignIds=${this.joinOrNone(coverage.campaigns.campaignIds)}`,
        `missingCampaignIdRows=${coverage.campaigns.missingCampaignIdRows}`,
        `blockers=${this.joinOrNone(coverage.campaigns.blockers)}`,
      ].join(", "),
      [
        `Ad groups covered=${coverage.adGroups.coveredAdGroupCount}`,
        `adGroupIds=${this.joinOrNone(coverage.adGroups.adGroupIds)}`,
        `missingAdGroupIdRows=${coverage.adGroups.missingAdGroupIdRows}`,
        `blockers=${this.joinOrNone(coverage.adGroups.blockers)}`,
      ].join(", "),
      [
        `Campaign budgets covered=${coverage.campaignBudgets.coveredCampaignBudgetCount}`,
        `campaignBudgetIds=${this.joinOrNone(coverage.campaignBudgets.campaignBudgetIds)}`,
        `missingCampaignBudgetIdRows=${coverage.campaignBudgets.missingCampaignBudgetIdRows}`,
        `campaignBudgetId_required=${coverage.campaignBudgets.campaignBudgetId_required}`,
        `campaignBudgetId_no_fallback=${coverage.campaignBudgets.campaignBudgetId_no_fallback}`,
        `campaignBudgetId_fallback_used=${coverage.campaignBudgets.campaignBudgetId_fallback_used}`,
        `blockers=${this.joinOrNone(coverage.campaignBudgets.blockers)}`,
      ].join(", "),
      [
        `Product mapping mappedProductIds=${this.joinOrNone(coverage.productMapping.mappedProductIds)}`,
        `mappedAdGroupIds=${this.joinOrNone(coverage.productMapping.mappedAdGroupIds)}`,
        `unmappedAdGroupIds=${this.joinOrNone(coverage.productMapping.unmappedAdGroupIds)}`,
        `sourceReady=${coverage.productMapping.sourceReady}`,
        `coveredForDecision=${coverage.productMapping.coveredForDecision}`,
        `blockers=${this.joinOrNone(coverage.productMapping.blockers)}`,
      ].join(", "),
      [
        `Inventory/profit profitableProductIds=${this.joinOrNone(coverage.inventoryProfit.profitableProductIds)}`,
        `blockedProductIds=${this.joinOrNone(coverage.inventoryProfit.blockedProductIds)}`,
        `sourceReady=${coverage.inventoryProfit.sourceReady}`,
        `coveredForDecision=${coverage.inventoryProfit.coveredForDecision}`,
        `blockers=${this.joinOrNone(coverage.inventoryProfit.blockers)}`,
      ].join(", "),
      [
        `Supplier context safeSupplierIds=${this.joinOrNone(coverage.supplierContext.safeSupplierIds)}`,
        `blockedSupplierIds=${this.joinOrNone(coverage.supplierContext.blockedSupplierIds)}`,
        `supplierChoiceSafe=${coverage.supplierContext.supplierChoiceSafe}`,
        `sourceReady=${coverage.supplierContext.sourceReady}`,
        `coveredForDecision=${coverage.supplierContext.coveredForDecision}`,
        `blockers=${this.joinOrNone(coverage.supplierContext.blockers)}`,
      ].join(", "),
      [
        `Freshness latestSuccessfulSyncAt=${coverage.freshnessCoverage.latestSuccessfulSyncAt || "none"}`,
        `latestRecordDate=${coverage.freshnessCoverage.latestRecordDate || "none"}`,
        `blockingReasons=${this.joinOrNone(coverage.freshnessCoverage.blockingReasons)}`,
      ].join(", "),
      ...this.platformEntityRowLines(coverage),
    ];
  }

  private platformEntityRowLines(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage,
  ): string[] {
    return [
      ...this.metricRollupLines(
        "Campaign metric rollup",
        coverage.campaigns.metricRollups,
      ),
      ...this.metricRollupLines(
        "Ad group metric rollup",
        coverage.adGroups.metricRollups,
      ),
      ...this.metricRollupLines(
        "Campaign budget metric rollup",
        coverage.campaignBudgets.metricRollups,
      ),
      ...coverage.productMapping.productMappings.map((row) =>
        this.productMappingLine(row),
      ),
      ...coverage.inventoryProfit.productReadiness.map((row) =>
        this.productReadinessLine(row),
      ),
      ...coverage.supplierContext.supplierReadiness.map((row) =>
        this.supplierReadinessLine(row),
      ),
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

  private platformEntityBlockers(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage,
  ): string[] {
    return this.unique([
      ...coverage.campaigns.blockers,
      ...coverage.adGroups.blockers,
      ...coverage.campaignBudgets.blockers,
      ...coverage.productMapping.blockers,
      ...coverage.inventoryProfit.blockers,
      ...coverage.supplierContext.blockers,
      ...coverage.freshnessCoverage.blockingReasons,
      ...(coverage.campaigns.missingCampaignIdRows
        ? ["campaignId_missing_rows"]
        : []),
      ...(coverage.adGroups.missingAdGroupIdRows
        ? ["adGroupId_missing_rows"]
        : []),
      ...(coverage.campaignBudgets.missingCampaignBudgetIdRows
        ? ["campaignBudgetId_missing_no_fallback"]
        : []),
      ...(coverage.productMapping.coveredForDecision
        ? []
        : ["product_mapping_not_covered_for_decision"]),
      ...(coverage.inventoryProfit.coveredForDecision
        ? []
        : ["inventory_profit_not_covered_for_decision"]),
      ...(coverage.supplierContext.coveredForDecision
        ? []
        : ["supplier_context_not_covered_for_decision"]),
    ]);
  }

  private routeExamples(): AdsAutomationSourceReadinessReviewRouteExample[] {
    return [
      {
        label: "Source readiness review export",
        method: "POST",
        path: "/ai/ads-automation/source-readiness-review-export",
        purpose:
          "Render a manager-reviewable source readiness artifact from local source sync, readonly import, and decision read-model evidence.",
        provider_api_called: false,
        erp_mutation_used: false,
      },
      {
        label: "ERP source import readiness review export",
        method: "POST",
        path: "/ai/ads-automation/erp-source-import-readiness-review-export",
        purpose:
          "Build ERP source import readiness through the read-only bridge, then render reviewer-safe source readiness evidence.",
        provider_api_called: false,
        erp_mutation_used: false,
      },
      {
        label: "Source readiness demo fixture",
        method: "POST",
        path: "/ai/ads-automation/source-readiness-review-export",
        purpose:
          "Pass fixture=htx_ads_source_readiness_review_demo for a local no-provider demo payload.",
        provider_api_called: false,
        erp_mutation_used: false,
      },
    ];
  }

  private requiredSourceSummaryLines(
    summary: AdsAutomationReadonlyPlatformImportReadinessResponse["summary"],
  ): string[] {
    return [
      `Required sources: ready=${summary.required_source_ready_count}/${summary.required_source_count}, blocked=${summary.required_source_blocked_count}`,
      `Required report-date coverage: covered=${summary.required_source_report_date_covered_count}/${summary.required_source_count}, blocked=${summary.required_source_report_date_blocked_count}`,
      `Missing required source evidence: ${this.joinOrNone(summary.missing_required_source_evidence)}`,
      `Source coverage blockers: ${this.joinOrNone(summary.source_coverage_blocking_reasons)}`,
    ];
  }

  private exportStatus(
    sourceCoverage: AdsAutomationSourceReadinessSourceCoverageReview[],
    conversionMetrics: AdsAutomationSourceReadinessConversionMetricsReview,
    campaignBudgetEvidence: AdsAutomationSourceReadinessCampaignBudgetEvidence,
    blockerReview: AdsAutomationSourceReadinessBlockerReview,
    readonlyImportStatus: string,
    sourceSyncStatus: string,
  ): AdsAutomationSourceReadinessReviewExportStatus {
    if (!sourceCoverage.length && !conversionMetrics.rows) {
      return "empty";
    }
    if (
      sourceSyncStatus === "blocked" ||
      readonlyImportStatus === "blocked" ||
      campaignBudgetEvidence.missing_row_count > 0 ||
      sourceCoverage.some((source) => source.coverageBucket !== "fresh")
    ) {
      return "needs_attention";
    }
    return "ready_for_review";
  }

  private coverageBucket(
    freshnessStatus: string,
    coverageStatus: string,
    canUseForAdsAutomationDecision: boolean,
  ): AdsAutomationSourceReadinessCoverageBucket {
    if (
      canUseForAdsAutomationDecision &&
      freshnessStatus === "fresh" &&
      ["covered", "not_applicable"].includes(coverageStatus)
    ) {
      return "fresh";
    }
    if (freshnessStatus === "stale") return "stale";
    if (
      freshnessStatus === "missing" ||
      coverageStatus === "missing" ||
      coverageStatus === "no_records_for_report_date"
    ) {
      return "missing";
    }
    return "unknown";
  }

  private rollups(
    rows: AdsAutomationReadonlyMetricReadinessRow[],
    keyFn: (row: AdsAutomationReadonlyMetricReadinessRow) => string,
  ): AdsAutomationSourceReadinessMetricRollup[] {
    const groups = new Map<string, AdsAutomationReadonlyMetricReadinessRow[]>();
    for (const row of rows) {
      const key = keyFn(row);
      groups.set(key, [...(groups.get(key) || []), row]);
    }

    return [...groups.entries()].map(([key, group]) => ({
      key,
      accountId: group.find((row) => row.accountId)?.accountId || null,
      customerId: group.find((row) => row.customerId)?.customerId || null,
      campaignId: group.find((row) => row.campaignId)?.campaignId || null,
      adGroupId: group.find((row) => row.adGroupId)?.adGroupId || null,
      campaignBudgetId:
        group.find((row) => row.campaignBudgetId)?.campaignBudgetId || null,
      rows: group.length,
      spendVnd: this.sum(group, "spendVnd"),
      clicks: this.sum(group, "clicks"),
      impressions: this.sum(group, "impressions"),
      conversions: this.sum(group, "conversions"),
      conversionValueVnd: this.sum(group, "conversionValueVnd"),
      campaignBudgetIdMissingRows: group.filter((row) => !row.campaignBudgetId)
        .length,
    }));
  }

  private defaultAffectedCategories(
    sourceKey: string,
  ): AdsAutomationCategoryKey[] {
    if (sourceKey === "supplier_safety")
      return ["supplier_gate", "product_budget_allocation"];
    if (sourceKey === "product_mapping" || sourceKey === "inventory_profit") {
      return [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "product_budget_allocation",
        "product_kill_or_stop_review",
      ];
    }
    return [
      "scale_ads",
      "scale_amount",
      "target_ad_groups",
      "campaign_or_ad_group_pause",
    ];
  }

  private sum(
    rows: AdsAutomationReadonlyMetricReadinessRow[],
    key: keyof AdsAutomationReadonlyMetricReadinessRow,
  ): number {
    return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
  }

  private decisionAnswerLines(
    answers: AdsAutomationReadonlyDecisionReadinessAnswers,
  ): string[] {
    return [
      `may_increase_ads=${answers.may_increase_ads}`,
      `max_increase_vnd=${answers.max_increase_vnd}`,
      `ad_groups_to_increase=${this.candidateIds(answers.ad_groups_to_increase)}`,
      `products_can_receive_budget=${this.candidateIds(answers.products_can_receive_budget)}`,
      `blocked_product_budget_candidates=${this.candidateIds(answers.blocked_product_budget_candidates)}`,
      `safe_supplier_choices=${this.candidateIds(answers.safe_supplier_choices)}`,
      `blocked_supplier_choices=${this.candidateIds(answers.blocked_supplier_choices)}`,
      `product_kill_or_stop_review_needed=${answers.product_kill_or_stop_review_needed}`,
      `campaign_or_ad_group_pause_recommended=${answers.campaign_or_ad_group_pause_recommended}`,
      `blocking_reasons=${this.joinOrNone(answers.blocking_reasons)}`,
      "execution_allowed_now=false",
    ];
  }

  private candidateIds(
    candidates: AdsAutomationReadonlyDecisionReadinessCandidate[],
  ): string {
    return this.joinOrNone(candidates.map((candidate) => candidate.entityId));
  }

  private latestText(values: Array<string | null | undefined>): string | null {
    const normalized = values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .sort();
    return normalized[normalized.length - 1] || null;
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
