/**
 * File: ad-account/ad-account.service.ts
 * Mục đích: Service gọi API Tài Khoản Quảng Cáo.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  AdAccount, 
  CreateAdAccountRequest, 
  UpdateAdAccountRequest, 
  AdAccountSearchFilter,
  AccountTypeStats
} from './models/ad-account.model';

@Injectable({
  providedIn: 'root'
})
export class AdAccountService {
  private readonly baseUrl = `${environment.apiUrl}/ad-accounts`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy danh sách tài khoản quảng cáo
   */
  getAdAccounts(query?: any): Observable<AdAccount[]> {
    let params = new HttpParams();
    if (query?.accountType) params = params.set('accountType', query.accountType);
    if (query?.isActive !== undefined) params = params.set('isActive', query.isActive);
    
    return this.http.get<AdAccount[]>(this.baseUrl, { params });
  }

  /**
   * Tìm kiếm tài khoản quảng cáo
   */
  searchAdAccounts(filter: AdAccountSearchFilter): Observable<AdAccount[]> {
    let params = new HttpParams();
    if (filter.keyword) params = params.set('keyword', filter.keyword);
    if (filter.accountType && filter.accountType !== 'all') params = params.set('accountType', filter.accountType);
    if (filter.status && filter.status !== 'all') params = params.set('status', filter.status);
    
    return this.http.get<AdAccount[]>(`${this.baseUrl}/search`, { params });
  }

  /**
   * Lấy chi tiết tài khoản quảng cáo
   */
  getAdAccount(id: string): Observable<AdAccount> {
    return this.http.get<AdAccount>(`${this.baseUrl}/${id}`);
  }

  /**
   * Tạo tài khoản quảng cáo mới
   */
  createAdAccount(data: CreateAdAccountRequest): Observable<AdAccount> {
    return this.http.post<AdAccount>(this.baseUrl, data);
  }

  /**
   * Cập nhật tài khoản quảng cáo
   */
  updateAdAccount(id: string, data: UpdateAdAccountRequest): Observable<AdAccount> {
    return this.http.patch<AdAccount>(`${this.baseUrl}/${id}`, data);
  }

  /**
   * Xóa tài khoản quảng cáo
   */
  deleteAdAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Kiểm tra accountId có tồn tại không
   */
  validateAccountId(accountId: string): Observable<{ exists: boolean; account?: AdAccount }> {
    return this.http.get<{ exists: boolean; account?: AdAccount }>(`${this.baseUrl}/validate/account-id/${accountId}`);
  }

  /**
   * Lấy thống kê theo loại tài khoản
   */
  getStatsByType(): Observable<AccountTypeStats[]> {
    return this.http.get<AccountTypeStats[]>(`${this.baseUrl}/stats/counts-by-type`);
  }
}
