import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface SupplierPayable {
  _id: string;
  supplierId: string;
  supplierName?: string;
  supplierNameSnap?: string;
  orderId?: string;
  items?: Array<{ productId?: string; productNameSnap?: string; quantity?: number; unitPrice?: number; amount?: number }>;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: string;
  dueDate?: string;
  notes?: string;
  payments?: any[];
  createdAt?: string;
}

export interface SupplierStatement {
  _id: string;
  supplierId: string;
  periodFrom: string;
  periodTo: string;
  status: 'open' | 'closed';
  openingBalance: number;
  periodPayables: number;
  periodPayments: number;
  periodCodCollected: number;
  statementPaymentTotal: number;
  closingBalance: number;
  netAfterCod: number;
  notes?: string;
  payments?: Array<{
    amount: number;
    paidAt: string;
    method?: string;
    reference?: string;
    notes?: string;
    createdBy?: string;
    documents?: string[];
  }>;
}

@Injectable({ providedIn: 'root' })
export class SupplierPayableService {
  public baseUrl = `${environment.apiUrl}/supplier-payables`;
  constructor(private http: HttpClient) {}

  list(params: { supplierId?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }) {
    let hp = new HttpParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
    });
    return this.http.get<{ data: SupplierPayable[]; pagination: any }>(this.baseUrl, { params: hp, withCredentials: true });
  }

  addPayment(id: string, payload: { amount: number; paidAt: string; method?: string; reference?: string; notes?: string }) {
    return this.http.post<SupplierPayable>(`${this.baseUrl}/${id}/payments`, payload, { withCredentials: true });
  }

  listStatements(params: { supplierId?: string; from?: string; to?: string; status?: string }) {
    let hp = new HttpParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
    });
    return this.http.get<SupplierStatement[]>(`${this.baseUrl}/statements`, { params: hp, withCredentials: true });
  }

  upsertStatement(payload: { supplierId: string; from: string; to: string; notes?: string }) {
    return this.http.post<SupplierStatement>(`${this.baseUrl}/statements`, payload, { withCredentials: true });
  }

  addStatementPayment(id: string, payload: { amount: number; paidAt: string; method?: string; reference?: string; notes?: string; createdBy?: string; documents?: string[] }) {
    return this.http.post<SupplierStatement>(`${this.baseUrl}/statements/${id}/payments`, payload, { withCredentials: true });
  }

  closeStatement(id: string) {
    return this.http.patch<SupplierStatement>(`${this.baseUrl}/statements/${id}/close`, {}, { withCredentials: true });
  }

  /**
   * Reopen closed statement (Director only)
   */
  reopenStatement(id: string) {
    return this.http.patch<SupplierStatement>(`${this.baseUrl}/statements/${id}/reopen`, {}, { withCredentials: true });
  }
}
