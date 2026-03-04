import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoginRequest } from '../../../core/models/auth.interface';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <h1>Đăng nhập hệ thống</h1>
          <p class="welcome-text">Chào mừng bạn đăng nhập hệ thống ERP Fulfillment</p>
          <p class="version-text">ERP Fulfilment Version1</p>
        </div>

        <form class="login-form" (ngSubmit)="onLogin($event)">
          @if (errorMessage()) {
            <div class="login-error">
              {{ errorMessage() }}
            </div>
          }

          <div class="input-group">
            <label for="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              class="login-input"
              placeholder="Email"
              [(ngModel)]="loginData.email"
            />
          </div>

          <div class="input-group">
            <label for="password">Mật khẩu</label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="login-input"
              placeholder="Mật khẩu"
              [(ngModel)]="loginData.password"
            />
          </div>

          <button
            type="submit"
            class="login-button"
            [disabled]="authService.isLoading()"
          >
            @if (authService.isLoading()) {
              Đang đăng nhập...
            } @else {
              Đăng nhập
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(135deg, #f3f6fb 0%, #e8eef9 100%);
      position: relative;
      z-index: 2000;
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.15);
      padding: 28px;
      border: 1px solid #dce4f2;
    }

    .login-header {
      text-align: center;
      margin-bottom: 20px;
    }

    .login-header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      color: #0f172a;
    }

    .welcome-text {
      margin: 10px 0 6px;
      font-size: 15px;
      color: #1d4ed8;
      font-weight: 600;
    }

    .version-text {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }

    .login-form {
      display: grid;
      gap: 14px;
    }

    .login-error {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #b91c1c;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .input-group label {
      font-size: 14px;
      color: #334155;
      font-weight: 600;
    }

    .login-input {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      color: #0f172a;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .login-input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }

    .login-button {
      margin-top: 4px;
      border: none;
      border-radius: 10px;
      padding: 12px;
      font-size: 15px;
      font-weight: 600;
      color: #ffffff;
      background: #2563eb;
      cursor: pointer;
      transition: background 0.2s;
    }

    .login-button:hover {
      background: #1d4ed8;
    }

    .login-button:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  `]
})
export class LoginComponent {
  loginData: LoginRequest = {
    email: '',
    password: ''
  };

  errorMessage = signal<string>('');

  constructor(
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    }

    // Khi vào trang login, clear auth data cũ để tránh race condition
    // Các request API từ component khác sẽ không có token -> không gây 401 logout loop
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('current_user');
    }
  }

  private extractBackendErrorMessage(error: any): string | null {
    const payload = error?.error ?? error?.response ?? null;
    const candidates = [payload, payload?.message, payload?.error, error?.message];

    for (const value of candidates) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      if (Array.isArray(value) && value.length > 0) {
        const first = String(value[0] ?? '').trim();
        if (first) return first;
      }
    }

    return null;
  }

  onLogin(event: Event): void {
    event.preventDefault();

    if (!this.loginData.email || !this.loginData.password) {
      this.errorMessage.set('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    this.errorMessage.set('');

    this.authService.login(this.loginData).subscribe({
      next: () => {
        // Get return URL or default to dashboard
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (error: any) => {
        console.error('Login error:', error);
        const backendMessage = this.extractBackendErrorMessage(error);

        if (error.status === 0) {
          this.errorMessage.set('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.');
        } else {
          this.errorMessage.set(backendMessage || ('Đăng nhập thất bại (' + (error.status ?? 'unknown') + ')'));
        }
      }
    });
  }
}
