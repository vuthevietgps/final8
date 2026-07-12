import { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request = require("supertest");
import { JwtAuthGuard, RolesGuard } from "../auth/guards/auth.guard";
import { AdsAutomationDecisionDraftApprovalDecisionAuditRepository } from "./ads-automation-decision-draft-approval-decision-audit.repository";
import { AdsAutomationDecisionDraftApprovalDecisionMutationService } from "./ads-automation-decision-draft-approval-decision-mutation.service";
import { AdsAutomationDecisionDraftApprovalRepository } from "./ads-automation-decision-draft-approval.repository";
import { AdsAutomationDecisionDraftApprovalQueueService } from "./ads-automation-decision-draft-approval-queue.service";
import { AdsAutomationDecisionDraftPreviewService } from "./ads-automation-decision-draft-preview.service";
import { AdsAutomationDecisionFoundationReviewExportService } from "./ads-automation-decision-foundation-review-export.service";
import { AdsAutomationDecisionFoundationReviewerDocsService } from "./ads-automation-decision-foundation-reviewer-docs.service";
import { AdsAutomationDecisionFoundationSnapshotService } from "./ads-automation-decision-foundation-snapshot.service";
import { ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE } from "./ads-automation-decision-foundation-snapshot.fixture";
import { AdsAutomationApiReadinessGapReportService } from "./ads-automation-api-readiness-gap-report.service";
import { AdsAutomationLossLimitPolicyService } from "./ads-automation-loss-limit-policy.service";
import { AdsAutomationMonitoringIncidentReadinessService } from "./ads-automation-monitoring-incident-readiness.service";
import { AdsAutomationMonitoringTelemetryReadModelService } from "./ads-automation-monitoring-telemetry-read-model.service";
import { ADS_AUTOMATION_MONITORING_TELEMETRY_READ_MODEL_FIXTURE } from "./ads-automation-monitoring-telemetry-read-model.fixture";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import { ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE } from "./ads-automation-readonly-platform-import-readiness.fixture";
import { AdsAutomationSourceReadinessReviewExportService } from "./ads-automation-source-readiness-review-export.service";
import { AdsAutomationErpSourceImportReadinessService } from "./ads-automation-erp-source-import-readiness.service";
import { AdsAutomationApprovalPreflightReviewExportService } from "./ads-automation-approval-preflight-review-export.service";
import { ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE } from "./ads-automation-approval-preflight-review-export.fixture";
import { AdsAutomationManagerAccountControlPlaneService } from "./ads-automation-manager-account-control-plane.service";
import { AdsAutomationFinalGateReviewExportService } from "./ads-automation-final-gate-review-export.service";
import { AdsAutomationFinalGoNoGoGateService } from "./ads-automation-final-go-no-go-gate.service";
import { AdsAutomationFoundationAcceptanceMatrixService } from "./ads-automation-foundation-acceptance-matrix.service";
import { AdsAutomationGoogleAdsDryRunReconciliationService } from "./ads-automation-google-ads-dry-run-reconciliation.service";
import { AdsAutomationGoogleAdsMockImportDemoService } from "./ads-automation-google-ads-mock-import-demo.service";
import { AdsAutomationProviderAccountReadinessService } from "./ads-automation-provider-account-readiness.service";
import { AdsAutomationProductionReadinessBridgeService } from "./ads-automation-production-readiness-bridge.service";
import { AdsAutomationCredentialVaultOnboardingService } from "./ads-automation-credential-vault-onboarding.service";
import { AdsAutomationSmallCapApprovalPreflightLinkageService } from "./ads-automation-small-cap-approval-preflight-linkage.service";
import { AdsAutomationSmallCapReadinessSimulatorService } from "./ads-automation-small-cap-readiness-simulator.service";
import { AdsAutomationPlatformSourceSyncStatusService } from "./ads-automation-platform-source-sync-status.service";
import { AdsAutomationApprovalEvidenceIndexService } from "./ads-automation-approval-evidence-index.service";
import { AdsAutomationApprovalEvidenceReviewExportService } from "./ads-automation-approval-evidence-review-export.service";
import { AdsAutomationApprovalEvidenceReviewerDocsService } from "./ads-automation-approval-evidence-reviewer-docs.service";
import { AdsAutomationPolicyDecisionAuditLinkageService } from "./ads-automation-policy-decision-audit-linkage.service";
import { AdsAutomationDecisionMongoReadModelRepository } from "./ads-automation-decision-mongo-read-model.repository";
import { AdsAutomationDecisionReadModelQueryService } from "./ads-automation-decision-read-model-query.service";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationExecutionPreflightDryRunReadbackService } from "./ads-automation-execution-preflight-dry-run-readback.service";
import { AdsAutomationExecutionPreflightDryRunRepository } from "./ads-automation-execution-preflight-dry-run.repository";
import { AdsAutomationExecutionPreflightDryRunService } from "./ads-automation-execution-preflight-dry-run.service";
import { AdsAutomationPendingErpActionNormalizerService } from "./ads-automation-pending-erp-action-normalizer.service";
import { AdsAutomationPolicyDecisionEvidenceReadbackService } from "./ads-automation-policy-decision-evidence-readback.service";
import { AdsAutomationPolicyDecisionEvidenceRepository } from "./ads-automation-policy-decision-evidence.repository";
import { AdsAutomationProviderValidateOnlyPlannerService } from "./ads-automation-provider-validate-only-planner.service";
import { AdsAutomationValidateOnlyEvidenceReadbackService } from "./ads-automation-validate-only-evidence-readback.service";
import { AdsAutomationValidateOnlyEvidenceRepository } from "./ads-automation-validate-only-evidence.repository";
import { AiDataPackController } from "./ai-data-pack.controller";
import { DataQualityReportService } from "./data-quality-report.service";
import { DecisionHistoryExportService } from "./decision-history-export.service";
import { DirectorDataPackService } from "./director-data-pack.service";
import { JsonExporterService } from "./export/json-exporter.service";
import { XlsxExporterService } from "./export/xlsx-exporter.service";
import { MappingReportService } from "./mapping-report.service";
import { MarketerDataPackService } from "./marketer-data-pack.service";
import { SourceSyncOrchestratorService } from "./source-sync/source-sync-orchestrator.service";
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
  AdsAutomationDecisionDraftApprovalFinalDecisionStatus,
  AdsAutomationDecisionDraftApprovalReadModelQuery,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from "./contracts/ads-automation-decision-draft-approval.contract";
import type { AdsAutomationExecutionPreflightDryRunRecord } from "./contracts/ads-automation-execution-preflight-dry-run.contract";
import type {
  AdsAutomationPolicyDecisionEvidenceInput,
  AdsAutomationPolicyDecisionEvidenceRecord,
} from "./contracts/ads-automation-policy-decision-evidence.contract";
import type { AdsAutomationValidateOnlyEvidenceRecord } from "./contracts/ads-automation-validate-only-evidence.contract";
import type { AdsAutomationProviderValidateOnlyActionPlan } from "./contracts/ads-automation-provider-validate-only.contract";

