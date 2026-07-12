import type {
  AdsAutomationPendingErpActionNormalizationResponse,
  AdsAutomationPendingErpActionRecord,
  AdsAutomationPendingErpActionType,
} from './ads-automation-pending-erp-action.contract';
import type {
  AdsAutomationProviderRequestedActionReadiness,
} from './ads-automation-provider-account-readiness.contract';

export type AdsAutomationProviderValidateOnlyMockStatus =
  | 'provider_validate_passed'
  | 'provider_validate_failed';

export type AdsAutomationProviderValidateOnlyOperationKind =
  | 'campaign_budget_update'
  | 'campaign_pause'
  | 'ad_group_pause'
  | 'not_applicable_non_provider_action';

export type AdsAutomationProviderValidateOnlyStatus =
  | 'validate_only_pending'
  | 'validate_only_passed'
  | 'validate_only_failed'
  | 'blocked_before_validate_only'
  | 'skipped_non_provider_action';

export type AdsAutomationProviderValidateOnlyNextAction =
  | 'run_future_erp_validateOnly'
  | 'continue_human_approval_flow'
  | 'fix_provider_validation_errors'
  | 'fix_blockers_before_validateOnly'
  | 'not_applicable_non_provider_action';

export type AdsAutomationProviderValidateOnlyMvpActionScope =
  | 'provider_validateOnly_required'
  | 'monitor_only_safety_action'
  | 'out_of_scope_non_provider_action';

export type AdsAutomationProviderValidateOnlyPreflightTreatment =
  | 'eligible_for_future_provider_preflight'
  | 'visible_non_executable_safety_action'
  | 'not_in_mvp_validateOnly_contract';

export interface AdsAutomationProviderValidateOnlyError {
  code?: string;
  message: string;
  fieldPath?: string;
}

export interface AdsAutomationProviderValidateOnlyMockResult {
  pending_action_id?: string | null;
  approval_id?: string | null;
  status: AdsAutomationProviderValidateOnlyMockStatus;
  providerRequestId?: string | null;
  providerValidatedAt?: string | null;
  errors?: AdsAutomationProviderValidateOnlyError[];
  beforeStateSnapshot?: Record<string, unknown> | null;
}

export interface AdsAutomationProviderValidateOnlyBeforeStateSnapshot {
  snapshot_status: 'placeholder_pending_erp_synced_read' | 'mocked_boundary_snapshot';
  required_before_future_execution: true;
  source: 'erp_synced_google_ads_read_model';
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  snapshot: Record<string, unknown> | null;
}

export interface AdsAutomationProviderValidateOnlyRequestRecord {
  schemaVersion: 'ads_automation_provider_validate_only_request.v1';
  request_id: string;
  pending_action_id: string;
  approval_id: string;
  action_type: AdsAutomationPendingErpActionType;
  operation_kind: AdsAutomationProviderValidateOnlyOperationKind;
  provider: AdsAutomationPendingErpActionRecord['provider'];
  boundary_mode: 'erp_local_mock_only';
  request_status:
    | 'ready_for_future_validateOnly'
    | 'blocked_before_validateOnly'
    | 'not_applicable_non_provider_action';
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  requested_change: Record<string, unknown>;
  required_identifiers: string[];
  missing_identifiers: string[];
  before_state_snapshot_required: true;
  raw_provider_request_included: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  execution_allowed_now: false;
}

