import type {
  AdsAutomationCategoryKey,
  AdsAutomationConfidence,
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
  AdsAutomationDecisionSnapshotInput,
  AdsAutomationDecisionStatus,
  AdsAutomationEvidenceWindow,
  AdsAutomationRiskLevel,
} from './ads-automation-decision.contract';
import type {
  AdsAutomationDecisionMissingFieldEvidence,
  AdsAutomationDecisionSourceEvidence,
} from './ads-automation-decision-source-adapter.contract';
import type {
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelQueryEvidence,
} from './ads-automation-decision-read-model-query.contract';

export type AdsAutomationDecisionFoundationSnapshotInput = AdsAutomationDecisionSnapshotInput;

export type AdsAutomationScaleAdsDecision = 'increase' | 'hold' | 'blocked' | 'needs_review' | 'insufficient_data';

export interface AdsAutomationDecisionFoundationSnapshotSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  production_ready: false;
  approval_required_for_future_actions: true;
  execution_allowed_now: false;
  future_provider_validateOnly_required_before_execution: true;
}

export interface AdsAutomationDecisionFoundationSnapshotItem {
  rank: number;
  decision_id: string;
  decision_type: AdsAutomationCategoryKey;
  entity_type: AdsAutomationDecisionItem['entity_type'];
  entity_id: string;
  platform: string | null;
  accountId: string | null;
  productId: string | null;
  supplierId: string | null;
  status: AdsAutomationDecisionStatus;
  currentValue: Record<string, unknown> | null;
  proposedValue: Record<string, unknown> | null;
  evidence_window: AdsAutomationEvidenceWindow;
  evidence_metrics: Record<string, unknown>;
  data_quality_score: number;
  confidence: AdsAutomationConfidence;
  risk_level: AdsAutomationRiskLevel;
  blockers: string[];
  missing_fields: string[];
  next_required_data: string[];
  approval_required: boolean;
  execution_allowed_now: false;
  evidence_link_id: string;
  rationale: string;
}

export interface AdsAutomationDecisionFoundationEvidenceLink {
  evidence_link_id: string;
  decision_id: string;
  decision_type: AdsAutomationCategoryKey;
  entity_type: AdsAutomationDecisionItem['entity_type'];
  entity_id: string;
  productId: string | null;
  supplierId: string | null;
  evidence_window: AdsAutomationEvidenceWindow;
  evidence_metrics: Record<string, unknown>;
  rationale: string;
  idempotency_key: string | null;
  rollback_plan: string | null;
}

export interface AdsAutomationDecisionFoundationCategorySummary {
  status: AdsAutomationDecisionStatus;
  candidate_count: number;
  blockers: string[];
  missing_fields: string[];
  next_required_data: string[];
}

export interface AdsAutomationDecisionFoundationScaleAdsDecision
  extends AdsAutomationDecisionFoundationCategorySummary {
  decision: AdsAutomationScaleAdsDecision;
  candidates: AdsAutomationDecisionFoundationSnapshotItem[];
}

export interface AdsAutomationDecisionFoundationScaleAmount
  extends AdsAutomationDecisionFoundationCategorySummary {
  total_increase_vnd: number;
  items: AdsAutomationDecisionFoundationSnapshotItem[];
}

export interface AdsAutomationDecisionFoundationTargetAdGroups
  extends AdsAutomationDecisionFoundationCategorySummary {
  items: AdsAutomationDecisionFoundationSnapshotItem[];
}

export interface AdsAutomationDecisionFoundationProductBudgetAllocation
  extends AdsAutomationDecisionFoundationCategorySummary {
  items: AdsAutomationDecisionFoundationSnapshotItem[];
}

export interface AdsAutomationDecisionFoundationSupplierGate
  extends AdsAutomationDecisionFoundationCategorySummary {
  safe_suppliers: AdsAutomationDecisionFoundationSnapshotItem[];
  review_suppliers: AdsAutomationDecisionFoundationSnapshotItem[];
}

export interface AdsAutomationDecisionFoundationProductKillReview
  extends AdsAutomationDecisionFoundationCategorySummary {
  candidates: AdsAutomationDecisionFoundationSnapshotItem[];
  product_delete_allowed: false;
}

export interface AdsAutomationDecisionFoundationPauseCandidates
  extends AdsAutomationDecisionFoundationCategorySummary {
  candidates: AdsAutomationDecisionFoundationSnapshotItem[];
}

export interface AdsAutomationDecisionFoundationBlockers {
  global: string[];
  by_category: Record<AdsAutomationCategoryKey, string[]>;
  missing_fields: string[];
}

