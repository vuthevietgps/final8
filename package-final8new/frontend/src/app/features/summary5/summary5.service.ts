import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Summary5, Summary5Filter, Summary5Response, Summary5Stats } from './models/summary5.interface';

@Injectable({ providedIn: 'root' })
export class Summary5Service {
  private apiUrl = `${environment.apiUrl}/summary5`;
  constructor(private http: HttpClient) {}

  findAll(filter: Summary5Filter = {}): Observable<Summary5Response> {
    let params = new HttpParams();
    if (filter.agentId) params = params.set('agentId', filter.agentId);
    if (filter.productId) params = params.set('productId', filter.productId);
    if (filter.productionStatus) params = params.set('productionStatus', filter.productionStatus);
    if (filter.orderStatus) params = params.set('orderStatus', filter.orderStatus);
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.page) params = params.set('page', String(filter.page));
    if (filter.limit) params = params.set('limit', String(filter.limit));
    if (filter.sortBy) params = params.set('sortBy', filter.sortBy);
    if (filter.sortOrder) params = params.set('sortOrder', filter.sortOrder);
    return this.http.get<Summary5Response>(this.apiUrl, { params });
  }

  getStats(startDate?: string, endDate?: string): Observable<Summary5Stats> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<Summary5Stats>(`${this.apiUrl}/stats`, { params });
  }

  sync(startDate?: string, endDate?: string) {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.post<{ synced: number }>(`${this.apiUrl}/sync`, {}, { params });
  }
}
