import type {
  AdsAutomationGoogleAdsMockImportDemoInput,
  AdsAutomationGoogleAdsMockImportDemoResponse,
} from './ads-automation-google-ads-mock-import-demo.contract';
import type {
  AdsAutomationGoogleAdsDryRunReconciliationResponse,
} from './ads-automation-google-ads-dry-run-reconciliation.contract';

export type AdsAutomationFoundationAcceptanceCapabilityStatus =
  | 'complete_demo'
  | 'blocked_until_real_credentials'
  | 'blocked_until_real_provider_validateOnly'
  | 'blocked_until_approval_ui'
  | 'blocked_until_small_cap_live_test';

export type AdsAutomationFoundationAcceptanceCapabilityKey =
  | 'may_ads_increase'
  | 'increase_amount'
  | 'target_campaigns_ad_groups'
  | 'product_budget_allocation'
  | 'supplier_safety'
  | 'kill_stop_import_review'
  | 'pause_reduce_candidates'
  | 'monitor_only_downgrade'
  | 'rollback_alert_evidence'
  | 'real_credentials_gate'
  | 'real_provider_validateOnly_gate'
  | 'approval_ui_gate'
  | 'small_cap_live_test_gate';

export interface AdsAutomationFoundationAcceptanceMatrixInput {
  safeDemoInput?: AdsAutomationGoogleAdsMockImportDemoInput;
  unsafeDemoInput?: AdsAutomationGoogleAdsMockImportDemoInput;
  safeDemoResponse?: AdsAutomationGoogleAdsMockImportDemoResponse;
  unsafeDemoResponse?: AdsAutomationGoogleAdsMockImportDemoResponse;
}

export interface AdsAutomationFoundationAcceptanceEvidenceRef {
  source: 'safe_cashflow_demo' | 'unsafe_cashflow_demo' | 'combined_safe_unsafe_demo';
  importRunId: string;
  pending_action_ids: string[];
  approval_ids: string[];
  dry_run_record_ids: string[];
  alert_ids: string[];
  campaignIds: string[];
  adGroupIds: string[];
  campaignBudgetIds: string[];
  productIds: string[];
  supplierIds: string[];
  notes: string[];
}

export interface AdsAutomationFoundationAcceptanceMatrixItem {
  key: AdsAutomationFoundationAcceptanceCapabilityKey;
  label: string;
  ba_control_question: boolean;
  status: AdsAutomationFoundationAcceptanceCapabilityStatus;
  answer: string;
  evidence: AdsAutomationFoundationAcceptanceEvidenceRef;
  blockers: string[];
  next_required_before_live: AdsAutomationFoundationAcceptanceCapabilityStatus[];
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  production_ready: false;
}

export interface AdsAutomationFoundationAcceptanceMatrixResponse {
  schemaVersion: 'ads_automation_foundation_acceptance_matrix.v1';
  generatedAt: string;
  reportDate: string;
  safeImportRunId: string;
  unsafeImportRunId: string;
  safety: {
    read_only: true;
    dry_run: true;
    local_fixture_only: true;
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
    campaignBudgetId_no_fallback: true;
    approval_required_for_all_actions: true;
    execution_allowed_now: false;
    GOOGLE_ADS_PRODUCTION_ENABLED: false;
    production_ready: false;
    future_live_execution_allowed: false;
  };
  summary: {
    foundation_closeout_status:
      | 'complete_demo_ready_for_final_go_no_go'
      | 'gaps_found_keep_foundation_open';
    matrix_items: number;
    ba_control_questions: number;
    ba_control_questions_complete_demo: number;
    live_readiness_blockers: number;
    safe_pending_actions: number;
    unsafe_pending_actions: number;
    safe_provider_actions: number;
    unsafe_provider_actions: number;
    safe_alert_rollback_records: number;
    unsafe_alert_rollback_records: number;
    execution_ready_now_actions: 0;
    provider_api_called: false;
    google_ads_api_called: false;
    validateOnly_called: false;
    live_ads_execution_used: false;
    execution_allowed_now: false;
    production_ready: false;
    next_prompt: 'ADS_AUTOMATION_FINAL_GO_NO_GO_GATE_LOCAL_ONLY' | 'FIX_LOCAL_FOUNDATION_GAPS';
  };
  matrix: AdsAutomationFoundationAcceptanceMatrixItem[];
  sourceEvidence: {
    safe: {
      demoSchemaVersion: AdsAutomationGoogleAdsMockImportDemoResponse['schemaVersion'];
      reconciliationSchemaVersion: AdsAutomationGoogleAdsDryRunReconciliationResponse['schemaVersion'];
      cashflowMode: 'safe';
      scale_up_execution_mode: 'pending_validation' | 'monitor_only';
      pending_actions_created: number;
      update_budget_actions: number;
      monitor_only_actions: number;
      pause_actions: number;
      stop_import_review_actions: number;
      alert_rollback_records: number;
    };
    unsafe: {
      demoSchemaVersion: AdsAutomationGoogleAdsMockImportDemoResponse['schemaVersion'];
      reconciliationSchemaVersion: AdsAutomationGoogleAdsDryRunReconciliationResponse['schemaVersion'];
      cashflowMode: 'unsafe';
      scale_up_execution_mode: 'pending_validation' | 'monitor_only';
      pending_actions_created: number;
      update_budget_actions: number;
      monitor_only_actions: number;
      pause_actions: number;
      stop_import_review_actions: number;
      alert_rollback_records: number;
    };
  };
}
