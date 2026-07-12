import type {
  AdsAutomationDecisionDraftActionType,
  AdsAutomationDecisionDraftFamily,
} from "./ads-automation-decision-draft-preview.contract";
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from "./ads-automation-decision-draft-approval.contract";
import type {
  AdsAutomationExecutionPreflightActionType,
  AdsAutomationExecutionPreflightActionTypeCoverage,
  AdsAutomationExecutionPreflightDryRunResponse,
  AdsAutomationExecutionPreflightReadinessContract,
} from "./ads-automation-execution-preflight-dry-run.contract";
import type {
  AdsAutomationProviderValidateOnlyMvpActionContract,
  AdsAutomationProviderValidateOnlyMvpActionContractReview,
  AdsAutomationProviderValidateOnlyLaneResponse,
} from "./ads-automation-provider-validate-only.contract";
import type { AdsAutomationSourceReadinessReviewExportResponse } from "./ads-automation-source-readiness-review-export.contract";
import type { AdsAutomationReadonlyDecisionReadinessAnswers } from "./ads-automation-readonly-platform-import-readiness.contract";
import type { AdsAutomationPlatformEntityCoverageActionBlocker } from "./ads-automation-pending-erp-action.contract";

export type AdsAutomationApprovalPreflightReviewExportMode =
  | "local_payload"
  | "local_demo_fixture";

export type AdsAutomationApprovalPreflightReviewStatus =
  | "blocked_before_future_execution"
  | "ready_for_future_preflight_review"
  | "empty";

export type AdsAutomationApprovalPreflightGateFamilyKey =
  | "source_readiness"
  | "campaignBudgetId"
  | "finance_policy"
  | "validateOnly"
  | "approval"
  | "audit_preflight"
  | "idempotency"
  | "kill_switch"
  | "production_flag";

export type AdsAutomationApprovalPreflightGateStatus =
  | "passed"
  | "blocked"
  | "not_applicable";

export type AdsAutomationApprovalPreflightActionReviewStatus =
  | "blocked"
  | "reviewable_safety_action"
  | "monitor_only_visible"
  | "local_gates_passed_but_live_blocked";

export interface AdsAutomationApprovalPreflightMonitorOnlyActionInput {
  action_id: string;
  action_type: "monitor_only";
  action_family?: "monitoring";
  approval_id?: string | null;
  source_decision_id?: string | null;
  entity_id?: string | null;
  accountId?: string | null;
  productId?: string | null;
  supplierId?: string | null;
  rationale?: string | null;
  blockers?: string[];
  rollback_plan?: string | null;
  idempotency_key?: string | null;
}

export interface AdsAutomationApprovalPreflightReviewExportInput {
  reportDate?: string;
  now?: string | Date;
  exportMode?: AdsAutomationApprovalPreflightReviewExportMode;
  fixtureName?: string | null;
  sourceReadinessReviewExport: AdsAutomationSourceReadinessReviewExportResponse;
  validateOnlyLane: AdsAutomationProviderValidateOnlyLaneResponse;
  pendingApprovals?: AdsAutomationDecisionDraftPendingApprovalRecord[];
  approvalDecisionAuditRecords?: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[];
  executionPreflightDryRun?: AdsAutomationExecutionPreflightDryRunResponse | null;
  monitorOnlyActions?: AdsAutomationApprovalPreflightMonitorOnlyActionInput[];
}

export interface AdsAutomationApprovalPreflightReviewSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
  source_readiness_review_reused: true;
  validateOnly_lane_reused: true;
  approval_queue_read_model_reused: true;
  execution_preflight_evidence_reused: true;
  repository_write_used: false;
  persistence_used: false;
  durable_storage_used: false;
  erp_local_persistence_used: false;
  provider_persistence_used: false;
  provider_api_called: false;
  provider_api_used: false;
  google_ads_api_called: false;
  google_ads_api_used: false;
  validateOnly_called: false;
  validate_only_provider_call_used: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  direct_google_ads_api_call: false;
  provider_mutation_used: false;
  campaignBudgetId_no_fallback: true;
  approval_required_for_all_provider_actions: true;
  future_provider_validateOnly_required_before_execution: true;
  future_live_execution_allowed: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  execution_allowed_now: false;
  production_ready: false;
  erp_only_future_validator_approver_executor: true;
}

