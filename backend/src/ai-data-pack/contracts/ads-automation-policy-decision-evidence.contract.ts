import type { AdsAutomationDecisionDraftApprovalStorage } from './ads-automation-decision-draft-approval.contract';

export interface AdsAutomationPolicyDecisionEvidenceInput {
  policy_decision_id?: string | null;
  approval_id: string;
  policy_allowed: boolean;
  policy_source?: string | null;
  blockers?: string[];
  evaluatedAt?: string | null;
  requestId?: string | null;
  requestedByUserId?: string | null;
  requestedByRole?: string | null;
}

export interface AdsAutomationPolicyDecisionEvidenceRecord {
  schemaVersion: 'ads_automation_execution_policy_decision_evidence.v1';
  policy_decision_id: string;
  idempotency_key: string;
  approval_id: string;
  policy_allowed: boolean;
  policy_source: string | null;
  blockers: string[];
  evaluatedAt: string | null;
  policy_decision_record_persisted: true;
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

export interface AdsAutomationPolicyDecisionEvidencePersistResult {
  records: AdsAutomationPolicyDecisionEvidenceRecord[];
  created: number;
  reused: number;
}

export interface AdsAutomationPolicyDecisionEvidenceReadbackSafety {
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
  policy_decision_evidence_readback: true;
  policy_decision_evidence_persistence_performed: false;
}

export interface AdsAutomationPolicyDecisionEvidenceReadbackQuery {
  policy_decision_id?: string;
  approval_id?: string;
}

export interface AdsAutomationPolicyDecisionEvidenceReadbackSummary {
  readback_status: 'found' | 'not_found' | 'listed';
  policy_decision_records_matched: number;
  approval_id_filter_applied: boolean;
  approval_required: true;
  execution_allowed_now: false;
  policy_decision_evidence_persistence_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  next_required_action:
    | 'inspect_policy_decision_evidence'
    | 'inspect_approval_policy_decision_history'
    | 'verify_policy_decision_id';
}

export interface AdsAutomationPolicyDecisionEvidenceReadbackResponse {
  schemaVersion: 'ads_automation_execution_policy_decision_evidence_readback.v1';
  generatedAt: string;
  query: AdsAutomationPolicyDecisionEvidenceReadbackQuery;
  safety: AdsAutomationPolicyDecisionEvidenceReadbackSafety;
  summary: AdsAutomationPolicyDecisionEvidenceReadbackSummary;
  policyDecisionEvidence: AdsAutomationPolicyDecisionEvidenceRecord | null;
}

export interface AdsAutomationPolicyDecisionEvidenceHistoryResponse {
  schemaVersion: 'ads_automation_execution_policy_decision_evidence_history.v1';
  generatedAt: string;
  query: AdsAutomationPolicyDecisionEvidenceReadbackQuery;
  safety: AdsAutomationPolicyDecisionEvidenceReadbackSafety;
  summary: AdsAutomationPolicyDecisionEvidenceReadbackSummary;
  policyDecisionEvidenceRecords: AdsAutomationPolicyDecisionEvidenceRecord[];
}
