import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PurchaseOrderStatus = 'draft'|'ordered'|'partially_received'|'received'|'cancelled';

export interface PurchaseItemInput {
  productId: string;
  productNameSnap?: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  notes?: string;
}

export interface CreatePurchaseOrderDto {
  supplierId: string;
  items: PurchaseItemInput[];
  expectedDeliveryDate?: string;
  shippingFee?: number;
  discount?: number;
  tax?: number;
  notes?: string;
  status?: PurchaseOrderStatus;
}

export interface ReceiveItemDto { itemId: string; qty: number; }

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private baseUrl = `${environment.apiUrl}/purchase-orders`;
  constructor(private http: HttpClient) {}

  list(params: { supplierId?: string; status?: string; page?: number; limit?: number } = {}) {
    let hp = new HttpParams();
    if (params.supplierId) hp = hp.set('supplierId', params.supplierId);
    if (params.status) hp = hp.set('status', params.status);
    if (params.page) hp = hp.set('page', String(params.page));
    if (params.limit) hp = hp.set('limit', String(params.limit));
    return this.http.get<{ data: any[]; pagination: any }>(this.baseUrl, { params: hp, withCredentials: true });
  }

  create(dto: CreatePurchaseOrderDto): Observable<any> {
    return this.http.post(this.baseUrl, dto, { withCredentials: true });
  }

  get(id: string): Observable<any> { return this.http.get(`${this.baseUrl}/${id}`, { withCredentials: true }); }

  update(id: string, dto: Partial<CreatePurchaseOrderDto>): Observable<any> { return this.http.patch(`${this.baseUrl}/${id}`, dto, { withCredentials: true }); }

  receive(id: string, items: ReceiveItemDto[], receivedAt: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/receive`, { items, receivedAt }, { withCredentials: true });
  }

  supplierProductReport(params: { from?: string; to?: string; supplierId?: string; productId?: string }) {
    let hp = new HttpParams();
    if (params.from) hp = hp.set('from', params.from);
    if (params.to) hp = hp.set('to', params.to);
    if (params.supplierId) hp = hp.set('supplierId', params.supplierId);
    if (params.productId) hp = hp.set('productId', params.productId);
    return this.http.get<any[]>(`${this.baseUrl}/supplier-product-report`, { params: hp, withCredentials: true });
  }
}
