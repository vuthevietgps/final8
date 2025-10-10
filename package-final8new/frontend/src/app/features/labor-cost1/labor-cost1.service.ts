/**
 * File: features/labor-cost1/labor-cost1.service.ts
 * Mô tả: Gọi API Chi Phí Nhân Công 1.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateLaborCost1Dto, LaborCost1, UpdateLaborCost1Dto } from './labor-cost1.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LaborCost1Service {
  private apiUrl = `${environment.apiUrl}/labor-cost1`;
  constructor(private http: HttpClient) {}

  list(): Observable<LaborCost1[]> { return this.http.get<LaborCost1[]>(this.apiUrl); }
  create(dto: CreateLaborCost1Dto): Observable<LaborCost1> { return this.http.post<LaborCost1>(this.apiUrl, dto); }
  update(id: string, dto: UpdateLaborCost1Dto): Observable<LaborCost1> { return this.http.patch<LaborCost1>(`${this.apiUrl}/${id}`, dto); }
  remove(id: string): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/${id}`); }
  
  generateFromSessionLogs(userId?: string, date?: string): Observable<any> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (date) params.append('date', date);
    const queryString = params.toString();
    const url = queryString ? `${this.apiUrl}/generate-from-sessions?${queryString}` : `${this.apiUrl}/generate-from-sessions`;
    return this.http.post<any>(url, {});
  }
}
