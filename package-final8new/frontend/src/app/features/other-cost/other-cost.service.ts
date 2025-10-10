/**
 * File: features/other-cost/other-cost.service.ts
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateOtherCost, OtherCost, OtherCostSummary, UpdateOtherCost } from './models/other-cost.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OtherCostService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/other-cost`;

  getAll(params?: { from?: string; to?: string }): Observable<OtherCost[]> {
    const { from, to } = params || {};
  const url = new URL(this.baseUrl, window.location.origin);
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
    return this.http.get<OtherCost[]>(url.toString());
  }

  getSummary(params?: { from?: string; to?: string }): Observable<OtherCostSummary> {
    const { from, to } = params || {};
  const url = new URL(this.baseUrl + '/summary', window.location.origin);
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
    return this.http.get<OtherCostSummary>(url.toString());
  }

  create(data: CreateOtherCost): Observable<OtherCost> {
    return this.http.post<OtherCost>(this.baseUrl, data);
  }

  update(id: string, data: UpdateOtherCost): Observable<OtherCost> {
    return this.http.patch<OtherCost>(`${this.baseUrl}/${id}`, data);
    }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
