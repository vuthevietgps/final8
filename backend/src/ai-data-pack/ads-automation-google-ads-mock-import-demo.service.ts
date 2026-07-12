import { Injectable } from '@nestjs/common';
import { ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE } from './ads-automation-google-ads-mock-import-demo.fixture';
import { AdsAutomationDecisionDraftPreviewService } from './ads-automation-decision-draft-preview.service';
import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationPendingErpActionNormalizerService } from './ads-automation-pending-erp-action-normalizer.service';
import { AdsAutomationProviderValidateOnlyPlannerService } from './ads-automation-provider-validate-only-planner.service';
import { AdsAutomationReadonlyPlatformImportReadinessService } from './ads-automation-readonly-platform-import-readiness.service';
import type {
  AdsAutomationCampaignBudgetReadRow,
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelRepository,
} from './contracts/ads-automation-decision-read-model-query.contract';
import type {
  AdsAutomationAdGroupReadRow,
  AdsAutomationCashflowPolicyReadRow,
  AdsAutomationDecisionSourceAdapterInput,
  AdsAutomationDecisionSourceKey,
  AdsAutomationProductReadRow,
  AdsAutomationSupplierReadRow,
} from './contracts/ads-automation-decision-source-adapter.contract';
import type {
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './contracts/ads-automation-decision-draft-preview.contract';
import type {
  AdsAutomationGoogleAdsMockImportAlertRollbackEvidence,
  AdsAutomationGoogleAdsMockImportApprovalEvidence,
  AdsAutomationGoogleAdsMockImportDemoInput,
  AdsAutomationGoogleAdsMockImportDemoResponse,
  AdsAutomationGoogleAdsMockImportDryRunAuditRecord,
  AdsAutomationGoogleAdsMockImportErpMappingEvidence,
  AdsAutomationGoogleAdsMockImportNormalizedRow,
  AdsAutomationGoogleAdsMockImportOrderProfitInput,
  AdsAutomationGoogleAdsMockImportProductInput,
  AdsAutomationGoogleAdsMockImportValidateOnlyPreflight,
  AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate,
} from './contracts/ads-automation-google-ads-mock-import-demo.contract';
import type {
  AdsAutomationPendingErpActionNormalizationResponse,
  AdsAutomationPendingErpDecisionAnswers,
  AdsAutomationPendingErpActionRecord,
} from './contracts/ads-automation-pending-erp-action.contract';
import type {
  AdsAutomationPlatformSourceSyncStatusResponse,
  AdsAutomationPlatformSourceSyncStatusSourceKey,
} from './contracts/ads-automation-platform-source-sync-status.contract';
import type {
  AdsAutomationProviderValidateOnlyActionPlan,
  AdsAutomationProviderValidateOnlyMockResult,
} from './contracts/ads-automation-provider-validate-only.contract';
import type {
  AdsAutomationReadonlyPlatformImportReadinessInput,
} from './contracts/ads-automation-readonly-platform-import-readiness.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from './source-sync/source-sync-result.types';

const SOURCE_KEYS = [
  'google_ads',
  'advertising_costs',
  'product_mapping',
  'inventory_profit',
  'supplier_safety',
] as const;

type AdsAutomationGoogleAdsMockImportSourceKey = typeof SOURCE_KEYS[number];

@Injectable()
export class AdsAutomationGoogleAdsMockImportDemoService {
  constructor(
    private readonly importReadinessService: AdsAutomationReadonlyPlatformImportReadinessService,
    private readonly readModelQueryService: AdsAutomationDecisionReadModelQueryService,
    private readonly decisionService: AdsAutomationDecisionService,
    private readonly draftPreviewService: AdsAutomationDecisionDraftPreviewService,
    private readonly pendingActionNormalizer: AdsAutomationPendingErpActionNormalizerService,
    private readonly validateOnlyPlanner: AdsAutomationProviderValidateOnlyPlannerService,
  ) {}

  async build(
    input: AdsAutomationGoogleAdsMockImportDemoInput = ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE,
  ): Promise<AdsAutomationGoogleAdsMockImportDemoResponse> {
    const fixture = this.cloneJson(input);
    const generatedAt = new Date().toISOString();
    const normalizedImportRows = this.normalizedRows(fixture);
    const query = this.query(fixture);
    const readModelInput = this.decisionReadModelInput(fixture, normalizedImportRows);
    const decisionReadModel = await this.readModelQueryService.buildFromRepository(
      this.repository(fixture, normalizedImportRows),
      query,
    );
    const sourceSyncStatus = this.sourceSyncStatus(fixture, normalizedImportRows);
    const importReadiness = this.importReadinessService.build(
      this.importReadinessInput(
        fixture,
        normalizedImportRows,
        readModelInput,
        sourceSyncStatus,
      ),
    );
    const decisionSnapshot = this.decisionService.build(decisionReadModel.snapshotInput);
    const sourceSyncDecisionEvidence = importReadiness.decisionReadiness.required_source_evidence;
    const sourceSyncDecisionGates = this.sourceSyncDecisionGates(
      sourceSyncStatus,
      importReadiness.summary.scale_up_execution_mode,
    );
    const draftPreview = this.draftPreviewService.build(decisionSnapshot, {
      source: 'mongo_read_model',
      query,
      sourceEvidence: decisionReadModel.sourceEvidence,
      missingFieldEvidence: decisionReadModel.missingFieldEvidence,
      queryEvidence: decisionReadModel.queryEvidence,
      sourceSyncDecisionEvidence,
      sourceSyncDecisionGates,
    });
    const pendingPreview = this.pendingOnlyPreview(draftPreview);
    const pendingActionNormalization = sourceSyncStatus.decisionGates.canGenerateActionDraft
      ? this.pendingActionNormalizer.normalizePreview(pendingPreview)
      : this.emptyPendingActionNormalization(pendingPreview);
    const validateOnlyLane = this.validateOnlyPlanner.planValidateOnlyLane(
      pendingActionNormalization,
      this.mockProviderResults(fixture, normalizedImportRows, pendingActionNormalization),
    );
    const validateOnlyPreflight = this.validateOnlyPreflight(
      draftPreview,
      pendingActionNormalization,
      validateOnlyLane.validationPlans,
      sourceSyncDecisionEvidence,
      importReadiness.decisionReadiness.readonly_import_blockers,
      importReadiness.decisionReadiness.read_model_blockers,
    );
    const approvalEvidence = this.approvalEvidence(
      pendingActionNormalization.pendingActions,
      validateOnlyLane.validationPlans,
      normalizedImportRows,
    );
    const dryRunExecutionAuditRecords = this.dryRunAuditRecords(
      pendingActionNormalization.pendingActions,
      validateOnlyLane.validationPlans,
      normalizedImportRows,
      fixture.importRunId,
    );
    const alertRollbackEvidence = this.alertRollbackEvidence(
      pendingActionNormalization.pendingActions,
      normalizedImportRows,
      fixture.cashflowMode,
    );

    return {
      schemaVersion: 'ads_automation_google_ads_mock_import_demo.v1',
      generatedAt,
      reportDate: fixture.reportDate,
      importRunId: fixture.importRunId,
      cashflowMode: fixture.cashflowMode,
      safety: this.safety(),
      summary: {
        normalized_google_ads_rows: normalizedImportRows.length,
        rows_ready_for_decision: normalizedImportRows.filter((row) => row.canUseForAdsAutomationDecision).length,
        pending_actions_created: pendingActionNormalization.pendingActions.length,
        update_budget_actions: this.countActions(pendingActionNormalization, ['update_campaign_budget']),
        monitor_only_actions: this.countActions(pendingActionNormalization, ['monitor_only']),
        pause_actions: this.countActions(pendingActionNormalization, ['pause_campaign', 'pause_ad_group']),
        stop_import_review_actions: this.countActions(pendingActionNormalization, ['stop_import_review']),
        supplier_or_product_blocker_actions: this.countActions(pendingActionNormalization, [
          'supplier_sourcing',
          'product_offer_fix',
          'stop_import_review',
        ]),
        approval_evidence_records: approvalEvidence.length,
        dry_run_audit_records: dryRunExecutionAuditRecords.length,
        alert_rollback_records: alertRollbackEvidence.length,
        scale_up_execution_mode: importReadiness.summary.scale_up_execution_mode,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      },
      importReadiness,
      normalizedImportRows,
      erpMappingEvidence: this.erpMappingEvidence(fixture),
      decisionReadModel,
      decisionSnapshot,
      draftPreview,
      pendingActionNormalization,
      validateOnlyLane,
      validateOnlyPreflight,
      approvalEvidence,
      dryRunExecutionAuditRecords,
      alertRollbackEvidence,
    };
  }

  private normalizedRows(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
  ): AdsAutomationGoogleAdsMockImportNormalizedRow[] {
    return input.googleAdsRows.map((row) => {
      const ageHours = (new Date(input.now).getTime() - new Date(row.lastSuccessfulSyncAt).getTime()) / 3_600_000;
      const blockers = [
        !this.text(row.campaignBudgetId) ? 'campaignBudgetId_missing_no_fallback' : null,
        !row.mappedProductIds.length ? 'product_mapping_missing' : null,
        row.sourceTrustLevel !== 'fixture_verified' && row.sourceTrustLevel !== 'erp_local_verified'
          ? 'source_trust_level_not_verified'
          : null,
        ageHours > 24 ? 'freshness_stale' : null,
      ].filter((blocker): blocker is string => Boolean(blocker));

      return {
        platform: 'google_ads',
        accountId: row.accountId,
        customerId: row.customerId,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        campaignStatus: row.campaignStatus,
        adGroupId: row.adGroupId,
        adGroupName: row.adGroupName,
        adGroupStatus: row.adGroupStatus,
        adId: this.text(row.adId),
        adName: this.text(row.adName),
        adStatus: this.text(row.adStatus),
        campaignBudgetId: this.text(row.campaignBudgetId),
        campaignBudgetResourceName: this.text(row.campaignBudgetResourceName),
        campaignBudgetAmountVnd: row.campaignBudgetAmountVnd,
        costVnd: row.costVnd,
        spendVnd: row.spendVnd ?? row.costVnd,
        clicks: row.clicks,
        impressions: row.impressions,
        conversions: row.conversions,
        orders: row.orders,
        revenueVnd: row.revenueVnd,
        grossProfitVnd: row.grossProfitVnd,
        netProfitAfterAdsVnd: row.netProfitAfterAdsVnd,
        returnRatePercent: row.returnRatePercent,
        dataQualityScore: row.dataQualityScore,
        reportDate: row.reportDate,
        freshnessStatus: ageHours <= 24 ? 'fresh' : 'stale',
        coverageStatus: this.text(row.campaignBudgetId) ? 'covered' : 'missing',
        lastSuccessfulSyncAt: row.lastSuccessfulSyncAt,
        importRunId: row.importRunId,
        sourceTrustLevel: row.sourceTrustLevel,
        mappedProductIds: [...row.mappedProductIds],
        blockers,
        canUseForAdsAutomationDecision: blockers.length === 0,
      };
    });
  }

  private importReadinessInput(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
    decisionReadModel: AdsAutomationDecisionSourceAdapterInput,
    sourceSyncStatus: AdsAutomationPlatformSourceSyncStatusResponse,
  ): AdsAutomationReadonlyPlatformImportReadinessInput {
    return {
      reportDate: input.reportDate,
      now: input.now,
      fixtureMode: 'htx_ads_readiness_demo',
      accounts: [{
        platform: 'google_ads',
        accountId: input.accountId,
        customerId: input.customerId,
        loginCustomerId: input.loginCustomerId,
        accountName: input.accountName,
        isActive: true,
        approvedForReadOnlyImport: true,
        configuredForReadOnlyImport: true,
        googleAdsProductionEnabled: false,
        sourceTrustLevel: input.sourceTrustLevel,
        importWindow: {
          from: input.reportDate,
          to: input.reportDate,
          timezone: 'Asia/Bangkok',
          cadence: 'manual',
          maxRangeDays: 31,
        },
        lastSuccessfulSyncAt: this.latestSync(rows),
        latestMetricDate: input.reportDate,
        retryState: {
          status: 'idle',
          attempts: 0,
          maxAttempts: 3,
          nextRetryAt: null,
          backoffMs: null,
          lastFailureCategory: null,
        },
        freshnessMaxAgeMinutes: 120,
      }],
      metricRows: rows.map((row) => ({
        platform: 'google_ads',
        accountId: row.accountId,
        customerId: row.customerId,
        campaignId: row.campaignId,
        adGroupId: row.adGroupId,
        campaignBudgetId: row.campaignBudgetId,
        date: row.reportDate,
        spendVnd: row.spendVnd,
        clicks: row.clicks,
        impressions: row.impressions,
        conversions: row.conversions,
        conversionValueVnd: row.revenueVnd,
      })),
      decisionSafety: input.cashflowMode === 'safe'
        ? {
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
          }
        : {
            grossMarginSafe: true,
            contributionProfitPositive: true,
            cashConversionWorkingCapitalSafe: false,
            stockCoverageSafe: true,
            supplierReliabilitySafe: false,
            fulfillmentCapacitySafe: false,
            returnRefundRiskSafe: true,
            dataFreshnessSafe: true,
            dailyLossLimitSafe: false,
            monthlyLossLimitSafe: false,
          },
      decisionReadModel,
      sourceSyncStatus,
    };
  }

  private decisionReadModelInput(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
  ): AdsAutomationDecisionSourceAdapterInput {
    const googleFreshAt = this.latestSync(rows);
    const erpFreshAt = input.now;
    return {
      snapshotDate: input.reportDate,
      evidenceWindow: this.query(input).evidenceWindow,
      policy: this.policyRow(input, erpFreshAt),
      adGroups: this.adGroupRows(rows),
      products: this.productRows(input.products, erpFreshAt),
      suppliers: this.supplierRows(input.suppliers, erpFreshAt),
      sourceWatermarks: {
        ads_performance: googleFreshAt,
        campaign_budgets: googleFreshAt,
        pause_review: googleFreshAt,
        ...(input.products.length ? { product_performance: erpFreshAt } : {}),
        ...(input.suppliers.length ? { supplier_safety: erpFreshAt } : {}),
        cashflow_policy: erpFreshAt,
      },
    };
  }

  private repository(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
  ): AdsAutomationDecisionReadModelRepository {
    const googleFreshAt = this.latestSync(rows);
    const erpFreshAt = input.now;
    return {
      findAdGroupPerformanceRows: async () => this.adGroupRows(rows),
      findCampaignBudgetRows: async () => this.campaignBudgetRows(rows),
      findProductPerformanceRows: async () => this.productRows(input.products, erpFreshAt),
      findSupplierSafetyRows: async () => this.supplierRows(input.suppliers, erpFreshAt),
      findCashflowPolicyRow: async () => this.policyRow(input, erpFreshAt),
      findSourceWatermarks: async () => ({
        ads_performance: googleFreshAt,
        campaign_budgets: googleFreshAt,
        pause_review: googleFreshAt,
        product_performance: erpFreshAt,
        supplier_safety: erpFreshAt,
        cashflow_policy: erpFreshAt,
      }),
    };
  }

  private adGroupRows(rows: AdsAutomationGoogleAdsMockImportNormalizedRow[]): AdsAutomationAdGroupReadRow[] {
    return rows.map((row) => ({
      platform: 'google',
      accountId: row.customerId,
      customerId: row.customerId,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      adGroupId: row.adGroupId,
      adGroupName: row.adGroupName,
      resourceName: `customers/${row.customerId}/adGroups/${row.adGroupId}`,
      campaignBudgetId: row.campaignBudgetId || undefined,
      campaignBudgetResourceName: row.campaignBudgetResourceName || undefined,
      currentStatus: row.adGroupStatus || row.campaignStatus,
      status: row.adGroupStatus || row.campaignStatus,
      currentBudgetVnd: row.campaignBudgetAmountVnd,
      spendVnd: row.spendVnd,
      costVnd: row.costVnd,
      clicks: row.clicks,
      impressions: row.impressions,
      conversions: row.conversions,
      conversionValueVnd: row.revenueVnd,
      orders: row.orders,
      revenueVnd: row.revenueVnd,
      grossProfitVnd: row.grossProfitVnd,
      netProfitAfterAdsVnd: row.netProfitAfterAdsVnd,
      returnRatePercent: row.returnRatePercent,
      dataQualityScore: row.dataQualityScore,
      labels: [],
      productIds: [...row.mappedProductIds],
      internalProductIds: [...row.mappedProductIds],
      mappedProductIds: [...row.mappedProductIds],
      bottlenecksChecked: true,
      lastSyncAt: row.lastSuccessfulSyncAt,
      updatedAt: row.lastSuccessfulSyncAt,
    }));
  }

  private campaignBudgetRows(rows: AdsAutomationGoogleAdsMockImportNormalizedRow[]): AdsAutomationCampaignBudgetReadRow[] {
    const byBudgetId = new Map<string, AdsAutomationCampaignBudgetReadRow>();
    for (const row of rows) {
      if (!row.campaignBudgetId) continue;
      byBudgetId.set(row.campaignBudgetId, {
        customerId: row.customerId,
        accountId: row.customerId,
        campaignBudgetId: row.campaignBudgetId,
        resourceName: row.campaignBudgetResourceName || undefined,
        campaignBudgetResourceName: row.campaignBudgetResourceName || undefined,
        amountVnd: row.campaignBudgetAmountVnd,
        status: row.campaignStatus,
        lastSyncAt: row.lastSuccessfulSyncAt,
        updatedAt: row.lastSuccessfulSyncAt,
      });
    }
    return [...byBudgetId.values()];
  }

  private productRows(
    products: AdsAutomationGoogleAdsMockImportProductInput[],
    freshAt: string,
  ): AdsAutomationProductReadRow[] {
    return products.map((product) => ({
      productId: product.productId,
      sku: product.sku,
      name: product.name,
      productName: product.name,
      netProfitVnd: product.netProfitVnd,
      adAttributedNetProfitAfterAdsVnd: product.adAttributedNetProfitAfterAdsVnd,
      marginPercent: product.marginPercent,
      returnCancelRefundRatePercent: product.returnCancelRefundRatePercent,
      stockAvailable: product.stockAvailable,
      reservedQuantity: product.reservedQuantity,
      incomingQuantity: product.incomingQuantity,
      daysOfCover: product.daysOfCover,
      mediaReady: product.mediaReady,
      landingReady: product.landingReady,
      offerReady: product.offerReady,
      mappedAdGroupIds: [...product.mappedAdGroupIds],
      supplierIds: [...product.supplierIds],
      lastSyncAt: freshAt,
      updatedAt: freshAt,
    }));
  }

  private supplierRows(
    suppliers: AdsAutomationGoogleAdsMockImportDemoInput['suppliers'],
    freshAt: string,
  ): AdsAutomationSupplierReadRow[] {
    return suppliers.map((supplier) => ({
      productId: supplier.productId,
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      quoteApproved: supplier.quoteApproved,
      currentQuoteVnd: supplier.currentQuoteVnd,
      priorQuoteVnd: supplier.priorQuoteVnd,
      marginAfterCostPercent: supplier.marginAfterCostPercent,
      leadTimeDays: supplier.leadTimeDays,
      lateDeliveryRatePercent: supplier.lateDeliveryRatePercent,
      paymentFreshnessDays: supplier.paymentFreshnessDays,
      capacityStatus: supplier.capacityStatus,
      returnFaultRatePercent: supplier.returnFaultRatePercent,
      lastSyncAt: freshAt,
      updatedAt: freshAt,
    }));
  }

  private policyRow(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
    freshAt: string,
  ): AdsAutomationCashflowPolicyReadRow {
    return {
      ...input.policy,
      availableAdsCashVnd: input.cashflowMode === 'safe' ? input.policy.availableAdsCashVnd : 0,
      cashflowGatePassed: input.cashflowMode === 'safe',
      lastSyncAt: freshAt,
      updatedAt: freshAt,
    };
  }

  private sourceSyncStatus(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
  ): AdsAutomationPlatformSourceSyncStatusResponse {
    const decisionEvidence = SOURCE_KEYS.map((sourceKey) =>
      this.sourceSyncDecisionEvidence(input, rows, sourceKey),
    );
    const blockedSources = decisionEvidence
      .filter((evidence) => !evidence.canUseForAdsAutomationDecision)
      .map((evidence) => evidence.sourceKey as AdsAutomationPlatformSourceSyncStatusSourceKey);
    const staleSources = decisionEvidence
      .filter((evidence) => evidence.freshnessStatus === 'stale')
      .map((evidence) => evidence.sourceKey as AdsAutomationPlatformSourceSyncStatusSourceKey);
    const missingCoverageSources = decisionEvidence
      .filter((evidence) => !['covered', 'not_applicable'].includes(String(evidence.coverageStatus)))
      .map((evidence) => evidence.sourceKey as AdsAutomationPlatformSourceSyncStatusSourceKey);
    const notSyncedSources = decisionEvidence
      .filter((evidence) => evidence.freshnessStatus === 'missing')
      .map((evidence) => evidence.sourceKey as AdsAutomationPlatformSourceSyncStatusSourceKey);
    const allReady = blockedSources.length === 0;

    return {
      schemaVersion: 'ads_automation_platform_source_sync_status.v1',
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
        status: allReady ? 'ready' : 'blocked',
        source_count: SOURCE_KEYS.length,
        ready_source_count: SOURCE_KEYS.length - blockedSources.length,
        blocked_source_count: blockedSources.length,
        blocked_sources: blockedSources,
        missing_config_sources: [],
        stale_sources: staleSources,
        missing_coverage_sources: missingCoverageSources,
        not_synced_sources: notSyncedSources,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: allReady
          ? 'ready_for_ads_automation_decision_review'
          : 'resolve_source_sync_blockers',
      },
      decisionGates: {
        canUseGoogleAdsDataClaim: this.sourceReady(decisionEvidence, 'google_ads'),
        canGenerateActionDraft: allReady,
        canRecommendAdsScale: allReady,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      },
      decisionEvidence,
      sources: [],
    };
  }

  private sourceSyncDecisionEvidence(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
    sourceKey: AdsAutomationGoogleAdsMockImportSourceKey,
  ): SourceSyncDecisionEvidence {
    const sourceStatus = this.sourceStatus(input, rows, sourceKey);
    const sourceNotReady = `${sourceKey}_not_ready_for_ads_automation_decision`;
    const blockingReasons = sourceStatus.canUse
      ? []
      : this.uniqueOrdered([sourceNotReady, ...sourceStatus.blockers]);

    return {
      sourceKey,
      reportDate: input.reportDate,
      freshnessStatus: sourceStatus.freshnessStatus,
      coverageStatus: sourceStatus.coverageStatus,
      lastSuccessfulSyncAt: sourceStatus.lastSuccessfulSyncAt,
      latestRecordDate: sourceStatus.latestRecordDate,
      blockingReason: blockingReasons[0] || null,
      blockingReasons,
      canUseForAdsAutomationDecision: sourceStatus.canUse,
    };
  }

  private sourceSyncDecisionGates(
    sourceSyncStatus: AdsAutomationPlatformSourceSyncStatusResponse,
    scaleMode: 'pending_validation' | 'monitor_only',
  ): Partial<SourceSyncDecisionGates> {
    return {
      canRecommendAdsScale: scaleMode === 'pending_validation',
      canConcludeProfitStrongly: true,
      canEvaluateSalesToday: true,
      canEvaluateFinanceStrongly: true,
      canUseLtvStrongly: true,
      canGenerateActionDraft: sourceSyncStatus.decisionGates.canGenerateActionDraft,
      canUseGoogleAdsDataClaim: sourceSyncStatus.decisionGates.canUseGoogleAdsDataClaim,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }

  private sourceStatus(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
    sourceKey: AdsAutomationGoogleAdsMockImportSourceKey,
  ): {
    freshnessStatus: SourceSyncDecisionEvidence['freshnessStatus'];
    coverageStatus: SourceSyncDecisionEvidence['coverageStatus'];
    lastSuccessfulSyncAt: string | null;
    latestRecordDate: string | null;
    blockers: string[];
    canUse: boolean;
  } {
    const latestSync = this.latestSyncOrNull(rows);
    const stale = rows.some((row) => row.freshnessStatus === 'stale');
    const googleRowsFreshness = !rows.length ? 'missing' : stale ? 'stale' : 'fresh';
    const googleRowsCoverage = rows.length ? 'covered' : 'missing';
    const sourceFreshness = latestSync ? googleRowsFreshness : 'missing';
    const freshnessBlockers = sourceFreshness === 'fresh' ? [] : [`freshness_${sourceFreshness}`];

    if (sourceKey === 'google_ads' || sourceKey === 'advertising_costs') {
      const coverageBlockers = googleRowsCoverage === 'covered' ? [] : [`coverage_${googleRowsCoverage}`];
      const blockers = this.unique([...freshnessBlockers, ...coverageBlockers]);
      return {
        freshnessStatus: sourceFreshness,
        coverageStatus: googleRowsCoverage,
        lastSuccessfulSyncAt: latestSync,
        latestRecordDate: rows.length ? input.reportDate : null,
        blockers,
        canUse: blockers.length === 0,
      };
    }

    if (sourceKey === 'product_mapping') {
      const missingMapping = rows.length === 0 || rows.some((row) => row.mappedProductIds.length === 0);
      const coverageStatus = missingMapping ? 'missing' : 'covered';
      const blockers = this.unique([
        ...freshnessBlockers,
        ...(missingMapping ? ['coverage_missing', 'product_mapping_missing'] : []),
      ]);
      return {
        freshnessStatus: sourceFreshness,
        coverageStatus,
        lastSuccessfulSyncAt: latestSync,
        latestRecordDate: missingMapping ? null : input.reportDate,
        blockers,
        canUse: blockers.length === 0,
      };
    }

    if (sourceKey === 'inventory_profit') {
      const missingInventoryProfit = input.products.length === 0
        || input.products.some((product) => !this.productInventoryProfitCovered(product));
      const coverageStatus = missingInventoryProfit ? 'missing' : 'covered';
      const blockers = this.unique([
        ...(missingInventoryProfit ? ['coverage_missing', 'inventory_profit_missing_or_incomplete'] : []),
      ]);
      return {
        freshnessStatus: missingInventoryProfit ? 'missing' : 'fresh',
        coverageStatus,
        lastSuccessfulSyncAt: missingInventoryProfit ? null : latestSync,
        latestRecordDate: missingInventoryProfit ? null : input.reportDate,
        blockers,
        canUse: blockers.length === 0,
      };
    }

    const supplierProductIds = new Set(input.suppliers.map((supplier) => supplier.productId));
    const requiredProductIds = new Set(input.products.flatMap((product) => product.supplierIds.length ? [product.productId] : []));
    const missingSupplierSafety = input.suppliers.length === 0
      || [...requiredProductIds].some((productId) => !supplierProductIds.has(productId));
    const coverageStatus = missingSupplierSafety ? 'missing' : 'covered';
    const blockers = this.unique([
      ...(missingSupplierSafety ? ['coverage_missing', 'supplier_safety_missing_or_incomplete'] : []),
    ]);
    return {
      freshnessStatus: missingSupplierSafety ? 'missing' : 'fresh',
      coverageStatus,
      lastSuccessfulSyncAt: missingSupplierSafety ? null : latestSync,
      latestRecordDate: missingSupplierSafety ? null : input.reportDate,
      blockers,
      canUse: blockers.length === 0,
    };
  }

  private productInventoryProfitCovered(
    product: AdsAutomationGoogleAdsMockImportProductInput,
  ): boolean {
    return [
      product.productId,
      product.netProfitVnd,
      product.marginPercent,
      product.stockAvailable,
      product.daysOfCover,
    ].every((value) => value !== undefined && value !== null && value !== '');
  }

  private sourceReady(
    evidence: SourceSyncDecisionEvidence[],
    sourceKey: AdsAutomationGoogleAdsMockImportSourceKey,
  ): boolean {
    return evidence.find((item) => item.sourceKey === sourceKey)
      ?.canUseForAdsAutomationDecision === true;
  }

  private pendingOnlyPreview(
    preview: AdsAutomationDecisionDraftPreviewResponse,
  ): AdsAutomationDecisionDraftPreviewResponse {
    const draftsByIdempotencyKey = new Map<string, AdsAutomationDecisionDraftPreview>();
    for (const draft of preview.drafts.filter((item) => item.status === 'pending_approval_preview')) {
      const existing = draftsByIdempotencyKey.get(draft.idempotency_key);
      if (!existing || this.draftPriority(draft) > this.draftPriority(existing)) {
        draftsByIdempotencyKey.set(draft.idempotency_key, draft);
      }
    }
    const drafts = [...draftsByIdempotencyKey.values()];
    return {
      ...preview,
      summary: {
        decisions_scanned: preview.summary.decisions_scanned,
        drafts_created: drafts.length,
        blocked_drafts: 0,
        provider_action_drafts: drafts.filter((draft) => draft.action_family === 'provider_google_ads').length,
        internal_task_drafts: drafts.filter((draft) => draft.action_family === 'internal_task').length,
        monitoring_drafts: drafts.filter((draft) => draft.action_family === 'monitoring').length,
      },
      drafts,
    };
  }

  private emptyPendingActionNormalization(
    preview: AdsAutomationDecisionDraftPreviewResponse,
  ): AdsAutomationPendingErpActionNormalizationResponse {
    return {
      schemaVersion: 'ads_automation_pending_erp_action_normalization.v1',
      generatedAt: new Date().toISOString(),
      sourcePreviewSchemaVersion: preview.schemaVersion,
      sourceSyncDecisionEvidence: this.cloneJson(preview.sourceSyncDecisionEvidence || []),
      sourceSyncDecisionGates: preview.sourceSyncDecisionGates
        ? this.cloneJson(preview.sourceSyncDecisionGates)
        : null,
      safety: {
        read_only: true,
        dry_run: true,
        in_memory_only: true,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_actions: true,
        execution_allowed_now: false,
      },
      summary: {
        drafts_received: preview.drafts.length,
        pending_actions_created: 0,
        provider_action_records: 0,
        internal_task_records: 0,
        monitoring_records: 0,
        platform_entity_blocker_count: 0,
        scale_candidates_blocked_by_platform_entity_coverage: 0,
      },
      decisionAnswers: this.emptyPendingDecisionAnswers(),
      pendingActions: [],
    };
  }

  private emptyPendingDecisionAnswers(): AdsAutomationPendingErpDecisionAnswers {
    return {
      increase_ads: 'no_budget_increase_pending',
      increase_amount_vnd: 0,
      target_ad_group_ids: [],
      products_to_receive_budget: [],
      supplier_choice_safety: [],
      product_kill_or_stop_import_review: [],
      campaign_or_ad_group_pause: [],
    };
  }

  private draftPriority(draft: AdsAutomationDecisionDraftPreview): number {
    if (['update_campaign_budget', 'pause_campaign', 'pause_ad_group'].includes(draft.action_type)) {
      return 5;
    }
    if (['supplier_sourcing', 'product_offer_fix', 'stop_import_review'].includes(draft.action_type)) {
      return 4;
    }
    if (draft.action_type === 'monitor_only' && draft.blockers.length) {
      return 3;
    }
    if (draft.action_type === 'monitor_only' && draft.source_decision_type === 'scale_ads') {
      return 2;
    }
    return 1;
  }

  private mockProviderResults(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
    normalization: AdsAutomationPendingErpActionNormalizationResponse,
  ): AdsAutomationProviderValidateOnlyMockResult[] {
    return normalization.pendingActions
      .filter((action) => action.action_family === 'provider_google_ads')
      .filter((action) => !action.risk_blockers.length)
      .map((action) => {
        const row = this.rowForAction(rows, action);
        return {
          pending_action_id: action.pending_action_id,
          approval_id: action.approval_id,
          status: 'provider_validate_passed',
          providerRequestId: `REQ-MOCK-${this.safeKey(action.approval_id)}`,
          providerValidatedAt: input.now,
          beforeStateSnapshot: {
            importRunId: input.importRunId,
            sourceTrustLevel: row?.sourceTrustLevel || input.sourceTrustLevel,
            campaignStatus: row?.campaignStatus || null,
            adGroupStatus: row?.adGroupStatus || null,
            adId: row?.adId || null,
            currentDailyBudgetVnd: row?.campaignBudgetAmountVnd || action.requested_change.currentBudgetVnd || null,
            syncedAt: input.now,
          },
        };
      });
  }

  private validateOnlyPreflight(
    draftPreview: AdsAutomationDecisionDraftPreviewResponse,
    normalization: AdsAutomationPendingErpActionNormalizationResponse,
    plans: AdsAutomationProviderValidateOnlyActionPlan[],
    sourceEvidence: SourceSyncDecisionEvidence[],
    readonlyImportBlockers: string[],
    readModelBlockers: string[],
  ): AdsAutomationGoogleAdsMockImportValidateOnlyPreflight {
    const actionsByDraftId = new Map(normalization.pendingActions.map((action) => [
      action.source_draft_id,
      action,
    ]));
    const plansByPendingActionId = new Map(plans.map((plan) => [
      plan.pending_action_id,
      plan,
    ]));
    const providerDrafts = draftPreview.drafts
      .filter((draft) => draft.action_family === 'provider_google_ads');
    const sourceBlockers = this.sourceReadinessBlockers(sourceEvidence);
    const normalizedReadonlyBlockers = this.importPreflightBlockers(readonlyImportBlockers || []);
    const normalizedReadModelBlockers = this.unique(readModelBlockers || []);
    const candidates = providerDrafts.map((draft) => this.validateOnlyPreflightCandidate(
      draft,
      actionsByDraftId.get(draft.draft_id) || null,
      plansByPendingActionId,
      sourceEvidence,
      sourceBlockers.blockedSourceKeys,
      sourceBlockers.blockers,
      normalizedReadonlyBlockers,
      normalizedReadModelBlockers,
    ));

    if (
      !candidates.length
      && (sourceBlockers.blockers.length || normalizedReadonlyBlockers.length || normalizedReadModelBlockers.length)
    ) {
      candidates.push(this.sourceOnlyValidateOnlyPreflightCandidate(
        sourceEvidence,
        sourceBlockers.blockedSourceKeys,
        sourceBlockers.blockers,
        normalizedReadonlyBlockers,
        normalizedReadModelBlockers,
      ));
    }

    const blockers = this.unique([
      ...sourceBlockers.blockers,
      ...normalizedReadonlyBlockers,
      ...normalizedReadModelBlockers,
      ...candidates.flatMap((candidate) => candidate.blockers),
    ]);
    const blockedCandidateCount = candidates.filter((candidate) =>
      candidate.provider_validateOnly_readiness === 'blocked_before_validateOnly',
    ).length;
    const blocked = blockedCandidateCount > 0 || blockers.length > 0;

    return {
      status: blocked ? 'blocked_before_validateOnly' : 'ready_for_future_validateOnly_planning',
      pending_action_candidate_status: blocked
        ? 'blocked_before_pending_action'
        : 'pending_actions_created',
      source: 'erp_mock_import_read_model',
      candidate_count: candidates.length,
      pending_action_count: normalization.pendingActions.length,
      blocked_candidate_count: blockedCandidateCount,
      blocked_source_keys: sourceBlockers.blockedSourceKeys,
      blockers,
      candidates,
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    };
  }

  private validateOnlyPreflightCandidate(
    draft: AdsAutomationDecisionDraftPreview,
    action: AdsAutomationPendingErpActionRecord | null,
    plansByPendingActionId: Map<string, AdsAutomationProviderValidateOnlyActionPlan>,
    sourceEvidence: SourceSyncDecisionEvidence[],
    blockedSourceKeys: string[],
    sourceBlockers: string[],
    readonlyImportBlockers: string[],
    readModelBlockers: string[],
  ): AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate {
    const plan = action ? plansByPendingActionId.get(action.pending_action_id) || null : null;
    const draftBlockers = this.unique([
      ...(draft.blockers || []),
      ...(draft.missing_data_blockers || []),
    ]);
    const candidateBlockers = this.unique([
      ...draftBlockers,
      ...(plan?.blockers || []),
      ...(draft.status === 'blocked_missing_data' ? sourceBlockers : []),
      ...(draft.status === 'blocked_missing_data' ? readonlyImportBlockers : []),
      ...(draft.status === 'blocked_missing_data' ? readModelBlockers : []),
    ]);
    const readiness = this.providerValidateOnlyReadiness(draft, action, plan, candidateBlockers);
    const payload = draft.typedPayload || {};

    return {
      candidate_id: `ADSPREFLIGHT-${this.safeKey(draft.draft_id)}`,
      draft_id: draft.draft_id,
      pending_action_id: action?.pending_action_id || null,
      approval_id: action?.approval_id || null,
      action_type: draft.action_type,
      candidate_status: action ? 'pending_action_created' : 'blocked_before_pending_action',
      provider_validateOnly_readiness: readiness,
      validateOnly_plan_status: plan?.status || null,
      validateOnly_request_status: plan?.validateOnly_request?.request_status || null,
      customerId: action?.customerId || this.text(payload.customerId) || this.text(draft.accountId),
      campaignId: action?.campaignId || this.text(payload.campaignId),
      adGroupId: action?.adGroupId || this.text(payload.adGroupId),
      campaignBudgetId: action?.campaignBudgetId || this.text(payload.campaignBudgetId),
      campaignBudgetResourceName: action?.campaignBudgetResourceName || this.text(payload.campaignBudgetResourceName),
      productId: action?.productId || this.text(draft.productId) || this.text(payload.productId),
      supplierId: action?.supplierId || this.text(draft.supplierId) || this.text(payload.supplierId),
      blockers: candidateBlockers,
      blocked_source_keys: [...blockedSourceKeys],
      read_model_blockers: draft.status === 'blocked_missing_data' ? [...readModelBlockers] : [],
      source_freshness: this.preflightSourceFreshness(sourceEvidence),
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    };
  }

  private sourceOnlyValidateOnlyPreflightCandidate(
    sourceEvidence: SourceSyncDecisionEvidence[],
    blockedSourceKeys: string[],
    sourceBlockers: string[],
    readonlyImportBlockers: string[],
    readModelBlockers: string[],
  ): AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate {
    return {
      candidate_id: 'ADSPREFLIGHT-SOURCE-READINESS',
      draft_id: null,
      pending_action_id: null,
      approval_id: null,
      action_type: 'update_campaign_budget',
      candidate_status: 'blocked_before_pending_action',
      provider_validateOnly_readiness: 'blocked_before_validateOnly',
      validateOnly_plan_status: null,
      validateOnly_request_status: null,
      customerId: null,
      campaignId: null,
      adGroupId: null,
      campaignBudgetId: null,
      campaignBudgetResourceName: null,
      productId: null,
      supplierId: null,
      blockers: this.unique([...sourceBlockers, ...readonlyImportBlockers, ...readModelBlockers]),
      blocked_source_keys: [...blockedSourceKeys],
      read_model_blockers: [...readModelBlockers],
      source_freshness: this.preflightSourceFreshness(sourceEvidence),
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    };
  }

  private importPreflightBlockers(readonlyImportBlockers: string[]): string[] {
    return this.unique([
      ...(readonlyImportBlockers || []),
      ...(readonlyImportBlockers.includes('campaignBudgetId_missing_no_fallback')
        ? ['campaignBudgetId']
        : []),
    ]);
  }

  private providerValidateOnlyReadiness(
    draft: AdsAutomationDecisionDraftPreview,
    action: AdsAutomationPendingErpActionRecord | null,
    plan: AdsAutomationProviderValidateOnlyActionPlan | null,
    blockers: string[],
  ): AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate['provider_validateOnly_readiness'] {
    if (draft.status === 'blocked_missing_data' || !action || blockers.length) {
      return 'blocked_before_validateOnly';
    }
    if (!plan) return 'ready_for_future_validateOnly';
    if (plan.status === 'validate_only_passed') return 'passed_mock_validateOnly';
    if (plan.status === 'skipped_non_provider_action') return 'not_applicable_non_provider_action';
    if (plan.status === 'blocked_before_validate_only' || plan.status === 'validate_only_failed') {
      return 'blocked_before_validateOnly';
    }
    return 'ready_for_future_validateOnly';
  }

  private sourceReadinessBlockers(
    sourceEvidence: SourceSyncDecisionEvidence[],
  ): { blockedSourceKeys: string[]; blockers: string[] } {
    const blocked = (sourceEvidence || [])
      .filter((evidence) => evidence.canUseForAdsAutomationDecision !== true);
    return {
      blockedSourceKeys: this.unique(blocked.map((evidence) => evidence.sourceKey)),
      blockers: this.unique(blocked.flatMap((evidence) => [
        ...(evidence.blockingReasons || []),
        evidence.blockingReason || '',
      ])),
    };
  }

  private preflightSourceFreshness(
    sourceEvidence: SourceSyncDecisionEvidence[],
  ): AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate['source_freshness'] {
    return (sourceEvidence || []).map((evidence) => ({
      sourceKey: evidence.sourceKey,
      freshnessStatus: this.text(evidence.freshnessStatus),
      coverageStatus: this.text(evidence.coverageStatus),
      canUseForAdsAutomationDecision: evidence.canUseForAdsAutomationDecision === true,
      blockingReasons: [...(evidence.blockingReasons || [])],
    }));
  }

  private approvalEvidence(
    actions: AdsAutomationPendingErpActionRecord[],
    plans: AdsAutomationProviderValidateOnlyActionPlan[],
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
  ): AdsAutomationGoogleAdsMockImportApprovalEvidence[] {
    const plansByApprovalId = new Map(plans.map((plan) => [plan.approval_id, plan]));
    return actions.map((action) => {
      const plan = plansByApprovalId.get(action.approval_id);
      const row = this.rowForAction(rows, action);
      const providerPassed = plan?.status === 'validate_only_passed';
      return {
        pending_action_id: action.pending_action_id,
        approval_id: action.approval_id,
        action_type: action.action_type,
        approval_status: providerPassed ? 'approved_demo_local_only' : 'pending_approval_required',
        validation_status: plan?.status || 'not_applicable_non_provider_action',
        preflight_status: providerPassed
          ? 'recorded_local_only_blocked_future_live'
          : 'not_applicable_non_provider_action',
        audit_correlation_id: this.auditCorrelationId(action),
        customerId: action.customerId,
        campaignId: action.campaignId || row?.campaignId || null,
        adGroupId: action.adGroupId || row?.adGroupId || null,
        adId: row?.adId || null,
        campaignBudgetId: action.campaignBudgetId,
        campaignBudgetResourceName: action.campaignBudgetResourceName,
        productId: action.productId,
        supplierId: action.supplierId,
        requested_change: this.cloneJson(action.requested_change),
        reason: action.reason,
        blockers: [...action.risk_blockers],
        source_freshness: action.source_readiness.map((source) => ({
          sourceKey: source.sourceKey,
          freshnessStatus: source.freshnessStatus,
          coverageStatus: source.coverageStatus,
          canUseForAdsAutomationDecision: source.canUseForAdsAutomationDecision,
        })),
        idempotency_key: action.idempotency_key,
        rollback_plan: this.rollbackPlan(action),
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      };
    });
  }

  private dryRunAuditRecords(
    actions: AdsAutomationPendingErpActionRecord[],
    plans: AdsAutomationProviderValidateOnlyActionPlan[],
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
    importRunId: string,
  ): AdsAutomationGoogleAdsMockImportDryRunAuditRecord[] {
    const plansByApprovalId = new Map(plans.map((plan) => [plan.approval_id, plan]));
    return actions.map((action) => {
      const plan = plansByApprovalId.get(action.approval_id);
      const row = this.rowForAction(rows, action);
      const providerPassed = plan?.status === 'validate_only_passed';
      return {
        execution_record_id: `ADSEXEC-MOCK-${this.safeKey(action.approval_id)}-${this.safeKey(importRunId)}`,
        audit_correlation_id: this.auditCorrelationId(action),
        approval_id: action.approval_id,
        pending_action_id: action.pending_action_id,
        action_type: action.action_type,
        validation_status: plan?.status || 'not_applicable_non_provider_action',
        preflight_status: providerPassed
          ? 'recorded_local_only_blocked_future_live'
          : 'not_applicable_non_provider_action',
        dry_run_record_status: 'recorded_local_only',
        approval_status: providerPassed ? 'approved_demo_local_only' : 'pending_approval_required',
        identifiers: {
          customerId: action.customerId,
          campaignId: action.campaignId || row?.campaignId || null,
          adGroupId: action.adGroupId || row?.adGroupId || null,
          adId: row?.adId || null,
          campaignBudgetId: action.campaignBudgetId,
          campaignBudgetResourceName: action.campaignBudgetResourceName,
        },
        requested_change: this.cloneJson(action.requested_change),
        blockers: providerPassed
          ? ['GOOGLE_ADS_PRODUCTION_ENABLED']
          : [...(plan?.blockers || action.risk_blockers)],
        idempotency_key: `ads-demo-dry-run:${this.safeKey(action.approval_id)}:${this.safeKey(importRunId)}`,
        campaignBudgetId_fallback_used: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
      };
    });
  }

  private alertRollbackEvidence(
    actions: AdsAutomationPendingErpActionRecord[],
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
    cashflowMode: AdsAutomationGoogleAdsMockImportDemoInput['cashflowMode'],
  ): AdsAutomationGoogleAdsMockImportAlertRollbackEvidence[] {
    return actions
      .filter((action) => (
        action.action_type === 'update_campaign_budget'
        || action.action_type === 'monitor_only'
        || action.action_type === 'pause_ad_group'
        || action.action_type === 'pause_campaign'
        || action.action_type === 'stop_import_review'
      ))
      .map((action) => {
        const row = this.rowForAction(rows, action);
        const triggerSignals = this.unique([
          ...(row && row.netProfitAfterAdsVnd < 0 ? ['net_profit_after_ads_negative'] : []),
          ...(row && row.orders <= 0 && row.spendVnd > 0 ? ['spend_without_orders'] : []),
          ...(action.risk_blockers || []),
          ...(cashflowMode === 'unsafe' && action.action_type === 'monitor_only'
            ? ['cashflow_first_scale_guard_unsafe']
            : []),
          ...(action.action_type === 'update_campaign_budget'
            ? ['rollback_restore_previous_budget_required']
            : []),
        ]);
        return {
          alert_id: `ADSALERT-MOCK-${this.safeKey(action.pending_action_id)}`,
          severity: triggerSignals.some((signal) => signal.includes('negative') || signal.includes('unsafe'))
            ? 'critical'
            : action.action_type === 'update_campaign_budget'
              ? 'info'
              : 'warning',
          pending_action_id: action.pending_action_id,
          action_type: action.action_type,
          trigger_signals: triggerSignals.length ? triggerSignals : ['local_demo_review_required'],
          rollback_plan: this.rollbackPlan(action) || 'Keep current state and require a new ERP review before any future change.',
          safe_action_preserved: this.safeAction(action),
          execution_allowed_now: false,
          provider_api_called: false,
          google_ads_api_called: false,
          live_ads_execution_used: false,
        };
      });
  }

  private erpMappingEvidence(
    input: AdsAutomationGoogleAdsMockImportDemoInput,
  ): AdsAutomationGoogleAdsMockImportErpMappingEvidence[] {
    return input.products.map((product) => {
      const orders = input.orderProfitRows.filter((order) => order.productId === product.productId);
      const revenueVnd = this.sum(orders, 'revenueVnd');
      const grossProfitVnd = this.sum(orders, 'grossProfitVnd');
      const netProfitVnd = this.sum(orders, 'netProfitVnd');
      const spendVnd = input.googleAdsRows
        .filter((row) => row.mappedProductIds.includes(product.productId))
        .reduce((total, row) => total + (row.spendVnd ?? row.costVnd), 0);
      return {
        productId: product.productId,
        supplierIds: [...product.supplierIds],
        mappedAdGroupIds: [...product.mappedAdGroupIds],
        orderCount: orders.length,
        revenueVnd,
        grossProfitVnd,
        netProfitVnd,
        contributionProfitVnd: netProfitVnd - spendVnd,
        cashCollectedVnd: this.sum(orders, 'cashCollectedVnd'),
        cashConversionStatus: product.cashConversionStatus,
        stockAvailable: product.stockAvailable,
        daysOfCover: product.daysOfCover,
        fulfillmentCapacityStatus: product.fulfillmentCapacityStatus,
        returnCancelRefundRatePercent: product.returnCancelRefundRatePercent,
      };
    });
  }

  private query(input: AdsAutomationGoogleAdsMockImportDemoInput): AdsAutomationDecisionReadModelQuery {
    return {
      snapshotDate: input.reportDate,
      now: input.now,
      evidenceWindow: {
        from: this.addDays(input.reportDate, -13),
        to: input.reportDate,
        days: 14,
      },
      customerIds: [input.customerId],
      accountIds: [input.customerId],
      maxAgeHours: {
        ads_performance: 24,
        campaign_budgets: 24,
        product_performance: 48,
        supplier_safety: 72,
        pause_review: 72,
        cashflow_policy: 24,
      } as Partial<Record<AdsAutomationDecisionSourceKey, number>>,
    };
  }

  private rowForAction(
    rows: AdsAutomationGoogleAdsMockImportNormalizedRow[],
    action: AdsAutomationPendingErpActionRecord,
  ): AdsAutomationGoogleAdsMockImportNormalizedRow | undefined {
    return rows.find((row) => (
      (action.adGroupId && row.adGroupId === action.adGroupId)
      || (action.campaignId && row.campaignId === action.campaignId)
      || (action.productId && row.mappedProductIds.includes(action.productId))
    ));
  }

  private countActions(
    normalization: AdsAutomationPendingErpActionNormalizationResponse,
    actions: string[],
  ): number {
    return normalization.pendingActions.filter((action) => actions.includes(action.action_type)).length;
  }

  private rollbackPlan(action: AdsAutomationPendingErpActionRecord): string | null {
    const referencePlan = action.evidence.source_evidence_references
      .map((reference) => this.text(reference.rollback_plan))
      .find(Boolean);
    if (referencePlan) return referencePlan;
    if (action.action_type === 'monitor_only') {
      return 'Keep existing ads state and re-evaluate after fresh cashflow, stock, supplier, and profit evidence is safe.';
    }
    if (action.action_type === 'stop_import_review') {
      return 'No provider resource change is allowed; reopen import review only after product and supplier blockers are cleared.';
    }
    return null;
  }

  private safeAction(
    action: AdsAutomationPendingErpActionRecord,
  ): AdsAutomationGoogleAdsMockImportAlertRollbackEvidence['safe_action_preserved'] {
    if (action.action_type === 'pause_ad_group') return 'pause_ad_group';
    if (action.action_type === 'pause_campaign') return 'pause_campaign';
    if (action.action_type === 'stop_import_review') return 'stop_import_review';
    return 'monitor_only';
  }

  private safety(): AdsAutomationGoogleAdsMockImportDemoResponse['safety'] {
    return {
      read_only: true,
      dry_run: true,
      local_fixture_only: true,
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
      campaignBudgetId_no_fallback: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      production_ready: false,
      erp_only_future_validator_approver_executor: true,
    };
  }

  private latestSync(rows: AdsAutomationGoogleAdsMockImportNormalizedRow[]): string {
    return this.latestSyncOrNull(rows) || new Date(0).toISOString();
  }

  private latestSyncOrNull(rows: AdsAutomationGoogleAdsMockImportNormalizedRow[]): string | null {
    const latest = rows
      .map((row) => new Date(row.lastSuccessfulSyncAt).getTime())
      .filter(Number.isFinite)
      .sort((left, right) => right - left)[0];
    return latest ? new Date(latest).toISOString() : null;
  }

  private sum(rows: AdsAutomationGoogleAdsMockImportOrderProfitInput[], key: keyof AdsAutomationGoogleAdsMockImportOrderProfitInput): number {
    return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  }

  private auditCorrelationId(action: AdsAutomationPendingErpActionRecord): string {
    return `ADSAUDIT-MOCK-${this.safeKey(action.approval_id)}`;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private uniqueOrdered(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private text(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private safeKey(value: unknown): string {
    return String(value || 'unknown').replace(/[^a-z0-9._:-]/gi, '_').slice(0, 96);
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
