import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { User, LoginRequest, LoginResponse, RegisterRequest, UserRole } from '../models/auth.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'current_user';

  // Signals cho reactive state management
  // KHÔNG load user từ storage lúc khởi tạo để tránh race condition
  // User sẽ được set khi login thành công hoặc validateToken success
  private readonly userSignal = signal<User | null>(null);
  private readonly isLoadingSignal = signal<boolean>(false);
  
  // Track thời điểm login để tránh logout ngay sau khi vừa login
  private loginTimestamp: number = 0;
  private readonly LOGIN_GRACE_PERIOD = 10000; // 10 giây để components kịp load
  
  // Check xem có đang trong grace period sau login không
  isInLoginGracePeriod(): boolean {
    return Date.now() - this.loginTimestamp < this.LOGIN_GRACE_PERIOD;
  }

  // Computed signals
  readonly user = this.userSignal.asReadonly();
  // isAuthenticated chỉ true khi CẢ user VÀ token đều có
  readonly isAuthenticated = computed(() => !!this.userSignal() && !!this.getToken());
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly userRole = computed(() => this.userSignal()?.role);

  // Permission mappings
  private readonly rolePermissions: Record<UserRole, string[]> = {
    [UserRole.DIRECTOR]: [
      'users', 'orders', 'orders-test2', 'products', 'product-categories', 'media',
      'delivery-status', 'production-status', 'order-status',
      'ad-accounts', 'ad-groups', 'advertising-costs',
      'labor-costs', 'other-costs', 'salary-config',
      // Newly explicit permissions used by Sidebar
      'customers', 'purchase-costs', 'fanpages', 'openai-configs', 'api-tokens', 'chat-messages', 'ai-assistant', 'pending-orders',
      'supplier-quotes.approve', 'orders.confirm-business',
      'quotes', 'reports', 'export', 'import', 'settings',
      // Ngân sách Ads & KPI - Director có quyền xem
      'ads-budget', 'employee-ads-kpi', 'manager-handbook', 'finance', 'finance.budget-buckets.manage', 'finance.policy.manage',
      // Quỹ Owner - Chỉ Director có quyền
      'owner-fund',
      // Cập nhật đơn hàng từ Excel
      'order-update',
      'google-ads.read', 'google-ads.plan', 'google-ads.approve', 'google-ads.execute',
      'google-ads.credentials.read', 'google-ads.credentials.write', 'google-ads.emergency-pause',
      'ai-data-pack.marketer.read'
    ],
    [UserRole.MANAGER]: [
      'orders-test2', 'pending-orders', 'orders.confirm-business',
      'ad-accounts', 'ad-groups', 'advertising-costs', 'media', // Ads + media
      'fanpages', 'openai-configs', 'chat-messages', 'ai-assistant',
      // Ads budget + KPI
      'ads-budget', 'employee-ads-kpi', 'manager-handbook', 'reports',
      'google-ads.read', 'google-ads.plan', 'ai-data-pack.marketer.read'
    ],
    [UserRole.EMPLOYEE]: [
      'orders-test2', 'order-update', 'chat-messages'
    ],
    [UserRole.INTERNAL_AGENT]: ['orders-test2'],
    [UserRole.EXTERNAL_AGENT]: ['orders-test2'],
    [UserRole.INTERNAL_SUPPLIER]: ['orders-test2'],
    [UserRole.EXTERNAL_SUPPLIER]: ['orders-test2']
  };

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Chỉ load user từ storage nếu KHÔNG ở trang login
    // Điều này tránh race condition khi App constructor clear localStorage
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const isLoginPage = currentPath === '/login' || currentPath.startsWith('/login');
      
      if (!isLoginPage) {
        // Load user từ storage cho các trang khác
        const storedUser = this.getUserFromStorage();
        if (storedUser && this.getToken()) {
          this.userSignal.set(storedUser);
        }
      }
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    this.isLoadingSignal.set(true);
    
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => {
        this.storeAuthData(response);
        this.userSignal.set(response.user);
        this.isLoadingSignal.set(false);
        // Set login timestamp để tránh logout ngay sau login
        this.loginTimestamp = Date.now();
      }),
      catchError(error => {
        this.isLoadingSignal.set(false);
        return throwError(() => error);
      })
    );
  }

  register(userData: RegisterRequest): Observable<User> {
    this.isLoadingSignal.set(true);
    
    return this.http.post<User>(`${this.API_URL}/register`, userData).pipe(
      tap(() => {
        this.isLoadingSignal.set(false);
      }),
      catchError(error => {
        this.isLoadingSignal.set(false);
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    // Gọi API auth/logout để ghi nhận logout VÀ tạo LaborCost1 tự động
    const token = this.getToken();
    if (token) {
      // Gọi API với Authorization header trực tiếp (vì interceptor có thể không kịp)
      this.http.post(
        `${this.API_URL}/logout`,
        {},
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'X-Skip-Auth-Handling': '1' 
          } 
        }
      ).subscribe({ 
        next: (res) => console.log('Logout success:', res), 
        error: (err) => console.error('Logout error:', err) 
      });
    }
    // Xóa auth data sau khi gửi request
    this.clearAuthData();
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  // Force client-side logout without calling server (avoid extra 401s)
  forceLogout(): void {
    this.clearAuthData();
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  // Public method để clear auth data (dùng khi vào trang login)
  clearAuthDataPublic(): void {
    this.clearAuthData();
    this.userSignal.set(null);
  }

  validateToken(): Observable<boolean> {
    const token = this.getToken();
    const currentUser = this.userSignal();
    
    console.log('validateToken called:', { 
      hasToken: !!token, 
      hasUser: !!currentUser, 
      userEmail: currentUser?.email 
    });
    
    if (!token) {
      console.warn('validateToken: No token, returning false');
      return new Observable<boolean>(observer => {
        observer.next(false);
        observer.complete();
      });
    }

    // LUÔN verify token với backend để đảm bảo token hợp lệ
    // Không tin vào userSignal() vì token có thể bị corrupt hoặc expire
    console.log('validateToken: Calling API to verify token');
    return this.http.post<{valid: boolean, user: User}>(`${this.API_URL}/validate-token`, {}).pipe(
      map(response => {
        console.log('validateToken: API response:', response);
        if (response.valid && response.user) {
          this.userSignal.set(response.user);
          return true;
        } else {
          console.warn('validateToken: Token invalid from backend');
          this.clearAuthDataPublic();
          return false;
        }
      }),
      catchError((err) => {
        console.error('validateToken: API error:', err);
        this.clearAuthDataPublic();
        return of(false);
      })
    );
  }

  hasPermission(permission: string): boolean {
    return this.getCurrentPermissions().includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  getCurrentPermissions(): string[] {
    const userRole = this.userSignal()?.role;
    if (!userRole) return [];
    return [...(this.rolePermissions[userRole] || [])];
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  private storeAuthData(response: LoginResponse): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, response.access_token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    }
  }

  private clearAuthData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
  }

  private getUserFromStorage(): User | null {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    }
    return null;
  }
}