export interface AdsAutomationDecisionFoundationSnapshotResponse {
  schemaVersion: 'ads_automation_decision_foundation_snapshot.v1';
  generatedAt: string;
  snapshotDate: string;
  source_snapshot_schema_version: AdsAutomationDecisionSnapshot['schemaVersion'];
  safety: AdsAutomationDecisionFoundationSnapshotSafety;
  summary: AdsAutomationDecisionSnapshot['summary'] & {
    evidence_links: number;
    explicit_ba_fields_present: true;
  };
  scale_ads_decision: AdsAutomationDecisionFoundationScaleAdsDecision;
  scale_amount: AdsAutomationDecisionFoundationScaleAmount;
  target_ad_groups: AdsAutomationDecisionFoundationTargetAdGroups;
  product_budget_allocation: AdsAutomationDecisionFoundationProductBudgetAllocation;
  supplier_gate: AdsAutomationDecisionFoundationSupplierGate;
  product_kill_review: AdsAutomationDecisionFoundationProductKillReview;
  campaign_or_ad_group_pause_candidates: AdsAutomationDecisionFoundationPauseCandidates;
  blockers: AdsAutomationDecisionFoundationBlockers;
  evidence_links: AdsAutomationDecisionFoundationEvidenceLink[];
}

export interface AdsAutomationDecisionFoundationReadModelSnapshotResponse
  extends AdsAutomationDecisionFoundationSnapshotResponse {
  source: 'mongo_read_model';
  query: AdsAutomationDecisionReadModelQuery;
  sourceEvidence: AdsAutomationDecisionSourceEvidence[];
  missingFieldEvidence: AdsAutomationDecisionMissingFieldEvidence[];
  queryEvidence: AdsAutomationDecisionReadModelQueryEvidence[];
}

export type AdsAutomationDecisionFoundationReadModelReviewExportMode = 'local_readback';

export type AdsAutomationDecisionFoundationReadModelReviewExportStatus =
  | 'ready_for_review'
  | 'needs_attention'
  | 'empty';

export interface AdsAutomationDecisionFoundationReadModelReviewExportSafety
  extends AdsAutomationDecisionFoundationSnapshotSafety {
  repository_read_only: true;
  read_model_query_used: true;
  foundation_snapshot_reused: true;
  provider_mutation_used: false;
  direct_google_ads_api_call: false;
  future_live_execution_allowed: false;
  live_path_implemented: false;
  reviewer_export_readback: true;
  reviewer_export_persistence_performed: false;
  campaignBudgetId_fallback_used: false;
}

export interface AdsAutomationDecisionFoundationReadModelReviewExportSummary {
  export_status: AdsAutomationDecisionFoundationReadModelReviewExportStatus;
  export_mode: AdsAutomationDecisionFoundationReadModelReviewExportMode;
  foundation_snapshot_schema_version: AdsAutomationDecisionFoundationReadModelSnapshotResponse['schemaVersion'];
  source_snapshot_schema_version: AdsAutomationDecisionFoundationReadModelSnapshotResponse['source_snapshot_schema_version'];
  read_model_source: AdsAutomationDecisionFoundationReadModelSnapshotResponse['source'];
  source_evidence_records: number;
  stale_source_evidence_records: number;
  missing_source_evidence_records: number;
  missing_field_evidence_records: number;
  query_evidence_records: number;
  loaded_query_evidence_records: number;
  missing_query_evidence_records: number;
  ba_field_sections_rendered: number;
  scale_ads_decision: AdsAutomationScaleAdsDecision;
  scale_candidates: number;
  total_increase_vnd: number;
  target_ad_group_candidates: number;
  product_budget_allocation_candidates: number;
  safe_supplier_candidates: number;
  review_supplier_candidates: number;
  product_kill_review_candidates: number;
  pause_candidates: number;
  blocker_count: number;
  missing_blocker_fields: number;
  campaignBudgetId_required: true;
  campaignBudgetId_fallback_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action: 'inspect_foundation_review_export' | 'resolve_missing_read_model_evidence';
}

export interface AdsAutomationDecisionFoundationReadModelReviewRouteExample {
  label: string;
  method: 'POST';
  path: string;
  purpose: string;
  provider_api_called: false;
  erp_mutation_used: false;
}

export interface AdsAutomationDecisionFoundationReadModelReviewSection {
  section_id: string;
  title: string;
  status: 'empty' | 'ready_for_review' | 'passed' | 'attention';
  lines: string[];
  evidence_record_ids: string[];
}

