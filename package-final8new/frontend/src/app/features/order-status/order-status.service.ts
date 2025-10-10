/**
 * File: features/order-status/order-status.service.ts
 * Mục đích: Giao tiếp API Trạng thái đơn hàng.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  OrderStatus, 
  CreateOrderStatus, 
  UpdateOrderStatus,
  OrderStatusStats,
  OrderStatusWorkflow
} from './models/order-status.model';

/**
 * Service xử lý các HTTP request liên quan đến trạng thái đơn hàng
 * Cung cấp đầy đủ các method cho CRUD operations và các tính năng bổ sung
 */
@Injectable({
  providedIn: 'root'
})
export class OrderStatusService {
  /**
   * Base URL cho API endpoint của trạng thái đơn hàng
   */
  private readonly apiUrl = `${environment.apiUrl}/order-status`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy danh sách tất cả trạng thái đơn hàng
   * @param isActive - Lọc theo trạng thái hoạt động (tùy chọn)
   * @param isFinal - Lọc theo trạng thái cuối (tùy chọn)
   * @returns Observable chứa danh sách trạng thái đơn hàng
   */
  getOrderStatuses(isActive?: boolean, isFinal?: boolean): Observable<OrderStatus[]> {
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('isActive', isActive.toString());
    }
    if (isFinal !== undefined) {
      params = params.set('isFinal', isFinal.toString());
    }

    return this.http.get<OrderStatus[]>(this.apiUrl, { params })
      .pipe(
        catchError(error => {
          console.error('Lỗi khi lấy danh sách trạng thái đơn hàng:', error);
          return throwError(() => new Error('Không thể lấy danh sách trạng thái đơn hàng'));
        })
      );
  }

  /**
   * Lấy thông tin một trạng thái đơn hàng theo ID
   * @param id - ID của trạng thái đơn hàng
   * @returns Observable chứa thông tin trạng thái đơn hàng
   */
  getOrderStatus(id: string): Observable<OrderStatus> {
    return this.http.get<OrderStatus>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi lấy thông tin trạng thái đơn hàng:', error);
          return throwError(() => new Error('Không thể lấy thông tin trạng thái đơn hàng'));
        })
      );
  }

  /**
   * Tạo mới trạng thái đơn hàng
   * @param orderStatus - Dữ liệu trạng thái đơn hàng cần tạo
   * @returns Observable chứa trạng thái đơn hàng vừa được tạo
   */
  createOrderStatus(orderStatus: CreateOrderStatus): Observable<OrderStatus> {
    return this.http.post<OrderStatus>(this.apiUrl, orderStatus)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi tạo trạng thái đơn hàng:', error);
          let errorMessage = 'Không thể tạo trạng thái đơn hàng';
          
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 409) {
            errorMessage = 'Tên trạng thái đơn hàng đã tồn tại';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Cập nhật thông tin trạng thái đơn hàng
   * @param id - ID của trạng thái đơn hàng cần cập nhật
   * @param orderStatus - Dữ liệu cập nhật
   * @returns Observable chứa trạng thái đơn hàng sau khi cập nhật
   */
  updateOrderStatus(id: string, orderStatus: UpdateOrderStatus): Observable<OrderStatus> {
    return this.http.patch<OrderStatus>(`${this.apiUrl}/${id}`, orderStatus)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi cập nhật trạng thái đơn hàng:', error);
          let errorMessage = 'Không thể cập nhật trạng thái đơn hàng';
          
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 409) {
            errorMessage = 'Tên trạng thái đơn hàng đã tồn tại';
          } else if (error.status === 404) {
            errorMessage = 'Không tìm thấy trạng thái đơn hàng';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Xóa trạng thái đơn hàng
   * @param id - ID của trạng thái đơn hàng cần xóa
   * @returns Observable chứa thông báo xóa thành công
   */
  deleteOrderStatus(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi xóa trạng thái đơn hàng:', error);
          let errorMessage = 'Không thể xóa trạng thái đơn hàng';
          
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 404) {
            errorMessage = 'Không tìm thấy trạng thái đơn hàng';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Cập nhật thứ tự hiển thị cho nhiều trạng thái
   * @param orderUpdates - Mảng các object chứa id và order mới
   * @returns Observable chứa danh sách trạng thái sau khi cập nhật thứ tự
   */
  updateOrder(orderUpdates: Array<{ id: string; order: number }>): Observable<OrderStatus[]> {
    return this.http.patch<OrderStatus[]>(`${this.apiUrl}/order/update`, orderUpdates)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi cập nhật thứ tự trạng thái đơn hàng:', error);
          return throwError(() => new Error('Không thể cập nhật thứ tự trạng thái đơn hàng'));
        })
      );
  }

  /**
   * Lấy thống kê trạng thái đơn hàng
   * @returns Observable chứa thống kê số lượng trạng thái
   */
  getStats(): Observable<OrderStatusStats> {
    return this.http.get<OrderStatusStats>(`${this.apiUrl}/stats/summary`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi lấy thống kê trạng thái đơn hàng:', error);
          return throwError(() => new Error('Không thể lấy thống kê trạng thái đơn hàng'));
        })
      );
  }

  /**
   * Lấy trạng thái theo workflow
   * @returns Observable chứa workflow trạng thái
   */
  getWorkflowStatuses(): Observable<OrderStatusWorkflow> {
    return this.http.get<OrderStatusWorkflow>(`${this.apiUrl}/workflow/statuses`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi lấy workflow trạng thái đơn hàng:', error);
          return throwError(() => new Error('Không thể lấy workflow trạng thái đơn hàng'));
        })
      );
  }
}
