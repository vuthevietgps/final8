import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type ConnectionKind = 'windsor-facebook' | 'windsor-google' | 'bird-messenger';
export interface ConnectionInput {
  kind: ConnectionKind; name: string; revision: number; state: 'configured' | 'disabled';
  accountIds: string[]; apiKey?: string; signingSecret?: string;
  birdApi?: 'bird-v1' | 'messagebird-v1'; workspaceId?: string; channelId?: string; pageId?: string;
}
export interface ProviderConnection extends Omit<ConnectionInput, 'apiKey' | 'signingSecret'> {
  id: string; hasApiKey: boolean; hasSigningSecret: boolean; checkedAt?: string;
  lastReadSyncAt?: string; lastReadSyncStatus?: 'success' | 'partial' | 'failed'; lastReadSyncRunId?: string;
  liveWriteEnabled: false; messagingEnabled: false;
  check?: { status: string; code: string; accounts?: Array<{ id: string; name: string }>;
    actions?: string[]; selectedAccountsMissing?: string[]; actionDiscovery?: string; readAccessConfirmed?: boolean };
}
export interface WindsorAdsSyncResult {
  catalog?: WindsorCatalogResult;
  estimation?: { rows: number; unresolved: Array<{ accountId: string; date: string }> };
  projections?: Array<{ day: string; complete: boolean }>;
  runId: string; status: 'success' | 'partial' | 'failed'; dateFrom: string; dateTo: string;
  accountIds: string[]; counts: { requests: number; rows: number; resources: number; dailyMetrics: number; skippedMetricRows: number };
  errors: Array<{ accountId?: string; date?: string; code: string }>;
  materialization: { status: 'success' | 'skipped'; reason?: string; rows: number; updated: number; upserted?: number; modified?: number };
}
export interface WindsorCatalogResult {
  status: 'success' | 'partial' | 'failed'; accounts: number; groups: number;
  conflicts: Array<{ type: string; providerId: string; code: string }>;
}
export interface WindsorAdsSnapshot {
  estimatedRows?: number;
  estimatedSpend?: number;
  source: 'windsor'; provider: 'google'; connector: 'google_ads'; dateFrom: string; dateTo: string;
  summary: { spend: number; impressions: number; clicks: number; conversions: number; conversionValue: number; rows: number; currencies: string[] };
  rows: unknown[]; resources: unknown[]; truncated?: boolean; materializedRows: number;
  materializedToAdvertisingCost: boolean; primaryCostSource: 'windsor' | 'native';
}

@Injectable({ providedIn: 'root' })
export class ProviderConnectionsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/provider-connections`;
  list() { return this.http.get<ProviderConnection[]>(this.url); }
  status() { return this.http.get<{ storageEnabled: boolean; reason: string }>(`${this.url}/configuration-status`); }
  pages() { return this.http.get<Array<{ pageId: string; name: string }>>(`${this.url}/fanpages`); }
  save(id: string | undefined, body: ConnectionInput) {
    return id ? this.http.patch<ProviderConnection>(`${this.url}/${id}`, body)
      : this.http.post<ProviderConnection>(this.url, body);
  }
  check(id: string) { return this.http.post<ProviderConnection>(`${this.url}/${id}/check`, {}); }
  syncAds(id: string, body: { dateFrom?: string; dateTo?: string } = {}) {
    return this.http.post<WindsorAdsSyncResult>(`${this.url}/${id}/ads-read-sync`, body);
  }
  snapshot(id: string, query: { dateFrom?: string; dateTo?: string; accountId?: string } = {}) {
    return this.http.get<WindsorAdsSnapshot>(`${this.url}/${id}/ads-snapshot`, { params: query });
  }
  syncCatalog(id: string) {
    return this.http.post<WindsorCatalogResult>(`${this.url}/${id}/ads-catalog-sync`, {});
  }
}
