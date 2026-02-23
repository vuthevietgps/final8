import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, PaymentBatch, PendingOrdersResponse } from './models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class AgentPaymentService {
  private baseUrl = `${environment.apiUrl}/test-order2`;

  constructor(private http: HttpClient) {}

  // Get orders pending agent payment
  getPendingOrders(filters?: {
    agentId?: string;
    from?: string;
    to?: string;
  }): Observable<PendingOrdersResponse> {
    let params: any = {};
    if (filters?.agentId) params.agentId = filters.agentId;
    if (filters?.from) params.from = filters.from;
    if (filters?.to) params.to = filters.to;

    return this.http.get<PendingOrdersResponse>(
      `${this.baseUrl}/payment-pending/agent`,
      { params, withCredentials: true }
    );
  }

  // Create agent payment batch
  createPaymentBatch(data: {
    orderIds: string[];
    batchId: string;
    paidDate: string;
    note?: string;
    attachments?: string[];
  }): Observable<PaymentBatch> {
    return this.http.post<PaymentBatch>(
      `${this.baseUrl}/agent-payment-batch`,
      data,
      { withCredentials: true }
    );
  }

  // Get agent payment batches history
  getPaymentBatches(filters?: {
    agentId?: string;
    from?: string;
    to?: string;
  }): Observable<PaymentBatch[]> {
    let params: any = {};
    if (filters?.agentId) params.agentId = filters.agentId;
    if (filters?.from) params.from = filters.from;
    if (filters?.to) params.to = filters.to;

    return this.http.get<PaymentBatch[]>(
      `${this.baseUrl}/payment-batches/agent`,
      { params, withCredentials: true }
    );
  }

  // Get orders in a batch
  getOrdersInBatch(batchId: string): Observable<Order[]> {
    return this.http.get<Order[]>(
      `${this.baseUrl}/payment-batch/${batchId}/agent`,
      { withCredentials: true }
    );
  }

  // Get agent payment ops summary (CFO Spec v2.0)
  getOpsSummary(filters?: {
    agentId?: string;
    fromDate?: string;
    toDate?: string;
  }): Observable<AgentPaymentOpsSummary> {
    let params: any = {};
    if (filters?.agentId) params.agentId = filters.agentId;
    if (filters?.fromDate) params.fromDate = filters.fromDate;
    if (filters?.toDate) params.toDate = filters.toDate;

    return this.http.get<AgentPaymentOpsSummary>(
      `${this.baseUrl}/agent-payment/ops-summary`,
      { params, withCredentials: true }
    );
  }

  // Create payment batch with atomic update (chống double-pay)
  createPaymentBatchAtomic(data: {
    orderIds: string[];
    batchId: string;
    paidDate: string;
    note?: string;
    attachments?: string[];
    confirmOverThreshold?: boolean;  // CFO Spec v2.0
    confirmedBy?: string;             // CFO Spec v2.0
  }): Observable<PaymentBatchResult> {
    return this.http.post<PaymentBatchResult>(
      `${this.baseUrl}/agent-payment-batch/atomic`,
      data,
      { withCredentials: true }
    );
  }
}

// ============ INTERFACES (CFO Spec v2.0) ============

export interface AgentPaymentOpsSummary {
  // Payable (dương - công ty trả cho đại lý)
  payablePending: { orderCount: number; amount: number };
  paid: { orderCount: number; amount: number };
  
  // Clawback (đại lý nợ công ty - từ đơn hoàn sau khi đã trả)
  clawbackOutstanding: { caseCount: number; amount: number };
  
  // Aging buckets for pending payable
  payableAging: { bucket: string; orderCount: number; amount: number }[];
  
  // Breakdown by agent
  byAgent: AgentBreakdown[];
  
  // Metadata
  threshold: number;
  asOfDate: string;
  timezone: string;
}

export interface AgentBreakdown {
  agentId: string;
  agentName: string;
  pendingPayableOrderCount: number;
  pendingPayableAmount: number;
  clawbackOutstandingAmount: number;
  paidAmount: number;
  netAmount: number;
  payableAging: { bucket: string; amount: number }[];
  isOverThreshold: boolean;
}

export interface PaymentBatchResult {
  batchId: string;
  paidDate: Date;
  orderCount: number;
  skippedCount?: number;
  totalPayable?: number;
  totalClawback?: number;
  netAmount?: number;
  totalAmount?: number;
  note?: string;
  warning?: string | null;
}
