import type { AdsAutomationApprovalEvidenceIndexResponse } from './ads-automation-approval-evidence-index.contract';
import type { AdsAutomationDecisionDraftApprovalDecisionAuditRecord } from './ads-automation-decision-draft-approval.contract';
import type { AdsAutomationDecisionDraftActionType } from './ads-automation-decision-draft-preview.contract';
import type { AdsAutomationExecutionPreflightDryRunRecord } from './ads-automation-execution-preflight-dry-run.contract';
import type { AdsAutomationLossLimitPolicyResponse } from './ads-automation-loss-limit-policy.contract';
import type {
  AdsAutomationMonitoringTelemetryEvidenceSnapshot,
  AdsAutomationMonitoringIncidentReadinessResponse,
} from './ads-automation-monitoring-incident-readiness.contract';
import type { AdsAutomationPolicyDecisionEvidenceRecord } from './ads-automation-policy-decision-evidence.contract';
import type { AdsAutomationValidateOnlyEvidenceRecord } from './ads-automation-validate-only-evidence.contract';

export type AdsAutomationPolicyDecisionAuditLinkageStatus =
  | 'ready_for_future_executor_local_only'
  | 'blocked';

export type AdsAutomationPolicyDecisionAuditLinkageRecommendation =
  | 'pending_future_executor_local_only'
  | 'monitor_only'
  | 'safety_action_available_local_only'
  | 'blocked_before_future_executor';

export type AdsAutomationPolicyDecisionAuditLinkageRollbackAction =
  | 'restore_campaign_budget'
  | 'restore_campaign_status'
  | 'restore_ad_group_status'
  | 'not_applicable';

export interface AdsAutomationPolicyDecisionAuditLinkageInput {
  approvalId?: string | null;
  reportDate?: string | null;
  approvalEvidenceIndex: AdsAutomationApprovalEvidenceIndexResponse;
  auditRecords?: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[];
  lossLimitPolicy?: AdsAutomationLossLimitPolicyResponse | null;
  monitoringReadiness?: AdsAutomationMonitoringIncidentReadinessResponse | null;
}

export interface AdsAutomationPolicyDecisionAuditLinkageSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  in_memory_only: true;
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
  raw_provider_request_included: false;
  operation_builder_called: false;
  live_path_implemented: false;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  production_ready: false;
  approval_required_for_all_actions: true;
  campaignBudgetId_no_fallback: true;
  policy_decision_id_linkage_required: true;
  pending_action_id_linkage_required: true;
  validateOnly_preflight_linkage_required: true;
  human_approval_audit_required: true;
  rollback_readiness_required: true;
  safe_idempotency_required: true;
  monitoring_health_required_before_increase: true;
  rate_limit_budget_required_before_increase: true;
  active_incident_blocks_increase: true;
  operator_acknowledgement_required_for_blocking_alerts: true;
  durable_telemetry_read_model_required_before_increase: true;
  supported_rollback_actions_limited_to_update_budget_pause_campaign_pause_ad_group: true;
}

export interface AdsAutomationPolicyDecisionAuditLinkageGate {
  key: string;
  status: 'passed' | 'blocked';
  detail: string;
}

export interface AdsAutomationPolicyDecisionAuditLinkagePolicySnapshot {
  policy_decision_id: string | null;
  policy_allowed: boolean;
  policy_source: string | null;
  policy_blockers: string[];
  policy_evaluatedAt: string | null;
  policy_decision_record_persisted: boolean;
  loss_limit_policy_schemaVersion: AdsAutomationLossLimitPolicyResponse['schemaVersion'] | null;
  loss_limit_policy_all_safe_for_increase: boolean | null;
  loss_limit_policy_requested_action_type: string | null;
  loss_limit_policy_allowed_for_requested_action: boolean | null;
  loss_limit_policy_scale_blockers: string[];
  loss_limit_policy_safe_actions_available: string[];
}

export interface AdsAutomationPolicyDecisionAuditLinkageHumanApprovalEvidence {
  approval_id: string;
  approval_status: string | null;
  audit_id: string | null;
  audit_decision: string | null;
  audit_status_change_performed: boolean;
  reviewerUserId: string | null;
  reviewerRole: string | null;
  reason: string | null;
  requestId: string | null;
  human_approval_present: boolean;
}

