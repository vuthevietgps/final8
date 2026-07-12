import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type LandingApprovalStatus = 'pending' | 'approved' | 'rejected';
export type BusinessNoteSource = 'manual' | 'ads' | 'finance' | 'operations' | 'supply';

export interface LandingPageContext {
  _id: string;
  url: string;
  domain: string;
  title?: string;
  productId: string | { _id: string; name?: string };
  mainCta?: string;
  notes?: string;
  lastCheckedAt?: string;
  approvalStatus: LandingApprovalStatus;
  status?: LandingApprovalStatus;
  approvedForAds: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface BusinessDailyNoteContext {
  _id: string;
  date: string;
  summary: string;
  notes?: string;
  anomalies: string[];
  source: BusinessNoteSource;
  affectedCustomerId?: string;
  affectedCampaignId?: string;
  affectedAdGroupId?: string;
  affectedProductId?: string | { _id: string; name?: string };
  severity: 'info' | 'warning' | 'critical';
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface LandingPagePayload {
  url: string;
  productId: string;
  title?: string;
  mainCta?: string;
  notes?: string;
  lastCheckedAt?: string;
}

export interface BusinessDailyNotePayload {
  date: string;
  summary: string;
  notes?: string;
  anomalies?: string[];
  source?: BusinessNoteSource;
  affectedCustomerId?: string;
  affectedCampaignId?: string;
  affectedAdGroupId?: string;
  affectedProductId?: string;
  severity?: 'info' | 'warning' | 'critical';
}

type ListResponse<T> = { data: T[]; pagination?: { total: number; page: number; limit: number; totalPages: number } };

@Injectable({ providedIn: 'root' })
export class AdsBusinessContextApi {
  private readonly baseUrl = `${environment.apiUrl}/ads-business-context`;

  constructor(private readonly http: HttpClient) {}

  listLandingPages(filters: { approvalStatus?: LandingApprovalStatus; productId?: string } = {}): Observable<ListResponse<LandingPageContext>> {
    let params = new HttpParams().set('limit', 200);
    if (filters.approvalStatus) params = params.set('approvalStatus', filters.approvalStatus);
    if (filters.productId) params = params.set('productId', filters.productId);
    return this.http.get<ListResponse<LandingPageContext>>(`${this.baseUrl}/landing-pages`, { params, withCredentials: true });
  }

  createLandingPage(payload: LandingPagePayload): Observable<LandingPageContext> {
    return this.http.post<LandingPageContext>(`${this.baseUrl}/landing-pages`, payload, { withCredentials: true });
  }

  updateLandingPage(id: string, payload: Partial<LandingPagePayload>): Observable<LandingPageContext> {
    return this.http.patch<LandingPageContext>(`${this.baseUrl}/landing-pages/${encodeURIComponent(id)}`, payload, { withCredentials: true });
  }

  approveLandingPage(id: string): Observable<LandingPageContext> {
    return this.http.patch<LandingPageContext>(`${this.baseUrl}/landing-pages/${encodeURIComponent(id)}/approve`, {}, { withCredentials: true });
  }

  rejectLandingPage(id: string, reason: string): Observable<LandingPageContext> {
    return this.http.patch<LandingPageContext>(
      `${this.baseUrl}/landing-pages/${encodeURIComponent(id)}/reject`,
      { reason },
      { withCredentials: true },
    );
  }

  listDailyNotes(filters: { dateFrom?: string; dateTo?: string; source?: BusinessNoteSource } = {}): Observable<ListResponse<BusinessDailyNoteContext>> {
    let params = new HttpParams().set('limit', 200);
    if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
    if (filters.source) params = params.set('source', filters.source);
    return this.http.get<ListResponse<BusinessDailyNoteContext>>(`${this.baseUrl}/daily-notes`, { params, withCredentials: true });
  }

  createDailyNote(payload: BusinessDailyNotePayload): Observable<BusinessDailyNoteContext> {
    return this.http.post<BusinessDailyNoteContext>(`${this.baseUrl}/daily-notes`, payload, { withCredentials: true });
  }

  updateDailyNote(id: string, payload: Partial<BusinessDailyNotePayload>): Observable<BusinessDailyNoteContext> {
    return this.http.patch<BusinessDailyNoteContext>(`${this.baseUrl}/daily-notes/${encodeURIComponent(id)}`, payload, { withCredentials: true });
  }
}
