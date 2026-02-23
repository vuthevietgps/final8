import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProfitStats {
  totalOrders: number;
  totalGrossProfit: number;
  totalNetProfit: number;
  totalAdvertisingCost?: number;
  totalLaborCost?: number;
  totalOtherCost?: number;
  totalSupplierPaid?: number;
  totalAgentPaid?: number;
}

export interface PendingStats {
  totalOrders: number;
  estimatedGrossProfit: number;
  estimatedNetProfit: number;
  pendingSupplierPayment: number;
  pendingAgentPayment: number;
}

export interface DailyProfitReport {
  date: string;
  estimated: ProfitStats;
  realized: ProfitStats;
  pending: PendingStats;
  cashAvailable: number;
}

@Injectable({
  providedIn: 'root'
})
export class DailyProfitReportService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/test-order2`;

  getDailyProfitReport(date?: string): Observable<DailyProfitReport> {
    const params: Record<string, string> = {};
    if (date) {
      params['date'] = date;
    }
    return this.http.get<DailyProfitReport>(`${this.apiUrl}/daily-profit-report`, { params });
  }
}
