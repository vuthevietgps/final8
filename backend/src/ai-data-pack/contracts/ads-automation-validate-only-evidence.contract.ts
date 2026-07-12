import type { AdsAutomationDecisionDraftApprovalStorage } from './ads-automation-decision-draft-approval.contract';
import type { AdsAutomationProviderValidateOnlyActionPlan } from './ads-automation-provider-validate-only.contract';

export interface AdsAutomationValidateOnlyEvidenceInput extends AdsAutomationProviderValidateOnlyActionPlan {
  requestId?: string | null;
  requestedByUserId?: string | null;
  requestedByRole?: string | null;
}

export interface AdsAutomationValidateOnlyEvidenceRecord extends AdsAutomationProviderValidateOnlyActionPlan {
  schemaVersion: 'ads_automation_validate_only_evidence.v1';
  idempotency_key: string;
  validateOnly_evidence_persisted: true;
  future_live_execution_allowed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  direct_google_ads_api_call: false;
  provider_mutation_used: false;
  live_path_implemented: false;
  persistence_used: true;
  durable_storage_used: true;
  erp_local_persistence_used: true;
  provider_persistence_used: false;
  storage: AdsAutomationDecisionDraftApprovalStorage;
  requestedByUserId: string | null;
  requestedByRole: string | null;
  requestId: string | null;
  createdAt: string;
  persistedAt: string;
}

export interface AdsAutomationValidateOnlyEvidencePersistResult {
  records: AdsAutomationValidateOnlyEvidenceRecord[];
  created: number;
  reused: number;
}

export interface AdsAutomationValidateOnlyEvidenceReadbackSafety {
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
  validateOnly_evidence_readback: true;
  validateOnly_evidence_persistence_performed: false;
}

export interface AdsAutomationValidateOnlyEvidenceReadbackQuery {
  validation_id?: string;
  approval_id?: string;
}

export interface AdsAutomationValidateOnlyEvidenceReadbackSummary {
  readback_status: 'found' | 'not_found' | 'listed';
  validateOnly_evidence_records_matched: number;
  approval_id_filter_applied: boolean;
  approval_required: true;
  execution_allowed_now: false;
  validateOnly_evidence_persistence_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  next_required_action:
    | 'inspect_validateOnly_evidence'
    | 'inspect_approval_validateOnly_history'
    | 'verify_validation_id';
}

export interface AdsAutomationValidateOnlyEvidenceReadbackResponse {
  schemaVersion: 'ads_automation_validate_only_evidence_readback.v1';
  generatedAt: string;
  query: AdsAutomationValidateOnlyEvidenceReadbackQuery;
  safety: AdsAutomationValidateOnlyEvidenceReadbackSafety;
  summary: AdsAutomationValidateOnlyEvidenceReadbackSummary;
  validateOnlyEvidence: AdsAutomationValidateOnlyEvidenceRecord | null;
}

export interface AdsAutomationValidateOnlyEvidenceHistoryResponse {
  schemaVersion: 'ads_automation_validate_only_evidence_history.v1';
  generatedAt: string;
  query: AdsAutomationValidateOnlyEvidenceReadbackQuery;
  safety: AdsAutomationValidateOnlyEvidenceReadbackSafety;
  summary: AdsAutomationValidateOnlyEvidenceReadbackSummary;
  validateOnlyEvidenceRecords: AdsAutomationValidateOnlyEvidenceRecord[];
}
