import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/auth.decorator';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
    return user;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions) {
      return true; // Nếu không yêu cầu permission cụ thể thì cho phép
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Normalize role to lowercase to handle case mismatches
    const userRole = (user.role || '').toLowerCase();
    const rolePermissions: Record<string, string[]> = {
      director: [
        'users', 'orders', 'orders-test2', 'pending-orders', 'products', 'product-categories',
        'delivery-status', 'production-status', 'order-status',
        'ad-accounts', 'ad-groups', 'advertising-costs', 'media', 'api-tokens',
        'labor-costs', 'other-costs', 'salary-config',
        'customers', 'purchase-costs', 'fanpages', 'openai-configs',
        'quotes', 'reports', 'export', 'import', 'settings',
        'ads-budget', 'employee-ads-kpi', 'owner-fund', 'finance',
        'order-update', 'chat-messages',
      ],
      manager: [
        'ad-accounts', 'ad-groups', 'advertising-costs', 'media', 'fanpages', 'openai-configs', 'api-tokens',
        'ads-budget', 'employee-ads-kpi', 'chat-messages',
      ],
      employee: [
        'orders-test2', 'order-update', 'chat-messages',
      ],
      internal_agent: ['orders-test2'],
      external_agent: ['orders-test2'],
      internal_supplier: ['orders-test2'],
      external_supplier: ['orders-test2'],
    };

    const userPermissions = rolePermissions[userRole] || [];
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }
}
