import { Test } from '@nestjs/testing';
import { THRESHOLD_SOURCE_RECORDS } from './threshold-source.config';
import { THRESHOLD_SOURCE_RECORDS_TOKEN } from './threshold-source.config';
import { APPROVED_OPERATIONAL_RISK_FINDINGS, ThresholdSourceRecord } from './threshold-source.contract';
import { ThresholdSourceResolver } from './threshold-source.resolver';
import { validateThresholdSourceRecords } from './threshold-source.validator';

const baseRecord: ThresholdSourceRecord = {
  threshold_key: 'low_inventory.days_of_cover_threshold',
  finding_key: 'low_inventory_best_seller',
  business_owner: 'operations',
  source_type: 'repo_config',
  source_module_or_collection: 'threshold_registry_config',
  field_path_or_config_key: 'low_inventory.days_of_cover_threshold',
  value_type: 'days',
  unit: 'days',
  value: 7,
  default_allowed: false,
  effective_from: '2026-01-01',
  effective_to: null,
  approval_status: 'approved',
  last_reviewed_at: '2026-06-14T00:00:00.000Z',
  data_quality_status_impact: 'partial',
  confidence_impact: 'medium_ceiling',
  fallback_behavior: 'no_row',
  not_allowed_actions: 'do_not_create_purchase_order; do_not_mutate_inventory',
  semantic_notes: ['test note'],
};

const nonCanonicalFindingAliases = [
  'low_inventory_bestseller',
  'dealer_receivable_overdue_or_risk',
  'labor_overtime_mismatch',
  'slow_supplier_better_alternative',
] as const;

