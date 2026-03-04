import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { PlanService } from '../services/plan.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private planService: PlanService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    console.log('AuthGuard: canActivate called for:', state.url);
    
    // Kiểm tra token trước - nếu không có thì return false ngay
    const token = this.authService.getToken();
    if (!token) {
      console.warn('AuthGuard: No token, redirecting to login');
      this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return of(false); // Return Observable để consistent với return type
    }

    // Chỉ gọi validateToken khi ĐÃ CÓ token
    return this.authService.validateToken().pipe(
      map(isValid => {
        console.log('AuthGuard: validateToken result:', isValid, 'for', state.url);
        if (isValid) {
          return this.validatePermissions(route);
        } else {
          console.warn('AuthGuard: Token invalid, redirecting to login');
          this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
          return false;
        }
      }),
      catchError((err) => {
        console.error('AuthGuard: validateToken error:', err);
        this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return of(false);
      })
    );
  }

  private validatePermissions(route: ActivatedRouteSnapshot): boolean {
    // Kiểm tra module access theo gói (plan)
    const featureModule = route.data?.['featureModule'] as string;
    if (featureModule && !this.planService.hasModuleAccess(featureModule)) {
      this.router.navigate(['/upgrade-plan']);
      return false;
    }

    const requiredPermissions = route.data?.['permissions'] as string[];

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No specific permissions required
    }

    const hasPermission = this.authService.hasAnyPermission(requiredPermissions);

    if (!hasPermission) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    return true;
  }
}
