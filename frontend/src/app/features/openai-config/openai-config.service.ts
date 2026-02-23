/**
 * File: openai-config/openai-config.service.ts
 * Mục đích: Service gọi API backend để quản lý cấu hình OpenAI
 * Chức năng: CRUD cấu hình OpenAI với xử lý lỗi và validation
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OpenAIConfig {
  _id: string;
  name: string;
  description?: string;
  model: string;
  apiKey?: string;
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
  scopeType: 'global' | 'fanpage' | 'adgroup' | 'messageScope';
  scopeRef?: string;
  status?: 'active' | 'inactive';
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOpenAIConfigRequest {
  name: string;
  description?: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
  scopeType: 'global' | 'fanpage' | 'adgroup' | 'messageScope';
  scopeRef?: string;
  status?: 'active' | 'inactive';
  isDefault?: boolean;
}

export interface UpdateOpenAIConfigRequest extends Partial<CreateOpenAIConfigRequest> {}

export interface TestKeyResponse { valid: boolean; reason?: string; message?: string; model?: string; }

@Injectable({ providedIn: 'root' })
export class OpenAIConfigService {
  private baseUrl = `${environment.apiUrl}/openai-configs`;
  constructor(private http: HttpClient) {}

  list(params?: Record<string,string>): Observable<OpenAIConfig[]> {
    let p = new HttpParams();
    if(params){ Object.entries(params).forEach(([k,v]) => { if(v!=null) p = p.set(k,v); }); }
    return this.http.get<OpenAIConfig[]>(this.baseUrl, { params: p });
  }
  create(body: CreateOpenAIConfigRequest): Observable<OpenAIConfig> { return this.http.post<OpenAIConfig>(this.baseUrl, body); }
  update(id: string, body: UpdateOpenAIConfigRequest): Observable<OpenAIConfig> { return this.http.patch<OpenAIConfig>(`${this.baseUrl}/${id}`, body); }
  delete(id: string) { return this.http.delete(`${this.baseUrl}/${id}`); }
  testKey(apiKey: string, model?: string) { return this.http.post<TestKeyResponse>(`${this.baseUrl}/test-key`, { apiKey, model }); }
}
