/**
 * File: features/quote/quote.service.ts
 * Mục đích: Giao tiếp API Báo giá đại lý (CRUD, thống kê) và hỗ trợ load danh sách người dùng/sản phẩm.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Quote, CreateQuote, UpdateQuote, QuoteStats, Product, User } from './models/quote.model';
import { UserService } from '../user/user.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class QuoteService {
  private apiUrl = `${environment.apiUrl}/quotes`;
  private productsUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient, private userService: UserService) {}

  // Quote CRUD operations
  getQuotes(params?: any): Observable<Quote[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    
    return this.http.get<Quote[]>(this.apiUrl, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  getQuote(id: string): Observable<Quote> {
    return this.http.get<Quote>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  createQuote(quote: CreateQuote): Observable<Quote | Quote[]> {
    return this.http.post<Quote | Quote[]>(this.apiUrl, quote)
      .pipe(catchError(this.handleError));
  }

  updateQuote(id: string, quote: UpdateQuote): Observable<Quote> {
    return this.http.patch<Quote>(`${this.apiUrl}/${id}`, quote)
      .pipe(catchError(this.handleError));
  }

  deleteQuote(id: string): Observable<Quote> {
    return this.http.delete<Quote>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  getQuoteStats(): Observable<QuoteStats> {
    return this.http.get<QuoteStats>(`${this.apiUrl}/stats/summary`)
      .pipe(catchError(this.handleError));
  }

  getQuotesByAgent(agentId: string): Observable<Quote[]> {
    return this.http.get<Quote[]>(`${this.apiUrl}/agent/${agentId}`)
      .pipe(catchError(this.handleError));
  }

  getQuotesByProduct(productId: string): Observable<Quote[]> {
    return this.http.get<Quote[]>(`${this.apiUrl}/product/${productId}`)
      .pipe(catchError(this.handleError));
  }

  // Helper methods for dropdowns
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.productsUrl)
      .pipe(catchError(this.handleError));
  }

  getAgents(): Observable<User[]> {
    // Use lightweight agents endpoint to avoid needing 'users' permission
    return this.userService.getAgents()
      .pipe(
        map((users: any[]) => users.map(user => ({
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          // Optional fields may be absent in minimal payload
          phone: user.phone || '',
          address: user.address || '',
          isActive: user.isActive !== false
        }))),
        catchError(this.handleError)
      );
  }

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    let errorMessage = 'Có lỗi xảy ra khi thực hiện thao tác';
    // Ưu tiên thông điệp rõ ràng từ backend NestJS
    const err = error?.error || error;
    if (typeof err === 'string') {
      errorMessage = err;
    } else if (err?.message) {
      if (Array.isArray(err.message)) {
        errorMessage = err.message.join('\n');
      } else {
        errorMessage = err.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    // Gắn thêm thông tin status code nếu có
    if (error.status) errorMessage = `[${error.status}] ${errorMessage}`;
    return throwError(() => new Error(errorMessage));
  }
}
