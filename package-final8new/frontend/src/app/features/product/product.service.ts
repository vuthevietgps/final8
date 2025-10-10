/**
 * File: features/product/product.service.ts
 * Mục đích: Giao tiếp API Sản phẩm (CRUD, tra cứu danh mục).
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  Product, 
  CreateProductDto, 
  UpdateProductDto,
  ProductStats,
  ProductQuery
} from './models/product.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  // Get all products
  getAll(query?: ProductQuery): Observable<Product[]> {
    let params = new HttpParams();
    
    if (query?.categoryId) {
      params = params.set('categoryId', query.categoryId);
    }
    if (query?.status) {
      params = params.set('status', query.status);
    }
    if (query?.search) {
      params = params.set('search', query.search);
    }

    return this.http.get<Product[]>(this.apiUrl, { params, withCredentials: true });
  }

  // Get product by ID
  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  // Create new product
  create(data: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, data, { withCredentials: true });
  }

  // Update product
  update(id: string, data: UpdateProductDto): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${id}`, data, { withCredentials: true });
  }

  // Delete product
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  // Get products by category
  getByCategory(categoryId: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/category/${categoryId}`, { withCredentials: true });
  }

  // Get statistics
  getStats(): Observable<ProductStats> {
    return this.http.get<ProductStats>(`${this.apiUrl}/stats`, { withCredentials: true });
  }

  // Seed sample data
  seedSampleData(): Observable<Product[]> {
    return this.http.post<Product[]>(`${this.apiUrl}/seed`, {}, { withCredentials: true });
  }
}
