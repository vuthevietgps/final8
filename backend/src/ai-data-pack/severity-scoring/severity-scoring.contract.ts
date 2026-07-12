import type { DataQualityStatus } from '../contracts/metadata.contract';
import type { SourceFreshnessStatus } from '../source-freshness/source-freshness.contract';
import type { OperationalRiskFindingKey } from '../threshold-registry/threshold-source.contract';

export const SEVERITY_LABELS = [
  'RAT_TOT',
  'TOT',
  'BINH_THUONG',
  'CHU_Y',
  'NGHIEM_TRONG',
] as const;

export type SeverityLabel = (typeof SEVERITY_LABELS)[number];

export interface SeverityComponentScore {
  score: number;
  reason: string;
}

export interface SeverityScoringInput {
  finding_key: OperationalRiskFindingKey;
  threshold_breach_magnitude: number | null;
  source_freshness_status: SourceFreshnessStatus | string | null;
  sample_size: number | null;
  data_quality_status: DataQualityStatus | string | null;
  confidence: string | null;
  impact_estimate: number | null;
  repeated_occurrence: boolean | number | null;
  direct_evidence_ratio: number | null;
  source_is_derived_candidate: boolean | null;
  missing_essential_fields: readonly string[];
  blocked_reason_present: boolean;
  direct_breach_is_extreme?: boolean;
}

export interface SeverityScoringResult {
  severity_score: number;
  severity_label: SeverityLabel;
  severity_display_label: string;
  severity_reason: string;
  severity_components: {
    threshold_breach: SeverityComponentScore;
    source_freshness: SeverityComponentScore;
    sample_size: SeverityComponentScore;
    data_quality: SeverityComponentScore;
    business_impact: SeverityComponentScore;
    repeat_signal: SeverityComponentScore;
    evidence_directness: SeverityComponentScore;
  };
  severity_cap_reason: string | null;
}
