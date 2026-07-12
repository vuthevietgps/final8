import type {
  SeverityComponentScore,
  SeverityLabel,
  SeverityScoringInput,
  SeverityScoringResult,
} from './severity-scoring.contract';

const DISPLAY_LABEL_BY_SEVERITY: Record<SeverityLabel, string> = {
  RAT_TOT: 'Rất tốt',
  TOT: 'Tốt',
  BINH_THUONG: 'Bình thường',
  CHU_Y: 'Chú ý',
  NGHIEM_TRONG: 'Nghiêm trọng',
};

export function scoreOperationalSeverity(input: SeverityScoringInput): SeverityScoringResult {
  const components = {
    threshold_breach: thresholdBreachComponent(input.threshold_breach_magnitude),
    source_freshness: sourceFreshnessComponent(input.source_freshness_status),
    sample_size: sampleSizeComponent(input.sample_size),
    data_quality: dataQualityComponent(input.data_quality_status, input.confidence),
    business_impact: impactComponent(input.impact_estimate),
    repeat_signal: repeatSignalComponent(input.repeated_occurrence),
    evidence_directness: evidenceDirectnessComponent(input.direct_evidence_ratio, input.source_is_derived_candidate),
  };
  const weightedScore = (
    components.threshold_breach.score * 0.28
    + components.source_freshness.score * 0.12
    + components.sample_size.score * 0.12
    + components.data_quality.score * 0.18
    + components.business_impact.score * 0.14
    + components.repeat_signal.score * 0.08
    + components.evidence_directness.score * 0.08
  );
  const cap = severityCap(input);
  const severityScore = Math.round(cap === null ? weightedScore : Math.min(weightedScore, cap.maxScore));
  const severityLabel = labelForSeverityScore(severityScore);

  return {
    severity_score: severityScore,
    severity_label: severityLabel,
    severity_display_label: DISPLAY_LABEL_BY_SEVERITY[severityLabel],
    severity_reason: [
      `Threshold breach=${components.threshold_breach.score}`,
      `data quality=${components.data_quality.score}`,
      `sample=${components.sample_size.score}`,
      `freshness=${components.source_freshness.score}`,
      `impact=${components.business_impact.score}`,
      `repeat=${components.repeat_signal.score}`,
      `directness=${components.evidence_directness.score}`,
    ].join('; '),
    severity_components: components,
    severity_cap_reason: cap?.reason || null,
  };
}

export function labelForSeverityScore(score: number): SeverityLabel {
  const normalized = clamp(score, 0, 100);
  if (normalized <= 20) {
    return 'RAT_TOT';
  }
  if (normalized <= 40) {
    return 'TOT';
  }
  if (normalized <= 60) {
    return 'BINH_THUONG';
  }
  if (normalized <= 80) {
    return 'CHU_Y';
  }
  return 'NGHIEM_TRONG';
}

function thresholdBreachComponent(value: number | null): SeverityComponentScore {
  if (value === null || !Number.isFinite(value)) {
    return { score: 45, reason: 'threshold breach magnitude missing' };
  }
  return { score: clamp(Math.abs(value), 0, 100), reason: 'normalized threshold breach magnitude' };
}

function sourceFreshnessComponent(status: string | null): SeverityComponentScore {
  switch (status) {
    case 'fresh':
      return { score: 10, reason: 'fresh source timestamp' };
    case 'stale':
      return { score: 65, reason: 'source timestamp stale' };
    case 'missing':
      return { score: 75, reason: 'source timestamp missing' };
    case 'unknown':
    case 'not_configured':
    case 'unsupported':
      return { score: 50, reason: 'source freshness unknown or not configured' };
    default:
      return { score: 55, reason: 'source freshness unavailable' };
  }
}

function sampleSizeComponent(sampleSize: number | null): SeverityComponentScore {
  if (sampleSize === null || !Number.isFinite(sampleSize) || sampleSize <= 0) {
    return { score: 75, reason: 'no direct sample rows available' };
  }
  if (sampleSize === 1) {
    return { score: 58, reason: 'single-row evidence sample' };
  }
  if (sampleSize < 5) {
    return { score: 42, reason: 'small evidence sample' };
  }
  if (sampleSize < 10) {
    return { score: 28, reason: 'moderate evidence sample' };
  }
  return { score: 12, reason: 'broad evidence sample' };
}

function dataQualityComponent(status: string | null, confidence: string | null): SeverityComponentScore {
  const base = status === 'ok'
    ? 10
    : status === 'partial'
      ? 38
      : status === 'weak'
        ? 58
        : status === 'stale'
          ? 68
          : status === 'missing'
            ? 78
            : 55;
  const confidencePenalty = confidence === 'high' ? 0 : confidence === 'medium' ? 8 : 18;
  return { score: clamp(base + confidencePenalty, 0, 100), reason: `data_quality_status=${status || 'unknown'}, confidence=${confidence || 'unknown'}` };
}

function impactComponent(value: number | null): SeverityComponentScore {
  if (value === null || !Number.isFinite(value)) {
    return { score: 50, reason: 'business impact estimate missing' };
  }
  return { score: clamp(value, 0, 100), reason: 'normalized business impact estimate' };
}

function repeatSignalComponent(value: boolean | number | null): SeverityComponentScore {
  if (typeof value === 'boolean') {
    return { score: value ? 70 : 25, reason: value ? 'repeat signal present' : 'no repeat signal observed' };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { score: clamp(value <= 1 ? 25 : 35 + value * 10, 0, 85), reason: 'repeat count normalized' };
  }
  return { score: 45, reason: 'repeat signal unknown' };
}

function evidenceDirectnessComponent(ratio: number | null, derivedCandidate: boolean | null): SeverityComponentScore {
  const normalizedRatio = ratio === null || !Number.isFinite(ratio) ? 0.5 : clamp(ratio, 0, 1);
  const score = 15 + (1 - normalizedRatio) * 60 + (derivedCandidate ? 10 : 0);
  return { score: Math.round(clamp(score, 0, 100)), reason: derivedCandidate ? 'derived advisory candidate with limited direct evidence' : 'direct evidence ratio normalized' };
}

function severityCap(input: SeverityScoringInput): { maxScore: number; reason: string } | null {
  const reasons: string[] = [];
  let maxScore = 100;

  if ((input.sample_size || 0) <= 1) {
    maxScore = Math.min(maxScore, 60);
    reasons.push('sample_size<=1 caps at Binh thuong');
  } else if ((input.sample_size || 0) < 3) {
    maxScore = Math.min(maxScore, 80);
    reasons.push('small sample caps at Chu y');
  }

  if (input.source_freshness_status === 'stale' || input.source_freshness_status === 'missing') {
    maxScore = Math.min(maxScore, 80);
    reasons.push(`source freshness ${input.source_freshness_status} caps at Chu y`);
  }

  if (input.source_is_derived_candidate) {
    maxScore = Math.min(maxScore, 80);
    reasons.push('derived candidate evidence caps at Chu y');
  }

  if (input.missing_essential_fields.length > 0) {
    maxScore = Math.min(maxScore, 80);
    reasons.push('missing essential fields cap severity');
  }

  if (input.impact_estimate === null && !input.direct_breach_is_extreme) {
    maxScore = Math.min(maxScore, 80);
    reasons.push('missing impact estimate caps at Chu y');
  }

  if (!input.blocked_reason_present) {
    maxScore = Math.min(maxScore, 80);
    reasons.push('blocked reason missing caps at Chu y');
  }

  return reasons.length ? { maxScore, reason: reasons.join('; ') } : null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