export interface AdsAutomationDecisionFoundationReadModelReviewExportResponse {
  schemaVersion: 'ads_automation_decision_foundation_read_model_review_export.v1';
  generatedAt: string;
  exportMode: AdsAutomationDecisionFoundationReadModelReviewExportMode;
  query: AdsAutomationDecisionReadModelQuery;
  safety: AdsAutomationDecisionFoundationReadModelReviewExportSafety;
  summary: AdsAutomationDecisionFoundationReadModelReviewExportSummary;
  routeExamples: AdsAutomationDecisionFoundationReadModelReviewRouteExample[];
  renderedSections: AdsAutomationDecisionFoundationReadModelReviewSection[];
  markdownPreview: string;
  foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse;
}

export type AdsAutomationDecisionFoundationReadModelReviewerDocsMode = 'local_readback_docs';

export interface AdsAutomationDecisionFoundationReadModelReviewerDocsSafety
  extends AdsAutomationDecisionFoundationReadModelReviewExportSafety {
  source_review_export_reused: true;
  reviewer_docs_readback: true;
  reviewer_docs_persistence_performed: false;
  full_foundation_snapshot_payload_included: false;
}

export interface AdsAutomationDecisionFoundationReadModelReviewerDocsSummary {
  docs_status: AdsAutomationDecisionFoundationReadModelReviewExportStatus;
  docs_mode: AdsAutomationDecisionFoundationReadModelReviewerDocsMode;
  source_export_mode: AdsAutomationDecisionFoundationReadModelReviewExportMode;
  source_export_schema_version: AdsAutomationDecisionFoundationReadModelReviewExportResponse['schemaVersion'];
  source_foundation_snapshot_schema_version: AdsAutomationDecisionFoundationReadModelSnapshotResponse['schemaVersion'];
  read_model_source: AdsAutomationDecisionFoundationReadModelSnapshotResponse['source'];
  rendered_sections: number;
  attention_sections: number;
  attention_section_ids: string[];
  source_evidence_records_rendered: number;
  stale_source_evidence_records: number;
  missing_source_evidence_records: number;
  missing_field_evidence_records: number;
  query_evidence_records_rendered: number;
  missing_query_evidence_records: number;
  campaignBudgetId_required: true;
  campaignBudgetId_fallback_used: false;
  full_foundation_snapshot_payload_included: false;
  source_review_export_reused: true;
  reviewer_docs_persistence_performed: false;
  reviewer_export_persistence_performed: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action: 'inspect_foundation_reviewer_docs' | 'resolve_missing_read_model_evidence';
}

export interface AdsAutomationDecisionFoundationReadModelReviewerDocsRouteExample {
  label: string;
  method: 'POST';
  path: string;
  purpose: string;
  provider_api_called: false;
  erp_mutation_used: false;
}

export interface AdsAutomationDecisionFoundationReadModelReviewerDocsSourceExportDigest {
  schemaVersion: AdsAutomationDecisionFoundationReadModelReviewExportResponse['schemaVersion'];
  generatedAt: string;
  exportMode: AdsAutomationDecisionFoundationReadModelReviewExportMode;
  review_export_route: string;
  foundation_snapshot_schema_version: AdsAutomationDecisionFoundationReadModelSnapshotResponse['schemaVersion'];
  read_model_source: AdsAutomationDecisionFoundationReadModelSnapshotResponse['source'];
  summary: AdsAutomationDecisionFoundationReadModelReviewExportSummary;
  rendered_section_ids: string[];
  evidence_record_ids: string[];
  omitted_payloads: ['foundationSnapshot'];
  full_foundation_snapshot_payload_included: false;
}

export interface AdsAutomationDecisionFoundationReadModelReviewerDocsResponse {
  schemaVersion: 'ads_automation_decision_foundation_read_model_reviewer_docs.v1';
  generatedAt: string;
  docsMode: AdsAutomationDecisionFoundationReadModelReviewerDocsMode;
  query: AdsAutomationDecisionReadModelQuery;
  safety: AdsAutomationDecisionFoundationReadModelReviewerDocsSafety;
  summary: AdsAutomationDecisionFoundationReadModelReviewerDocsSummary;
  routeExamples: AdsAutomationDecisionFoundationReadModelReviewerDocsRouteExample[];
  renderedSections: AdsAutomationDecisionFoundationReadModelReviewSection[];
  markdownPreview: string;
  sourceExportDigest: AdsAutomationDecisionFoundationReadModelReviewerDocsSourceExportDigest;
}
