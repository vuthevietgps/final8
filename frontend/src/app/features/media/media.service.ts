import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MediaItem {
  _id: string;
  url: string; // public URL, e.g. /media/...
  filename: string;
  path: string;
  mimeType?: string;
  size?: number;
  tags?: string[];
  productId?: string;
  fanpageId?: string;
  isMainImage?: boolean;
  alt?: string;
  sourceType?: 'gallery' | 'feedback' | 'ugc' | 'marketing';
  width?: number;
  height?: number;
  aspectRatio?: string;
  createdAt?: string;
}

export interface MediaListResponse {
  items: MediaItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class MediaService {
  private http = inject(HttpClient);
  private base = environment.apiUrl || '/api';

  list(params: { productId?: string; fanpageId?: string; tag?: string; page?: number; limit?: number }): Observable<MediaListResponse> {
    let p = new HttpParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<MediaListResponse>(`${this.base}/media`, { params: p });
  }

  upload(file: File, opts: { productId?: string; fanpageId?: string; alt?: string; tags?: string; isMainImage?: boolean; sourceType?: 'gallery'|'feedback'|'ugc'|'marketing' }): Observable<MediaItem> {
    const form = new FormData();
    form.append('file', file);
    if (opts.productId) form.append('productId', opts.productId);
    if (opts.fanpageId) form.append('fanpageId', opts.fanpageId);
    if (opts.alt) form.append('alt', opts.alt);
    if (opts.tags) form.append('tags', opts.tags);
    if (opts.isMainImage !== undefined) form.append('isMainImage', String(opts.isMainImage));
    if (opts.sourceType) form.append('sourceType', opts.sourceType);
    return this.http.post<MediaItem>(`${this.base}/media/upload`, form);
  }

  importByUrl(url: string, opts: { productId?: string; fanpageId?: string; alt?: string; tags?: string; isMainImage?: boolean; sourceType?: 'gallery'|'feedback'|'ugc'|'marketing' }): Observable<MediaItem> {
    return this.http.post<MediaItem>(`${this.base}/media/import-by-url`, { url, ...opts });
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/media/${id}`);
  }

  bulkDelete(ids: string[]): Observable<{ success: boolean; data: { deleted: number; failed: number; errors: string[] } }> {
    return this.http.post<{ success: boolean; data: { deleted: number; failed: number; errors: string[] } }>(`${this.base}/media/bulk-delete`, { ids });
  }

  setProductVariationImages(productId: string, fanpageId: string, images: string[]): Observable<any> {
    return this.http.patch(`${this.base}/products/${productId}/fanpage-variation-images`, { fanpageId, images });
  }

  listProductMedia(productId: string, page = 1, limit = 50): Observable<MediaListResponse> {
    return this.http.get<MediaListResponse>(`${this.base}/products/${productId}/media`, { params: { page, limit } as any });
  }

  getBestImages(productId: string, fanpageId?: string, limit = 4): Observable<string[]> {
    let params: any = { limit };
    if (fanpageId) params.fanpageId = fanpageId;
    return this.http.get<{ success: boolean; data: string[] }>(`${this.base}/products/${productId}/best-images`, { params }).pipe((src:any)=>src);
  }
}
