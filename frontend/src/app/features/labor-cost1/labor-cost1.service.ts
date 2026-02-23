/**
 * File: features/labor-cost1/labor-cost1.service.ts
 * Mô tả: Gọi API Chi Phí Nhân Công 1.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  CreateLaborCost1Dto, 
  LaborCost1, 
  UpdateLaborCost1Dto,
  LaborStatement,
  LaborStatementDetail,
  CreateLaborStatementDto,
  AddLaborPaymentDto,
  UpdateKpiDto
} from './labor-cost1.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LaborCost1Service {
  private apiUrl = `${environment.apiUrl}/labor-cost1`;
  constructor(private http: HttpClient) {}

  // ============================================
  // LABOR COST ENDPOINTS
  // ============================================
  list(): Observable<LaborCost1[]> { return this.http.get<LaborCost1[]>(this.apiUrl); }
  create(dto: CreateLaborCost1Dto): Observable<LaborCost1> { return this.http.post<LaborCost1>(this.apiUrl, dto); }
  update(id: string, dto: UpdateLaborCost1Dto): Observable<LaborCost1> { return this.http.patch<LaborCost1>(`${this.apiUrl}/${id}`, dto); }
  remove(id: string): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/${id}`); }
  markPaid(id: string): Observable<LaborCost1> { return this.http.patch<LaborCost1>(`${this.apiUrl}/${id}/pay`, {}); }
  
  generateFromSessionLogs(userId?: string, date?: string): Observable<any> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (date) params.append('date', date);
    const queryString = params.toString();
    const url = queryString ? `${this.apiUrl}/generate-from-sessions?${queryString}` : `${this.apiUrl}/generate-from-sessions`;
    return this.http.post<any>(url, {});
  }

  // ============================================
  // LABOR STATEMENT ENDPOINTS
  // ============================================
  
  /**
   * Lấy danh sách phiếu thanh toán lương
   */
  listStatements(filters?: {
    employeeId?: string;
    status?: string;
    periodFrom?: string;
    periodTo?: string;
  }): Observable<LaborStatement[]> {
    let params = new HttpParams();
    if (filters?.employeeId) params = params.set('employeeId', filters.employeeId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.periodFrom) params = params.set('periodFrom', filters.periodFrom);
    if (filters?.periodTo) params = params.set('periodTo', filters.periodTo);
    
    return this.http.get<LaborStatement[]>(`${this.apiUrl}/statements`, { params });
  }

  /**
   * Lấy chi tiết phiếu thanh toán
   */
  getStatement(id: string): Observable<LaborStatementDetail> {
    return this.http.get<LaborStatementDetail>(`${this.apiUrl}/statements/${id}`);
  }

  /**
   * Tạo phiếu thanh toán lương mới
   */
  createStatement(dto: CreateLaborStatementDto): Observable<LaborStatement> {
    return this.http.post<LaborStatement>(`${this.apiUrl}/statements`, dto);
  }

  /**
   * Cập nhật KPI cho phiếu (Director/Manager nhập)
   * Bước 2: Tạo phiếu → Nhập KPI → Duyệt → Thanh toán
   */
  updateKpi(id: string, dto: UpdateKpiDto): Observable<LaborStatement> {
    return this.http.patch<LaborStatement>(`${this.apiUrl}/statements/${id}/kpi`, dto);
  }

  /**
   * Xác nhận phiếu (draft → open)
   * Yêu cầu: KPI phải được nhập trước
   */
  confirmStatement(id: string, confirmedBy?: string, skipKpiCheck?: boolean): Observable<LaborStatement> {
    return this.http.post<LaborStatement>(`${this.apiUrl}/statements/${id}/confirm`, { confirmedBy, skipKpiCheck });
  }

  /**
   * Thêm thanh toán vào phiếu
   */
  addPayment(id: string, dto: AddLaborPaymentDto): Observable<LaborStatement> {
    return this.http.post<LaborStatement>(`${this.apiUrl}/statements/${id}/payments`, dto);
  }

  /**
   * Đóng phiếu (open → closed)
   */
  closeStatement(id: string, closedBy?: string): Observable<LaborStatement> {
    return this.http.patch<LaborStatement>(`${this.apiUrl}/statements/${id}/close`, { closedBy });
  }

  /**
   * Mở lại phiếu (closed → open)
   */
  reopenStatement(id: string): Observable<LaborStatement> {
    return this.http.patch<LaborStatement>(`${this.apiUrl}/statements/${id}/reopen`, {});
  }

  /**
   * Xóa phiếu (chỉ xóa được draft)
   */
  deleteStatement(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/statements/${id}`);
  }

  /**
   * Tổng lương chưa thanh toán
   */
  getTotalUnpaid(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/statements/summary/total-unpaid`);
  }

  /**
   * Tổng hợp theo nhân viên
   */
  getSummaryByEmployee(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/statements/summary/by-employee`);
  }

  /**
   * Lấy summary cards (4 cards)
   */
  getSummaryCards(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/summary/cards`);
  }
}
