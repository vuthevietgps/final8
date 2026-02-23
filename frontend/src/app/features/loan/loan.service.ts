import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoanContract {
  _id?: string;
  name: string;
  lenderName: string;
  principal: number;
  principalRemaining?: number;
  interestRate?: number;
  repaymentCycle?: string;
  startDate?: string;
  endDate?: string;
  restricted?: boolean;
  status?: 'active' | 'draft' | 'closed';
  notes?: string;
  createdAt?: string;

  // Giải ngân
  disbursementStatus?: 'pending' | 'partial' | 'fully';
  disbursedAmount?: number;
  disbursedDate?: string;

  // Tổng hợp trả nợ
  totalPrincipalPaid?: number;
  totalInterestPaid?: number;
}

export type CreateLoanContract = Omit<LoanContract, '_id' | 'createdAt' | 'principalRemaining' | 'totalPrincipalPaid' | 'totalInterestPaid'>;

export interface LoanRepayment {
  _id?: string;
  loanId: string;
  amountPrincipal: number;
  amountInterest?: number;
  dueDate?: string;
  paid?: boolean;
  paidDate?: string;
  referenceId?: string;
  notes?: string;
}

export interface LoanSummary {
  totalContracts: number;
  totalPrincipal: number;
  totalDisbursed: number;
  totalPendingDisbursement: number;
  totalPrincipalRemaining: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  byStatus: { pending: number; partial: number; fully: number };
  upcomingRepayments: number;
}

// ═══════════════════════════════════════════════════════════
// LOAN MANAGEMENT ADVANCED TYPES
// ═══════════════════════════════════════════════════════════

export interface LoanDashboard {
  availableToDisburse: number;
  outstandingWithInterest: number;
  totalOutstanding: number;
  monthlyInterestCost: number;
  due7Days: number;
  due14Days: number;
  due30Days: number;
  overdueAmount: number;
  byLoan: LoanDetail[];
  alerts: LoanAlert[];
  optimization: LoanOptimization;
  metadata: LoanMetadata;
}

export interface LoanDetail {
  loanId: string;
  name: string;
  lenderName: string;
  principal: number;
  disbursedAmount: number;
  canDisburse: number;
  principalRemaining: number;
  interestRate: number;
  monthlyInterest: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  overdueAmount: number;
  status: string;
  disbursementStatus: string;
}

export interface LoanAlert {
  type: 'overdue' | 'due_soon' | 'high_interest' | 'cash_crunch';
  message: string;
  loanId?: string;
  loanName?: string;
  severity: 'critical' | 'warning' | 'info';
  amount?: number;
  dueDate?: string;
}

export interface LoanOptimization {
  earlyPaymentSuggestion: {
    available: boolean;
    availableFreeCash: number;
    suggestedPayment: number;
    monthlySavings: number;
    annualSavings: number;
    targetLoanId: string | null;
    targetLoanName: string | null;
    targetLoanRate: number;
  };
  loanPriority: {
    loanId: string;
    loanName: string;
    effectiveRate: number;
    principalRemaining: number;
    priority: number;
  }[];
}

export interface LoanMetadata {
  calculatedAt: string;
  bankBalance: number;
  freeCash: number;
  ownerFundBalance: number;
  canPayFromBank: boolean;
  canPayFromOwner: boolean;
}

export interface PaymentOptions {
  loan: {
    _id: string;
    name: string;
    lenderName: string;
    principal: number;
    principalRemaining: number;
    interestRate: number;
    monthlyInterest: number;
  };
  options: {
    scheduledPayments: ScheduledPaymentOption[];
    principalPayment: {
      minAmount: number;
      maxAmount: number;
      suggestedAmount: number;
    };
    interestPayment: {
      currentMonthInterest: number;
      accruedInterest: number;
    };
    fullPayoff: {
      principalRemaining: number;
      accruedInterest: number;
      totalPayoff: number;
    };
  };
  sources: {
    bankBalance: { available: number; canUse: boolean };
    ownerFund: {
      available: number;
      canUse: boolean;
      accounts: { id: string; name: string; balance: number }[];
    };
  };
}

export interface ScheduledPaymentOption {
  repaymentId: string;
  dueDate: string;
  amountPrincipal: number;
  amountInterest: number;
  total: number;
  isOverdue: boolean;
  daysPastDue: number;
}

export interface CreatePaymentRequest {
  paymentType: 'principal' | 'interest' | 'scheduled' | 'payoff';
  amount: number;
  source: 'bank_balance' | 'owner_fund';
  sourceAccountId?: string;
  repaymentId?: string;
  referenceId?: string;
  notes?: string;
  paymentDate?: string;
}

