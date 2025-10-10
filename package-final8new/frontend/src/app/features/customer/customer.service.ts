/**
 * File: features/customer/customer.service.ts
 * Mục đích: Service xử lý HTTP requests cho Khách Hàng ở frontend.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Customer, CustomerStats, CustomerQuery, UpdateCustomerDto } from './models/customer.interface';

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
   */
  findAll(query: CustomerQuery = {}): Observable<Customer[]> {
    let params = new HttpParams();

    if (query.search) {
      params = params.set('search', query.search);
    }
    if (query.expiringSoon !== undefined) {
      params = params.set('expiringSoon', query.expiringSoon.toString());
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

    return this.http.get<Customer[]>(this.apiUrl, { params });
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
}