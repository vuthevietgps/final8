import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AdsAutomationDecisionDraftApprovalRepository } from "./ads-automation-decision-draft-approval.repository";
import { AdsAutomationExecutionPreflightDryRunRepository } from "./ads-automation-execution-preflight-dry-run.repository";
import { AdsAutomationPolicyDecisionEvidenceRepository } from "./ads-automation-policy-decision-evidence.repository";
import { AdsAutomationValidateOnlyEvidenceRepository } from "./ads-automation-validate-only-evidence.repository";
import type {
  AdsAutomationPolicyDecisionEvidenceInput,
  AdsAutomationPolicyDecisionEvidenceRecord,
} from "./contracts/ads-automation-policy-decision-evidence.contract";
import type {
  AdsAutomationValidateOnlyEvidenceInput,
  AdsAutomationValidateOnlyEvidenceRecord,
} from "./contracts/ads-automation-validate-only-evidence.contract";
import {
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE,
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES,
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS,
  AdsAutomationExecutionPreflightActionTypeCoverage,
  AdsAutomationExecutionPreflightGateClosure,
  AdsAutomationExecutionIdentifierSnapshot,
  AdsAutomationExecutionPreflightBlockerCoverage,
  AdsAutomationExecutionPolicyDecision,
  AdsAutomationExecutionPreflightDryRunInput,
  AdsAutomationExecutionPreflightDryRunRecord,
  AdsAutomationExecutionPreflightDryRunResponse,
  AdsAutomationExecutionPreflightGate,
  AdsAutomationExecutionPreflightGateFamilyEvidence,
  AdsAutomationExecutionPreflightReadinessContract,
} from "./contracts/ads-automation-execution-preflight-dry-run.contract";
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from "./contracts/ads-automation-decision-draft-approval.contract";
import type { AdsAutomationProviderValidateOnlyActionPlan } from "./contracts/ads-automation-provider-validate-only.contract";

type ValidationPlanLookup = Map<
  string,
  AdsAutomationProviderValidateOnlyActionPlan
>;
type PolicyDecisionLookup = Map<string, AdsAutomationExecutionPolicyDecision>;
type ApprovalDecisionAuditLookup = Map<
  string,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord
>;
type ValidateOnlyEvidenceResolveResult = {
  byApprovalId: ValidationPlanLookup;
  idReferencesRequested: number;
  loaded: number;
  persisted: number;
  reused: number;
};
type PolicyDecisionResolveResult = {
  byApprovalId: PolicyDecisionLookup;
  idReferencesRequested: number;
  loaded: number;
  persisted: number;
  reused: number;
};

const ADS_AUTOMATION_REQUIRED_SOURCE_KEYS = [
  "google_ads",
  "advertising_costs",
  "product_mapping",
  "inventory_profit",
  "supplier_safety",
] as const;

const ADS_AUTOMATION_PREFLIGHT_SAFETY_ACTION_TYPES = [
  "pause_campaign",
  "pause_ad_group",
  "monitor_only",
] as const;

const ADS_AUTOMATION_PREFLIGHT_GATE_FAMILIES: Array<{
  key: AdsAutomationExecutionPreflightGateFamilyEvidence["key"];
  gateKeys: string[];
  blockerKeys: string[];
  blockerPrefixes: string[];
}> = [
  {
    key: "future_execution_action_scope",
    gateKeys: ["supported_action_type", "provider_google_ads_action"],
    blockerKeys: ["supported_action_type", "provider_google_ads_action"],
    blockerPrefixes: [],
  },
  {
    key: "approval_status",
    gateKeys: ["approved_action", "approval_has_no_blockers"],
    blockerKeys: ["approved_action", "approval_has_no_blockers"],
    blockerPrefixes: ["approval."],
  },
  {
    key: "approval_decision_audit",
    gateKeys: [
      "approval_decision_audit_found",
      "approval_decision_audit_approved",
    ],
    blockerKeys: [
      "approval_decision_audit_found",
      "approval_decision_audit_approved",
      "approval_decision_audit_missing",
      "approval_decision_audit_invalid",
    ],
    blockerPrefixes: [],
  },
  {
    key: "source_readiness",
    gateKeys: ["source_readiness_safe"],
    blockerKeys: ["source_readiness_safe"],
    blockerPrefixes: ["source_readiness."],
  },
  {
    key: "validateOnly",
    gateKeys: ["validateOnly_plan_found", "validateOnly_passed"],
    blockerKeys: ["validateOnly_plan_found", "validateOnly_passed"],
    blockerPrefixes: ["validateOnly."],
  },
  {
    key: "finance_policy",
    gateKeys: ["policy_allowed"],
    blockerKeys: ["policy_allowed", "policy_decision_missing"],
    blockerPrefixes: ["policy."],
  },
  {
    key: "kill_switch",
    gateKeys: ["kill_switch_off"],
    blockerKeys: ["kill_switch_off", "kill_switch_active"],
    blockerPrefixes: ["kill_switch."],
  },
  {
    key: "idempotency",
    gateKeys: ["idempotency_key_safe"],
    blockerKeys: ["idempotency_key_safe", "idempotency_duplicate_record"],
    blockerPrefixes: [],
  },
  {
    key: "production_flag",
    gateKeys: ["GOOGLE_ADS_PRODUCTION_ENABLED"],
    blockerKeys: ["GOOGLE_ADS_PRODUCTION_ENABLED"],
    blockerPrefixes: [],
  },
  {
    key: "provider_identifiers",
    gateKeys: [
      "customerId",
      "campaignBudgetId",
      "campaignId",
      "adGroupId",
      "requested_change.dailyBudget",
      "requested_change.targetStatus",
    ],
    blockerKeys: [
      "customerId",
      "campaignBudgetId",
      "campaignId",
      "adGroupId",
      "requested_change.dailyBudget",
      "requested_change.targetStatus",
    ],
    blockerPrefixes: [],
  },
  {
    key: "live_path",
    gateKeys: ["live_path_not_implemented"],
    blockerKeys: ["live_path_not_implemented"],
    blockerPrefixes: [],
  },
];

@Injectable()
export class AdsAutomationExecutionPreflightDryRunService {
  constructor(
    private readonly approvalRepository: AdsAutomationDecisionDraftApprovalRepository,
    private readonly preflightRepository: AdsAutomationExecutionPreflightDryRunRepository,
    private readonly validateOnlyEvidenceRepository: AdsAutomationValidateOnlyEvidenceRepository,
    private readonly policyDecisionEvidenceRepository: AdsAutomationPolicyDecisionEvidenceRepository,
  ) {}

