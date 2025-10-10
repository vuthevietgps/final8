/**
 * File: features/ad-group/ad-group.service.ts
 * Mục đích: Service giao tiếp API Nhóm Quảng Cáo.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdGroup, CreateAdGroup, UpdateAdGroup } from './models/ad-group.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdGroupService {
  private apiUrl = `${environment.apiUrl}/ad-groups`;

  constructor(private http: HttpClient) {}

  getAll(filter?: { platform?: string; productId?: string; agentId?: string; adAccountId?: string; isActive?: boolean }): Observable<AdGroup[]> {
    let params = new HttpParams();
    if (filter?.platform) params = params.set('platform', filter.platform);
    if (filter?.productId) params = params.set('productId', filter.productId);
    if (filter?.agentId) params = params.set('agentId', filter.agentId);
    if (filter?.adAccountId) params = params.set('adAccountId', filter.adAccountId);
    if (filter?.isActive !== undefined) params = params.set('isActive', String(filter.isActive));
    return this.http.get<AdGroup[]>(this.apiUrl, { params });
  }

  create(data: CreateAdGroup): Observable<AdGroup> {
    return this.http.post<AdGroup>(this.apiUrl, data);
  }

  update(id: string, data: UpdateAdGroup): Observable<AdGroup> {
    return this.http.patch<AdGroup>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  search(filter: { q?: string; platform?: string; productId?: string; agentId?: string; adAccountId?: string; status?: 'all'|'active'|'inactive' }): Observable<AdGroup[]> {
    let params = new HttpParams();
    if (filter.q) params = params.set('q', filter.q);
    if (filter.platform) params = params.set('platform', filter.platform);
    if (filter.productId) params = params.set('productId', filter.productId);
    if (filter.agentId) params = params.set('agentId', filter.agentId);
    if (filter.adAccountId) params = params.set('adAccountId', filter.adAccountId);
    if (filter.status) params = params.set('status', filter.status);
    return this.http.get<AdGroup[]>(`${this.apiUrl}/search`, { params });
  }

  getCountsByProduct(): Observable<Array<{ productId: string; active: number; inactive: number }>> {
    return this.http.get<Array<{ productId: string; active: number; inactive: number }>>(
      `${this.apiUrl}/stats/counts-by-product`
    );
  }
}
