import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdGroupDailyReportResponse, TopAdGroup, OptimalSpendResponse } from './ad-group-daily-report.model';

@Injectable({ providedIn: 'root' })
export class AdGroupDailyReportService {
  private api = `${environment.apiUrl}/ad-group-daily-report`;

  constructor(private http: HttpClient) {}

  getReport(params: {
    fromDate?: string;
    toDate?: string;
    adGroupId?: string;
    platform?: string;
  }): Observable<AdGroupDailyReportResponse> {
    let httpParams = new HttpParams();
    if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params.adGroupId) httpParams = httpParams.set('adGroupId', params.adGroupId);
    if (params.platform) httpParams = httpParams.set('platform', params.platform);

    return this.http.get<AdGroupDailyReportResponse>(this.api, { params: httpParams });
  }

  getTopAdGroups(params: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
    sortBy?: 'profit' | 'adsCost';
  }): Observable<{ topAdGroups: TopAdGroup[] }> {
    let httpParams = new HttpParams();
    if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);

    return this.http.get<{ topAdGroups: TopAdGroup[] }>(`${this.api}/top`, { params: httpParams });
  }

  /**
   * Lấy gợi ý chi phí tối ưu cho tất cả ad groups
   * Dựa trên thuật toán lợi nhuận biên giảm dần
   */
  getOptimalSpendSuggestions(): Observable<OptimalSpendResponse> {
    return this.http.get<OptimalSpendResponse>(`${this.api}/optimal-spend`);
  }

  /**
   * Đồng bộ dữ liệu thủ công cho một ngày cụ thể
   */
  syncData(date?: string): Observable<{ success: boolean; date: string; recordsProcessed: number }> {
    let httpParams = new HttpParams();
    if (date) httpParams = httpParams.set('date', date);

    return this.http.post<{ success: boolean; date: string; recordsProcessed: number }>(
      `${this.api}/sync`,
      {},
      { params: httpParams }
    );
  }
}
