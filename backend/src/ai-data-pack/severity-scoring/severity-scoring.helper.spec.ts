import { labelForSeverityScore, scoreOperationalSeverity } from './severity-scoring.helper';

describe('severity scoring helper', () => {
  it('maps score ranges to the approved Vietnamese severity labels', () => {
    expect(labelForSeverityScore(10)).toBe('RAT_TOT');
    expect(labelForSeverityScore(30)).toBe('TOT');
    expect(labelForSeverityScore(50)).toBe('BINH_THUONG');
    expect(labelForSeverityScore(70)).toBe('CHU_Y');
    expect(labelForSeverityScore(90)).toBe('NGHIEM_TRONG');
  });

  it('returns deterministic component scores and display labels', () => {
    const result = scoreOperationalSeverity({
      finding_key: 'supplier_cost_up',
      threshold_breach_magnitude: 40,
      source_freshness_status: 'fresh',
      sample_size: 6,
      data_quality_status: 'partial',
      confidence: 'medium',
      impact_estimate: 50,
      repeated_occurrence: 3,
      direct_evidence_ratio: 0.7,
      source_is_derived_candidate: true,
      missing_essential_fields: ['margin_or_cogs_impact'],
      blocked_reason_present: true,
    });

    expect(result.severity_score).toBeGreaterThanOrEqual(0);
    expect(result.severity_score).toBeLessThanOrEqual(80);
    expect(result.severity_label).toBe(labelForSeverityScore(result.severity_score));
    expect(result.severity_display_label).toMatch(/Rất tốt|Tốt|Bình thường|Chú ý|Nghiêm trọng/);
    expect(result.severity_components.threshold_breach.reason).toContain('threshold');
    expect(result.severity_cap_reason).toContain('derived candidate');
  });

  it('caps low-sample findings at Binh thuong and stale derived findings at Chu y', () => {
    const lowSample = scoreOperationalSeverity({
      finding_key: 'overdue_dealer_receivables',
      threshold_breach_magnitude: 100,
      source_freshness_status: 'fresh',
      sample_size: 1,
      data_quality_status: 'weak',
      confidence: 'low',
      impact_estimate: 100,
      repeated_occurrence: true,
      direct_evidence_ratio: 0.2,
      source_is_derived_candidate: false,
      missing_essential_fields: [],
      blocked_reason_present: true,
    });
    expect(lowSample.severity_score).toBeLessThanOrEqual(60);
    expect(lowSample.severity_label).toBe('BINH_THUONG');
    expect(lowSample.severity_cap_reason).toContain('sample_size<=1');

    const staleDerived = scoreOperationalSeverity({
      finding_key: 'slow_supplier_good_cost',
      threshold_breach_magnitude: 100,
      source_freshness_status: 'stale',
      sample_size: 5,
      data_quality_status: 'weak',
      confidence: 'low',
      impact_estimate: 100,
      repeated_occurrence: true,
      direct_evidence_ratio: 0.2,
      source_is_derived_candidate: true,
      missing_essential_fields: [],
      blocked_reason_present: true,
    });
    expect(staleDerived.severity_score).toBeLessThanOrEqual(80);
    expect(staleDerived.severity_cap_reason).toContain('source freshness stale');
    expect(staleDerived.severity_cap_reason).toContain('derived candidate');
  });
});
