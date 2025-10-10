/**
 * File: features/ad-group-profit/ad-group-profit.service.ts
 * Mục đích: Service để gọi API báo cáo lợi nhuận nhóm quảng cáo
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdGroupProfitReport, AdGroupProfitStats } from './models/ad-group-profit.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdGroupProfitService {
  private readonly apiUrl = `${environment.apiUrl}/ad-group-profit`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy báo cáo lợi nhuận theo nhóm quảng cáo
   */
  getReport(params: {
    from?: string;
    to?: string;
    agentId?: string;
  }): Observable<AdGroupProfitReport[]> {
    let httpParams = new HttpParams();
    
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.agentId) httpParams = httpParams.set('agentId', params.agentId);

    return this.http.get<AdGroupProfitReport[]>(`${this.apiUrl}/report`, { params: httpParams });
  }

  /**
   * Lấy thống kê tổng quan
   */
  getStats(params: {
    from?: string;
    to?: string;
    agentId?: string;
  }): Observable<AdGroupProfitStats> {
    let httpParams = new HttpParams();
    
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.agentId) httpParams = httpParams.set('agentId', params.agentId);

    return this.http.get<AdGroupProfitStats>(`${this.apiUrl}/stats`, { params: httpParams });
  }
}
