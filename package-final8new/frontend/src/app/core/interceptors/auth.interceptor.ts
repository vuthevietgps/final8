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

    if (token) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    // Xử lý response và catch errors
    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Nếu 401 Unauthorized, có thể gây vòng lặp nếu chính request là /session-logs/logout
        if (error.status === 401) {
          const url = authReq.url || '';
          const skip = authReq.headers.has('X-Skip-Auth-Handling');
          const isLogoutCall = url.includes('/session-logs/logout');
          const isLoginOrValidate = url.includes('/auth/login') || url.includes('/auth/validate-token');
          // Bỏ qua auto-logout cho những request đặc biệt để tránh lặp vô hạn
          if (!skip && !isLogoutCall) {
            // Với validate-token trả 401: đăng xuất cục bộ nhanh gọn
            if (isLoginOrValidate) {
              this.authService.forceLogout();
            } else {
              // Endpoint khác trả 401: chỉ đăng xuất cục bộ, không gọi logout API để tránh 401 lặp
              this.authService.forceLogout();
            }
          }
        }
        return throwError(() => error);
      })
    );
  }
}
