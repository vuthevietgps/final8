/**
 * File: facebook-ads-sync.service.ts
 * Mục đích: Service gọi API Facebook Ads Sync từ frontend
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FacebookSyncResult {
  success: number;
  failed: number;
  errors: string[];
  synced: Array<{
    adGroupId: string;
    date: string;
    spend: number;
    cpm: number;
    cpc: number;
    impressions: number;
    clicks: number;
  }>;
}

export interface SyncRequest {
  accessToken: string;
  accountId?: string;
  since?: string;
  until?: string;
}

@Injectable({ providedIn: 'root' })
export class FacebookAdsSyncService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/facebook-ads-sync`;

  /**
   * Sync tất cả ad accounts
   */
  syncAll(request: SyncRequest): Observable<FacebookSyncResult> {
    return this.http.post<FacebookSyncResult>(`${this.baseUrl}/sync-all`, request);
  }

  /**
   * Sync một ad account cụ thể
   */
  syncAccount(request: SyncRequest): Observable<FacebookSyncResult> {
    return this.http.post<FacebookSyncResult>(`${this.baseUrl}/sync-account`, request);
  }

  /**
   * Sync ngày hôm qua
   */
  syncYesterday(accessToken: string): Observable<FacebookSyncResult> {
    return this.http.post<FacebookSyncResult>(`${this.baseUrl}/sync-yesterday`, { accessToken });
  }

  /**
   * Sync tuần trước
   */
  syncLastWeek(accessToken: string): Observable<FacebookSyncResult> {
    return this.http.post<FacebookSyncResult>(`${this.baseUrl}/sync-last-week`, { accessToken });
  }

  /**
   * Sync theo khoảng thời gian
   */
  syncRange(request: SyncRequest): Observable<FacebookSyncResult> {
    return this.http.post<FacebookSyncResult>(`${this.baseUrl}/sync-range`, request);
  }

  /**
   * Sync sử dụng default token từ database
   */
  syncWithDefaultToken(request?: { since?: string; until?: string }): Observable<FacebookSyncResult> {
    return this.http.post<FacebookSyncResult>(`${this.baseUrl}/sync-default`, request || {});
  }

  /**
   * Test kết nối Facebook API
   */
  test(accessToken: string, accountId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/test`, {
      params: { accessToken, accountId }
    });
  }
}