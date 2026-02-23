import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProductProfit {
  productId: string;
  productName: string;
  productColor: string;
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
  totalProductCost: number;
  totalAdvertisingCost: number;
  totalLaborCost: number;
  totalOtherCost: number;
  totalAgentCommission: number;
  grossProfit: number;
  netProfit: number;
  averageOrderValue: number;
  averageProfitPerOrder: number;
  profitMargin: number;
}

export interface ProductProfitTotals {
  totalProducts: number;
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
  totalProductCost: number;
  totalAdvertisingCost: number;
  totalLaborCost: number;
  totalOtherCost: number;
  totalAgentCommission: number;
  grossProfit: number;
  netProfit: number;
}

export interface ProductProfitReport {
  dateRange: {
    from: string;
    to: string;
  };
  products: ProductProfit[];
  totals: ProductProfitTotals;
}

@Injectable({
  providedIn: 'root'
})
export class ProductProfitReportService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/test-order2`;

  getProductProfitReport(params: { date?: string; from?: string; to?: string }): Observable<ProductProfitReport> {
    const queryParams: Record<string, string> = {};
    if (params.date) {
      queryParams['date'] = params.date;
    }
    if (params.from) {
      queryParams['from'] = params.from;
    }
    if (params.to) {
      queryParams['to'] = params.to;
    }
    return this.http.get<ProductProfitReport>(`${this.apiUrl}/product-profit-report`, { params: queryParams });
  }
}
