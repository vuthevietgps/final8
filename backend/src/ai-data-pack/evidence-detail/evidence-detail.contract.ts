import type { SourceFreshnessMetadata } from '../source-freshness/source-freshness.contract';
import type { OperationalRiskFindingKey } from '../threshold-registry/threshold-source.contract';

export type EvidenceScalar = string | number | boolean | null;
export type EvidenceSerializable = EvidenceScalar | EvidenceScalar[] | Record<string, EvidenceScalar | EvidenceScalar[]>;

export interface EvidenceEntity {
  entity_id: string | null;
  entity_name_or_alias: string | null;
  entity_type: string;
}

export interface EvidenceTimeWindow {
  label: string | null;
  comparison_window_from: string | null;
  comparison_window_to: string | null;
}

export interface EvidenceThresholdComparison {
  metric_name: string | null;
  metric_value: EvidenceSerializable;
  threshold_value: EvidenceSerializable;
  threshold_source_key: string | null;
  threshold_unit: string | null;
  comparison_operator: string | null;
  comparison_result: string | null;
}

export interface EvidenceCalculationStep {
  step_key: string;
  description: string;
  input_fields: string[];
  output_field: string | null;
  output_value: EvidenceSerializable;
}

export interface EvidenceDrilldownRef {
  source_collection: string;
  source_row_id: string;
  drilldown_ref: string;
  read_only: true;
}

export interface EvidenceRow {
  entity_id: string | null;
  entity_name_or_alias: string | null;
  entity_type: string;
  source_module: string;
  source_collection: string;
  source_row_id: string;
  source_field_names: string[];
  raw_values_used: Record<string, EvidenceSerializable>;
  normalized_values_used: Record<string, EvidenceSerializable>;
  timestamp: string | null;
  comparison_window_from: string | null;
  comparison_window_to: string | null;
  threshold_used: EvidenceSerializable;
  threshold_source_key: string | null;
  calculation_result: EvidenceSerializable;
  calculation_step_ref: string | null;
  reason_row_was_emitted: string;
  reason_confidence_was_capped: string | null;
  reason_action_is_blocked: string;
  drilldown_ref: string;
}

export interface EvidenceSourceGroup {
  source_module: string;
  source_collection: string;
  entity_type: string;
  rows: readonly unknown[];
  source_field_names: readonly string[];
  timestamp_fields?: readonly string[];
  entity_name_fields?: readonly string[];
}

export interface BuildEvidenceDetailInput {
  finding_key: OperationalRiskFindingKey;
  row: Record<string, unknown>;
  source_rows: readonly EvidenceSourceGroup[];
  evidence_entities?: readonly EvidenceEntity[];
  evidence_time_window?: EvidenceTimeWindow;
  evidence_direct_fields?: readonly string[];
  evidence_derived_fields?: readonly string[];
  evidence_calculation_steps?: readonly EvidenceCalculationStep[];
  evidence_threshold_comparison?: EvidenceThresholdComparison;
  evidence_source_freshness?: Partial<SourceFreshnessMetadata>;
  evidence_missing_fields?: readonly string[];
  evidence_verification_fields?: readonly string[];
  evidence_sample_limit?: number;
  recommended_manual_owner?: string;
  manual_review_question?: string;
  reason_row_was_emitted?: string;
  reason_confidence_was_capped?: string | null;
  reason_action_is_blocked?: string;
}

export interface EvidenceDetailResult {
  evidence_summary: string;
  evidence_rows: EvidenceRow[];
  evidence_row_count: number;
  evidence_sample_limit: number;
  evidence_entities: EvidenceEntity[];
  evidence_time_window: EvidenceTimeWindow;
  evidence_direct_fields: string[];
  evidence_derived_fields: string[];
  evidence_calculation_steps: EvidenceCalculationStep[];
  evidence_threshold_comparison: EvidenceThresholdComparison;
  evidence_source_freshness: Partial<SourceFreshnessMetadata>;
  evidence_missing_fields: string[];
  evidence_verification_fields: string[];
  evidence_drilldown_refs: EvidenceDrilldownRef[];
  recommended_manual_owner: string;
  manual_review_question: string;
  blocked_actions_summary: string;
  top_evidence_entities: string;
  evidence_missing_fields_summary: string;
  evidence_drilldown_refs_summary: string;
}
