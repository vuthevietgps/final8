import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Supplier {
  _id: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  role: 'internal_supplier' | 'external_supplier';
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private baseUrl = `${environment.apiUrl}/users/suppliers`;
  constructor(private http: HttpClient) {}

  list(params: { q?: string; active?: boolean; minimal?: boolean } = {}): Observable<Supplier[]> {
    let hp = new HttpParams();
    if (params.q) hp = hp.set('q', params.q);
    if (params.active !== undefined) hp = hp.set('active', String(params.active));
    if (params.minimal !== undefined) hp = hp.set('minimal', String(params.minimal));
    return this.http.get<Supplier[]>(this.baseUrl, { params: hp, withCredentials: true });
  }
}
