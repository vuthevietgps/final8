/**
 * File: features/delivery-status/delivery-status.service.ts
 * Mục đích: Giao tiếp API Trạng thái giao hàng.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DeliveryStatus, CreateDeliveryStatusDto, DeliveryStatusStats } from './models/delivery-status.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DeliveryStatusService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/delivery-status`;

  getAll(): Observable<DeliveryStatus[]> {
    return this.http.get<DeliveryStatus[]>(this.apiUrl);
  }

  getById(id: string): Observable<DeliveryStatus> {
    return this.http.get<DeliveryStatus>(`${this.apiUrl}/${id}`);
  }

  create(deliveryStatus: CreateDeliveryStatusDto): Observable<DeliveryStatus> {
    return this.http.post<DeliveryStatus>(this.apiUrl, deliveryStatus);
  }

  update(id: string, deliveryStatus: Partial<CreateDeliveryStatusDto>): Observable<DeliveryStatus> {
    return this.http.patch<DeliveryStatus>(`${this.apiUrl}/${id}`, deliveryStatus);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  updateOrder(id: string, order: number): Observable<DeliveryStatus> {
    return this.http.patch<DeliveryStatus>(`${this.apiUrl}/${id}/order`, { order });
  }

  getActiveStatuses(): Observable<DeliveryStatus[]> {
    return this.http.get<DeliveryStatus[]>(`${this.apiUrl}/active`);
  }

  getFinalStatuses(): Observable<DeliveryStatus[]> {
    return this.http.get<DeliveryStatus[]>(`${this.apiUrl}/final`);
  }

  getStats(): Observable<DeliveryStatusStats> {
    return this.http.get<DeliveryStatusStats>(`${this.apiUrl}/stats/summary`);
  }
}
