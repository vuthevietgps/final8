import type {
  AdsAutomationDecisionDraftActionType,
  AdsAutomationDecisionDraftFamily,
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './ads-automation-decision-draft-preview.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from '../source-sync/source-sync-result.types';

export type AdsAutomationDecisionDraftApprovalStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected';
export type AdsAutomationDecisionDraftApprovalStorage = 'erp_local_mongo';

export interface AdsAutomationDecisionDraftPendingApprovalRecord {
  approval_id: string;
  source_schema_version: AdsAutomationDecisionDraftPreviewResponse['schemaVersion'];
  source_draft_id: string;
  source_decision_id: string;
  action_type: AdsAutomationDecisionDraftActionType;
  action_family: AdsAutomationDecisionDraftFamily;
  provider: AdsAutomationDecisionDraftPreview['provider'];
  resource_type: AdsAutomationDecisionDraftPreview['resource_type'];
  entity_type: AdsAutomationDecisionDraftPreview['entity_type'];
  entity_id: string;
  accountId: string | null;
  productId: string | null;
  supplierId: string | null;
  platform: string | null;
  status: AdsAutomationDecisionDraftApprovalStatus;
  approval_required: true;
  execution_allowed_now: false;
  validate_only_required: boolean;
  future_provider_validateOnly_required: boolean;
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  persistence_used: true;
  durable_storage_used: true;
  erp_local_persistence_used: true;
  provider_persistence_used: false;
  storage: AdsAutomationDecisionDraftApprovalStorage;
  typedPayload: Record<string, unknown>;
  source_evidence_references: AdsAutomationDecisionDraftPreview['source_evidence_references'];
  sourceSyncDecisionEvidence?: SourceSyncDecisionEvidence[];
  sourceSyncDecisionGates?: Partial<SourceSyncDecisionGates> | null;
  blockers: string[];
  missing_data_blockers: string[];
  idempotency_key: string;
  rationale: string;
  createdAt: string;
  persistedAt: string;
}

export type AdsAutomationDecisionDraftApprovalFinalDecisionStatus =
  | 'approved'
  | 'rejected';

export interface AdsAutomationDecisionDraftApprovalImportSafety {
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
}

export interface AdsAutomationDecisionDraftApprovalImportSummary {
  previews_received: number;
  pending_approvals_created: number;
  provider_action_approvals: number;
  internal_task_approvals: number;
  monitoring_approvals: number;
  duplicates_rejected: number;
}

export interface AdsAutomationDecisionDraftApprovalImportResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_import.v1';
  generatedAt: string;
  sourcePreviewSchemaVersion: AdsAutomationDecisionDraftPreviewResponse['schemaVersion'];
  safety: AdsAutomationDecisionDraftApprovalImportSafety;
  summary: AdsAutomationDecisionDraftApprovalImportSummary;
  pendingApprovals: AdsAutomationDecisionDraftPendingApprovalRecord[];
}

export interface AdsAutomationDecisionDraftApprovalReadModelQuery {
  status?: AdsAutomationDecisionDraftApprovalStatus;
  action_type?: AdsAutomationDecisionDraftActionType;
  action_family?: AdsAutomationDecisionDraftFamily;
  provider?: AdsAutomationDecisionDraftPreview['provider'];
  accountId?: string;
  productId?: string;
  supplierId?: string;
}

export interface AdsAutomationDecisionDraftApprovalReadModelSafety {
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
}

export interface AdsAutomationDecisionDraftApprovalReadModelSummary {
  total_pending_approvals: number;
  pending_approvals_listed: number;
  provider_action_approvals: number;
  internal_task_approvals: number;
  monitoring_approvals: number;
}

export interface AdsAutomationDecisionDraftApprovalReadModelResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_queue.v1';
  generatedAt: string;
  query: AdsAutomationDecisionDraftApprovalReadModelQuery;
  safety: AdsAutomationDecisionDraftApprovalReadModelSafety;
  summary: AdsAutomationDecisionDraftApprovalReadModelSummary;
  pendingApprovals: AdsAutomationDecisionDraftPendingApprovalRecord[];
}

export interface AdsAutomationDecisionDraftApprovalReadRecordResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_record.v1';
  generatedAt: string;
  safety: AdsAutomationDecisionDraftApprovalReadModelSafety;
  pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord;
}

export type AdsAutomationDecisionDraftApprovalReadinessStatus =
  | 'ready_for_human_review'
  | 'blocked';

export type AdsAutomationDecisionDraftApprovalReadinessPrerequisiteStatus =
  | 'valid'
  | 'blocked';

export interface AdsAutomationDecisionDraftApprovalReadinessPrerequisite {
  key: string;
  status: AdsAutomationDecisionDraftApprovalReadinessPrerequisiteStatus;
  detail: string;
}

