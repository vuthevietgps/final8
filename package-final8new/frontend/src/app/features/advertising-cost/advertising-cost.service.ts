import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdvertisingCost, AdvertisingCostSummary, CreateAdvertisingCost, UpdateAdvertisingCost } from './models/advertising-cost.model';

@Injectable({ providedIn: 'root' })
export class AdvertisingCostService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/advertising-cost`;

  getAll(filter?: { adAccountId?: string }): Observable<AdvertisingCost[]> {
    let params = new HttpParams();
    if (filter?.adAccountId) params = params.set('adAccountId', filter.adAccountId);
    return this.http.get<AdvertisingCost[]>(this.baseUrl, { params });
  }

  getSummary(): Observable<AdvertisingCostSummary> {
    return this.http.get<AdvertisingCostSummary>(this.baseUrl + '/stats/summary');
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
}
