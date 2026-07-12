import { BadRequestException } from "@nestjs/common";
import { AdsAutomationDecisionDraftApprovalRepository } from "./ads-automation-decision-draft-approval.repository";
import { AdsAutomationExecutionPreflightDryRunRepository } from "./ads-automation-execution-preflight-dry-run.repository";
import { AdsAutomationExecutionPreflightDryRunService } from "./ads-automation-execution-preflight-dry-run.service";
import { AdsAutomationPolicyDecisionEvidenceRepository } from "./ads-automation-policy-decision-evidence.repository";
import { AdsAutomationValidateOnlyEvidenceRepository } from "./ads-automation-validate-only-evidence.repository";
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from "./contracts/ads-automation-decision-draft-approval.contract";
import type {
  AdsAutomationPolicyDecisionEvidenceInput,
  AdsAutomationPolicyDecisionEvidenceRecord,
} from "./contracts/ads-automation-policy-decision-evidence.contract";
import type { AdsAutomationProviderValidateOnlyActionPlan } from "./contracts/ads-automation-provider-validate-only.contract";
import type { AdsAutomationValidateOnlyEvidenceRecord } from "./contracts/ads-automation-validate-only-evidence.contract";
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from "./source-sync/source-sync-result.types";

type ProviderAction =
  | "update_campaign_budget"
  | "pause_campaign"
  | "pause_ad_group";

function approvedRecord(
  actionType: ProviderAction,
  overrides: Partial<AdsAutomationDecisionDraftPendingApprovalRecord> = {},
): AdsAutomationDecisionDraftPendingApprovalRecord {
  const typedPayloadByAction: Record<
    ProviderAction,
    Record<string, unknown>
  > = {
    update_campaign_budget: {
      customerId: "1234567890",
      campaignId: "1001",
      adGroupId: "2001",
      campaignBudgetId: "3001",
      campaignBudgetResourceName: "customers/1234567890/campaignBudgets/3001",
      dailyBudget: 1200000,
      currentBudgetVnd: 1000000,
      increasePercent: 20,
    },
    pause_campaign: {
      customerId: "1234567890",
      campaignId: "1001",
      targetStatus: "PAUSED",
      reason: "Spend exceeded ERP loss threshold.",
    },
    pause_ad_group: {
      customerId: "1234567890",
      campaignId: "1001",
      adGroupId: "2001",
      targetStatus: "PAUSED",
      reason: "Ad group lost money after ads during the evidence window.",
    },
  };

  return {
    approval_id: `ADSAPPROVAL-ads-draft_2026-07-04_${actionType}`,
    source_schema_version: "ads_automation_decision_draft_preview.v1",
    source_draft_id: `ADSDRAFT-20260704-${actionType}`,
    source_decision_id: `DEC-${actionType}-20260704`,
    action_type: actionType,
    action_family: "provider_google_ads",
    provider: "google",
    resource_type:
      actionType === "update_campaign_budget"
        ? "campaign_budget"
        : actionType === "pause_campaign"
          ? "campaign"
          : "ad_group",
    entity_type: actionType === "pause_campaign" ? "campaign" : "ad_group",
    entity_id: actionType === "pause_campaign" ? "1001" : "2001",
    accountId: "1234567890",
    productId: "P_SCALE",
    supplierId: null,
    platform: "google",
    status: "approved",
    approval_required: true,
    execution_allowed_now: false,
    validate_only_required: true,
    future_provider_validateOnly_required: true,
    provider_api_called: false,
    google_ads_api_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: "erp_local_mongo",
    typedPayload: typedPayloadByAction[actionType],
    source_evidence_references: [],
    sourceSyncDecisionEvidence: sourceSyncDecisionEvidence(),
    sourceSyncDecisionGates: sourceSyncDecisionGates(),
    blockers: [],
    missing_data_blockers: [],
    idempotency_key: `ads-draft:2026-07-04:${actionType}:controller`,
    rationale: `${actionType} was approved locally after ERP evidence review.`,
    createdAt: "2026-07-04T05:00:00.000Z",
    persistedAt: "2026-07-04T05:00:00.000Z",
    ...overrides,
  };
}

function monitorOnlyRecord(
  overrides: Partial<AdsAutomationDecisionDraftPendingApprovalRecord> = {},
): AdsAutomationDecisionDraftPendingApprovalRecord {
  return {
    ...approvedRecord("pause_campaign"),
    approval_id: "ADSAPPROVAL-ads-draft_2026-07-04_monitor_only",
    source_draft_id: "ADSDRAFT-20260704-monitor_only",
    source_decision_id: "DEC-monitor_only-20260704",
    action_type: "monitor_only",
    action_family: "monitoring",
    provider: "none",
    resource_type: "monitoring",
    entity_type: "ad_group",
    entity_id: "2001",
    accountId: "1234567890",
    productId: "P_SCALE",
    supplierId: null,
    platform: "google",
    validate_only_required: false,
    future_provider_validateOnly_required: false,
    typedPayload: {
      customerId: "1234567890",
      campaignId: "1001",
      adGroupId: "2001",
      safetyAction: "monitor_only",
      reason: "Cashflow guard preserved the candidate as observation-only.",
    },
    idempotency_key: "ads-draft:2026-07-04:monitor_only:cashflow-guard",
    rationale: "Monitor-only safety action remains visible and non-executable.",
    ...overrides,
  };
}

function sourceSyncDecisionEvidence(
  overrides: Partial<SourceSyncDecisionEvidence>[] = [],
): SourceSyncDecisionEvidence[] {
  return [
    "google_ads",
    "advertising_costs",
    "product_mapping",
    "inventory_profit",
    "supplier_safety",
  ].map(
    (sourceKey, index) =>
      ({
        sourceKey,
        reportDate: "2026-07-04",
        freshnessStatus: "fresh",
        coverageStatus:
          sourceKey === "product_mapping" ? "not_applicable" : "covered",
        lastSuccessfulSyncAt:
          sourceKey === "product_mapping" ? null : "2026-07-04T04:00:00.000Z",
        latestRecordDate: sourceKey === "product_mapping" ? null : "2026-07-04",
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
        ...(overrides[index] || {}),
      }) as SourceSyncDecisionEvidence,
  );
}

function sourceSyncDecisionGates(
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
  } as Partial<SourceSyncDecisionGates>;
}

function approvalAuditRecord(
  approval: AdsAutomationDecisionDraftPendingApprovalRecord,
  overrides: Partial<AdsAutomationDecisionDraftApprovalDecisionAuditRecord> = {},
): AdsAutomationDecisionDraftApprovalDecisionAuditRecord {
  return {
    schemaVersion:
      "ads_automation_decision_draft_approval_decision_audit_record.v1",
    audit_id: `ADSAUDIT-${approval.approval_id}-approve`,
    idempotency_key: `ads-decision-audit:${approval.approval_id}:approve:REQ-AUDIT`,
    approval_id: approval.approval_id,
    source_draft_id: approval.source_draft_id,
    source_decision_id: approval.source_decision_id,
    action_type: approval.action_type,
    action_family: approval.action_family,
    provider: approval.provider,
    resource_type: approval.resource_type,
    entity_type: approval.entity_type,
    entity_id: approval.entity_id,
    accountId: approval.accountId,
    productId: approval.productId,
    supplierId: approval.supplierId,
    platform: approval.platform,
    previous_status: "pending_approval",
    proposed_status: "approved",
    decision: "approve",
    reviewerUserId: "director-1",
    reviewerRole: "director",
    reason: "Approved local dry-run action after ERP evidence review.",
    requestId: "REQ-AUDIT",
    validation_status: "eligible_for_human_decision",
    prerequisites_valid: 12,
    prerequisites_blocked: 0,
    blockers: [],
    prerequisites: [],
    pending_approval_snapshot: approval,
    audit_record_persisted: true,
    status_change_performed: true,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    execution_allowed_now: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: "erp_local_mongo",
    source_preview_createdAt: approval.createdAt,
    createdAt: "2026-07-04T05:30:00.000Z",
    persistedAt: "2026-07-04T05:30:01.000Z",
    ...overrides,
  };
}