export interface PaymentResult {
  success: boolean;
  payment: {
    _id: string;
    amount: number;
    paymentType: string;
    amountToPrincipal: number;
    amountToInterest: number;
    source: string;
    paymentDate: string;
  };
  loan: {
    _id: string;
    name: string;
    principalRemaining: number;
    totalPrincipalPaid: number;
    totalInterestPaid: number;
  };
  balances: {
    newBankBalance?: number;
    newOwnerFundBalance?: number;
  };
  savings?: {
    monthlyInterestSaved: number;
    annualInterestSaved: number;
  };
  message: string;
}

export interface LoanPaymentHistory {
  _id: string;
  loanId: any;
  amount: number;
  paymentType: string;
  amountToPrincipal: number;
  amountToInterest: number;
  source: string;
  paymentDate: string;
  notes?: string;
  principalBeforePayment: number;
  principalAfterPayment: number;
}

@Injectable({ providedIn: 'root' })
export class LoanService {
  private api = `${environment.apiUrl}/finance`;
  private managementApi = `${environment.apiUrl}/loan-management`;

  constructor(private http: HttpClient) {}

  listLoans(status?: string): Observable<LoanContract[]> {
    const url = status ? `${this.api}/loans?status=${status}` : `${this.api}/loans`;
    return this.http.get<LoanContract[]>(url);
  }

  createLoan(payload: CreateLoanContract): Observable<LoanContract> {
    return this.http.post<LoanContract>(`${this.api}/loans`, payload);
  }

  updateLoan(id: string, payload: Partial<LoanContract>): Observable<LoanContract> {
    return this.http.patch<LoanContract>(`${this.api}/loans/${id}`, payload);
  }

  getLoan(id: string): Observable<LoanContract> {
    return this.http.get<LoanContract>(`${this.api}/loans/${id}`);
  }

  listRepayments(loanId: string): Observable<LoanRepayment[]> {
    return this.http.get<LoanRepayment[]>(`${this.api}/loans/${loanId}/repayments`);
  }

  createRepayment(loanId: string, payload: Partial<LoanRepayment>): Observable<LoanRepayment> {
    return this.http.post<LoanRepayment>(`${this.api}/loans/${loanId}/repayments`, payload);
  }

  listUpcomingRepayments(days = 7): Observable<LoanRepayment[]> {
    return this.http.get<LoanRepayment[]>(`${this.api}/repayments/upcoming?days=${days}`);
  }

  // ═══════════════════════════════════════════════════════════
  // GIẢI NGÂN & TỔNG HỢP
  // ═══════════════════════════════════════════════════════════

  /** Ghi nhận giải ngân khoản vay */
  recordDisbursement(loanId: string, payload: { amount: number; date?: string; notes?: string }): Observable<LoanContract> {
    return this.http.post<LoanContract>(`${this.api}/loans/${loanId}/disburse`, payload);
  }

  /** Lấy tổng hợp thông tin vay nợ */
  getLoanSummary(): Observable<LoanSummary> {
    return this.http.get<LoanSummary>(`${this.api}/loans/summary`);
  }

  /** Đánh dấu kỳ trả nợ đã trả */
  markRepaymentPaid(repaymentId: string, payload: { paidDate?: string; referenceId?: string; notes?: string }): Observable<LoanRepayment> {
    return this.http.post<LoanRepayment>(`${this.api}/repayments/${repaymentId}/pay`, payload);
  }

  // ═══════════════════════════════════════════════════════════
  // LOAN MANAGEMENT ADVANCED APIs
  // ═══════════════════════════════════════════════════════════

  /** Lấy Dashboard 3 KPIs + chi tiết + gợi ý tối ưu */
  getLoanDashboard(): Observable<LoanDashboard> {
    return this.http.get<LoanDashboard>(`${this.managementApi}/dashboard`);
  }

  /** Lấy các lựa chọn thanh toán cho một khoản vay */
  getPaymentOptions(loanId: string): Observable<PaymentOptions> {
    return this.http.get<PaymentOptions>(`${this.managementApi}/loans/${loanId}/payment-options`);
  }

  /** Thực hiện thanh toán khoản vay */
  createPayment(loanId: string, payload: CreatePaymentRequest): Observable<PaymentResult> {
    return this.http.post<PaymentResult>(`${this.managementApi}/loans/${loanId}/pay`, payload);
  }

  /** Lịch sử thanh toán của một khoản vay */
  getLoanPaymentHistory(loanId: string): Observable<LoanPaymentHistory[]> {
    return this.http.get<LoanPaymentHistory[]>(`${this.managementApi}/loans/${loanId}/payments`);
  }

  /** Tất cả lịch sử thanh toán */
  getAllPayments(limit = 50): Observable<LoanPaymentHistory[]> {
    return this.http.get<LoanPaymentHistory[]>(`${this.managementApi}/payments?limit=${limit}`);
  }
}