describe("AiDataPackController RBAC", () => {
  let app: INestApplication;
  const result = { metadata: { schema_version: "1.0" }, sections: {} };
  const evidenceWindow = { from: "2026-06-21", to: "2026-07-04", days: 14 };
  const freshAt = "2026-07-04T04:00:00.000Z";
  const approvalRecordsByApprovalId = new Map<
    string,
    AdsAutomationDecisionDraftPendingApprovalRecord
  >();
  const executionRecordsByExecutionRecordId = new Map<
    string,
    AdsAutomationExecutionPreflightDryRunRecord
  >();
  const executionRecordsByIdempotencyKey = new Map<
    string,
    AdsAutomationExecutionPreflightDryRunRecord
  >();
  const validateOnlyEvidenceRecordsById = new Map<
    string,
    AdsAutomationValidateOnlyEvidenceRecord
  >();
  const validateOnlyEvidenceRecordsByIdempotencyKey = new Map<
    string,
    AdsAutomationValidateOnlyEvidenceRecord
  >();
  const policyEvidenceRecordsById = new Map<
    string,
    AdsAutomationPolicyDecisionEvidenceRecord
  >();
  const policyEvidenceRecordsByIdempotencyKey = new Map<
    string,
    AdsAutomationPolicyDecisionEvidenceRecord
  >();
  const approvalRepository = {
    findExistingIdempotencyKeys: jest.fn(async (idempotencyKeys: string[]) => {
      const existing = new Set<string>();
      for (const key of idempotencyKeys) {
        if (
          Array.from(approvalRecordsByApprovalId.values()).some(
            (record) => record.idempotency_key === key,
          )
        ) {
          existing.add(key);
        }
      }
      return existing;
    }),
    createMany: jest.fn(
      async (records: AdsAutomationDecisionDraftPendingApprovalRecord[]) => {
        for (const record of records) {
          approvalRecordsByApprovalId.set(record.approval_id, record);
        }
        return records;
      },
    ),
    listPendingApprovals: jest.fn(
      async (query: AdsAutomationDecisionDraftApprovalReadModelQuery) =>
        Array.from(approvalRecordsByApprovalId.values()).filter(
          (record) =>
            record.status === "pending_approval" &&
            (!query.status || record.status === query.status) &&
            (!query.action_type || record.action_type === query.action_type) &&
            (!query.action_family ||
              record.action_family === query.action_family) &&
            (!query.provider || record.provider === query.provider) &&
            (!query.accountId || record.accountId === query.accountId) &&
            (!query.productId || record.productId === query.productId) &&
            (!query.supplierId || record.supplierId === query.supplierId),
        ),
    ),
    countPendingApprovals: jest.fn(
      async () =>
        Array.from(approvalRecordsByApprovalId.values()).filter(
          (record) => record.status === "pending_approval",
        ).length,
    ),
    findByApprovalId: jest.fn(async (approvalId: string) => {
      const record = approvalRecordsByApprovalId.get(approvalId);
      return record?.status === "pending_approval" ? record : null;
    }),
    findByApprovalIds: jest.fn(async (approvalIds: string[]) =>
      approvalIds
        .map((approvalId) => approvalRecordsByApprovalId.get(approvalId))
        .filter(
          (record): record is AdsAutomationDecisionDraftPendingApprovalRecord =>
            Boolean(record),
        ),
    ),
    transitionPendingApprovalStatus: jest.fn(
      async (
        approvalId: string,
        status: AdsAutomationDecisionDraftApprovalFinalDecisionStatus,
      ) => {
        const record = approvalRecordsByApprovalId.get(approvalId);
        if (!record || record.status !== "pending_approval") return null;
        const updated = { ...record, status };
        approvalRecordsByApprovalId.set(approvalId, updated);
        return updated;
      },
    ),
  };
  const auditRepository = {
    createFromPreview: jest.fn(
      async (
        payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
      ) => persistedAudit(payload, false),
    ),
    createFromDecision: jest.fn(
      async (
        payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
        statusChangePerformed: boolean,
      ) => persistedAudit(payload, statusChangePerformed),
    ),
  };
  const preflightRepository = {
    createManyIdempotent: jest.fn(
      async (records: AdsAutomationExecutionPreflightDryRunRecord[]) => {
        let created = 0;
        let reused = 0;
        const createdExecutionRecordIds: string[] = [];
        const createdIdempotencyKeys: string[] = [];
        const reusedExecutionRecordIds: string[] = [];
        const reusedIdempotencyKeys: string[] = [];
        const persisted = records.map((record) => {
          const existing =
            executionRecordsByExecutionRecordId.get(
              record.execution_record_id,
            ) || executionRecordsByIdempotencyKey.get(record.idempotency_key);
          if (existing) {
            reused += 1;
            reusedExecutionRecordIds.push(existing.execution_record_id);
            reusedIdempotencyKeys.push(existing.idempotency_key);
            return existing;
          }
          created += 1;
          const persistedRecord = {
            ...record,
            preflight_record_persisted: true,
            persistence_used: true,
            durable_storage_used: true,
            erp_local_persistence_used: true,
            provider_persistence_used: false,
            storage: "erp_local_mongo",
            persistedAt: `2026-07-04T06:30:0${created}.000Z`,
          } as AdsAutomationExecutionPreflightDryRunRecord;
          executionRecordsByExecutionRecordId.set(
            record.execution_record_id,
            persistedRecord,
          );
          executionRecordsByIdempotencyKey.set(
            record.idempotency_key,
            persistedRecord,
          );
          createdExecutionRecordIds.push(persistedRecord.execution_record_id);
          createdIdempotencyKeys.push(persistedRecord.idempotency_key);
          return persistedRecord;
        });
        return {
          records: persisted,
          created,
          reused,
          createdExecutionRecordIds,
          createdIdempotencyKeys,
          reusedExecutionRecordIds,
          reusedIdempotencyKeys,
        };
      },
    ),
    findByExecutionRecordId: jest.fn(
      async (executionRecordId: string) =>
        executionRecordsByExecutionRecordId.get(
          String(executionRecordId || "").trim(),
        ) || null,
    ),
    listByApprovalId: jest.fn(async (approvalId: string) =>
      Array.from(executionRecordsByExecutionRecordId.values())
        .filter(
          (record) => record.approval_id === String(approvalId || "").trim(),
        )
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) ||
            left.execution_record_id.localeCompare(right.execution_record_id),
        ),
    ),
  };
  const validateOnlyEvidenceRepository = {
    createManyIdempotent: jest.fn(
      async (
        plans: AdsAutomationProviderValidateOnlyActionPlan[],
        context: any,
      ) => {
        let created = 0;
        let reused = 0;
        const persisted = plans.map((plan) => {
          const record = validateOnlyEvidenceRecord(plan, context);
          const existing =
            validateOnlyEvidenceRecordsById.get(record.validation_id) ||
            validateOnlyEvidenceRecordsByIdempotencyKey.get(
              record.idempotency_key,
            );
          if (existing) {
            reused += 1;
            return existing;
          }
          created += 1;
          validateOnlyEvidenceRecordsById.set(record.validation_id, record);
          validateOnlyEvidenceRecordsByIdempotencyKey.set(
            record.idempotency_key,
            record,
          );
          return record;
        });
        return { records: persisted, created, reused };
      },
    ),
    findByValidationIds: jest.fn(async (validationIds: string[]) =>
      validationIds
        .map((validationId) =>
          validateOnlyEvidenceRecordsById.get(
            String(validationId || "").trim(),
          ),
        )
        .filter((record): record is AdsAutomationValidateOnlyEvidenceRecord =>
          Boolean(record),
        ),
    ),
    findByValidationId: jest.fn(
      async (validationId: string) =>
        validateOnlyEvidenceRecordsById.get(
          String(validationId || "").trim(),
        ) || null,
    ),
    listByApprovalId: jest.fn(async (approvalId: string) =>
      Array.from(validateOnlyEvidenceRecordsById.values())
        .filter(
          (record) => record.approval_id === String(approvalId || "").trim(),
        )
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) ||
            left.validation_id.localeCompare(right.validation_id),
        ),
    ),
  };
  const policyEvidenceRepository = {
    createManyIdempotent: jest.fn(
      async (
        decisions: AdsAutomationPolicyDecisionEvidenceInput[],
        context: any,
      ) => {
        let created = 0;
        let reused = 0;
        const persisted = decisions.map((decision) => {
          const record = policyEvidenceRecord(decision, context);
          const existing =
            policyEvidenceRecordsById.get(record.policy_decision_id) ||
            policyEvidenceRecordsByIdempotencyKey.get(record.idempotency_key);
          if (existing) {
            reused += 1;
            return existing;
          }
          created += 1;
          policyEvidenceRecordsById.set(record.policy_decision_id, record);
          policyEvidenceRecordsByIdempotencyKey.set(
            record.idempotency_key,
            record,
          );
          return record;
        });
        return { records: persisted, created, reused };
      },
    ),
    findByPolicyDecisionIds: jest.fn(async (policyDecisionIds: string[]) =>
      policyDecisionIds
        .map((policyDecisionId) =>
          policyEvidenceRecordsById.get(String(policyDecisionId || "").trim()),
        )
        .filter((record): record is AdsAutomationPolicyDecisionEvidenceRecord =>
          Boolean(record),
        ),
    ),
    findByPolicyDecisionId: jest.fn(
      async (policyDecisionId: string) =>
        policyEvidenceRecordsById.get(String(policyDecisionId || "").trim()) ||
        null,
    ),
    listByApprovalId: jest.fn(async (approvalId: string) =>
      Array.from(policyEvidenceRecordsById.values())
        .filter(
          (record) => record.approval_id === String(approvalId || "").trim(),
        )
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) ||
            left.policy_decision_id.localeCompare(right.policy_decision_id),
        ),
    ),
  };
  const repository = {
    findAdGroupPerformanceRows: jest.fn(),
    findCampaignBudgetRows: jest.fn(),
    findProductPerformanceRows: jest.fn(),
    findSupplierSafetyRows: jest.fn(),
    findCashflowPolicyRow: jest.fn(),
    findSourceWatermarks: jest.fn(),
  };
  const sourceSyncOrchestrator = {
    prepareSourcesForExportJob: jest.fn(),
  };
  const platformSourceSyncStatus = {
    build: jest.fn(),
  };
  const erpSourceImportReadiness = {
    build: jest.fn(),
  };
  const allSafeReadonlyImportDecisionSafety = {
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
  };

  function freshReadonlyImportSourceSyncStatus(overrides: any = {}) {
    const sourceKeys = [
      "google_ads",
      "advertising_costs",
      "product_mapping",
      "inventory_profit",
      "supplier_safety",
    ];
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
        source_count: sourceKeys.length,
        ready_source_count: sourceKeys.length,
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
        ...(overrides.summary || {}),
      },
      decisionGates: {
        canUseGoogleAdsDataClaim: true,
        canGenerateActionDraft: true,
        canRecommendAdsScale: true,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
        ...(overrides.decisionGates || {}),
      },
      decisionEvidence: sourceKeys.map((sourceKey) => ({
        sourceKey,
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus:
          sourceKey === "product_mapping" ? "not_applicable" : "covered",
        lastSuccessfulSyncAt:
          sourceKey === "google_ads" ? "2026-07-04T04:30:00.000Z" : null,
        latestRecordDate: sourceKey === "product_mapping" ? null : "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      })),
      sources: [],
      ...overrides.root,
    };
  }

  function readyLabeledSourceSyncStatusWithMissingDecisionEvidence() {
    const result = freshReadonlyImportSourceSyncStatus();
    result.decisionEvidence = result.decisionEvidence.filter(
      (evidence: any) =>
        !["product_mapping", "supplier_safety"].includes(evidence.sourceKey),
    );
    return result;
  }

  function staleReadonlyImportSourceSyncStatus() {
    const result = freshReadonlyImportSourceSyncStatus({
      summary: {
        status: "blocked",
        ready_source_count: 4,
        blocked_source_count: 1,
        blocked_sources: ["advertising_costs"],
        stale_sources: ["advertising_costs"],
        next_required_action: "resolve_source_sync_blockers",
      },
      decisionGates: {
        canGenerateActionDraft: false,
        canRecommendAdsScale: false,
      },
    });
    result.decisionEvidence = result.decisionEvidence.map((evidence: any) =>
      evidence.sourceKey === "advertising_costs"
        ? {
            ...evidence,
            freshnessStatus: "stale",
            blockingReason:
              "advertising_costs_not_ready_for_ads_automation_decision",
            blockingReasons: [
              "advertising_costs_not_ready_for_ads_automation_decision",
              "freshness_stale",
            ],
            canUseForAdsAutomationDecision: false,
          }
        : evidence,
    );
    return result;
  }

  function readonlyImportSourceSyncStatusWithBlockedSource(input: {
    sourceKey: string;
    freshnessStatus: string;
    coverageStatus: string;
    blockingReasons: string[];
    latestRecordDate?: string | null;
  }) {
    const blocker = `${input.sourceKey}_not_ready_for_ads_automation_decision`;
    const result = freshReadonlyImportSourceSyncStatus({
      summary: {
        status: "blocked",
        ready_source_count: 4,
        blocked_source_count: 1,
        blocked_sources: [input.sourceKey],
        stale_sources:
          input.freshnessStatus === "stale" ? [input.sourceKey] : [],
        missing_coverage_sources:
          input.coverageStatus === "no_records_for_report_date"
            ? [input.sourceKey]
            : [],
        not_synced_sources:
          input.freshnessStatus === "missing" ||
          input.coverageStatus === "missing"
            ? [input.sourceKey]
            : [],
        next_required_action: "resolve_source_sync_blockers",
      },
      decisionGates: {
        canUseGoogleAdsDataClaim: input.sourceKey !== "google_ads",
        canGenerateActionDraft: false,
        canRecommendAdsScale: false,
      },
    });
    result.decisionEvidence = result.decisionEvidence.map((evidence: any) =>
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
              (input.coverageStatus === "covered" ? "2026-07-03" : null),
            blockingReason: blocker,
            blockingReasons: [blocker, ...input.blockingReasons],
            canUseForAdsAutomationDecision: false,
          }
        : evidence,
    );
    return result;
  }

  function readonlyImportReadyEndpointPayload(overrides: any = {}) {
    return {
      reportDate: "2026-07-04",
      now: "2026-07-04T05:00:00.000Z",
      accounts: [
        ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.accounts[0],
      ],
      metricRows:
        ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.metricRows.slice(
          0,
          2,
        ),
      decisionReadModel:
        ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.decisionReadModel,
      decisionSafety: allSafeReadonlyImportDecisionSafety,
      ...overrides,
    };
  }

  function readModelRows(overrides: any = {}) {
    return {
      adGroups: [
        {
          platform: "google",
          customerId: "1234567890",
          accountId: "1234567890",
          campaignId: "1001",
          adGroupId: "2001",
          resourceName: "customers/1234567890/adGroups/2001",
          campaignBudgetId: "3001",
          campaignBudgetResourceName:
            "customers/1234567890/campaignBudgets/3001",
          status: "ENABLED",
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
          internalProductIds: ["P_SCALE"],
          bottlenecksChecked: true,
          lastSyncAt: freshAt,
        },
      ],
      campaignBudgets: [
        {
          customerId: "1234567890",
          campaignBudgetId: "3001",
          resourceName: "customers/1234567890/campaignBudgets/3001",
          amountVnd: 1000000,
          status: "ENABLED",
          lastSyncAt: freshAt,
        },
      ],
      products: [
        {
          productId: "P_SCALE",
          productName: "Profitable cooker",
          netProfitVnd: 1250000,
          adAttributedNetProfitAfterAdsVnd: 700000,
          marginPercent: 45,
          returnCancelRefundRatePercent: 8,
          stockAvailable: 120,
          daysOfCover: 20,
          mediaReady: true,
          landingReady: true,
          offerReady: true,
          mappedAdGroupIds: ["2001"],
          supplierIds: ["SUP_SAFE"],
          updatedAt: freshAt,
        },
      ],
      suppliers: [
        {
          productId: "P_SCALE",
          supplierId: "SUP_SAFE",
          supplierName: "Safe Supplier",
          quoteApproved: true,
          currentQuoteVnd: 180000,
          priorQuoteVnd: 185000,
          marginAfterCostPercent: 42,
          leadTimeDays: 4,
          lateDeliveryRatePercent: 3,
          paymentFreshnessDays: 5,
          capacityStatus: "available",
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
        campaign_budgets: freshAt,
        product_performance: freshAt,
        supplier_safety: freshAt,
        pause_review: freshAt,
        cashflow_policy: freshAt,
      },
      ...overrides,
    };
  }

  function useRepositoryRows(rows = readModelRows()) {
    repository.findAdGroupPerformanceRows.mockResolvedValue(rows.adGroups);
    repository.findCampaignBudgetRows.mockResolvedValue(rows.campaignBudgets);
    repository.findProductPerformanceRows.mockResolvedValue(rows.products);
    repository.findSupplierSafetyRows.mockResolvedValue(rows.suppliers);
    repository.findCashflowPolicyRow.mockResolvedValue(rows.policy);
    repository.findSourceWatermarks.mockResolvedValue(rows.watermarks);
  }

  function sourceSyncPreparation(overrides: any = {}) {
    return {
      decisionEvidence: overrides.decisionEvidence || [
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
          lastSuccessfulSyncAt: null,
          latestRecordDate: "2026-07-04",
          blockingReason: null,
          blockingReasons: [],
          canUseForAdsAutomationDecision: true,
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
      decisionGates: {
        canRecommendAdsScale: true,
        canConcludeProfitStrongly: false,
        canEvaluateSalesToday: false,
        canEvaluateFinanceStrongly: false,
        canUseLtvStrongly: false,
        canGenerateActionDraft: true,
        canUseGoogleAdsDataClaim: true,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
        ...(overrides.decisionGates || {}),
      },
    };
  }

  function validDraftPreview(
    idempotencyKey = "ads-draft:controller:2026-07-04:update_campaign_budget:2001",
  ) {
    const sourceSync = sourceSyncPreparation();
    return {
      schemaVersion: "ads_automation_decision_draft_preview.v1",
      generatedAt: "2026-07-04T05:00:00.000Z",
      source: "decision_snapshot",
      safety: {
        read_only: true,
        dry_run: true,
        persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_drafts: true,
        execution_allowed_now: false,
        future_provider_validateOnly_required: true,
      },
      sourceSyncDecisionEvidence: sourceSync.decisionEvidence,
      sourceSyncDecisionGates: sourceSync.decisionGates,
      sourceEvidence: [],
      missingFieldEvidence: [],
      queryEvidence: [],
      snapshot: {
        schemaVersion: "ads_automation_decision_snapshot.v1",
        generatedAt: "2026-07-04T05:00:00.000Z",
        snapshotDate: "2026-07-04",
        summary: {
          categories: 7,
          decisions: 1,
          scale_candidates: 1,
          pause_candidates: 0,
          product_scale_candidates: 0,
          supplier_safe_candidates: 0,
          insufficient_data_decisions: 0,
        },
      },
      summary: {
        decisions_scanned: 1,
        drafts_created: 1,
        blocked_drafts: 0,
        provider_action_drafts: 1,
        internal_task_drafts: 0,
        monitoring_drafts: 0,
      },
      drafts: [
        {
          draft_id: "ADSDRAFT-20260704-update_campaign_budget-2001",
          source_decision_id: "DEC-scale_amount-2001",
          source_decision_type: "scale_amount",
          action_type: "update_campaign_budget",
          action_family: "provider_google_ads",
          provider: "google",
          resource_type: "campaign_budget",
          entity_type: "ad_group",
          entity_id: "2001",
          platform: "google",
          accountId: "1234567890",
          productId: "P_SCALE",
          supplierId: null,
          status: "pending_approval_preview",
          approval_required: true,
          execution_allowed_now: false,
          validate_only_required: true,
          future_provider_validateOnly_required: true,
          provider_api_called: false,
          google_ads_api_called: false,
          live_ads_execution_used: false,
          persistence_used: false,
          typedPayload: {
            customerId: "1234567890",
            campaignId: "1001",
            adGroupId: "2001",
            campaignBudgetId: "3001",
            dailyBudget: 1200000,
          },
          source_evidence_references: [
            {
              decision_id: "DEC-scale_amount-2001",
              decision_type: "scale_amount",
              evidence_window: evidenceWindow,
              evidence_metrics: { orders: 12, netProfitAfterAdsVnd: 700000 },
              rationale:
                "Profitable Google ad group can scale within ERP cash policy.",
              idempotency_key: "ads-decision:2026-07-04:scale_amount:2001",
              rollback_plan: "Restore previous campaign budget.",
            },
          ],
          blockers: [],
          missing_data_blockers: [],
          disallowed_actions: [
            "delete_product",
            "provider_delete",
            "auto_publish",
          ],
          idempotency_key: idempotencyKey,
          rationale:
            "Budget increase is capped by ERP policy and still requires approval.",
        },
      ],
    };
  }

  function persistedAudit(
    payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
    statusChangePerformed: boolean,
  ): AdsAutomationDecisionDraftApprovalDecisionAuditRecord {
    return {
      ...payload,
      idempotency_key: [
        "ads-decision-audit",
        payload.approval_id,
        payload.decision,
        payload.requestId || payload.audit_id,
      ].join(":"),
      audit_record_persisted: true,
      status_change_performed: statusChangePerformed,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: "erp_local_mongo",
      source_preview_createdAt: payload.createdAt,
      persistedAt: "2026-07-04T05:11:00.000Z",
    };
  }

  function policyEvidenceRecord(
    input: AdsAutomationPolicyDecisionEvidenceInput,
    context: {
      requestId?: string | null;
      requestedByUserId?: string | null;
      requestedByRole?: string | null;
      createdAt?: string | null;
    } = {},
  ): AdsAutomationPolicyDecisionEvidenceRecord {
    const approvalId = String(input.approval_id || "").trim();
    const requestId =
      String(input.requestId ?? context.requestId ?? "").trim() || null;
    const createdAt = String(
      context.createdAt || input.evaluatedAt || "2026-07-04T06:10:00.000Z",
    );
    const policyDecisionId =
      String(input.policy_decision_id || "").trim() ||
      `ADSPOLICY-${approvalId.replace(/[^a-z0-9._:-]/gi, "_")}-${String(requestId || createdAt).replace(/[^a-z0-9._:-]/gi, "_")}`;

    return {
      schemaVersion: "ads_automation_execution_policy_decision_evidence.v1",
      policy_decision_id: policyDecisionId,
      idempotency_key: [
        "ads-policy-decision",
        approvalId.replace(/[^a-z0-9._:-]/gi, "_"),
        String(requestId || policyDecisionId).replace(/[^a-z0-9._:-]/gi, "_"),
      ].join(":"),
      approval_id: approvalId,
      policy_allowed: input.policy_allowed === true,
      policy_source: input.policy_source ? String(input.policy_source) : null,
      blockers: Array.isArray(input.blockers)
        ? input.blockers.map(String).filter(Boolean)
        : [],
      evaluatedAt: input.evaluatedAt ? String(input.evaluatedAt) : createdAt,
      policy_decision_record_persisted: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      direct_google_ads_api_call: false,
      provider_mutation_used: false,
      live_path_implemented: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: "erp_local_mongo",
      requestedByUserId: input.requestedByUserId
        ? String(input.requestedByUserId)
        : context.requestedByUserId || null,
      requestedByRole: input.requestedByRole
        ? String(input.requestedByRole)
        : context.requestedByRole || null,
      requestId,
      createdAt,
      persistedAt: "2026-07-04T06:12:00.000Z",
    };
  }

  function validateOnlyEvidenceRecord(
    input: AdsAutomationProviderValidateOnlyActionPlan,
    context: {
      requestId?: string | null;
      requestedByUserId?: string | null;
      requestedByRole?: string | null;
      createdAt?: string | null;
    } = {},
  ): AdsAutomationValidateOnlyEvidenceRecord {
    const requestId = String(context.requestId ?? "").trim() || null;
    const createdAt = String(
      context.createdAt ||
        input.providerValidatedAt ||
        "2026-07-04T06:05:00.000Z",
    );
    return {
      ...JSON.parse(JSON.stringify(input)),
      schemaVersion: "ads_automation_validate_only_evidence.v1",
      idempotency_key: [
        "ads-validate-only-evidence",
        input.approval_id.replace(/[^a-z0-9._:-]/gi, "_"),
        String(requestId || input.validation_id).replace(
          /[^a-z0-9._:-]/gi,
          "_",
        ),
      ].join(":"),
      validateOnly_evidence_persisted: true,
      future_live_execution_allowed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      direct_google_ads_api_call: false,
      provider_mutation_used: false,
      live_path_implemented: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: "erp_local_mongo",
      requestedByUserId: context.requestedByUserId || null,
      requestedByRole: context.requestedByRole || null,
      requestId,
      createdAt,
      persistedAt: "2026-07-04T06:13:00.000Z",
    };
  }

  function validationPlanForApproval(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord,
  ): AdsAutomationProviderValidateOnlyActionPlan {
    const payload = approval.typedPayload || {};
    return {
      validation_id: `ADSPROVIDERVALIDATE-${approval.approval_id}`,
      pending_action_id: `ADSPENDINGACTION-${approval.approval_id}`,
      approval_id: approval.approval_id,
      source_pending_action_status: "pending_validation",
      action_type: approval.action_type as any,
      action_family: approval.action_family,
      provider: approval.provider,
      resource_type: approval.resource_type,
      entity_type: approval.entity_type,
      entity_id: approval.entity_id,
      customerId: String(payload.customerId || approval.accountId || ""),
      campaignId: payload.campaignId ? String(payload.campaignId) : null,
      adGroupId: payload.adGroupId ? String(payload.adGroupId) : null,
      campaignBudgetId: payload.campaignBudgetId
        ? String(payload.campaignBudgetId)
        : null,
      campaignBudgetResourceName: payload.campaignBudgetResourceName
        ? String(payload.campaignBudgetResourceName)
        : null,
      requested_change: { action_type: approval.action_type, ...payload },
      status: "validate_only_passed",
      providerValidationStatus: "provider_validate_passed",
      providerRequestId: "REQ-CONTROLLER-VALIDATE-ONLY-MOCK",
      providerValidatedAt: "2026-07-04T06:00:00.000Z",
      providerValidationErrors: [],
      before_state_snapshot: {
        snapshot_status: "mocked_boundary_snapshot",
        required_before_future_execution: true,
        source: "erp_synced_google_ads_read_model",
        customerId: String(payload.customerId || approval.accountId || ""),
        campaignId: payload.campaignId ? String(payload.campaignId) : null,
        adGroupId: payload.adGroupId ? String(payload.adGroupId) : null,
        campaignBudgetId: payload.campaignBudgetId
          ? String(payload.campaignBudgetId)
          : null,
        campaignBudgetResourceName: payload.campaignBudgetResourceName
          ? String(payload.campaignBudgetResourceName)
          : null,
        snapshot: { syncedAt: "2026-07-04T05:55:00.000Z" },
      },
      provider_boundary_evidence: {
        boundary_mode: "erp_local_mock_only",
        status_source: "mock_provider_result",
        mocked_provider_result_used: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        direct_google_ads_api_call: false,
        operation_builder_called: false,
        raw_provider_request_included: false,
        evidence: [
          "Controller fixture uses mocked validate-only evidence only.",
        ],
      },
      provider_account_readiness: null,
      blockers: [],
      approval_can_be_considered_executable: true,
      executable_now: false,
      execution_allowed_now: false,
      validate_only_required_before_execution: true,
      next_required_action: "continue_human_approval_flow",
      source_pending_action: {} as any,
    };
  }

  function safeLossLimitPolicyForBudgetUpdate() {
    return {
      schemaVersion: "ads_automation_loss_limit_policy.v1",
      generatedAt: "2026-07-04T06:18:00.000Z",
      reportDate: "2026-07-04",
      safety: {},
      summary: {
        status: "ready_for_local_review",
        fixture_mode: "custom_local_payload",
        requested_action_type: "update_campaign_budget",
        requested_action_mode: "scale_up",
        policy_allowed_for_requested_action: true,
        all_safe_for_increase: true,
        scale_up_execution_mode: "pending_validation",
        human_approval_required: true,
        human_approval_present: true,
        emergency_stop_active: false,
        daily_loss_limit_safe: true,
        monthly_loss_limit_safe: true,
        spend_caps_safe: true,
        gross_margin_safe: true,
        contribution_profit_safe: true,
        cash_conversion_working_capital_safe: true,
        stock_coverage_safe: true,
        supplier_reliability_safe: true,
        fulfillment_capacity_safe: true,
        return_refund_risk_safe: true,
        data_freshness_safe: true,
        campaignBudgetId_missing: false,
        safe_reduction_or_pause_available: true,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "review_local_loss_limit_policy_evidence",
      },
      action: {},
      approval: {},
      checks: [],
      spendCapDecisions: [],
      economicsDecisions: [],
      scaleBlockers: [],
      requestedActionBlockers: [],
      safeActionsAvailable: ["monitor_only"],
      markdownPreview: "Controller fixture only.",
    };
  }

  function monitoringTelemetryReadModelForLinkage(input: {
    approvalId: string;
    policyDecisionId: string;
    validationId: string;
    executionRecordId: string;
    idempotencyKey: string;
  }) {
    const binding = {
      approvalId: input.approvalId,
      policyDecisionId: input.policyDecisionId,
      validateOnlyValidationId: input.validationId,
      executionRecordId: input.executionRecordId,
      idempotencyKey: input.idempotencyKey,
      rollbackPlanId: `ADSROLLBACK-${safeTelemetryKey(input.approvalId)}-${safeTelemetryKey(input.executionRecordId)}`,
      lossLimitPolicyReportDate: "2026-07-04",
      customerId: "1234567890",
      accountId: "1234567890",
      campaignId: "1001",
      adGroupId: "2001",
      campaignBudgetId: "3001",
    };
    const fixture = JSON.parse(
      JSON.stringify(ADS_AUTOMATION_MONITORING_TELEMETRY_READ_MODEL_FIXTURE),
    );
    fixture.records = fixture.records.map((record: any) => ({
      ...record,
      accountId: "1234567890",
      customerId: "1234567890",
      campaignId: "1001",
      adGroupId: "2001",
      campaignBudgetId: "3001",
      decisionBinding: binding,
    }));
    return new AdsAutomationMonitoringTelemetryReadModelService().build(
      fixture,
    );
  }

  function safeTelemetryKey(value: unknown): string {
    return String(value || "unknown")
      .replace(/[^a-z0-9_-]/gi, "_")
      .slice(0, 96);
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AiDataPackController],
      providers: [
        Reflector,
        RolesGuard,
        JsonExporterService,
        XlsxExporterService,
        {
          provide: AdsAutomationDecisionDraftApprovalRepository,
          useValue: approvalRepository,
        },
        {
          provide: AdsAutomationDecisionDraftApprovalDecisionAuditRepository,
          useValue: auditRepository,
        },
        {
          provide: AdsAutomationExecutionPreflightDryRunRepository,
          useValue: preflightRepository,
        },
        {
          provide: AdsAutomationValidateOnlyEvidenceRepository,
          useValue: validateOnlyEvidenceRepository,
        },
        {
          provide: AdsAutomationPolicyDecisionEvidenceRepository,
          useValue: policyEvidenceRepository,
        },
        AdsAutomationDecisionDraftApprovalQueueService,
        AdsAutomationDecisionDraftApprovalDecisionMutationService,
        AdsAutomationApprovalEvidenceIndexService,
        AdsAutomationApprovalEvidenceReviewExportService,
        AdsAutomationApprovalEvidenceReviewerDocsService,
        AdsAutomationPolicyDecisionAuditLinkageService,
        AdsAutomationExecutionPreflightDryRunReadbackService,
        AdsAutomationExecutionPreflightDryRunService,
        AdsAutomationPolicyDecisionEvidenceReadbackService,
        AdsAutomationValidateOnlyEvidenceReadbackService,
        AdsAutomationDecisionDraftPreviewService,
        AdsAutomationDecisionService,
        AdsAutomationDecisionFoundationSnapshotService,
        AdsAutomationDecisionFoundationReviewExportService,
        AdsAutomationDecisionFoundationReviewerDocsService,
        AdsAutomationPendingErpActionNormalizerService,
        AdsAutomationProviderValidateOnlyPlannerService,
        AdsAutomationApiReadinessGapReportService,
        AdsAutomationLossLimitPolicyService,
        AdsAutomationMonitoringIncidentReadinessService,
        AdsAutomationSourceReadinessReviewExportService,
        {
          provide: AdsAutomationErpSourceImportReadinessService,
          useValue: erpSourceImportReadiness,
        },
        AdsAutomationApprovalPreflightReviewExportService,
        AdsAutomationManagerAccountControlPlaneService,
        AdsAutomationProviderAccountReadinessService,
        AdsAutomationFinalGateReviewExportService,
        AdsAutomationFinalGoNoGoGateService,
        AdsAutomationFoundationAcceptanceMatrixService,
        AdsAutomationGoogleAdsDryRunReconciliationService,
        AdsAutomationGoogleAdsMockImportDemoService,
        AdsAutomationProductionReadinessBridgeService,
        AdsAutomationCredentialVaultOnboardingService,
        AdsAutomationSmallCapApprovalPreflightLinkageService,
        AdsAutomationSmallCapReadinessSimulatorService,
        AdsAutomationReadonlyPlatformImportReadinessService,
        AdsAutomationDecisionSourceAdapterService,
        AdsAutomationDecisionReadModelQueryService,
        {
          provide: AdsAutomationDecisionMongoReadModelRepository,
          useValue: repository,
        },
        {
          provide: AdsAutomationPlatformSourceSyncStatusService,
          useValue: platformSourceSyncStatus,
        },
        {
          provide: SourceSyncOrchestratorService,
          useValue: sourceSyncOrchestrator,
        },
        {
          provide: DirectorDataPackService,
          useValue: { build: jest.fn().mockResolvedValue(result) },
        },
        {
          provide: MarketerDataPackService,
          useValue: { build: jest.fn().mockResolvedValue(result) },
        },
        {
          provide: DataQualityReportService,
          useValue: { build: jest.fn().mockResolvedValue(result) },
        },
        {
          provide: MappingReportService,
          useValue: { build: jest.fn().mockResolvedValue(result) },
        },
        {
          provide: DecisionHistoryExportService,
          useValue: { build: jest.fn().mockResolvedValue(result) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          req.user = { id: "user-1", role: req.headers["x-test-role"] };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    approvalRecordsByApprovalId.clear();
    executionRecordsByExecutionRecordId.clear();
    executionRecordsByIdempotencyKey.clear();
    validateOnlyEvidenceRecordsById.clear();
    validateOnlyEvidenceRecordsByIdempotencyKey.clear();
    policyEvidenceRecordsById.clear();
    policyEvidenceRecordsByIdempotencyKey.clear();
    useRepositoryRows();
    sourceSyncOrchestrator.prepareSourcesForExportJob.mockResolvedValue(
      sourceSyncPreparation(),
    );
    platformSourceSyncStatus.build.mockResolvedValue({
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
        status: "blocked",
        source_count: 3,
        ready_source_count: 2,
        blocked_source_count: 1,
        blocked_sources: ["advertising_costs"],
        missing_config_sources: [],
        stale_sources: ["advertising_costs"],
        missing_coverage_sources: [],
        not_synced_sources: [],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "resolve_source_sync_blockers",
      },
      decisionGates: {
        canUseGoogleAdsDataClaim: true,
        canGenerateActionDraft: false,
        canRecommendAdsScale: false,
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
          freshnessStatus: "stale",
          coverageStatus: "covered",
          lastSuccessfulSyncAt: null,
          latestRecordDate: "2026-07-04",
          blockingReason:
            "advertising_costs_not_ready_for_ads_automation_decision",
          blockingReasons: [
            "advertising_costs_not_ready_for_ads_automation_decision",
            "freshness_stale",
          ],
          canUseForAdsAutomationDecision: false,
        },
      ],
      sources: [
        {
          sourceKey: "google_ads",
          provider: "google_ads",
          platform: "google_ads",
          domain: "ads",
          businessImportance: "critical",
          status: "ready",
          requiredConfigPresence: [],
          missingCredentialOrConfigBlockers: [],
          reportDateCoverage: {
            reportDate: "2026-07-04",
            coverageStatus: "covered",
            reportDateRecordCount: 7,
            expectedRecordCount: null,
          },
          freshness: {
            freshnessStatus: "fresh",
            maxStalenessMinutes: 60,
            freshnessMinutes: 15,
            staleByMinutes: 0,
            lastSuccessfulSyncAt: "2026-07-04T04:30:00.000Z",
            latestRecordUpdatedAt: "2026-07-04T04:45:00.000Z",
            latestRecordDate: "2026-07-04",
            latestSuccessfulSyncOrReadModelWatermark:
              "2026-07-04T04:30:00.000Z",
          },
          sourceSyncBlockers: [],
          warnings: [],
          canUseForAdsAutomationDecision: true,
          usableForAdsAutomationDecisions: true,
        },
        {
          sourceKey: "advertising_costs",
          provider: "erp_local",
          platform: "erp_advertising_costs",
          domain: "ads",
          businessImportance: "critical",
          status: "stale",
          requiredConfigPresence: [],
          missingCredentialOrConfigBlockers: [],
          reportDateCoverage: {
            reportDate: "2026-07-04",
            coverageStatus: "covered",
            reportDateRecordCount: 7,
            expectedRecordCount: null,
          },
          freshness: {
            freshnessStatus: "stale",
            maxStalenessMinutes: 360,
            freshnessMinutes: 720,
            staleByMinutes: 360,
            lastSuccessfulSyncAt: null,
            latestRecordUpdatedAt: "2026-07-03T17:00:00.000Z",
            latestRecordDate: "2026-07-04",
            latestSuccessfulSyncOrReadModelWatermark:
              "2026-07-03T17:00:00.000Z",
          },
          sourceSyncBlockers: ["freshness_stale"],
          warnings: [],
          canUseForAdsAutomationDecision: false,
          usableForAdsAutomationDecisions: false,
        },
      ],
    });
  });

  afterAll(async () => app.close());

  it("allows Director Data Pack only for roles with director permission", async () => {
    await request(app.getHttpServer())
      .get("/ai/director/data-pack?date=2026-06-12")
      .set("x-test-role", "director")
      .expect(200);
    await request(app.getHttpServer())
      .get("/ai/director/data-pack?date=2026-06-12")
      .set("x-test-role", "manager")
      .expect(403);
  });

  it("allows manager to read marketer, quality and mapping reports", async () => {
    await request(app.getHttpServer())
      .get("/ai/marketer/data-pack?date=2026-06-12")
      .set("x-test-role", "manager")
      .expect(200);
    await request(app.getHttpServer())
      .get("/ai/data-quality/report?date=2026-06-12")
      .set("x-test-role", "manager")
      .expect(200);
    await request(app.getHttpServer())
      .get("/ai/mapping/report?date=2026-06-12")
      .set("x-test-role", "manager")
      .expect(200);
  });

  it("returns a protected read-only decision snapshot from read-model repository rows", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-read-model-snapshot")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
        maxAgeHours: { campaign_budgets: 24 },
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotDate: "2026-07-04",
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
      }),
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        repository_read_only: true,
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
      }),
    );
    expect(response.body.snapshot.summary.scale_candidates).toBe(1);
    expect(response.body.snapshot.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision_type: "scale_amount",
          entity_id: "2001",
          execution_allowed_now: false,
          proposedValue: expect.objectContaining({
            action: "update_campaign_budget_draft",
            campaignBudgetId: "3001",
            proposedBudgetVnd: 1200000,
          }),
        }),
      ]),
    );
    expect(response.body.queryEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "campaign_budgets",
          entityId: "2001",
          status: "loaded",
          missingFields: [],
        }),
      ]),
    );
  });

  it("returns the BA-facing read-only decision foundation snapshot from local fixture input", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-foundation-snapshot")
      .set("x-test-role", "manager")
      .send(ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE)
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_foundation_snapshot.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.scale_ads_decision.decision).toBe("increase");
    expect(response.body.scale_amount.total_increase_vnd).toBe(200000);
    expect(response.body.target_ad_groups.items[0]).toEqual(
      expect.objectContaining({
        entity_id: "AG_SCALE",
        status: "scale_ready",
      }),
    );
    expect(response.body.product_budget_allocation.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_id: "P_SCALE",
          status: "scale_ready",
        }),
      ]),
    );
    expect(response.body.supplier_gate.safe_suppliers).toEqual([
      expect.objectContaining({ entity_id: "SUP_SAFE", status: "safe" }),
    ]);
    expect(response.body.product_kill_review).toEqual(
      expect.objectContaining({
        product_delete_allowed: false,
        candidates: expect.arrayContaining([
          expect.objectContaining({ entity_id: "P_BAD" }),
        ]),
      }),
    );
    expect(
      response.body.campaign_or_ad_group_pause_candidates.candidates,
    ).toEqual([
      expect.objectContaining({
        entity_id: "AG_PAUSE",
        status: "needs_review",
      }),
    ]);
    expect(response.body.blockers.global).toEqual(
      expect.arrayContaining([
        "capacity_blocked",
        "return_cancel_refund_rate_too_high",
      ]),
    );
    expect(response.body.evidence_links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision_type: "scale_amount",
          entity_id: "AG_SCALE",
        }),
      ]),
    );
  });

  it("returns the BA-facing decision foundation snapshot from read-model repository rows with evidence", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-foundation-read-model-snapshot")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
        maxAgeHours: { campaign_budgets: 24 },
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotDate: "2026-07-04",
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
      }),
    );
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_foundation_snapshot.v1",
    );
    expect(response.body.source).toBe("mongo_read_model");
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary.explicit_ba_fields_present).toBe(true);
    expect(response.body.scale_ads_decision.decision).toBe("increase");
    expect(response.body.scale_amount.items[0].proposedValue).toEqual(
      expect.objectContaining({
        action: "update_campaign_budget_draft",
        campaignBudgetId: "3001",
        proposedBudgetVnd: 1200000,
      }),
    );
    expect(response.body.sourceEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "campaign_budgets",
          status: "fresh",
          canUseForDecision: "yes",
        }),
      ]),
    );
    expect(response.body.missingFieldEvidence).toEqual([]);
    expect(response.body.queryEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "campaign_budgets",
          entityId: "2001",
          status: "loaded",
          missingFields: [],
        }),
      ]),
    );
  });

  it("returns a protected BA reviewer export for the decision foundation read-model snapshot", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-foundation-read-model-review-export")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
        maxAgeHours: { campaign_budgets: 24 },
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotDate: "2026-07-04",
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
      }),
    );
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_foundation_read_model_review_export.v1",
    );
    expect(response.body.exportMode).toBe("local_readback");
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        repository_read_only: true,
        read_model_query_used: true,
        foundation_snapshot_reused: true,
        reviewer_export_readback: true,
        reviewer_export_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        execution_allowed_now: false,
        production_ready: false,
        campaignBudgetId_fallback_used: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        export_status: "ready_for_review",
        read_model_source: "mongo_read_model",
        source_evidence_records: 6,
        missing_field_evidence_records: 0,
        scale_ads_decision: "increase",
        scale_candidates: 1,
        total_increase_vnd: 200000,
        campaignBudgetId_required: true,
        campaignBudgetId_fallback_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        execution_allowed_now: false,
        next_required_action: "inspect_foundation_review_export",
      }),
    );
    expect(response.body.foundationSnapshot).toEqual(
      expect.objectContaining({
        schemaVersion: "ads_automation_decision_foundation_snapshot.v1",
        source: "mongo_read_model",
        sourceEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceKey: "campaign_budgets",
            status: "fresh",
            canUseForDecision: "yes",
          }),
        ]),
        missingFieldEvidence: [],
        queryEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceKey: "campaign_budgets",
            entityId: "2001",
            status: "loaded",
          }),
        ]),
      }),
    );
    expect(
      response.body.foundationSnapshot.scale_amount.items[0].proposedValue,
    ).toEqual(
      expect.objectContaining({
        action: "update_campaign_budget_draft",
        campaignBudgetId: "3001",
        proposedBudgetVnd: 1200000,
      }),
    );
    expect(response.body.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "safety_gates",
          lines: expect.arrayContaining([
            "execution_allowed_now=false",
            "provider_api_called=false",
            "google_ads_api_called=false",
            "validateOnly_called=false",
            "live_ads_execution_used=false",
          ]),
        }),
        expect.objectContaining({
          section_id: "campaign_budget_join",
          status: "passed",
          lines: expect.arrayContaining([
            "campaignBudgetId_fallback_used=false",
          ]),
        }),
      ]),
    );
    expect(response.body.markdownPreview).toContain(
      "Ads Automation Foundation Review Export",
    );
    expect(response.body.markdownPreview).toContain(
      "Safety gates: execution_allowed_now=false",
    );
  });

  it("returns protected BA reviewer docs for the decision foundation review export without full snapshot payload", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-foundation-read-model-reviewer-docs")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
        maxAgeHours: { campaign_budgets: 24 },
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotDate: "2026-07-04",
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
      }),
    );
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_foundation_read_model_reviewer_docs.v1",
    );
    expect(response.body.docsMode).toBe("local_readback_docs");
    expect(response.body.foundationSnapshot).toBeUndefined();
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        repository_read_only: true,
        read_model_query_used: true,
        foundation_snapshot_reused: true,
        source_review_export_reused: true,
        reviewer_export_readback: true,
        reviewer_docs_readback: true,
        reviewer_docs_persistence_performed: false,
        full_foundation_snapshot_payload_included: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        execution_allowed_now: false,
        production_ready: false,
        campaignBudgetId_fallback_used: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        docs_status: "ready_for_review",
        source_export_schema_version:
          "ads_automation_decision_foundation_read_model_review_export.v1",
        read_model_source: "mongo_read_model",
        rendered_sections: 8,
        attention_sections: 0,
        source_evidence_records_rendered: 6,
        query_evidence_records_rendered: 5,
        campaignBudgetId_required: true,
        campaignBudgetId_fallback_used: false,
        full_foundation_snapshot_payload_included: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        execution_allowed_now: false,
        next_required_action: "inspect_foundation_reviewer_docs",
      }),
    );
    expect(response.body.routeExamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "POST",
          path: "/ai/ads-automation/decision-foundation-read-model-reviewer-docs",
          provider_api_called: false,
          erp_mutation_used: false,
        }),
        expect.objectContaining({
          method: "POST",
          path: "/ai/ads-automation/decision-foundation-read-model-review-export",
        }),
      ]),
    );
    expect(response.body.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "safety_gates",
          lines: expect.arrayContaining([
            "execution_allowed_now=false",
            "provider_api_called=false",
            "google_ads_api_called=false",
            "validateOnly_called=false",
            "live_ads_execution_used=false",
          ]),
        }),
        expect.objectContaining({
          section_id: "campaign_budget_join",
          status: "passed",
          lines: expect.arrayContaining([
            "campaignBudgetId_fallback_used=false",
          ]),
        }),
      ]),
    );
    expect(response.body.markdownPreview).toContain(
      "Ads Automation Foundation Reviewer Docs",
    );
    expect(response.body.markdownPreview).toContain(
      "Full foundationSnapshot payload included: false",
    );
    expect(response.body.sourceExportDigest).toEqual(
      expect.objectContaining({
        schemaVersion:
          "ads_automation_decision_foundation_read_model_review_export.v1",
        review_export_route:
          "/ai/ads-automation/decision-foundation-read-model-review-export",
        omitted_payloads: ["foundationSnapshot"],
        full_foundation_snapshot_payload_included: false,
      }),
    );
  });

  it("returns protected approval/preflight review export fixture evidence with execution flags closed", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/approval-preflight-review-export")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_approval_preflight_review_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T08:00:00.000Z",
      })
      .expect(200);

    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_approval_preflight_review_export.v1",
    );
    expect(response.body.exportMode).toBe("local_demo_fixture");
    expect(response.body.query).toEqual(
      expect.objectContaining({
        reportDate: "2026-07-04",
        fixture: "htx_ads_approval_preflight_review_demo",
      }),
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        fixture_or_payload_only: true,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        direct_google_ads_api_call: false,
        provider_mutation_used: false,
        campaignBudgetId_no_fallback: true,
        approval_required_for_all_provider_actions: true,
        future_live_execution_allowed: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        export_status: "blocked_before_future_execution",
        source_readiness_export_status: "needs_attention",
        validateOnly_plans_received: 2,
        validateOnly_passed: 1,
        validateOnly_pending_or_blocked: 1,
        pending_approvals_received: 2,
        execution_preflight_records_received: 2,
        approval_decision_audit_records_received: 1,
        idempotency_duplicate_keys: 0,
        action_reviews: 3,
        scale_candidates_reviewed: 1,
        scale_candidates_blocked: 1,
        safety_actions_visible: 2,
        monitor_only_actions_visible: 1,
        executable_now: 0,
        future_live_execution_allowed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.sourceDigest).toEqual(
      expect.objectContaining({
        source_readiness_schema_version:
          "ads_automation_source_readiness_review_export.v1",
        validateOnly_lane_schema_version:
          "ads_automation_provider_validate_only_lane.v1",
        execution_preflight_schema_version:
          "ads_automation_execution_preflight_dry_run.v1",
        duplicate_idempotency_keys: [],
        campaignBudgetId_no_fallback: true,
      }),
    );
    expect(response.body.sourceDecisionAnswerReview).toEqual(
      expect.objectContaining({
        may_increase_ads: false,
        max_increase_vnd: 0,
        ad_groups_to_increase: [],
        products_can_receive_budget: [],
        safe_supplier_choices: [],
        product_kill_or_stop_review_needed: false,
        campaign_or_ad_group_pause_recommended: true,
        execution_allowed_now: false,
      }),
    );
    expect(
      response.body.sourceDecisionAnswerReview
        .blocked_product_budget_candidates,
    ).toEqual([expect.objectContaining({ entityId: "P_SCALE_BLOCKED" })]);
    expect(
      response.body.sourceDecisionAnswerReview.blocked_supplier_choices,
    ).toEqual([expect.objectContaining({ entityId: "SUP_STALE" })]);
    expect(response.body.sourceDecisionAnswerReview.blocking_reasons).toEqual(
      expect.arrayContaining([
        "source_readiness_review_not_ready",
        "campaignBudgetId_missing_no_fallback",
        "cashflow_first_scale_mode_monitor_only",
      ]),
    );
    expect(response.body.sourceDigest.sourceDecisionAnswerReview).toEqual(
      response.body.sourceDecisionAnswerReview,
    );

    const scaleAction = response.body.actionReviews.find(
      (action: any) => action.action_type === "update_campaign_budget",
    );
    const pauseAction = response.body.actionReviews.find(
      (action: any) => action.action_type === "pause_campaign",
    );
    const monitorOnlyAction = response.body.actionReviews.find(
      (action: any) => action.action_type === "monitor_only",
    );

    expect(scaleAction).toEqual(
      expect.objectContaining({
        status: "blocked",
        campaignBudgetId: null,
        idempotency_safe: false,
        idempotency_duplicate: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(scaleAction.gateBlockers.campaignBudgetId).toEqual(
      expect.arrayContaining([
        "campaignBudgetId_missing_no_fallback",
        "campaignBudgetId_missing_in_source_readiness_review",
      ]),
    );
    expect(scaleAction.gateBlockers.idempotency).toEqual(
      expect.arrayContaining(["idempotency_key_unsafe_or_missing"]),
    );

    expect(pauseAction).toEqual(
      expect.objectContaining({
        status: "reviewable_safety_action",
        idempotency_safe: true,
        idempotency_duplicate: false,
        preflight_status: "blocked_before_future_live_execution",
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(pauseAction.gateStatuses).toEqual(
      expect.objectContaining({
        audit_preflight: "blocked",
        production_flag: "blocked",
      }),
    );
    expect(pauseAction.gateBlockers.audit_preflight).toEqual([
      "future_live_execution_allowed_false_local_only",
      "live_path_not_implemented",
    ]);
    expect(pauseAction.gateBlockers.production_flag).toEqual([
      "GOOGLE_ADS_PRODUCTION_ENABLED",
      "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
    ]);

    expect(monitorOnlyAction).toEqual(
      expect.objectContaining({
        status: "monitor_only_visible",
        provider: "none",
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(response.body.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "source_decision_answers",
          status: "attention",
          lines: expect.arrayContaining([
            "may_increase_ads=false",
            "max_increase_vnd=0",
            "ad_groups_to_increase=none",
            "products_can_receive_budget=none",
            "blocked_product_budget_candidates=P_SCALE_BLOCKED",
            "safe_supplier_choices=none",
            "blocked_supplier_choices=SUP_STALE",
            "product_kill_or_stop_review_needed=false",
            "campaign_or_ad_group_pause_recommended=true",
            expect.stringContaining("blocking_reasons="),
          ]),
        }),
        expect.objectContaining({
          section_id: "closed_execution_flags",
          lines: expect.arrayContaining([
            "provider_api_called=false",
            "google_ads_api_called=false",
            "validateOnly_called=false",
            "live_ads_execution_used=false",
            "execution_allowed_now=false",
            "production_ready=false",
          ]),
        }),
      ]),
    );
    expect(response.body.markdownPreview).toContain(
      "Safety gates: provider_api_called=false",
    );
  });

  it("rejects malformed approval/preflight custom source readiness envelopes", async () => {
    const payload: any = JSON.parse(
      JSON.stringify(ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE),
    );
    payload.sourceReadinessReviewExport.schemaVersion = "wrong";

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/approval-preflight-review-export")
      .set("x-test-role", "manager")
      .send(payload)
      .expect(400);

    expect(response.body.message).toBe(
      "sourceReadinessReviewExport must be ads_automation_source_readiness_review_export.v1",
    );
    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
  });

  it("rejects malformed approval/preflight custom validate-only lane envelopes", async () => {
    const payload: any = JSON.parse(
      JSON.stringify(ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE),
    );
    payload.validateOnlyLane = {
      ...payload.validateOnlyLane,
      validationPlans: null,
    };

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/approval-preflight-review-export")
      .set("x-test-role", "manager")
      .send(payload)
      .expect(400);

    expect(response.body.message).toBe(
      "validateOnlyLane must be ads_automation_provider_validate_only_lane.v1",
    );
    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
  });

  it("returns draft previews from an already-built decision snapshot without repository or provider calls", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-preview")
      .set("x-test-role", "manager")
      .send({
        schemaVersion: "ads_automation_decision_snapshot.v1",
        generatedAt: "2026-07-04T05:00:00.000Z",
        snapshotDate: "2026-07-04",
        summary: {
          categories: 7,
          decisions: 1,
          scale_candidates: 1,
          pause_candidates: 0,
          product_scale_candidates: 0,
          supplier_safe_candidates: 0,
          insufficient_data_decisions: 0,
        },
        decisions: [
          {
            decision_id: "DEC-scale_amount-2001",
            decision_type: "scale_amount",
            entity_type: "ad_group",
            entity_id: "2001",
            platform: "google",
            accountId: "1234567890",
            productId: "P_SCALE",
            supplierId: null,
            currentValue: {
              campaignId: "1001",
              adGroupId: "2001",
              campaignBudgetId: "3001",
              currentBudgetVnd: 1000000,
            },
            proposedValue: {
              action: "update_campaign_budget_draft",
              campaignBudgetId: "3001",
              proposedBudgetVnd: 1200000,
              currentBudgetVnd: 1000000,
              increaseVnd: 200000,
              increasePercent: 20,
            },
            evidence_window: evidenceWindow,
            evidence_metrics: { orders: 12, netProfitAfterAdsVnd: 700000 },
            data_quality_score: 0.92,
            confidence: "high",
            risk_level: "low",
            status: "scale_ready",
            blockers: [],
            missing_fields: [],
            next_required_data: [],
            approval_required: true,
            execution_allowed_now: false,
            idempotency_key: "ads-decision:2026-07-04:scale_amount:2001",
            rollback_plan: "Restore previous campaign budget.",
            rationale: "Budget increase is capped by ERP policy.",
          },
        ],
      })
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.source).toBe("decision_snapshot");
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.drafts).toEqual([
      expect.objectContaining({
        action_type: "update_campaign_budget",
        approval_required: true,
        execution_allowed_now: false,
        validate_only_required: true,
        provider_api_called: false,
        google_ads_api_called: false,
        typedPayload: expect.objectContaining({
          campaignBudgetId: "3001",
          dailyBudget: 1200000,
        }),
      }),
    ]);
  });

  it("composes read-model rows into decision draft previews with source evidence", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-preview")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
        maxAgeHours: { campaign_budgets: 24 },
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotDate: "2026-07-04",
        customerIds: ["1234567890"],
        productIds: ["P_SCALE"],
      }),
    );
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        exportJobId: "ads-draft-preview-20260704",
        correlationId: "ads-draft-preview-20260704",
        reportDate: "2026-07-04",
        dateFrom: "2026-06-21",
        dateTo: "2026-07-04",
        packTypes: ["marketer"],
        sourceKeys: [
          "google_ads",
          "advertising_costs",
          "product_mapping",
          "inventory_profit",
          "supplier_safety",
        ],
        syncPolicy: "export_cached",
        customerIds: ["1234567890"],
        now: new Date("2026-07-04T05:00:00.000Z"),
      }),
    );
    expect(response.body.source).toBe("mongo_read_model");
    expect(response.body.sourceSyncDecisionGates).toEqual(
      expect.objectContaining({
        canGenerateActionDraft: true,
        canUseGoogleAdsDataClaim: true,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
    expect(response.body.sourceSyncDecisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          reportDate: "2026-07-04",
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "advertising_costs",
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "product_mapping",
          coverageStatus: "not_applicable",
          canUseForAdsAutomationDecision: true,
        }),
      ]),
    );
    expect(response.body.queryEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "campaign_budgets",
          entityId: "2001",
          status: "loaded",
        }),
      ]),
    );
    expect(response.body.drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "update_campaign_budget",
          status: "pending_approval_preview",
          typedPayload: expect.objectContaining({
            campaignBudgetId: "3001",
            dailyBudget: 1200000,
          }),
        }),
      ]),
    );
  });

  it("automatically source-gates read-model decision draft previews when cached source sync evidence is stale", async () => {
    sourceSyncOrchestrator.prepareSourcesForExportJob.mockResolvedValueOnce(
      sourceSyncPreparation({
        decisionGates: {
          canRecommendAdsScale: false,
          canGenerateActionDraft: false,
          canUseGoogleAdsDataClaim: false,
        },
        decisionEvidence: [
          {
            sourceKey: "google_ads",
            reportDate: "2026-07-04",
            freshnessStatus: "stale",
            coverageStatus: "covered",
            lastSuccessfulSyncAt: "2026-07-03T20:00:00.000Z",
            latestRecordDate: "2026-07-04",
            blockingReason: "google_ads_not_ready_for_ads_automation_decision",
            blockingReasons: [
              "freshness_stale",
              "google_ads_not_ready_for_ads_automation_decision",
            ],
            canUseForAdsAutomationDecision: false,
          },
          {
            sourceKey: "advertising_costs",
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
        ],
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-preview")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        customerIds: ["1234567890"],
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        syncPolicy: "export_cached",
        sourceKeys: [
          "google_ads",
          "advertising_costs",
          "product_mapping",
          "inventory_profit",
          "supplier_safety",
        ],
      }),
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.sourceSyncDecisionGates).toEqual(
      expect.objectContaining({
        canGenerateActionDraft: false,
        canUseGoogleAdsDataClaim: false,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
    expect(response.body.sourceSyncDecisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          freshnessStatus: "stale",
          blockingReasons: expect.arrayContaining([
            "freshness_stale",
            "google_ads_not_ready_for_ads_automation_decision",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        blocked_drafts: expect.any(Number),
      }),
    );
    expect(response.body.drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "update_campaign_budget",
          status: "blocked_missing_data",
          provider_api_called: false,
          google_ads_api_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          missing_data_blockers: expect.arrayContaining([
            "source_sync_gate_blocked_action_draft",
            "freshness_stale",
            "google_ads_not_ready_for_ads_automation_decision",
          ]),
        }),
      ]),
    );
  });

  it("imports protected draft previews into a durable pending approval queue without read-model or provider calls", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(validDraftPreview())
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(approvalRepository.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          storage: "erp_local_mongo",
          durable_storage_used: true,
          erp_local_persistence_used: true,
          provider_persistence_used: false,
        }),
      ]),
    );
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_draft_approval_import.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        dry_run: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.pendingApprovals).toEqual([
      expect.objectContaining({
        action_type: "update_campaign_budget",
        status: "pending_approval",
        approval_required: true,
        execution_allowed_now: false,
        validate_only_required: true,
        provider_api_called: false,
        google_ads_api_called: false,
        durable_storage_used: true,
        storage: "erp_local_mongo",
        typedPayload: expect.objectContaining({
          campaignBudgetId: "3001",
          dailyBudget: 1200000,
        }),
      }),
    ]);
  });

  it("rejects stale source-gated draft preview imports at the controller before creating pending approvals", async () => {
    const payload: any = validDraftPreview(
      "ads-draft:controller:stale-source-sync-gate:update_campaign_budget:2001",
    );
    payload.source = "mongo_read_model";
    payload.sourceSyncDecisionEvidence = [
      {
        sourceKey: "google_ads",
        reportDate: "2026-07-04",
        freshnessStatus: "stale",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: "2026-07-03T20:00:00.000Z",
        latestRecordDate: "2026-07-04",
        blockingReason: "google_ads_not_ready_for_ads_automation_decision",
        blockingReasons: [
          "freshness_stale",
          "google_ads_not_ready_for_ads_automation_decision",
        ],
        canUseForAdsAutomationDecision: false,
      },
      {
        sourceKey: "advertising_costs",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: null,
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
    ];
    payload.sourceSyncDecisionGates = {
      canRecommendAdsScale: false,
      canConcludeProfitStrongly: false,
      canEvaluateSalesToday: false,
      canEvaluateFinanceStrongly: false,
      canUseLtvStrongly: false,
      canGenerateActionDraft: false,
      canUseGoogleAdsDataClaim: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
    payload.summary = {
      ...payload.summary,
      drafts_created: 0,
      blocked_drafts: 1,
      provider_action_drafts: 0,
    };
    payload.drafts[0] = {
      ...payload.drafts[0],
      status: "blocked_missing_data",
      blockers: [
        "source_sync_gate_blocked_action_draft",
        "freshness_stale",
        "google_ads_not_ready_for_ads_automation_decision",
      ],
      missing_data_blockers: [
        "source_sync_gate_blocked_action_draft",
        "freshness_stale",
        "google_ads_not_ready_for_ads_automation_decision",
      ],
    };

    const rejected = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(payload)
      .expect(400);

    expect(rejected.body.message).toContain(
      "source-sync gate does not allow pending approval import",
    );
    expect(rejected.body.message).toContain(
      "source_sync_gate_blocked_action_draft",
    );
    expect(rejected.body.message).toContain("freshness_stale");
    expect(rejected.body.message).toContain(
      "google_ads_not_ready_for_ads_automation_decision",
    );
    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(
      approvalRepository.findExistingIdempotencyKeys,
    ).not.toHaveBeenCalled();
    expect(approvalRepository.createMany).not.toHaveBeenCalled();
    expect(payload.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(payload.drafts[0]).toEqual(
      expect.objectContaining({
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      }),
    );

    const queue = await request(app.getHttpServer())
      .get("/ai/ads-automation/decision-draft-approvals")
      .set("x-test-role", "manager")
      .expect(200);

    expect(queue.body.summary).toEqual(
      expect.objectContaining({
        total_pending_approvals: 0,
        pending_approvals_listed: 0,
        provider_action_approvals: 0,
        internal_task_approvals: 0,
        monitoring_approvals: 0,
      }),
    );
    expect(queue.body.pendingApprovals).toEqual([]);
    expect(queue.body.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
  });

  it("lists and reads protected pending approval records from durable storage without read-model or provider calls", async () => {
    const payload = validDraftPreview(
      "ads-draft:controller:queue-read:update_campaign_budget:QUEUE_ACCOUNT",
    );
    payload.drafts[0].accountId = "QUEUE_ACCOUNT";
    payload.drafts[0].typedPayload = {
      ...payload.drafts[0].typedPayload,
      customerId: "QUEUE_ACCOUNT",
    };

    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(payload)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals?accountId=QUEUE_ACCOUNT",
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(approvalRepository.listPendingApprovals).toHaveBeenCalledWith({
      accountId: "QUEUE_ACCOUNT",
    });
    expect(list.body.schemaVersion).toBe(
      "ads_automation_decision_draft_approval_queue.v1",
    );
    expect(list.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_records: true,
        execution_allowed_now: false,
      }),
    );
    expect(list.body.summary).toEqual(
      expect.objectContaining({
        pending_approvals_listed: 1,
        provider_action_approvals: 1,
        internal_task_approvals: 0,
        monitoring_approvals: 0,
      }),
    );
    expect(list.body.pendingApprovals).toEqual([
      expect.objectContaining({
        approval_id: imported.body.pendingApprovals[0].approval_id,
        action_type: "update_campaign_budget",
        accountId: "QUEUE_ACCOUNT",
        status: "pending_approval",
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        storage: "erp_local_mongo",
        durable_storage_used: true,
        typedPayload: expect.objectContaining({
          customerId: "QUEUE_ACCOUNT",
          campaignBudgetId: "3001",
        }),
      }),
    ]);

    const single = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${imported.body.pendingApprovals[0].approval_id}`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith(
      imported.body.pendingApprovals[0].approval_id,
    );
    expect(single.body.schemaVersion).toBe(
      "ads_automation_decision_draft_approval_record.v1",
    );
    expect(single.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(single.body.pendingApproval).toEqual(
      expect.objectContaining({
        approval_id: imported.body.pendingApprovals[0].approval_id,
        accountId: "QUEUE_ACCOUNT",
        approval_required: true,
        execution_allowed_now: false,
      }),
    );
  });

  it("preserves imported source-sync evidence in protected pending approval readback and readiness views", async () => {
    const payload: any = validDraftPreview(
      "ads-draft:controller:source-sync-readback:update_campaign_budget:2001",
    );
    payload.source = "mongo_read_model";
    payload.sourceSyncDecisionEvidence = [
      {
        sourceKey: "google_ads",
        reportDate: "2026-07-04",
        freshnessStatus: "stale",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: "2026-07-03T20:00:00.000Z",
        latestRecordDate: "2026-07-04",
        blockingReason: "google_ads_not_ready_for_ads_automation_decision",
        blockingReasons: [
          "freshness_stale",
          "google_ads_not_ready_for_ads_automation_decision",
        ],
        canUseForAdsAutomationDecision: false,
      },
      {
        sourceKey: "advertising_costs",
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        lastSuccessfulSyncAt: null,
        latestRecordDate: "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
    ];
    payload.sourceSyncDecisionGates = {
      canRecommendAdsScale: false,
      canConcludeProfitStrongly: false,
      canEvaluateSalesToday: false,
      canEvaluateFinanceStrongly: false,
      canUseLtvStrongly: false,
      canGenerateActionDraft: true,
      canUseGoogleAdsDataClaim: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };

    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(payload)
      .expect(200);
    const approvalId = imported.body.pendingApprovals[0].approval_id;

    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(imported.body.pendingApprovals[0]).toEqual(
      expect.objectContaining({
        sourceSyncDecisionEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceKey: "google_ads",
            freshnessStatus: "stale",
            canUseForAdsAutomationDecision: false,
          }),
        ]),
        sourceSyncDecisionGates: expect.objectContaining({
          canGenerateActionDraft: true,
          canUseGoogleAdsDataClaim: false,
        }),
      }),
    );

    const list = await request(app.getHttpServer())
      .get("/ai/ads-automation/decision-draft-approvals?provider=google")
      .set("x-test-role", "manager")
      .expect(200);
    expect(list.body.pendingApprovals).toEqual([
      expect.objectContaining({
        approval_id: approvalId,
        sourceSyncDecisionEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceKey: "google_ads",
            blockingReasons: expect.arrayContaining([
              "freshness_stale",
              "google_ads_not_ready_for_ads_automation_decision",
            ]),
            canUseForAdsAutomationDecision: false,
          }),
        ]),
        sourceSyncDecisionGates: expect.objectContaining({
          canGenerateActionDraft: true,
          canUseGoogleAdsDataClaim: false,
        }),
      }),
    ]);

    const single = await request(app.getHttpServer())
      .get(`/ai/ads-automation/decision-draft-approvals/${approvalId}`)
      .set("x-test-role", "manager")
      .expect(200);
    expect(single.body.pendingApproval.sourceSyncDecisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          blockingReason: "google_ads_not_ready_for_ads_automation_decision",
        }),
      ]),
    );
    expect(single.body.pendingApproval.sourceSyncDecisionGates).toEqual(
      expect.objectContaining({
        canGenerateActionDraft: true,
      }),
    );

    const readiness = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/readiness`,
      )
      .set("x-test-role", "manager")
      .expect(200);
    expect(readiness.body.summary).toEqual(
      expect.objectContaining({
        readiness_status: "blocked",
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "fix_blockers_before_review",
      }),
    );
    expect(readiness.body.blockers).toEqual(
      expect.arrayContaining([
        "freshness_stale",
        "google_ads_not_ready_for_ads_automation_decision",
        "source_sync_decision_evidence",
      ]),
    );
    expect(readiness.body.prerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "source_sync_decision_evidence",
          status: "blocked",
        }),
      ]),
    );
    expect(readiness.body.pendingApproval).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        sourceSyncDecisionEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceKey: "google_ads",
            canUseForAdsAutomationDecision: false,
          }),
        ]),
        sourceSyncDecisionGates: expect.objectContaining({
          canGenerateActionDraft: true,
        }),
      }),
    );

    jest.clearAllMocks();
    const evidenceIndex = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index`,
      )
      .set("x-test-role", "manager")
      .expect(200);
    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(evidenceIndex.body.summary).toEqual(
      expect.objectContaining({
        readback_status: "listed",
        pending_approval_record_matched: true,
        source_sync_decision_evidence_records_matched: 2,
        source_sync_decision_blocked_sources: 1,
        source_sync_gate_status: "blocked",
        source_sync_can_generate_action_draft: true,
        source_sync_can_use_google_ads_data_claim: false,
        source_sync_blocking_reasons: expect.arrayContaining([
          "freshness_stale",
          "google_ads_not_ready_for_ads_automation_decision",
        ]),
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "inspect_approval_evidence_index",
      }),
    );
    expect(evidenceIndex.body.sourceSyncDecisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(evidenceIndex.body.sourceSyncDecisionGates).toEqual(
      expect.objectContaining({
        canGenerateActionDraft: true,
        canUseGoogleAdsDataClaim: false,
      }),
    );

    const reviewExport = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-export`,
      )
      .set("x-test-role", "manager")
      .expect(200);
    expect(reviewExport.body.summary).toEqual(
      expect.objectContaining({
        export_status: "ready_for_review",
        total_evidence_records_included: 2,
        pending_approval_record_included: true,
        source_sync_decision_evidence_records_included: 2,
        source_sync_decision_blocked_sources: 1,
        source_sync_gate_status: "blocked",
        source_sync_blocking_reasons: expect.arrayContaining([
          "google_ads_not_ready_for_ads_automation_decision",
        ]),
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "inspect_reviewer_export",
      }),
    );

    const reviewerDocs = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-docs`,
      )
      .set("x-test-role", "manager")
      .expect(200);
    expect(reviewerDocs.body.summary).toEqual(
      expect.objectContaining({
        docs_status: "ready_for_review",
        total_evidence_records_rendered: 2,
        pending_approval_record_rendered: true,
        source_sync_decision_evidence_records_rendered: 2,
        source_sync_decision_blocked_sources_rendered: 1,
        source_sync_gate_status: "blocked",
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "inspect_reviewer_docs",
      }),
    );
    expect(reviewerDocs.body.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "source_sync_evidence",
          status: "attention",
          lines: expect.arrayContaining([
            "Pending approval source-sync record: found",
            "Source-sync evidence records: 2",
            "Blocked source-sync sources: 1",
            expect.stringContaining(
              "google_ads_not_ready_for_ads_automation_decision",
            ),
          ]),
        }),
      ]),
    );
    expect(reviewerDocs.body.markdownPreview).toContain(
      "Source-sync gate status: blocked",
    );
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
  });

  it("returns protected dry-run readiness for a durable budget update pending approval", async () => {
    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(
        validDraftPreview(
          "ads-draft:controller:readiness:update_campaign_budget:2001",
        ),
      )
      .expect(200);

    const approvalId = imported.body.pendingApprovals[0].approval_id;
    const response = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/readiness`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_draft_approval_readiness.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_records: true,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        readiness_status: "ready_for_human_review",
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        blockers_count: 0,
        next_required_action: "human_review",
      }),
    );
    expect(response.body.prerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "typedPayload.campaignBudgetId",
          status: "valid",
        }),
        expect.objectContaining({
          key: "future_provider_validateOnly_required",
          status: "valid",
        }),
      ]),
    );
    expect(response.body.blockers).toEqual([]);
    expect(response.body.pendingApproval).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        status: "pending_approval",
        approval_required: true,
        execution_allowed_now: false,
        typedPayload: expect.objectContaining({
          campaignBudgetId: "3001",
          dailyBudget: 1200000,
        }),
      }),
    );
  });

  it("returns protected dry-run decision validation for a durable budget update approval without status mutation", async () => {
    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(
        validDraftPreview(
          "ads-draft:controller:decision-validation:update_campaign_budget:2001",
        ),
      )
      .expect(200);

    const approvalId = imported.body.pendingApprovals[0].approval_id;
    const response = await request(app.getHttpServer())
      .post(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/decision-validation`,
      )
      .set("x-test-role", "manager")
      .send({
        decision: "approve",
        reason: "Manager reviewed ERP evidence and budget cap.",
        requestId: "REQ-CONTROLLER-APPROVE-DRY-RUN",
      })
      .expect(200);

    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_draft_approval_decision_validation.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_records: true,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        validation_status: "eligible_for_human_decision",
        proposed_decision: "approve",
        approval_required: true,
        execution_allowed_now: false,
        status_change_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "future_approve_endpoint",
      }),
    );
    expect(response.body.proposedDecision).toEqual(
      expect.objectContaining({
        decision: "approve",
        reviewerUserId: "user-1",
        reviewerRole: "manager",
        requestId: "REQ-CONTROLLER-APPROVE-DRY-RUN",
        would_update_status_to: "approved",
        status_change_performed: false,
      }),
    );
    expect(response.body.prerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "reviewerUserId", status: "valid" }),
        expect.objectContaining({ key: "decision.reason", status: "valid" }),
        expect.objectContaining({
          key: "typedPayload.campaignBudgetId",
          status: "valid",
        }),
      ]),
    );
    expect(response.body.blockers).toEqual([]);
    expect(response.body.pendingApproval).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        status: "pending_approval",
        approval_required: true,
        execution_allowed_now: false,
        typedPayload: expect.objectContaining({
          campaignBudgetId: "3001",
          dailyBudget: 1200000,
        }),
      }),
    );
  });

  it("returns protected dry-run decision audit record preview without status mutation or audit persistence", async () => {
    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(
        validDraftPreview(
          "ads-draft:controller:decision-audit-preview:update_campaign_budget:2001",
        ),
      )
      .expect(200);

    const approvalId = imported.body.pendingApprovals[0].approval_id;
    jest.clearAllMocks();

    const response = await request(app.getHttpServer())
      .post(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/decision-audit-record-preview`,
      )
      .set("x-test-role", "manager")
      .send({
        decision: "approve",
        reason:
          "Manager reviewed ERP evidence and wants to preview the audit payload.",
        requestId: "REQ-CONTROLLER-AUDIT-APPROVE-DRY-RUN",
      })
      .expect(200);

    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(approvalRepository.createMany).not.toHaveBeenCalled();
    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_draft_approval_decision_audit_record_preview.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_records: true,
        execution_allowed_now: false,
        audit_record_persisted: false,
        status_change_performed: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        audit_preview_status: "ready_for_future_audit_persist",
        proposed_decision: "approve",
        approval_required: true,
        execution_allowed_now: false,
        audit_record_persisted: false,
        status_change_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        blockers_count: 0,
        next_required_action: "future_approve_endpoint",
      }),
    );
    expect(response.body.proposedDecision).toEqual(
      expect.objectContaining({
        decision: "approve",
        reviewerUserId: "user-1",
        reviewerRole: "manager",
        requestId: "REQ-CONTROLLER-AUDIT-APPROVE-DRY-RUN",
        would_update_status_to: "approved",
        status_change_performed: false,
      }),
    );
    expect(response.body.decisionValidation.summary).toEqual(
      expect.objectContaining({
        validation_status: "eligible_for_human_decision",
        proposed_decision: "approve",
        status_change_performed: false,
      }),
    );
    expect(response.body.auditRecordPreview).toEqual(
      expect.objectContaining({
        schemaVersion:
          "ads_automation_decision_draft_approval_decision_audit_record.v1",
        approval_id: approvalId,
        decision: "approve",
        previous_status: "pending_approval",
        proposed_status: "approved",
        reviewerUserId: "user-1",
        reviewerRole: "manager",
        requestId: "REQ-CONTROLLER-AUDIT-APPROVE-DRY-RUN",
        validation_status: "eligible_for_human_decision",
        audit_record_persisted: false,
        status_change_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.auditRecordPreview.prerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "typedPayload.campaignBudgetId",
          status: "valid",
        }),
      ]),
    );
    expect(response.body.pendingApproval).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        status: "pending_approval",
        approval_required: true,
        execution_allowed_now: false,
        typedPayload: expect.objectContaining({
          campaignBudgetId: "3001",
          dailyBudget: 1200000,
        }),
      }),
    );
  });

  it("lets a director approve a pending draft with persisted local audit while keeping ads execution disabled", async () => {
    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(
        validDraftPreview(
          "ads-draft:controller:decision-mutation:update_campaign_budget:2001",
        ),
      )
      .expect(200);

    const approvalId = imported.body.pendingApprovals[0].approval_id;
    jest.clearAllMocks();

    const response = await request(app.getHttpServer())
      .post(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/decision`,
      )
      .set("x-test-role", "director")
      .send({
        decision: "approve",
        reason:
          "Director approves the ERP-local budget draft after reviewing evidence.",
        requestId: "REQ-CONTROLLER-APPROVE-MUTATION-LOCAL",
      })
      .expect(200);

    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(auditRepository.createFromDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        approval_id: approvalId,
        decision: "approve",
        proposed_status: "approved",
        validation_status: "eligible_for_human_decision",
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
      true,
    );
    expect(
      approvalRepository.transitionPendingApprovalStatus,
    ).toHaveBeenCalledWith(approvalId, "approved");
    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_decision_draft_approval_decision_mutation.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: false,
        dry_run: true,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        execution_allowed_now: false,
        audit_record_persisted: true,
        status_change_performed: true,
        approval_status_mutation_used: true,
        approved_record_executable: false,
        rejected_record_executable: false,
        duplicate_decision_rejected: true,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        mutation_status: "approved",
        proposed_decision: "approve",
        validation_status: "eligible_for_human_decision",
        resulting_status: "approved",
        audit_record_persisted: true,
        status_change_performed: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        next_required_action: "future_validateOnly_before_execution",
      }),
    );
    expect(response.body.auditRecord).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        decision: "approve",
        audit_record_persisted: true,
        status_change_performed: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.approvalBefore).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        status: "pending_approval",
        execution_allowed_now: false,
      }),
    );
    expect(response.body.approvalAfter).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        status: "approved",
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      }),
    );

    await request(app.getHttpServer())
      .post(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/decision`,
      )
      .set("x-test-role", "manager")
      .send({
        decision: "approve",
        reason: "Manager should not approve local ads decisions.",
        requestId: "REQ-CONTROLLER-MANAGER-BLOCKED",
      })
      .expect(403);
  });

  it("lets a director record local execution preflight dry-run evidence for an approved draft", async () => {
    delete process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(
        validDraftPreview(
          "ads-draft:controller:execution-preflight:update_campaign_budget:2001",
        ),
      )
      .expect(200);

    const approvalId = imported.body.pendingApprovals[0].approval_id;
    const decision = await request(app.getHttpServer())
      .post(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/decision`,
      )
      .set("x-test-role", "director")
      .send({
        decision: "approve",
        reason:
          "Director approves this local ERP action before dry-run preflight.",
        requestId: "REQ-CONTROLLER-APPROVE-BEFORE-PREFLIGHT",
      })
      .expect(200);

    const approved = approvalRecordsByApprovalId.get(approvalId)!;
    jest.clearAllMocks();

    const response = await request(app.getHttpServer())
      .post(
        "/ai/ads-automation/decision-draft-approvals/execution-preflight-dry-run",
      )
      .set("x-test-role", "director")
      .send({
        approvalIds: [approvalId],
        validationPlans: [validationPlanForApproval(approved)],
        approvalDecisionAuditRecords: [decision.body.auditRecord],
        policyDecisions: [
          {
            approval_id: approvalId,
            policy_allowed: true,
            policy_source: "erp_cashflow_ads_policy",
            blockers: [],
          },
        ],
        requestId: "REQ-CONTROLLER-EXEC-PREFLIGHT-DRY-RUN",
      })
      .expect(200);

    expect(approvalRepository.findByApprovalIds).toHaveBeenCalledWith([
      approvalId,
    ]);
    expect(repository.findAdGroupPerformanceRows).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_execution_preflight_dry_run.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: false,
        dry_run: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        execution_allowed_now: false,
        dry_run_execution_records_created: true,
        dry_run_execution_records_persisted: true,
        idempotency_enforced: true,
        live_path_implemented: false,
        provider_mutation_used: false,
        direct_google_ads_api_call: false,
        future_live_execution_requires_validateOnly_passed: true,
        future_live_execution_requires_approved_action: true,
        future_live_execution_requires_approval_decision_audit: true,
        future_live_execution_requires_source_readiness_safe: true,
        future_live_execution_requires_policy_allowed: true,
        future_live_execution_requires_kill_switch_off: true,
        future_live_execution_requires_safe_idempotency_key: true,
        future_live_execution_requires_GOOGLE_ADS_PRODUCTION_ENABLED_true: true,
        campaignBudgetId_no_fallback: true,
        validateOnly_id_linkage_supported: true,
        validateOnly_evidence_persistence_used: true,
        policy_decision_id_linkage_supported: true,
        policy_decision_evidence_persistence_used: true,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        approvals_requested: 1,
        approvals_loaded: 1,
        records_created: 1,
        supported_action_records: 1,
        future_live_gates_passed_local_only: 0,
        blocked_before_future_live_execution: 1,
        dry_run_records_created: 1,
        dry_run_records_persisted: 1,
        idempotent_records_reused: 0,
        approval_decision_audit_records_received: 1,
        source_readiness_blocked_records: 0,
        kill_switch_blocked_records: 0,
        validateOnly_validation_id_references_requested: 0,
        validateOnly_evidence_records_loaded: 0,
        validateOnly_evidence_records_persisted: 1,
        validateOnly_evidence_records_reused: 0,
        policy_decision_id_references_requested: 0,
        policy_decision_records_loaded: 0,
        policy_decision_records_persisted: 1,
        policy_decision_records_reused: 0,
        executable_now: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(response.body.executionRecords[0]).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        action_type: "update_campaign_budget",
        approval_status: "approved",
        approval_decision_audit_id: decision.body.auditRecord.audit_id,
        approval_decision_audit_persisted: true,
        source_readiness_safe: true,
        kill_switch_active: false,
        validateOnly_validation_id: expect.any(String),
        validateOnly_evidence_persisted: true,
        validateOnly_status: "validate_only_passed",
        policy_decision_id: expect.any(String),
        policy_decision_evidence_persisted: true,
        preflight_status: "blocked_before_future_live_execution",
        dry_run_record_status: "recorded_local_only",
        preflight_record_persisted: true,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        campaignBudgetId_fallback_used: false,
        blockers: expect.arrayContaining(["GOOGLE_ADS_PRODUCTION_ENABLED"]),
        identifiers: expect.objectContaining({
          campaignId: "1001",
          adGroupId: "2001",
          campaignBudgetId: "3001",
        }),
      }),
    );
    expect(preflightRepository.createManyIdempotent).toHaveBeenCalledWith([
      expect.objectContaining({
        approval_id: approvalId,
        validateOnly_validation_id: expect.any(String),
        validateOnly_evidence_persisted: true,
        policy_decision_id: expect.any(String),
        policy_decision_evidence_persisted: true,
        requestId: "REQ-CONTROLLER-EXEC-PREFLIGHT-DRY-RUN",
        idempotency_key: expect.stringContaining(
          "REQ-CONTROLLER-EXEC-PREFLIGHT-DRY-RUN",
        ),
      }),
    ]);

    const executionRecordId =
      response.body.executionRecords[0].execution_record_id;
    const validationId =
      response.body.executionRecords[0].validateOnly_validation_id;
    const policyDecisionId =
      response.body.executionRecords[0].policy_decision_id;
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          approval_id: approvalId,
          validation_id: validationId,
          status: "validate_only_passed",
        }),
      ],
      expect.objectContaining({
        requestId: "REQ-CONTROLLER-EXEC-PREFLIGHT-DRY-RUN",
        requestedByUserId: "user-1",
        requestedByRole: "director",
      }),
    );
    expect(policyEvidenceRepository.createManyIdempotent).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          approval_id: approvalId,
          policy_allowed: true,
          policy_source: "erp_cashflow_ads_policy",
        }),
      ],
      expect.objectContaining({
        requestId: "REQ-CONTROLLER-EXEC-PREFLIGHT-DRY-RUN",
        requestedByUserId: "user-1",
        requestedByRole: "director",
      }),
    );

    const duplicate = await request(app.getHttpServer())
      .post(
        "/ai/ads-automation/decision-draft-approvals/execution-preflight-dry-run",
      )
      .set("x-test-role", "director")
      .send({
        approvalIds: [approvalId],
        validationIds: [validationId],
        approvalDecisionAuditRecords: [decision.body.auditRecord],
        policyDecisionIds: [policyDecisionId],
        requestId: "REQ-CONTROLLER-EXEC-PREFLIGHT-DRY-RUN",
      })
      .expect(200);

    expect(duplicate.body.summary).toEqual(
      expect.objectContaining({
        future_live_gates_passed_local_only: 0,
        blocked_before_future_live_execution: 1,
        dry_run_records_persisted: 1,
        idempotent_records_reused: 1,
        idempotent_duplicate_records_blocked: 1,
        validateOnly_validation_id_references_requested: 1,
        validateOnly_evidence_records_loaded: 1,
        validateOnly_evidence_records_persisted: 0,
        validateOnly_evidence_records_reused: 0,
        policy_decision_id_references_requested: 1,
        policy_decision_records_loaded: 1,
        policy_decision_records_persisted: 0,
        policy_decision_records_reused: 0,
      }),
    );
    expect(duplicate.body.executionRecords[0]).toEqual(
      expect.objectContaining({
        execution_record_id: executionRecordId,
        validateOnly_validation_id: validationId,
        validateOnly_evidence_persisted: true,
        policy_decision_id: policyDecisionId,
        policy_decision_evidence_persisted: true,
        idempotency_key: response.body.executionRecords[0].idempotency_key,
        persistedAt: response.body.executionRecords[0].persistedAt,
        preflight_status: "blocked_before_future_live_execution",
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        blockers: expect.arrayContaining([
          "idempotency_key_safe",
          "idempotency_duplicate_record",
        ]),
        gates: expect.arrayContaining([
          expect.objectContaining({
            key: "idempotency_key_safe",
            status: "blocked",
          }),
        ]),
      }),
    );

    const validateOnlyReadback = await request(app.getHttpServer())
      .get(`/ai/ads-automation/validate-only-evidence/${validationId}`)
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.findByValidationId,
    ).toHaveBeenCalledWith(validationId);
    expect(validateOnlyReadback.body.schemaVersion).toBe(
      "ads_automation_validate_only_evidence_readback.v1",
    );
    expect(validateOnlyReadback.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        validateOnly_evidence_readback: true,
        validateOnly_evidence_persistence_performed: false,
      }),
    );
    expect(validateOnlyReadback.body.validateOnlyEvidence).toEqual(
      expect.objectContaining({
        validation_id: validationId,
        approval_id: approvalId,
        validateOnly_evidence_persisted: true,
        execution_allowed_now: false,
      }),
    );

    const readback = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/execution-preflight-dry-run/${executionRecordId}`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(preflightRepository.findByExecutionRecordId).toHaveBeenCalledWith(
      executionRecordId,
    );
    expect(readback.body.schemaVersion).toBe(
      "ads_automation_execution_preflight_dry_run_record_readback.v1",
    );
    expect(readback.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        preflight_record_readback: true,
        preflight_persistence_performed: false,
      }),
    );
    expect(readback.body.executionRecord).toEqual(
      expect.objectContaining({
        execution_record_id: executionRecordId,
        approval_id: approvalId,
        preflight_record_persisted: true,
        execution_allowed_now: false,
      }),
    );

    const policyReadback = await request(app.getHttpServer())
      .get(`/ai/ads-automation/policy-decision-evidence/${policyDecisionId}`)
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      policyEvidenceRepository.findByPolicyDecisionId,
    ).toHaveBeenCalledWith(policyDecisionId);
    expect(policyReadback.body.schemaVersion).toBe(
      "ads_automation_execution_policy_decision_evidence_readback.v1",
    );
    expect(policyReadback.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        policy_decision_evidence_readback: true,
        policy_decision_evidence_persistence_performed: false,
      }),
    );
    expect(policyReadback.body.policyDecisionEvidence).toEqual(
      expect.objectContaining({
        policy_decision_id: policyDecisionId,
        approval_id: approvalId,
        policy_decision_record_persisted: true,
        execution_allowed_now: false,
      }),
    );

    const history = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/execution-preflight-dry-run-records`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(history.body.schemaVersion).toBe(
      "ads_automation_execution_preflight_dry_run_record_history.v1",
    );
    expect(history.body.summary).toEqual(
      expect.objectContaining({
        readback_status: "listed",
        execution_records_matched: 1,
        approval_id_filter_applied: true,
        execution_allowed_now: false,
        preflight_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(history.body.executionRecords).toEqual([
      expect.objectContaining({
        execution_record_id: executionRecordId,
        approval_id: approvalId,
      }),
    ]);

    const validateOnlyHistory = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/validate-only-evidence`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).toHaveBeenCalledWith(approvalId);
    expect(validateOnlyHistory.body.schemaVersion).toBe(
      "ads_automation_validate_only_evidence_history.v1",
    );
    expect(validateOnlyHistory.body.summary).toEqual(
      expect.objectContaining({
        readback_status: "listed",
        validateOnly_evidence_records_matched: 1,
        approval_id_filter_applied: true,
        execution_allowed_now: false,
        validateOnly_evidence_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(validateOnlyHistory.body.validateOnlyEvidenceRecords).toEqual([
      expect.objectContaining({
        validation_id: validationId,
        approval_id: approvalId,
      }),
    ]);

    const policyHistory = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/policy-decision-evidence`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(policyHistory.body.schemaVersion).toBe(
      "ads_automation_execution_policy_decision_evidence_history.v1",
    );
    expect(policyHistory.body.summary).toEqual(
      expect.objectContaining({
        readback_status: "listed",
        policy_decision_records_matched: 1,
        approval_id_filter_applied: true,
        execution_allowed_now: false,
        policy_decision_evidence_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(policyHistory.body.policyDecisionEvidenceRecords).toEqual([
      expect.objectContaining({
        policy_decision_id: policyDecisionId,
        approval_id: approvalId,
      }),
    ]);

    jest.clearAllMocks();
    const evidenceIndex = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).toHaveBeenCalledWith(approvalId);
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(evidenceIndex.body.schemaVersion).toBe(
      "ads_automation_approval_evidence_index.v1",
    );
    expect(evidenceIndex.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        approval_evidence_index_readback: true,
        approval_evidence_index_persistence_performed: false,
      }),
    );
    expect(evidenceIndex.body.summary).toEqual(
      expect.objectContaining({
        readback_status: "listed",
        validateOnly_evidence_records_matched: 1,
        policy_decision_records_matched: 1,
        execution_preflight_records_matched: 1,
        linked_validateOnly_evidence_records: 1,
        linked_policy_decision_records: 1,
        unlinked_validateOnly_validation_ids: 0,
        unlinked_policy_decision_ids: 0,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        approval_evidence_index_persistence_performed: false,
        validateOnly_evidence_persistence_performed: false,
        policy_decision_evidence_persistence_performed: false,
        preflight_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "inspect_approval_evidence_index",
      }),
    );
    expect(evidenceIndex.body.links).toEqual(
      expect.objectContaining({
        execution_record_ids: [executionRecordId],
        validateOnly_validation_ids_from_preflight: [validationId],
        validateOnly_validation_ids_with_evidence: [validationId],
        validateOnly_validation_ids_missing_evidence: [],
        policy_decision_ids_from_preflight: [policyDecisionId],
        policy_decision_ids_with_evidence: [policyDecisionId],
        policy_decision_ids_missing_evidence: [],
      }),
    );
    expect(evidenceIndex.body.validateOnlyEvidenceRecords).toEqual([
      expect.objectContaining({
        validation_id: validationId,
        approval_id: approvalId,
      }),
    ]);
    expect(evidenceIndex.body.policyDecisionEvidenceRecords).toEqual([
      expect.objectContaining({
        policy_decision_id: policyDecisionId,
        approval_id: approvalId,
      }),
    ]);
    expect(evidenceIndex.body.executionPreflightDryRunRecords).toEqual([
      expect.objectContaining({
        execution_record_id: executionRecordId,
        approval_id: approvalId,
      }),
    ]);

    jest.clearAllMocks();
    const reviewExport = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-export`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).toHaveBeenCalledWith(approvalId);
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(reviewExport.body.schemaVersion).toBe(
      "ads_automation_approval_evidence_review_export.v1",
    );
    expect(reviewExport.body.exportMode).toBe("local_readback");
    expect(reviewExport.body.fixture).toBeNull();
    expect(reviewExport.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        reviewer_export_readback: true,
        reviewer_export_persistence_performed: false,
        demo_fixture_used: false,
        demo_fixture_persistence_performed: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(reviewExport.body.summary).toEqual(
      expect.objectContaining({
        export_status: "ready_for_review",
        export_mode: "local_readback",
        evidence_index_readback_status: "listed",
        total_evidence_records_included: 3,
        validateOnly_evidence_records_included: 1,
        policy_decision_records_included: 1,
        execution_preflight_records_included: 1,
        linked_validateOnly_evidence_records: 1,
        linked_policy_decision_records: 1,
        unlinked_validateOnly_validation_ids: 0,
        unlinked_policy_decision_ids: 0,
        reviewer_export_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "inspect_reviewer_export",
      }),
    );
    expect(reviewExport.body.reviewerGuide.review_route).toContain(
      "/evidence-index/reviewer-export",
    );
    expect(reviewExport.body.evidenceIndex.links).toEqual(
      expect.objectContaining({
        execution_record_ids: [executionRecordId],
        validateOnly_validation_ids_with_evidence: [validationId],
        policy_decision_ids_with_evidence: [policyDecisionId],
      }),
    );

    jest.clearAllMocks();
    const reviewerDocs = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-docs`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).toHaveBeenCalledWith(approvalId);
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith(
      approvalId,
    );
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(reviewerDocs.body.schemaVersion).toBe(
      "ads_automation_approval_evidence_reviewer_docs.v1",
    );
    expect(reviewerDocs.body.docsMode).toBe("local_readback_docs");
    expect(reviewerDocs.body.summary).toEqual(
      expect.objectContaining({
        docs_status: "ready_for_review",
        source_export_mode: "local_readback",
        total_evidence_records_rendered: 3,
        validateOnly_evidence_records_rendered: 1,
        policy_decision_records_rendered: 1,
        execution_preflight_records_rendered: 1,
        linked_validateOnly_evidence_records: 1,
        linked_policy_decision_records: 1,
        reviewer_docs_persistence_performed: false,
        reviewer_export_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "inspect_reviewer_docs",
      }),
    );
    expect(reviewerDocs.body.routeExamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Reviewer docs",
          method: "GET",
          path: expect.stringContaining("/evidence-index/reviewer-docs"),
          provider_api_called: false,
          erp_mutation_used: false,
        }),
        expect.objectContaining({
          label: "Reviewer export JSON",
          path: expect.stringContaining("/evidence-index/reviewer-export"),
        }),
      ]),
    );
    expect(reviewerDocs.body.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "linked_evidence",
          status: "ready_for_review",
          evidence_record_ids: expect.arrayContaining([
            executionRecordId,
            validationId,
            policyDecisionId,
          ]),
        }),
        expect.objectContaining({
          section_id: "safety_gates",
          lines: expect.arrayContaining([
            "execution_allowed_now=false",
            "provider_api_called=false",
            "google_ads_api_called=false",
            "validateOnly_called=false",
            "live_ads_execution_used=false",
          ]),
        }),
      ]),
    );
    expect(reviewerDocs.body.markdownPreview).toContain(
      "Ads Approval Evidence Review",
    );
    expect(reviewerDocs.body.reviewerExport.evidenceIndex.links).toEqual(
      expect.objectContaining({
        execution_record_ids: [executionRecordId],
        validateOnly_validation_ids_with_evidence: [validationId],
        policy_decision_ids_with_evidence: [policyDecisionId],
      }),
    );

    await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/execution-preflight-dry-run/${executionRecordId}`,
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(`/ai/ads-automation/policy-decision-evidence/${policyDecisionId}`)
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(`/ai/ads-automation/validate-only-evidence/${validationId}`)
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/execution-preflight-dry-run-records`,
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/policy-decision-evidence`,
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/validate-only-evidence`,
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index`,
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-export`,
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-docs`,
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .post(
        "/ai/ads-automation/decision-draft-approvals/execution-preflight-dry-run",
      )
      .set("x-test-role", "manager")
      .send({
        approvalIds: [approvalId],
        validationPlans: [validationPlanForApproval(approved)],
        policyDecisions: [{ approval_id: approvalId, policy_allowed: true }],
      })
      .expect(403);
  });

  it("returns local policy decision audit linkage and rollback readiness for approved preflight evidence", async () => {
    delete process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
    const preview: any = validDraftPreview(
      "ads-draft:controller:policy-linkage:update_campaign_budget:2001",
    );
    const sourceSync = sourceSyncPreparation();
    preview.sourceSyncDecisionEvidence = sourceSync.decisionEvidence;
    preview.sourceSyncDecisionGates = sourceSync.decisionGates;
    preview.drafts[0].typedPayload.currentBudgetVnd = 1000000;
    preview.drafts[0].typedPayload.campaignBudgetResourceName =
      "customers/1234567890/campaignBudgets/3001";

    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(preview)
      .expect(200);
    const approvalId = imported.body.pendingApprovals[0].approval_id;
    const decision = await request(app.getHttpServer())
      .post(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/decision`,
      )
      .set("x-test-role", "director")
      .send({
        decision: "approve",
        reason:
          "Director approves local policy linkage evidence before dry-run preflight.",
        requestId: "REQ-CONTROLLER-POLICY-LINKAGE-APPROVE",
      })
      .expect(200);
    const approved = approvalRecordsByApprovalId.get(approvalId)!;
    const validationPlan = validationPlanForApproval(approved);
    validationPlan.before_state_snapshot.snapshot = {
      status: "ENABLED",
      currentDailyBudgetVnd: 1000000,
      syncedAt: "2026-07-04T05:55:00.000Z",
    };
    validationPlan.source_pending_action = {
      pending_action_id: validationPlan.pending_action_id,
      source_decision_id: approved.source_decision_id,
    } as any;

    const preflight = await request(app.getHttpServer())
      .post(
        "/ai/ads-automation/decision-draft-approvals/execution-preflight-dry-run",
      )
      .set("x-test-role", "director")
      .send({
        approvalIds: [approvalId],
        validationPlans: [validationPlan],
        approvalDecisionAuditRecords: [decision.body.auditRecord],
        policyDecisions: [
          {
            approval_id: approvalId,
            policy_allowed: true,
            policy_source: "erp_loss_limit_spend_cap_policy",
            blockers: [],
          },
        ],
        requestId: "REQ-CONTROLLER-POLICY-LINKAGE-PREFLIGHT",
      })
      .expect(200);
    const executionRecordId =
      preflight.body.executionRecords[0].execution_record_id;
    const validationId =
      preflight.body.executionRecords[0].validateOnly_validation_id;
    const policyDecisionId =
      preflight.body.executionRecords[0].policy_decision_id;
    const executionIdempotencyKey =
      preflight.body.executionRecords[0].idempotency_key;
    const telemetryReadModel = monitoringTelemetryReadModelForLinkage({
      approvalId,
      policyDecisionId,
      validationId,
      executionRecordId,
      idempotencyKey: executionIdempotencyKey,
    });
    const monitoringReadiness = await request(app.getHttpServer())
      .post("/ai/ads-automation/monitoring-incident-readiness")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_monitoring_incident_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T06:45:00.000Z",
        telemetryReadModel,
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/policy-decision-audit-linkage`,
      )
      .set("x-test-role", "manager")
      .send({
        reportDate: "2026-07-04",
        auditRecords: [decision.body.auditRecord],
        lossLimitPolicy: safeLossLimitPolicyForBudgetUpdate(),
        monitoringReadiness: monitoringReadiness.body,
      })
      .expect(200);

    expect(response.body.schemaVersion).toBe(
      "ads_automation_policy_decision_audit_linkage.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        in_memory_only: true,
        persistence_used: false,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        direct_google_ads_api_call: false,
        provider_mutation_used: false,
        operation_builder_called: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
        approval_required_for_all_actions: true,
        campaignBudgetId_no_fallback: true,
        policy_decision_id_linkage_required: true,
        pending_action_id_linkage_required: true,
        validateOnly_preflight_linkage_required: true,
        human_approval_audit_required: true,
        rollback_readiness_required: true,
        safe_idempotency_required: true,
        monitoring_health_required_before_increase: true,
        rate_limit_budget_required_before_increase: true,
        active_incident_blocks_increase: true,
        operator_acknowledgement_required_for_blocking_alerts: true,
        durable_telemetry_read_model_required_before_increase: true,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_future_executor_local_only",
        approval_id: approvalId,
        execution_records_received: 1,
        linked_records_ready: 1,
        blocked_records: 0,
        policy_decision_records_linked: 1,
        validateOnly_records_linked: 1,
        audit_records_linked: 1,
        pending_action_ids_linked: 1,
        human_approval_records_linked: 1,
        monitoring_ready_records: 1,
        monitoring_blocked_records: 0,
        active_incident_blocked_records: 0,
        rollback_ready_records: 1,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.linkageRecords[0]).toEqual(
      expect.objectContaining({
        approval_id: approvalId,
        execution_record_id: executionRecordId,
        pending_action_id: validationPlan.pending_action_id,
        source_decision_id: approved.source_decision_id,
        policy_decision_id: policyDecisionId,
        validateOnly_validation_id: validationId,
        audit_id: decision.body.auditRecord.audit_id,
        action_type: "update_campaign_budget",
        recommendation: "pending_future_executor_local_only",
        blockers: [],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        future_live_execution_allowed: false,
        campaignBudgetId_fallback_used: false,
      }),
    );
    expect(response.body.linkageRecords[0].monitoringEvidenceSnapshot).toEqual(
      expect.objectContaining({
        schemaVersion: "ads_automation_monitoring_incident_readiness.v1",
        telemetry_schemaVersion:
          "ads_automation_monitoring_telemetry_read_model.v1",
        durable_telemetry_read_model_used: true,
        durable_telemetry_fresh: true,
        durable_telemetry_complete: true,
        durable_telemetry_trusted: true,
        durable_telemetry_tied_to_policy_decision: true,
        telemetry_record_count: 9,
        monitoring_healthy: true,
        rate_limit_budget_safe: true,
        import_freshness_safe: true,
        validateOnly_preflight_alerts_clear: true,
        active_incident_blocking_count: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        blockers: [],
      }),
    );
    expect(
      response.body.linkageRecords[0].monitoringEvidenceSnapshot
        .telemetry_decision_binding,
    ).toEqual(
      expect.objectContaining({
        approvalId,
        policyDecisionId,
        validateOnlyValidationId: validationId,
        executionRecordId,
        campaignBudgetId: "3001",
      }),
    );
    expect(response.body.linkageRecords[0].gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "policy_decision_id_linked",
          status: "passed",
        }),
        expect.objectContaining({
          key: "pending_action_id_linked",
          status: "passed",
        }),
        expect.objectContaining({
          key: "human_approval_audit_correlated",
          status: "passed",
        }),
        expect.objectContaining({
          key: "rollback_readiness",
          status: "passed",
        }),
        expect.objectContaining({
          key: "campaignBudgetId_no_fallback",
          status: "passed",
        }),
        expect.objectContaining({
          key: "monitoring_health_safe_for_increase",
          status: "passed",
        }),
      ]),
    );
    expect(response.body.linkageRecords[0].rollbackReadiness).toEqual(
      expect.objectContaining({
        status: "ready",
        rollback_action_type: "restore_campaign_budget",
        before_state_snapshot_present: true,
        rollback_plan_present: true,
        missing_identifiers: [],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(
      response.body.linkageRecords[0].rollbackReadiness.rollback_plan,
    ).toEqual(
      expect.objectContaining({
        customerId: "1234567890",
        campaignBudgetId: "3001",
        restoreDailyBudgetVnd: 1000000,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.markdownPreview).toContain(
      "Policy Decision Audit Linkage",
    );

    await request(app.getHttpServer())
      .post(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/policy-decision-audit-linkage`,
      )
      .set("x-test-role", "employee")
      .send({
        auditRecords: [decision.body.auditRecord],
        lossLimitPolicy: safeLossLimitPolicyForBudgetUpdate(),
        monitoringReadiness: monitoringReadiness.body,
      })
      .expect(403);
  });

  it("returns an empty approval evidence index for a manager without creating evidence", async () => {
    const response = await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-without-evidence/evidence-index",
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).toHaveBeenCalledWith("ADSAPPROVAL-without-evidence");
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith(
      "ADSAPPROVAL-without-evidence",
    );
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith(
      "ADSAPPROVAL-without-evidence",
    );
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_approval_evidence_index.v1",
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        readback_status: "empty",
        validateOnly_evidence_records_matched: 0,
        policy_decision_records_matched: 0,
        execution_preflight_records_matched: 0,
        linked_validateOnly_evidence_records: 0,
        linked_policy_decision_records: 0,
        approval_evidence_index_persistence_performed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action:
          "verify_approval_id_or_generate_preflight_evidence",
      }),
    );
    expect(response.body.validateOnlyEvidenceRecords).toEqual([]);
    expect(response.body.policyDecisionEvidenceRecords).toEqual([]);
    expect(response.body.executionPreflightDryRunRecords).toEqual([]);

    jest.clearAllMocks();
    const reviewExport = await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-without-evidence/evidence-index/reviewer-export",
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).toHaveBeenCalledWith("ADSAPPROVAL-without-evidence");
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith(
      "ADSAPPROVAL-without-evidence",
    );
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith(
      "ADSAPPROVAL-without-evidence",
    );
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(reviewExport.body.schemaVersion).toBe(
      "ads_automation_approval_evidence_review_export.v1",
    );
    expect(reviewExport.body.exportMode).toBe("local_readback");
    expect(reviewExport.body.summary).toEqual(
      expect.objectContaining({
        export_status: "empty",
        evidence_index_readback_status: "empty",
        total_evidence_records_included: 0,
        validateOnly_evidence_records_included: 0,
        policy_decision_records_included: 0,
        execution_preflight_records_included: 0,
        reviewer_export_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action:
          "verify_approval_id_or_generate_preflight_evidence",
      }),
    );
    expect(reviewExport.body.evidenceIndex.validateOnlyEvidenceRecords).toEqual(
      [],
    );
    expect(
      reviewExport.body.evidenceIndex.policyDecisionEvidenceRecords,
    ).toEqual([]);
    expect(
      reviewExport.body.evidenceIndex.executionPreflightDryRunRecords,
    ).toEqual([]);

    jest.clearAllMocks();
    const reviewerDocs = await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-without-evidence/evidence-index/reviewer-docs",
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).toHaveBeenCalledWith("ADSAPPROVAL-without-evidence");
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith(
      "ADSAPPROVAL-without-evidence",
    );
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith(
      "ADSAPPROVAL-without-evidence",
    );
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(reviewerDocs.body.schemaVersion).toBe(
      "ads_automation_approval_evidence_reviewer_docs.v1",
    );
    expect(reviewerDocs.body.docsMode).toBe("local_readback_docs");
    expect(reviewerDocs.body.summary).toEqual(
      expect.objectContaining({
        docs_status: "empty",
        source_export_mode: "local_readback",
        total_evidence_records_rendered: 0,
        validateOnly_evidence_records_rendered: 0,
        policy_decision_records_rendered: 0,
        execution_preflight_records_rendered: 0,
        reviewer_docs_persistence_performed: false,
        reviewer_export_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action:
          "verify_approval_id_or_generate_preflight_evidence",
      }),
    );
    expect(reviewerDocs.body.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "linked_evidence",
          status: "empty",
          lines: expect.arrayContaining([
            "Execution records: none",
            "Linked validate-only evidence: none",
            "Linked policy decisions: none",
          ]),
          evidence_record_ids: [],
        }),
      ]),
    );
    expect(reviewerDocs.body.markdownPreview).toContain("Evidence records: 0");
    expect(
      reviewerDocs.body.reviewerExport.evidenceIndex
        .validateOnlyEvidenceRecords,
    ).toEqual([]);
    expect(
      reviewerDocs.body.reviewerExport.evidenceIndex
        .policyDecisionEvidenceRecords,
    ).toEqual([]);
    expect(
      reviewerDocs.body.reviewerExport.evidenceIndex
        .executionPreflightDryRunRecords,
    ).toEqual([]);

    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-without-evidence/evidence-index",
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-without-evidence/evidence-index/reviewer-export",
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-without-evidence/evidence-index/reviewer-docs",
      )
      .set("x-test-role", "employee")
      .expect(403);
  });

  it("returns a protected local reviewer export demo fixture without repository readback", async () => {
    jest.clearAllMocks();
    const response = await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-export?fixture=linked",
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_approval_evidence_review_export.v1",
    );
    expect(response.body.exportMode).toBe("local_demo_fixture");
    expect(response.body.query).toEqual({
      approval_id: "ADSAPPROVAL-review-fixture",
      fixture: "linked_budget_update_evidence",
    });
    expect(response.body.fixture).toEqual(
      expect.objectContaining({
        scenario: "linked_budget_update_evidence",
        source: "erp_local_demo_fixture",
        persisted_to_db: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        in_memory_only: true,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        reviewer_export_readback: true,
        reviewer_export_persistence_performed: false,
        demo_fixture_used: true,
        demo_fixture_persistence_performed: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        export_status: "ready_for_review",
        export_mode: "local_demo_fixture",
        total_evidence_records_included: 8,
        validateOnly_evidence_records_included: 1,
        policy_decision_records_included: 1,
        execution_preflight_records_included: 1,
        pending_approval_record_included: true,
        pending_action_review_evidence_records_included: 1,
        source_sync_decision_evidence_records_included: 5,
        source_sync_decision_blocked_sources: 0,
        source_sync_gate_status: "ready",
        source_sync_can_generate_action_draft: true,
        source_sync_can_use_google_ads_data_claim: true,
        source_sync_blocking_reasons: [],
        provider_account_readiness_status: "ready_for_local_validate_only",
        provider_account_readiness_blocked_actions: 0,
        provider_account_readiness_blocking_reasons: [],
        provider_account_readiness_campaignBudgetId_no_fallback: true,
        provider_account_readiness_scale_up_execution_mode:
          "pending_validation",
        linked_validateOnly_evidence_records: 1,
        linked_policy_decision_records: 1,
        unlinked_validateOnly_validation_ids: 0,
        unlinked_policy_decision_ids: 0,
        reviewer_export_persistence_performed: false,
        demo_fixture_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "inspect_reviewer_export",
      }),
    );
    expect(response.body.evidenceIndex.query).toEqual({
      approval_id: "ADSAPPROVAL-review-fixture",
    });
    expect(
      response.body.evidenceIndex.links
        .validateOnly_validation_ids_with_evidence,
    ).toHaveLength(1);
    expect(
      response.body.evidenceIndex.links.policy_decision_ids_with_evidence,
    ).toHaveLength(1);
    expect(response.body.evidenceIndex.sourceSyncDecisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          canUseForAdsAutomationDecision: true,
        }),
      ]),
    );
    expect(response.body.evidenceIndex.sourceSyncDecisionGates).toEqual(
      expect.objectContaining({
        canGenerateActionDraft: true,
        canUseGoogleAdsDataClaim: true,
      }),
    );
    expect(response.body.evidenceIndex.pendingActionReviewEvidence[0]).toEqual(
      expect.objectContaining({
        action_type: "update_campaign_budget",
        providerAccountReadiness: expect.objectContaining({
          status: "ready_for_future_validate_only",
          blockers: [],
          campaignBudgetIdNoFallback: true,
          execution_allowed_now: false,
        }),
      }),
    );

    const reviewerDocs = await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs?fixture=linked",
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(reviewerDocs.body.schemaVersion).toBe(
      "ads_automation_approval_evidence_reviewer_docs.v1",
    );
    expect(reviewerDocs.body.docsMode).toBe("local_demo_fixture_docs");
    expect(reviewerDocs.body.query).toEqual({
      approval_id: "ADSAPPROVAL-review-fixture",
      fixture: "linked_budget_update_evidence",
    });
    expect(reviewerDocs.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        in_memory_only: true,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        reviewer_docs_readback: true,
        reviewer_docs_persistence_performed: false,
        reviewer_export_persistence_performed: false,
        demo_fixture_used: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(reviewerDocs.body.summary).toEqual(
      expect.objectContaining({
        docs_status: "ready_for_review",
        docs_mode: "local_demo_fixture_docs",
        source_export_mode: "local_demo_fixture",
        total_evidence_records_rendered: 8,
        validateOnly_evidence_records_rendered: 1,
        policy_decision_records_rendered: 1,
        execution_preflight_records_rendered: 1,
        pending_approval_record_rendered: true,
        pending_action_review_evidence_records_rendered: 1,
        source_sync_decision_evidence_records_rendered: 5,
        source_sync_decision_blocked_sources_rendered: 0,
        source_sync_gate_status: "ready",
        source_sync_can_generate_action_draft: true,
        source_sync_can_use_google_ads_data_claim: true,
        provider_account_readiness_status: "ready_for_local_validate_only",
        provider_account_readiness_blocked_actions_rendered: 0,
        provider_account_readiness_campaignBudgetId_no_fallback: true,
        provider_account_readiness_scale_up_execution_mode:
          "pending_validation",
        reviewer_docs_persistence_performed: false,
        reviewer_export_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "inspect_reviewer_docs",
      }),
    );
    expect(reviewerDocs.body.routeExamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Reviewer docs",
          path: expect.stringContaining("/evidence-index/reviewer-docs"),
          query: "fixture=linked_budget_update_evidence",
        }),
      ]),
    );
    expect(reviewerDocs.body.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "linked_evidence",
          status: "ready_for_review",
          evidence_record_ids: expect.any(Array),
        }),
        expect.objectContaining({
          section_id: "source_sync_evidence",
          status: "ready_for_review",
          lines: expect.arrayContaining([
            "Pending approval source-sync record: found",
            "Source-sync evidence records: 5",
            "Blocked source-sync sources: 0",
            "Gate canGenerateActionDraft: true",
          ]),
        }),
        expect.objectContaining({
          section_id: "pending_action_readiness_evidence",
          status: "ready_for_review",
          lines: expect.arrayContaining([
            "Provider account readiness status: ready_for_local_validate_only",
            "Provider campaignBudgetId no fallback: true",
          ]),
        }),
      ]),
    );
    expect(reviewerDocs.body.markdownPreview).toContain(
      "Source-sync gate status: ready",
    );
    expect(reviewerDocs.body.markdownPreview).toContain(
      "Provider readiness status: ready_for_local_validate_only",
    );
    expect(reviewerDocs.body.markdownPreview).toContain(
      "Safety gates: execution_allowed_now=false",
    );

    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-export?fixture=linked",
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs?fixture=linked",
      )
      .set("x-test-role", "employee")
      .expect(403);

    jest.clearAllMocks();
    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-export?fixture=live",
      )
      .set("x-test-role", "manager")
      .expect(400);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs?fixture=live",
      )
      .set("x-test-role", "manager")
      .expect(400);

    expect(
      validateOnlyEvidenceRepository.listByApprovalId,
    ).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
  });

  it("returns readiness blockers for a durable budget update missing typedPayload.campaignBudgetId", async () => {
    const imported = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send(
        validDraftPreview(
          "ads-draft:controller:readiness-missing-campaign-budget:2001",
        ),
      )
      .expect(200);

    const approvalId = imported.body.pendingApprovals[0].approval_id;
    const stored = approvalRecordsByApprovalId.get(approvalId);
    approvalRecordsByApprovalId.set(approvalId, {
      ...stored,
      typedPayload: {
        customerId: "1234567890",
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        dailyBudget: 1200000,
      },
    } as AdsAutomationDecisionDraftPendingApprovalRecord);

    const response = await request(app.getHttpServer())
      .get(
        `/ai/ads-automation/decision-draft-approvals/${approvalId}/readiness`,
      )
      .set("x-test-role", "manager")
      .expect(200);

    expect(response.body.summary).toEqual(
      expect.objectContaining({
        readiness_status: "blocked",
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: "fix_blockers_before_review",
      }),
    );
    expect(response.body.blockers).toEqual(
      expect.arrayContaining(["typedPayload.campaignBudgetId"]),
    );
    expect(response.body.prerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "typedPayload.campaignBudgetId",
          status: "blocked",
        }),
      ]),
    );
    expect(response.body.pendingApproval.typedPayload).toEqual(
      expect.objectContaining({
        campaignId: "1001",
        adGroupId: "2001",
        dailyBudget: 1200000,
      }),
    );
  });

  it("rejects non-preview payloads for the draft approval import path", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "manager")
      .send({
        schemaVersion: "ads_automation_decision_snapshot.v1",
        drafts: [],
      })
      .expect(400);
  });

  it("returns protected local platform source-sync status without provider or execution use", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-source-sync-status")
      .set("x-test-role", "manager")
      .send({
        reportDate: "2026-07-04",
        now: "2026-07-04T05:00:00.000Z",
        sourceKeys: ["google_ads", "advertising_costs", "product_mapping"],
      })
      .expect(200);

    expect(platformSourceSyncStatus.build).toHaveBeenCalledWith({
      reportDate: "2026-07-04",
      now: "2026-07-04T05:00:00.000Z",
      sourceKeys: ["google_ads", "advertising_costs", "product_mapping"],
    });
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_platform_source_sync_status.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        local_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        google_ads_production_enabled: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        stale_sources: ["advertising_costs"],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.decisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          canUseForAdsAutomationDecision: true,
          blockingReason: null,
        }),
        expect.objectContaining({
          sourceKey: "advertising_costs",
          canUseForAdsAutomationDecision: false,
          blockingReasons: expect.arrayContaining([
            "advertising_costs_not_ready_for_ads_automation_decision",
            "freshness_stale",
          ]),
        }),
      ]),
    );
    expect(response.body.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          provider: "google_ads",
          platform: "google_ads",
          status: "ready",
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "advertising_costs",
          provider: "erp_local",
          status: "stale",
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
  });

  it("returns protected read-only platform import readiness from the local demo fixture", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-readonly-import-readiness")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_readiness_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(platformSourceSyncStatus.build).toHaveBeenCalledWith({
      reportDate: "2026-07-04",
      now: "2026-07-04T05:00:00.000Z",
      sourceKeys: undefined,
    });
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_readonly_platform_import_readiness.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        campaignBudgetId_no_fallback: true,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        fixture_mode: "htx_ads_readiness_demo",
        account_count: 2,
        metric_row_count: 3,
        campaignBudgetId_missing_rows: 1,
        source_sync_blocker_count: 4,
        cashflow_first_scale_all_safe: false,
        scale_up_execution_mode: "monitor_only",
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "resolve_readonly_import_readiness_blockers",
      }),
    );
    expect(response.body.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: "HTX-GADS-PRIMARY",
          customerId: "1234567890",
          sourceTrustLevel: "erp_local_verified",
          canRecommendAdsScale: false,
          execution_allowed_now: false,
        }),
        expect.objectContaining({
          accountId: "HTX-GADS-SECONDARY",
          retryBackoffState: expect.objectContaining({
            status: "retry_scheduled",
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
    expect(response.body.metricRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campaignId: "9001",
          adGroupId: "9002",
          campaignBudgetId: null,
          blockers: ["campaignBudgetId_missing_no_fallback"],
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(response.body.cashflowFirstGate.blockers).toEqual(
      expect.arrayContaining([
        "cash_conversion_or_working_capital_health_missing",
        "supplier_reliability_missing_or_unsafe",
        "fulfillment_capacity_missing",
        "daily_loss_limit_missing",
        "monthly_loss_limit_missing",
      ]),
    );
  });

  it("exposes ready read-only import status through the platform import readiness endpoint for fresh covered local payloads", async () => {
    platformSourceSyncStatus.build.mockResolvedValueOnce(
      freshReadonlyImportSourceSyncStatus(),
    );

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-readonly-import-readiness")
      .set("x-test-role", "manager")
      .send(readonlyImportReadyEndpointPayload())
      .expect(200);

    expect(platformSourceSyncStatus.build).toHaveBeenCalledWith({
      reportDate: "2026-07-04",
      now: "2026-07-04T05:00:00.000Z",
      sourceKeys: undefined,
    });
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_local_decision_review",
        fixture_mode: "custom_local_payload",
        ready_account_count: 1,
        blocked_account_count: 0,
        metric_rows_ready: 2,
        campaignBudgetId_missing_rows: 0,
        source_sync_blocker_count: 0,
        cashflow_first_scale_all_safe: true,
        scale_up_execution_mode: "pending_validation",
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "review_local_readonly_import_evidence",
      }),
    );
    expect(response.body.sourceSyncSummary).toEqual(
      expect.objectContaining({
        status: "ready",
        blocked_sources: [],
        stale_sources: [],
      }),
    );
    expect(response.body.decisionReadiness).toEqual(
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
      response.body.decisionReadiness.candidates.adGroupsToIncrease,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          status: "scale_ready",
          effectiveStatus: "candidate_for_review",
          campaignBudgetId: "3001",
          blockers: [],
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(response.body.safety).toEqual(
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
  });

  it("blocks action draft generation at the endpoint when campaignBudgetId is missing without falling back to campaignId or adGroupId", async () => {
    platformSourceSyncStatus.build.mockResolvedValueOnce(
      freshReadonlyImportSourceSyncStatus(),
    );
    const fixture = ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE;

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-readonly-import-readiness")
      .set("x-test-role", "manager")
      .send(
        readonlyImportReadyEndpointPayload({
          accounts: [
            {
              ...fixture.accounts[0],
              importWindow: {
                ...fixture.accounts[0].importWindow,
                from: "2026-07-04",
                to: "2026-07-04",
              },
            },
          ],
          metricRows: [
            {
              ...fixture.metricRows[0],
              campaignId: "1001",
              adGroupId: "2001",
              campaignBudgetId: null,
            },
          ],
        }),
      )
      .expect(200);

    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        ready_account_count: 1,
        metric_rows_ready: 0,
        campaignBudgetId_missing_rows: 1,
        source_sync_blocker_count: 0,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "resolve_readonly_import_readiness_blockers",
      }),
    );
    expect(response.body.metricRows[0]).toEqual(
      expect.objectContaining({
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        blockers: ["campaignBudgetId_missing_no_fallback"],
        canUseForAdsAutomationDecision: false,
      }),
    );
    expect(response.body.metricRows[0].campaignBudgetId).not.toBe("1001");
    expect(response.body.metricRows[0].campaignBudgetId).not.toBe("2001");
    expect(response.body.decisionReadiness).toEqual(
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
    expect(response.body.decisionReadiness.decision_categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "scale_amount",
          canGenerateActionDraft: false,
        }),
      ]),
    );
    expect(
      response.body.decisionReadiness.candidates.adGroupsToIncrease,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          effectiveStatus: "blocked",
          campaignBudgetId: "3001",
          blockers: expect.arrayContaining([
            "campaignBudgetId_missing_no_fallback",
          ]),
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        campaignBudgetId_no_fallback: true,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
  });

  it("blocks read-only import status at the endpoint when source-sync evidence is stale", async () => {
    platformSourceSyncStatus.build.mockResolvedValueOnce(
      staleReadonlyImportSourceSyncStatus(),
    );

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-readonly-import-readiness")
      .set("x-test-role", "manager")
      .send(readonlyImportReadyEndpointPayload())
      .expect(200);

    expect(response.body.sourceSyncSummary).toEqual(
      expect.objectContaining({
        status: "blocked",
        blocked_sources: ["advertising_costs"],
        stale_sources: ["advertising_costs"],
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        ready_account_count: 0,
        blocked_account_count: 1,
        source_sync_blocker_count: 1,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "blocked",
        readonly_import_status: "blocked",
        read_model_status: "ready",
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.body.decisionReadiness.source_gate_blockers).toEqual(
      expect.arrayContaining([
        "advertising_costs_not_ready_for_ads_automation_decision",
        "freshness_stale",
      ]),
    );
    expect(response.body.decisionReadiness.readonly_import_blockers).toEqual(
      expect.arrayContaining(["source_sync.advertising_costs_not_ready"]),
    );
    expect(
      response.body.decisionReadiness.candidates.adGroupsToIncrease,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            "advertising_costs_not_ready_for_ads_automation_decision",
            "freshness_stale",
            "source_sync.advertising_costs_not_ready",
          ]),
          execution_allowed_now: false,
        }),
      ]),
    );
  });

  it("blocks ready-labeled source sync payloads with omitted required decision evidence through import readiness and source review endpoints", async () => {
    const productMappingMissing =
      "product_mapping_source_evidence_missing_for_ads_automation_decision";
    const supplierSafetyMissing =
      "supplier_safety_source_evidence_missing_for_ads_automation_decision";
    const sourceSyncStatus =
      readyLabeledSourceSyncStatusWithMissingDecisionEvidence();
    const payload = readonlyImportReadyEndpointPayload();
    platformSourceSyncStatus.build.mockResolvedValueOnce(sourceSyncStatus);

    const readinessResponse = await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-readonly-import-readiness")
      .set("x-test-role", "manager")
      .send(payload)
      .expect(200);

    expect(readinessResponse.body.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(readinessResponse.body.sourceSyncSummary).toEqual(
      expect.objectContaining({
        status: "ready",
        blocked_sources: [],
        stale_sources: [],
        missing_coverage_sources: [],
        not_synced_sources: [],
      }),
    );
    expect(readinessResponse.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_sync_blocker_count: 2,
        cashflow_first_scale_all_safe: false,
        scale_up_execution_mode: "monitor_only",
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(readinessResponse.body.sourceImportCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "product_mapping",
          freshnessStatus: "missing",
          coverageStatus: "missing",
          lastSuccessfulSyncAt: null,
          latestRecordDate: null,
          blockingReason: productMappingMissing,
          blockingReasons: [productMappingMissing],
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
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(readinessResponse.body.decisionReadiness).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_gate_status: "blocked",
        readonly_import_status: "blocked",
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(
      readinessResponse.body.decisionReadiness.source_gate_blockers,
    ).toEqual(
      expect.arrayContaining([productMappingMissing, supplierSafetyMissing]),
    );
    expect(
      readinessResponse.body.decisionReadiness.candidates.adGroupsToIncrease,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(
      readinessResponse.body.decisionReadiness.candidates
        .productsEligibleForBudget,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_SCALE",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(
      readinessResponse.body.decisionReadiness.candidates.supplierChoices,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "SUP_SAFE",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([supplierSafetyMissing]),
          execution_allowed_now: false,
        }),
      ]),
    );

    const reviewResponse = await request(app.getHttpServer())
      .post("/ai/ads-automation/source-readiness-review-export")
      .set("x-test-role", "manager")
      .send({
        ...payload,
        sourceSyncStatus,
      })
      .expect(200);

    expect(reviewResponse.body.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(reviewResponse.body.summary).toEqual(
      expect.objectContaining({
        export_status: "needs_attention",
        source_sync_status: "ready",
        readonly_import_status: "blocked",
        missing_source_count: 2,
        scale_up_candidates_blocked: 1,
        cashflow_first_scale_mode: "monitor_only",
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(reviewResponse.body.sourceCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "product_mapping",
          coverageBucket: "missing",
          freshnessStatus: "missing",
          coverageStatus: "missing",
          blockingReasons: [productMappingMissing],
          canUseForAdsAutomationDecision: false,
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          coverageBucket: "missing",
          freshnessStatus: "missing",
          coverageStatus: "missing",
          blockingReasons: [supplierSafetyMissing],
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(
      reviewResponse.body.managerCandidateReview.scaleUpCandidates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "2001",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(
      reviewResponse.body.managerCandidateReview.productAllocationCandidates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_SCALE",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([
            productMappingMissing,
            supplierSafetyMissing,
          ]),
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(
      reviewResponse.body.managerCandidateReview.supplierSafetyCandidates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "SUP_SAFE",
          effectiveStatus: "blocked",
          blockers: expect.arrayContaining([supplierSafetyMissing]),
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(reviewResponse.body.decisionAnswerReview).toEqual(
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
        execution_allowed_now: false,
      }),
    );
    expect(
      reviewResponse.body.decisionAnswerReview
        .blocked_product_budget_candidates,
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
    expect(
      reviewResponse.body.decisionAnswerReview.blocked_supplier_choices,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "SUP_SAFE",
          blockers: expect.arrayContaining([supplierSafetyMissing]),
        }),
      ]),
    );
    expect(reviewResponse.body.decisionAnswerReview.blocking_reasons).toEqual(
      expect.arrayContaining([
        productMappingMissing,
        supplierSafetyMissing,
        `source_sync.${productMappingMissing}`,
        `source_sync.${supplierSafetyMissing}`,
        "data_freshness_or_coverage_not_safe",
      ]),
    );
    expect(reviewResponse.body.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "decision_answers",
          status: "attention",
          lines: expect.arrayContaining([
            "may_increase_ads=false",
            "max_increase_vnd=0",
            "ad_groups_to_increase=none",
            "products_can_receive_budget=none",
            expect.stringContaining(
              "blocked_product_budget_candidates=P_SCALE",
            ),
            "safe_supplier_choices=none",
            expect.stringContaining("blocked_supplier_choices=SUP_SAFE"),
            "product_kill_or_stop_review_needed=false",
            "campaign_or_ad_group_pause_recommended=false",
            expect.stringContaining("blocking_reasons="),
          ]),
        }),
      ]),
    );
    expect(reviewResponse.body.blockerReview.productAllocationBlockers).toEqual(
      expect.arrayContaining([productMappingMissing, supplierSafetyMissing]),
    );
    expect(reviewResponse.body.blockerReview.supplierSafetyBlockers).toEqual(
      expect.arrayContaining([supplierSafetyMissing]),
    );
    expect(reviewResponse.body.markdownPreview).toContain(
      productMappingMissing,
    );
    expect(reviewResponse.body.markdownPreview).toContain(
      supplierSafetyMissing,
    );
    expect(reviewResponse.body.markdownPreview).toContain(
      "may_increase_ads=false",
    );
    expect(reviewResponse.body.markdownPreview).toContain(
      "blocked_product_budget_candidates=P_SCALE",
    );
    expect(reviewResponse.body.markdownPreview).toContain(
      "blocked_supplier_choices=SUP_SAFE",
    );
    expect(platformSourceSyncStatus.build).toHaveBeenCalledTimes(1);
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post("/ai/ads-automation/source-readiness-review-export")
      .set("x-test-role", "employee")
      .send({
        ...payload,
        sourceSyncStatus,
      })
      .expect(403);
  });

  it("returns protected ERP source import readiness review export from the read-only bridge", async () => {
    const sourceSyncStatus = freshReadonlyImportSourceSyncStatus();
    const readonlyImportReadiness = app
      .get(AdsAutomationReadonlyPlatformImportReadinessService)
      .build({
        ...readonlyImportReadyEndpointPayload(),
        sourceSyncStatus,
      });

    erpSourceImportReadiness.build.mockResolvedValueOnce({
      schemaVersion: "ads_automation_erp_source_import_readiness.v1",
      generatedAt: "2026-07-04T05:00:00.000Z",
      query: {},
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
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
        campaignBudgetId_no_fallback: true,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      },
      summary: {
        reportDate: "2026-07-04",
      },
      sourceSyncStatus,
      readonlyImportReadiness,
      adapterResult: {},
    });

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/erp-source-import-readiness-review-export")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        accountIds: ["1234567890"],
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(erpSourceImportReadiness.build).toHaveBeenCalledWith({
      snapshotDate: "2026-07-04",
      evidenceWindow,
      customerIds: undefined,
      accountIds: ["1234567890"],
      productIds: undefined,
      now: "2026-07-04T05:00:00.000Z",
      maxAgeHours: undefined,
    });
    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_source_readiness_review_export.v1",
    );
    expect(response.body.exportMode).toBe("erp_source_import_readiness");
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
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
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        export_status: "ready_for_review",
        export_mode: "erp_source_import_readiness",
        source_sync_status: "ready",
        readonly_import_status: "ready_for_local_decision_review",
        required_source_count:
          readonlyImportReadiness.summary.required_source_count,
        required_source_ready_count:
          readonlyImportReadiness.summary.required_source_ready_count,
        required_source_blocked_count: 0,
        required_source_report_date_covered_count:
          readonlyImportReadiness.summary
            .required_source_report_date_covered_count,
        required_source_report_date_blocked_count: 0,
        missing_required_source_evidence: [],
        source_coverage_blocking_reasons: [],
        platform_metric_row_count:
          readonlyImportReadiness.platformEntityCoverage.metrics.rows,
        platform_metric_ready_row_count:
          readonlyImportReadiness.platformEntityCoverage.metrics.readyRows,
        platform_campaign_count:
          readonlyImportReadiness.platformEntityCoverage.campaigns
            .coveredCampaignCount,
        platform_ad_group_count:
          readonlyImportReadiness.platformEntityCoverage.adGroups
            .coveredAdGroupCount,
        platform_campaignBudget_count:
          readonlyImportReadiness.platformEntityCoverage.campaignBudgets
            .coveredCampaignBudgetCount,
        platform_campaignBudgetId_missing_rows: 0,
        platform_blocked_product_count:
          readonlyImportReadiness.platformEntityCoverage.inventoryProfit
            .blockedProductIds.length,
        platform_blocked_supplier_count:
          readonlyImportReadiness.platformEntityCoverage.supplierContext
            .blockedSupplierIds.length,
        campaignBudgetId_missing_rows: 0,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        product_allocation_blocker_count:
          response.body.blockerReview.productAllocationBlockers.length,
        supplier_safety_blocker_count:
          response.body.blockerReview.supplierSafetyBlockers.length,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.sourceCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          coverageBucket: "fresh",
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          coverageBucket: "fresh",
          canUseForAdsAutomationDecision: true,
        }),
      ]),
    );
    expect(response.body.platformEntityCoverage.campaignBudgets).toEqual(
      expect.objectContaining({
        campaignBudgetId_required: true,
        campaignBudgetId_no_fallback: true,
        campaignBudgetId_fallback_used: false,
        missingCampaignBudgetIdRows: 0,
      }),
    );
    expect(response.body.blockerReview.productAllocationBlockers).toEqual(
      expect.arrayContaining(["product_net_profit_not_positive"]),
    );
    expect(response.body.blockerReview.supplierSafetyBlockers).toEqual(
      expect.arrayContaining(["margin_after_cost_below_minimum"]),
    );
    expect(response.body.decisionAnswerReview).toEqual(
      expect.objectContaining({
        may_increase_ads: true,
        max_increase_vnd: 200000,
        scale_up_execution_mode: "pending_validation",
        execution_allowed_now: false,
      }),
    );
    expect(response.body.routeExamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/ai/ads-automation/erp-source-import-readiness-review-export",
          provider_api_called: false,
          erp_mutation_used: false,
        }),
      ]),
    );
    expect(response.body.markdownPreview).toContain(
      "Required sources: ready=5/5",
    );
    expect(response.body.markdownPreview).toContain(
      "Required report-date coverage: covered=5/5",
    );
    expect(response.body.markdownPreview).toContain(
      "Platform campaignBudgetId: required=true, noFallback=true, fallbackUsed=false, missingRows=0",
    );
    expect(response.body.markdownPreview).toContain(
      "Product allocation blockers:",
    );
    expect(response.body.markdownPreview).toContain(
      "product_net_profit_not_positive",
    );
    expect(response.body.markdownPreview).toContain(
      "Supplier safety blockers:",
    );
    expect(response.body.markdownPreview).toContain(
      "margin_after_cost_below_minimum",
    );
    expect(response.body.markdownPreview).toContain(
      "provider_api_called=false",
    );

    await request(app.getHttpServer())
      .post("/ai/ads-automation/erp-source-import-readiness-review-export")
      .set("x-test-role", "employee")
      .send({ snapshotDate: "2026-07-04" })
      .expect(403);
    expect(erpSourceImportReadiness.build).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      sourceKey: "google_ads",
      freshnessStatus: "stale",
      coverageStatus: "covered",
      blockingReasons: ["freshness_stale"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "campaign_or_ad_group_pause",
      ],
      candidateGroup: "campaignOrAdGroupPause",
      candidateEntityId: "2002",
    },
    {
      sourceKey: "advertising_costs",
      freshnessStatus: "fresh",
      coverageStatus: "no_records_for_report_date",
      blockingReasons: ["coverage_no_records_for_report_date"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "campaign_or_ad_group_pause",
      ],
      candidateGroup: "adGroupsToIncrease",
      candidateEntityId: "2001",
    },
    {
      sourceKey: "product_mapping",
      freshnessStatus: "missing",
      coverageStatus: "missing",
      blockingReasons: ["freshness_missing", "coverage_missing"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "product_budget_allocation",
        "product_kill_or_stop_review",
      ],
      candidateGroup: "productKillOrStopReview",
      candidateEntityId: "P_BAD",
    },
    {
      sourceKey: "inventory_profit",
      freshnessStatus: "stale",
      coverageStatus: "covered",
      blockingReasons: ["freshness_stale"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "product_budget_allocation",
        "product_kill_or_stop_review",
      ],
      candidateGroup: "productsEligibleForBudget",
      candidateEntityId: "P_SCALE",
    },
    {
      sourceKey: "supplier_safety",
      freshnessStatus: "missing",
      coverageStatus: "missing",
      blockingReasons: ["freshness_missing", "coverage_missing"],
      blockedCategories: [
        "scale_ads",
        "scale_amount",
        "target_ad_groups",
        "product_budget_allocation",
        "supplier_gate",
      ],
      candidateGroup: "supplierChoices",
      candidateEntityId: "SUP_SAFE",
    },
  ])(
    "exposes $sourceKey source blockers through the protected platform import readiness endpoint",
    async (scenario) => {
      platformSourceSyncStatus.build.mockResolvedValueOnce(
        readonlyImportSourceSyncStatusWithBlockedSource({
          sourceKey: scenario.sourceKey,
          freshnessStatus: scenario.freshnessStatus,
          coverageStatus: scenario.coverageStatus,
          blockingReasons: scenario.blockingReasons,
        }),
      );
      const blocker = `${scenario.sourceKey}_not_ready_for_ads_automation_decision`;
      const expectedLastSuccessfulSyncAt =
        scenario.freshnessStatus === "stale"
          ? "2026-07-02T04:30:00.000Z"
          : null;
      const expectedLatestRecordDate =
        scenario.coverageStatus === "covered" ? "2026-07-03" : null;

      const response = await request(app.getHttpServer())
        .post("/ai/ads-automation/platform-readonly-import-readiness")
        .set("x-test-role", "manager")
        .send(readonlyImportReadyEndpointPayload())
        .expect(200);

      expect(response.body.safety).toEqual(
        expect.objectContaining({
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          GOOGLE_ADS_PRODUCTION_ENABLED: false,
          production_ready: false,
        }),
      );
      expect(response.body.summary).toEqual(
        expect.objectContaining({
          status: "blocked",
          source_sync_blocker_count: expect.any(Number),
          required_source_blocked_count: 1,
          required_source_ready_count: 4,
          required_source_report_date_blocked_count: 1,
          provider_api_called: false,
          google_ads_api_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(
        response.body.summary.source_sync_blocker_count,
      ).toBeGreaterThanOrEqual(1);
      expect(response.body.summary.source_coverage_blocking_reasons).toEqual(
        expect.arrayContaining([blocker, ...scenario.blockingReasons]),
      );
      expect(response.body.sourceSyncSummary).toEqual(
        expect.objectContaining({
          status: "blocked",
          blocked_sources: [scenario.sourceKey],
          stale_sources:
            scenario.freshnessStatus === "stale" ? [scenario.sourceKey] : [],
          missing_coverage_sources:
            scenario.coverageStatus === "no_records_for_report_date"
              ? [scenario.sourceKey]
              : [],
          not_synced_sources:
            scenario.freshnessStatus === "missing" ||
            scenario.coverageStatus === "missing"
              ? [scenario.sourceKey]
              : [],
        }),
      );
      expect(response.body.sourceImportCoverage).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceKey: scenario.sourceKey,
            freshnessStatus: scenario.freshnessStatus,
            coverageStatus: scenario.coverageStatus,
            lastSuccessfulSyncAt: expectedLastSuccessfulSyncAt,
            latestRecordDate: expectedLatestRecordDate,
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
      expect(response.body.decisionReadiness).toEqual(
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
      expect(
        response.body.decisionReadiness.source_to_decision_blockers,
      ).toEqual(
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
        expect(response.body.decisionReadiness.decision_categories).toEqual(
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
        response.body.decisionReadiness.candidates[scenario.candidateGroup],
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
      expect(
        sourceSyncOrchestrator.prepareSourcesForExportJob,
      ).not.toHaveBeenCalled();
    },
  );

  it("returns protected local provider account readiness without provider or live execution use", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/provider-account-readiness")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_provider_account_readiness_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_provider_account_readiness.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        adapter_registry_contract_only: true,
        credential_metadata_only: true,
        plaintext_credentials_stored: false,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_local_validate_only",
        registered_adapter_count: 1,
        ready_account_count: 1,
        provider_actions_requested: 3,
        provider_actions_ready_for_future_validate_only: 3,
        provider_actions_blocked_before_boundary: 0,
        monitor_only_actions_ready: 1,
        scale_up_execution_mode: "pending_validation",
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.accounts[0].credentialReadiness).toEqual(
      expect.objectContaining({
        redactedCredentialReference: "google_ads_oauth_ref:***primary",
        plaintextCredentialFieldCount: 0,
        metadataOnly: true,
      }),
    );
    expect(response.body.requestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "update_campaign_budget",
          status: "ready_for_future_validate_only",
          campaignBudgetId: "3001",
          campaignBudgetIdNoFallback: true,
          approval_can_be_considered_executable: false,
          execution_allowed_now: false,
        }),
        expect.objectContaining({
          actionType: "monitor_only",
          status: "ready_monitor_only",
          providerApiRequired: false,
          execution_allowed_now: false,
        }),
      ]),
    );
  });

  it("returns protected local manager account control-plane readiness for MCC, BM, and BC without provider calls", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/manager-account-control-plane-readiness")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_manager_account_control_plane_demo",
        reportDate: "2026-07-06",
        now: "2026-07-06T06:00:00.000Z",
      })
      .expect(200);
    const serialized = JSON.stringify(response.body);

    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_manager_account_control_plane.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        fixture_or_payload_only: true,
        manager_credential_metadata_only: true,
        plaintext_secrets_added: false,
        real_credential_material_present: false,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        meta_api_called: false,
        tiktok_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        campaignBudgetId_no_fallback: true,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_future_erp_validateOnly_contract",
        manager_account_count: 3,
        child_account_count: 3,
        campaign_count: 3,
        ad_group_count: 3,
        pending_action_count: 3,
        ready_manager_count: 3,
        blocked_manager_count: 0,
        missing_campaignBudgetId_count: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        meta_api_called: false,
        tiktok_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(
      response.body.managerAccounts.map(
        (manager: any) => manager.managerAccountType,
      ),
    ).toEqual([
      "google_ads_mcc",
      "meta_business_manager",
      "tiktok_business_center",
    ]);
    expect(response.body.managerAccounts[0].credentialReadiness).toEqual(
      expect.objectContaining({
        secret_reference_handle:
          "erp-vault://ads/google_ads_mcc/demo-***-metadata",
        plaintextCredentialFieldCount: 0,
        metadataOnly: true,
        real_credential_material_present: false,
      }),
    );
    expect(response.body.pendingActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "update_campaign_budget",
          campaignBudgetId: "demo-gads-budget-001",
          campaignBudgetIdNoFallback: true,
          status: "ready_for_future_erp_validateOnly_contract",
          approval_can_be_considered_executable: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
        expect.objectContaining({
          actionType: "monitor_only",
          status: "ready_monitor_only",
          providerApiRequired: false,
          execution_allowed_now: false,
        }),
      ]),
    );
    expect(response.body.futureControlIntent).toEqual(
      expect.objectContaining({
        erp_only_future_caller: true,
        manager_credential_controls_only_authorized_children: true,
        provider_discovery_import_validate_execute_adapter_boundary_only: true,
        codex_runner_must_not_receive_credentials: true,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(serialized).not.toContain("BLOCKED_REDACTED_TEST_VALUE");
  });

  it("returns protected final gate review export with bundled preflight and production bridge evidence", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/final-gate-review-export")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_final_gate_review_demo",
        reportDate: "2026-07-06",
        now: "2026-07-06T07:20:00.000Z",
      })
      .expect(200);
    const serialized = JSON.stringify(response.body);

    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_final_gate_review_export.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        final_go_no_go_gate_reused: true,
        execution_preflight_evidence_reused: true,
        production_readiness_bridge_reused: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        campaignBudgetId_no_fallback: true,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_manager_review_blocked_before_live",
        fixture_mode: "htx_ads_final_gate_review_demo",
        final_go_no_go_decision: "GO_LOCAL_DEMO_USE_STOP_CODEX_FOUNDATION_LOOP",
        final_go_no_go_local_gate_passed: true,
        production_bridge_status: "LOCAL_READINESS_BRIDGE_PASS",
        required_gate_families: 11,
        blocked_gate_families: 11,
        missing_required_gate_families: 0,
        execution_records_checked: 3,
        blocked_execution_records: 3,
        scale_candidate_blocker_families: 11,
        pause_safety_records_visible: 1,
        monitor_only_safety_records_visible: 1,
        safety_action_records_visible: 2,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        live_execution_blocked: true,
      }),
    );
    expect(response.body.gateFamilyReview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "validateOnly",
          status: "blocked",
          blocker_keys: ["validateOnly_missing"],
          scale_candidate_blocker_family: true,
        }),
        expect.objectContaining({
          key: "provider_identifiers",
          blocker_keys: ["campaignBudgetId"],
        }),
        expect.objectContaining({
          key: "live_path",
          blocker_keys: ["live_path_not_implemented"],
        }),
      ]),
    );
    expect(response.body.executionEvidenceReview).toEqual(
      expect.objectContaining({
        validateOnly_missing_or_blocked_records: 1,
        validateOnly_passed_records: 1,
        approval_missing_or_blocked_records: 1,
        source_readiness_blocked_records: 1,
        finance_policy_blocked_records: 1,
        kill_switch_blocked_records: 1,
        idempotency_blocked_records: 1,
        campaignBudgetId_blocked_records: 1,
        production_flag_blocked_records: 3,
        live_path_blocked_records: 3,
        blockerCoverage: expect.objectContaining({
          scale_candidate_blocked_by_all_gate_families: true,
          validateOnly_missing_or_blocked_records: 1,
          validateOnly_passed_records: 1,
          approval_missing_or_blocked_records: 1,
          approval_audit_missing_or_blocked_records: 1,
          source_readiness_blocked_records: 1,
          finance_policy_blocked_records: 1,
          kill_switch_blocked_records: 1,
          idempotency_blocked_records: 1,
          campaignBudgetId_blocked_records: 1,
          production_flag_blocked_records: 3,
          live_path_blocked_records: 3,
          safety_action_records_visible: 2,
          executable_now_actions: 0,
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      }),
    );
    expect(response.body.productionBridgeReview).toEqual(
      expect.objectContaining({
        status: "LOCAL_READINESS_BRIDGE_PASS",
        providerOrderValid: true,
        bridgeBlockers: [],
        business_safety_gates_uncertain: 8,
        scale_action_mode: "monitor_only_or_blocked",
      }),
    );
    expect(response.body.liveReadinessBlockers).toEqual(
      expect.arrayContaining([
        "GOOGLE_ADS_PRODUCTION_ENABLED",
        "live_path_not_implemented",
        "real_provider_credentials_missing",
        "small_cap_live_test_not_approved",
      ]),
    );
    expect(serialized).not.toContain('"production_ready":true');
    expect(serialized).not.toContain('"execution_allowed_now":true');
    expect(serialized).not.toContain('"provider_api_called":true');
    expect(serialized).not.toContain('"google_ads_api_called":true');

    await request(app.getHttpServer())
      .post("/ai/ads-automation/final-gate-review-export")
      .set("x-test-role", "employee")
      .send({
        fixture: "htx_ads_final_gate_review_demo",
        reportDate: "2026-07-06",
      })
      .expect(403);
  });

  it("returns final gate review export with API-readiness source blockers preserved", async () => {
    const apiReadinessGapReport = {
      schemaVersion: "ads_automation_api_readiness_gap_report.v1",
      generatedAt: "2026-07-06T07:18:00.000Z",
      reportDate: "2026-07-06",
      summary: {
        status: "blocked",
        source_readiness_review_export_consumed: true,
        source_readiness_review_export_mode: "erp_source_import_readiness",
        source_readiness_review_export_status: "needs_attention",
        required_source_count: 5,
        required_source_ready_count: 2,
        required_source_blocked_count: 3,
        required_source_report_date_covered_count: 2,
        required_source_report_date_blocked_count: 3,
        missing_required_source_evidence: [
          "advertising_costs",
          "supplier_safety",
        ],
        source_coverage_blocking_reasons: [
          "freshness_stale",
          "coverage_missing",
        ],
        platform_campaignBudgetId_missing_rows: 1,
        platform_blocked_product_count: 1,
        platform_blocked_supplier_count: 1,
        platform_supplier_choice_safe: false,
        provider_validateOnly_plans: 0,
        provider_validateOnly_passed: 0,
      },
      stages: [
        {
          stage: "final_go_no_go_readiness",
          status: "blocked",
          blockers: [
            "source_readiness_review.required_sources_blocked",
            "source_readiness_review.campaignBudgetId_missing_no_fallback",
            "source_readiness_review.product_allocation_blockers",
            "source_readiness_review.supplier_safety_blockers",
            "production_ready_false",
            "execution_allowed_now_false",
          ],
          evidence: [
            "source_readiness_review_export_consumed=true",
            "source_readiness_review_blockers=4",
            "required_sources_blocked=3",
            "execution_allowed_now=false",
            "production_ready=false",
          ],
          next_required_action:
            "resolve_source_readiness_review_blockers_before_go_no_go",
        },
      ],
      sourceBlockers: [
        "source_readiness_review.required_sources_blocked",
        "source_readiness_review.required_sources_report_date_not_covered",
        "source_readiness_review.campaignBudgetId_missing_no_fallback",
        "source_readiness_review.product_inventory_profit.low_margin",
        "source_readiness_review.supplier_safety.supplier_payment_stale",
      ],
      platformEntityCoverageBlockers: [
        "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
        "platform_entity.inventoryProfit.source_not_ready",
        "platform_entity.supplierContext.source_not_ready",
      ],
      pendingActionNormalization: {
        platformEntityCoverageActionBlockersApplied: [
          {
            blocker:
              "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
          },
        ],
      },
      validateOnlyLane: {
        created: false,
        schemaVersion: null,
        summary: null,
      },
    };

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/final-gate-review-export")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_final_gate_review_demo",
        reportDate: "2026-07-06",
        now: "2026-07-06T07:20:00.000Z",
        apiReadinessGapReport,
      })
      .expect(200);
    const serialized = JSON.stringify(response.body);

    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked_local_gate_defect",
        api_readiness_gap_report_present: true,
        api_readiness_gap_status: "blocked",
        api_readiness_source_blocker_count: 5,
        api_readiness_required_source_blocked_count: 3,
        api_readiness_campaignBudgetId_missing_rows: 1,
        api_readiness_final_go_no_go_stage_status: "blocked",
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.apiReadinessGapReview).toEqual(
      expect.objectContaining({
        gap_report_present: true,
        source_readiness_review_export_consumed: true,
        required_source_blocked_count: 3,
        final_go_no_go_stage_status: "blocked",
        local_review_defect: true,
        review_status: "api_gap_blocked_before_final_go_no_go",
      }),
    );
    expect(
      response.body.apiReadinessGapReview.source_readiness_review_blockers,
    ).toEqual(
      expect.arrayContaining([
        "source_readiness_review.required_sources_blocked",
        "source_readiness_review.campaignBudgetId_missing_no_fallback",
        "source_readiness_review.product_inventory_profit.low_margin",
        "source_readiness_review.supplier_safety.supplier_payment_stale",
      ]),
    );
    expect(response.body.localReviewBlockers).toEqual(
      expect.arrayContaining([
        "api_readiness_gap.source_readiness_blocked",
        "api_readiness_gap.source_readiness_review.required_sources_blocked",
        "api_readiness_gap.source_readiness_review.campaignBudgetId_missing_no_fallback",
      ]),
    );
    expect(response.body.markdownPreview).toContain(
      "API readiness gap review:",
    );
    expect(response.body.markdownPreview).toContain(
      "campaignBudgetId_missing_rows=1",
    );
    expect(serialized).not.toContain('"production_ready":true');
    expect(serialized).not.toContain('"execution_allowed_now":true');
    expect(serialized).not.toContain('"provider_api_called":true');
    expect(serialized).not.toContain('"google_ads_api_called":true');
    expect(serialized).not.toContain('"validateOnly_called":true');
    expect(serialized).not.toContain('"live_ads_execution_used":true');
  });

  it("returns protected credential vault onboarding readiness without exposing secret material", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/credential-vault-onboarding-readiness")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_credential_vault_onboarding_demo",
        reportDate: "2026-07-06",
        now: "2026-07-06T05:30:00.000Z",
      })
      .expect(200);
    const serialized = JSON.stringify(response.body);

    expect(response.body.schemaVersion).toBe(
      "ads_automation_credential_vault_onboarding.v1",
    );
    expect(response.body.status).toBe("LOCAL_CREDENTIAL_ONBOARDING_DEMO_READY");
    expect(response.body.expectedProviderOrder).toEqual([
      "google_ads_mcc",
      "meta_business_manager",
      "tiktok_business_center",
    ]);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        credential_onboarding_layer_demo_ready: true,
        database_readiness_layer_demo_ready: true,
        read_only_import_allowed: false,
        validate_only_allowed: false,
        approval_allowed: false,
        execution_preflight_allowed: false,
        live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        plaintext_secrets_added: false,
        plaintext_secret_returned: false,
        encrypted_payload_returned: false,
        real_credential_material_present: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.providers[0].secret_storage_evidence).toEqual(
      expect.objectContaining({
        adapter: "api_token_service_contract",
        api_token_crypto_util_used: true,
        decrypt_method_exposed_by_endpoint: false,
        plaintext_secret_returned: false,
        encrypted_payload_returned: false,
        encrypted_payload_plaintext_free: true,
      }),
    );
    expect(response.body.databaseReadiness.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection: "api_tokens",
          model: "ApiToken",
        }),
        expect.objectContaining({
          collection: "api_token_audits",
          model: "ApiTokenAudit",
        }),
        expect.objectContaining({
          collection: "google_ads_action_execution_logs",
        }),
      ]),
    );
    expect(serialized).not.toContain(
      "FAKE_GOOGLE_REFRESH_MATERIAL_FOR_ENCRYPTION_TEST_ONLY",
    );
    expect(serialized).not.toContain(
      "FAKE_META_ACCESS_MATERIAL_FOR_ENCRYPTION_TEST_ONLY",
    );
    expect(serialized).not.toContain(
      "FAKE_TIKTOK_ACCESS_MATERIAL_FOR_ENCRYPTION_TEST_ONLY",
    );
  });

  it("rejects credential vault onboarding without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/credential-vault-onboarding-readiness")
      .set("x-test-role", "employee")
      .send({
        fixture: "htx_ads_credential_vault_onboarding_demo",
        reportDate: "2026-07-06",
      })
      .expect(403);
  });

  it("returns protected local small-cap readiness simulation and downgrades unsafe scale-up to monitor_only", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/small-cap-readiness-simulator")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_small_cap_readiness_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T06:00:00.000Z",
      })
      .expect(200);

    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_small_cap_readiness_simulator.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        campaignBudgetId_no_fallback: true,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.sourceDigest).toEqual(
      expect.objectContaining({
        foundation_snapshot_schema_version:
          "ads_automation_decision_foundation_snapshot.v1",
        draft_preview_schema_version:
          "ads_automation_decision_draft_preview.v1",
        loss_limit_policy_schema_version: "ads_automation_loss_limit_policy.v1",
        provider_account_readiness_schema_version:
          "ads_automation_provider_account_readiness.v1",
        decision_snapshot_reused: true,
        read_model_snapshot_preserved: true,
        draft_preview_reused: true,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked_monitor_only",
        fixture_mode: "htx_ads_small_cap_readiness_demo",
        update_budget_drafts: 1,
        eligible_small_cap_candidates: 1,
        requested_increase_vnd: 200000,
        simulated_capped_increase_vnd: 100000,
        approved_increase_vnd: 0,
        blocked_increase_vnd: 200000,
        scale_up_execution_mode: "monitor_only",
        small_cap_live_test_allowed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.budgetCandidates[0]).toEqual(
      expect.objectContaining({
        campaignBudgetId: "BUDGET_SCALE",
        campaignBudgetIdNoFallback: true,
        currentDailyBudgetVnd: 1000000,
        requestedDailyBudgetVnd: 1200000,
        simulatedCappedIncreaseVnd: 100000,
        approvedIncreaseVnd: 0,
        status: "eligible_for_small_cap_simulation",
      }),
    );
    expect(response.body.cashflowAndLossLimitBlockers).toEqual(
      expect.arrayContaining([
        "daily_loss_limit_breached",
        "monthly_loss_limit_breached",
        "human_approval_missing",
        "loss_limit_policy.all_safe_for_increase_false",
      ]),
    );
    expect(response.body.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "loss_limit_policy",
          status: "monitor_only",
        }),
        expect.objectContaining({ stage: "approval_gate", status: "pending" }),
        expect.objectContaining({
          stage: "validate_only_gate",
          status: "pending",
        }),
        expect.objectContaining({
          stage: "execution_preflight",
          status: "blocked",
        }),
      ]),
    );
    expect(response.body.markdownPreview).toContain(
      "provider_api_called=false",
    );
  });

  it("rejects small-cap readiness simulation without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/small-cap-readiness-simulator")
      .set("x-test-role", "employee")
      .send({
        fixture: "htx_ads_small_cap_readiness_demo",
        reportDate: "2026-07-04",
      })
      .expect(403);
  });

  it("returns protected small-cap approval/preflight linkage evidence without provider or execution use", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/small-cap-approval-preflight-linkage")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_small_cap_approval_preflight_linkage_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T07:15:00.000Z",
      })
      .expect(200);

    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_small_cap_approval_preflight_linkage.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        approval_evidence_readback_reused: true,
        validateOnly_evidence_readback_reused: true,
        policy_decision_evidence_readback_reused: true,
        execution_preflight_readback_reused: true,
        linkage_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        campaignBudgetId_no_fallback: true,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked_missing_evidence",
        fixture_mode: "htx_ads_small_cap_approval_preflight_linkage_demo",
        simulator_status: "blocked_monitor_only",
        small_cap_candidates: 1,
        approval_evidence_indexes_received: 0,
        candidates_with_approval_link: 0,
        candidates_with_validateOnly_evidence: 0,
        candidates_with_policy_evidence: 0,
        candidates_with_preflight_evidence: 0,
        fully_linked_candidates: 0,
        executable_now: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.candidateLinks[0]).toEqual(
      expect.objectContaining({
        status: "not_linked_to_approval_evidence",
        campaignBudgetId: "BUDGET_SCALE",
        campaignBudgetIdNoFallback: true,
        approval_id: null,
        blockers: expect.arrayContaining([
          "pending_approval_evidence_missing",
          "validateOnly_evidence_missing_for_approval",
          "policy_decision_evidence_missing_for_approval",
          "execution_preflight_readback_missing_for_approval",
        ]),
      }),
    );
    expect(response.body.sourceDigest).toEqual(
      expect.objectContaining({
        simulator_schema_version:
          "ads_automation_small_cap_readiness_simulator.v1",
        approval_evidence_index_reused: true,
        validateOnly_evidence_readback_reused: true,
        policy_decision_evidence_readback_reused: true,
        execution_preflight_readback_reused: true,
      }),
    );
    expect(response.body.markdownPreview).toContain(
      "provider_api_called=false",
    );

    await request(app.getHttpServer())
      .post("/ai/ads-automation/small-cap-approval-preflight-linkage")
      .set("x-test-role", "employee")
      .send({
        fixture: "htx_ads_small_cap_approval_preflight_linkage_demo",
        reportDate: "2026-07-04",
      })
      .expect(403);
  });

  it("returns protected local loss-limit policy evidence without provider or live execution use", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/loss-limit-policy")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_loss_policy_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_loss_limit_policy.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        fixture_or_payload_only: true,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        approval_required_for_all_actions: true,
        campaignBudgetId_no_fallback: true,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        requested_action_type: "update_campaign_budget",
        requested_action_mode: "scale_up",
        policy_allowed_for_requested_action: false,
        all_safe_for_increase: false,
        scale_up_execution_mode: "monitor_only",
        human_approval_present: false,
        daily_loss_limit_safe: false,
        monthly_loss_limit_safe: false,
        spend_caps_safe: false,
        contribution_profit_safe: false,
        cash_conversion_working_capital_safe: false,
        fulfillment_capacity_safe: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.scaleBlockers).toEqual(
      expect.arrayContaining([
        "daily_loss_limit_breached",
        "monthly_loss_limit_breached",
        "campaign.1001.daily_spend_cap_exceeded",
        "contribution_profit_missing_or_unsafe",
        "cash_conversion_or_working_capital_health_missing",
        "fulfillment_capacity_missing",
      ]),
    );
    expect(response.body.safeActionsAvailable).toEqual(
      expect.arrayContaining([
        "pause_campaign",
        "pause_ad_group",
        "reduce_campaign_budget",
        "monitor_only",
      ]),
    );
  });

  it("returns protected local monitoring, rate-limit, alert, incident, and acknowledgement evidence without provider or live execution use", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/monitoring-incident-readiness")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_monitoring_incident_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T06:45:00.000Z",
      })
      .expect(200);

    expect(response.body.schemaVersion).toBe(
      "ads_automation_monitoring_incident_readiness.v1",
    );
    expect(response.body.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        fixture_or_payload_only: true,
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
        monitoring_health_required_before_increase: true,
        rate_limit_budget_required_before_increase: true,
        active_incident_blocks_increase: true,
        operator_acknowledgement_required_for_blocking_alerts: true,
      }),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_future_executor_local_only",
        monitoring_healthy: true,
        rate_limit_budget_safe: true,
        spend_rate_safe: true,
        provider_error_rate_safe: true,
        import_freshness_safe: true,
        validateOnly_preflight_alerts_clear: true,
        scale_up_execution_mode: "pending_validation",
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.providerRateLimits[0]).toEqual(
      expect.objectContaining({
        provider: "google_ads",
        status: "safe",
        remainingRequests: 680,
        blockers: [],
      }),
    );

    await request(app.getHttpServer())
      .post("/ai/ads-automation/monitoring-incident-readiness")
      .set("x-test-role", "employee")
      .send({
        fixture: "htx_ads_monitoring_incident_demo",
        reportDate: "2026-07-04",
      })
      .expect(403);
  });

  it("integrates loss-limit policy evidence into read-only platform import readiness blockers", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-readonly-import-readiness")
      .set("x-test-role", "manager")
      .send({
        fixture: "htx_ads_readiness_demo",
        lossLimitPolicyFixture: "htx_ads_loss_policy_demo",
        reportDate: "2026-07-04",
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(response.body.lossLimitPolicy).toEqual(
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
    expect(response.body.cashflowFirstGate.blockers).toEqual(
      expect.arrayContaining([
        "daily_loss_limit_breached",
        "monthly_loss_limit_breached",
        "spend_caps_missing_or_unsafe",
        "campaign.1001.daily_spend_cap_exceeded",
        "contribution_profit_missing_or_unsafe",
        "cash_conversion_or_working_capital_health_missing",
      ]),
    );
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
  });

  it("returns a protected local API-readiness gap report without provider or live execution use", async () => {
    const readonlyImportReadiness = app
      .get(AdsAutomationReadonlyPlatformImportReadinessService)
      .build({
        ...readonlyImportReadyEndpointPayload(),
        sourceSyncStatus: freshReadonlyImportSourceSyncStatus(),
      });

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/api-readiness-gap-report")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        now: "2026-07-04T05:00:00.000Z",
        readonlyImportReadiness,
      })
      .expect(200);

    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        exportJobId: "ads-draft-preview-20260704",
        reportDate: "2026-07-04",
        syncPolicy: "export_cached",
        sourceKeys: [
          "google_ads",
          "advertising_costs",
          "product_mapping",
          "inventory_profit",
          "supplier_safety",
        ],
      }),
    );
    expect(platformSourceSyncStatus.build).not.toHaveBeenCalled();
    expect(response.body.schemaVersion).toBe(
      "ads_automation_api_readiness_gap_report.v1",
    );
    expect(response.body.safety).toEqual(
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
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        source_blocker_count: 0,
        platform_entity_coverage_present: true,
        platform_metric_row_count: 2,
        platform_metric_ready_row_count: 2,
        platform_campaign_count: 2,
        platform_ad_group_count: 2,
        platform_campaignBudget_count: 2,
        platform_campaignBudgetId_missing_rows: 0,
        platform_mapped_product_count: 2,
        platform_mapped_ad_group_count: 2,
        platform_unmapped_ad_group_count: 0,
        platform_latest_successful_sync_at: "2026-07-04T04:30:00.000Z",
        platform_latest_record_date: "2026-07-04",
        pending_actions_created: 2,
        provider_validateOnly_plans: 1,
        provider_validateOnly_pending: 1,
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
    expect(response.body.platformEntityCoverage).toEqual(
      expect.objectContaining({
        metrics: expect.objectContaining({
          rows: 2,
          readyRows: 2,
        }),
        campaignBudgets: expect.objectContaining({
          campaignBudgetIds: ["3001", "3002"],
          missingCampaignBudgetIdRows: 0,
          campaignBudgetId_required: true,
          campaignBudgetId_no_fallback: true,
          campaignBudgetId_fallback_used: false,
        }),
        productMapping: expect.objectContaining({
          mappedProductIds: ["P_BAD", "P_SCALE"],
          mappedAdGroupIds: ["2001", "2002"],
          unmappedAdGroupIds: [],
          sourceReady: true,
        }),
        supplierContext: expect.objectContaining({
          safeSupplierIds: ["SUP_SAFE"],
          blockedSupplierIds: ["SUP_WEAK_1", "SUP_WEAK_2"],
          sourceReady: true,
        }),
        freshnessCoverage: expect.objectContaining({
          latestSuccessfulSyncAt: "2026-07-04T04:30:00.000Z",
          latestRecordDate: "2026-07-04",
          blockingReasons: [],
        }),
      }),
    );
    expect(response.body.platformEntityCoverageBlockers).toEqual(
      expect.arrayContaining([
        "platform_entity.inventoryProfit.product_net_profit_not_positive",
        "platform_entity.supplierContext.margin_after_cost_below_minimum",
      ]),
    );
    expect(response.body.baControlAnswers).toEqual(
      expect.objectContaining({
        increase_ads: "no_monitor_only",
        increase_amount_vnd: 0,
        blocked_increase_amount_vnd: 200000,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(response.body.baControlAnswers.target_ad_groups).toEqual([
      expect.objectContaining({
        adGroupId: "2001",
        campaignBudgetId: "3001",
      }),
    ]);
    expect(response.body.cashflowFirstSafety.blockers).toEqual(
      expect.arrayContaining([
        "cash_conversion_or_working_capital_health_missing",
        "fulfillment_capacity_missing",
        "daily_loss_limit_missing",
        "monthly_loss_limit_missing",
      ]),
    );
    expect(response.body.remainingApiPrerequisites).toEqual(
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
    expect(response.body.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "source_import_readiness",
          status: "ready",
        }),
        expect.objectContaining({ stage: "pending_actions", status: "ready" }),
        expect.objectContaining({ stage: "validate_only", status: "pending" }),
        expect.objectContaining({
          stage: "execution_preflight",
          status: "blocked",
          blockers: expect.arrayContaining([
            "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
            "future_executor_not_implemented",
          ]),
        }),
      ]),
    );
  });

  it("accepts source readiness review export evidence in the API-readiness gap report and blocks validateOnly planning", async () => {
    const sourceSyncStatus = readonlyImportSourceSyncStatusWithBlockedSource({
      sourceKey: "inventory_profit",
      freshnessStatus: "fresh",
      coverageStatus: "no_records_for_report_date",
      latestRecordDate: "2026-07-03",
      blockingReasons: ["inventory_profit_latest_record_date_not_report_date"],
    });
    const readonlyImportReadiness = app
      .get(AdsAutomationReadonlyPlatformImportReadinessService)
      .build({
        ...readonlyImportReadyEndpointPayload({
          metricRows:
            ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE.metricRows,
        }),
        sourceSyncStatus,
      });
    const sourceReadinessReviewExport = app
      .get(AdsAutomationSourceReadinessReviewExportService)
      .build({
        reportDate: "2026-07-04",
        exportMode: "erp_source_import_readiness",
        sourceSyncStatus,
        readonlyImportReadiness,
      });
    const compactSourceReadinessReviewExport = {
      schemaVersion: sourceReadinessReviewExport.schemaVersion,
      exportMode: sourceReadinessReviewExport.exportMode,
      summary: sourceReadinessReviewExport.summary,
      campaignBudgetEvidence:
        sourceReadinessReviewExport.campaignBudgetEvidence,
      blockerReview: sourceReadinessReviewExport.blockerReview,
      sourceSyncStatus: {
        schemaVersion: sourceSyncStatus.schemaVersion,
      },
      readonlyImportReadiness,
    };

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/api-readiness-gap-report")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        now: "2026-07-04T05:00:00.000Z",
        sourceReadinessReviewExport: compactSourceReadinessReviewExport,
      })
      .expect(200);

    expect(response.body.summary).toEqual(
      expect.objectContaining({
        source_readiness_review_export_consumed: true,
        source_readiness_review_export_mode: "erp_source_import_readiness",
        required_source_blocked_count:
          sourceReadinessReviewExport.summary.required_source_blocked_count,
        required_source_report_date_blocked_count:
          sourceReadinessReviewExport.summary
            .required_source_report_date_blocked_count,
        provider_validateOnly_plans: 0,
        provider_validateOnly_pending: 0,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.body.sourceBlockers).toEqual(
      expect.arrayContaining([
        "source_readiness_review.required_sources_blocked",
        "source_readiness_review.required_sources_report_date_not_covered",
        "source_readiness_review.campaignBudgetId_missing_no_fallback",
        "source_readiness_review.product_allocation_blockers",
      ]),
    );
    expect(response.body.validateOnlyLane).toEqual(
      expect.objectContaining({
        created: false,
        schemaVersion: null,
        summary: null,
      }),
    );
    expect(response.body.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "validate_only",
          status: "blocked",
          blockers: expect.arrayContaining([
            "source_readiness_review.required_sources_blocked",
            "source_readiness_review.campaignBudgetId_missing_no_fallback",
          ]),
          next_required_action:
            "resolve_source_readiness_review_blockers_before_validateOnly",
        }),
        expect.objectContaining({
          stage: "final_go_no_go_readiness",
          status: "blocked",
          blockers: expect.arrayContaining([
            "source_readiness_review.required_sources_blocked",
            "production_ready_false",
            "execution_allowed_now_false",
          ]),
          next_required_action:
            "resolve_source_readiness_review_blockers_before_go_no_go",
        }),
      ]),
    );
  });

  it("integrates loss-limit policy evidence into the API-readiness gap report", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/api-readiness-gap-report")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        now: "2026-07-04T05:00:00.000Z",
        lossLimitPolicyFixture: "htx_ads_loss_policy_demo",
      })
      .expect(200);

    expect(response.body.lossLimitPolicy).toEqual(
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
        ]),
      }),
    );
    expect(response.body.cashflowFirstSafety.blockers).toEqual(
      expect.arrayContaining([
        "daily_loss_limit_breached",
        "monthly_loss_limit_breached",
        "campaign.1001.daily_spend_cap_exceeded",
        "cash_conversion_or_working_capital_health_missing",
        "contribution_profit_missing_or_unsafe",
      ]),
    );
    expect(response.body.baControlAnswers).toEqual(
      expect.objectContaining({
        increase_ads: "no_monitor_only",
        blocked_increase_amount_vnd: 200000,
        scale_up_execution_mode: "monitor_only",
        execution_allowed_now: false,
      }),
    );
    expect(response.body.remainingApiPrerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "spend_caps", status: "contract_only" }),
        expect.objectContaining({
          key: "loss_limits",
          status: "contract_only",
        }),
      ]),
    );
  });

  it("rejects malformed mocked provider results for the API-readiness gap report", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/api-readiness-gap-report")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        mockedProviderResults: { status: "provider_validate_passed" },
      })
      .expect(400);

    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).toHaveBeenCalled();
  });

  it("rejects the read-model snapshot path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-read-model-snapshot")
      .set("x-test-role", "employee")
      .send({ snapshotDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the decision foundation snapshot path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-foundation-snapshot")
      .set("x-test-role", "employee")
      .send({ snapshotDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the read-model decision foundation snapshot path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-foundation-read-model-snapshot")
      .set("x-test-role", "employee")
      .send({ snapshotDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the read-model decision foundation review export path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-foundation-read-model-review-export")
      .set("x-test-role", "employee")
      .send({ snapshotDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the read-model decision foundation reviewer docs path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-foundation-read-model-reviewer-docs")
      .set("x-test-role", "employee")
      .send({ snapshotDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the draft preview path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-preview")
      .set("x-test-role", "employee")
      .send({ snapshotDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the platform source-sync status path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-source-sync-status")
      .set("x-test-role", "employee")
      .send({ reportDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the read-only platform import readiness path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/platform-readonly-import-readiness")
      .set("x-test-role", "employee")
      .send({ fixture: "htx_ads_readiness_demo", reportDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the provider account readiness path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/provider-account-readiness")
      .set("x-test-role", "employee")
      .send({
        fixture: "htx_ads_provider_account_readiness_demo",
        reportDate: "2026-07-04",
      })
      .expect(403);
  });

  it("rejects the manager account control-plane readiness path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/manager-account-control-plane-readiness")
      .set("x-test-role", "employee")
      .send({
        fixture: "htx_ads_manager_account_control_plane_demo",
        reportDate: "2026-07-06",
      })
      .expect(403);
  });

  it("rejects the loss-limit policy path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/loss-limit-policy")
      .set("x-test-role", "employee")
      .send({ fixture: "htx_ads_loss_policy_demo", reportDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the API-readiness gap report path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/api-readiness-gap-report")
      .set("x-test-role", "employee")
      .send({ snapshotDate: "2026-07-04" })
      .expect(403);
  });

  it("rejects the draft approval import path without marketer read permission", async () => {
    await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-draft-approval-import")
      .set("x-test-role", "employee")
      .send(validDraftPreview("ads-draft:controller:employee-blocked"))
      .expect(403);
  });

  it("rejects the pending approval queue read paths without marketer read permission", async () => {
    await request(app.getHttpServer())
      .get("/ai/ads-automation/decision-draft-approvals")
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-employee-blocked",
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-employee-blocked/readiness",
      )
      .set("x-test-role", "employee")
      .expect(403);

    await request(app.getHttpServer())
      .post(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-employee-blocked/decision-validation",
      )
      .set("x-test-role", "employee")
      .send({
        decision: "approve",
        reason: "Employee should not validate approval decisions.",
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-employee-blocked/decision-audit-record-preview",
      )
      .set("x-test-role", "employee")
      .send({
        decision: "approve",
        reason: "Employee should not preview decision audit records.",
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-employee-blocked/decision",
      )
      .set("x-test-role", "employee")
      .send({
        decision: "approve",
        reason: "Employee should not approve local ads decisions.",
      })
      .expect(403);
  });

  it("does not expose public decision audit readback routes in this service-only slice", async () => {
    await request(app.getHttpServer())
      .get("/ai/ads-automation/decision-audit-records/ADSAUDIT-not-public")
      .set("x-test-role", "manager")
      .expect(404);

    await request(app.getHttpServer())
      .get(
        "/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-not-public/decision-audit-records",
      )
      .set("x-test-role", "manager")
      .expect(404);
  });

  it("returns missing campaignBudgetId evidence and never falls back to campaign or ad group IDs", async () => {
    useRepositoryRows(
      readModelRows({
        adGroups: [
          {
            ...readModelRows().adGroups[0],
            campaignBudgetId: undefined,
            campaignBudgetResourceName: undefined,
            currentBudgetVnd: 1000000,
          },
        ],
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-read-model-snapshot")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    const scaleDecision = response.body.snapshot.decisions.find(
      (item: any) =>
        item.decision_type === "scale_ads" && item.entity_id === "2001",
    );

    expect(
      response.body.snapshot.decisions.some(
        (item: any) =>
          item.decision_type === "scale_amount" && item.entity_id === "2001",
      ),
    ).toBe(false);
    expect(scaleDecision.status).toBe("insufficient_data");
    expect(scaleDecision.currentValue.campaignBudgetId).toBeNull();
    expect(scaleDecision.currentValue.campaignBudgetId).not.toBe("1001");
    expect(scaleDecision.currentValue.campaignBudgetId).not.toBe("2001");
    expect(response.body.queryEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "campaign_budgets",
          entityId: "2001",
          status: "missing",
          missingFields: ["campaignBudgetId_or_campaignBudgetResourceName"],
        }),
      ]),
    );
  });

  it("surfaces stale source watermark evidence on the read-model snapshot response", async () => {
    useRepositoryRows(
      readModelRows({
        watermarks: {
          ...readModelRows().watermarks,
          campaign_budgets: "2026-06-30T00:00:00.000Z",
        },
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/ai/ads-automation/decision-read-model-snapshot")
      .set("x-test-role", "manager")
      .send({
        snapshotDate: "2026-07-04",
        evidenceWindow,
        maxAgeHours: { campaign_budgets: 24 },
        now: "2026-07-04T05:00:00.000Z",
      })
      .expect(200);

    expect(response.body.sourceEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "campaign_budgets",
          status: "stale",
          canUseForDecision: "cautious",
          latestObservedAt: "2026-06-30T00:00:00.000Z",
          maxAgeHours: 24,
        }),
      ]),
    );
  });
});
