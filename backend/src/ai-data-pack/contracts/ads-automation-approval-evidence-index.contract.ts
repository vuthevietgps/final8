import type { AdsAutomationExecutionPreflightDryRunRecord } from './ads-automation-execution-preflight-dry-run.contract';
import type { AdsAutomationDecisionDraftPendingApprovalRecord } from './ads-automation-decision-draft-approval.contract';
import type { AdsAutomationPolicyDecisionEvidenceRecord } from './ads-automation-policy-decision-evidence.contract';
import type { AdsAutomationValidateOnlyEvidenceRecord } from './ads-automation-validate-only-evidence.contract';
import type {
  AdsAutomationGoogleAdsMockImportValidateOnlyPreflight,
} from './ads-automation-google-ads-mock-import-demo.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from '../source-sync/source-sync-result.types';
import type {
  AdsAutomationProviderAccountReadinessStatus,
  AdsAutomationProviderActionReadinessStatus,
  AdsAutomationProviderCredentialStatus,
  AdsAutomationProviderPermissionScope,
  AdsAutomationProviderPlatform,
} from './ads-automation-provider-account-readiness.contract';

export type AdsAutomationApprovalEvidenceSourceSyncGateStatus =
  | 'not_available'
  | 'ready'
  | 'blocked';

export type AdsAutomationApprovalEvidenceProviderReadinessStatus =
  | 'not_available'
  | 'not_applicable_internal_action'
  | AdsAutomationProviderAccountReadinessStatus;