export interface AdsAutomationPolicyDecisionRollbackReadiness {
  action_type: AdsAutomationDecisionDraftActionType;
  supported_mvp_action: boolean;
  status: 'ready' | 'blocked';
  rollback_plan_id: string | null;
  rollback_action_type: AdsAutomationPolicyDecisionAuditLinkageRollbackAction;
  before_state_snapshot_status: string | null;
  before_state_source: string | null;
  before_state_snapshot_present: boolean;
  rollback_plan_present: boolean;
  required_identifiers: string[];
  missing_identifiers: string[];
  rollback_plan: Record<string, unknown> | null;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  evidence: string[];
  blockers: string[];
}

export interface AdsAutomationPolicyDecisionMonitoringEvidenceSnapshot {
  schemaVersion: AdsAutomationMonitoringIncidentReadinessResponse['schemaVersion'] | null;
  telemetry_schemaVersion: AdsAutomationMonitoringTelemetryEvidenceSnapshot['schemaVersion'] | null;
  durable_telemetry_read_model_used: boolean | null;
  durable_telemetry_fresh: boolean | null;
  durable_telemetry_complete: boolean | null;
  durable_telemetry_trusted: boolean | null;
  durable_telemetry_tied_to_policy_decision: boolean | null;
  telemetry_record_count: number | null;
  telemetry_evidence_record_ids: string[];
  telemetry_decision_binding: AdsAutomationMonitoringTelemetryEvidenceSnapshot['decisionBinding'] | null;
  monitoring_healthy: boolean | null;
  rate_limit_budget_safe: boolean | null;
  spend_rate_safe: boolean | null;
  provider_error_rate_safe: boolean | null;
  import_freshness_safe: boolean | null;
  validateOnly_preflight_alerts_clear: boolean | null;
  active_incident_blocking_count: number | null;
  unacknowledged_blocking_alerts: number | null;
  scale_up_execution_mode: string | null;
  safe_actions_available: string[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  blockers: string[];
}

export interface AdsAutomationPolicyDecisionAuditLinkageRecord {
  audit_correlation_id: string;
  approval_id: string;
  execution_record_id: string;
  pending_action_id: string | null;
  source_decision_id: string | null;
  policy_decision_id: string | null;
  validateOnly_validation_id: string | null;
  audit_id: string | null;
  action_type: AdsAutomationDecisionDraftActionType;
  recommendation: AdsAutomationPolicyDecisionAuditLinkageRecommendation;
  policyEvaluationSnapshot: AdsAutomationPolicyDecisionAuditLinkagePolicySnapshot;
  humanApprovalEvidence: AdsAutomationPolicyDecisionAuditLinkageHumanApprovalEvidence;
  monitoringEvidenceSnapshot: AdsAutomationPolicyDecisionMonitoringEvidenceSnapshot;
  rollbackReadiness: AdsAutomationPolicyDecisionRollbackReadiness;
  gates: AdsAutomationPolicyDecisionAuditLinkageGate[];
  blockers: string[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  future_live_execution_allowed: false;
  campaignBudgetId_fallback_used: false;
  sourceExecutionRecord: AdsAutomationExecutionPreflightDryRunRecord;
  linkedPolicyDecisionEvidence: AdsAutomationPolicyDecisionEvidenceRecord | null;
  linkedValidateOnlyEvidence: AdsAutomationValidateOnlyEvidenceRecord | null;
  linkedAuditRecord: AdsAutomationDecisionDraftApprovalDecisionAuditRecord | null;
}

export interface AdsAutomationPolicyDecisionAuditLinkageSummary {
  status: AdsAutomationPolicyDecisionAuditLinkageStatus;
  approval_id: string;
  reportDate: string | null;
  execution_records_received: number;
  linked_records_ready: number;
  blocked_records: number;
  monitor_only_downgrades: number;
  rollback_ready_records: number;
  rollback_blocked_records: number;
  policy_decision_records_linked: number;
  validateOnly_records_linked: number;
  audit_records_linked: number;
  pending_action_ids_linked: number;
  human_approval_records_linked: number;
  monitoring_ready_records: number;
  monitoring_blocked_records: number;
  active_incident_blocked_records: number;
  safe_reduction_or_pause_actions_available: number;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  future_live_execution_allowed: false;
  production_ready: false;
  next_required_action:
    | 'inspect_policy_decision_audit_linkage'
    | 'resolve_policy_decision_audit_or_rollback_blockers';
}

export interface AdsAutomationPolicyDecisionAuditLinkageResponse {
  schemaVersion: 'ads_automation_policy_decision_audit_linkage.v1';
  generatedAt: string;
  safety: AdsAutomationPolicyDecisionAuditLinkageSafety;
  summary: AdsAutomationPolicyDecisionAuditLinkageSummary;
  linkageRecords: AdsAutomationPolicyDecisionAuditLinkageRecord[];
  blockers: string[];
  markdownPreview: string;
}
