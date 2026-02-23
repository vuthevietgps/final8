/**
 * File: features/customer/customer.service.ts
 * Mục đích: Service xử lý HTTP requests cho Khách Hàng ở frontend.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  Customer, 
  CustomerStats, 
  CustomerQuery, 
  UpdateCustomerDto,
  CustomerListResponse,
  ExpiryNotificationResponse,
  WeeklyCalendarResponse
} from './models/customer.interface';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private readonly apiUrl = `${environment.apiUrl}/customers`;

  constructor(private http: HttpClient) {}

  /**
   * Đồng bộ khách hàng từ TestOrder2
   */
  syncFromOrders(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/sync`, {});
  }

  /**
   * Cập nhật thời gian còn lại cho tất cả khách hàng
   */
  updateRemainingDays(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/update-remaining-days`, {});
  }

  /**
   * Lấy thống kê khách hàng
   */
  getStats(): Observable<CustomerStats> {
    return this.http.get<CustomerStats>(`${this.apiUrl}/stats`);
  }

  /**
   * Lấy danh sách khách hàng với tìm kiếm và lọc
   * P2 FIX: Trả về CustomerListResponse với pagination
   */
  findAll(query: CustomerQuery = {}): Observable<CustomerListResponse> {
    let params = new HttpParams();

    if (query.search) {
      params = params.set('search', query.search);
    }
    if (query.expiringSoon !== undefined) {
      params = params.set('expiringSoon', query.expiringSoon.toString());
    }
    if (query.expired !== undefined) {
      params = params.set('expired', query.expired.toString());
    }
    if (query.isDisabled !== undefined) {
      params = params.set('isDisabled', query.isDisabled.toString());
    }
    if (query.limit) {
      params = params.set('limit', query.limit.toString());
    }
    if (query.skip) {
      params = params.set('skip', query.skip.toString());
    }

    return this.http.get<CustomerListResponse>(this.apiUrl, { params });
  }

  /**
   * Lấy khách hàng theo ID
   */
  findOne(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiUrl}/${id}`);
  }

  /**
   * Vô hiệu hóa khách hàng
   */
  disable(id: string): Observable<Customer> {
    return this.http.patch<Customer>(`${this.apiUrl}/${id}/disable`, {});
  }

  /**
   * Kích hoạt lại khách hàng
   */
  enable(id: string): Observable<Customer> {
    return this.http.patch<Customer>(`${this.apiUrl}/${id}/enable`, {});
  }

  /**
   * Cập nhật thông tin khách hàng
   */
  update(id: string, updateData: UpdateCustomerDto): Observable<Customer> {
    return this.http.patch<Customer>(`${this.apiUrl}/${id}`, updateData);
  }

  /**
   * Xóa khách hàng
   */
  remove(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  // ============ NOTIFICATION SCHEDULE METHODS ============

  /**
   * Lấy lịch thông báo khách hàng sắp hết hạn
   * @param days Số ngày threshold (mặc định 10)
   */
  getExpiryNotifications(days: number = 10): Observable<ExpiryNotificationResponse> {
    return this.http.get<ExpiryNotificationResponse>(
      `${this.apiUrl}/notifications/expiring`,
      { params: new HttpParams().set('days', days.toString()) }
    );
  }

  /**
   * Lấy lịch thông báo theo tuần
   */
  getWeeklyCalendar(): Observable<WeeklyCalendarResponse> {
    return this.http.get<WeeklyCalendarResponse>(`${this.apiUrl}/notifications/calendar`);
  }

  /**
   * Export danh sách liên hệ
   */
  exportContacts(days: number = 10): Observable<any> {
    return this.http.get(`${this.apiUrl}/notifications/export`, {
      params: new HttpParams().set('days', days.toString())
    });
  }
}