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
}

export type CreateLoanContract = Omit<LoanContract, '_id' | 'createdAt' | 'principalRemaining'>;

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

@Injectable({ providedIn: 'root' })
export class LoanService {
  private api = `${environment.apiUrl}/finance`;

  constructor(private http: HttpClient) {}

  listLoans(status?: string): Observable<LoanContract[]> {
    const url = status ? `${this.api}/loans?status=${status}` : `${this.api}/loans`;
    return this.http.get<LoanContract[]>(url);
  }

  createLoan(payload: CreateLoanContract): Observable<LoanContract> {
    return this.http.post<LoanContract>(`${this.api}/loans`, payload);
  }

  getLoan(id: string): Observable<LoanContract> {
    return this.http.get<LoanContract>(`${this.api}/loans/${id}`);
  }

  listRepayments(loanId: string): Observable<LoanRepayment[]> {
    return this.http.get<LoanRepayment[]>(`${this.api}/loans/${loanId}/repayments`);
  }

  listUpcomingRepayments(days = 7): Observable<LoanRepayment[]> {
    return this.http.get<LoanRepayment[]>(`${this.api}/repayments/upcoming?days=${days}`);
  }
}
