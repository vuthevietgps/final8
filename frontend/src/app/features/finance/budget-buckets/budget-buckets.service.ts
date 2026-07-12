import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface BudgetBucket {
  _id: string;
  name: string;
  code?: string;
  /** Product.categoryId values. Empty means global. */
  productGroupIds: string[];
  dailyCap: number;
  weeklyCap: number;
  monthlyCap: number;
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SaveBudgetBucket = Omit<BudgetBucket, '_id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class BudgetBucketsService {
  private readonly baseUrl = `${environment.apiUrl}/finance/budget-buckets`;

  constructor(private readonly http: HttpClient) {}

  list(active?: boolean): Observable<BudgetBucket[]> {
    let params = new HttpParams();
    if (active !== undefined) params = params.set('active', String(active));
    return this.http.get<BudgetBucket[]>(this.baseUrl, { params });
  }

  create(payload: SaveBudgetBucket): Observable<BudgetBucket> {
    return this.http.post<BudgetBucket>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<SaveBudgetBucket>): Observable<BudgetBucket> {
    return this.http.patch<BudgetBucket>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload);
  }
}
