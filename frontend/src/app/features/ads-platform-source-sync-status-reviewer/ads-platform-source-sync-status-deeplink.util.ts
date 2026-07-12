import type { Params } from '@angular/router';
import type { AdsPlatformSourceSyncStatusSourceKey } from './ads-platform-source-sync-status-reviewer.service';

export const ADS_PLATFORM_SOURCE_SYNC_STATUS_REVIEWER_ROUTE = '/ai/ads-platform-source-sync-status-reviewer';

export const ADS_PLATFORM_SOURCE_SYNC_STATUS_DEFAULT_SOURCE_KEYS: AdsPlatformSourceSyncStatusSourceKey[] = [
  'google_ads',
  'advertising_costs',
  'product_mapping',
];

export interface AdsPlatformSourceSyncEvidenceLike {
  sourceKey?: unknown;
  provider?: unknown;
  sourceKind?: unknown;
  platform?: unknown;
  reportDate?: unknown;
}

export interface AdsPlatformSourceSyncStatusDeeplinkInput {
  reportDate?: unknown;
  snapshotDate?: unknown;
  fallbackReportDate?: unknown;
  now?: unknown;
  sourceKeys?: unknown;
  evidence?: AdsPlatformSourceSyncEvidenceLike[];
  fallbackSourceKeys?: AdsPlatformSourceSyncStatusSourceKey[];
}

export interface AdsPlatformSourceSyncStatusDeeplinkQueryParams extends Params {
  reportDate: string;
  sourceKeys: string;
  now?: string;
}

export function buildAdsPlatformSourceSyncStatusDeeplinkQueryParams(
  input: AdsPlatformSourceSyncStatusDeeplinkInput,
): AdsPlatformSourceSyncStatusDeeplinkQueryParams | null {
  const evidence = Array.isArray(input.evidence) ? input.evidence : [];
  const reportDate = dateOnly(input.reportDate)
    || dateOnly(input.snapshotDate)
    || firstEvidenceReportDate(evidence)
    || dateOnly(input.fallbackReportDate);
  if (!reportDate) return null;

  const requestedSourceKeys = uniqueSourceKeys([
    ...sourceKeysFromUnknown(input.sourceKeys),
    ...sourceKeysFromEvidence(evidence),
  ]);
  const sourceKeys = requestedSourceKeys.length
    ? requestedSourceKeys
    : uniqueSourceKeys(input.fallbackSourceKeys || []);
  if (!sourceKeys.length) return null;

  const now = text(input.now);
  return {
    reportDate,
    sourceKeys: sourceKeys.join(','),
    ...(now ? { now } : {}),
  };
}

function firstEvidenceReportDate(records: AdsPlatformSourceSyncEvidenceLike[]): string {
  for (const record of records) {
    const reportDate = dateOnly(record.reportDate);
    if (reportDate) return reportDate;
  }
  return '';
}

function sourceKeysFromEvidence(
  records: AdsPlatformSourceSyncEvidenceLike[],
): AdsPlatformSourceSyncStatusSourceKey[] {
  return records.flatMap((record) => [
    sourceKeyFromText(record.sourceKey),
    sourceKeyFromText(record.provider),
    sourceKeyFromText(record.sourceKind),
    sourceKeyFromText(record.platform),
  ]).filter((value): value is AdsPlatformSourceSyncStatusSourceKey => Boolean(value));
}

function sourceKeysFromUnknown(value: unknown): AdsPlatformSourceSyncStatusSourceKey[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => sourceKeyFromText(item))
      .filter((item): item is AdsPlatformSourceSyncStatusSourceKey => Boolean(item));
  }

  return text(value)
    .split(',')
    .map((item) => sourceKeyFromText(item))
    .filter((item): item is AdsPlatformSourceSyncStatusSourceKey => Boolean(item));
}

function uniqueSourceKeys(
  values: AdsPlatformSourceSyncStatusSourceKey[],
): AdsPlatformSourceSyncStatusSourceKey[] {
  const seen = new Set<AdsPlatformSourceSyncStatusSourceKey>();
  const ordered: AdsPlatformSourceSyncStatusSourceKey[] = [];
  for (const sourceKey of values) {
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    ordered.push(sourceKey);
  }
  return ordered;
}

function sourceKeyFromText(value: unknown): AdsPlatformSourceSyncStatusSourceKey | null {
  const normalized = text(value).toLowerCase();
  if (!normalized) return null;

  if (
    normalized === 'google'
    || normalized === 'google_ads'
    || normalized.startsWith('google_ads:')
    || normalized.includes('campaign_budget')
    || normalized.includes('campaign')
    || normalized.includes('ad_group')
  ) {
    return 'google_ads';
  }

  if (
    normalized === 'advertising_costs'
    || normalized.includes('advertising_cost')
    || normalized.includes('ad_cost')
  ) {
    return 'advertising_costs';
  }

  if (
    normalized === 'product_mapping'
    || normalized.includes('product_mapping')
    || normalized === 'product'
  ) {
    return 'product_mapping';
  }

  return null;
}

function dateOnly(value: unknown): string {
  const normalized = text(value);
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '';
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}
