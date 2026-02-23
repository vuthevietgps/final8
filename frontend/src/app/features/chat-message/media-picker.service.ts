import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface MediaItem {
  _id: string;
  url: string;
  alt?: string;
  tags?: string[];
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class MediaPickerService {
  private baseUrl = `${environment.apiUrl}/media`;
  constructor(private http: HttpClient) {}

  list(query: any = {}){
    let params = new HttpParams();
    Object.keys(query).forEach(k=>{ if(query[k]!==undefined && query[k]!=='' ) params = params.set(k, query[k]); });
    return this.http.get<{ items: MediaItem[]; total: number; page: number; limit: number }>(`${this.baseUrl}`, { params });
  }
}
