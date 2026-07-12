import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftApprovalStatus,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from "./ads-automation-decision-draft-approval.contract";
import type { AdsAutomationDecisionDraftActionType } from "./ads-automation-decision-draft-preview.contract";
import type {
  AdsAutomationProviderValidateOnlyActionPlan,
  AdsAutomationProviderValidateOnlyMvpActionScope,
  AdsAutomationProviderValidateOnlyPreflightTreatment,
} from "./ads-automation-provider-validate-only.contract";
import type { AdsAutomationDecisionDraftApprovalStorage } from "./ads-automation-decision-draft-approval.contract";

export const ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS = [
  "update_campaign_budget",
  "pause_campaign",
  "pause_ad_group",
  "monitor_only",
] as const;

export type AdsAutomationExecutionPreflightActionType =
  (typeof ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS)[number];

export type AdsAutomationExecutionPreflightStatus =
  | "future_live_gates_passed_local_only"
  | "blocked_before_future_live_execution";

export type AdsAutomationExecutionDryRunRecordStatus = "recorded_local_only";

export type AdsAutomationExecutionPreflightGateStatus = "passed" | "blocked";

export type AdsAutomationExecutionPreflightNextAction =
  | "future_executor_not_implemented"
  | "fix_preflight_blockers_before_future_execution";

export type AdsAutomationExecutionPreflightGateFamilyKey =
  | "future_execution_action_scope"
  | "approval_status"
  | "approval_decision_audit"
  | "source_readiness"
  | "validateOnly"
  | "finance_policy"
  | "kill_switch"
  | "idempotency"
  | "production_flag"
  | "provider_identifiers"
  | "live_path";

export const ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES = [
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
] as const satisfies readonly AdsAutomationExecutionPreflightGateFamilyKey[];

export const ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE = [
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
] as const;

export interface AdsAutomationExecutionPreflightGateFamilyEvidence {
  key: AdsAutomationExecutionPreflightGateFamilyKey;
  status: AdsAutomationExecutionPreflightGateStatus;
  records_checked: number;
  records_blocked: number;
  blocked_approval_ids: string[];
  blocker_keys: string[];
}

export interface AdsAutomationExecutionPolicyDecision {
  policy_decision_id?: string | null;
  approval_id: string;
  policy_allowed: boolean;
  policy_source?: string | null;
  blockers?: string[];
  evaluatedAt?: string | null;
  policy_decision_record_persisted?: boolean;
  storage?: AdsAutomationDecisionDraftApprovalStorage;
  persistedAt?: string | null;
}

export interface AdsAutomationExecutionPreflightDryRunInput {
  approvalIds?: string[];
  validationIds?: string[];
  validationPlans?: AdsAutomationProviderValidateOnlyActionPlan[];
  policyDecisionIds?: string[];
  policyDecisions?: AdsAutomationExecutionPolicyDecision[];
  approvalDecisionAuditRecords?: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[];
  killSwitchActive?: boolean;
  killSwitchReason?: string | null;
  requestId?: string | null;
  requestedByUserId?: string | null;
  requestedByRole?: string | null;
}

export interface AdsAutomationExecutionPreflightGate {
  key: string;
  status: AdsAutomationExecutionPreflightGateStatus;
  detail: string;
}