export interface AdsAutomationApprovalEvidencePendingActionProviderReadiness {
  status:
    | 'not_available'
    | 'not_applicable_internal_action'
    | AdsAutomationProviderActionReadinessStatus;
  accountReadinessStatus: AdsAutomationApprovalEvidenceProviderReadinessStatus;
  platform: AdsAutomationProviderPlatform | null;
  accountId: string | null;
  customerId: string | null;
  erpAccountMappingId: string | null;
  credentialStatus: AdsAutomationProviderCredentialStatus | 'not_applicable' | 'not_available';
  oauthConnectionStatus: AdsAutomationProviderCredentialStatus | 'not_applicable' | 'not_available';
  credentialReferenceId: string | null;
  redactedCredentialReference: string | null;
  requiredScopes: AdsAutomationProviderPermissionScope[];
  grantedScopes: AdsAutomationProviderPermissionScope[];
  missingScopes: AdsAutomationProviderPermissionScope[];
  blockers: string[];
  warnings: string[];
  accountMappingBlockers: string[];
  oauthMetadataBlockers: string[];
  permissionScopeBlockers: string[];
  capabilityBlockers: string[];
  campaignBudgetIdNoFallback: boolean | null;
  campaignBudgetIdMissingNoFallback: boolean;
  providerApiRequired: boolean;
  validateOnlyRequiredBeforeExecution: boolean;
  monitorOnlyDowngradeRequired: boolean;
  safetyActionCandidateAvailable: boolean;
  approval_can_be_considered_executable: false;
  execution_allowed_now: false;
  next_required_action:
    | 'review_future_validate_only_contract'
    | 'monitor_only_until_provider_readiness_resolved'
    | 'resolve_provider_account_readiness'
    | 'use_monitor_only_safety_action'
    | 'review_internal_task_evidence'
    | 'verify_provider_readiness_payload';
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationApprovalEvidencePendingActionReviewEvidence {
  pending_action_id: string;
  approval_id: string;
  action_type: AdsAutomationDecisionDraftPendingApprovalRecord['action_type'];
  action_family: AdsAutomationDecisionDraftPendingApprovalRecord['action_family'];
  provider: AdsAutomationDecisionDraftPendingApprovalRecord['provider'];
  entity_type: AdsAutomationDecisionDraftPendingApprovalRecord['entity_type'];
  entity_id: string;
  accountId: string | null;
  productId: string | null;
  supplierId: string | null;
  platform: string | null;
  status: AdsAutomationDecisionDraftPendingApprovalRecord['status'];
  sourceSyncDecisionEvidence: SourceSyncDecisionEvidence[];
  sourceSyncDecisionGates: Partial<SourceSyncDecisionGates> | null;
  source_sync_blocking_reasons: string[];
  providerAccountReadiness: AdsAutomationApprovalEvidencePendingActionProviderReadiness;
  approval_required: true;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationApprovalEvidenceIndexSafety {
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
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  live_path_implemented: false;
  provider_mutation_used: false;
  direct_google_ads_api_call: false;
  approval_evidence_index_readback: true;
  approval_evidence_index_persistence_performed: false;
  validateOnly_evidence_persistence_performed: false;
  policy_decision_evidence_persistence_performed: false;
  preflight_persistence_performed: false;
}

export interface AdsAutomationApprovalEvidenceIndexQuery {
  approval_id: string;
}

export interface AdsAutomationApprovalEvidenceIndexLinks {
  execution_record_ids: string[];
  validateOnly_validation_ids_from_preflight: string[];
  validateOnly_validation_ids_with_evidence: string[];
  validateOnly_validation_ids_missing_evidence: string[];
  policy_decision_ids_from_preflight: string[];
  policy_decision_ids_with_evidence: string[];
  policy_decision_ids_missing_evidence: string[];
}

export interface AdsAutomationApprovalEvidenceIndexSummary {
  readback_status: 'empty' | 'listed';
  approval_id_filter_applied: true;
  validateOnly_evidence_records_matched: number;
  policy_decision_records_matched: number;
  execution_preflight_records_matched: number;
  pending_approval_record_matched: boolean;
  pending_action_review_evidence_records_matched: number;
  source_sync_decision_evidence_records_matched: number;
  source_sync_decision_blocked_sources: number;
  source_sync_gate_status: AdsAutomationApprovalEvidenceSourceSyncGateStatus;
  source_sync_can_generate_action_draft: boolean | null;
  source_sync_can_recommend_ads_scale: boolean | null;
  source_sync_can_use_google_ads_data_claim: boolean | null;
  source_sync_blocking_reasons: string[];
  provider_account_readiness_status: AdsAutomationApprovalEvidenceProviderReadinessStatus;
  provider_account_readiness_blocked_actions: number;
  provider_account_readiness_blocking_reasons: string[];
  provider_account_readiness_campaignBudgetId_no_fallback: boolean | null;
  provider_account_readiness_scale_up_execution_mode: 'monitor_only' | 'pending_validation' | null;
  linked_validateOnly_evidence_records: number;
  linked_policy_decision_records: number;
  unlinked_validateOnly_validation_ids: number;
  unlinked_policy_decision_ids: number;
  approval_required: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  live_path_implemented: false;
  approval_evidence_index_persistence_performed: false;
  validateOnly_evidence_persistence_performed: false;
  policy_decision_evidence_persistence_performed: false;
  preflight_persistence_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  next_required_action: 'inspect_approval_evidence_index' | 'verify_approval_id_or_generate_preflight_evidence';
}

export interface AdsAutomationApprovalEvidenceIndexResponse {
  schemaVersion: 'ads_automation_approval_evidence_index.v1';
  generatedAt: string;
  query: AdsAutomationApprovalEvidenceIndexQuery;
  safety: AdsAutomationApprovalEvidenceIndexSafety;
  summary: AdsAutomationApprovalEvidenceIndexSummary;
  links: AdsAutomationApprovalEvidenceIndexLinks;
  pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null;
  pendingActionReviewEvidence: AdsAutomationApprovalEvidencePendingActionReviewEvidence[];
  sourceSyncDecisionEvidence: SourceSyncDecisionEvidence[];
  sourceSyncDecisionGates: Partial<SourceSyncDecisionGates> | null;
  validateOnlyEvidenceRecords: AdsAutomationValidateOnlyEvidenceRecord[];
  policyDecisionEvidenceRecords: AdsAutomationPolicyDecisionEvidenceRecord[];
  executionPreflightDryRunRecords: AdsAutomationExecutionPreflightDryRunRecord[];
}

export type AdsAutomationApprovalEvidenceReviewExportMode =
  | 'local_readback'
  | 'local_demo_fixture';

export type AdsAutomationApprovalEvidenceReviewFixtureScenario =
  | 'linked_budget_update_evidence'
  | 'scale_recommendation_gate_blocker_evidence'
  | 'pause_ad_group_blocker_evidence'
  | 'supplier_product_stop_import_review_blocker_evidence'
  | 'google_ads_mock_validate_only_preflight_blockers'
  | 'empty_approval_evidence';

export interface AdsAutomationApprovalEvidenceReviewExportQuery
  extends AdsAutomationApprovalEvidenceIndexQuery {
  fixture?: AdsAutomationApprovalEvidenceReviewFixtureScenario;
}

export interface AdsAutomationApprovalEvidenceReviewExportSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  in_memory_only: boolean;
  persistence_used: boolean;
  durable_storage_used: boolean;
  erp_local_persistence_used: boolean;
  provider_persistence_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
  approval_required_for_all_records: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  live_path_implemented: false;
  provider_mutation_used: false;
  direct_google_ads_api_call: false;
  reviewer_export_readback: true;
  reviewer_export_persistence_performed: false;
  demo_fixture_used: boolean;
  demo_fixture_persistence_performed: false;
}

export type AdsAutomationApprovalEvidenceValidateOnlyPreflightReviewStatus =
  | 'not_available'
  | AdsAutomationGoogleAdsMockImportValidateOnlyPreflight['status'];

export interface AdsAutomationApprovalEvidenceValidateOnlyPreflightSourceReadiness {
  sourceKey: string;
  freshnessStatus: string | null;
  coverageStatus: string | null;
  canUseForAdsAutomationDecision: boolean;
  blockingReasons: string[];
}

export interface AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups {
  campaignBudgetId: string[];
  source_freshness: string[];
  product_mapping: string[];
  inventory_profit: string[];
  supplier_safety: string[];
  read_model: string[];
}

export interface AdsAutomationApprovalEvidenceValidateOnlyPreflightClosedSafetyFlags {
  campaignBudgetId_fallback_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
}

export interface AdsAutomationApprovalEvidenceValidateOnlyPreflightReviewCandidate {
  candidate_id: string;
  draft_id: string | null;
  pending_action_id: string | null;
  approval_id: string | null;
  action_type: string;
  candidate_status: AdsAutomationGoogleAdsMockImportValidateOnlyPreflight['candidates'][number]['candidate_status'];
  provider_validateOnly_readiness: AdsAutomationGoogleAdsMockImportValidateOnlyPreflight['candidates'][number]['provider_validateOnly_readiness'];
  validateOnly_plan_status: string | null;
  validateOnly_request_status: string | null;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  productId: string | null;
  supplierId: string | null;
  campaignBudgetId_missing_no_fallback: boolean;
  blocked_source_keys: string[];
  blockers: string[];
  read_model_blockers: string[];
  blockerGroups: AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups;
  sourceReadiness: AdsAutomationApprovalEvidenceValidateOnlyPreflightSourceReadiness[];
  closedSafetyFlags: AdsAutomationApprovalEvidenceValidateOnlyPreflightClosedSafetyFlags;
}

export interface AdsAutomationApprovalEvidenceValidateOnlyPreflightReview {
  status: AdsAutomationApprovalEvidenceValidateOnlyPreflightReviewStatus;
  source: AdsAutomationGoogleAdsMockImportValidateOnlyPreflight['source'] | 'not_available';
  pending_action_candidate_status:
    | AdsAutomationGoogleAdsMockImportValidateOnlyPreflight['pending_action_candidate_status']
    | 'not_available';
  candidate_count: number;
  pending_action_count: number;
  blocked_candidate_count: number;
  blocked_source_keys: string[];
  blockers: string[];
  blockerGroups: AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups;
  candidates: AdsAutomationApprovalEvidenceValidateOnlyPreflightReviewCandidate[];
  closedSafetyFlags: AdsAutomationApprovalEvidenceValidateOnlyPreflightClosedSafetyFlags;
  next_required_action:
    | 'inspect_blocked_validate_only_preflight_candidates'
    | 'continue_human_approval_flow'
    | 'generate_validate_only_preflight_evidence';
}

export interface AdsAutomationApprovalEvidenceReviewExportSummary {
  export_status: 'empty' | 'ready_for_review';
  export_mode: AdsAutomationApprovalEvidenceReviewExportMode;
  evidence_index_readback_status: AdsAutomationApprovalEvidenceIndexSummary['readback_status'];
  approval_id_filter_applied: true;
  total_evidence_records_included: number;
  validateOnly_evidence_records_included: number;
  policy_decision_records_included: number;
  execution_preflight_records_included: number;
  pending_approval_record_included: boolean;
  pending_action_review_evidence_records_included: number;
  source_sync_decision_evidence_records_included: number;
  source_sync_decision_blocked_sources: number;
  source_sync_gate_status: AdsAutomationApprovalEvidenceSourceSyncGateStatus;
  source_sync_can_generate_action_draft: boolean | null;
  source_sync_can_recommend_ads_scale: boolean | null;
  source_sync_can_use_google_ads_data_claim: boolean | null;
  source_sync_blocking_reasons: string[];
  provider_account_readiness_status: AdsAutomationApprovalEvidenceProviderReadinessStatus;
  provider_account_readiness_blocked_actions: number;
  provider_account_readiness_blocking_reasons: string[];
  provider_account_readiness_campaignBudgetId_no_fallback: boolean | null;
  provider_account_readiness_scale_up_execution_mode: 'monitor_only' | 'pending_validation' | null;
  validateOnly_preflight_source_status: AdsAutomationApprovalEvidenceValidateOnlyPreflightReviewStatus;
  validateOnly_preflight_candidates_included: number;
  validateOnly_preflight_blocked_candidates: number;
  validateOnly_preflight_campaignBudgetId_blockers: number;
  validateOnly_preflight_source_freshness_blockers: number;
  validateOnly_preflight_product_mapping_blockers: number;
  validateOnly_preflight_inventory_profit_blockers: number;
  validateOnly_preflight_supplier_safety_blockers: number;
  validateOnly_preflight_read_model_blockers: number;
  validateOnly_preflight_safety_flags_closed: boolean;
  linked_validateOnly_evidence_records: number;
  linked_policy_decision_records: number;
  unlinked_validateOnly_validation_ids: number;
  unlinked_policy_decision_ids: number;
  approval_required: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  live_path_implemented: false;
  reviewer_export_persistence_performed: false;
  demo_fixture_persistence_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  next_required_action: 'inspect_reviewer_export' | 'verify_approval_id_or_generate_preflight_evidence';
}

export interface AdsAutomationApprovalEvidenceReviewExportFixtureMetadata {
  fixture_id: string;
  scenario: AdsAutomationApprovalEvidenceReviewFixtureScenario;
  source: 'erp_local_demo_fixture';
  description: string;
  persisted_to_db: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationApprovalEvidenceReviewExportGuide {
  review_route: string;
  demo_fixture_route: string;
  sample_curl: string;
  checklist: string[];
}

export interface AdsAutomationApprovalEvidenceReviewExportResponse {
  schemaVersion: 'ads_automation_approval_evidence_review_export.v1';
  generatedAt: string;
  exportMode: AdsAutomationApprovalEvidenceReviewExportMode;
  query: AdsAutomationApprovalEvidenceReviewExportQuery;
  safety: AdsAutomationApprovalEvidenceReviewExportSafety;
  summary: AdsAutomationApprovalEvidenceReviewExportSummary;
  fixture: AdsAutomationApprovalEvidenceReviewExportFixtureMetadata | null;
  reviewerGuide: AdsAutomationApprovalEvidenceReviewExportGuide;
  validateOnlyPreflightReview: AdsAutomationApprovalEvidenceValidateOnlyPreflightReview;
  evidenceIndex: AdsAutomationApprovalEvidenceIndexResponse;
}

export type AdsAutomationApprovalEvidenceReviewerDocsMode =
  | 'local_readback_docs'
  | 'local_demo_fixture_docs';

export interface AdsAutomationApprovalEvidenceReviewerDocsSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  in_memory_only: boolean;
  persistence_used: boolean;
  durable_storage_used: boolean;
  erp_local_persistence_used: boolean;
  provider_persistence_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
  approval_required_for_all_records: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  live_path_implemented: false;
  provider_mutation_used: false;
  direct_google_ads_api_call: false;
  reviewer_export_readback: true;
  reviewer_export_persistence_performed: false;
  reviewer_docs_readback: true;
  reviewer_docs_persistence_performed: false;
  demo_fixture_used: boolean;
  demo_fixture_persistence_performed: false;
}

export interface AdsAutomationApprovalEvidenceReviewerDocsSummary {
  docs_status: 'empty' | 'ready_for_review';
  docs_mode: AdsAutomationApprovalEvidenceReviewerDocsMode;
  source_export_mode: AdsAutomationApprovalEvidenceReviewExportMode;
  export_status: AdsAutomationApprovalEvidenceReviewExportSummary['export_status'];
  total_evidence_records_rendered: number;
  validateOnly_evidence_records_rendered: number;
  policy_decision_records_rendered: number;
  execution_preflight_records_rendered: number;
  pending_approval_record_rendered: boolean;
  pending_action_review_evidence_records_rendered: number;
  source_sync_decision_evidence_records_rendered: number;
  source_sync_decision_blocked_sources_rendered: number;
  source_sync_gate_status: AdsAutomationApprovalEvidenceSourceSyncGateStatus;
  source_sync_can_generate_action_draft: boolean | null;
  source_sync_can_recommend_ads_scale: boolean | null;
  source_sync_can_use_google_ads_data_claim: boolean | null;
  source_sync_blocking_reasons_rendered: string[];
  provider_account_readiness_status: AdsAutomationApprovalEvidenceProviderReadinessStatus;
  provider_account_readiness_blocked_actions_rendered: number;
  provider_account_readiness_blocking_reasons_rendered: string[];
  provider_account_readiness_campaignBudgetId_no_fallback: boolean | null;
  provider_account_readiness_scale_up_execution_mode: 'monitor_only' | 'pending_validation' | null;
  linked_validateOnly_evidence_records: number;
  linked_policy_decision_records: number;
  route_examples_rendered: number;
  sections_rendered: number;
  approval_required: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  live_path_implemented: false;
  reviewer_docs_persistence_performed: false;
  reviewer_export_persistence_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  next_required_action: 'inspect_reviewer_docs' | 'verify_approval_id_or_generate_preflight_evidence';
}

export interface AdsAutomationApprovalEvidenceReviewerDocsRouteExample {
  label: string;
  method: 'GET';
  path: string;
  query: string | null;
  purpose: string;
  provider_api_called: false;
  erp_mutation_used: false;
}

export interface AdsAutomationApprovalEvidenceReviewerDocsSection {
  section_id: string;
  title: string;
  status: 'empty' | 'ready_for_review' | 'passed' | 'attention';
  lines: string[];
  evidence_record_ids: string[];
}

export interface AdsAutomationApprovalEvidenceReviewerDocsResponse {
  schemaVersion: 'ads_automation_approval_evidence_reviewer_docs.v1';
  generatedAt: string;
  docsMode: AdsAutomationApprovalEvidenceReviewerDocsMode;
  query: AdsAutomationApprovalEvidenceReviewExportQuery;
  safety: AdsAutomationApprovalEvidenceReviewerDocsSafety;
  summary: AdsAutomationApprovalEvidenceReviewerDocsSummary;
  routeExamples: AdsAutomationApprovalEvidenceReviewerDocsRouteExample[];
  renderedSections: AdsAutomationApprovalEvidenceReviewerDocsSection[];
  markdownPreview: string;
  reviewerExport: AdsAutomationApprovalEvidenceReviewExportResponse;
}