function validationPlan(
  approval: AdsAutomationDecisionDraftPendingApprovalRecord,
  overrides: Partial<AdsAutomationProviderValidateOnlyActionPlan> = {},
): AdsAutomationProviderValidateOnlyActionPlan {
  const payload = approval.typedPayload || {};
  return {
    validation_id: `ADSPROVIDERVALIDATE-${approval.approval_id}`,
    pending_action_id: `ADSPENDINGACTION-${approval.approval_id}`,
    approval_id: approval.approval_id,
    source_pending_action_status: "pending_validation",
    action_type: approval.action_type as ProviderAction,
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
    providerRequestId: `REQ-VALIDATE-${approval.approval_id}`,
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
      snapshot: {
        syncedAt: "2026-07-04T05:55:00.000Z",
        status: "ENABLED",
      },
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
      evidence: ["Mocked validate-only evidence supplied by ERP test fixture."],
    },
    blockers: [],
    approval_can_be_considered_executable: true,
    executable_now: false,
    execution_allowed_now: false,
    validate_only_required_before_execution: true,
    next_required_action: "continue_human_approval_flow",
    source_pending_action: {} as any,
    ...overrides,
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
    persistedAt: createdAt,
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
    idempotency_key: [
      "ads-validate-only-evidence",
      input.approval_id.replace(/[^a-z0-9._:-]/gi, "_"),
      String(requestId || input.validation_id).replace(/[^a-z0-9._:-]/gi, "_"),
    ].join(":"),
    schemaVersion: "ads_automation_validate_only_evidence.v1",
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
    persistedAt: createdAt,
  };
}