describe('ThresholdSourceResolver', () => {
  it('validates the shipped read-only threshold source config', () => {
    expect(() => validateThresholdSourceRecords(THRESHOLD_SOURCE_RECORDS)).not.toThrow();
    expect(new Set(THRESHOLD_SOURCE_RECORDS.map((record) => record.finding_key))).toEqual(new Set([
      'low_inventory_best_seller',
      'supplier_cost_up',
      'overdue_dealer_receivables',
      'labor_overtime_high',
      'slow_supplier_good_cost',
    ]));
    expect(THRESHOLD_SOURCE_RECORDS.map((record) => record.finding_key).sort()).toEqual(
      THRESHOLD_SOURCE_RECORDS.map((record) => record.finding_key)
        .filter((findingKey) => APPROVED_OPERATIONAL_RISK_FINDINGS.includes(findingKey))
        .sort(),
    );
    for (const alias of nonCanonicalFindingAliases) {
      expect(THRESHOLD_SOURCE_RECORDS.some((record) => record.finding_key === alias as any)).toBe(false);
    }
  });

  it('rejects unknown finding keys', () => {
    expect(() => validateThresholdSourceRecords([
      { ...baseRecord, threshold_key: 'bad.finding', finding_key: 'unknown_finding' as any },
    ])).toThrow(/unknown finding_key/);
  });

  it('rejects non-canonical Prompt53 alias finding keys', () => {
    for (const alias of nonCanonicalFindingAliases) {
      expect(() => validateThresholdSourceRecords([
        { ...baseRecord, threshold_key: `bad.alias.${alias}`, finding_key: alias as any },
      ])).toThrow(/unknown finding_key/);
    }
  });

  it('rejects duplicate threshold keys', () => {
    expect(() => validateThresholdSourceRecords([
      baseRecord,
      { ...baseRecord, finding_key: 'supplier_cost_up' },
    ])).toThrow(/duplicate threshold_key/);
  });

  it('rejects invalid fallback behavior and approval status values', () => {
    expect(() => validateThresholdSourceRecords([
      { ...baseRecord, threshold_key: 'bad.fallback', fallback_behavior: 'publish_live' as any },
    ])).toThrow(/invalid fallback_behavior/);
    expect(() => validateThresholdSourceRecords([
      { ...baseRecord, threshold_key: 'bad.approval', approval_status: 'approved_for_action' as any },
    ])).toThrow(/invalid approval_status/);
  });

  it('rejects approved records without effective_from', () => {
    expect(() => validateThresholdSourceRecords([
      { ...baseRecord, threshold_key: 'bad.effective', effective_from: null },
    ])).toThrow(/effective_from/);
  });

  it('rejects missing do_not safety text', () => {
    expect(() => validateThresholdSourceRecords([
      { ...baseRecord, threshold_key: 'bad.safety', not_allowed_actions: 'review only' },
    ])).toThrow(/not_allowed_actions/);
  });

  it('rejects action/provider/mutation-like registry payload keys', () => {
    expect(() => validateThresholdSourceRecords([
      {
        ...baseRecord,
        threshold_key: 'bad.payload',
        value: { provider_operation: 'mutate' },
      } as any,
    ])).toThrow(/forbidden registry payload key/);
  });

  it('selects an active record by effective date', () => {
    const resolver = new ThresholdSourceResolver([baseRecord]);
    const resolved = resolver.resolve({
      findingKey: 'low_inventory_best_seller',
      thresholdKey: 'low_inventory.days_of_cover_threshold',
      asOfDate: '2026-06-14',
    });

    expect(resolved).toEqual(expect.objectContaining({
      threshold_source_key: 'low_inventory.days_of_cover_threshold',
      threshold_source_approval_status: 'approved',
      threshold_source_default_used: false,
      threshold_value: 7,
      threshold_unit: 'days',
      should_emit_row: true,
    }));
  });

  it('can be instantiated by Nest DI with the shipped registry provider', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: THRESHOLD_SOURCE_RECORDS_TOKEN,
          useValue: THRESHOLD_SOURCE_RECORDS,
        },
        ThresholdSourceResolver,
      ],
    }).compile();

    const resolver = moduleRef.get(ThresholdSourceResolver);
    const resolved = resolver.resolve({
      findingKey: 'low_inventory_best_seller',
      thresholdKey: 'low_inventory.days_of_cover_threshold',
      asOfDate: '2026-06-14',
    });

    expect(resolved.threshold_source_approval_status).toBe('approved');
  });

  it('handles missing source with no_row', () => {
    const resolver = new ThresholdSourceResolver([]);
    const resolved = resolver.resolve({
      findingKey: 'low_inventory_best_seller',
      thresholdKey: 'missing.threshold',
      fallbackBehavior: 'no_row',
    });

    expect(resolved.should_emit_row).toBe(false);
    expect(resolved.threshold_source_approval_status).toBe('missing');
    expect(resolved.missing_or_weak_fields).toContain('missing.threshold');
  });

  it('handles missing source with emit_with_downgrade', () => {
    const resolver = new ThresholdSourceResolver([]);
    const resolved = resolver.resolve({
      findingKey: 'supplier_cost_up',
      thresholdKey: 'missing.threshold',
      fallbackBehavior: 'emit_with_downgrade',
    });

    expect(resolved.should_emit_row).toBe(true);
    expect(resolved.threshold_source_default_used).toBe(false);
    expect(resolved.confidence_reason).toContain('prevents high confidence');
  });

  it('handles documented default with threshold_source_default_used true', () => {
    const resolver = new ThresholdSourceResolver([]);
    const resolved = resolver.resolve({
      findingKey: 'slow_supplier_good_cost',
      thresholdKey: 'missing.defaulted_threshold',
      fallbackBehavior: 'use_documented_default',
      defaultValue: 5,
      defaultUnit: 'percent',
    });

    expect(resolved.should_emit_row).toBe(true);
    expect(resolved.threshold_source_default_used).toBe(true);
    expect(resolved.threshold_value).toBe(5);
    expect(resolved.threshold_unit).toBe('percent');
  });

  it('handles draft and deprecated records conservatively', () => {
    const draftResolver = new ThresholdSourceResolver([
      { ...baseRecord, approval_status: 'draft', fallback_behavior: 'no_row' },
    ]);
    expect(draftResolver.resolve({
      findingKey: 'low_inventory_best_seller',
      thresholdKey: 'low_inventory.days_of_cover_threshold',
      asOfDate: '2026-06-14',
    })).toEqual(expect.objectContaining({
      threshold_source_approval_status: 'draft',
      should_emit_row: false,
      threshold_value: null,
    }));

    const deprecatedResolver = new ThresholdSourceResolver([
      { ...baseRecord, approval_status: 'deprecated', fallback_behavior: 'emit_with_downgrade' },
    ]);
    expect(deprecatedResolver.resolve({
      findingKey: 'low_inventory_best_seller',
      thresholdKey: 'low_inventory.days_of_cover_threshold',
      asOfDate: '2026-06-14',
    })).toEqual(expect.objectContaining({
      threshold_source_approval_status: 'deprecated',
      should_emit_row: true,
      missing_or_weak_fields: ['low_inventory.days_of_cover_threshold'],
    }));
  });
});
