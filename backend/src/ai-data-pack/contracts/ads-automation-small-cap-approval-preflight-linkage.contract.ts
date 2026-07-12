import type {
  AdsAutomationApprovalEvidenceIndexResponse,
} from './ads-automation-approval-evidence-index.contract';
import type {
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './ads-automation-decision-draft-approval.contract';
import type {
  AdsAutomationExecutionPreflightDryRunRecord,
} from './ads-automation-execution-preflight-dry-run.contract';
import type {
  AdsAutomationPolicyDecisionEvidenceRecord,
} from './ads-automation-policy-decision-evidence.contract';
import type {
  AdsAutomationSmallCapBudgetCandidate,
  AdsAutomationSmallCapReadinessSimulatorResponse,
} from './ads-automation-small-cap-readiness-simulator.contract';
import type {
  AdsAutomationValidateOnlyEvidenceRecord,
} from './ads-automation-validate-only-evidence.contract';

export type AdsAutomationSmallCapApprovalPreflightLinkageFixtureMode =
  | 'htx_ads_small_cap_approval_preflight_linkage_demo'
  | 'custom_local_payload';

export type AdsAutomationSmallCapApprovalPreflightLinkageStatus =
  | 'linked_blocked_before_execution'
  | 'blocked_missing_evidence'
  | 'blocked_campaignBudgetId_mismatch'
  | 'blocked_no_small_cap_candidate';

export type AdsAutomationSmallCapApprovalPreflightCandidateLinkStatus =
  | 'linked_blocked_before_execution'
  | 'linked_missing_preflight_evidence'
  | 'linked_missing_validateOnly_evidence'
  | 'linked_missing_policy_evidence'
  | 'linked_campaignBudgetId_mismatch'
  | 'not_linked_to_approval_evidence';

export interface AdsAutomationSmallCapApprovalPreflightLinkageInput {
  reportDate?: string;
  now?: string | Date;
  fixtureMode?: AdsAutomationSmallCapApprovalPreflightLinkageFixtureMode;
  simulatorResponse: AdsAutomationSmallCapReadinessSimulatorResponse;
  approvalEvidenceIndexes?: AdsAutomationApprovalEvidenceIndexResponse[];
}

export interface AdsAutomationSmallCapApprovalPreflightLinkageSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
  persistence_used: false;
  durable_storage_used: false;
  erp_local_persistence_used: false;
  provider_persistence_used: false;
  approval_evidence_readback_reused: true;
  validateOnly_evidence_readback_reused: true;
  policy_decision_evidence_readback_reused: true;
  execution_preflight_readback_reused: true;
  linkage_persistence_performed: false;
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
  approval_required_for_all_drafts: true;
  future_provider_validateOnly_required_before_execution: true;
  future_live_execution_allowed: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  execution_allowed_now: false;
  production_ready: false;
  erp_only_future_validator_approver_executor: true;
}

export interface AdsAutomationSmallCapApprovalPreflightCandidateEvidenceCounts {
  validateOnly_evidence_records: number;
  policy_decision_records: number;
  execution_preflight_records: number;
  linked_validateOnly_ids: string[];
  linked_policy_decision_ids: string[];
  linked_execution_record_ids: string[];
}

export interface AdsAutomationSmallCapApprovalPreflightCandidateLink {
  candidateKey: string;
  draft_id: string;
  source_decision_id: string;
  approval_id: string | null;
  status: AdsAutomationSmallCapApprovalPreflightCandidateLinkStatus;
  approval_status: AdsAutomationDecisionDraftPendingApprovalRecord['status'] | null;
  action_type: AdsAutomationDecisionDraftPendingApprovalRecord['action_type'] | null;
  action_family: AdsAutomationDecisionDraftPendingApprovalRecord['action_family'] | null;
  provider: AdsAutomationDecisionDraftPendingApprovalRecord['provider'] | null;
  accountId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  approvalCampaignBudgetId: string | null;
  campaignBudgetIdMatched: boolean;
  campaignBudgetIdNoFallback: true;
  requestedIncreaseVnd: number;
  simulatedCappedIncreaseVnd: number;
  approvedIncreaseVnd: 0;
  blockedIncreaseVnd: number;
  validateOnly_statuses: string[];
  policy_allowed: boolean | null;
  preflight_statuses: string[];
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  evidenceCounts: AdsAutomationSmallCapApprovalPreflightCandidateEvidenceCounts;
  blockers: string[];
  next_required_action:
    | 'review_linked_preflight_packet'
    | 'attach_missing_validateOnly_policy_or_preflight_evidence'
    | 'resolve_campaignBudgetId_linkage'
    | 'link_pending_approval_to_simulator_candidate';
  simulatorCandidate: AdsAutomationSmallCapBudgetCandidate;
  pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null;
  validateOnlyEvidenceRecords: AdsAutomationValidateOnlyEvidenceRecord[];
  policyDecisionEvidenceRecords: AdsAutomationPolicyDecisionEvidenceRecord[];
  executionPreflightDryRunRecords: AdsAutomationExecutionPreflightDryRunRecord[];
}

export interface AdsAutomationSmallCapApprovalPreflightLinkageSummary {
  status: AdsAutomationSmallCapApprovalPreflightLinkageStatus;
  fixture_mode: AdsAutomationSmallCapApprovalPreflightLinkageFixtureMode;
  reportDate: string;
  simulator_status: AdsAutomationSmallCapReadinessSimulatorResponse['summary']['status'];
  small_cap_candidates: number;
  approval_evidence_indexes_received: number;
  candidates_with_approval_link: number;
  candidates_with_validateOnly_evidence: number;
  candidates_with_policy_evidence: number;
  candidates_with_preflight_evidence: number;
  fully_linked_candidates: number;
  missing_evidence_candidates: number;
  campaignBudgetId_mismatch_candidates: number;
  requested_increase_vnd: number;
  simulated_capped_increase_vnd: number;
  approved_increase_vnd: 0;
  blocked_increase_vnd: number;
  executable_now: 0;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | 'review_linked_small_cap_dry_run_packet'
    | 'attach_missing_approval_validateOnly_policy_preflight_evidence'
    | 'resolve_campaignBudgetId_linkage_before_preflight';
}

export interface AdsAutomationSmallCapApprovalPreflightSourceDigest {
  simulator_schema_version: AdsAutomationSmallCapReadinessSimulatorResponse['schemaVersion'];
  approval_evidence_index_schema_versions: string[];
  simulator_generated_at: string;
  simulator_report_date: string;
  approval_ids: string[];
  validateOnly_validation_ids: string[];
  policy_decision_ids: string[];
  execution_record_ids: string[];
  decision_snapshot_reused: boolean;
  draft_preview_reused: boolean;
  approval_evidence_index_reused: true;
  validateOnly_evidence_readback_reused: true;
  policy_decision_evidence_readback_reused: true;
  execution_preflight_readback_reused: true;
}

export interface AdsAutomationSmallCapApprovalPreflightLinkageResponse {
  schemaVersion: 'ads_automation_small_cap_approval_preflight_linkage.v1';
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationSmallCapApprovalPreflightLinkageSafety;
  summary: AdsAutomationSmallCapApprovalPreflightLinkageSummary;
  sourceDigest: AdsAutomationSmallCapApprovalPreflightSourceDigest;
  candidateLinks: AdsAutomationSmallCapApprovalPreflightCandidateLink[];
  unlinkedApprovalEvidenceIndexes: AdsAutomationApprovalEvidenceIndexResponse[];
  blockers: string[];
  markdownPreview: string;
}