  async build(
    input: AdsAutomationExecutionPreflightDryRunInput = {},
  ): Promise<AdsAutomationExecutionPreflightDryRunResponse> {
    const approvalIds = this.requiredApprovalIds(input.approvalIds);
    const approvals =
      await this.approvalRepository.findByApprovalIds(approvalIds);
    const approvalsById = new Map(
      approvals.map((approval) => [approval.approval_id, approval]),
    );
    const missingApprovalIds = approvalIds.filter(
      (approvalId) => !approvalsById.has(approvalId),
    );
    if (missingApprovalIds.length) {
      throw new NotFoundException(
        `approval records not found: ${missingApprovalIds.join(", ")}`,
      );
    }

    const generatedAt = new Date().toISOString();
    const productionEnabled = this.googleAdsProductionEnabled();
    const requestContext = {
      generatedAt,
      productionEnabled,
      killSwitchActive: input.killSwitchActive === true,
      killSwitchReason: this.text(input.killSwitchReason),
      requestId: this.text(input.requestId),
      requestedByUserId: this.text(input.requestedByUserId),
      requestedByRole: this.text(input.requestedByRole),
    };
    const approvalDecisionAudits = this.approvalDecisionAuditsByApprovalId(
      input.approvalDecisionAuditRecords || [],
    );
    const policyDecisions = await this.resolvePolicyDecisions(
      input,
      approvalIds,
      requestContext,
    );
    const validateOnlyEvidence = await this.resolveValidateOnlyEvidence(
      input,
      approvalIds,
      requestContext,
    );
    const generatedExecutionRecords = approvalIds.map((approvalId) =>
      this.toExecutionRecord(
        approvalsById.get(approvalId)!,
        validateOnlyEvidence.byApprovalId.get(approvalId) || null,
        policyDecisions.byApprovalId.get(approvalId) || null,
        approvalDecisionAudits.get(approvalId) || null,
        requestContext,
      ),
    );
    const persistResult = await this.preflightRepository.createManyIdempotent(
      generatedExecutionRecords.filter((record) =>
        this.isSupportedAction(record.action_type),
      ),
    );
    const persistedRecordsById = new Map(
      persistResult.records.map((record) => [
        record.execution_record_id,
        record,
      ]),
    );
    const reusedExecutionRecordIds = new Set(
      persistResult.reusedExecutionRecordIds || [],
    );
    const reusedIdempotencyKeys = new Set(
      persistResult.reusedIdempotencyKeys || [],
    );
    const executionRecords = generatedExecutionRecords.map((record) => {
      const persistedRecord =
        persistedRecordsById.get(record.execution_record_id) || record;
      const reused =
        reusedExecutionRecordIds.has(persistedRecord.execution_record_id) ||
        reusedIdempotencyKeys.has(persistedRecord.idempotency_key);
      return reused
        ? this.withIdempotencyDuplicateBlocker(persistedRecord)
        : persistedRecord;
    });
    const idempotentDuplicateRecordsBlocked = executionRecords.filter(
      (record) => record.blockers.includes("idempotency_duplicate_record"),
    ).length;
    const blocked = executionRecords.filter(
      (record) =>
        record.preflight_status === "blocked_before_future_live_execution",
    ).length;
    const requiredPreLiveGatesPassed = executionRecords.filter(
      (record) =>
        record.execution_gate_closure?.all_required_pre_live_gates_passed ===
        true,
    ).length;
    const gateFamilyEvidence = this.gateFamilyEvidence(executionRecords);
    const blockerCoverage = this.blockerCoverage(
      executionRecords,
      gateFamilyEvidence,
    );
    const responseNextRequiredAction = this.nextRequiredAction(
      executionRecords.flatMap((record) => record.blockers),
    );
    const safetyActionRecordsVisible = executionRecords.filter((record) =>
      ADS_AUTOMATION_PREFLIGHT_SAFETY_ACTION_TYPES.includes(
        record.action_type as any,
      ),
    ).length;

    return {
      schemaVersion: "ads_automation_execution_preflight_dry_run.v1",
      generatedAt,
      safety: {
        read_only: false,
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
        supported_mvp_actions_limited_to_update_budget_pause_campaign_pause_ad_group_monitor_only: true,
        monitor_only_visible_as_non_executable_safety_action: true,
        campaignBudgetId_no_fallback: true,
        validateOnly_id_linkage_supported: true,
        validateOnly_evidence_persistence_used: true,
        policy_decision_id_linkage_supported: true,
        policy_decision_evidence_persistence_used: true,
      },
      summary: {
        approvals_requested: approvalIds.length,
        approvals_loaded: approvals.length,
        records_created: executionRecords.length,
        supported_action_records: executionRecords.filter((record) =>
          this.isSupportedAction(record.action_type),
        ).length,
        unsupported_action_records: executionRecords.filter(
          (record) => !this.isSupportedAction(record.action_type),
        ).length,
        future_live_gates_passed_local_only: executionRecords.length - blocked,
        required_pre_live_gates_passed_local_only: requiredPreLiveGatesPassed,
        required_pre_live_gates_blocked:
          executionRecords.length - requiredPreLiveGatesPassed,
        blocked_before_future_live_execution: blocked,
        dry_run_records_created: executionRecords.length,
        dry_run_records_persisted: persistResult.records.length,
        idempotent_records_reused: persistResult.reused,
        idempotent_duplicate_records_blocked: idempotentDuplicateRecordsBlocked,
        approval_decision_audit_records_received: approvalDecisionAudits.size,
        source_readiness_blocked_records: executionRecords.filter(
          (record) => !record.source_readiness_safe,
        ).length,
        kill_switch_blocked_records: executionRecords.filter(
          (record) => record.kill_switch_active,
        ).length,
        safety_action_records_visible: safetyActionRecordsVisible,
        pause_safety_records_visible: executionRecords.filter(
          (record) =>
            record.action_type === "pause_campaign" ||
            record.action_type === "pause_ad_group",
        ).length,
        monitor_only_safety_records_visible: executionRecords.filter(
          (record) => record.action_type === "monitor_only",
        ).length,
        gate_families_checked: gateFamilyEvidence.length,
        gate_families_blocked: gateFamilyEvidence.filter(
          (family) => family.status === "blocked",
        ).length,
        validateOnly_validation_id_references_requested:
          validateOnlyEvidence.idReferencesRequested,
        validateOnly_evidence_records_loaded: validateOnlyEvidence.loaded,
        validateOnly_evidence_records_persisted: validateOnlyEvidence.persisted,
        validateOnly_evidence_records_reused: validateOnlyEvidence.reused,
        policy_decision_id_references_requested:
          policyDecisions.idReferencesRequested,
        policy_decision_records_loaded: policyDecisions.loaded,
        policy_decision_records_persisted: policyDecisions.persisted,
        policy_decision_records_reused: policyDecisions.reused,
        executable_now: 0,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: responseNextRequiredAction,
      },
      blockerCoverage,
      executionReadinessContract: this.executionReadinessContract(
        executionRecords,
        blockerCoverage,
      ),
      gateFamilyEvidence,
      executionRecords,
    };
  }

