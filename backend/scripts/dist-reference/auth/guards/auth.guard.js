"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesGuard = exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const public_decorator_1 = require("../decorators/public.decorator");
const passport_1 = require("@nestjs/passport");
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    constructor(reflector) {
        super();
        this.reflector = reflector;
    }
    canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        return super.canActivate(context);
    }
    handleRequest(err, user) {
        if (err || !user) {
            throw err || new common_1.UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
        }
        return user;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], JwtAuthGuard);
let RolesGuard = class RolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const requiredPermissions = this.reflector.get('permissions', context.getHandler());
        if (!requiredPermissions) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            return false;
        }
        const userRole = (user.role || '').toLowerCase();
        const rolePermissions = {
            'director': [
                'users', 'orders', 'pending-orders', 'products', 'product-categories',
                'delivery-status', 'production-status', 'order-status',
                'ad-accounts', 'ad-groups', 'advertising-costs', 'media', 'api-tokens',
                'labor-costs', 'other-costs', 'salary-config',
                'customers', 'purchase-costs', 'fanpages', 'openai-configs',
                'quotes', 'reports', 'export', 'import', 'settings'
            ],
            'manager': [
                'orders', 'pending-orders',
                'ad-accounts', 'ad-groups', 'advertising-costs', 'media', 'fanpages', 'openai-configs', 'api-tokens'
            ],
            'employee': [
                'orders', 'pending-orders', 'api-tokens'
            ],
            'internal_agent': ['orders', 'pending-orders', 'delivery-status', 'products', 'api-tokens'],
            'external_agent': ['orders', 'pending-orders', 'delivery-status', 'api-tokens'],
            'internal_supplier': ['products', 'quotes', 'api-tokens'],
            'external_supplier': ['quotes', 'api-tokens']
        };
        if (rolePermissions['director'] && !rolePermissions['director'].includes('chat-messages'))
            rolePermissions['director'].push('chat-messages');
        if (rolePermissions['manager'] && !rolePermissions['manager'].includes('chat-messages'))
            rolePermissions['manager'].push('chat-messages');
        const userPermissions = rolePermissions[userRole] || [];
        return requiredPermissions.every(permission => userPermissions.includes(permission));
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
//# sourceMappingURL=auth.guard.js.map