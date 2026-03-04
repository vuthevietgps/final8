/**
 * File: features/ad-group/ad-group.service.ts
 * Mục đích: Service giao tiếp API Nhóm Quảng Cáo.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AdGroup, CreateAdGroup, UpdateAdGroup, AdGroupRecommendation } from './models/ad-group.model';
import { environment } from '../../../environments/environment';
import { Product } from '../product/models/product.interface';

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
    return this.http.get<AdGroup[]>(this.apiUrl, { params, withCredentials: true });
  }

  create(data: CreateAdGroup): Observable<AdGroup> {
    return this.http.post<AdGroup>(this.apiUrl, data, { withCredentials: true });
  }

  update(id: string, data: UpdateAdGroup): Observable<AdGroup> {
    return this.http.patch<AdGroup>(`${this.apiUrl}/${id}`, data, { withCredentials: true });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  getRecommendations(): Observable<AdGroupRecommendation[]> {
    return this.http.get<AdGroupRecommendation[]>(`${this.apiUrl}/recommendations`, { withCredentials: true });
  }

  applyRecommendations(ids: string[]): Observable<{ applied: any[]; failed: any[] }> {
    return this.http.post<{ applied: any[]; failed: any[] }>(`${this.apiUrl}/recommendations/apply`, { ids }, { withCredentials: true });
  }

  search(filter: { q?: string; platform?: string; productId?: string; agentId?: string; adAccountId?: string; status?: 'all'|'active'|'inactive' }): Observable<AdGroup[]> {
    let params = new HttpParams();
    if (filter.q) params = params.set('q', filter.q);
    if (filter.platform) params = params.set('platform', filter.platform);
    if (filter.productId) params = params.set('productId', filter.productId);
    if (filter.agentId) params = params.set('agentId', filter.agentId);
    if (filter.adAccountId) params = params.set('adAccountId', filter.adAccountId);
    if (filter.status) params = params.set('status', filter.status);
    return this.http.get<AdGroup[]>(`${this.apiUrl}/search`, { params, withCredentials: true });
  }

  getCountsByProduct(): Observable<Array<{ productId: string; productName: string; active: number; inactive: number }>> {
    return this.http.get<Array<{ productId: string; productName: string; active: number; inactive: number }>>(
      `${this.apiUrl}/stats/counts-by-product`,
      { withCredentials: true }
    );
  }

  getProductsByCategory(categoryId: string): Observable<Product[]> {
    return this.http
      .get<{ success: boolean; data: Product[] }>(`${this.apiUrl}/products-by-category/${categoryId}`, { withCredentials: true })
      .pipe(map(res => res?.data || []));
  }

  // ==========================================
  // AUTO-DISCOVER & SYNC METHODS
  // ==========================================

  /**
   * Lấy trạng thái sync của tất cả ad accounts
   */
  getSyncStatus(): Observable<{
    accounts: Array<{
      accountId: string;
      name: string;
      accountType: string;
      lastSyncAt?: string;
      lastSyncStatus?: string;
      lastSyncError?: string;
      adGroupCount: number;
    }>;
  }> {
    return this.http.get<any>(`${this.apiUrl}/sync/status`, { withCredentials: true });
  }

  /**
   * Auto-discover: Lấy danh sách ad groups từ Facebook
   */
  discoverAdGroups(adAccountId: string): Observable<{
    success: boolean;
    adAccountId: string;
    discovered: Array<{
      adGroupId: string;
      name: string;
      status: string;
      effectiveStatus: string;
      dailyBudget: number;
      campaignId?: string;
      existsInDb: boolean;
    }>;
    error?: string;
  }> {
    return this.http.get<any>(`${this.apiUrl}/discover/${adAccountId}`, { withCredentials: true });
  }

  /**
   * Auto-import: Import các ad groups đã chọn vào hệ thống
   */
  importAdGroups(params: {
    adAccountId: string;
    adGroupIds: string[];
    fanpageId: string;
    productCategoryId: string;
    selectedProductId?: string;
    agentId: string;
  }): Observable<{ success: boolean; imported: number; skipped: number; errors: string[] }> {
    return this.http.post<any>(`${this.apiUrl}/import`, params, { withCredentials: true });
  }

  /**
   * Trigger sync thủ công
   */
  triggerSync(adAccountId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.apiUrl}/sync/${adAccountId}`, {}, { withCredentials: true });
  }
}
