import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdvertisingCost, AdvertisingCostSummary, CreateAdvertisingCost, UpdateAdvertisingCost } from './models/advertising-cost.model';

@Injectable({ providedIn: 'root' })
export class AdvertisingCostService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/advertising-cost`;

  getAll(filter?: { adAccountId?: string; channel?: string }): Observable<AdvertisingCost[]> {
    let params = new HttpParams();
    if (filter?.adAccountId) params = params.set('adAccountId', filter.adAccountId);
    if (filter?.channel && filter.channel !== 'all') params = params.set('channel', filter.channel);
    return this.http.get<AdvertisingCost[]>(this.baseUrl, { params });
  }

  getSummary(channel?: string): Observable<AdvertisingCostSummary> {
    let params = new HttpParams();
    if (channel && channel !== 'all') params = params.set('channel', channel);
    return this.http.get<AdvertisingCostSummary>(this.baseUrl + '/stats/summary', { params });
  }

  create(data: CreateAdvertisingCost): Observable<AdvertisingCost> {
    return this.http.post<AdvertisingCost>(this.baseUrl, data);
  }

  update(id: string, data: UpdateAdvertisingCost): Observable<AdvertisingCost> {
    return this.http.patch<AdvertisingCost>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  uploadFacebookExcel(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.baseUrl}/upload-facebook-excel`, formData);
  }

  // Gọi API đồng bộ chi phí từ Facebook theo ngày hoặc khoảng N ngày
  fetchFacebookCost(options?: { date?: string; days?: number }): Observable<any> {
    let params = new HttpParams();
    if (options?.date) params = params.set('date', options.date);
    if (options?.days != null) params = params.set('days', String(options.days));
    return this.http.post<any>(`${this.baseUrl}/fetch/facebook`, {}, { params });
  }

  // Đồng bộ chi phí Google Ads (theo ngày hoặc khoảng ngày)
  fetchGoogleCost(options?: { date?: string; days?: number; customerIds?: string[] }): Observable<any> {
    let params = new HttpParams();
    if (options?.date) params = params.set('date', options.date);
    if (options?.days != null) params = params.set('days', String(options.days));
    if (options?.customerIds && options.customerIds.length) {
      params = params.set('customerIds', options.customerIds.join(','));
    }
    return this.http.post<any>(`${this.baseUrl}/fetch/google`, {}, { params });
  }

  // Đồng bộ chi phí TikTok Ads (theo ngày hoặc khoảng ngày)
  fetchTikTokCost(options?: { date?: string; days?: number }): Observable<any> {
    let params = new HttpParams();
    if (options?.date) params = params.set('date', options.date);
    if (options?.days != null) params = params.set('days', String(options.days));
    return this.http.post<any>(`${this.baseUrl}/fetch/tiktok`, {}, { params });
  }

  // Lấy tổng chi phí theo adGroupId từ collection AdvertisingCost
  getTotalSpentByAdGroup(adGroupId: string): Observable<{ totalSpent: number }> {
    let params = new HttpParams().set('adGroupId', adGroupId);
    return this.http.get<{ totalSpent: number }>(`${this.baseUrl}/stats/by-adgroup`, { params });
  }

  // Lấy chi phí trên mỗi hội thoại theo adGroupId
  getConversationCostByAdGroup(adGroupId: string): Observable<{ 
    totalSpent: number; 
    conversationCount: number; 
    costPerConversation: number 
  }> {
    let params = new HttpParams().set('adGroupId', adGroupId);
    return this.http.get<{ 
      totalSpent: number; 
      conversationCount: number; 
      costPerConversation: number 
    }>(`${this.baseUrl}/stats/conversation-cost`, { params });
  }
}
