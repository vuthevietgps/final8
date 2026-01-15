import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReturnReportFilter, ReturnRow } from './return-report.models';

@Injectable({ providedIn: 'root' })
export class ReturnReportService {
  private baseUrl = `${environment.apiUrl}/return-report`;

  constructor(private http: HttpClient) {}

  getByAdGroup(filter: ReturnReportFilter): Observable<ReturnRow[]> {
    let params = new HttpParams();
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    if (filter.adGroupId) params = params.set('adGroupId', filter.adGroupId);
    return this.http.get<ReturnRow[]>(`${this.baseUrl}/ad-group`, { params });
  }

  getByProduct(filter: ReturnReportFilter): Observable<ReturnRow[]> {
    let params = new HttpParams();
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    if (filter.productId) params = params.set('productId', filter.productId);
    return this.http.get<ReturnRow[]>(`${this.baseUrl}/product`, { params });
  }
}
