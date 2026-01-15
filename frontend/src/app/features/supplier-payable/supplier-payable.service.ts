import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface SupplierPayable {
  _id: string;
  supplierId: string;
  supplierName?: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: string;
  dueDate?: string;
  notes?: string;
  payments?: any[];
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class SupplierPayableService {
  private baseUrl = `${environment.apiUrl}/supplier-payables`;
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
}
