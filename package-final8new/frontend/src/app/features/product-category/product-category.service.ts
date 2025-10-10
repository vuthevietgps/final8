/**
 * File: features/product-category/product-category.service.ts
 * Mục đích: Giao tiếp API Nhóm Sản phẩm.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  ProductCategory, 
  CreateProductCategoryDto, 
  UpdateProductCategoryDto,
  ProductCategoryStats 
} from './models/product-category.interface';

@Injectable({
  providedIn: 'root'
})
export class ProductCategoryService {
  private apiUrl = `${environment.apiUrl}/product-category`;

  constructor(private http: HttpClient) {}

  // Lấy tất cả nhóm sản phẩm
  getAll(): Observable<ProductCategory[]> {
    return this.http.get<ProductCategory[]>(this.apiUrl);
  }

  // Lấy nhóm sản phẩm theo ID
  getById(id: string): Observable<ProductCategory> {
    return this.http.get<ProductCategory>(`${this.apiUrl}/${id}`);
  }

  // Tạo nhóm sản phẩm mới
  create(data: CreateProductCategoryDto): Observable<ProductCategory> {
    return this.http.post<ProductCategory>(this.apiUrl, data);
  }

  // Cập nhật nhóm sản phẩm
  update(id: string, data: UpdateProductCategoryDto): Observable<ProductCategory> {
    return this.http.patch<ProductCategory>(`${this.apiUrl}/${id}`, data);
  }

  // Xóa nhóm sản phẩm
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Lấy các nhóm sản phẩm đang hoạt động
  getActiveCategories(): Observable<ProductCategory[]> {
    return this.http.get<ProductCategory[]>(`${this.apiUrl}/active`);
  }

  // Cập nhật số lượng sản phẩm
  updateProductCount(id: string, count: number): Observable<ProductCategory> {
    return this.http.patch<ProductCategory>(`${this.apiUrl}/${id}/product-count`, { count });
  }

  // Cập nhật thứ tự
  updateOrder(id: string, order: number): Observable<ProductCategory> {
    return this.http.patch<ProductCategory>(`${this.apiUrl}/${id}/order`, { order });
  }

  // Lấy thống kê
  getStats(): Observable<ProductCategoryStats> {
    return this.http.get<ProductCategoryStats>(`${this.apiUrl}/stats/summary`);
  }

  // Seed dữ liệu mẫu
  seedSampleData(): Observable<ProductCategory[]> {
    return this.http.post<ProductCategory[]>(`${this.apiUrl}/seed`, {});
  }
}
