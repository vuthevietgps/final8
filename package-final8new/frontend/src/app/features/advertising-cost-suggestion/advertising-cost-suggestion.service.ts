/**
 * File: advertising-cost-suggestion.service.ts
 * Mục đích: Service để giao tiếp với backend API cho đề xuất chi phí quảng cáo
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  AdvertisingCostSuggestion, 
  AdvertisingCostSuggestionStatistics,
  CreateAdvertisingCostSuggestionRequest,
  UpdateAdvertisingCostSuggestionRequest
} from './models/advertising-cost-suggestion.interface';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AdvertisingCostSuggestionService {
  private apiUrl = `${environment.apiUrl}/advertising-cost-suggestion`;

  constructor(private http: HttpClient) {}

  // Lấy tất cả đề xuất chi phí
  getAllSuggestions(): Observable<ApiResponse<AdvertisingCostSuggestion[]>> {
    return this.http.get<ApiResponse<AdvertisingCostSuggestion[]>>(this.apiUrl);
  }

  // Lấy đề xuất chi phí theo ID
  getSuggestionById(id: string): Observable<ApiResponse<AdvertisingCostSuggestion>> {
    return this.http.get<ApiResponse<AdvertisingCostSuggestion>>(`${this.apiUrl}/${id}`);
  }

  // Lấy đề xuất chi phí theo Ad Group ID
  getSuggestionByAdGroupId(adGroupId: string): Observable<ApiResponse<AdvertisingCostSuggestion | null>> {
    return this.http.get<ApiResponse<AdvertisingCostSuggestion | null>>(`${this.apiUrl}/ad-group/${adGroupId}`);
  }

  // Tạo đề xuất chi phí mới
  createSuggestion(request: CreateAdvertisingCostSuggestionRequest): Observable<ApiResponse<AdvertisingCostSuggestion>> {
    return this.http.post<ApiResponse<AdvertisingCostSuggestion>>(this.apiUrl, request);
  }

  // Cập nhật đề xuất chi phí
  updateSuggestion(id: string, request: UpdateAdvertisingCostSuggestionRequest): Observable<ApiResponse<AdvertisingCostSuggestion>> {
    return this.http.patch<ApiResponse<AdvertisingCostSuggestion>>(`${this.apiUrl}/${id}`, request);
  }

  // Cập nhật chi phí hàng ngày
  updateDailyCost(adGroupId: string, dailyCost: number): Observable<ApiResponse<AdvertisingCostSuggestion | null>> {
    return this.http.patch<ApiResponse<AdvertisingCostSuggestion | null>>(`${this.apiUrl}/daily-cost/${adGroupId}`, { dailyCost });
  }

  // Xóa đề xuất chi phí
  deleteSuggestion(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  // Lấy thống kê
  getStatistics(): Observable<ApiResponse<AdvertisingCostSuggestionStatistics>> {
    return this.http.get<ApiResponse<AdvertisingCostSuggestionStatistics>>(`${this.apiUrl}/statistics`);
  }
}