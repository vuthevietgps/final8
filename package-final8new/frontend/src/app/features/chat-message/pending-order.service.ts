/** Service: PendingOrderService - thao tác pending orders từ Conversation UI */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PendingOrder {
  _id?: string;
  fanpageId?: string;
  senderPsid?: string;
  productId?: string;
  agentId?: string;
  adGroupId?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  quantity?: number;
  status?: 'draft'|'awaiting'|'approved'|'rejected';
  notes?: string;
}

export interface AgentOption {
  _id: string; fullName: string; email: string; role: string;
}

@Injectable({ providedIn: 'root' })
export class PendingOrderService {
  private base = `${environment.apiUrl}/pending-orders`;
  constructor(private http: HttpClient) {}
  create(body: PendingOrder){ return this.http.post<PendingOrder>(this.base, body); }
  update(id: string, body: PendingOrder){ return this.http.patch<PendingOrder>(`${this.base}/${id}`, body); }
  approve(id: string){ return this.http.post<{order:any; pending: PendingOrder}>(`${this.base}/${id}/approve`, {}); }
  listAgents(){ return this.http.get<AgentOption[]>(`${this.base}/agents`); }
}