  private toExecutionRecord(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord,
    validationPlan: AdsAutomationProviderValidateOnlyActionPlan | null,
    policyDecision: AdsAutomationExecutionPolicyDecision | null,
    approvalDecisionAudit: AdsAutomationDecisionDraftApprovalDecisionAuditRecord | null,
    context: {
      generatedAt: string;
      productionEnabled: boolean;
      killSwitchActive: boolean;
      killSwitchReason: string | null;
      requestId: string | null;
      requestedByUserId: string | null;
      requestedByRole: string | null;
    },
  ): AdsAutomationExecutionPreflightDryRunRecord {
    const gates: AdsAutomationExecutionPreflightGate[] = [];
    const blockers: string[] = [];
    const addGate = (key: string, valid: boolean, detail: string) => {
      gates.push({ key, status: valid ? "passed" : "blocked", detail });
      if (!valid) blockers.push(key);
    };
    const identifiers = this.identifiers(approval, validationPlan);
    const approvalBlockers = [
      ...this.arrayText(approval.blockers),
      ...this.arrayText(approval.missing_data_blockers),
    ];
    const sourceReadinessBlockers = this.sourceSyncDecisionBlockers(approval);
    const policyBlockers = this.arrayText(policyDecision?.blockers);
    const policyAllowed =
      policyDecision?.policy_allowed === true && !policyBlockers.length;
    const auditValid = this.approvalAuditValid(approval, approvalDecisionAudit);
    const validateOnlyPassed =
      validationPlan?.status === "validate_only_passed" &&
      validationPlan.providerValidationStatus === "provider_validate_passed" &&
      validationPlan.approval_can_be_considered_executable === true;
    const executionRecordId = `ADSEXEC-DRYRUN-${this.safeKey(approval.approval_id)}-${this.safeKey(context.requestId || context.generatedAt)}`;
    const executionIdempotencyKey = [
      "ads-execution-preflight",
      this.safeKey(approval.approval_id),
      this.safeKey(context.requestId || executionRecordId),
    ].join(":");

    addGate(
      "supported_action_type",
      this.isSupportedAction(approval.action_type),
      "Dry-run preflight supports update_campaign_budget, pause_campaign, pause_ad_group, and monitor_only only.",
    );
    addGate(
      "approved_action",
      approval.status === "approved",
      "Local approval record must be approved before any future provider execution can be considered.",
    );
    addGate(
      "approval_decision_audit_found",
      Boolean(approvalDecisionAudit),
      "A persisted approval decision audit record must be linked before any future provider execution can be considered.",
    );
    addGate(
      "approval_decision_audit_approved",
      auditValid,
      "Approval audit evidence must show an approved, status-changing, blocker-free human decision with closed execution flags.",
    );
    addGate(
      "provider_google_ads_action",
      approval.action_family === "provider_google_ads" &&
        approval.provider === "google",
      "Future execution preflight is limited to Google Ads provider records from the ERP approval queue.",
    );
    addGate(
      "approval_has_no_blockers",
      approvalBlockers.length === 0,
      "Approved execution records must not carry unresolved approval blockers.",
    );
    addGate(
      "source_readiness_safe",
      sourceReadinessBlockers.length === 0,
      sourceReadinessBlockers.length
        ? `Imported source readiness still blocks execution: ${sourceReadinessBlockers.join(", ")}.`
        : "Imported source readiness evidence is safe for local preflight.",
    );
    addGate(
      "validateOnly_plan_found",
      Boolean(validationPlan),
      "A matching ERP-owned provider validate-only plan is required.",
    );
    addGate(
      "validateOnly_passed",
      validateOnlyPassed,
      "Future execution requires validate-only passed evidence before any provider mutation is allowed.",
    );
    addGate(
      "policy_allowed",
      policyAllowed,
      "Explicit ERP policy evidence must allow this action.",
    );
    addGate(
      "kill_switch_off",
      !context.killSwitchActive,
      context.killSwitchActive
        ? `ERP ads kill switch is active${context.killSwitchReason ? `: ${context.killSwitchReason}` : ""}.`
        : "ERP ads kill switch is off for this local preflight.",
    );
    addGate(
      "idempotency_key_safe",
      this.safeIdempotencyKey(approval.idempotency_key) &&
        this.safeIdempotencyKey(executionIdempotencyKey),
      "Future execution requires safe ERP source and execution idempotency keys before any provider mutation can be considered.",
    );
    addGate(
      "GOOGLE_ADS_PRODUCTION_ENABLED",
      context.productionEnabled,
      "Future live execution also requires GOOGLE_ADS_PRODUCTION_ENABLED=true.",
    );
    addGate(
      "live_path_not_implemented",
      false,
      "This service records local dry-run preflight evidence only; no repo-local live provider executor is implemented.",
    );

    this.addActionSpecificGates(approval, identifiers, addGate);
    for (const blocker of approvalBlockers)
      blockers.push(`approval.${blocker}`);
    if (!policyDecision) blockers.push("policy_decision_missing");
    for (const blocker of policyBlockers) blockers.push(`policy.${blocker}`);
    if (!approvalDecisionAudit)
      blockers.push("approval_decision_audit_missing");
    if (approvalDecisionAudit && !auditValid)
      blockers.push("approval_decision_audit_invalid");
    for (const blocker of sourceReadinessBlockers)
      blockers.push(`source_readiness.${blocker}`);
    for (const blocker of this.arrayText(validationPlan?.blockers))
      blockers.push(`validateOnly.${blocker}`);
    if (context.killSwitchActive) {
      blockers.push("kill_switch_active");
      if (context.killSwitchReason)
        blockers.push(`kill_switch.${context.killSwitchReason}`);
    }

    const uniqueBlockers = this.unique(blockers);
    const preflightStatus = uniqueBlockers.length
      ? "blocked_before_future_live_execution"
      : "future_live_gates_passed_local_only";
    const executionGateClosure = this.executionGateClosure(gates);

    return {
      execution_record_id: executionRecordId,
      idempotency_key: executionIdempotencyKey,
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
      platform: approval.platform,
      approval_status: approval.status,
      approval_decision_audit_id: approvalDecisionAudit?.audit_id || null,
      approval_decision_audit_persisted:
        approvalDecisionAudit?.audit_record_persisted === true,
      source_readiness_safe: sourceReadinessBlockers.length === 0,
      kill_switch_active: context.killSwitchActive,
      kill_switch_reason: context.killSwitchReason,
      validateOnly_validation_id: validationPlan?.validation_id || null,
      validateOnly_evidence_persisted:
        (validationPlan as any)?.validateOnly_evidence_persisted === true,
      validateOnly_status: validationPlan?.status || "missing",
      policy_decision_id: policyDecision?.policy_decision_id || null,
      policy_decision_evidence_persisted:
        policyDecision?.policy_decision_record_persisted === true,
      policy_allowed: policyAllowed,
      google_ads_production_enabled: context.productionEnabled,
      preflight_status: preflightStatus,
      dry_run_record_status: "recorded_local_only",
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
      campaignBudgetId_fallback_used: false,
      preflight_record_persisted: true,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: "erp_local_mongo",
      requested_change: this.cloneJson(
        validationPlan?.requested_change || approval.typedPayload || {},
      ),
      identifiers,
      gates,
      execution_gate_closure: executionGateClosure,
      blockers: uniqueBlockers,
      next_required_action: this.nextRequiredAction(uniqueBlockers),
      source_pending_approval: this.cloneJson(approval),
      source_validateOnly_plan: validationPlan
        ? this.cloneJson(validationPlan)
        : null,
      policy_decision: policyDecision ? this.cloneJson(policyDecision) : null,
      requestedByUserId: context.requestedByUserId,
      requestedByRole: context.requestedByRole,
      requestId: context.requestId,
      createdAt: context.generatedAt,
      persistedAt: context.generatedAt,
    };
  }

