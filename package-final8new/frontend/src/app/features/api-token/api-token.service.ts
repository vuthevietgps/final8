/** Service quản lý API Token (frontend) */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiToken {
  _id: string;
  name: string;
  token?: string; // không trả về đầy đủ (có thể mask sau này)
  provider: 'facebook'|'zalo'|'other';
  status: 'active'|'inactive';
  fanpageId?: string;
  notes?: string;
  isPrimary?: boolean;
  expireAt?: string;
  lastCheckedAt?: string;
  lastCheckStatus?: 'valid'|'invalid'|'expired';
  lastCheckMessage?: string;
  rotatedFrom?: string;
  rotatedTo?: string;
  scopes?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateApiTokenRequest { name: string; token: string; provider: 'facebook'|'zalo'|'other'; status?: 'active'|'inactive'; fanpageId?: string; notes?: string; }
export interface UpdateApiTokenRequest extends Partial<CreateApiTokenRequest> {}
export interface RotateTokenRequest { newToken: string; notes?: string; }
export interface SetPrimaryRequest { fanpageId: string; }

@Injectable({ providedIn: 'root' })
export class ApiTokenService {
  private baseUrl = `${environment.apiUrl}/api-tokens`;
  constructor(private http: HttpClient) {}
  list() { return this.http.get<ApiToken[]>(this.baseUrl); }
  create(body: CreateApiTokenRequest) { return this.http.post<ApiToken>(this.baseUrl, body); }
  update(id: string, body: UpdateApiTokenRequest) { return this.http.patch<ApiToken>(`${this.baseUrl}/${id}`, body); }
  remove(id: string) { return this.http.delete(`${this.baseUrl}/${id}`); }
  validate(id: string) { return this.http.post<ApiToken>(`${this.baseUrl}/${id}/validate`, {}); }
  setPrimary(id: string, fanpageId: string) { return this.http.post<ApiToken>(`${this.baseUrl}/${id}/set-primary`, { fanpageId }); }
  rotate(id: string, body: RotateTokenRequest) { return this.http.post(`${this.baseUrl}/${id}/rotate`, body); }
  syncFromFanpages(){ return this.http.post<{imported:number, items:ApiToken[]}>(`${this.baseUrl}/sync/from-fanpages`, {}); }
  
  // Token Recovery Methods
  refreshManually(id: string, newToken: string) { 
    return this.http.patch<ApiToken>(`${this.baseUrl}/${id}`, { token: newToken }); 
  }
  activateBackup(fanpageId: string) { 
    return this.http.post<ApiToken>(`${this.baseUrl}/activate-backup`, { fanpageId }); 
  }
}