import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Clone request và thêm Authorization header nếu có token
    let authReq = req;
    const token = this.authService.getToken();

    // Bypass auth header cho các endpoint financial-control (public dashboards)
    // Check cả /financial-control/ và /api/financial-control/
    if (req.url.includes('financial-control')) {
      console.log('AuthInterceptor: Bypassing auth for financial-control:', req.url);
      return next.handle(req);
    }

    console.log('AuthInterceptor:', { url: req.url, hasToken: !!token, tokenPreview: token?.substring(0, 20) });

    if (token) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('AuthInterceptor: Added Authorization header');
    }

    // Xử lý response và catch errors
    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Nếu 401 Unauthorized, CHỈ LOG - KHÔNG LOGOUT
        // Để AuthGuard handle việc redirect về login khi cần
        if (error.status === 401) {
          const url = authReq.url || '';
          console.log('AuthInterceptor: 401 error for URL:', url);
          // Không gọi forceLogout() - để AuthGuard và components tự xử lý
        }
        return throwError(() => error);
      })
    );
  }
}