  private addActionSpecificGates(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord,
    identifiers: AdsAutomationExecutionIdentifierSnapshot,
    addGate: (key: string, valid: boolean, detail: string) => void,
  ): void {
    addGate(
      "customerId",
      Boolean(identifiers.customerId),
      "Google Ads customerId is required for any future provider boundary.",
    );

    if (approval.action_type === "update_campaign_budget") {
      addGate(
        "campaignBudgetId",
        Boolean(this.text((approval.typedPayload || {}).campaignBudgetId)),
        "Budget updates require typedPayload.campaignBudgetId from the approved ERP payload; campaignId, adGroupId, and validate-only snapshots must not be used as fallback identifiers.",
      );
      addGate(
        "requested_change.dailyBudget",
        this.positiveNumber((approval.typedPayload || {}).dailyBudget),
        "Budget updates require a positive dailyBudget in the approved ERP payload.",
      );
      return;
    }

    if (approval.action_type === "pause_campaign") {
      addGate(
        "campaignId",
        Boolean(identifiers.campaignId),
        "Pause campaign requires campaignId.",
      );
      addGate(
        "requested_change.targetStatus",
        this.text((approval.typedPayload || {}).targetStatus) === "PAUSED",
        "Pause campaign requires targetStatus PAUSED.",
      );
      return;
    }

    if (approval.action_type === "pause_ad_group") {
      addGate(
        "adGroupId",
        Boolean(identifiers.adGroupId),
        "Pause ad group requires adGroupId.",
      );
      addGate(
        "requested_change.targetStatus",
        this.text((approval.typedPayload || {}).targetStatus) === "PAUSED",
        "Pause ad group requires targetStatus PAUSED.",
      );
    }
  }

  private withIdempotencyDuplicateBlocker(
    record: AdsAutomationExecutionPreflightDryRunRecord,
  ): AdsAutomationExecutionPreflightDryRunRecord {
    const cloned = this.cloneJson(record);
    const gates = Array.isArray(cloned.gates) ? cloned.gates : [];
    const idempotencyGateIndex = gates.findIndex(
      (gate) => gate.key === "idempotency_key_safe",
    );
    const idempotencyGate = {
      key: "idempotency_key_safe",
      status: "blocked" as const,
      detail:
        "A persisted execution preflight dry-run record already exists for this idempotency key; duplicate attempts stay blocked and non-executable.",
    };
    if (idempotencyGateIndex >= 0) {
      gates[idempotencyGateIndex] = idempotencyGate;
    } else {
      gates.push(idempotencyGate);
    }

    return {
      ...cloned,
      preflight_status: "blocked_before_future_live_execution",
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
      campaignBudgetId_fallback_used: false,
      gates,
      execution_gate_closure: this.executionGateClosure(gates),
      blockers: this.unique([
        ...this.arrayText(cloned.blockers),
        "idempotency_key_safe",
        "idempotency_duplicate_record",
      ]),
      next_required_action: "fix_preflight_blockers_before_future_execution",
    };
  }

  private identifiers(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord,
    validationPlan: AdsAutomationProviderValidateOnlyActionPlan | null,
  ): AdsAutomationExecutionIdentifierSnapshot {
    const payload = approval.typedPayload || {};
    const budgetUpdate = approval.action_type === "update_campaign_budget";
    return {
      customerId:
        this.text(payload.customerId) ||
        this.text(validationPlan?.customerId) ||
        this.text(approval.accountId),
      campaignId:
        this.text(payload.campaignId) || this.text(validationPlan?.campaignId),
      adGroupId:
        this.text(payload.adGroupId) || this.text(validationPlan?.adGroupId),
      campaignBudgetId: budgetUpdate
        ? this.text(payload.campaignBudgetId)
        : this.text(payload.campaignBudgetId) ||
          this.text(validationPlan?.campaignBudgetId),
      campaignBudgetResourceName: budgetUpdate
        ? this.text(payload.campaignBudgetResourceName)
        : this.text(payload.campaignBudgetResourceName) ||
          this.text(validationPlan?.campaignBudgetResourceName),
    };
  }

  private requiredApprovalIds(values: unknown): string[] {
    if (!Array.isArray(values) || !values.length) {
      throw new BadRequestException(
        "approvalIds must contain at least one approval id",
      );
    }
    const ids = values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
    if (!ids.length) {
      throw new BadRequestException(
        "approvalIds must contain at least one approval id",
      );
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("approvalIds must be unique");
    }
    return ids;
  }

  private async resolveValidateOnlyEvidence(
    input: AdsAutomationExecutionPreflightDryRunInput,
    approvalIds: string[],
    context: {
      generatedAt: string;
      requestId: string | null;
      requestedByUserId: string | null;
      requestedByRole: string | null;
    },
  ): Promise<ValidateOnlyEvidenceResolveResult> {
    const requestedApprovalIds = new Set(approvalIds);
    const validationIds = this.requestedValidationIds(input.validationIds);
    const durableRecords = validationIds.length
      ? await this.validateOnlyEvidenceRepository.findByValidationIds(
          validationIds,
        )
      : [];
    const durableRecordsById = new Map(
      durableRecords.map((record) => [record.validation_id, record]),
    );
    const missingValidationIds = validationIds.filter(
      (validationId) => !durableRecordsById.has(validationId),
    );
    if (missingValidationIds.length) {
      throw new NotFoundException(
        `validate-only evidence not found: ${missingValidationIds.join(", ")}`,
      );
    }
    this.assertValidateOnlyEvidenceApprovalIds(
      durableRecords,
      requestedApprovalIds,
    );

    const bodyValidationPlans = this.validationPlanInputs(
      input.validationPlans || [],
    );
    this.assertValidateOnlyEvidenceApprovalIds(
      bodyValidationPlans,
      requestedApprovalIds,
    );
    const persistResult =
      await this.validateOnlyEvidenceRepository.createManyIdempotent(
        bodyValidationPlans,
        {
          requestId: context.requestId,
          requestedByUserId: context.requestedByUserId,
          requestedByRole: context.requestedByRole,
          createdAt: context.generatedAt,
        },
      );

    const byApprovalId: ValidationPlanLookup = new Map();
    const validationPlans = [
      ...durableRecords.map((record) => this.toValidationPlan(record)),
      ...persistResult.records.map((record) => this.toValidationPlan(record)),
    ];
    for (const plan of validationPlans) {
      if (byApprovalId.has(plan.approval_id)) {
        throw new BadRequestException(
          `duplicate validation plan approval_id rejected: ${plan.approval_id}`,
        );
      }
      byApprovalId.set(plan.approval_id, plan);
    }

    return {
      byApprovalId,
      idReferencesRequested: validationIds.length,
      loaded: durableRecords.length,
      persisted: persistResult.records.length,
      reused: persistResult.reused,
    };
  }

