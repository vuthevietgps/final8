/**
 * File: facebook-token.service.ts
 * Mục đích: Service gọi API Facebook Token Management từ frontend
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FacebookToken {
  _id?: string;
  name: string;
  tokenType: string;
  appId?: string;
  userId?: string;
  expiresAt?: string;
  permissions: string[];
  isActive: boolean;
  isDefault: boolean;
  lastUsedAt?: string;
  usageCount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFacebookToken {
  name: string;
  accessToken: string;
  tokenType?: string;
  appId?: string;
  userId?: string;
  expiresAt?: string;
  permissions?: string[];
  isActive?: boolean;
  isDefault?: boolean;
  notes?: string;
}

export interface UpdateFacebookToken extends Partial<CreateFacebookToken> {}

export interface TokenTestResult {
  valid: boolean;
  error?: string;
  permissions?: string[];
}

@Injectable({ providedIn: 'root' })
export class FacebookTokenService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/facebook-tokens`;

  getAll(): Observable<FacebookToken[]> {
    return this.http.get<FacebookToken[]>(this.baseUrl);
  }

  getOne(id: string): Observable<FacebookToken> {
    return this.http.get<FacebookToken>(`${this.baseUrl}/${id}`);
  }

  getDefault(): Observable<{ hasDefault: boolean; message: string }> {
    return this.http.get<{ hasDefault: boolean; message: string }>(`${this.baseUrl}/default`);
  }

  create(data: CreateFacebookToken): Observable<FacebookToken> {
    return this.http.post<FacebookToken>(this.baseUrl, data);
  }

  update(id: string, data: UpdateFacebookToken): Observable<FacebookToken> {
    return this.http.patch<FacebookToken>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  setDefault(id: string): Observable<FacebookToken> {
    return this.http.post<FacebookToken>(`${this.baseUrl}/${id}/set-default`, {});
  }

  testToken(id: string): Observable<TokenTestResult> {
    return this.http.post<TokenTestResult>(`${this.baseUrl}/${id}/test`, {});
  }
}