/**
 * File: fanpage/fanpage.service.ts
 * Mục đích: Service gọi API backend để quản lý Fanpage
 * Chức năng: CRUD fanpage với xử lý lỗi và validation
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Fanpage {
  _id: string;
  pageId: string;
  name: string;
  status: 'active' | 'inactive';
  accessToken?: string;
  avatarUrl?: string;
  connectedAt?: string;
  lastRefreshAt?: string;
  connectedBy?: string;
  defaultProductGroup?: string;
  description?: string;
  greetingScript?: string;
  clarifyScript?: string;
  productSuggestScript?: string;
  fallbackScript?: string;
  closingScript?: string;
  subscriberCount?: number;
  messageQuota?: number;
  sentThisMonth?: number;
  subscribedWebhook?: boolean;
  aiEnabled?: boolean;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
  openAIConfigId?: string;
}

export interface CreateFanpageRequest {
  pageId: string;
  name: string;
  accessToken: string;
  status?: 'active' | 'inactive';
  avatarUrl?: string;
  connectedBy?: string;
  defaultProductGroup?: string;
  description?: string;
  greetingScript?: string;
  clarifyScript?: string;
  productSuggestScript?: string;
  fallbackScript?: string;
  closingScript?: string;
  messageQuota?: number;
  subscriberCount?: number;
  sentThisMonth?: number;
  aiEnabled?: boolean;
  subscribedWebhook?: boolean;
  timezone?: string;
  openAIConfigId?: string;
}

export interface UpdateFanpageRequest extends Partial<CreateFanpageRequest> {}

@Injectable({ providedIn: 'root' })
export class FanpageService {
  private baseUrl = `${environment.apiUrl}/fanpages`;
  constructor(private http: HttpClient) {}

  list(): Observable<Fanpage[]> { return this.http.get<Fanpage[]>(this.baseUrl); }
  create(body: CreateFanpageRequest): Observable<Fanpage> { return this.http.post<Fanpage>(this.baseUrl, body); }
  update(id: string, body: UpdateFanpageRequest): Observable<Fanpage> { return this.http.patch<Fanpage>(`${this.baseUrl}/${id}`, body); }
  delete(id: string) { return this.http.delete(`${this.baseUrl}/${id}`); }
  createAIConfig(id: string) { return this.http.post(`${this.baseUrl}/${id}/create-ai-config`, {}); }
}
