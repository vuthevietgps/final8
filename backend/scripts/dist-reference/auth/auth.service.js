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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const bcrypt = require("bcryptjs");
const user_schema_1 = require("../user/user.schema");
const session_log_service_1 = require("../session-log/session-log.service");
let AuthService = AuthService_1 = class AuthService {
    constructor(userModel, jwtService, sessionLogService) {
        this.userModel = userModel;
        this.jwtService = jwtService;
        this.sessionLogService = sessionLogService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    isBcryptHash(value) {
        return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
    }
    normalizeClientIp(ip) {
        if (!ip)
            return '';
        let v = String(ip).trim();
        if (v.startsWith('::ffff:'))
            v = v.slice('::ffff:'.length);
        if (v === '::1')
            return '127.0.0.1';
        return v;
    }
    async validateUser(email, password) {
        const user = await this.userModel.findOne({ email }).exec();
        if (user) {
            if (this.isBcryptHash(user.password)) {
                if (await bcrypt.compare(password, user.password)) {
                    const _a = user.toObject(), { password: _pw } = _a, result = __rest(_a, ["password"]);
                    return result;
                }
            }
            else {
                if (password === user.password) {
                    user.password = await bcrypt.hash(password, 12);
                    await user.save();
                    const _b = user.toObject(), { password: _pw } = _b, result = __rest(_b, ["password"]);
                    return result;
                }
            }
        }
        return null;
    }
    async login(loginDto, clientIp, forwardedIps) {
        const user = await this.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không đúng');
        }
        if (user && user.isActive === false) {
            throw new common_1.UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
        }
        const ipRestrictionEnabled = String(process.env.AUTH_ENABLE_IP_RESTRICTION || '').toLowerCase() === 'true';
        if (ipRestrictionEnabled) {
            const restrictedRoles = ['manager', 'employee'];
            if (restrictedRoles.includes(user.role)) {
                const allowed = Array.isArray(user.allowedLoginIps) ? user.allowedLoginIps : [];
                if (!allowed.length) {
                    this.logger.warn(`IP restriction: user ${user.email} (${user.role}) has no allowedLoginIps configured`);
                    throw new common_1.UnauthorizedException('Tài khoản này yêu cầu cấu hình IP đăng nhập');
                }
                const allowedNormalized = allowed.map((x) => this.normalizeClientIp(String(x))).map((x) => x.trim());
                const allPossibleIps = [clientIp];
                if (forwardedIps && forwardedIps.length > 0) {
                    allPossibleIps.push(...forwardedIps);
                }
                const normalizedIps = allPossibleIps.map(ip => this.normalizeClientIp(ip)).filter(ip => ip);
                const isAllowed = normalizedIps.some(ip => allowedNormalized.includes(ip));
                if (!isAllowed) {
                    this.logger.warn(`IP restriction: denied login for ${user.email} from IPs [${normalizedIps.join(', ')}]; allowed: [${allowedNormalized.join(', ')}]`);
                    throw new common_1.UnauthorizedException('IP không được phép đăng nhập');
                }
                const allowedIp = normalizedIps.find(ip => allowedNormalized.includes(ip));
                this.logger.log(`IP restriction: allowed login for ${user.email} from IP ${allowedIp}`);
            }
        }
        const payload = {
            email: user.email,
            sub: user._id,
            role: user.role,
            name: user.fullName
        };
        const tokenPayload = {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                phone: user.phone,
                address: user.address,
                isActive: user.isActive,
            },
        };
        await this.sessionLogService.logLogin(String(user._id), clientIp);
        return tokenPayload;
    }
    async register(registerDto) {
        const existingUser = await this.userModel.findOne({ email: registerDto.email }).exec();
        if (existingUser) {
            throw new common_1.UnauthorizedException('Email đã được sử dụng');
        }
        const hashedPassword = await bcrypt.hash(registerDto.password, 12);
        const newUser = new this.userModel(Object.assign(Object.assign({}, registerDto), { password: hashedPassword, isActive: true }));
        const savedUser = await newUser.save();
        const _a = savedUser.toObject(), { password } = _a, result = __rest(_a, ["password"]);
        return result;
    }
    async findUserById(id) {
        return this.userModel.findById(id).select('-password').exec();
    }
    hasPermission(userRole, requiredPermissions) {
        const rolePermissions = {
            'director': [
                'users', 'orders', 'products', 'product-categories',
                'delivery-status', 'production-status', 'order-status',
                'ad-accounts', 'ad-groups', 'advertising-costs', 'media',
                'labor-costs', 'other-costs', 'salary-config',
                'customers', 'purchase-costs',
                'quotes', 'reports', 'export', 'import', 'settings'
            ],
            'manager': [
                'orders',
                'pending-orders',
                'ad-accounts', 'ad-groups', 'advertising-costs', 'media',
                'fanpages', 'openai-configs', 'api-tokens', 'chat-messages'
            ],
            'employee': [
                'orders', 'api-tokens'
            ],
            'internal_agent': ['orders', 'pending-orders', 'delivery-status', 'products', 'api-tokens'],
            'external_agent': ['orders', 'pending-orders', 'delivery-status', 'api-tokens'],
            'internal_supplier': ['products', 'quotes', 'api-tokens'],
            'external_supplier': ['quotes', 'api-tokens'],
        };
        const userPermissions = rolePermissions[userRole] || [];
        return requiredPermissions.every(permission => userPermissions.includes(permission));
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        jwt_1.JwtService,
        session_log_service_1.SessionLogService])
], AuthService);
//# sourceMappingURL=auth.service.js.map