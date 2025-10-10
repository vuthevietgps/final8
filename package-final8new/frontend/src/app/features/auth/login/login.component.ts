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
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Đăng nhập hệ thống
          </h2>
          <p class="mt-2 text-center text-sm text-gray-600">
            Management System V4-4.1
          </p>
        </div>
        
        <form class="mt-8 space-y-6" (ngSubmit)="onLogin($event)">
          @if (errorMessage()) {
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {{ errorMessage() }}
            </div>
          }
          
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="email" class="sr-only">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email"
                [(ngModel)]="loginData.email"
              />
            </div>
            <div>
              <label for="password" class="sr-only">Mật khẩu</label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Mật khẩu"
                [(ngModel)]="loginData.password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              [disabled]="authService.isLoading()"
            >
              @if (authService.isLoading()) {
                <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg class="animate-spin h-5 w-5 text-indigo-300" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
                Đang đăng nhập...
              } @else {
                Đăng nhập
              }
            </button>
          </div>

          <div class="text-center">
            <p class="text-sm text-gray-600">
              Demo accounts:<br>
              <span class="text-xs">Director: director@example.com / 123456</span><br>
              <span class="text-xs">Manager: manager@example.com / 123456</span><br>
              <span class="text-xs">Employee: employee@example.com / 123456</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .min-h-screen {
      min-height: 100vh;
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
  ) {}

  onLogin(event: Event): void {
    event.preventDefault();
    
    if (!this.loginData.email || !this.loginData.password) {
      this.errorMessage.set('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    this.errorMessage.set('');
    
    this.authService.login(this.loginData).subscribe({
      next: (response: any) => {
        // Get return URL or default to dashboard
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (error: any) => {
        console.error('Login error:', error);
        
        if (error.status === 401) {
          this.errorMessage.set('Email hoặc mật khẩu không đúng');
        } else if (error.status === 0) {
          this.errorMessage.set('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.');
        } else {
          this.errorMessage.set(error.error?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        }
      }
    });
  }
}
