/**
 * File: features/ad-group-profit-report/ad-group-profit-report.service.ts
 * Mục đích: Service để gọi API báo cáo lợi nhuận nhóm quảng cáo
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  AdGroupDailyReport,
  AdGroupDailyFilter,
} from './models/ad-group-profit-report.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdGroupProfitReportService {
  private apiUrl = `${environment.apiUrl}/ad-group-profit-report`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy báo cáo lợi nhuận nhóm quảng cáo
   * @param query Tham số truy vấn
   * @returns Observable<AdGroupProfitReportResponse>
   */
  getReport(query: AdGroupDailyFilter): Observable<AdGroupDailyReport> {
    let params = new HttpParams();
    if (query.year) params = params.set('year', String(query.year));
    if (query.period) params = params.set('period', query.period);
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.adGroupId) params = params.set('adGroupId', query.adGroupId);
    return this.http.get<AdGroupDailyReport>(this.apiUrl, { params });
  }

  /**
   * Lấy dữ liệu biểu đồ cho một nhóm quảng cáo cụ thể
   * @param adGroupId ID nhóm quảng cáo
   * @param query Tham số truy vấn
   * @returns Observable<ChartData>
   */
  // Tạm bỏ chart API cho đến khi backend bổ sung; có thể tái sử dụng từ data matrix nếu cần

  /**
   * Lấy danh sách kỳ báo cáo có sẵn
   * @returns Observable<string[]>
   */
  // Periods hiển thị cố định ở component

  /**
   * Lấy tóm tắt báo cáo cho tất cả nhóm quảng cáo
   * @param query Tham số truy vấn
   * @returns Observable<any>
   */
  // Có thể bổ sung summary endpoint sau

  /**
   * Xuất báo cáo ra file Excel
   * @param query Tham số truy vấn
   * @returns Observable<Blob>
   */
  // Export có thể thực hiện phía client dựa trên dữ liệu đã tải
}
