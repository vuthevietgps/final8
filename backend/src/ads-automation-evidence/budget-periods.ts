const OFFSET = 7 * 60 * 60 * 1000;
export function budgetPeriods(now: Date) {
  const local = new Date(+now + OFFSET);
  const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET);
  const week = new Date(+day - ((local.getUTCDay() + 6) % 7) * 86400000);
  const month = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET);
  return { day, week, month, since: new Date(Math.min(+week, +month)) };
}
