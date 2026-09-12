/** Stable integer allocation; ties follow caller-provided order. */
export function allocateVnd(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0 || weights.some(n => !Number.isFinite(n) || n < 0)) {
    throw new Error('Chi phí phân bổ phải là số nguyên VND không âm.');
  }
  const denominator = weights.reduce((sum, n) => sum + n, 0);
  if (!denominator) return weights.map(() => 0);
  const exact = weights.map(n => total * n / denominator);
  const result = exact.map(Math.floor);
  const remainder = total - result.reduce((sum, n) => sum + n, 0);
  const indices = exact.map((n, i) => ({ i, fraction: n - result[i] })).sort((a,b) => b.fraction-a.fraction || a.i-b.i);
  for (let n=0; n<remainder; n++) result[indices[n].i]++;
  return result;
}
