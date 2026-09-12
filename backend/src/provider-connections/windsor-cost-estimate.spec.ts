import { estimateWindsorCosts } from './windsor-cost-estimate';

describe('temporary Windsor expense estimation', () => {
  const history = [1, 2, 3, 4].map(n => ({ date: `2026-09-0${n}`, customerId: 'a', adGroupId: 'g', spentAmount: n * 100 }));
  it('uses actual history from the same scope and never learns from an estimate or a future day', () => {
    const result = estimateWindsorCosts([...history,
      { ...history[0], date: '2026-09-05', spentAmount: 999999, isEstimated: true },
      { ...history[0], date: '2026-09-07', spentAmount: 999999 },
      { ...history[0], customerId: 'b', spentAmount: 999999 },
    ], '2026-09-06');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ spentAmount: 250, customerId: 'a', estimationSampleDays: [
      '2026-09-04', '2026-09-03', '2026-09-02', '2026-09-01',
    ] });
  });
  it('does not invent zeros for missing history or carry a stopped group forward indefinitely', () => {
    expect(estimateWindsorCosts(history.slice(0, 2), '2026-09-05')).toEqual([]);
    expect(estimateWindsorCosts(history, '2026-09-12')).toEqual([]);
    expect(estimateWindsorCosts([], '2026-09-05')).toEqual([]);
  });
  it('includes genuine zero-spend days in the average', () => {
    expect(estimateWindsorCosts(history.slice(0, 3).map(row => ({ ...row, spentAmount: 0 })), '2026-09-05')[0].spentAmount).toBe(0);
  });
});
