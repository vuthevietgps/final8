import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Cấu trúc mới dựa trên realized profit
export interface RealAvailableFunds {
  safeAvailableFunds: number;      // Tiền chắc ăn (đã thanh toán cả 2 bên)
  totalNetProfit: number;          // Tổng lợi nhuận (bao gồm pending)
  mode: 'conservative' | 'moderate' | 'aggressive';
  cashFlow: {
    // Conservative mode
    realizedNetProfit?: number;
    realizedGrossProfit?: number;
    realizedOrderCount?: number;
    pendingNetProfit?: number;
    pendingGrossProfit?: number;
    pendingOrderCount?: number;
    
    // Moderate mode
    realizedProfit?: number;
    realizedCount?: number;
    partialProfit?: number;
    partialCount?: number;
    pendingProfit?: number;
    pendingCount?: number;
    discountedFunds?: number;
    
    // Common
    initialCapital?: number;
    netCashAvailable?: number;
    
    // Aggressive mode
    estimatedProfit?: number;
    unrealizedProfit?: number;
    loanAvailable?: number;
  };
  additionalInfo?: {
    riskLevel?: string;
    description?: string;
    note?: string;
    discountRates?: {
      realized: number;
      partial: number;
      pending: number;
    };
    warning?: string;
    recommendation?: string;
  };
  calculatedAt: string;
}

// Legacy interface cho backward compatibility
export interface AvailableFunds {
  available: number;
  collectedRevenue: number;
  loanAvailable: number;
  actualSpent: number;
  reservedPayroll: number;
  reservedInterest: number;
  reservedPayables: number;
  reservedSuppliers: number;
  reservedAgents: number;
  reservedOther: number;
  capturedAt?: string;
  note?: string;
}

export interface CaptureAvailableFundPayload {
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class AvailableFundsService {
  private api = `${environment.apiUrl}/finance/available-funds`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy vốn khả dụng dựa trên realized profit
   * @param mode - conservative (default), moderate, aggressive
   */
  getCurrent(mode: 'conservative' | 'moderate' | 'aggressive' = 'conservative'): Observable<RealAvailableFunds> {
    const params = new HttpParams().set('mode', mode);
    return this.http.get<RealAvailableFunds>(`${this.api}/current`, { params });
  }

  listSnapshots(): Observable<AvailableFunds[]> {
    return this.http.get<AvailableFunds[]>(this.api);
  }

  capture(payload: CaptureAvailableFundPayload): Observable<AvailableFunds> {
    return this.http.post<AvailableFunds>(`${this.api}/capture`, payload);
  }
}
