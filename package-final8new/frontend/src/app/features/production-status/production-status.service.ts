/**
 * File: features/production-status/production-status.service.ts
 * Mục đích: Giao tiếp API Trạng thái sản xuất.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  ProductionStatus, 
  CreateProductionStatus, 
  UpdateProductionStatus,
  ProductionStatusStats 
} from './models/production-status.model';

/**
 * Service xử lý các HTTP request liên quan đến trạng thái sản xuất
 * Cung cấp đầy đủ các method cho CRUD operations và các tính năng bổ sung
 */
@Injectable({
  providedIn: 'root'
})
export class ProductionStatusService {
  /**
   * Base URL cho API endpoint của trạng thái sản xuất
   */
  private readonly apiUrl = `${environment.apiUrl}/production-status`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy danh sách tất cả trạng thái sản xuất
   * @returns Observable chứa danh sách trạng thái sản xuất
   */
  getProductionStatuses(isActive?: boolean): Observable<ProductionStatus[]> {
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('isActive', isActive.toString());
    }

    return this.http.get<ProductionStatus[]>(this.apiUrl, { params })
      .pipe(
        catchError(error => {
          console.error('Lỗi khi lấy danh sách trạng thái sản xuất:', error);
          return throwError(() => new Error('Không thể lấy danh sách trạng thái sản xuất'));
        })
      );
  }

  /**
   * Lấy thông tin một trạng thái sản xuất theo ID
   * @param id - ID của trạng thái sản xuất
   * @returns Observable chứa thông tin trạng thái sản xuất
   */
  getProductionStatus(id: string): Observable<ProductionStatus> {
    return this.http.get<ProductionStatus>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi lấy thông tin trạng thái sản xuất:', error);
          return throwError(() => new Error('Không thể lấy thông tin trạng thái sản xuất'));
        })
      );
  }

  /**
   * Tạo mới trạng thái sản xuất
   * @param productionStatus - Dữ liệu trạng thái sản xuất cần tạo
   * @returns Observable chứa trạng thái sản xuất vừa được tạo
   */
  createProductionStatus(productionStatus: CreateProductionStatus): Observable<ProductionStatus> {
    return this.http.post<ProductionStatus>(this.apiUrl, productionStatus)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi tạo trạng thái sản xuất:', error);
          let errorMessage = 'Không thể tạo trạng thái sản xuất';
          
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 409) {
            errorMessage = 'Tên trạng thái sản xuất đã tồn tại';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Cập nhật thông tin trạng thái sản xuất
   * @param id - ID của trạng thái sản xuất cần cập nhật
   * @param productionStatus - Dữ liệu cập nhật
   * @returns Observable chứa trạng thái sản xuất sau khi cập nhật
   */
  updateProductionStatus(id: string, productionStatus: UpdateProductionStatus): Observable<ProductionStatus> {
    return this.http.patch<ProductionStatus>(`${this.apiUrl}/${id}`, productionStatus)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi cập nhật trạng thái sản xuất:', error);
          let errorMessage = 'Không thể cập nhật trạng thái sản xuất';
          
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 409) {
            errorMessage = 'Tên trạng thái sản xuất đã tồn tại';
          } else if (error.status === 404) {
            errorMessage = 'Không tìm thấy trạng thái sản xuất';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Xóa trạng thái sản xuất
   * @param id - ID của trạng thái sản xuất cần xóa
   * @returns Observable chứa thông báo xóa thành công
   */
  deleteProductionStatus(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi xóa trạng thái sản xuất:', error);
          let errorMessage = 'Không thể xóa trạng thái sản xuất';
          
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 404) {
            errorMessage = 'Không tìm thấy trạng thái sản xuất';
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
  updateOrder(orderUpdates: Array<{ id: string; order: number }>): Observable<ProductionStatus[]> {
    return this.http.patch<ProductionStatus[]>(`${this.apiUrl}/order/update`, orderUpdates)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi cập nhật thứ tự trạng thái sản xuất:', error);
          return throwError(() => new Error('Không thể cập nhật thứ tự trạng thái sản xuất'));
        })
      );
  }

  /**
   * Lấy thống kê trạng thái sản xuất
   * @returns Observable chứa thống kê số lượng trạng thái
   */
  getStats(): Observable<ProductionStatusStats> {
    return this.http.get<ProductionStatusStats>(`${this.apiUrl}/stats/summary`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi lấy thống kê trạng thái sản xuất:', error);
          return throwError(() => new Error('Không thể lấy thống kê trạng thái sản xuất'));
        })
      );
  }
}