describe("AdsAutomationExecutionPreflightDryRunService", () => {
  const originalProductionEnabled = process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
  let approvalRepository: jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
  let preflightRepository: jest.Mocked<AdsAutomationExecutionPreflightDryRunRepository>;
  let validateOnlyEvidenceRepository: jest.Mocked<AdsAutomationValidateOnlyEvidenceRepository>;
  let policyDecisionEvidenceRepository: jest.Mocked<AdsAutomationPolicyDecisionEvidenceRepository>;
  let persistedExecutionRecordsByIdempotencyKey: Map<string, any>;
  let validateOnlyEvidenceRecordsById: Map<
    string,
    AdsAutomationValidateOnlyEvidenceRecord
  >;
  let validateOnlyEvidenceRecordsByIdempotencyKey: Map<
    string,
    AdsAutomationValidateOnlyEvidenceRecord
  >;
  let policyEvidenceRecordsById: Map<
    string,
    AdsAutomationPolicyDecisionEvidenceRecord
  >;
  let policyEvidenceRecordsByIdempotencyKey: Map<
    string,
    AdsAutomationPolicyDecisionEvidenceRecord
  >;
  let service: AdsAutomationExecutionPreflightDryRunService;

  beforeEach(() => {
    approvalRepository = {
      findByApprovalIds: jest.fn(),
    } as unknown as jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
    persistedExecutionRecordsByIdempotencyKey = new Map();
    policyEvidenceRecordsById = new Map();
    policyEvidenceRecordsByIdempotencyKey = new Map();
    preflightRepository = {
      createManyIdempotent: jest.fn(async (records: any[]) => {
        let created = 0;
        let reused = 0;
        const createdExecutionRecordIds: string[] = [];
        const createdIdempotencyKeys: string[] = [];
        const reusedExecutionRecordIds: string[] = [];
        const reusedIdempotencyKeys: string[] = [];
        const persisted = records.map((record) => {
          const existing = persistedExecutionRecordsByIdempotencyKey.get(
            record.idempotency_key,
          );
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
            persistedAt: `2026-07-04T07:00:0${created}.000Z`,
          };
          persistedExecutionRecordsByIdempotencyKey.set(
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
      }),
    } as unknown as jest.Mocked<AdsAutomationExecutionPreflightDryRunRepository>;
    validateOnlyEvidenceRecordsById = new Map();
    validateOnlyEvidenceRecordsByIdempotencyKey = new Map();
    validateOnlyEvidenceRepository = {
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
            validateOnlyEvidenceRecordsById.get(validationId),
          )
          .filter((record): record is AdsAutomationValidateOnlyEvidenceRecord =>
            Boolean(record),
          ),
      ),
    } as unknown as jest.Mocked<AdsAutomationValidateOnlyEvidenceRepository>;
    policyDecisionEvidenceRepository = {
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
            policyEvidenceRecordsById.get(policyDecisionId),
          )
          .filter(
            (record): record is AdsAutomationPolicyDecisionEvidenceRecord =>
              Boolean(record),
          ),
      ),
    } as unknown as jest.Mocked<AdsAutomationPolicyDecisionEvidenceRepository>;
    service = new AdsAutomationExecutionPreflightDryRunService(
      approvalRepository,
      preflightRepository,
      validateOnlyEvidenceRepository,
      policyDecisionEvidenceRepository,
    );
    delete process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
  });

  afterAll(() => {
    if (originalProductionEnabled === undefined) {
      delete process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
    } else {
      process.env.GOOGLE_ADS_PRODUCTION_ENABLED = originalProductionEnabled;
    }
  });

  it("creates local dry-run records for the three supported approved provider actions when only the live executor is absent", async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const approvals = [
      approvedRecord("update_campaign_budget"),
      approvedRecord("pause_campaign"),
      approvedRecord("pause_ad_group"),
    ];
    approvalRepository.findByApprovalIds.mockResolvedValue(approvals);

    const response = await service.build({
      approvalIds: approvals.map((approval) => approval.approval_id),
      validationPlans: approvals.map((approval) => validationPlan(approval)),
      approvalDecisionAuditRecords: approvals.map((approval) =>
        approvalAuditRecord(approval),
      ),
      policyDecisions: approvals.map((approval) => ({
        approval_id: approval.approval_id,
        policy_allowed: true,
        policy_source: "erp_cashflow_ads_policy",
        blockers: [],
      })),
      requestId: "REQ-EXEC-PREFLIGHT-LOCAL-DRY-RUN",
      requestedByUserId: "director-1",
      requestedByRole: "director",
    });

    expect(approvalRepository.findByApprovalIds).toHaveBeenCalledWith(
      approvals.map((approval) => approval.approval_id),
    );
    expect(response.schemaVersion).toBe(
      "ads_automation_execution_preflight_dry_run.v1",
    );
    expect(response.safety).toEqual(
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
    expect(response.summary).toEqual(
      expect.objectContaining({
        approvals_requested: 3,
        approvals_loaded: 3,
        records_created: 3,
        supported_action_records: 3,
        unsupported_action_records: 0,
        future_live_gates_passed_local_only: 0,
        required_pre_live_gates_passed_local_only: 3,
        required_pre_live_gates_blocked: 0,
        blocked_before_future_live_execution: 3,
        dry_run_records_created: 3,
        dry_run_records_persisted: 3,
        idempotent_records_reused: 0,
        approval_decision_audit_records_received: 3,
        source_readiness_blocked_records: 0,
        kill_switch_blocked_records: 0,
        validateOnly_validation_id_references_requested: 0,
        validateOnly_evidence_records_loaded: 0,
        validateOnly_evidence_records_persisted: 3,
        validateOnly_evidence_records_reused: 0,
        policy_decision_id_references_requested: 0,
        policy_decision_records_loaded: 0,
        policy_decision_records_persisted: 3,
        policy_decision_records_reused: 0,
        executable_now: 0,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "future_executor_not_implemented",
      }),
    );
    expect(response.blockerCoverage).toEqual(
      expect.objectContaining({
        required_gate_families: expect.arrayContaining(["live_path"]),
        blocked_gate_families: ["live_path"],
        missing_required_gate_family_evidence: [],
        scale_candidate_blocker_families: ["live_path"],
        scale_candidate_blocked_by_all_gate_families: false,
        required_pre_live_gates_passed_records: 3,
        required_pre_live_gates_blocked_records: 0,
        validateOnly_missing_or_blocked_records: 0,
        validateOnly_passed_records: 3,
        approval_missing_or_blocked_records: 0,
        approval_audit_missing_or_blocked_records: 0,
        source_readiness_blocked_records: 0,
        finance_policy_blocked_records: 0,
        kill_switch_blocked_records: 0,
        idempotency_blocked_records: 0,
        campaignBudgetId_blocked_records: 0,
        production_flag_blocked_records: 0,
        live_path_blocked_records: 3,
        pause_safety_records_visible: 2,
        monitor_only_safety_records_visible: 0,
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
    );
    expect(response.executionReadinessContract).toEqual(
      expect.objectContaining({
        schemaVersion:
          "ads_automation_execution_preflight_readiness_contract.v1",
        supported_mvp_actions: [
          "update_campaign_budget",
          "pause_campaign",
          "pause_ad_group",
          "monitor_only",
        ],
        must_have_before_future_live_execution: expect.arrayContaining([
          "approved_action_present",
          "approval_decision_audit_persisted",
          "source_readiness_safe",
          "validateOnly_status_passed",
          "finance_policy_allowed",
          "kill_switch_off",
          "safe_idempotency_key",
          "campaignBudgetId_present_for_update_campaign_budget",
          "preflight_dry_run_record_persisted",
          "GOOGLE_ADS_PRODUCTION_ENABLED_true",
          "live_executor_path_implemented_later",
        ]),
        action_type_coverage: expect.arrayContaining([
          expect.objectContaining({
            action_type: "update_campaign_budget",
            mvp_action_scope: "provider_validateOnly_required",
            preflight_treatment: "eligible_for_future_provider_preflight",
            provider_validateOnly_required_before_future_execution: true,
            monitor_only_safety_action: false,
            records_checked: 1,
            records_blocked: 1,
            required_pre_live_gates_passed_records: 1,
            required_pre_live_gates_blocked_records: 0,
            validateOnly_passed_records: 1,
            production_flag_blocked_records: 0,
            live_path_blocked_records: 1,
            scale_candidate: true,
            safety_action: false,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "pause_campaign",
            mvp_action_scope: "provider_validateOnly_required",
            preflight_treatment: "eligible_for_future_provider_preflight",
            provider_validateOnly_required_before_future_execution: true,
            monitor_only_safety_action: false,
            records_checked: 1,
            records_blocked: 1,
            required_pre_live_gates_passed_records: 1,
            validateOnly_passed_records: 1,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "pause_ad_group",
            mvp_action_scope: "provider_validateOnly_required",
            preflight_treatment: "eligible_for_future_provider_preflight",
            provider_validateOnly_required_before_future_execution: true,
            monitor_only_safety_action: false,
            records_checked: 1,
            records_blocked: 1,
            required_pre_live_gates_passed_records: 1,
            validateOnly_passed_records: 1,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "monitor_only",
            mvp_action_scope: "monitor_only_safety_action",
            preflight_treatment: "visible_non_executable_safety_action",
            provider_validateOnly_required_before_future_execution: false,
            monitor_only_safety_action: true,
            records_checked: 0,
            records_blocked: 0,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
        ]),
        gate_coverage: expect.objectContaining({
          records_checked: 3,
          blocked_gate_families: ["live_path"],
          scale_candidate_blocker_families: ["live_path"],
          scale_candidate_blocked_by_all_gate_families: false,
          required_pre_live_gates_passed_records: 3,
          required_pre_live_gates_blocked_records: 0,
          validateOnly_missing_or_blocked_records: 0,
          validateOnly_passed_records: 3,
          approval_missing_or_blocked_records: 0,
          approval_audit_missing_or_blocked_records: 0,
          source_readiness_blocked_records: 0,
          finance_policy_blocked_records: 0,
          kill_switch_blocked_records: 0,
          idempotency_blocked_records: 0,
          campaignBudgetId_blocked_records: 0,
          production_flag_blocked_records: 0,
          live_path_blocked_records: 3,
        }),
        safety_action_visibility: {
          pause_safety_records_visible: 2,
          monitor_only_safety_records_visible: 0,
          safety_action_records_visible: 2,
        },
        non_execution_guarantee: {
          executable_now_actions: 0,
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        },
      }),
    );
    expect(response.gateFamilyEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "live_path",
          status: "blocked",
          records_blocked: 3,
          blocked_approval_ids: approvals
            .map((approval) => approval.approval_id)
            .sort(),
          blocker_keys: ["live_path_not_implemented"],
        }),
      ]),
    );
    expect(response.executionRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "update_campaign_budget",
          preflight_status: "blocked_before_future_live_execution",
          dry_run_record_status: "recorded_local_only",
          validateOnly_validation_id: expect.any(String),
          validateOnly_evidence_persisted: true,
          approval_decision_audit_id: expect.any(String),
          approval_decision_audit_persisted: true,
          source_readiness_safe: true,
          kill_switch_active: false,
          policy_decision_id: expect.any(String),
          policy_decision_evidence_persisted: true,
          preflight_record_persisted: true,
          persistence_used: true,
          durable_storage_used: true,
          erp_local_persistence_used: true,
          future_live_execution_allowed: false,
          execution_allowed_now: false,
          google_ads_production_enabled: true,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          campaignBudgetId_fallback_used: false,
          identifiers: expect.objectContaining({
            campaignId: "1001",
            adGroupId: "2001",
            campaignBudgetId: "3001",
          }),
          execution_gate_closure: expect.objectContaining({
            approval_gate_passed: true,
            approval_decision_audit_gate_passed: true,
            source_readiness_gate_passed: true,
            validateOnly_gate_passed: true,
            finance_policy_gate_passed: true,
            kill_switch_gate_passed: true,
            idempotency_gate_passed: true,
            production_flag_gate_passed: true,
            provider_identifier_gate_passed: true,
            all_required_pre_live_gates_passed: true,
            live_path_gate_passed: false,
            live_path_gate_blocked: true,
            execution_allowed_now: false,
            production_ready: false,
            provider_api_called: false,
            google_ads_api_called: false,
            validateOnly_called: false,
            live_ads_execution_used: false,
            blocked_gate_keys: ["live_path_not_implemented"],
            missing_required_gate_keys: [],
          }),
          gates: expect.arrayContaining([
            expect.objectContaining({
              key: "idempotency_key_safe",
              status: "passed",
            }),
            expect.objectContaining({
              key: "approval_decision_audit_approved",
              status: "passed",
            }),
            expect.objectContaining({
              key: "source_readiness_safe",
              status: "passed",
            }),
            expect.objectContaining({
              key: "kill_switch_off",
              status: "passed",
            }),
            expect.objectContaining({
              key: "live_path_not_implemented",
              status: "blocked",
            }),
          ]),
          blockers: ["live_path_not_implemented"],
          next_required_action: "future_executor_not_implemented",
        }),
        expect.objectContaining({
          action_type: "pause_campaign",
          preflight_status: "blocked_before_future_live_execution",
          identifiers: expect.objectContaining({ campaignId: "1001" }),
          blockers: ["live_path_not_implemented"],
          next_required_action: "future_executor_not_implemented",
        }),
        expect.objectContaining({
          action_type: "pause_ad_group",
          preflight_status: "blocked_before_future_live_execution",
          identifiers: expect.objectContaining({ adGroupId: "2001" }),
          blockers: ["live_path_not_implemented"],
          next_required_action: "future_executor_not_implemented",
        }),
      ]),
    );
    expect(
      response.executionRecords.every(
        (record) => record.future_live_execution_allowed === false,
      ),
    ).toBe(true);
    expect(
      response.executionRecords.every(
        (record) => record.live_path_implemented === false,
      ),
    ).toBe(true);
    expect(
      policyDecisionEvidenceRepository.createManyIdempotent,
    ).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          approval_id: approvals[0].approval_id,
          policy_allowed: true,
          policy_source: "erp_cashflow_ads_policy",
        }),
      ]),
      expect.objectContaining({
        requestId: "REQ-EXEC-PREFLIGHT-LOCAL-DRY-RUN",
        requestedByUserId: "director-1",
        requestedByRole: "director",
      }),
    );
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          approval_id: approvals[0].approval_id,
          validation_id: expect.any(String),
          status: "validate_only_passed",
        }),
      ]),
      expect.objectContaining({
        requestId: "REQ-EXEC-PREFLIGHT-LOCAL-DRY-RUN",
        requestedByUserId: "director-1",
        requestedByRole: "director",
      }),
    );
    expect(preflightRepository.createManyIdempotent).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "update_campaign_budget",
          idempotency_key:
            "ads-execution-preflight:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget:REQ-EXEC-PREFLIGHT-LOCAL-DRY-RUN",
        }),
      ]),
    );
  });

  it("records dry-run evidence but blocks future live execution when production execution is disabled by default", async () => {
    const approval = approvedRecord("pause_campaign");
    approvalRepository.findByApprovalIds.mockResolvedValue([approval]);

    const response = await service.build({
      approvalIds: [approval.approval_id],
      validationPlans: [validationPlan(approval)],
      approvalDecisionAuditRecords: [approvalAuditRecord(approval)],
      policyDecisions: [
        {
          approval_id: approval.approval_id,
          policy_allowed: true,
          policy_source: "erp_ads_loss_policy",
          blockers: [],
        },
      ],
      requestId: "REQ-PRODUCTION-FLAG-CLOSED",
    });

    expect(response.summary).toEqual(
      expect.objectContaining({
        records_created: 1,
        future_live_gates_passed_local_only: 0,
        required_pre_live_gates_passed_local_only: 0,
        required_pre_live_gates_blocked: 1,
        blocked_before_future_live_execution: 1,
        dry_run_records_created: 1,
        dry_run_records_persisted: 1,
        executable_now: 0,
      }),
    );
    expect(response.executionRecords[0]).toEqual(
      expect.objectContaining({
        preflight_status: "blocked_before_future_live_execution",
        dry_run_record_status: "recorded_local_only",
        policy_decision_id: expect.any(String),
        policy_decision_evidence_persisted: true,
        preflight_record_persisted: true,
        persistence_used: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        google_ads_production_enabled: false,
        execution_gate_closure: expect.objectContaining({
          production_flag_gate_passed: false,
          all_required_pre_live_gates_passed: false,
          blocked_gate_keys: expect.arrayContaining([
            "GOOGLE_ADS_PRODUCTION_ENABLED",
            "live_path_not_implemented",
          ]),
          execution_allowed_now: false,
          production_ready: false,
        }),
        blockers: expect.arrayContaining([
          "GOOGLE_ADS_PRODUCTION_ENABLED",
          "live_path_not_implemented",
        ]),
      }),
    );
  });

  it("blocks a scale candidate by every execution gate while keeping pause and monitor-only safety actions visible", async () => {
    const blockedScale = approvedRecord("update_campaign_budget", {
      action_family: "internal_task",
      provider: "erp_internal",
      status: "pending_approval",
      idempotency_key: "ads draft unsafe whitespace",
      typedPayload: {
        customerId: "1234567890",
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
        dailyBudget: 1200000,
      },
      sourceSyncDecisionEvidence: sourceSyncDecisionEvidence([
        {
          freshnessStatus: "stale",
          blockingReason: "google_ads_not_ready_for_ads_automation_decision",
          blockingReasons: [
            "freshness_stale",
            "google_ads_not_ready_for_ads_automation_decision",
          ],
          canUseForAdsAutomationDecision: false,
        },
      ]),
      sourceSyncDecisionGates: sourceSyncDecisionGates({
        canRecommendAdsScale: false,
        canGenerateActionDraft: false,
        canUseGoogleAdsDataClaim: false,
      }),
    });
    const pauseSafety = approvedRecord("pause_campaign");
    const monitorSafety = monitorOnlyRecord();
    approvalRepository.findByApprovalIds.mockResolvedValue([
      blockedScale,
      pauseSafety,
      monitorSafety,
    ]);

    const response = await service.build({
      approvalIds: [
        blockedScale.approval_id,
        pauseSafety.approval_id,
        monitorSafety.approval_id,
      ],
      validationPlans: [validationPlan(pauseSafety)],
      approvalDecisionAuditRecords: [
        approvalAuditRecord(pauseSafety),
        approvalAuditRecord(monitorSafety),
      ],
      policyDecisions: [
        {
          approval_id: pauseSafety.approval_id,
          policy_allowed: true,
          policy_source: "erp_ads_loss_policy",
          blockers: [],
        },
        {
          approval_id: monitorSafety.approval_id,
          policy_allowed: true,
          policy_source: "erp_ads_loss_policy",
          blockers: [],
        },
      ],
      killSwitchActive: true,
      killSwitchReason: "director_emergency_stop_active",
      requestId: "REQ-BLOCKED-SCALE-WITH-PAUSE-SAFETY",
    });

    expect(response.summary).toEqual(
      expect.objectContaining({
        records_created: 3,
        supported_action_records: 3,
        unsupported_action_records: 0,
        future_live_gates_passed_local_only: 0,
        required_pre_live_gates_passed_local_only: 0,
        required_pre_live_gates_blocked: 3,
        blocked_before_future_live_execution: 3,
        approval_decision_audit_records_received: 2,
        source_readiness_blocked_records: 1,
        kill_switch_blocked_records: 3,
        safety_action_records_visible: 2,
        pause_safety_records_visible: 1,
        monitor_only_safety_records_visible: 1,
        gate_families_checked: 11,
        gate_families_blocked: 11,
        executable_now: 0,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.safety).toEqual(
      expect.objectContaining({
        monitor_only_visible_as_non_executable_safety_action: true,
        supported_mvp_actions_limited_to_update_budget_pause_campaign_pause_ad_group_monitor_only: true,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.blockerCoverage).toEqual(
      expect.objectContaining({
        required_gate_families: expect.arrayContaining([
          "future_execution_action_scope",
          "approval_status",
          "approval_decision_audit",
          "source_readiness",
          "validateOnly",
          "finance_policy",
          "kill_switch",
          "idempotency",
          "production_flag",
          "provider_identifiers",
          "live_path",
        ]),
        blocked_gate_families: expect.arrayContaining([
          "future_execution_action_scope",
          "approval_status",
          "approval_decision_audit",
          "source_readiness",
          "validateOnly",
          "finance_policy",
          "kill_switch",
          "idempotency",
          "production_flag",
          "provider_identifiers",
          "live_path",
        ]),
        scale_candidate_blocker_families: expect.arrayContaining([
          "future_execution_action_scope",
          "approval_status",
          "approval_decision_audit",
          "source_readiness",
          "validateOnly",
          "finance_policy",
          "kill_switch",
          "idempotency",
          "production_flag",
          "provider_identifiers",
          "live_path",
        ]),
        missing_required_gate_family_evidence: [],
        scale_candidate_blocked_by_all_gate_families: true,
        required_pre_live_gates_passed_records: 0,
        required_pre_live_gates_blocked_records: 3,
        validateOnly_missing_or_blocked_records: 2,
        validateOnly_passed_records: 1,
        approval_missing_or_blocked_records: 1,
        approval_audit_missing_or_blocked_records: 1,
        source_readiness_blocked_records: 1,
        finance_policy_blocked_records: 1,
        kill_switch_blocked_records: 3,
        idempotency_blocked_records: 1,
        campaignBudgetId_blocked_records: 1,
        production_flag_blocked_records: 3,
        live_path_blocked_records: 3,
        pause_safety_records_visible: 1,
        monitor_only_safety_records_visible: 1,
        safety_action_records_visible: 2,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.executionReadinessContract).toEqual(
      expect.objectContaining({
        required_gate_families: expect.arrayContaining([
          "future_execution_action_scope",
          "approval_status",
          "approval_decision_audit",
          "source_readiness",
          "validateOnly",
          "finance_policy",
          "kill_switch",
          "idempotency",
          "production_flag",
          "provider_identifiers",
          "live_path",
        ]),
        must_have_before_future_live_execution: expect.arrayContaining([
          "approved_action_present",
          "approval_decision_audit_persisted",
          "source_readiness_safe",
          "validateOnly_status_passed",
          "finance_policy_allowed",
          "kill_switch_off",
          "safe_idempotency_key",
          "campaignBudgetId_present_for_update_campaign_budget",
          "preflight_dry_run_record_persisted",
          "GOOGLE_ADS_PRODUCTION_ENABLED_true",
          "live_executor_path_implemented_later",
        ]),
        action_type_coverage: expect.arrayContaining([
          expect.objectContaining({
            action_type: "update_campaign_budget",
            mvp_action_scope: "provider_validateOnly_required",
            preflight_treatment: "eligible_for_future_provider_preflight",
            provider_validateOnly_required_before_future_execution: true,
            monitor_only_safety_action: false,
            records_checked: 1,
            records_blocked: 1,
            validateOnly_missing_or_blocked_records: 1,
            approval_missing_or_blocked_records: 1,
            approval_audit_missing_or_blocked_records: 1,
            source_readiness_blocked_records: 1,
            finance_policy_blocked_records: 1,
            kill_switch_blocked_records: 1,
            idempotency_blocked_records: 1,
            campaignBudgetId_blocked_records: 1,
            production_flag_blocked_records: 1,
            live_path_blocked_records: 1,
            scale_candidate: true,
            safety_action: false,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "pause_campaign",
            mvp_action_scope: "provider_validateOnly_required",
            preflight_treatment: "eligible_for_future_provider_preflight",
            provider_validateOnly_required_before_future_execution: true,
            monitor_only_safety_action: false,
            records_checked: 1,
            records_blocked: 1,
            validateOnly_passed_records: 1,
            kill_switch_blocked_records: 1,
            production_flag_blocked_records: 1,
            live_path_blocked_records: 1,
            scale_candidate: false,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "pause_ad_group",
            mvp_action_scope: "provider_validateOnly_required",
            preflight_treatment: "eligible_for_future_provider_preflight",
            provider_validateOnly_required_before_future_execution: true,
            monitor_only_safety_action: false,
            records_checked: 0,
            records_blocked: 0,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "monitor_only",
            mvp_action_scope: "monitor_only_safety_action",
            preflight_treatment: "visible_non_executable_safety_action",
            provider_validateOnly_required_before_future_execution: false,
            monitor_only_safety_action: true,
            records_checked: 1,
            records_blocked: 1,
            validateOnly_missing_or_blocked_records: 1,
            kill_switch_blocked_records: 1,
            production_flag_blocked_records: 1,
            live_path_blocked_records: 1,
            scale_candidate: false,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
        ]),
        gate_coverage: expect.objectContaining({
          records_checked: 3,
          blocked_gate_families: expect.arrayContaining([
            "future_execution_action_scope",
            "approval_status",
            "approval_decision_audit",
            "source_readiness",
            "validateOnly",
            "finance_policy",
            "kill_switch",
            "idempotency",
            "production_flag",
            "provider_identifiers",
            "live_path",
          ]),
          scale_candidate_blocker_families: expect.arrayContaining([
            "future_execution_action_scope",
            "approval_status",
            "approval_decision_audit",
            "source_readiness",
            "validateOnly",
            "finance_policy",
            "kill_switch",
            "idempotency",
            "production_flag",
            "provider_identifiers",
            "live_path",
          ]),
          scale_candidate_blocked_by_all_gate_families: true,
          validateOnly_missing_or_blocked_records: 2,
          validateOnly_passed_records: 1,
          approval_missing_or_blocked_records: 1,
          approval_audit_missing_or_blocked_records: 1,
          source_readiness_blocked_records: 1,
          finance_policy_blocked_records: 1,
          kill_switch_blocked_records: 3,
          idempotency_blocked_records: 1,
          campaignBudgetId_blocked_records: 1,
          production_flag_blocked_records: 3,
          live_path_blocked_records: 3,
        }),
        safety_action_visibility: {
          pause_safety_records_visible: 1,
          monitor_only_safety_records_visible: 1,
          safety_action_records_visible: 2,
        },
        non_execution_guarantee: {
          executable_now_actions: 0,
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        },
      }),
    );
    expect(response.gateFamilyEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "approval_status",
          status: "blocked",
          records_blocked: 1,
          blocked_approval_ids: [blockedScale.approval_id],
          blocker_keys: expect.arrayContaining(["approved_action"]),
        }),
        expect.objectContaining({
          key: "approval_decision_audit",
          status: "blocked",
          records_blocked: 1,
          blocked_approval_ids: [blockedScale.approval_id],
          blocker_keys: expect.arrayContaining([
            "approval_decision_audit_missing",
          ]),
        }),
        expect.objectContaining({
          key: "source_readiness",
          status: "blocked",
          records_blocked: 1,
          blocked_approval_ids: [blockedScale.approval_id],
          blocker_keys: expect.arrayContaining([
            "source_readiness.freshness_stale",
          ]),
        }),
        expect.objectContaining({
          key: "validateOnly",
          status: "blocked",
          records_blocked: 2,
          blocked_approval_ids: expect.arrayContaining([
            blockedScale.approval_id,
            monitorSafety.approval_id,
          ]),
          blocker_keys: expect.arrayContaining([
            "validateOnly_plan_found",
            "validateOnly_passed",
          ]),
        }),
        expect.objectContaining({
          key: "finance_policy",
          status: "blocked",
          records_blocked: 1,
          blocked_approval_ids: [blockedScale.approval_id],
          blocker_keys: expect.arrayContaining(["policy_decision_missing"]),
        }),
        expect.objectContaining({
          key: "kill_switch",
          status: "blocked",
          records_blocked: 3,
          blocker_keys: expect.arrayContaining(["kill_switch_active"]),
        }),
        expect.objectContaining({
          key: "idempotency",
          status: "blocked",
          records_blocked: 1,
          blocked_approval_ids: [blockedScale.approval_id],
        }),
        expect.objectContaining({
          key: "production_flag",
          status: "blocked",
          records_blocked: 3,
          blocker_keys: ["GOOGLE_ADS_PRODUCTION_ENABLED"],
        }),
        expect.objectContaining({
          key: "provider_identifiers",
          status: "blocked",
          records_blocked: 1,
          blocked_approval_ids: [blockedScale.approval_id],
          blocker_keys: expect.arrayContaining(["campaignBudgetId"]),
        }),
        expect.objectContaining({
          key: "future_execution_action_scope",
          status: "blocked",
          records_blocked: 2,
          blocked_approval_ids: expect.arrayContaining([
            blockedScale.approval_id,
            monitorSafety.approval_id,
          ]),
          blocker_keys: ["provider_google_ads_action"],
        }),
        expect.objectContaining({
          key: "live_path",
          status: "blocked",
          records_blocked: 3,
          blocker_keys: ["live_path_not_implemented"],
        }),
      ]),
    );

    const scale = response.executionRecords.find(
      (record) => record.approval_id === blockedScale.approval_id,
    )!;
    expect(scale).toEqual(
      expect.objectContaining({
        action_type: "update_campaign_budget",
        approval_status: "pending_approval",
        approval_decision_audit_id: null,
        approval_decision_audit_persisted: false,
        source_readiness_safe: false,
        kill_switch_active: true,
        kill_switch_reason: "director_emergency_stop_active",
        validateOnly_status: "missing",
        policy_allowed: false,
        google_ads_production_enabled: false,
        preflight_status: "blocked_before_future_live_execution",
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        campaignBudgetId_fallback_used: false,
        identifiers: expect.objectContaining({
          campaignId: "1001",
          adGroupId: "2001",
          campaignBudgetId: null,
        }),
        execution_gate_closure: expect.objectContaining({
          approval_gate_passed: false,
          approval_decision_audit_gate_passed: false,
          source_readiness_gate_passed: false,
          validateOnly_gate_passed: false,
          finance_policy_gate_passed: false,
          kill_switch_gate_passed: false,
          idempotency_gate_passed: false,
          production_flag_gate_passed: false,
          provider_identifier_gate_passed: false,
          all_required_pre_live_gates_passed: false,
          live_path_gate_passed: false,
          live_path_gate_blocked: true,
          blocked_gate_keys: expect.arrayContaining([
            "approved_action",
            "approval_decision_audit_found",
            "source_readiness_safe",
            "validateOnly_plan_found",
            "policy_allowed",
            "kill_switch_off",
            "idempotency_key_safe",
            "GOOGLE_ADS_PRODUCTION_ENABLED",
            "campaignBudgetId",
            "live_path_not_implemented",
          ]),
          execution_allowed_now: false,
          production_ready: false,
        }),
        blockers: expect.arrayContaining([
          "approved_action",
          "approval_decision_audit_found",
          "approval_decision_audit_missing",
          "source_readiness_safe",
          "source_readiness.source_sync_gate_blocked_action_draft",
          "source_readiness.source_sync_gate_blocked_ads_scale_recommendation",
          "source_readiness.source_sync_gate_blocked_google_ads_data_claim",
          "source_readiness.freshness_stale",
          "validateOnly_plan_found",
          "validateOnly_passed",
          "policy_allowed",
          "policy_decision_missing",
          "kill_switch_off",
          "kill_switch_active",
          "kill_switch.director_emergency_stop_active",
          "idempotency_key_safe",
          "GOOGLE_ADS_PRODUCTION_ENABLED",
          "live_path_not_implemented",
          "campaignBudgetId",
        ]),
        gates: expect.arrayContaining([
          expect.objectContaining({
            key: "approval_decision_audit_found",
            status: "blocked",
          }),
          expect.objectContaining({
            key: "source_readiness_safe",
            status: "blocked",
          }),
          expect.objectContaining({
            key: "validateOnly_plan_found",
            status: "blocked",
          }),
          expect.objectContaining({ key: "policy_allowed", status: "blocked" }),
          expect.objectContaining({
            key: "kill_switch_off",
            status: "blocked",
          }),
          expect.objectContaining({
            key: "campaignBudgetId",
            status: "blocked",
          }),
        ]),
      }),
    );

    const pause = response.executionRecords.find(
      (record) => record.approval_id === pauseSafety.approval_id,
    )!;
    expect(pause).toEqual(
      expect.objectContaining({
        action_type: "pause_campaign",
        approval_decision_audit_persisted: true,
        source_readiness_safe: true,
        validateOnly_status: "validate_only_passed",
        policy_allowed: true,
        preflight_status: "blocked_before_future_live_execution",
        requested_change: expect.objectContaining({ targetStatus: "PAUSED" }),
        identifiers: expect.objectContaining({ campaignId: "1001" }),
        execution_gate_closure: expect.objectContaining({
          approval_gate_passed: true,
          approval_decision_audit_gate_passed: true,
          source_readiness_gate_passed: true,
          validateOnly_gate_passed: true,
          finance_policy_gate_passed: true,
          kill_switch_gate_passed: false,
          idempotency_gate_passed: true,
          production_flag_gate_passed: false,
          provider_identifier_gate_passed: true,
          all_required_pre_live_gates_passed: false,
        }),
        blockers: expect.arrayContaining([
          "GOOGLE_ADS_PRODUCTION_ENABLED",
          "kill_switch_active",
          "live_path_not_implemented",
        ]),
      }),
    );
    expect(pause.blockers).not.toEqual(
      expect.arrayContaining([
        "approval_decision_audit_missing",
        "validateOnly_plan_found",
        "policy_decision_missing",
      ]),
    );

    const monitor = response.executionRecords.find(
      (record) => record.approval_id === monitorSafety.approval_id,
    )!;
    expect(monitor).toEqual(
      expect.objectContaining({
        action_type: "monitor_only",
        action_family: "monitoring",
        provider: "none",
        preflight_status: "blocked_before_future_live_execution",
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        requested_change: expect.objectContaining({
          safetyAction: "monitor_only",
        }),
        execution_gate_closure: expect.objectContaining({
          approval_gate_passed: true,
          approval_decision_audit_gate_passed: true,
          source_readiness_gate_passed: true,
          validateOnly_gate_passed: false,
          finance_policy_gate_passed: true,
          kill_switch_gate_passed: false,
          production_flag_gate_passed: false,
          provider_identifier_gate_passed: true,
          all_required_pre_live_gates_passed: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
        blockers: expect.arrayContaining([
          "provider_google_ads_action",
          "validateOnly_plan_found",
          "validateOnly_passed",
          "GOOGLE_ADS_PRODUCTION_ENABLED",
          "kill_switch_active",
          "live_path_not_implemented",
        ]),
      }),
    );
  });

  it("blocks an otherwise valid future-live preflight when the source idempotency key is unsafe", async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const approval = approvedRecord("pause_campaign", {
      idempotency_key: "ads draft unsafe whitespace",
    });
    approvalRepository.findByApprovalIds.mockResolvedValue([approval]);

    const response = await service.build({
      approvalIds: [approval.approval_id],
      validationPlans: [validationPlan(approval)],
      approvalDecisionAuditRecords: [approvalAuditRecord(approval)],
      policyDecisions: [
        {
          approval_id: approval.approval_id,
          policy_allowed: true,
          policy_source: "erp_ads_loss_policy",
          blockers: [],
        },
      ],
      requestId: "REQ-UNSAFE-IDEMPOTENCY",
    });

    expect(response.summary).toEqual(
      expect.objectContaining({
        records_created: 1,
        future_live_gates_passed_local_only: 0,
        blocked_before_future_live_execution: 1,
        dry_run_records_persisted: 1,
        required_pre_live_gates_passed_local_only: 0,
        required_pre_live_gates_blocked: 1,
        executable_now: 0,
      }),
    );
    expect(response.executionRecords[0]).toEqual(
      expect.objectContaining({
        preflight_status: "blocked_before_future_live_execution",
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        idempotency_key:
          "ads-execution-preflight:ADSAPPROVAL-ads-draft_2026-07-04_pause_campaign:REQ-UNSAFE-IDEMPOTENCY",
        execution_gate_closure: expect.objectContaining({
          idempotency_gate_passed: false,
          all_required_pre_live_gates_passed: false,
          blocked_gate_keys: expect.arrayContaining([
            "idempotency_key_safe",
            "live_path_not_implemented",
          ]),
        }),
        blockers: expect.arrayContaining([
          "idempotency_key_safe",
          "live_path_not_implemented",
        ]),
        gates: expect.arrayContaining([
          expect.objectContaining({
            key: "idempotency_key_safe",
            status: "blocked",
          }),
        ]),
      }),
    );
  });

  it("rejects preflight when a requested approval record is missing", async () => {
    approvalRepository.findByApprovalIds.mockResolvedValue([]);

    await expect(
      service.build({
        approvalIds: ["ADSAPPROVAL-missing-approval"],
        requestId: "REQ-MISSING-APPROVAL",
      }),
    ).rejects.toThrow(
      "approval records not found: ADSAPPROVAL-missing-approval",
    );

    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
    expect(
      policyDecisionEvidenceRepository.createManyIdempotent,
    ).not.toHaveBeenCalled();
  });

  it("loads durable policy evidence by policyDecisionIds without requiring request-body policy decisions", async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const approval = approvedRecord("pause_campaign");
    approvalRepository.findByApprovalIds.mockResolvedValue([approval]);
    const policyRecord = policyEvidenceRecord({
      policy_decision_id: "ADSPOLICY-DURABLE-PAUSE-CAMPAIGN-1001",
      approval_id: approval.approval_id,
      policy_allowed: true,
      policy_source: "erp_cashflow_ads_policy",
      blockers: [],
      evaluatedAt: "2026-07-04T06:15:00.000Z",
    });
    policyEvidenceRecordsById.set(
      policyRecord.policy_decision_id,
      policyRecord,
    );
    policyEvidenceRecordsByIdempotencyKey.set(
      policyRecord.idempotency_key,
      policyRecord,
    );

    const response = await service.build({
      approvalIds: [approval.approval_id],
      validationPlans: [validationPlan(approval)],
      approvalDecisionAuditRecords: [approvalAuditRecord(approval)],
      policyDecisionIds: [policyRecord.policy_decision_id],
      requestId: "REQ-DURABLE-POLICY-ID-PREFLIGHT",
    });

    expect(
      policyDecisionEvidenceRepository.findByPolicyDecisionIds,
    ).toHaveBeenCalledWith([policyRecord.policy_decision_id]);
    expect(
      policyDecisionEvidenceRepository.createManyIdempotent,
    ).toHaveBeenCalledWith([], expect.any(Object));
    expect(response.summary).toEqual(
      expect.objectContaining({
        policy_decision_id_references_requested: 1,
        policy_decision_records_loaded: 1,
        policy_decision_records_persisted: 0,
        policy_decision_records_reused: 0,
        future_live_gates_passed_local_only: 0,
        blocked_before_future_live_execution: 1,
        executable_now: 0,
      }),
    );
    expect(response.executionRecords[0]).toEqual(
      expect.objectContaining({
        approval_id: approval.approval_id,
        validateOnly_validation_id: expect.any(String),
        validateOnly_evidence_persisted: true,
        policy_decision_id: policyRecord.policy_decision_id,
        policy_decision_evidence_persisted: true,
        policy_allowed: true,
        preflight_status: "blocked_before_future_live_execution",
        blockers: ["live_path_not_implemented"],
        next_required_action: "future_executor_not_implemented",
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
  });

  it("loads durable validate-only evidence by validationIds without requiring request-body validationPlans", async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const approval = approvedRecord("pause_ad_group");
    approvalRepository.findByApprovalIds.mockResolvedValue([approval]);
    const validateOnlyRecord = validateOnlyEvidenceRecord(
      validationPlan(approval, {
        validation_id: "ADSPROVIDERVALIDATE-DURABLE-PAUSE-AD-GROUP-2001",
      }),
    );
    validateOnlyEvidenceRecordsById.set(
      validateOnlyRecord.validation_id,
      validateOnlyRecord,
    );
    validateOnlyEvidenceRecordsByIdempotencyKey.set(
      validateOnlyRecord.idempotency_key,
      validateOnlyRecord,
    );

    const response = await service.build({
      approvalIds: [approval.approval_id],
      validationIds: [validateOnlyRecord.validation_id],
      approvalDecisionAuditRecords: [approvalAuditRecord(approval)],
      policyDecisions: [
        {
          approval_id: approval.approval_id,
          policy_allowed: true,
          policy_source: "erp_ads_policy",
          blockers: [],
        },
      ],
      requestId: "REQ-DURABLE-VALIDATE-ONLY-ID-PREFLIGHT",
    });

    expect(
      validateOnlyEvidenceRepository.findByValidationIds,
    ).toHaveBeenCalledWith([validateOnlyRecord.validation_id]);
    expect(
      validateOnlyEvidenceRepository.createManyIdempotent,
    ).toHaveBeenCalledWith([], expect.any(Object));
    expect(response.summary).toEqual(
      expect.objectContaining({
        validateOnly_validation_id_references_requested: 1,
        validateOnly_evidence_records_loaded: 1,
        validateOnly_evidence_records_persisted: 0,
        validateOnly_evidence_records_reused: 0,
        future_live_gates_passed_local_only: 0,
        blocked_before_future_live_execution: 1,
        executable_now: 0,
      }),
    );
    expect(response.executionRecords[0]).toEqual(
      expect.objectContaining({
        approval_id: approval.approval_id,
        validateOnly_validation_id: validateOnlyRecord.validation_id,
        validateOnly_evidence_persisted: true,
        validateOnly_status: "validate_only_passed",
        preflight_status: "blocked_before_future_live_execution",
        blockers: ["live_path_not_implemented"],
        next_required_action: "future_executor_not_implemented",
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
  });

  it("blocks records that are not approved, have no passed validate-only evidence, or lack policy approval", async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const pendingBudget = approvedRecord("update_campaign_budget", {
      status: "pending_approval",
    });
    const validateOnlyPendingCampaign = approvedRecord("pause_campaign");
    const policyBlockedAdGroup = approvedRecord("pause_ad_group");
    approvalRepository.findByApprovalIds.mockResolvedValue([
      pendingBudget,
      validateOnlyPendingCampaign,
      policyBlockedAdGroup,
    ]);

    const response = await service.build({
      approvalIds: [
        pendingBudget.approval_id,
        validateOnlyPendingCampaign.approval_id,
        policyBlockedAdGroup.approval_id,
      ],
      validationPlans: [
        validationPlan(pendingBudget),
        validationPlan(validateOnlyPendingCampaign, {
          status: "validate_only_pending",
          providerValidationStatus: "pending",
          approval_can_be_considered_executable: false,
          next_required_action: "run_future_erp_validateOnly",
        }),
        validationPlan(policyBlockedAdGroup),
      ],
      approvalDecisionAuditRecords: [
        approvalAuditRecord(pendingBudget),
        approvalAuditRecord(validateOnlyPendingCampaign),
        approvalAuditRecord(policyBlockedAdGroup),
      ],
      policyDecisions: [
        {
          approval_id: pendingBudget.approval_id,
          policy_allowed: true,
          blockers: [],
        },
        {
          approval_id: validateOnlyPendingCampaign.approval_id,
          policy_allowed: true,
          blockers: [],
        },
        {
          approval_id: policyBlockedAdGroup.approval_id,
          policy_allowed: false,
          policy_source: "erp_ads_cashflow_policy",
          blockers: ["daily_cap_exceeded"],
        },
      ],
    });

    expect(response.summary.blocked_before_future_live_execution).toBe(3);
    expect(response.executionRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          approval_id: pendingBudget.approval_id,
          blockers: expect.arrayContaining(["approved_action"]),
        }),
        expect.objectContaining({
          approval_id: validateOnlyPendingCampaign.approval_id,
          blockers: expect.arrayContaining(["validateOnly_passed"]),
        }),
        expect.objectContaining({
          approval_id: policyBlockedAdGroup.approval_id,
          blockers: expect.arrayContaining([
            "policy_allowed",
            "policy.daily_cap_exceeded",
          ]),
        }),
      ]),
    );
  });

  it("never falls back to campaignId or adGroupId when campaignBudgetId is missing for budget updates", async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const malformedBudget = approvedRecord("update_campaign_budget", {
      typedPayload: {
        customerId: "1234567890",
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
        dailyBudget: 1200000,
      },
    });
    approvalRepository.findByApprovalIds.mockResolvedValue([malformedBudget]);

    const response = await service.build({
      approvalIds: [malformedBudget.approval_id],
      validationPlans: [
        validationPlan(malformedBudget, {
          campaignBudgetId: null,
          campaignBudgetResourceName: null,
          before_state_snapshot: {
            ...validationPlan(malformedBudget).before_state_snapshot,
            campaignBudgetId: null,
            campaignBudgetResourceName: null,
          },
        }),
      ],
      approvalDecisionAuditRecords: [approvalAuditRecord(malformedBudget)],
      policyDecisions: [
        {
          approval_id: malformedBudget.approval_id,
          policy_allowed: true,
          blockers: [],
        },
      ],
    });

    const record = response.executionRecords[0];
    expect(record.preflight_status).toBe(
      "blocked_before_future_live_execution",
    );
    expect(record.identifiers).toEqual(
      expect.objectContaining({
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
      }),
    );
    expect(record.blockers).toEqual(
      expect.arrayContaining(["campaignBudgetId"]),
    );
    expect(record.campaignBudgetId_fallback_used).toBe(false);
    expect(record.identifiers.campaignBudgetId).not.toBe(
      record.identifiers.campaignId,
    );
    expect(record.identifiers.campaignBudgetId).not.toBe(
      record.identifiers.adGroupId,
    );
  });

  it("does not copy campaignBudgetId from validate-only evidence when the approved budget payload omitted it", async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const malformedBudget = approvedRecord("update_campaign_budget", {
      typedPayload: {
        customerId: "1234567890",
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
        dailyBudget: 1200000,
      },
    });
    approvalRepository.findByApprovalIds.mockResolvedValue([malformedBudget]);

    const response = await service.build({
      approvalIds: [malformedBudget.approval_id],
      validationPlans: [
        validationPlan(malformedBudget, {
          campaignBudgetId: "1001",
          campaignBudgetResourceName:
            "customers/1234567890/campaignBudgets/1001",
          requested_change: {
            action_type: "update_campaign_budget",
            customerId: "1234567890",
            campaignId: "1001",
            adGroupId: "2001",
            campaignBudgetId: "1001",
            dailyBudget: 1200000,
          },
          before_state_snapshot: {
            ...validationPlan(malformedBudget).before_state_snapshot,
            campaignBudgetId: "1001",
            campaignBudgetResourceName:
              "customers/1234567890/campaignBudgets/1001",
          },
        }),
      ],
      approvalDecisionAuditRecords: [approvalAuditRecord(malformedBudget)],
      policyDecisions: [
        {
          approval_id: malformedBudget.approval_id,
          policy_allowed: true,
          blockers: [],
        },
      ],
    });

    const record = response.executionRecords[0];
    expect(record.preflight_status).toBe(
      "blocked_before_future_live_execution",
    );
    expect(record.identifiers).toEqual(
      expect.objectContaining({
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
      }),
    );
    expect(record.source_validateOnly_plan?.campaignBudgetId).toBe("1001");
    expect(record.blockers).toEqual(
      expect.arrayContaining(["campaignBudgetId"]),
    );
    expect(record.campaignBudgetId_fallback_used).toBe(false);
  });

  it("reuses the persisted audit record for duplicate requestId submissions", async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const approval = approvedRecord("pause_ad_group");
    approvalRepository.findByApprovalIds.mockResolvedValue([approval]);

    const input = {
      approvalIds: [approval.approval_id],
      validationPlans: [validationPlan(approval)],
      approvalDecisionAuditRecords: [approvalAuditRecord(approval)],
      policyDecisions: [
        {
          approval_id: approval.approval_id,
          policy_allowed: true,
          policy_source: "erp_ads_policy",
          blockers: [],
        },
      ],
      requestId: "REQ-DUPLICATE-PREFLIGHT-IDEMPOTENT",
      requestedByUserId: "director-1",
      requestedByRole: "director",
    };

    const first = await service.build(input);
    const second = await service.build(input);

    expect(preflightRepository.createManyIdempotent).toHaveBeenCalledTimes(2);
    expect(first.summary).toEqual(
      expect.objectContaining({
        future_live_gates_passed_local_only: 0,
        blocked_before_future_live_execution: 1,
        dry_run_records_persisted: 1,
        idempotent_records_reused: 0,
        idempotent_duplicate_records_blocked: 0,
      }),
    );
    expect(second.summary).toEqual(
      expect.objectContaining({
        future_live_gates_passed_local_only: 0,
        blocked_before_future_live_execution: 1,
        dry_run_records_persisted: 1,
        idempotent_records_reused: 1,
        idempotent_duplicate_records_blocked: 1,
        required_pre_live_gates_passed_local_only: 0,
        required_pre_live_gates_blocked: 1,
        policy_decision_records_persisted: 1,
        policy_decision_records_reused: 1,
        provider_api_used: false,
        google_ads_api_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: "fix_preflight_blockers_before_future_execution",
      }),
    );
    expect(second.blockerCoverage).toEqual(
      expect.objectContaining({
        idempotency_blocked_records: 1,
        required_pre_live_gates_passed_records: 0,
        required_pre_live_gates_blocked_records: 1,
        live_path_blocked_records: 1,
        executable_now_actions: 0,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(second.executionRecords[0]).toEqual(
      expect.objectContaining({
        execution_record_id: first.executionRecords[0].execution_record_id,
        idempotency_key: first.executionRecords[0].idempotency_key,
        persistedAt: first.executionRecords[0].persistedAt,
        preflight_status: "blocked_before_future_live_execution",
        preflight_record_persisted: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_gate_closure: expect.objectContaining({
          idempotency_gate_passed: false,
          all_required_pre_live_gates_passed: false,
          blocked_gate_keys: expect.arrayContaining([
            "idempotency_key_safe",
            "live_path_not_implemented",
          ]),
          execution_allowed_now: false,
          production_ready: false,
        }),
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
        next_required_action: "fix_preflight_blockers_before_future_execution",
      }),
    );
    expect(second.gateFamilyEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "idempotency",
          status: "blocked",
          records_blocked: 1,
          blocked_approval_ids: [approval.approval_id],
          blocker_keys: expect.arrayContaining([
            "idempotency_key_safe",
            "idempotency_duplicate_record",
          ]),
        }),
      ]),
    );
  });

  it("fails closed on duplicate or unsafe boundary evidence before creating records", async () => {
    const approval = approvedRecord("pause_campaign");
    approvalRepository.findByApprovalIds.mockResolvedValue([approval]);

    await expect(
      service.build({
        approvalIds: [approval.approval_id],
        validationPlans: [validationPlan(approval), validationPlan(approval)],
        policyDecisions: [
          { approval_id: approval.approval_id, policy_allowed: true },
        ],
      }),
    ).rejects.toThrow("duplicate validation plan approval_id rejected");

    await expect(
      service.build({
        approvalIds: [approval.approval_id],
        validationPlans: [
          validationPlan(approval, {
            provider_boundary_evidence: {
              ...validationPlan(approval).provider_boundary_evidence,
              provider_api_called: true as any,
            },
          }),
        ],
        policyDecisions: [
          { approval_id: approval.approval_id, policy_allowed: true },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
