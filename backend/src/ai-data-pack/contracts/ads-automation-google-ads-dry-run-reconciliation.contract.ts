import type {
  AdsAutomationGoogleAdsMockImportDemoInput,
  AdsAutomationGoogleAdsMockImportDemoResponse,
} from "./ads-automation-google-ads-mock-import-demo.contract";
import type {
  AdsAutomationPendingErpActionRecord,
  AdsAutomationPendingErpActionType,
} from "./ads-automation-pending-erp-action.contract";
import type { AdsAutomationProviderValidateOnlyStatus } from "./ads-automation-provider-validate-only.contract";

export type AdsAutomationGoogleAdsDryRunReconciliationStatus =
  | "complete_local_evidence_blocked_before_live"
  | "gaps_found";

export type AdsAutomationGoogleAdsDryRunValidationStatus =
  | AdsAutomationProviderValidateOnlyStatus
  | "missing"
  | "not_applicable_non_provider_action";

export interface AdsAutomationGoogleAdsDryRunReconciliationInput {
  demoInput?: AdsAutomationGoogleAdsMockImportDemoInput;
  demoResponse?: AdsAutomationGoogleAdsMockImportDemoResponse;
}

export interface AdsAutomationGoogleAdsDryRunReconciliationGates {
  approval_evidence_linked: boolean;
  validate_only_plan_linked: boolean;
  validate_only_passed_or_not_applicable: boolean;
  dry_run_audit_linked: boolean;
  rollback_evidence_required: boolean;
  rollback_evidence_linked: boolean;
  rollback_evidence_requirement_satisfied: boolean;
  identifiers_match: boolean;
  idempotency_key_unique: boolean;
  campaignBudgetId_no_fallback: true;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationGoogleAdsDryRunActionReconciliation {
  pending_action_id: string;
  approval_id: string;
  action_type: AdsAutomationPendingErpActionType;
  action_family: AdsAutomationPendingErpActionRecord["action_family"];
  provider: AdsAutomationPendingErpActionRecord["provider"];
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  productId: string | null;
  supplierId: string | null;
  validation_status: AdsAutomationGoogleAdsDryRunValidationStatus;
  approval_status: string;
  dry_run_record_status: "recorded_local_only" | "missing";
  rollback_status: "present" | "missing" | "not_required_internal_task";
  identifier_match_status: "matched" | "mismatch";
  evidence_status: AdsAutomationGoogleAdsDryRunReconciliationStatus;
  campaignBudgetId_source:
    | "campaign_budget_field"
    | "missing_no_fallback"
    | "not_applicable_non_budget_action";
  idempotency_key: string;
  duplicate_idempotency_key: boolean;
  gates: AdsAutomationGoogleAdsDryRunReconciliationGates;
  blockers: string[];
  next_required_action:
    | "keep_local_only_review_packet"
    | "fix_reconciliation_gaps_before_any_future_executor";
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  production_ready: false;
}

export interface AdsAutomationGoogleAdsDryRunReconciliationResponse {
  schemaVersion: "ads_automation_google_ads_dry_run_reconciliation.v1";
  generatedAt: string;
  sourceSchemaVersion: AdsAutomationGoogleAdsMockImportDemoResponse["schemaVersion"];
  reportDate: string;
  importRunId: string;
  cashflowMode: AdsAutomationGoogleAdsMockImportDemoResponse["cashflowMode"];
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
    future_live_execution_requires_validateOnly_passed: true;
    future_live_execution_requires_approval_evidence: true;
    future_live_execution_requires_dry_run_audit: true;
    future_live_execution_requires_rollback_plan: true;
    erp_only_future_validator_approver_executor: true;
  };
  summary: {
    status: AdsAutomationGoogleAdsDryRunReconciliationStatus;
    actions_reconciled: number;
    provider_actions_reconciled: number;
    non_provider_actions_reconciled: number;
    complete_local_evidence_actions: number;
    gapped_actions: number;
    approval_evidence_linked: number;
    mocked_validate_only_passed_provider_actions: number;
    dry_run_audit_records_linked: number;
    rollback_evidence_linked: number;
    duplicate_idempotency_keys: number;
    blocked_future_live_actions: number;
    execution_ready_now_actions: 0;
    campaignBudgetId_no_fallback: true;
    provider_api_called: false;
    google_ads_api_called: false;
    validateOnly_called: false;
    live_ads_execution_used: false;
    execution_allowed_now: false;
    production_ready: false;
  };
  actionReconciliation: AdsAutomationGoogleAdsDryRunActionReconciliation[];
}
