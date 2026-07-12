import {
  AdsAutomationDecisionMongoReadModelRepository,
  assessMetricProfitEvidence,
  assessSupplierQuoteApproval,
} from './ads-automation-decision-mongo-read-model.repository';

describe('AdsAutomationDecisionMongoReadModelRepository confidence evidence', () => {
  const now = '2026-07-10T12:00:00.000Z';

  describe('metric profit evidence', () => {
    it('does not treat schema-default zero as proof of profit enrichment', () => {
      const evidence = assessMetricProfitEvidence([
        {
          netProfit: 0,
          lastSyncAt: '2026-07-10T11:00:00.000Z',
          updatedAt: '2026-07-10T11:00:00.000Z',
        },
      ], { now, maxAgeHours: 24 });

      expect(evidence).toEqual(expect.objectContaining({
        status: 'missing',
        rowCount: 0,
        provenanceRowCount: 0,
      }));
      expect(evidence.total).toBeUndefined();
    });

    it('accepts a real zero only with fresh explicit profit provenance', () => {
      const evidence = assessMetricProfitEvidence([
        {
          netProfit: 0,
          profitUpdatedAt: '2026-07-10T10:00:00.000Z',
          lastSyncAt: '2026-07-10T11:00:00.000Z',
        },
      ], { now, maxAgeHours: 24 });

      expect(evidence).toEqual(expect.objectContaining({
        status: 'fresh',
        total: 0,
        latestObservedAt: '2026-07-10T10:00:00.000Z',
        ageHours: 2,
        provenanceRowCount: 1,
      }));
    });

    it('keeps stale profit stale even when the provider row was synced recently', () => {
      const evidence = assessMetricProfitEvidence([
        {
          netProfit: 0,
          profitUpdatedAt: '2026-07-07T10:00:00.000Z',
          lastSyncAt: '2026-07-10T11:30:00.000Z',
        },
      ], { now, maxAgeHours: 24 });

      expect(evidence).toEqual(expect.objectContaining({
        status: 'stale',
        total: 0,
        latestObservedAt: '2026-07-07T10:00:00.000Z',
        ageHours: 74,
      }));
    });

    it('supports legacy non-zero profit while still checking freshness', () => {
      const evidence = assessMetricProfitEvidence([
        {
          netProfit: 125_000,
          lastSyncAt: '2026-07-10T11:00:00.000Z',
        },
      ], { now, maxAgeHours: 24 });

      expect(evidence).toEqual(expect.objectContaining({
        status: 'fresh',
        total: 125_000,
        ageHours: 1,
      }));
    });
  });

  describe('supplier quote approval evidence', () => {
    it('does not approve a quote merely because it exists', () => {
      expect(assessSupplierQuoteApproval({ price: 180_000 })).toEqual({
        approved: false,
        source: 'missing',
      });
      expect(assessSupplierQuoteApproval({ price: 180_000, status: 'active' })).toEqual({
        approved: false,
        source: 'status',
      });
    });

    it('requires an explicit approval signal', () => {
      expect(assessSupplierQuoteApproval({ approvalStatus: 'approved' })).toEqual({
        approved: true,
        source: 'approvalStatus',
      });
      expect(assessSupplierQuoteApproval({ approvedAt: now, approvedBy: 'director@example.com' })).toEqual({
        approved: true,
        source: 'approvedAt_and_approvedBy',
      });
    });
  });

  it('caps data quality below the default scale threshold without fresh profit', () => {
    const repository = new AdsAutomationDecisionMongoReadModelRepository({} as any);
    const scoreWithoutProfit = (repository as any).dataQualityScore({
      hasMetrics: true,
      hasBudgetRef: true,
      hasProductMapping: true,
      hasProfit: false,
    });
    const scoreWithProfit = (repository as any).dataQualityScore({
      hasMetrics: true,
      hasBudgetRef: true,
      hasProductMapping: true,
      hasProfit: true,
    });

    expect(scoreWithoutProfit).toBe(0.7);
    expect(scoreWithProfit).toBe(0.98);
  });
});
