import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AvailableFunds {
  available: number;
  collectedRevenue: number;
  loanAvailable: number;
  actualSpent: number;
  reservedPayroll: number;
  reservedInterest: number;
  reservedPayables: number;
  reservedSuppliers: number;
  reservedAgents: number;
  reservedOther: number;
  capturedAt?: string;
  note?: string;
}

export interface CaptureAvailableFundPayload {
  collectedRevenue?: number;
  loanAvailable?: number;
  actualSpent?: number;
  reservedPayroll?: number;
  reservedInterest?: number;
  reservedPayables?: number;
  reservedSuppliers?: number;
  reservedAgents?: number;
  reservedOther?: number;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class AvailableFundsService {
  private api = `${environment.apiUrl}/finance/available-funds`;

  constructor(private http: HttpClient) {}

  getCurrent(payload?: CaptureAvailableFundPayload): Observable<AvailableFunds> {
    let params = new HttpParams();
    if (payload?.collectedRevenue !== undefined) params = params.set('collectedRevenue', String(payload.collectedRevenue));
    if (payload?.loanAvailable !== undefined) params = params.set('loanAvailable', String(payload.loanAvailable));
    if (payload?.actualSpent !== undefined) params = params.set('actualSpent', String(payload.actualSpent));
    if (payload?.reservedPayroll !== undefined) params = params.set('reservedPayroll', String(payload.reservedPayroll));
    if (payload?.reservedInterest !== undefined) params = params.set('reservedInterest', String(payload.reservedInterest));
    if (payload?.reservedPayables !== undefined) params = params.set('reservedPayables', String(payload.reservedPayables));
    if (payload?.reservedSuppliers !== undefined) params = params.set('reservedSuppliers', String(payload.reservedSuppliers));
    if (payload?.reservedAgents !== undefined) params = params.set('reservedAgents', String(payload.reservedAgents));
    if (payload?.reservedOther !== undefined) params = params.set('reservedOther', String(payload.reservedOther));
    return this.http.get<AvailableFunds>(`${this.api}/current`, { params });
  }

  listSnapshots(): Observable<AvailableFunds[]> {
    return this.http.get<AvailableFunds[]>(this.api);
  }

  capture(payload: CaptureAvailableFundPayload): Observable<AvailableFunds> {
    return this.http.post<AvailableFunds>(`${this.api}/capture`, payload);
  }
}