export interface AdsAutomationExecutionPreflightGateClosure {
  required_gate_keys: string[];
  passed_gate_keys: string[];
  blocked_gate_keys: string[];
  missing_required_gate_keys: string[];
  approval_gate_passed: boolean;
  approval_decision_audit_gate_passed: boolean;
  source_readiness_gate_passed: boolean;
  validateOnly_gate_passed: boolean;
  finance_policy_gate_passed: boolean;
  kill_switch_gate_passed: boolean;
  idempotency_gate_passed: boolean;
  production_flag_gate_passed: boolean;
  provider_identifier_gate_passed: boolean;
  all_required_pre_live_gates_passed: boolean;
  live_path_gate_passed: false;
  live_path_gate_blocked: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  production_ready: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationExecutionIdentifierSnapshot {
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
}

export interface AdsAutomationExecutionPreflightDryRunRecord {
  execution_record_id: string;
  idempotency_key: string;
  approval_id: string;
  source_draft_id: string;
  source_decision_id: string;
  action_type: AdsAutomationDecisionDraftActionType;
  action_family: AdsAutomationDecisionDraftPendingApprovalRecord["action_family"];
  provider: AdsAutomationDecisionDraftPendingApprovalRecord["provider"];
  resource_type: AdsAutomationDecisionDraftPendingApprovalRecord["resource_type"];
  entity_type: AdsAutomationDecisionDraftPendingApprovalRecord["entity_type"];
  entity_id: string;
  accountId: string | null;
  platform: string | null;
  approval_status: AdsAutomationDecisionDraftApprovalStatus;
  approval_decision_audit_id: string | null;
  approval_decision_audit_persisted: boolean;
  source_readiness_safe: boolean;
  kill_switch_active: boolean;
  kill_switch_reason: string | null;
  validateOnly_validation_id: string | null;
  validateOnly_evidence_persisted: boolean;
  validateOnly_status:
    | AdsAutomationProviderValidateOnlyActionPlan["status"]
    | "missing";
  policy_decision_id: string | null;
  policy_decision_evidence_persisted: boolean;
  policy_allowed: boolean;
  google_ads_production_enabled: boolean;
  preflight_status: AdsAutomationExecutionPreflightStatus;
  dry_run_record_status: AdsAutomationExecutionDryRunRecordStatus;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  direct_google_ads_api_call: false;
  provider_mutation_used: false;
  live_path_implemented: false;
  campaignBudgetId_fallback_used: false;
  preflight_record_persisted: true;
  persistence_used: true;
  durable_storage_used: true;
  erp_local_persistence_used: true;
  provider_persistence_used: false;
  storage: AdsAutomationDecisionDraftApprovalStorage;
  requested_change: Record<string, unknown>;
  identifiers: AdsAutomationExecutionIdentifierSnapshot;
  gates: AdsAutomationExecutionPreflightGate[];
  execution_gate_closure?: AdsAutomationExecutionPreflightGateClosure | null;
  blockers: string[];
  next_required_action: AdsAutomationExecutionPreflightNextAction;
  source_pending_approval: AdsAutomationDecisionDraftPendingApprovalRecord;
  source_validateOnly_plan: AdsAutomationProviderValidateOnlyActionPlan | null;
  policy_decision: AdsAutomationExecutionPolicyDecision | null;
  requestedByUserId: string | null;
  requestedByRole: string | null;
  requestId: string | null;
  createdAt: string;
  persistedAt: string;
}

export interface AdsAutomationExecutionPreflightDryRunSafety {
  read_only: false;
  dry_run: true;
  in_memory_only: false;
  persistence_used: true;
  durable_storage_used: true;
  erp_local_persistence_used: true;
  provider_persistence_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
  approval_required_for_all_records: true;
  execution_allowed_now: false;
  dry_run_execution_records_created: true;
  dry_run_execution_records_persisted: true;
  idempotency_enforced: true;
  live_path_implemented: false;
  provider_mutation_used: false;
  direct_google_ads_api_call: false;
  future_live_execution_requires_validateOnly_passed: true;
  future_live_execution_requires_approved_action: true;
  future_live_execution_requires_approval_decision_audit: true;
  future_live_execution_requires_source_readiness_safe: true;
  future_live_execution_requires_policy_allowed: true;
  future_live_execution_requires_kill_switch_off: true;
  future_live_execution_requires_safe_idempotency_key: true;
  future_live_execution_requires_GOOGLE_ADS_PRODUCTION_ENABLED_true: true;
  supported_mvp_actions_limited_to_update_budget_pause_campaign_pause_ad_group_monitor_only: true;
  monitor_only_visible_as_non_executable_safety_action: true;
  campaignBudgetId_no_fallback: true;
  validateOnly_id_linkage_supported: true;
  validateOnly_evidence_persistence_used: true;
  policy_decision_id_linkage_supported: true;
  policy_decision_evidence_persistence_used: true;
}

export interface AdsAutomationExecutionPreflightDryRunSummary {
  approvals_requested: number;
  approvals_loaded: number;
  records_created: number;
  supported_action_records: number;
  unsupported_action_records: number;
  future_live_gates_passed_local_only: number;
  required_pre_live_gates_passed_local_only?: number;
  required_pre_live_gates_blocked?: number;
  blocked_before_future_live_execution: number;
  dry_run_records_created: number;
  dry_run_records_persisted: number;
  idempotent_records_reused: number;
  idempotent_duplicate_records_blocked: number;
  approval_decision_audit_records_received: number;
  source_readiness_blocked_records: number;
  kill_switch_blocked_records: number;
  safety_action_records_visible: number;
  pause_safety_records_visible: number;
  monitor_only_safety_records_visible: number;
  gate_families_checked: number;
  gate_families_blocked: number;
  validateOnly_validation_id_references_requested: number;
  validateOnly_evidence_records_loaded: number;
  validateOnly_evidence_records_persisted: number;
  validateOnly_evidence_records_reused: number;
  policy_decision_id_references_requested: number;
  policy_decision_records_loaded: number;
  policy_decision_records_persisted: number;
  policy_decision_records_reused: number;
  executable_now: 0;
  provider_api_called: false;
  provider_api_used: false;
  google_ads_api_called: false;
  google_ads_api_used: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action: AdsAutomationExecutionPreflightNextAction;
}

export interface AdsAutomationExecutionPreflightBlockerCoverage {
  required_gate_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  blocked_gate_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  missing_required_gate_family_evidence: AdsAutomationExecutionPreflightGateFamilyKey[];
  scale_candidate_blocker_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  scale_candidate_blocked_by_all_gate_families: boolean;
  required_pre_live_gates_passed_records?: number;
  required_pre_live_gates_blocked_records?: number;
  validateOnly_missing_or_blocked_records: number;
  validateOnly_passed_records: number;
  approval_missing_or_blocked_records: number;
  approval_audit_missing_or_blocked_records: number;
  source_readiness_blocked_records: number;
  finance_policy_blocked_records: number;
  kill_switch_blocked_records: number;
  idempotency_blocked_records: number;
  campaignBudgetId_blocked_records: number;
  production_flag_blocked_records: number;
  live_path_blocked_records: number;
  pause_safety_records_visible: number;
  monitor_only_safety_records_visible: number;
  safety_action_records_visible: number;
  executable_now_actions: 0;
  provider_api_called: false;
  provider_api_used: false;
  google_ads_api_called: false;
  google_ads_api_used: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsAutomationExecutionPreflightActionTypeCoverage {
  action_type: AdsAutomationExecutionPreflightActionType;
  mvp_action_scope?: AdsAutomationProviderValidateOnlyMvpActionScope;
  preflight_treatment?: AdsAutomationProviderValidateOnlyPreflightTreatment;
  provider_validateOnly_required_before_future_execution?: boolean;
  monitor_only_safety_action?: boolean;
  records_checked: number;
  records_blocked: number;
  required_pre_live_gates_passed_records: number;
  required_pre_live_gates_blocked_records: number;
  validateOnly_missing_or_blocked_records: number;
  validateOnly_passed_records: number;
  approval_missing_or_blocked_records: number;
  approval_audit_missing_or_blocked_records: number;
  source_readiness_blocked_records: number;
  finance_policy_blocked_records: number;
  kill_switch_blocked_records: number;
  idempotency_blocked_records: number;
  campaignBudgetId_blocked_records: number;
  production_flag_blocked_records: number;
  live_path_blocked_records: number;
  scale_candidate: boolean;
  safety_action: boolean;
  executable_now_actions: 0;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsAutomationExecutionPreflightReadinessContract {
  schemaVersion: "ads_automation_execution_preflight_readiness_contract.v1";
  supported_mvp_actions: AdsAutomationExecutionPreflightActionType[];
  required_gate_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  must_have_before_future_live_execution: string[];
  action_type_coverage?: AdsAutomationExecutionPreflightActionTypeCoverage[];
  gate_coverage: {
    records_checked: number;
    blocked_gate_families: AdsAutomationExecutionPreflightGateFamilyKey[];
    scale_candidate_blocker_families: AdsAutomationExecutionPreflightGateFamilyKey[];
    scale_candidate_blocked_by_all_gate_families: boolean;
    required_pre_live_gates_passed_records: number;
    required_pre_live_gates_blocked_records: number;
    validateOnly_missing_or_blocked_records: number;
    validateOnly_passed_records: number;
    approval_missing_or_blocked_records: number;
    approval_audit_missing_or_blocked_records: number;
    source_readiness_blocked_records: number;
    finance_policy_blocked_records: number;
    kill_switch_blocked_records: number;
    idempotency_blocked_records: number;
    campaignBudgetId_blocked_records: number;
    production_flag_blocked_records: number;
    live_path_blocked_records: number;
  };
  safety_action_visibility: {
    pause_safety_records_visible: number;
    monitor_only_safety_records_visible: number;
    safety_action_records_visible: number;
  };
  non_execution_guarantee: {
    executable_now_actions: 0;
    provider_api_called: false;
    provider_api_used: false;
    google_ads_api_called: false;
    google_ads_api_used: false;
    validateOnly_called: false;
    live_ads_execution_used: false;
    execution_allowed_now: false;
    production_ready: false;
  };
}

export interface AdsAutomationExecutionPreflightDryRunResponse {
  schemaVersion: "ads_automation_execution_preflight_dry_run.v1";
  generatedAt: string;
  safety: AdsAutomationExecutionPreflightDryRunSafety;
  summary: AdsAutomationExecutionPreflightDryRunSummary;
  blockerCoverage?: AdsAutomationExecutionPreflightBlockerCoverage;
  executionReadinessContract: AdsAutomationExecutionPreflightReadinessContract;
  gateFamilyEvidence: AdsAutomationExecutionPreflightGateFamilyEvidence[];
  executionRecords: AdsAutomationExecutionPreflightDryRunRecord[];
}

export interface AdsAutomationExecutionPreflightDryRunPersistResult {
  records: AdsAutomationExecutionPreflightDryRunRecord[];
  created: number;
  reused: number;
  createdExecutionRecordIds?: string[];
  createdIdempotencyKeys?: string[];
  reusedExecutionRecordIds?: string[];
  reusedIdempotencyKeys?: string[];
}

export interface AdsAutomationExecutionPreflightReadbackSafety {
  read_only: true;
  dry_run: true;
  in_memory_only: false;
  persistence_used: true;
  durable_storage_used: true;
  erp_local_persistence_used: true;
  provider_persistence_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
  approval_required_for_all_records: true;
  execution_allowed_now: false;
  preflight_record_readback: true;
  preflight_persistence_performed: false;
}

export interface AdsAutomationExecutionPreflightReadbackQuery {
  execution_record_id?: string;
  approval_id?: string;
}

export interface AdsAutomationExecutionPreflightReadbackSummary {
  readback_status: "found" | "not_found" | "listed";
  execution_records_matched: number;
  approval_id_filter_applied: boolean;
  approval_required: true;
  execution_allowed_now: false;
  preflight_persistence_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  next_required_action:
    | "inspect_execution_preflight_record"
    | "inspect_approval_execution_preflight_history"
    | "verify_execution_record_id";
}

export interface AdsAutomationExecutionPreflightRecordReadbackResponse {
  schemaVersion: "ads_automation_execution_preflight_dry_run_record_readback.v1";
  generatedAt: string;
  query: AdsAutomationExecutionPreflightReadbackQuery;
  safety: AdsAutomationExecutionPreflightReadbackSafety;
  summary: AdsAutomationExecutionPreflightReadbackSummary;
  executionRecord: AdsAutomationExecutionPreflightDryRunRecord | null;
}

export interface AdsAutomationExecutionPreflightRecordHistoryResponse {
  schemaVersion: "ads_automation_execution_preflight_dry_run_record_history.v1";
  generatedAt: string;
  query: AdsAutomationExecutionPreflightReadbackQuery;
  safety: AdsAutomationExecutionPreflightReadbackSafety;
  summary: AdsAutomationExecutionPreflightReadbackSummary;
  executionRecords: AdsAutomationExecutionPreflightDryRunRecord[];
}
