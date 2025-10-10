/**
 * Service gọi API /profit-forecast
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProfitForecastRow, ProfitForecastSummaryResult } from './models/profit-forecast.interface';

@Injectable({ providedIn: 'root' })
export class ProfitForecastService {
  private baseUrl = `${environment.apiUrl}/profit-forecast`;
  constructor(private http: HttpClient) {}

  private buildParams(params: { from?: string; to?: string; adGroupId?: string }): HttpParams {
    let p = new HttpParams();
    if (params.from) p = p.set('from', params.from);
    if (params.to) p = p.set('to', params.to);
    if (params.adGroupId) p = p.set('adGroupId', params.adGroupId);
    return p;
  }

  getForecastWithCost(params: { from?: string; to?: string; adGroupId?: string }): Observable<ProfitForecastRow[]> {
    return this.http.get<ProfitForecastRow[]>(`${this.baseUrl}/ad-group-with-cost`, { params: this.buildParams(params) });
  }

  getSummary(params: { from?: string; to?: string; adGroupId?: string }): Observable<ProfitForecastSummaryResult> {
    return this.http.get<ProfitForecastSummaryResult>(`${this.baseUrl}/summary`, { params: this.buildParams(params) });
  }

  getSnapshots(params: { from?: string; to?: string; adGroupId?: string }) {
    return this.http.get<any[]>(`${this.baseUrl}/snapshots`, { params: this.buildParams(params) });
  }

  runSnapshots(params: { from?: string; to?: string; adGroupId?: string }) {
    return this.http.get<{ inserted: number; updated: number }>(`${this.baseUrl}/snapshot/run`, { params: this.buildParams(params) });
  }
}
