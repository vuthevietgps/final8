import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/auth.interface';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-6">
            <div class="flex items-center">
              <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
            </div>
            <div class="flex items-center space-x-4">
              @if (authService.user(); as user) {
                <div class="text-sm">
                  <p class="text-gray-900 font-medium">{{ user.fullName }}</p>
                  <p class="text-gray-500">{{ getRoleDisplayName(user.role) }}</p>
                </div>
              }
              <button
                type="button"
                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                (click)="logout()"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          <div class="border-4 border-dashed border-gray-200 rounded-lg p-4">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Chào mừng đến với Hệ thống Quản lý</h2>
            
            @if (authService.user(); as user) {
              <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="px-4 py-5 sm:p-6">
                  <h3 class="text-lg leading-6 font-medium text-gray-900">Thông tin tài khoản</h3>
                  <div class="mt-5 border-t border-gray-200 pt-5">
                    <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <div>
                        <dt class="text-sm font-medium text-gray-500">Họ tên</dt>
                        <dd class="mt-1 text-sm text-gray-900">{{ user.fullName }}</dd>
                      </div>
                      <div>
                        <dt class="text-sm font-medium text-gray-500">Email</dt>
                        <dd class="mt-1 text-sm text-gray-900">{{ user.email }}</dd>
                      </div>
                      <div>
                        <dt class="text-sm font-medium text-gray-500">Vai trò</dt>
                        <dd class="mt-1 text-sm text-gray-900">{{ getRoleDisplayName(user.role) }}</dd>
                      </div>
                      <div>
                        <dt class="text-sm font-medium text-gray-500">Trạng thái</dt>
                        <dd class="mt-1 text-sm text-gray-900">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Đang hoạt động
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>

              <div class="mt-6 bg-white overflow-hidden shadow rounded-lg">
                <div class="px-4 py-5 sm:p-6">
                  <h3 class="text-lg leading-6 font-medium text-gray-900">Quyền truy cập</h3>
                  <div class="mt-5">
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      @for (permission of getAvailablePermissions(); track permission) {
                        <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {{ getPermissionDisplayName(permission) }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  constructor(public authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }

  getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      [UserRole.DIRECTOR]: 'Giám đốc',
      [UserRole.MANAGER]: 'Quản lý',
      [UserRole.EMPLOYEE]: 'Nhân viên',
      [UserRole.INTERNAL_AGENT]: 'Đại lý nội bộ',
      [UserRole.EXTERNAL_AGENT]: 'Đại lý bên ngoài',
      [UserRole.INTERNAL_SUPPLIER]: 'Nhà cung cấp nội bộ',
      [UserRole.EXTERNAL_SUPPLIER]: 'Nhà cung cấp bên ngoài'
    };
    return roleNames[role] || role;
  }

  getPermissionDisplayName(permission: string): string {
    const permissionNames: Record<string, string> = {
      'users': 'Quản lý người dùng',
      'products': 'Quản lý sản phẩm',
      'orders': 'Quản lý đơn hàng',
      'delivery-status': 'Trạng thái giao hàng',
      'production-status': 'Trạng thái sản xuất',
      'ad-accounts': 'Tài khoản quảng cáo',
      'ad-groups': 'Nhóm quảng cáo',
      'advertising-costs': 'Chi phí quảng cáo',
      'quotes': 'Báo giá',
      'product-categories': 'Danh mục sản phẩm',
      'order-status': 'Trạng thái đơn hàng',
      'labor-costs': 'Chi phí nhân công',
      'other-costs': 'Chi phí khác',
      'salary-config': 'Cấu hình lương',
      'reports': 'Báo cáo',
      'export': 'Xuất dữ liệu',
      'import': 'Nhập dữ liệu'
    };
    return permissionNames[permission] || permission;
  }

  getAvailablePermissions(): string[] {
    const user = this.authService.user();
    if (!user) return [];
    
    const rolePermissions: Record<UserRole, string[]> = {
      [UserRole.DIRECTOR]: [
        'users', 'orders', 'products', 'product-categories',
        'delivery-status', 'production-status', 'order-status',
        'ad-accounts', 'ad-groups', 'advertising-costs',
        'labor-costs', 'other-costs', 'salary-config',
        'quotes', 'reports', 'export', 'import', 'settings'
      ],
      [UserRole.MANAGER]: [
        'orders',
        'ad-accounts', 'ad-groups', 'advertising-costs'
      ],
      [UserRole.EMPLOYEE]: [
        'orders'
      ],
      [UserRole.INTERNAL_AGENT]: ['orders', 'delivery-status', 'products'],
      [UserRole.EXTERNAL_AGENT]: ['orders', 'delivery-status'],
      [UserRole.INTERNAL_SUPPLIER]: ['products', 'quotes'],
      [UserRole.EXTERNAL_SUPPLIER]: ['quotes']
    };

    return rolePermissions[user.role] || [];
  }
}
