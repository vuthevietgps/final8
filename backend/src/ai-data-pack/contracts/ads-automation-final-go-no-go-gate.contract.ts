import type {
  AdsAutomationFoundationAcceptanceMatrixResponse,
} from './ads-automation-foundation-acceptance-matrix.contract';
import type {
  AdsAutomationExecutionPreflightDryRunResponse,
  AdsAutomationExecutionPreflightGateFamilyEvidence,
  AdsAutomationExecutionPreflightGateFamilyKey,
} from './ads-automation-execution-preflight-dry-run.contract';

export type AdsAutomationFinalGoNoGoBucketKey =
  | 'ready_for_demo_use'
  | 'blocked_until_real_readonly_import_credentials'
  | 'blocked_until_provider_validateOnly_adapter'
  | 'blocked_until_human_approval_ui'
  | 'blocked_until_small_cap_live_test'
  | 'not_in_mvp';

export type AdsAutomationFinalGoNoGoBucketStatus =
  | 'ready_for_demo_use'
  | 'blocked_before_live'
  | 'not_in_mvp'
  | 'no_go_local_defect';

export interface AdsAutomationFinalGoNoGoGateInput {
  acceptanceMatrixResponse?: AdsAutomationFoundationAcceptanceMatrixResponse;
  executionPreflightResponse?: AdsAutomationExecutionPreflightDryRunResponse;
}

export interface AdsAutomationFinalGoNoGoBucket {
  key: AdsAutomationFinalGoNoGoBucketKey;
  status: AdsAutomationFinalGoNoGoBucketStatus;
  go_no_go: 'GO' | 'NO_GO' | 'NO_GO_LIVE' | 'NO_GO_SCOPE';
  summary: string;
  evidence: string[];
  blockers: string[];
  next_required_action: string;
  production_ready: false;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export type AdsAutomationFinalGoNoGoBuckets = Record<
  AdsAutomationFinalGoNoGoBucketKey,
  AdsAutomationFinalGoNoGoBucket
>;

export interface AdsAutomationFinalGoNoGoExecutionGateEvidence {
  schemaVersion: 'ads_automation_final_go_no_go_execution_gate_evidence.v1';
  evidence_source:
    | 'execution_preflight_response'
    | 'foundation_acceptance_matrix';
  final_live_execution_status: 'blocked_before_future_live_execution';
  required_gate_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  blocked_gate_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  missing_required_gate_family_evidence: AdsAutomationExecutionPreflightGateFamilyKey[];
  gate_family_statuses: AdsAutomationExecutionPreflightGateFamilyEvidence[];
  execution_records_checked: number;
  blocked_execution_records: number;
  execution_ready_now_actions: 0;
  executable_now_actions: 0;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  final_live_blockers: string[];
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
  scale_candidate_blocker_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  pause_safety_records_visible: number;
  monitor_only_safety_records_visible: number;
  safety_action_records_visible: number;
}

export interface AdsAutomationFinalGoNoGoGateResponse {
  schemaVersion: 'ads_automation_final_go_no_go_gate.v1';
  generatedAt: string;
  reportDate: string;
  sourceAcceptanceMatrixSchemaVersion: AdsAutomationFoundationAcceptanceMatrixResponse['schemaVersion'];
  safety: {
    read_only: true;
    dry_run: true;
    local_fixture_only: true;
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
    campaignBudgetId_no_fallback: true;
    approval_required_for_all_actions: true;
    execution_allowed_now: false;
    GOOGLE_ADS_PRODUCTION_ENABLED: false;
    production_ready: false;
    future_live_execution_allowed: false;
  };
  summary: {
    decision:
      | 'GO_LOCAL_DEMO_USE_STOP_CODEX_FOUNDATION_LOOP'
      | 'NO_GO_FIX_LOCAL_FOUNDATION_GAPS';
    bucket_count: 6;
    local_gate_passed: boolean;
    ready_for_demo_use: boolean;
    blocked_until_real_readonly_import_credentials: true;
    blocked_until_provider_validateOnly_adapter: true;
    blocked_until_human_approval_ui: true;
    blocked_until_small_cap_live_test: true;
    not_in_mvp_count: number;
    foundation_closeout_status: AdsAutomationFoundationAcceptanceMatrixResponse['summary']['foundation_closeout_status'];
    ba_control_questions: number;
    ba_control_questions_complete_demo: number;
    live_readiness_blockers: number;
    final_live_execution_status: 'blocked_before_future_live_execution';
    execution_blocker_families_blocked: number;
    final_live_blockers: string[];
    safety_action_records_visible: number;
    execution_ready_now_actions: 0;
    provider_api_called: false;
    google_ads_api_called: false;
    validateOnly_called: false;
    live_ads_execution_used: false;
    execution_allowed_now: false;
    production_ready: false;
    stop_codex_foundation_loop: boolean;
    next_codex_prompt: null | 'FIX_LOCAL_FOUNDATION_GAPS';
  };
  buckets: AdsAutomationFinalGoNoGoBuckets;
  localDefects: string[];
  executionGateEvidence: AdsAutomationFinalGoNoGoExecutionGateEvidence;
  foundationEvidence: {
    safeImportRunId: string;
    unsafeImportRunId: string;
    matrix_items: number;
    safe_pending_actions: number;
    unsafe_pending_actions: number;
    safe_provider_actions: number;
    unsafe_provider_actions: number;
    safe_alert_rollback_records: number;
    unsafe_alert_rollback_records: number;
  };
  nextRecommendation:
    | 'STOP_CODEX_FOUNDATION_LOOP'
    | 'FIX_LOCAL_BLOCKING_DEFECTS';
}
