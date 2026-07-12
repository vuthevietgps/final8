export function latestIso(values: unknown[]): string | null {
  const timestamps = values
    .map((value) => value ? new Date(value as any).getTime() : NaN)
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

export function freshnessHours(value?: unknown, now = new Date()): number | null {
  if (!value) return null;
  const timestamp = new Date(value as any).getTime();
  return Number.isFinite(timestamp) ? Number(((now.getTime() - timestamp) / 3_600_000).toFixed(2)) : null;
}

