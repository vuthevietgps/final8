import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InventorySummaryRow {
  productId: string;
  productName?: string;
  onHand: number;
  avgCost: number;
  updatedAt: string;
}

export interface InventoryTxRow {
  _id: string;
  productId: string;
  type: 'receive'|'adjust'|'sale'|'return';
  quantity: number;
  unitCost?: number;
  purchaseOrderId?: string;
  supplierId?: string;
  occurredAt: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private base = `${environment.apiUrl}/inventory`;
  constructor(private http: HttpClient) {}

  summary(params: { q?: string; page?: number; limit?: number } = {}): Observable<{ data: InventorySummaryRow[]; pagination: any }> {
    let hp = new HttpParams();
    if (params.q) hp = hp.set('q', params.q);
    if (params.page) hp = hp.set('page', String(params.page));
    if (params.limit) hp = hp.set('limit', String(params.limit));
    return this.http.get<{ data: InventorySummaryRow[]; pagination: any }>(`${this.base}/summary`, { params: hp, withCredentials: true });
  }

  transactions(productId: string, params: { page?: number; limit?: number } = {}): Observable<{ data: InventoryTxRow[]; pagination: any }> {
    let hp = new HttpParams();
    if (params.page) hp = hp.set('page', String(params.page));
    if (params.limit) hp = hp.set('limit', String(params.limit));
    return this.http.get<{ data: InventoryTxRow[]; pagination: any }>(`${this.base}/${productId}/transactions`, { params: hp, withCredentials: true });
  }

  adjust(body: { productId: string; quantity: number; unitCost?: number; notes?: string }): Observable<any> {
    return this.http.post(`${this.base}/adjust`, body, { withCredentials: true });
  }
}
