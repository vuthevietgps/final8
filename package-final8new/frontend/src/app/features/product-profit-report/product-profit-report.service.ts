/**
 * File: product-profit-report/product-profit-report.service.ts
 * Mục đích: Service gọi API báo cáo lợi nhuận sản phẩm theo ngày
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProductProfitFilter, ProductProfitReport } from './models/product-profit.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductProfitReportService {
  private readonly baseUrl = `${environment.apiUrl}/product-profit-report`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy báo cáo lợi nhuận sản phẩm theo ngày
   */
  getProductProfitReport(filter: ProductProfitFilter): Observable<ProductProfitReport> {
    let params = new HttpParams();
    
    // Convert period to date range
    const dateRange = this.convertPeriodToDateRange(filter.period, filter.year);
    const fromDate = filter.fromDate || dateRange.from;
    const toDate = filter.toDate || dateRange.to;
    
    if (fromDate) {
      params = params.set('from', fromDate);
    }
    if (toDate) {
      params = params.set('to', toDate);
    }
    if (filter.productName) {
      params = params.set('productName', filter.productName);
    }

    return this.http.get<ProductProfitReport>(this.baseUrl, { params });
  }

  /**
   * Convert period filter to date range
   */
  private convertPeriodToDateRange(period?: string, year?: number): { from?: string; to?: string } {
    const now = new Date();
    const currentYear = year || now.getFullYear();
    
    switch (period) {
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return {
          from: weekAgo.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0]
        };
      }
      case '10days': {
        const tenDaysAgo = new Date(now);
        tenDaysAgo.setDate(now.getDate() - 10);
        return {
          from: tenDaysAgo.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0]
        };
      }
      case '30days': {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return {
          from: thirtyDaysAgo.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0]
        };
      }
      case 'lastMonth': {
        const lastMonth = new Date(currentYear, now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(currentYear, now.getMonth(), 0);
        return {
          from: lastMonth.toISOString().split('T')[0],
          to: lastMonthEnd.toISOString().split('T')[0]
        };
      }
      case 'thisMonth': {
        const thisMonthStart = new Date(currentYear, now.getMonth(), 1);
        return {
          from: thisMonthStart.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0]
        };
      }
      default:
        // Default to last 30 days if no period specified
        if (period === 'custom') return {}; // For custom, rely on fromDate/toDate
        const defaultStart = new Date(now);
        defaultStart.setDate(now.getDate() - 30);
        return {
          from: defaultStart.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0]
        };
    }
  }

  /**
   * Lấy danh sách năm có dữ liệu
   */
  getAvailableYears(): Observable<{ years: number[] }> {
    return this.http.get<{ years: number[] }>(`${this.baseUrl}/years`);
  }

  /**
   * Lấy thống kê tổng quan
   */
  getSummary(filter: ProductProfitFilter): Observable<any> {
    let params = new HttpParams();
    
    // Convert period to date range
    const dateRange = this.convertPeriodToDateRange(filter.period, filter.year);
    const fromDate = filter.fromDate || dateRange.from;
    const toDate = filter.toDate || dateRange.to;
    
    if (fromDate) {
      params = params.set('from', fromDate);
    }
    if (toDate) {
      params = params.set('to', toDate);
    }
    if (filter.productName) {
      params = params.set('productName', filter.productName);
    }

    return this.http.get(`${this.baseUrl}/summary`, { params });
  }
}
