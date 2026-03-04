/**
 * File: app/app.ts
 * Mục đích: Khai báo App bootstrap (standalone) và thành phần root của ứng dụng.
 */
import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('erp-fulfilment-version1');
  
  private router = inject(Router);
  private authService = inject(AuthService);
  
  // Track current route để ẩn sidebar trên login
  private currentUrl = signal(typeof window !== 'undefined' ? window.location.pathname : '/');
  
  // Chỉ hiện sidebar khi KHÔNG ở trang login VÀ đã authenticated
  showSidebar = computed(() => {
    const url = this.currentUrl();
    const isLoginPage = url === '/login' || url.startsWith('/login');
    
    // Double check: Nếu ở trang login, đảm bảo không hiện sidebar
    if (isLoginPage) {
      return false;
    }
    
    // Chỉ hiện khi có cả user VÀ token trong localStorage
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');
    const isAuth = this.authService.isAuthenticated();
    
    // Debug
    console.log('showSidebar computed:', { url, isLoginPage, hasToken, isAuth, result: hasToken && isAuth });
    return hasToken && isAuth;
  });

  private cleanupGlobalOverlays(): void {
    if (typeof document === 'undefined') {
      return;
    }

    // Remove stale Bootstrap backdrop that can block all clicks after route change.
    document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());

    // Reset Bootstrap body lock styles/classes.
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  }
  
  constructor() {
    // QUAN TRỌNG: Nếu đang ở trang login, clear localStorage ngay
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath === '/login' || currentPath.startsWith('/login')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('current_user');
      }
    }

    // Cleanup any stale global overlay on first paint.
    this.cleanupGlobalOverlays();
    
    // Listen to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl.set(event.urlAfterRedirects || event.url);
      this.cleanupGlobalOverlays();
    });
  }
}
