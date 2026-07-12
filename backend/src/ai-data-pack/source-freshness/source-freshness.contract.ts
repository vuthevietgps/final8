import type { ConfidenceLevel, DataQualityStatus } from '../contracts/metadata.contract';
import type { FreshnessStatus } from '../source-registry/source-registry.types';
import type { OperationalRiskFindingKey } from '../threshold-registry/threshold-source.contract';

export type SourceFreshnessStatus = FreshnessStatus;

export interface SourceTimestampWindow {
  source_window_from: string | null;
  source_window_to: string | null;
}

export interface SourceMetadataPart {
  rows: readonly unknown[];
  timestampFields: readonly string[];
  recordCount?: number;
  sampleSize?: number;
  missingReason?: string | null;
  stalenessReason?: string | null;
  coveragePercent?: number | null;
}

export interface SourceLineageDefinition {
  findingKey: OperationalRiskFindingKey;
  modules: readonly string[];
  collections: readonly string[];
  fields: readonly string[];
  method: string;
  isDerivedCandidate: boolean;
  derivationNotes: readonly string[];
}

export interface SourceFreshnessMetadata {
  source_freshness_status: SourceFreshnessStatus;
  source_last_observed_at: string | null;
  source_window_from: string | null;
  source_window_to: string | null;
  source_record_count: number;
  source_sample_size: number;
  source_missing_reason: string | null;
  source_staleness_reason: string | null;
  source_coverage_percent: number | null;
  source_lineage_modules: string[];
  source_lineage_collections: string[];
  source_lineage_fields: string[];
  source_lineage_method: string;
  source_is_derived_candidate: boolean;
  source_derivation_notes: string[];
  source_confidence_reason: string;
}

export interface MergeSourceMetadataOptions {
  findingKey: OperationalRiskFindingKey;
  asOfDate: Date | string | number;
  maxAgeMinutes: number;
  sourceConfidenceReason?: string;
  sourceLineageMethod?: string;
  missingReason?: string | null;
  stalenessReason?: string | null;
}

export interface FreshnessDowngradeInput {
  data_quality_status: DataQualityStatus;
  confidence: ConfidenceLevel;
  confidence_reason?: string | null;
  data_quality_reason?: string | null;
  missing_or_weak_fields?: readonly string[];
}

export interface FreshnessDowngradeResult {
  data_quality_status: DataQualityStatus;
  confidence: ConfidenceLevel;
  confidence_reason: string;
  data_quality_reason: string;
  missing_or_weak_fields: string[];
}
