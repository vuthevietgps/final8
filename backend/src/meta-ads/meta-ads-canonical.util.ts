import { createHash } from 'crypto';

export function metaAdsCanonicalJson(value: unknown): string {
  return JSON.stringify(sortCanonicalValue(value));
}

export function metaAdsCanonicalHash(value: unknown): string {
  return createHash('sha256').update(metaAdsCanonicalJson(value)).digest('hex');
}

function sortCanonicalValue(value: any): any {
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (value[key] !== undefined) result[key] = sortCanonicalValue(value[key]);
      return result;
    }, {} as Record<string, unknown>);
}

