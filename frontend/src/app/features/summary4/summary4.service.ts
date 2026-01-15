import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Summary4, Summary4Filter, Summary4Response, Summary4Stats, UpdateManualPayment, AgentSummary } from './models/summary4.interface';

@Injectable({
  providedIn: 'root'
})
export class Summary4Service {
  private apiUrl = `${environment.apiUrl}/summary4`;

  constructor(private http: HttpClient) {}

  private buildParams(filter: Summary4Filter = {}, includePagination = false): HttpParams {
    let params = new HttpParams();
    if (!filter) return params;

    if (includePagination) {
      if (filter.page) params = params.set('page', String(filter.page));
      if (filter.limit) params = params.set('limit', String(filter.limit));
    }

    if (filter.sortBy) params = params.set('sortBy', filter.sortBy);
    if (filter.sortOrder) params = params.set('sortOrder', filter.sortOrder);
    if (filter.agentId) params = params.set('agentId', filter.agentId);
    if (filter.agentName) params = params.set('agentName', filter.agentName);
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.productionStatus) params = params.set('productionStatus', filter.productionStatus);
    if (filter.orderStatus) params = params.set('orderStatus', filter.orderStatus);
    if (filter.productId) params = params.set('productId', filter.productId);
    if (filter.productName) params = params.set('productName', filter.productName);
    if (filter.customerName) params = params.set('customerName', filter.customerName);
    if (filter.paymentStatus && filter.paymentStatus !== 'all') {
      params = params.set('paymentStatus', filter.paymentStatus);
    }
    if (filter.adGroupId) params = params.set('adGroupId', filter.adGroupId);
    return params;
  }

  findAll(filter: Summary4Filter = {}): Observable<Summary4Response> {
    const params = this.buildParams(filter, true);
    return this.http.get<Summary4Response>(this.apiUrl, { params, withCredentials: true });
  }

  findOne(id: string): Observable<Summary4> {
    return this.http.get<Summary4>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  updateManualPayment(id: string, data: UpdateManualPayment): Observable<Summary4> {
    return this.http.patch<Summary4>(`${this.apiUrl}/${id}/manual-payment`, data, { withCredentials: true });
  }

  updateCollection(id: string, data: { status?: string; collectedAmount?: number; receivableAmount?: number }): Observable<Summary4> {
    return this.http.patch<Summary4>(`${this.apiUrl}/${id}/collection`, data, { withCredentials: true });
  }

  getStats(): Observable<Summary4Stats> {
    return this.http.get<Summary4Stats>(`${this.apiUrl}/stats`, { withCredentials: true });
  }

  syncFromTestOrder2(): Observable<{processed: number; updated: number; errors: string[]}> {
    return this.http.post<{processed: number; updated: number; errors: string[]}>(`${this.apiUrl}/sync`, {}, { withCredentials: true });
  }

  exportUnpaidToExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export-unpaid`, { 
      responseType: 'blob',
      withCredentials: true
    });
  }

  exportFilteredToExcel(filter: Summary4Filter = {}): Observable<Blob> {
    const params = this.buildParams(filter, false);
    return this.http.get(`${this.apiUrl}/export`, {
      responseType: 'blob',
      withCredentials: true,
      params
    });
  }

  exportManualPaymentTemplate(filter: Summary4Filter = {}): Observable<Blob> {
    const params = this.buildParams(filter, false);
    return this.http.get(`${this.apiUrl}/export-manual-payment-template`, { 
      responseType: 'blob',
      withCredentials: true,
      params
    });
  }

  importManualPaymentFromExcel(file: File): Observable<{processed: number; updated: number; errors: string[]}> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{processed: number; updated: number; errors: string[]}>(`${this.apiUrl}/import-manual-payment`, formData, { 
      withCredentials: true
    });
  }

  getAgents(): Observable<AgentSummary[]> {
    return this.http.get<AgentSummary[]>(`${this.apiUrl}/agents`, { withCredentials: true });
  }
}