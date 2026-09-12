import { buildLedgerReport } from './business-ledger.report';

describe('Business ledger overhead reconciliation', () => {
  it('retains costs incurred on a day with no orders', () => {
    const report = buildLedgerReport({
      entries: [], accounts: [], profiles: [], orders: [], ads: [],
      overhead: {
        labor: [],
        other: [{ date: new Date('2026-08-03T05:00:00Z'), amount: 100_000 }],
      },
      from: '2026-08-01', to: '2026-08-31',
    });

    expect(report.orders).toContainEqual(expect.objectContaining({
      costOnly: true, otherCostAllocation: 100_000, recordedNetProfit: -100_000,
    }));
    expect(report.products.reduce((sum, row) => sum + row.recordedNetProfit, 0)).toBe(-100_000);
    expect(report.productCategories.reduce((sum, row) => sum + row.recordedNetProfit, 0)).toBe(-100_000);
  });
});