  private requestedValidationIds(values: unknown): string[] {
    if (values === undefined || values === null) return [];
    if (!Array.isArray(values)) {
      throw new BadRequestException("validationIds must be an array");
    }
    const ids = values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("validationIds must be unique");
    }
    return ids;
  }

  private approvalDecisionAuditsByApprovalId(
    records: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[],
  ): ApprovalDecisionAuditLookup {
    if (!Array.isArray(records)) {
      throw new BadRequestException(
        "approvalDecisionAuditRecords must be an array",
      );
    }

    const byApprovalId: ApprovalDecisionAuditLookup = new Map();
    const seenAuditIds = new Set<string>();
    for (const record of records) {
      if (!record || typeof record !== "object") {
        throw new BadRequestException(
          "approvalDecisionAuditRecords entries must be objects",
        );
      }
      const approvalId = this.requiredText(
        record.approval_id,
        "approvalDecisionAuditRecords.approval_id",
      );
      const auditId = this.requiredText(
        record.audit_id,
        "approvalDecisionAuditRecords.audit_id",
      );
      if (seenAuditIds.has(auditId)) {
        throw new BadRequestException(
          `duplicate approval decision audit_id rejected: ${auditId}`,
        );
      }
      if (byApprovalId.has(approvalId)) {
        throw new BadRequestException(
          `duplicate approval decision audit approval_id rejected: ${approvalId}`,
        );
      }
      seenAuditIds.add(auditId);
      byApprovalId.set(approvalId, record);
    }

    return byApprovalId;
  }

  private approvalAuditValid(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord,
    audit: AdsAutomationDecisionDraftApprovalDecisionAuditRecord | null,
  ): boolean {
    if (!audit) return false;
    return (
      audit.approval_id === approval.approval_id &&
      audit.decision === "approve" &&
      audit.proposed_status === "approved" &&
      audit.status_change_performed === true &&
      audit.audit_record_persisted === true &&
      audit.validation_status === "eligible_for_human_decision" &&
      this.arrayText(audit.blockers).length === 0 &&
      audit.provider_api_called === false &&
      audit.google_ads_api_called === false &&
      audit.validateOnly_called === false &&
      audit.live_ads_execution_used === false &&
      audit.execution_allowed_now === false
    );
  }

  private validationPlanInputs(
    plans: AdsAutomationProviderValidateOnlyActionPlan[],
  ): AdsAutomationValidateOnlyEvidenceInput[] {
    if (!Array.isArray(plans)) {
      throw new BadRequestException("validationPlans must be an array");
    }
    const seenApprovalIds = new Set<string>();
    return plans.map((plan) => {
      if (!plan || typeof plan !== "object") {
        throw new BadRequestException(
          "validationPlans entries must be objects",
        );
      }
      if (
        plan.execution_allowed_now !== false ||
        plan.executable_now !== false ||
        plan.provider_boundary_evidence?.provider_api_called !== false ||
        plan.provider_boundary_evidence?.google_ads_api_called !== false ||
        plan.provider_boundary_evidence?.validateOnly_called !== false ||
        plan.provider_boundary_evidence?.direct_google_ads_api_call !== false ||
        plan.provider_boundary_evidence?.operation_builder_called !== false ||
        plan.provider_boundary_evidence?.raw_provider_request_included !== false
      ) {
        throw new BadRequestException(
          "validationPlans must preserve local dry-run provider boundary safety flags",
        );
      }
      this.requiredText(plan.validation_id, "validationPlans.validation_id");
      const approvalId = this.requiredText(
        plan.approval_id,
        "validationPlans.approval_id",
      );
      if (seenApprovalIds.has(approvalId)) {
        throw new BadRequestException(
          `duplicate validation plan approval_id rejected: ${approvalId}`,
        );
      }
      seenApprovalIds.add(approvalId);
      return plan;
    });
  }

  private assertValidateOnlyEvidenceApprovalIds(
    plans: Array<{ approval_id: string }>,
    approvalIds: Set<string>,
  ): void {
    const outsideRequest = plans
      .map((plan) => this.text(plan.approval_id))
      .filter(
        (approvalId): approvalId is string =>
          Boolean(approvalId) && !approvalIds.has(approvalId),
      );
    if (outsideRequest.length) {
      throw new BadRequestException(
        `validate-only evidence approval_id is not in requested approvalIds: ${this.unique(outsideRequest).join(", ")}`,
      );
    }
  }

  private toValidationPlan(
    record: AdsAutomationValidateOnlyEvidenceRecord,
  ): AdsAutomationProviderValidateOnlyActionPlan {
    return this.cloneJson(
      record,
    ) as AdsAutomationProviderValidateOnlyActionPlan;
  }

  private async resolvePolicyDecisions(
    input: AdsAutomationExecutionPreflightDryRunInput,
    approvalIds: string[],
    context: {
      generatedAt: string;
      requestId: string | null;
      requestedByUserId: string | null;
      requestedByRole: string | null;
    },
  ): Promise<PolicyDecisionResolveResult> {
    const requestedApprovalIds = new Set(approvalIds);
    const policyDecisionIds = this.requestedPolicyDecisionIds(
      input.policyDecisionIds,
    );
    const durableRecords = policyDecisionIds.length
      ? await this.policyDecisionEvidenceRepository.findByPolicyDecisionIds(
          policyDecisionIds,
        )
      : [];
    const durableRecordsById = new Map(
      durableRecords.map((record) => [record.policy_decision_id, record]),
    );
    const missingPolicyDecisionIds = policyDecisionIds.filter(
      (policyDecisionId) => !durableRecordsById.has(policyDecisionId),
    );
    if (missingPolicyDecisionIds.length) {
      throw new NotFoundException(
        `policy decision evidence not found: ${missingPolicyDecisionIds.join(", ")}`,
      );
    }
    this.assertPolicyEvidenceApprovalIds(durableRecords, requestedApprovalIds);

    const bodyPolicyDecisions = this.policyDecisionInputs(
      input.policyDecisions || [],
    );
    this.assertPolicyEvidenceApprovalIds(
      bodyPolicyDecisions,
      requestedApprovalIds,
    );
    const persistResult =
      await this.policyDecisionEvidenceRepository.createManyIdempotent(
        bodyPolicyDecisions,
        {
          requestId: context.requestId,
          requestedByUserId: context.requestedByUserId,
          requestedByRole: context.requestedByRole,
          createdAt: context.generatedAt,
        },
      );

    const byApprovalId: PolicyDecisionLookup = new Map();
    const policyDecisions = [
      ...durableRecords.map((record) => this.toExecutionPolicyDecision(record)),
      ...persistResult.records.map((record) =>
        this.toExecutionPolicyDecision(record),
      ),
    ];
    for (const decision of policyDecisions) {
      if (byApprovalId.has(decision.approval_id)) {
        throw new BadRequestException(
          `duplicate policy decision approval_id rejected: ${decision.approval_id}`,
        );
      }
      byApprovalId.set(decision.approval_id, decision);
    }

    return {
      byApprovalId,
      idReferencesRequested: policyDecisionIds.length,
      loaded: durableRecords.length,
      persisted: persistResult.records.length,
      reused: persistResult.reused,
    };
  }

  private requestedPolicyDecisionIds(values: unknown): string[] {
    if (values === undefined || values === null) return [];
    if (!Array.isArray(values)) {
      throw new BadRequestException("policyDecisionIds must be an array");
    }
    const ids = values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("policyDecisionIds must be unique");
    }
    return ids;
  }

  private policyDecisionInputs(
    decisions: AdsAutomationExecutionPolicyDecision[],
  ): AdsAutomationPolicyDecisionEvidenceInput[] {
    if (!Array.isArray(decisions)) {
      throw new BadRequestException("policyDecisions must be an array");
    }
    const seenApprovalIds = new Set<string>();
    return decisions.map((decision) => {
      if (!decision || typeof decision !== "object") {
        throw new BadRequestException(
          "policyDecisions entries must be objects",
        );
      }
      const approvalId = this.requiredText(
        decision.approval_id,
        "policyDecisions.approval_id",
      );
      if (seenApprovalIds.has(approvalId)) {
        throw new BadRequestException(
          `duplicate policy decision approval_id rejected: ${approvalId}`,
        );
      }
      seenApprovalIds.add(approvalId);
      return {
        policy_decision_id: this.text(decision.policy_decision_id),
        approval_id: approvalId,
        policy_allowed: decision.policy_allowed === true,
        policy_source: this.text(decision.policy_source),
        blockers: this.arrayText(decision.blockers),
        evaluatedAt: this.text(decision.evaluatedAt),
      };
    });
  }

  private assertPolicyEvidenceApprovalIds(
    decisions: Array<{ approval_id: string }>,
    approvalIds: Set<string>,
  ): void {
    const outsideRequest = decisions
      .map((decision) => this.text(decision.approval_id))
      .filter(
        (approvalId): approvalId is string =>
          Boolean(approvalId) && !approvalIds.has(approvalId),
      );
    if (outsideRequest.length) {
      throw new BadRequestException(
        `policy decision evidence approval_id is not in requested approvalIds: ${this.unique(outsideRequest).join(", ")}`,
      );
    }
  }

  private toExecutionPolicyDecision(
    record: AdsAutomationPolicyDecisionEvidenceRecord,
  ): AdsAutomationExecutionPolicyDecision {
    return {
      policy_decision_id: record.policy_decision_id,
      approval_id: record.approval_id,
      policy_allowed: record.policy_allowed === true,
      policy_source: this.text(record.policy_source),
      blockers: this.arrayText(record.blockers),
      evaluatedAt: this.text(record.evaluatedAt),
      policy_decision_record_persisted: true,
      storage: record.storage,
      persistedAt: this.text(record.persistedAt),
    };
  }

  private isSupportedAction(
    value: unknown,
  ): value is (typeof ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS)[number] {
    return ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS.includes(
      value as any,
    );
  }

  private gateFamilyEvidence(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
  ): AdsAutomationExecutionPreflightGateFamilyEvidence[] {
    return ADS_AUTOMATION_PREFLIGHT_GATE_FAMILIES.map((family) => {
      const blockedRecords = records.filter((record) =>
        this.recordBlockedByFamily(record, family),
      );
      return {
        key: family.key,
        status: blockedRecords.length ? "blocked" : "passed",
        records_checked: records.length,
        records_blocked: blockedRecords.length,
        blocked_approval_ids: this.unique(
          blockedRecords.map((record) => record.approval_id),
        ),
        blocker_keys: this.unique(
          blockedRecords.flatMap((record) => [
            ...record.gates
              .filter(
                (gate) =>
                  gate.status === "blocked" &&
                  family.gateKeys.includes(gate.key),
              )
              .map((gate) => gate.key),
            ...record.blockers.filter((blocker) =>
              this.blockerMatchesFamily(blocker, family),
            ),
          ]),
        ),
      };
    });
  }

  private blockerCoverage(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
    gateFamilyEvidence: AdsAutomationExecutionPreflightGateFamilyEvidence[],
  ): AdsAutomationExecutionPreflightBlockerCoverage {
    const byKey = new Map(
      gateFamilyEvidence.map((family) => [family.key, family]),
    );
    const scaleApprovalIds = new Set(
      records
        .filter((record) => record.action_type === "update_campaign_budget")
        .map((record) => record.approval_id),
    );
    const scaleCandidateBlockerFamilies = gateFamilyEvidence
      .filter(
        (family) =>
          family.status === "blocked" &&
          family.blocked_approval_ids.some((approvalId) =>
            scaleApprovalIds.has(approvalId),
          ),
      )
      .map((family) => family.key);

    return {
      required_gate_families: [
        ...ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES,
      ],
      blocked_gate_families: gateFamilyEvidence
        .filter((family) => family.status === "blocked")
        .map((family) => family.key),
      missing_required_gate_family_evidence:
        ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES.filter(
          (key) => !byKey.has(key),
        ),
      scale_candidate_blocker_families: scaleCandidateBlockerFamilies,
      scale_candidate_blocked_by_all_gate_families:
        scaleCandidateBlockerFamilies.length ===
        ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES.length,
      validateOnly_missing_or_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "validateOnly",
      ),
      validateOnly_passed_records: records.filter(
        (record) => record.validateOnly_status === "validate_only_passed",
      ).length,
      required_pre_live_gates_passed_records: records.filter(
        (record) =>
          record.execution_gate_closure?.all_required_pre_live_gates_passed ===
          true,
      ).length,
      required_pre_live_gates_blocked_records: records.filter(
        (record) =>
          record.execution_gate_closure?.all_required_pre_live_gates_passed !==
          true,
      ).length,
      approval_missing_or_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "approval_status",
      ),
      approval_audit_missing_or_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "approval_decision_audit",
      ),
      source_readiness_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "source_readiness",
      ),
      finance_policy_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "finance_policy",
      ),
      kill_switch_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "kill_switch",
      ),
      idempotency_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "idempotency",
      ),
      campaignBudgetId_blocked_records: this.recordsBlockedByGate(
        records,
        "campaignBudgetId",
      ),
      production_flag_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "production_flag",
      ),
      live_path_blocked_records: this.recordsBlockedByFamily(
        byKey,
        "live_path",
      ),
      pause_safety_records_visible: records.filter(
        (record) =>
          record.action_type === "pause_campaign" ||
          record.action_type === "pause_ad_group",
      ).length,
      monitor_only_safety_records_visible: records.filter(
        (record) => record.action_type === "monitor_only",
      ).length,
      safety_action_records_visible: records.filter((record) =>
        ADS_AUTOMATION_PREFLIGHT_SAFETY_ACTION_TYPES.includes(
          record.action_type as any,
        ),
      ).length,
      executable_now_actions: 0,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    };
  }

  private executionReadinessContract(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
    blockerCoverage: AdsAutomationExecutionPreflightBlockerCoverage,
  ): AdsAutomationExecutionPreflightReadinessContract {
    return {
      schemaVersion: "ads_automation_execution_preflight_readiness_contract.v1",
      supported_mvp_actions: [
        ...ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS,
      ],
      required_gate_families: [...blockerCoverage.required_gate_families],
      must_have_before_future_live_execution: [
        ...ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE,
      ],
      action_type_coverage: this.actionTypeCoverage(records),
      gate_coverage: {
        records_checked: records.length,
        blocked_gate_families: [...blockerCoverage.blocked_gate_families],
        scale_candidate_blocker_families: [
          ...blockerCoverage.scale_candidate_blocker_families,
        ],
        scale_candidate_blocked_by_all_gate_families:
          blockerCoverage.scale_candidate_blocked_by_all_gate_families,
        required_pre_live_gates_passed_records:
          blockerCoverage.required_pre_live_gates_passed_records || 0,
        required_pre_live_gates_blocked_records:
          blockerCoverage.required_pre_live_gates_blocked_records || 0,
        validateOnly_missing_or_blocked_records:
          blockerCoverage.validateOnly_missing_or_blocked_records,
        validateOnly_passed_records:
          blockerCoverage.validateOnly_passed_records,
        approval_missing_or_blocked_records:
          blockerCoverage.approval_missing_or_blocked_records,
        approval_audit_missing_or_blocked_records:
          blockerCoverage.approval_audit_missing_or_blocked_records,
        source_readiness_blocked_records:
          blockerCoverage.source_readiness_blocked_records,
        finance_policy_blocked_records:
          blockerCoverage.finance_policy_blocked_records,
        kill_switch_blocked_records:
          blockerCoverage.kill_switch_blocked_records,
        idempotency_blocked_records:
          blockerCoverage.idempotency_blocked_records,
        campaignBudgetId_blocked_records:
          blockerCoverage.campaignBudgetId_blocked_records,
        production_flag_blocked_records:
          blockerCoverage.production_flag_blocked_records,
        live_path_blocked_records: blockerCoverage.live_path_blocked_records,
      },
      safety_action_visibility: {
        pause_safety_records_visible:
          blockerCoverage.pause_safety_records_visible,
        monitor_only_safety_records_visible:
          blockerCoverage.monitor_only_safety_records_visible,
        safety_action_records_visible:
          blockerCoverage.safety_action_records_visible,
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
    };
  }

  private actionTypeCoverage(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
  ): AdsAutomationExecutionPreflightActionTypeCoverage[] {
    return ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS.map(
      (actionType) => {
        const actionRecords = records.filter(
          (record) => record.action_type === actionType,
        );
        const providerValidateOnlyRequired = [
          "update_campaign_budget",
          "pause_campaign",
          "pause_ad_group",
        ].includes(actionType);
        const monitorOnlySafetyAction = actionType === "monitor_only";

        return {
          action_type: actionType,
          mvp_action_scope: providerValidateOnlyRequired
            ? "provider_validateOnly_required"
            : "monitor_only_safety_action",
          preflight_treatment: providerValidateOnlyRequired
            ? "eligible_for_future_provider_preflight"
            : "visible_non_executable_safety_action",
          provider_validateOnly_required_before_future_execution:
            providerValidateOnlyRequired,
          monitor_only_safety_action: monitorOnlySafetyAction,
          records_checked: actionRecords.length,
          records_blocked: actionRecords.filter(
            (record) =>
              record.preflight_status ===
              "blocked_before_future_live_execution",
          ).length,
          required_pre_live_gates_passed_records: actionRecords.filter(
            (record) =>
              record.execution_gate_closure
                ?.all_required_pre_live_gates_passed === true,
          ).length,
          required_pre_live_gates_blocked_records: actionRecords.filter(
            (record) =>
              record.execution_gate_closure
                ?.all_required_pre_live_gates_passed !== true,
          ).length,
          validateOnly_missing_or_blocked_records: actionRecords.filter(
            (record) => record.validateOnly_status !== "validate_only_passed",
          ).length,
          validateOnly_passed_records: actionRecords.filter(
            (record) => record.validateOnly_status === "validate_only_passed",
          ).length,
          approval_missing_or_blocked_records: this.recordsBlockedByAnyGate(
            actionRecords,
            ["approved_action", "approval_has_no_blockers"],
          ),
          approval_audit_missing_or_blocked_records:
            this.recordsBlockedByAnyGate(actionRecords, [
              "approval_decision_audit_found",
              "approval_decision_audit_approved",
              "approval_decision_audit_missing",
              "approval_decision_audit_invalid",
            ]),
          source_readiness_blocked_records: actionRecords.filter(
            (record) => !record.source_readiness_safe,
          ).length,
          finance_policy_blocked_records: actionRecords.filter(
            (record) => !record.policy_allowed,
          ).length,
          kill_switch_blocked_records: actionRecords.filter(
            (record) => record.kill_switch_active,
          ).length,
          idempotency_blocked_records: this.recordsBlockedByAnyGate(
            actionRecords,
            ["idempotency_key_safe", "idempotency_duplicate_record"],
          ),
          campaignBudgetId_blocked_records: this.recordsBlockedByGate(
            actionRecords,
            "campaignBudgetId",
          ),
          production_flag_blocked_records: actionRecords.filter(
            (record) => !record.google_ads_production_enabled,
          ).length,
          live_path_blocked_records: actionRecords.filter(
            (record) => !record.live_path_implemented,
          ).length,
          scale_candidate: actionType === "update_campaign_budget",
          safety_action: ADS_AUTOMATION_PREFLIGHT_SAFETY_ACTION_TYPES.includes(
            actionType as any,
          ),
          executable_now_actions: 0,
          execution_allowed_now: false,
          production_ready: false,
        };
      },
    );
  }

  private recordsBlockedByFamily(
    byKey: Map<
      AdsAutomationExecutionPreflightGateFamilyEvidence["key"],
      AdsAutomationExecutionPreflightGateFamilyEvidence
    >,
    key: AdsAutomationExecutionPreflightGateFamilyEvidence["key"],
  ): number {
    return byKey.get(key)?.records_blocked || 0;
  }

  private recordsBlockedByGate(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
    key: string,
  ): number {
    return records.filter(
      (record) =>
        record.blockers.includes(key) ||
        record.gates.some(
          (gate) => gate.key === key && gate.status === "blocked",
        ),
    ).length;
  }

  private recordsBlockedByAnyGate(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
    keys: string[],
  ): number {
    return records.filter((record) =>
      keys.some(
        (key) =>
          record.blockers.includes(key) ||
          record.gates.some(
            (gate) => gate.key === key && gate.status === "blocked",
          ),
      ),
    ).length;
  }

  private recordBlockedByFamily(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    family: {
      gateKeys: string[];
      blockerKeys: string[];
      blockerPrefixes: string[];
    },
  ): boolean {
    return (
      record.gates.some(
        (gate) =>
          gate.status === "blocked" && family.gateKeys.includes(gate.key),
      ) ||
      record.blockers.some((blocker) =>
        this.blockerMatchesFamily(blocker, family),
      )
    );
  }

  private executionGateClosure(
    gates: AdsAutomationExecutionPreflightGate[],
  ): AdsAutomationExecutionPreflightGateClosure {
    const requiredGateKeys = this.unique(gates.map((gate) => gate.key));
    const passedGateKeys = this.unique(
      gates.filter((gate) => gate.status === "passed").map((gate) => gate.key),
    );
    const blockedGateKeys = this.unique(
      gates.filter((gate) => gate.status === "blocked").map((gate) => gate.key),
    );
    const missingRequiredGateKeys = requiredGateKeys.filter(
      (key) => !passedGateKeys.includes(key) && !blockedGateKeys.includes(key),
    );
    const allRequiredPreLiveGatesPassed =
      blockedGateKeys.filter((key) => key !== "live_path_not_implemented")
        .length === 0 && missingRequiredGateKeys.length === 0;

    return {
      required_gate_keys: requiredGateKeys,
      passed_gate_keys: passedGateKeys,
      blocked_gate_keys: blockedGateKeys,
      missing_required_gate_keys: missingRequiredGateKeys,
      approval_gate_passed: this.gatesPassed(gates, [
        "approved_action",
        "approval_has_no_blockers",
      ]),
      approval_decision_audit_gate_passed: this.gatesPassed(gates, [
        "approval_decision_audit_found",
        "approval_decision_audit_approved",
      ]),
      source_readiness_gate_passed: this.gatesPassed(gates, [
        "source_readiness_safe",
      ]),
      validateOnly_gate_passed: this.gatesPassed(gates, [
        "validateOnly_plan_found",
        "validateOnly_passed",
      ]),
      finance_policy_gate_passed: this.gatesPassed(gates, ["policy_allowed"]),
      kill_switch_gate_passed: this.gatesPassed(gates, ["kill_switch_off"]),
      idempotency_gate_passed: this.gatesPassed(gates, [
        "idempotency_key_safe",
      ]),
      production_flag_gate_passed: this.gatesPassed(gates, [
        "GOOGLE_ADS_PRODUCTION_ENABLED",
      ]),
      provider_identifier_gate_passed: this.providerIdentifierGatePassed(gates),
      all_required_pre_live_gates_passed: allRequiredPreLiveGatesPassed,
      live_path_gate_passed: false,
      live_path_gate_blocked: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      production_ready: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private gatesPassed(
    gates: AdsAutomationExecutionPreflightGate[],
    keys: string[],
  ): boolean {
    return keys.every((key) =>
      gates.some((gate) => gate.key === key && gate.status === "passed"),
    );
  }

  private providerIdentifierGatePassed(
    gates: AdsAutomationExecutionPreflightGate[],
  ): boolean {
    const identifierGateKeys = [
      "customerId",
      "campaignBudgetId",
      "campaignId",
      "adGroupId",
      "requested_change.dailyBudget",
      "requested_change.targetStatus",
    ];
    const relevantIdentifierGates = gates.filter((gate) =>
      identifierGateKeys.includes(gate.key),
    );
    return (
      relevantIdentifierGates.length > 0 &&
      relevantIdentifierGates.every((gate) => gate.status === "passed")
    );
  }

  private blockerMatchesFamily(
    blocker: string,
    family: {
      blockerKeys: string[];
      blockerPrefixes: string[];
    },
  ): boolean {
    return (
      family.blockerKeys.includes(blocker) ||
      family.blockerPrefixes.some((prefix) => blocker.startsWith(prefix))
    );
  }

  private sourceSyncDecisionBlockers(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord,
  ): string[] {
    const blockers: string[] = [];
    if (approval.sourceSyncDecisionGates?.canGenerateActionDraft === false) {
      blockers.push("source_sync_gate_blocked_action_draft");
    }
    if (approval.sourceSyncDecisionGates?.canRecommendAdsScale === false) {
      blockers.push("source_sync_gate_blocked_ads_scale_recommendation");
    }
    if (approval.sourceSyncDecisionGates?.canUseGoogleAdsDataClaim === false) {
      blockers.push("source_sync_gate_blocked_google_ads_data_claim");
    }

    const evidenceBySource = new Map(
      (approval.sourceSyncDecisionEvidence || [])
        .filter((evidence) =>
          ADS_AUTOMATION_REQUIRED_SOURCE_KEYS.includes(
            evidence.sourceKey as any,
          ),
        )
        .map((evidence) => [evidence.sourceKey, evidence]),
    );

    for (const sourceKey of ADS_AUTOMATION_REQUIRED_SOURCE_KEYS) {
      const evidence = evidenceBySource.get(sourceKey);
      if (!evidence) {
        blockers.push(`${sourceKey}_source_coverage_missing`);
        continue;
      }
      if (evidence.canUseForAdsAutomationDecision === true) {
        continue;
      }

      blockers.push(`${sourceKey}_not_ready_for_ads_automation_decision`);
      const blockingReason = this.text(evidence.blockingReason);
      if (blockingReason) blockers.push(blockingReason);
      blockers.push(...this.arrayText(evidence.blockingReasons));
    }

    return this.unique(blockers);
  }

  private googleAdsProductionEnabled(): boolean {
    return (
      String(process.env.GOOGLE_ADS_PRODUCTION_ENABLED || "")
        .trim()
        .toLowerCase() === "true"
    );
  }

  private nextRequiredAction(
    blockers: string[],
  ): AdsAutomationExecutionPreflightDryRunRecord["next_required_action"] {
    if (
      !blockers.length ||
      blockers.every((blocker) => blocker === "live_path_not_implemented")
    ) {
      return "future_executor_not_implemented";
    }
    return "fix_preflight_blockers_before_future_execution";
  }

  private positiveNumber(value: unknown): boolean {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0;
  }

  private arrayText(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private requiredText(value: unknown, field: string): string {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized : null;
  }

  private safeKey(value: unknown): string {
    return String(value || "unknown")
      .replace(/[^a-z0-9_-]/gi, "_")
      .slice(0, 96);
  }

  private safeIdempotencyKey(value: unknown): boolean {
    const text = this.text(value);
    return Boolean(text && text.length <= 240 && /^[a-z0-9._:-]+$/i.test(text));
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
