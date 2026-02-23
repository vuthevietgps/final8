import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AgentReceivableRow {
  agentId: string;
  agentName?: string;
  agentEmail?: string;
  role?: string;
  totalOrders: number;
  totalQuoteAmount: number;
  collectedAmount: number;
  receivableAmount: number;
}

export interface AgentStatementPayment {
  amount: number;
  paidAt: string;
  method?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
  documents?: string[];
}

export interface AgentStatement {
  _id: string;
  agentId: string;
  periodFrom: string;
  periodTo: string;
  status: 'open' | 'closed';
  openingBalance: number;
  periodReceivables: number;
  periodCollected: number;
  statementPaymentTotal: number;
  closingBalance: number;
  netAfterDelivery: number;
  notes?: string;
  payments?: AgentStatementPayment[];
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AgentReceivableService {
  private baseUrl = `${environment.apiUrl}/agent-receivables`;
  private summaryUrl = `${environment.apiUrl}/agent-receivables/summary`;

  constructor(private http: HttpClient) {}

  getReceivableSummary(params: { agentId?: string; from?: string; to?: string }) {
    let hp = new HttpParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v) hp = hp.set(k, v);
    });
    return this.http.get<{ data: AgentReceivableRow[]; totals: any }>(this.summaryUrl, { params: hp, withCredentials: true });
  }

  listStatements(params: { agentId?: string; from?: string; to?: string; status?: string }) {
    let hp = new HttpParams();
    if (params.agentId) hp = hp.set('agentId', params.agentId);
    if (params.from) hp = hp.set('from', params.from);
    if (params.to) hp = hp.set('to', params.to);
    if (params.status) hp = hp.set('status', params.status);
    return this.http.get<AgentStatement[]>(`${this.baseUrl}/statements`, { params: hp, withCredentials: true });
  }

  upsertStatement(payload: { agentId: string; from: string; to: string; notes?: string }) {
    return this.http.post<AgentStatement>(`${this.baseUrl}/statements`, payload, { withCredentials: true });
  }

  addStatementPayment(id: string, payload: { amount: number; paidAt: string; method?: string; reference?: string; notes?: string; createdBy?: string; documents?: string[] }) {
    return this.http.post<AgentStatement>(`${this.baseUrl}/statements/${id}/payments`, payload, { withCredentials: true });
  }

  closeStatement(id: string) {
    return this.http.patch<AgentStatement>(`${this.baseUrl}/statements/${id}/close`, {}, { withCredentials: true });
  }

  reopenStatement(id: string) {
    return this.http.patch<AgentStatement>(`${this.baseUrl}/statements/${id}/reopen`, {}, { withCredentials: true });
  }
}