export interface AdsAutomationDecisionDraftApprovalReadinessSummary {
  readiness_status: AdsAutomationDecisionDraftApprovalReadinessStatus;
  approval_required: true;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  prerequisites_valid: number;
  prerequisites_blocked: number;
  blockers_count: number;
  next_required_action: 'human_review' | 'fix_blockers_before_review';
}

export interface AdsAutomationDecisionDraftApprovalReadinessResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_readiness.v1';
  generatedAt: string;
  safety: AdsAutomationDecisionDraftApprovalReadModelSafety;
  summary: AdsAutomationDecisionDraftApprovalReadinessSummary;
  prerequisites: AdsAutomationDecisionDraftApprovalReadinessPrerequisite[];
  blockers: string[];
  pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord;
}

export type AdsAutomationDecisionDraftApprovalDecisionAction =
  | 'approve'
  | 'reject';

export interface AdsAutomationDecisionDraftApprovalDecisionValidationInput {
  decision?: AdsAutomationDecisionDraftApprovalDecisionAction | string | null;
  reviewerUserId?: string | null;
  reviewerRole?: string | null;
  reason?: string | null;
  requestId?: string | null;
}

export type AdsAutomationDecisionDraftApprovalDecisionValidationStatus =
  | 'eligible_for_human_decision'
  | 'blocked';

export type AdsAutomationDecisionDraftApprovalDecisionValidationNextAction =
  | 'future_approve_endpoint'
  | 'future_reject_endpoint'
  | 'fix_blockers_before_decision';

export interface AdsAutomationDecisionDraftApprovalDecisionValidationSummary {
  validation_status: AdsAutomationDecisionDraftApprovalDecisionValidationStatus;
  proposed_decision: AdsAutomationDecisionDraftApprovalDecisionAction | 'invalid';
  approval_required: true;
  execution_allowed_now: false;
  status_change_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  prerequisites_valid: number;
  prerequisites_blocked: number;
  blockers_count: number;
  next_required_action: AdsAutomationDecisionDraftApprovalDecisionValidationNextAction;
}

export interface AdsAutomationDecisionDraftApprovalDecisionValidationProposedDecision {
  decision: AdsAutomationDecisionDraftApprovalDecisionAction | 'invalid';
  reviewerUserId: string | null;
  reviewerRole: string | null;
  reason: string | null;
  requestId: string | null;
  would_update_status_to: 'approved' | 'rejected' | null;
  status_change_performed: false;
}

export interface AdsAutomationDecisionDraftApprovalDecisionValidationResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_decision_validation.v1';
  generatedAt: string;
  safety: AdsAutomationDecisionDraftApprovalReadModelSafety;
  summary: AdsAutomationDecisionDraftApprovalDecisionValidationSummary;
  proposedDecision: AdsAutomationDecisionDraftApprovalDecisionValidationProposedDecision;
  prerequisites: AdsAutomationDecisionDraftApprovalReadinessPrerequisite[];
  blockers: string[];
  pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord;
}

export type AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewStatus =
  | 'ready_for_future_audit_persist'
  | 'blocked';