export interface AdsAutomationProviderValidateOnlyResultRecord {
  schemaVersion: 'ads_automation_provider_validate_only_result.v1';
  result_id: string;
  request_id: string;
  pending_action_id: string;
  approval_id: string;
  action_type: AdsAutomationPendingErpActionType;
  operation_kind: AdsAutomationProviderValidateOnlyOperationKind;
  status: AdsAutomationProviderValidateOnlyStatus;
  providerValidationStatus:
    AdsAutomationProviderValidateOnlyMockStatus
    | 'pending'
    | 'not_applicable';
  providerRequestId: string | null;
  providerValidatedAt: string | null;
  providerValidationErrors: AdsAutomationProviderValidateOnlyError[];
  before_state_snapshot: AdsAutomationProviderValidateOnlyBeforeStateSnapshot;
  mocked_provider_result_used: boolean;
  approval_can_be_considered_executable: boolean;
  executable_now: false;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationProviderValidateOnlyBoundaryEvidence {
  boundary_mode: 'erp_local_mock_only';
  status_source: 'no_mock_result' | 'mock_provider_result' | 'preflight_blockers' | 'non_provider_action';
  mocked_provider_result_used: boolean;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  direct_google_ads_api_call: false;
  operation_builder_called: false;
  raw_provider_request_included: false;
  evidence: string[];
}

export interface AdsAutomationProviderValidateOnlyMvpActionContract {
  supported_mvp_action: boolean;
  action_scope: AdsAutomationProviderValidateOnlyMvpActionScope;
  preflight_treatment: AdsAutomationProviderValidateOnlyPreflightTreatment;
  provider_validateOnly_required_before_future_execution: boolean;
  monitor_only_safety_action: boolean;
  visible_as_safety_action: boolean;
  approval_required_before_execution: true;
  future_live_execution_allowed: false;
  executable_now: false;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export type AdsAutomationProviderValidateOnlyMvpActionContractReviewSource =
  | 'validateOnly_lane'
  | 'monitor_only_action'
  | 'api_readiness_validateOnly_lane';

export interface AdsAutomationProviderValidateOnlyMvpActionContractReviewItem {
  source: AdsAutomationProviderValidateOnlyMvpActionContractReviewSource;
  action_id: string;
  pending_action_id: string | null;
  approval_id: string | null;
  action_type: AdsAutomationPendingErpActionType;
  provider: AdsAutomationPendingErpActionRecord['provider'];
  mvp_action_contract: AdsAutomationProviderValidateOnlyMvpActionContract;
  evidence: string[];
}

export interface AdsAutomationProviderValidateOnlyMvpActionContractReview {
  provider_mvp_actions_requiring_validateOnly: number;
  monitor_only_mvp_safety_actions: number;
  out_of_scope_non_provider_actions: number;
  supported_mvp_actions: number;
  unsupported_mvp_actions: number;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  action_contracts: AdsAutomationProviderValidateOnlyMvpActionContractReviewItem[];
}

export interface AdsAutomationProviderValidateOnlyActionPlan {
  validation_id: string;
  pending_action_id: string;
  approval_id: string;
  source_pending_action_status: AdsAutomationPendingErpActionRecord['status'];
  action_type: AdsAutomationPendingErpActionType;
  action_family: AdsAutomationPendingErpActionRecord['action_family'];
  provider: AdsAutomationPendingErpActionRecord['provider'];
  resource_type: AdsAutomationPendingErpActionRecord['resource_type'];
  entity_type: AdsAutomationPendingErpActionRecord['entity_type'];
  entity_id: string;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  requested_change: Record<string, unknown>;
  status: AdsAutomationProviderValidateOnlyStatus;
  providerValidationStatus: AdsAutomationProviderValidateOnlyMockStatus | 'pending' | 'not_applicable';
  providerRequestId: string | null;
  providerValidatedAt: string | null;
  providerValidationErrors: AdsAutomationProviderValidateOnlyError[];
  before_state_snapshot: AdsAutomationProviderValidateOnlyBeforeStateSnapshot;
  validateOnly_request?: AdsAutomationProviderValidateOnlyRequestRecord;
  validateOnly_result?: AdsAutomationProviderValidateOnlyResultRecord;
  provider_boundary_evidence: AdsAutomationProviderValidateOnlyBoundaryEvidence;
  mvp_action_contract?: AdsAutomationProviderValidateOnlyMvpActionContract;
  provider_account_readiness?: Pick<
    AdsAutomationProviderRequestedActionReadiness,
    | 'actionId'
    | 'status'
    | 'blockers'
    | 'missingScopes'
    | 'monitorOnlyDowngradeRequired'
    | 'safetyActionCandidateAvailable'
    | 'campaignBudgetIdNoFallback'
  > | null;
  blockers: string[];
  approval_can_be_considered_executable: boolean;
  executable_now: false;
  execution_allowed_now: false;
  validate_only_required_before_execution: boolean;
  next_required_action: AdsAutomationProviderValidateOnlyNextAction;
  source_pending_action: AdsAutomationPendingErpActionRecord;
}

export interface AdsAutomationProviderValidateOnlyLaneSafety {
  read_only: true;
  dry_run: true;
  in_memory_only: true;
  persistence_used: false;
  durable_storage_used: false;
  erp_local_persistence_used: false;
  provider_persistence_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
  approval_required_for_all_actions: true;
  approval_can_be_considered_executable_only_after_validateOnly_passed: true;
  execution_allowed_now: false;
  provider_validateOnly_lane_mocked: true;
  no_direct_google_ads_api_call: true;
  campaignBudgetId_no_fallback: true;
}

export interface AdsAutomationProviderValidateOnlyLaneSummary {
  pending_actions_received: number;
  provider_actions_received: number;
  non_provider_actions_skipped: number;
  validate_only_pending: number;
  validate_only_passed: number;
  validate_only_failed: number;
  blocked_before_validate_only: number;
  approval_can_be_considered_executable: number;
  executable_now: 0;
}

export interface AdsAutomationProviderValidateOnlyLaneResponse {
  schemaVersion: 'ads_automation_provider_validate_only_lane.v1';
  generatedAt: string;
  sourceNormalizationSchemaVersion: AdsAutomationPendingErpActionNormalizationResponse['schemaVersion'];
  sourceNormalizationGeneratedAt: string;
  safety: AdsAutomationProviderValidateOnlyLaneSafety;
  summary: AdsAutomationProviderValidateOnlyLaneSummary;
  validationPlans: AdsAutomationProviderValidateOnlyActionPlan[];
}
