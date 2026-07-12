import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateTestOrder2, TestOrder2, UpdateTestOrder2 } from './models';

@Injectable({ providedIn: 'root' })
export class TestOrder2Service {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/test-order2`;

  getProductsForOrders(): Observable<Array<{
    _id: string;
    name: string;
    color?: string;
    status?: string;
    suppliers?: Array<{
      supplierId?: string;
      price1?: number;
      price2?: number;
      price3?: number;
      appliedLevel?: number;
      appliedPrice?: number;
      priority?: number;
      isDefault?: boolean;
    }>;
  }>> {
    return this.http.get<Array<{
      _id: string;
      name: string;
      color?: string;
      status?: string;
      suppliers?: Array<{
        supplierId?: string;
        price1?: number;
        price2?: number;
        price3?: number;
        appliedLevel?: number;
        appliedPrice?: number;
        priority?: number;
        isDefault?: boolean;
      }>;
    }>>(`${this.baseUrl}/products`);
  }

  getAll(params?: { 
    q?: string; 
    productId?: string; 
    agentId?: string; 
    supplierId?: string;
    adGroupId?: string; 
    isActive?: string; 
    from?: string; 
    to?: string; 
    productionStatus?: string; 
    orderStatus?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Observable<{
    data: TestOrder2[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
  const url = new URL(this.baseUrl, window.location.origin);
    const { q, productId, agentId, supplierId, adGroupId, isActive, from, to, productionStatus, orderStatus, page, limit, sortBy, sortOrder } = params || {};
    if (q) url.searchParams.set('q', q);
    if (productId) url.searchParams.set('productId', productId);
    if (agentId) url.searchParams.set('agentId', agentId);
    if (supplierId) url.searchParams.set('supplierId', supplierId);
    if (adGroupId) url.searchParams.set('adGroupId', adGroupId);
    if (isActive !== undefined) url.searchParams.set('isActive', isActive);
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
    if (productionStatus) url.searchParams.set('productionStatus', productionStatus);
    if (orderStatus) url.searchParams.set('orderStatus', orderStatus);
    if (page) url.searchParams.set('page', page.toString());
    if (limit) url.searchParams.set('limit', limit.toString());
    if (sortBy) url.searchParams.set('sortBy', sortBy);
    if (sortOrder) url.searchParams.set('sortOrder', sortOrder);
    
    return this.http.get<{
      data: TestOrder2[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(url.toString());
  }

  create(data: CreateTestOrder2): Observable<TestOrder2> { return this.http.post<TestOrder2>(this.baseUrl, data); }
  update(id: string, data: UpdateTestOrder2): Observable<TestOrder2> { return this.http.patch<TestOrder2>(`${this.baseUrl}/${id}`, data); }
  confirmBusiness(id: string): Observable<TestOrder2> {
    return this.http.post<TestOrder2>(`${this.baseUrl}/${id}/business-confirmation`, {});
  }
  delete(id: string): Observable<{ message: string }> { return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`); }

  // Đã loại bỏ các API import/export và cập nhật trạng thái giao hàng
}
