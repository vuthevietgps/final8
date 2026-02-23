import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PurchaseItem {
  _id?: string;
  productId: string;
  productNameSnap?: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  quantityReceived?: number;
  notes?: string;
}

export interface PurchaseOrder {
  _id: string;
  poNumber?: string;
  supplierId: string;
  supplierNameSnap?: string;
  status: 'draft'|'ordered'|'partially_received'|'received'|'cancelled';
  expectedDeliveryDate?: string;
  receivedDate?: string;
  items: PurchaseItem[];
  itemsTotal: number;
  tax: number;
  shippingFee: number;
  discount: number;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface CreatePODto {
  supplierId: string;
  supplierNameSnap?: string;
  items: Array<Pick<PurchaseItem,'productId'|'productNameSnap'|'quantity'|'unitPrice'|'currency'|'notes'>>;
  expectedDeliveryDate?: string;
  tax?: number;
  shippingFee?: number;
  discount?: number;
  notes?: string;
  status?: PurchaseOrder['status'];
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrderApi {
  private base = `${environment.apiUrl}/purchase-orders`;
  constructor(private http: HttpClient) {}

  list(params: { supplierId?: string; status?: string; page?: number; limit?: number } = {}): Observable<{ data: PurchaseOrder[]; pagination: any }> {
    let hp = new HttpParams();
    if (params.supplierId) hp = hp.set('supplierId', params.supplierId);
    if (params.status) hp = hp.set('status', params.status);
    if (params.page) hp = hp.set('page', String(params.page));
    if (params.limit) hp = hp.set('limit', String(params.limit));
    return this.http.get<{ data: PurchaseOrder[]; pagination: any }>(this.base, { params: hp, withCredentials: true });
  }

  get(id: string): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${this.base}/${id}`, { withCredentials: true });
  }

  create(dto: CreatePODto): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(this.base, dto, { withCredentials: true });
  }

  update(id: string, dto: Partial<CreatePODto>): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.base}/${id}`, dto, { withCredentials: true });
  }

  remove(id: string): Observable<PurchaseOrder> {
    return this.http.delete<PurchaseOrder>(`${this.base}/${id}`, { withCredentials: true });
  }

  receive(id: string, items: { itemId: string; qtyReceived: number }[]): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/${id}/receive`, { items }, { withCredentials: true });
  }
}
