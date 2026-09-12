/** Estimates never become input samples; absent history days are not silently treated as zero. */
export function estimateWindsorCosts(rows: any[], day: string, minimumSamples = 3) {
  const groups = new Map<string, any[]>();
  const start = new Date(`${day}T00:00:00Z`).getTime() - 28 * 86_400_000;
  for (const row of rows) {
    const date = new Date(row.date).toISOString().slice(0, 10);
    if (row.isEstimated || date >= day || +new Date(row.date) < start || !Number.isFinite(row.spentAmount) || row.spentAmount < 0) continue;
    const key = `${row.customerId}:${row.adGroupId}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.values()].flatMap(group => {
    const samples = [...new Map(group.sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .map(row => [new Date(row.date).toISOString().slice(0, 10), row])).values()].slice(0, 7);
    if (samples.length < minimumSamples) return [];
    // Do not keep inventing spend for groups absent from actual history for over a week.
    if (+new Date(`${day}T00:00:00Z`) - +new Date(samples[0].date) > 7 * 86_400_000) return [];
    return [{ ...samples[0], spentAmount: Math.round(samples.reduce((sum, row) => sum + row.spentAmount, 0) / samples.length),
      estimationSampleDays: samples.map(row => new Date(row.date).toISOString().slice(0, 10)) }];
  });
}
