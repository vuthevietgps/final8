import type {
  AdsAutomationCategoryKey,
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
  AdsAutomationEvidenceWindow,
} from './ads-automation-decision.contract';
import type {
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelQueryEvidence,
} from './ads-automation-decision-read-model-query.contract';
import type {
  AdsAutomationDecisionMissingFieldEvidence,
  AdsAutomationDecisionSourceEvidence,
} from './ads-automation-decision-source-adapter.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from '../source-sync/source-sync-result.types';

export type AdsAutomationDecisionDraftActionType =
  | 'update_campaign_budget'
  | 'pause_ad_group'
  | 'pause_campaign'
  | 'monitor_only'
  | 'supplier_sourcing'
  | 'product_offer_fix'
  | 'stop_import_review';

export type AdsAutomationDecisionDraftStatus =
  | 'pending_approval_preview'
  | 'blocked_missing_data';

export type AdsAutomationDecisionDraftFamily =
  | 'provider_google_ads'
  | 'internal_task'
  | 'monitoring';

export interface AdsAutomationDecisionDraftEvidenceReference {
  decision_id: string;
  decision_type: AdsAutomationCategoryKey;
  evidence_window: AdsAutomationEvidenceWindow;
  evidence_metrics: Record<string, unknown>;
  rationale: string;
  idempotency_key: string | null;
  rollback_plan: string | null;
}

export interface AdsAutomationDecisionDraftPreview {
  draft_id: string;
  source_decision_id: string;
  source_decision_type: AdsAutomationCategoryKey;
  action_type: AdsAutomationDecisionDraftActionType;
  action_family: AdsAutomationDecisionDraftFamily;
  provider: 'google' | 'erp_internal' | 'none';
  resource_type: 'campaign_budget' | 'campaign' | 'ad_group' | 'product' | 'supplier' | 'monitoring';
  entity_type: AdsAutomationDecisionItem['entity_type'];
  entity_id: string;
  platform: string | null;
  accountId: string | null;
  productId: string | null;
  supplierId: string | null;
  status: AdsAutomationDecisionDraftStatus;
  approval_required: true;
  execution_allowed_now: false;
  validate_only_required: boolean;
  future_provider_validateOnly_required: boolean;
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
  persistence_used: false;
  typedPayload: Record<string, unknown>;
  source_evidence_references: AdsAutomationDecisionDraftEvidenceReference[];
  blockers: string[];
  missing_data_blockers: string[];
  disallowed_actions: string[];
  idempotency_key: string;
  rationale: string;
}

export interface AdsAutomationDecisionDraftPreviewSafety {
  read_only: true;
  dry_run: true;
  persistence_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
  approval_required_for_all_drafts: true;
  execution_allowed_now: false;
  future_provider_validateOnly_required: true;
}

export interface AdsAutomationDecisionDraftPreviewSummary {
  decisions_scanned: number;
  drafts_created: number;
  blocked_drafts: number;
  provider_action_drafts: number;
  internal_task_drafts: number;
  monitoring_drafts: number;
}

export interface AdsAutomationDecisionDraftPreviewResponse {
  schemaVersion: 'ads_automation_decision_draft_preview.v1';
  generatedAt: string;
  source: 'decision_snapshot' | 'mongo_read_model';
  query?: AdsAutomationDecisionReadModelQuery;
  safety: AdsAutomationDecisionDraftPreviewSafety;
  sourceEvidence: AdsAutomationDecisionSourceEvidence[];
  sourceSyncDecisionEvidence?: SourceSyncDecisionEvidence[];
  sourceSyncDecisionGates?: Partial<SourceSyncDecisionGates>;
  missingFieldEvidence: AdsAutomationDecisionMissingFieldEvidence[];
  queryEvidence: AdsAutomationDecisionReadModelQueryEvidence[];
  snapshot: Pick<AdsAutomationDecisionSnapshot, 'schemaVersion' | 'generatedAt' | 'snapshotDate' | 'summary'>;
  summary: AdsAutomationDecisionDraftPreviewSummary;
  drafts: AdsAutomationDecisionDraftPreview[];
}