export interface AdsAutomationApprovalPreflightGateFamilyReview {
  key: AdsAutomationApprovalPreflightGateFamilyKey;
  status: AdsAutomationApprovalPreflightGateStatus;
  blocked_action_count: number;
  passed_action_count: number;
  blockers: string[];
  evidence_record_ids: string[];
}

export type AdsAutomationApprovalPreflightGateBlockers = Record<
  AdsAutomationApprovalPreflightGateFamilyKey,
  string[]
>;

export type AdsAutomationApprovalPreflightGateStatuses = Record<
  AdsAutomationApprovalPreflightGateFamilyKey,
  AdsAutomationApprovalPreflightGateStatus
>;

export interface AdsAutomationApprovalPreflightActionEvidenceIds {
  approval_id: string | null;
  pending_action_id: string | null;
  validation_id: string | null;
  execution_record_id: string | null;
  approval_decision_audit_id: string | null;
  policy_decision_id: string | null;
}

export interface AdsAutomationApprovalPreflightActionReview {
  action_id: string;
  approval_id: string | null;
  pending_action_id: string | null;
  action_type: AdsAutomationDecisionDraftActionType;
  action_family: AdsAutomationDecisionDraftFamily;
  provider: "google" | "erp_internal" | "none";
  entity_id: string | null;
  accountId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  productId: string | null;
  supplierId: string | null;
  is_scale_candidate: boolean;
  is_safety_action: boolean;
  status: AdsAutomationApprovalPreflightActionReviewStatus;
  gateStatuses: AdsAutomationApprovalPreflightGateStatuses;
  gateBlockers: AdsAutomationApprovalPreflightGateBlockers;
  platform_entity_coverage_action_blockers: AdsAutomationPlatformEntityCoverageActionBlocker[];
  blockers: string[];
  mvp_action_contract: AdsAutomationProviderValidateOnlyMvpActionContract;
  mvp_action_contract_evidence: string[];
  evidenceIds: AdsAutomationApprovalPreflightActionEvidenceIds;
  rollback_plan: string | null;
  idempotency_key: string | null;
  idempotency_safe: boolean;
  idempotency_duplicate: boolean;
  approval_status:
    | AdsAutomationDecisionDraftPendingApprovalRecord["status"]
    | null;
  validateOnly_status: string | null;
  preflight_status: string | null;
  policy_allowed: boolean | null;
  source_readiness_safe: boolean | null;
  kill_switch_active: boolean | null;
  google_ads_production_enabled: boolean | null;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationApprovalPreflightSafetyActionReview {
  pause_or_reduce_actions_visible: number;
  monitor_only_actions_visible: number;
  actions: AdsAutomationApprovalPreflightActionReview[];
}

export interface AdsAutomationApprovalPreflightPlatformEntityCoverageReview {
  campaignMetricRollups: string[];
  adGroupMetricRollups: string[];
  campaignBudgetMetricRollups: string[];
  productMappings: string[];
  productReadiness: string[];
  supplierReadiness: string[];
}

export interface AdsAutomationApprovalPreflightExecutionReadinessContractReview {
  schemaVersion: "ads_automation_execution_readiness_contract_review.v1";
  contract_present: boolean;
  action_type_coverage_present: boolean;
  source_schema_version:
    | AdsAutomationExecutionPreflightReadinessContract["schemaVersion"]
    | null;
  supported_mvp_actions: AdsAutomationExecutionPreflightReadinessContract["supported_mvp_actions"];
  expected_supported_mvp_actions: AdsAutomationExecutionPreflightActionType[];
  supported_mvp_actions_present: boolean;
  supported_mvp_actions_exact_match: boolean;
  missing_supported_mvp_actions: AdsAutomationExecutionPreflightActionType[];
  unsupported_supported_mvp_actions: string[];
  supported_mvp_actions_order_matches_expected: boolean;
  required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  expected_required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  required_gate_families_present: boolean;
  required_gate_families_exact_match: boolean;
  missing_required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  unsupported_required_gate_families: string[];
  required_gate_families_order_matches_expected: boolean;
  must_have_before_future_live_execution: string[];
  expected_must_have_before_future_live_execution: string[];
  must_have_before_future_live_execution_present: boolean;
  must_have_before_future_live_execution_exact_match: boolean;
  missing_must_have_before_future_live_execution: string[];
  unsupported_must_have_before_future_live_execution: string[];
  must_have_before_future_live_execution_order_matches_expected: boolean;
  non_execution_guarantee_present: boolean;
  non_execution_guarantee_exact_match: boolean;
  non_execution_guarantee_defects: string[];
  missing_must_have_items: string[];
  action_type_coverage: AdsAutomationExecutionPreflightActionTypeCoverage[];
  missing_mvp_action_coverage: AdsAutomationExecutionPreflightActionType[];
  records_checked: number;
  blocked_gate_families: number;
  required_pre_live_gates_passed_records: number;
  required_pre_live_gates_blocked_records: number;
  scale_candidate_blocked_by_all_gate_families: boolean;
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
  local_review_defect: boolean;
  local_review_defect_keys: string[];
  review_status:
    | "contract_visible_blocked_before_live"
    | "contract_incomplete_local_review_defect"
    | "contract_missing";
}

export interface AdsAutomationApprovalPreflightReviewSection {
  section_id:
    | "gate_summary"
    | "platform_entity_coverage_gates"
    | "platform_entity_coverage_review"
    | "execution_readiness_contract"
    | "source_decision_answers"
    | "mvp_action_contract"
    | "blocked_scale_candidates"
    | "safety_actions"
    | "audit_idempotency"
    | "closed_execution_flags";
  title: string;
  status: "attention" | "ready_for_review" | "passed" | "empty";
  lines: string[];
  evidence_record_ids: string[];
}

export interface AdsAutomationApprovalPreflightReviewSummary {
  export_status: AdsAutomationApprovalPreflightReviewStatus;
  export_mode: AdsAutomationApprovalPreflightReviewExportMode;
  reportDate: string;
  source_readiness_export_status: AdsAutomationSourceReadinessReviewExportResponse["summary"]["export_status"];
  validateOnly_plans_received: number;
  validateOnly_passed: number;
  validateOnly_pending_or_blocked: number;
  pending_approvals_received: number;
  execution_preflight_records_received: number;
  approval_decision_audit_records_received: number;
  idempotency_duplicate_keys: number;
  action_reviews: number;
  scale_candidates_reviewed: number;
  scale_candidates_blocked: number;
  safety_actions_visible: number;
  monitor_only_actions_visible: number;
  provider_mvp_actions_requiring_validateOnly: number;
  monitor_only_mvp_safety_actions: number;
  out_of_scope_non_provider_actions: number;
  platform_entity_blocker_count: number;
  scale_candidates_blocked_by_platform_entity_coverage: number;
  execution_readiness_contract_present: boolean;
  execution_readiness_action_type_coverage_present: boolean;
  execution_readiness_required_gate_families: number;
  execution_readiness_blocked_gate_families: number;
  execution_readiness_scale_candidate_blocked_by_all_gate_families: boolean;
  execution_readiness_supported_mvp_actions_present: boolean;
  execution_readiness_supported_mvp_actions_exact_match: boolean;
  execution_readiness_missing_supported_mvp_actions: AdsAutomationExecutionPreflightActionType[];
  execution_readiness_unsupported_supported_mvp_actions: string[];
  execution_readiness_supported_mvp_actions_order_matches_expected: boolean;
  execution_readiness_required_gate_families_present: boolean;
  execution_readiness_required_gate_families_exact_match: boolean;
  execution_readiness_missing_required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  execution_readiness_unsupported_required_gate_families: string[];
  execution_readiness_required_gate_families_order_matches_expected: boolean;
  execution_readiness_must_have_before_future_live_execution_present: boolean;
  execution_readiness_must_have_before_future_live_execution_exact_match: boolean;
  execution_readiness_missing_must_have_before_future_live_execution: string[];
  execution_readiness_unsupported_must_have_before_future_live_execution: string[];
  execution_readiness_must_have_before_future_live_execution_order_matches_expected: boolean;
  execution_readiness_non_execution_guarantee_present: boolean;
  execution_readiness_non_execution_guarantee_exact_match: boolean;
  execution_readiness_non_execution_guarantee_defects: string[];
  execution_readiness_missing_mvp_action_coverage: number;
  missing_mvp_action_coverage: AdsAutomationExecutionPreflightActionType[];
  execution_readiness_local_review_defect: boolean;
  gate_families_blocked: number;
  executable_now: 0;
  future_live_execution_allowed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | "inspect_approval_preflight_review_export"
    | "fix_preflight_gate_blockers_before_future_execution"
    | "provide_approval_preflight_evidence";
}

export interface AdsAutomationApprovalPreflightSourceDigest {
  source_readiness_schema_version: AdsAutomationSourceReadinessReviewExportResponse["schemaVersion"];
  validateOnly_lane_schema_version: AdsAutomationProviderValidateOnlyLaneResponse["schemaVersion"];
  execution_preflight_schema_version:
    | AdsAutomationExecutionPreflightDryRunResponse["schemaVersion"]
    | null;
  approval_ids: string[];
  pending_action_ids: string[];
  validateOnly_validation_ids: string[];
  execution_record_ids: string[];
  approval_decision_audit_ids: string[];
  policy_decision_ids: string[];
  duplicate_idempotency_keys: string[];
  campaignBudgetId_no_fallback: true;
  execution_readiness_contract_schema_version:
    | AdsAutomationExecutionPreflightReadinessContract["schemaVersion"]
    | null;
  execution_readiness_supported_mvp_actions: AdsAutomationExecutionPreflightReadinessContract["supported_mvp_actions"];
  execution_readiness_expected_supported_mvp_actions: AdsAutomationExecutionPreflightActionType[];
  execution_readiness_supported_mvp_action_defects: string[];
  execution_readiness_required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  execution_readiness_expected_required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  execution_readiness_required_gate_family_defects: string[];
  execution_readiness_must_have_before_future_live_execution: string[];
  execution_readiness_expected_must_have_before_future_live_execution: string[];
  execution_readiness_must_have_before_future_live_execution_defects: string[];
  execution_readiness_non_execution_guarantee_defects: string[];
  execution_readiness_missing_mvp_action_coverage: AdsAutomationExecutionPreflightActionType[];
  platformEntityCoverageBlockers: string[];
  sourceDecisionAnswerReview: AdsAutomationReadonlyDecisionReadinessAnswers;
}

export interface AdsAutomationApprovalPreflightReviewExportResponse {
  schemaVersion: "ads_automation_approval_preflight_review_export.v1";
  generatedAt: string;
  exportMode: AdsAutomationApprovalPreflightReviewExportMode;
  query: {
    reportDate: string;
    fixture?: string;
  };
  safety: AdsAutomationApprovalPreflightReviewSafety;
  summary: AdsAutomationApprovalPreflightReviewSummary;
  sourceDigest: AdsAutomationApprovalPreflightSourceDigest;
  sourceDecisionAnswerReview: AdsAutomationReadonlyDecisionReadinessAnswers;
  gateFamilyReview: AdsAutomationApprovalPreflightGateFamilyReview[];
  actionReviews: AdsAutomationApprovalPreflightActionReview[];
  safetyActionReview: AdsAutomationApprovalPreflightSafetyActionReview;
  mvpActionContractReview: AdsAutomationProviderValidateOnlyMvpActionContractReview;
  platformEntityCoverageReview: AdsAutomationApprovalPreflightPlatformEntityCoverageReview | null;
  executionReadinessContractReview: AdsAutomationApprovalPreflightExecutionReadinessContractReview;
  renderedSections: AdsAutomationApprovalPreflightReviewSection[];
  markdownPreview: string;
  sourceReadinessReviewExport: AdsAutomationSourceReadinessReviewExportResponse;
  validateOnlyLane: AdsAutomationProviderValidateOnlyLaneResponse;
  executionPreflightDryRun: AdsAutomationExecutionPreflightDryRunResponse | null;
}
