/** Service: PendingOrderService - thao tác pending orders từ Conversation UI */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { catchError, map } from 'rxjs';

export interface PendingOrder {
  _id?: string;
  fanpageId?: string;
  senderPsid?: string;
  productId?: string;
  agentId?: string;
  supplierId?: string;
  adGroupId?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  quantity?: number;
  status?: 'draft'|'awaiting'|'approved'|'rejected';
  notes?: string;
  // Ngày đặt hàng (ISO string yyyy-MM-dd hoặc ISO)
  orderDate?: string;
}

export interface AgentOption {
  _id: string; fullName: string; email: string; role: string;
}

export interface SupplierOption {
  _id: string; fullName: string; email: string; role: string;
}

@Injectable({ providedIn: 'root' })
export class PendingOrderService {
  private base = `${environment.apiUrl}/pending-orders`;
  private usersBase = `${environment.apiUrl}/users`;
  constructor(private http: HttpClient) {}
  create(body: PendingOrder){ return this.http.post<PendingOrder>(this.base, body); }
  update(id: string, body: PendingOrder){ return this.http.patch<PendingOrder>(`${this.base}/${id}`, body); }
  approve(id: string){ return this.http.post<{order:any; pending: PendingOrder}>(`${this.base}/${id}/approve`, {}); }
  listAgents(){ return this.http.get<AgentOption[]>(`${this.base}/agents`); }
  listSuppliers(){
    const fallbackParams = new HttpParams().set('minimal', 'true').set('active', 'true');
    return this.http.get<SupplierOption[]>(`${this.base}/suppliers`).pipe(
      catchError(() => this.http.get<SupplierOption[]>(`${this.usersBase}/suppliers`, { params: fallbackParams })),
      map((list) => Array.isArray(list) ? list.map((s: any) => ({ ...s, _id: String(s?._id || '') })) : []),
    );
  }
}
