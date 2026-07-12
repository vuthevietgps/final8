import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  Owner, 
  Withdrawal, 
  WithdrawalStatus, 
  OwnerStatistics,
  FundTransaction,
  FundTransactionType,
  FundTransactionCategory,
  FundSummary,
} from './models/owner-fund.model';

@Injectable({
  providedIn: 'root'
})
export class OwnerFundService {
  // Sử dụng relative URL để đi qua Angular proxy
  private apiUrl = '/api/owner-fund';

  constructor(private http: HttpClient) {}

  private createIdempotencyKey(prefix: string): string {
    const uuid = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${uuid}`;
  }

  // ==================== OWNER METHODS ====================

  getAllOwners(): Observable<Owner[]> {
    return this.http.get<Owner[]>(`${this.apiUrl}/owners`);
  }

  getOwnerById(id: string): Observable<Owner> {
    return this.http.get<Owner>(`${this.apiUrl}/owners/${id}`);
  }

  createOwner(owner: Partial<Owner>): Observable<Owner> {
    return this.http.post<Owner>(`${this.apiUrl}/owners`, owner);
  }

  updateOwner(id: string, owner: Partial<Owner>): Observable<Owner> {
    return this.http.patch<Owner>(`${this.apiUrl}/owners/${id}`, owner);
  }

  deleteOwner(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/owners/${id}`);
  }

  getOwnerStatistics(id: string): Observable<OwnerStatistics> {
    return this.http.get<OwnerStatistics>(`${this.apiUrl}/owners/${id}/statistics`);
  }

  // ==================== WITHDRAWAL METHODS ====================

  getAllWithdrawals(filters?: {
    ownerId?: string;
    status?: WithdrawalStatus;
    startDate?: string;
    endDate?: string;
  }): Observable<Withdrawal[]> {
    let params = new HttpParams();
    
    if (filters?.ownerId) params = params.set('ownerId', filters.ownerId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);

    return this.http.get<Withdrawal[]>(`${this.apiUrl}/withdrawals`, { params });
  }

  getWithdrawalById(id: string): Observable<Withdrawal> {
    return this.http.get<Withdrawal>(`${this.apiUrl}/withdrawals/${id}`);
  }

  createWithdrawal(withdrawal: Partial<Withdrawal>): Observable<Withdrawal> {
    return this.http.post<Withdrawal>(`${this.apiUrl}/withdrawals`, withdrawal);
  }

  approveWithdrawal(id: string, approvedBy: string, notes?: string, transactionRef?: string): Observable<Withdrawal> {
    return this.http.post<Withdrawal>(`${this.apiUrl}/withdrawals/${id}/approve`, {
      approvedBy,
      approvalNotes: notes,
      transactionReference: transactionRef,
    });
  }

  rejectWithdrawal(id: string, approvedBy: string, notes?: string): Observable<Withdrawal> {
    return this.http.post<Withdrawal>(`${this.apiUrl}/withdrawals/${id}/reject`, {
      approvedBy,
      approvalNotes: notes,
    });
  }

  completeWithdrawal(id: string, transactionReference?: string): Observable<Withdrawal> {
    return this.http.post<Withdrawal>(`${this.apiUrl}/withdrawals/${id}/complete`, {
      transactionReference,
    });
  }

  cancelWithdrawal(id: string): Observable<Withdrawal> {
    return this.http.post<Withdrawal>(`${this.apiUrl}/withdrawals/${id}/cancel`, {});
  }

  // ==================== STATISTICS ====================

  getSystemStatistics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/statistics/system`);
  }

  // ==================== FUND SUMMARY ====================

  getFundSummary(): Observable<FundSummary> {
    return this.http.get<FundSummary>(`${this.apiUrl}/fund-summary`);
  }

  // ==================== FUND TRANSACTIONS ====================

  getAllFundTransactions(filters?: {
    ownerId?: string;
    type?: FundTransactionType;
    category?: FundTransactionCategory;
    startDate?: string;
    endDate?: string;
  }): Observable<FundTransaction[]> {
    let params = new HttpParams();
    
    if (filters?.ownerId) params = params.set('ownerId', filters.ownerId);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.category) params = params.set('category', filters.category);
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);

    return this.http.get<FundTransaction[]>(`${this.apiUrl}/transactions`, { params });
  }

  createFundTransaction(transaction: Partial<FundTransaction>): Observable<FundTransaction> {
    return this.http.post<FundTransaction>(`${this.apiUrl}/transactions`, transaction);
  }

  getOwnerTransactionHistory(ownerId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/owners/${ownerId}/transactions`);
  }

  // ==================== FUND ACCOUNT (Quỹ Owner riêng) ====================

  /**
   * Lấy thông tin tài khoản Quỹ Owner
   */
  getFundAccount(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/fund-account`);
  }

  /**
   * Chuyển tiền từ Bank Balance vào Quỹ Owner
   */
  transferToOwnerFund(data: { amount: number; description?: string; idempotencyKey?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/fund-account/transfer-in`, {
      ...data,
      idempotencyKey: data.idempotencyKey || this.createIdempotencyKey('owner-transfer-in'),
    });
  }

  /**
   * Chuyển tiền từ Quỹ Owner về Bank Balance (trả lại công ty)
   */
  transferFromOwnerFund(data: { amount: number; description?: string; idempotencyKey?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/fund-account/transfer-out`, {
      ...data,
      idempotencyKey: data.idempotencyKey || this.createIdempotencyKey('owner-transfer-out'),
    });
  }

  /**
   * Owner rút tiền từ Quỹ Owner về cá nhân
   */
  ownerWithdrawFromFund(data: { 
    amount: number; 
    description?: string; 
    bankAccount?: string;
    bankName?: string;
    idempotencyKey?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/fund-account/withdraw`, {
      ...data,
      idempotencyKey: data.idempotencyKey || this.createIdempotencyKey('owner-withdraw'),
    });
  }

  /**
   * Cập nhật thông tin tài khoản Quỹ Owner
   */
  updateFundAccount(data: { bankAccount?: string; bankName?: string; name?: string }): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/fund-account`, data);
  }
}
