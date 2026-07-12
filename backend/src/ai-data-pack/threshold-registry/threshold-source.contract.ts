import { ConfidenceLevel, DataQualityStatus } from '../contracts/metadata.contract';

export const APPROVED_OPERATIONAL_RISK_FINDINGS = [
  'low_inventory_best_seller',
  'supplier_cost_up',
  'overdue_dealer_receivables',
  'labor_overtime_high',
  'slow_supplier_good_cost',
] as const;

export type OperationalRiskFindingKey = (typeof APPROVED_OPERATIONAL_RISK_FINDINGS)[number];

export const THRESHOLD_FALLBACK_BEHAVIORS = [
  'no_row',
  'emit_with_downgrade',
  'use_documented_default',
] as const;

export type ThresholdFallbackBehavior = (typeof THRESHOLD_FALLBACK_BEHAVIORS)[number];

export const THRESHOLD_APPROVAL_STATUSES = [
  'approved',
  'draft',
  'deprecated',
  'unknown',
  'not_applicable',
] as const;

export type ThresholdApprovalStatus = (typeof THRESHOLD_APPROVAL_STATUSES)[number];

export type ThresholdSourceType =
  | 'schema_field'
  | 'derived_candidate'
  | 'repo_config'
  | 'manual_policy'
  | 'future_registry';

export type ThresholdValueType =
  | 'number'
  | 'percent'
  | 'days'
  | 'hours'
  | 'date'
  | 'status_set'
  | 'formula'
  | 'enum'
  | 'text';

export interface ThresholdSourceRecord {
  threshold_key: string;
  finding_key: OperationalRiskFindingKey;
  business_owner: string;
  source_type: ThresholdSourceType;
  source_module_or_collection: string;
  field_path_or_config_key: string;
  value_type: ThresholdValueType;
  unit: string;
  value: unknown;
  default_allowed: boolean;
  effective_from: string | null;
  effective_to: string | null;
  approval_status: ThresholdApprovalStatus;
  last_reviewed_at: string | null;
  data_quality_status_impact: DataQualityStatus;
  confidence_impact: ConfidenceLevel | 'medium_ceiling' | 'low_ceiling' | 'no_high_confidence';
  fallback_behavior: ThresholdFallbackBehavior;
  not_allowed_actions: string;
  semantic_notes?: string[];
}

export interface ResolveThresholdInput {
  findingKey: OperationalRiskFindingKey;
  thresholdKey: string;
  asOfDate?: Date | string;
  fallbackBehavior?: ThresholdFallbackBehavior;
  defaultValue?: unknown;
  defaultUnit?: string;
}

export interface ResolvedThresholdMetadata {
  threshold_source_key: string;
  threshold_source_type: string;
  threshold_source_version_or_effective_date: string | null;
  threshold_source_approval_status: ThresholdApprovalStatus | 'missing';
  threshold_source_owner: string | null;
  threshold_source_default_used: boolean;
  threshold_value: unknown;
  threshold_unit: string | null;
  data_quality_reason: string;
  confidence_reason: string;
  missing_or_weak_fields: string[];
  semantic_notes: string[];
  should_emit_row: boolean;
}

export interface ResolveManyThresholdsInput {
  findingKey: OperationalRiskFindingKey;
  thresholdKeys: readonly string[];
  asOfDate?: Date | string;
}

export interface ResolvedThresholdSummary {
  threshold_source_key: string;
  threshold_source_type: string;
  threshold_source_version_or_effective_date: string;
  threshold_source_approval_status: string;
  threshold_source_owner: string;
  threshold_source_default_used: boolean;
  threshold_unit: string;
  data_quality_reason: string;
  confidence_reason: string;
  missing_or_weak_fields: string[];
  semantic_notes: string[];
  should_emit_row: boolean;
}

