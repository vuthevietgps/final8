import { budgetPeriods } from './budget-periods';
import { evaluateAdGroupEvidence } from './ads-automation-evidence.rules';

describe('weekly treasury limits', () => {
  it('uses Monday Vietnam time, including a week crossing month/year', () => {
    expect(budgetPeriods(new Date('2027-01-01T01:00:00Z'))).toEqual({
      day: new Date('2026-12-31T17:00:00Z'), month: new Date('2026-12-31T17:00:00Z'),
      week: new Date('2026-12-27T17:00:00Z'), since: new Date('2026-12-27T17:00:00Z'),
    });
  });
  it.each([100, 120, undefined])('blocks exhausted or missing weekly spend %s', spend => {
    const result = evaluateAdGroupEvidence({ adGroupId: 'g', finance: {
      availableCash: 1000, weeklyCap: 100, currentWeeklySpend: spend, dataFreshness: 'fresh',
    } });
    expect(result.financeGate.status).toBe('block');
    expect(result.financeGate.cappedBudgetIncrease).toBe(0);
  });
  it('limits increases to the remaining week even when cash is abundant', () => {
    const result = evaluateAdGroupEvidence({ adGroupId: 'g', finance: {
      availableCash: 1000, weeklyCap: 100, currentWeeklySpend: 90, dataFreshness: 'fresh',
    } });
    expect(result.financeGate.cappedBudgetIncrease).toBe(10);
  });
});