export interface AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewSafety
  extends AdsAutomationDecisionDraftApprovalReadModelSafety {
  audit_record_persisted: false;
  status_change_performed: false;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload {
  schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record.v1';
  audit_id: string;
  approval_id: string;
  source_draft_id: string;
  source_decision_id: string;
  action_type: AdsAutomationDecisionDraftActionType;
  action_family: AdsAutomationDecisionDraftFamily;
  provider: AdsAutomationDecisionDraftPreview['provider'];
  resource_type: AdsAutomationDecisionDraftPreview['resource_type'];
  entity_type: AdsAutomationDecisionDraftPreview['entity_type'];
  entity_id: string;
  accountId: string | null;
  productId: string | null;
  supplierId: string | null;
  platform: string | null;
  previous_status: AdsAutomationDecisionDraftApprovalStatus;
  proposed_status: 'approved' | 'rejected' | null;
  decision: AdsAutomationDecisionDraftApprovalDecisionAction | 'invalid';
  reviewerUserId: string | null;
  reviewerRole: string | null;
  reason: string | null;
  requestId: string | null;
  validation_status: AdsAutomationDecisionDraftApprovalDecisionValidationStatus;
  prerequisites_valid: number;
  prerequisites_blocked: number;
  blockers: string[];
  prerequisites: AdsAutomationDecisionDraftApprovalReadinessPrerequisite[];
  pending_approval_snapshot: AdsAutomationDecisionDraftPendingApprovalRecord;
  audit_record_persisted: false;
  status_change_performed: boolean;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  execution_allowed_now: false;
  createdAt: string;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditRecord
  extends Omit<AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload, 'audit_record_persisted'> {
  idempotency_key: string;
  audit_record_persisted: true;
  persistence_used: true;
  durable_storage_used: true;
  erp_local_persistence_used: true;
  provider_persistence_used: false;
  storage: AdsAutomationDecisionDraftApprovalStorage;
  source_preview_createdAt: string;
  persistedAt: string;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditIdentity {
  audit_id: string;
  idempotency_key: string;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditExistingIdentities {
  auditIds: Set<string>;
  idempotencyKeys: Set<string>;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditReadbackSafety
  extends AdsAutomationDecisionDraftApprovalReadModelSafety {
  audit_record_readback: true;
  status_change_performed: false;
  audit_persistence_performed: false;
  public_endpoint_added: false;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditReadbackQuery {
  audit_id?: string;
  approval_id?: string;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditReadbackSummary {
  readback_status: 'found' | 'not_found' | 'listed';
  audit_records_matched: number;
  approval_id_filter_applied: boolean;
  approval_required: true;
  execution_allowed_now: false;
  status_change_performed: false;
  audit_persistence_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  next_required_action: 'future_human_review' | 'inspect_approval_audit_history' | 'verify_audit_id';
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditRecordReadbackResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record_readback.v1';
  generatedAt: string;
  query: AdsAutomationDecisionDraftApprovalDecisionAuditReadbackQuery;
  safety: AdsAutomationDecisionDraftApprovalDecisionAuditReadbackSafety;
  summary: AdsAutomationDecisionDraftApprovalDecisionAuditReadbackSummary;
  auditRecord: AdsAutomationDecisionDraftApprovalDecisionAuditRecord | null;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditRecordHistoryResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record_history.v1';
  generatedAt: string;
  query: AdsAutomationDecisionDraftApprovalDecisionAuditReadbackQuery;
  safety: AdsAutomationDecisionDraftApprovalDecisionAuditReadbackSafety;
  summary: AdsAutomationDecisionDraftApprovalDecisionAuditReadbackSummary;
  auditRecords: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[];
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewSummary {
  audit_preview_status: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewStatus;
  proposed_decision: AdsAutomationDecisionDraftApprovalDecisionAction | 'invalid';
  approval_required: true;
  execution_allowed_now: false;
  audit_record_persisted: false;
  status_change_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  blockers_count: number;
  next_required_action: AdsAutomationDecisionDraftApprovalDecisionValidationNextAction;
}

export interface AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record_preview.v1';
  generatedAt: string;
  safety: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewSafety;
  summary: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewSummary;
  proposedDecision: AdsAutomationDecisionDraftApprovalDecisionValidationProposedDecision;
  decisionValidation: AdsAutomationDecisionDraftApprovalDecisionValidationResponse;
  auditRecordPreview: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload;
  pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord;
}

export type AdsAutomationDecisionDraftApprovalDecisionMutationStatus =
  | 'approved'
  | 'rejected'
  | 'blocked';

export type AdsAutomationDecisionDraftApprovalDecisionMutationNextAction =
  | 'future_validateOnly_before_execution'
  | 'decision_complete_no_execution'
  | 'fix_blockers_before_decision';

export interface AdsAutomationDecisionDraftApprovalDecisionMutationSafety
  extends Omit<AdsAutomationDecisionDraftApprovalReadModelSafety, 'read_only'> {
  read_only: false;
  audit_record_persisted: true;
  status_change_performed: boolean;
  approval_status_mutation_used: boolean;
  approved_record_executable: false;
  rejected_record_executable: false;
  duplicate_decision_rejected: true;
}

export interface AdsAutomationDecisionDraftApprovalDecisionMutationSummary {
  mutation_status: AdsAutomationDecisionDraftApprovalDecisionMutationStatus;
  proposed_decision: AdsAutomationDecisionDraftApprovalDecisionAction;
  validation_status: AdsAutomationDecisionDraftApprovalDecisionValidationStatus;
  previous_status: 'pending_approval';
  resulting_status: AdsAutomationDecisionDraftApprovalFinalDecisionStatus | null;
  approval_required: true;
  execution_allowed_now: false;
  audit_record_persisted: true;
  status_change_performed: boolean;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  blockers_count: number;
  next_required_action: AdsAutomationDecisionDraftApprovalDecisionMutationNextAction;
}

export interface AdsAutomationDecisionDraftApprovalDecisionMutationResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_decision_mutation.v1';
  generatedAt: string;
  safety: AdsAutomationDecisionDraftApprovalDecisionMutationSafety;
  summary: AdsAutomationDecisionDraftApprovalDecisionMutationSummary;
  decisionValidation: AdsAutomationDecisionDraftApprovalDecisionValidationResponse;
  auditRecord: AdsAutomationDecisionDraftApprovalDecisionAuditRecord;
  approvalBefore: AdsAutomationDecisionDraftPendingApprovalRecord;
  approvalAfter: AdsAutomationDecisionDraftPendingApprovalRecord | null;
}
