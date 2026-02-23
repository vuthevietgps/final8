import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, PaymentBatch, PendingOrdersResponse, SupplierPaymentOpsSummary } from './models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class SupplierPaymentService {
  private baseUrl = `${environment.apiUrl}/test-order2`;

  constructor(private http: HttpClient) {}

  // Get supplier payment ops summary (dashboard + breakdown)
  getOpsSummary(filters?: {
    supplierId?: string;
    fromDate?: string;
    toDate?: string;
  }): Observable<SupplierPaymentOpsSummary> {
    let params: any = {};
    if (filters?.supplierId) params.supplierId = filters.supplierId;
    if (filters?.fromDate) params.fromDate = filters.fromDate;
    if (filters?.toDate) params.toDate = filters.toDate;

    return this.http.get<SupplierPaymentOpsSummary>(
      `${this.baseUrl}/supplier-payment/ops-summary`,
      { params, withCredentials: true }
    );
  }

  // Get orders pending supplier payment
  getPendingOrders(filters?: {
    supplierId?: string;
    from?: string;
    to?: string;
    orderStatus?: string;
  }): Observable<PendingOrdersResponse> {
    let params: any = {};
    if (filters?.supplierId) params.supplierId = filters.supplierId;
    if (filters?.from) params.from = filters.from;
    if (filters?.to) params.to = filters.to;
    if (filters?.orderStatus) params.orderStatus = filters.orderStatus;

    return this.http.get<PendingOrdersResponse>(
      `${this.baseUrl}/payment-pending/supplier`,
      { params, withCredentials: true }
    );
  }

  // Create supplier payment batch
  createPaymentBatch(data: {
    orderIds: string[];
    batchId: string;
    paidDate: string;
    paidAmount?: number;
    note?: string;
    attachments?: string[];
    confirmOverThreshold?: boolean; // Xác nhận khi vượt ngưỡng 5 triệu
  }): Observable<PaymentBatch> {
    return this.http.post<PaymentBatch>(
      `${this.baseUrl}/supplier-payment-batch`,
      data,
      { withCredentials: true }
    );
  }

  // Get supplier payment batches history
  getPaymentBatches(filters?: {
    supplierId?: string;
    from?: string;
    to?: string;
  }): Observable<PaymentBatch[]> {
    let params: any = {};
    if (filters?.supplierId) params.supplierId = filters.supplierId;
    if (filters?.from) params.from = filters.from;
    if (filters?.to) params.to = filters.to;

    return this.http.get<PaymentBatch[]>(
      `${this.baseUrl}/payment-batches/supplier`,
      { params, withCredentials: true }
    );
  }

  // Get orders in a batch
  getOrdersInBatch(batchId: string): Observable<Order[]> {
    return this.http.get<Order[]>(
      `${this.baseUrl}/payment-batch/${batchId}/supplier`,
      { withCredentials: true }
    );
  }
}
