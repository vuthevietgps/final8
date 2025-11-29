import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OrderUpdateResult {
  successCount: number;
  errorCount: number;
  totalProcessed: number;
  skippedCount: number;
  successItems: {
    trackingNumber: string;
    customerName: string;
    updatedFields: string[];
  }[];
  errors: {
    row: number;
    message: string;
    trackingNumber?: string;
  }[];
  skippedItems: {
    trackingNumber: string;
    customerName: string;
    reason: string;
  }[];
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderUpdateService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/order-update`;

  updateOrdersFromExcel(file: File): Observable<OrderUpdateResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<OrderUpdateResult>(`${this.baseUrl}/excel`, formData).pipe(
      timeout({ each: 60000 })
    );
  }

  previewExcelData(file: File): Observable<{
    sampleData: any[];
    totalRows: number;
    mappingInfo: any;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<{
      sampleData: any[];
      totalRows: number;
      mappingInfo: any;
    }>(`${this.baseUrl}/preview`, formData).pipe(
      timeout({ each: 30000 })
    );
  }
}