import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SupplierQuote {
  _id?: string;
  productId: string;
  supplierId: string;
  price: number;
  currency?: string;
  isReturnableOverride?: boolean;
  shippingFee?: number;
  returnFee?: number;
  effectiveAt?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdBy?: string;
  lastCommercialEditedBy?: string;
  provenanceComplete?: boolean;
  approvalHistory?: Array<{
    decision: 'created' | 'provenance_claimed' | 'approved' | 'rejected' | 'reset_to_pending';
    actorId: string;
    actorLabel?: string;
    at: string;
    reason?: string;
    priceSnapshot: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class SupplierQuoteApi {
  private baseUrl = `${environment.apiUrl}/supplier-quotes`;
  constructor(private http: HttpClient) {}

  create(payload: Partial<SupplierQuote>): Observable<SupplierQuote> {
    return this.http.post<SupplierQuote>(this.baseUrl, payload, { withCredentials: true });
  }

  update(id: string, payload: Partial<SupplierQuote>): Observable<SupplierQuote> {
    return this.http.patch<SupplierQuote>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload, { withCredentials: true });
  }

  approve(id: string): Observable<SupplierQuote> {
    return this.http.patch<SupplierQuote>(`${this.baseUrl}/${encodeURIComponent(id)}/approve`, {}, { withCredentials: true });
  }

  reject(id: string, reason: string): Observable<SupplierQuote> {
    return this.http.patch<SupplierQuote>(
      `${this.baseUrl}/${encodeURIComponent(id)}/reject`,
      { reason },
      { withCredentials: true },
    );
  }

  claimProvenance(id: string): Observable<SupplierQuote> {
    return this.http.patch<SupplierQuote>(
      `${this.baseUrl}/${encodeURIComponent(id)}/claim-provenance`,
      {},
      { withCredentials: true },
    );
  }

  list(params: {
    productId?: string;
    supplierId?: string;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    page?: number;
    limit?: number;
  } = {}): Observable<{ data: SupplierQuote[]; pagination?: any }> {
    let hp = new HttpParams();
    if (params.productId) hp = hp.set('productId', params.productId);
    if (params.supplierId) hp = hp.set('supplierId', params.supplierId);
    if (params.approvalStatus) hp = hp.set('approvalStatus', params.approvalStatus);
    if (params.page) hp = hp.set('page', params.page);
    if (params.limit) hp = hp.set('limit', params.limit);
    return this.http.get<{ data: SupplierQuote[]; pagination?: any }>(this.baseUrl, { params: hp, withCredentials: true });
  }

  latest(productId: string, supplierId: string): Observable<SupplierQuote> {
    const hp = new HttpParams().set('productId', productId).set('supplierId', supplierId);
    return this.http.get<SupplierQuote>(`${this.baseUrl}/latest`, { params: hp, withCredentials: true });
  }
}
