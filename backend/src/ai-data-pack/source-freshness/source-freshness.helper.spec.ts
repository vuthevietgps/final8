import {
  applyFreshnessDowngrade,
  countRows,
  freshnessFromTimestamp,
  latestTimestamp,
  lineageForFinding,
  mergeSourceMetadata,
  windowFromRows,
} from './source-freshness.helper';

describe('source freshness helper', () => {
  it('classifies freshness deterministically from a timestamp and report date', () => {
    const asOfDate = new Date('2026-06-14T00:00:00.000Z');

    expect(freshnessFromTimestamp('2026-06-13T23:30:00.000Z', asOfDate, 60)).toBe('fresh');
    expect(freshnessFromTimestamp('2026-06-13T21:00:00.000Z', asOfDate, 60)).toBe('stale');
    expect(freshnessFromTimestamp(null, asOfDate, 60)).toBe('missing');
    expect(freshnessFromTimestamp('not-a-date', asOfDate, 60)).toBe('unknown');
    expect(freshnessFromTimestamp('2026-06-13T23:30:00.000Z', 'not-a-date', 60)).toBe('unknown');
    expect(freshnessFromTimestamp('2026-06-13T23:30:00.000Z', asOfDate, null)).toBe('unknown');
  });

  it('handles latest timestamp and window extraction safely', () => {
    const rows = [
      { updatedAt: new Date('2026-06-10T00:00:00.000Z'), nested: [{ paidAt: 'bad-date' }] },
      { createdAt: '2026-06-12T00:00:00.000Z', nested: [{ paidAt: '2026-06-11T00:00:00.000Z' }] },
      { updatedAt: 'not-a-date' },
    ];

    expect(latestTimestamp([], ['updatedAt'])).toBeNull();
    expect(latestTimestamp(rows, ['updatedAt', 'createdAt', 'nested.paidAt'])).toBe('2026-06-12T00:00:00.000Z');
    expect(windowFromRows(rows, ['updatedAt', 'createdAt', 'nested.paidAt'])).toEqual({
      source_window_from: '2026-06-10T00:00:00.000Z',
      source_window_to: '2026-06-12T00:00:00.000Z',
    });
    expect(windowFromRows([{ updatedAt: 'bad-date' }], ['updatedAt'])).toEqual({
      source_window_from: null,
      source_window_to: null,
    });
  });

  it('counts rows and builds merged metadata without side effects', () => {
    const metadata = mergeSourceMetadata([
      {
        rows: [{ updatedAt: new Date('2026-06-13T00:00:00.000Z') }],
        timestampFields: ['updatedAt'],
        sampleSize: 1,
      },
      {
        rows: [{ effectiveAt: new Date('2026-06-12T00:00:00.000Z') }],
        timestampFields: ['effectiveAt'],
        sampleSize: 1,
      },
    ], {
      findingKey: 'supplier_cost_up',
      asOfDate: new Date('2026-06-14T00:00:00.000Z'),
      maxAgeMinutes: 60 * 48,
    });

    expect(countRows([{ ok: true }, { ok: false }], (row) => row.ok)).toBe(1);
    expect(metadata).toEqual(expect.objectContaining({
      source_freshness_status: 'fresh',
      source_last_observed_at: '2026-06-13T00:00:00.000Z',
      source_window_from: '2026-06-12T00:00:00.000Z',
      source_window_to: '2026-06-13T00:00:00.000Z',
      source_record_count: 2,
      source_sample_size: 2,
      source_is_derived_candidate: true,
    }));
    expect(metadata.source_lineage_modules).toEqual(expect.arrayContaining(['OperationsCapacityQuery', 'threshold-registry']));
    expect(metadata.source_lineage_collections).toEqual(expect.arrayContaining(['supplierquotes', 'quotes', 'products']));
    expect(metadata.source_lineage_fields).toEqual(expect.arrayContaining(['supplierquotes.effectiveAt', 'quotes.validFrom']));
  });

  it('returns lineage for every canonical operational risk finding', () => {
    const expectedCollections = {
      low_inventory_best_seller: ['inventorysummaries', 'products', 'ordertest2', 'purchaseorders', 'deliverystatuses'],
      supplier_cost_up: ['supplierquotes', 'quotes', 'products'],
      overdue_dealer_receivables: ['ordertest2', 'agentstatements', 'users'],
      labor_overtime_high: ['laborcost1', 'laborstatements', 'ordertest2', 'users'],
      slow_supplier_good_cost: ['supplierquotes', 'purchaseorders', 'products', 'inventorysummaries', 'users'],
    } as const;

    for (const [findingKey, collections] of Object.entries(expectedCollections)) {
      const lineage = lineageForFinding(findingKey as keyof typeof expectedCollections);
      expect(lineage.modules).toEqual(expect.arrayContaining(['OperationsCapacityQuery', 'threshold-registry']));
      expect(lineage.collections).toEqual(expect.arrayContaining(collections));
      expect(lineage.fields.length).toBeGreaterThan(0);
      expect(lineage.isDerivedCandidate).toBe(true);
    }
  });

  it('applies advisory freshness downgrades deterministically', () => {
    const staleMetadata = mergeSourceMetadata([
      { rows: [{ updatedAt: new Date('2026-05-01T00:00:00.000Z') }], timestampFields: ['updatedAt'] },
    ], {
      findingKey: 'low_inventory_best_seller',
      asOfDate: new Date('2026-06-14T00:00:00.000Z'),
      maxAgeMinutes: 60,
    });

    expect(applyFreshnessDowngrade({
      data_quality_status: 'partial',
      confidence: 'medium',
      missing_or_weak_fields: ['reserved_quantity_candidate'],
    }, staleMetadata)).toEqual(expect.objectContaining({
      data_quality_status: 'stale',
      confidence: 'low',
      missing_or_weak_fields: expect.arrayContaining(['reserved_quantity_candidate', 'source_freshness_stale']),
    }));
  });
});
