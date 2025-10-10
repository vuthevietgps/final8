import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../user/user.schema';
import { SessionLogService } from '../session-log/session-log.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private sessionLogService: SessionLogService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  // Detect if a string looks like a bcrypt hashed password
  private isBcryptHash(value: any): boolean {
    return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
  }

  // Chuẩn hóa IP từ request: xử lý IPv6 localhost và IPv4-mapped IPv6
  private normalizeClientIp(ip?: string): string {
    if (!ip) return '';
    let v = String(ip).trim();
    // Xóa prefix IPv6 mapped
    if (v.startsWith('::ffff:')) v = v.slice('::ffff:'.length);
    // Map IPv6 localhost về IPv4 để dễ cấu hình
    if (v === '::1') return '127.0.0.1';
    return v;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ email }).exec();
    if (user) {
      // Normal path: stored password is bcrypt hash
      if (this.isBcryptHash(user.password)) {
        if (await bcrypt.compare(password, user.password)) {
          const { password: _pw, ...result } = user.toObject();
          return result;
        }
      } else {
        // Migration path: stored password is plaintext
        if (password === user.password) {
          // Hash and persist immediately for security hardening
          user.password = await bcrypt.hash(password, 12);
          await user.save();
          const { password: _pw, ...result } = user.toObject();
          return result;
        }
      }
    }
    return null;
  }

  async login(loginDto: LoginDto, clientIp?: string, forwardedIps?: string[]) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (user && user.isActive === false) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    // Giới hạn IP đăng nhập cho Manager/Employee
    const restrictedRoles = ['manager', 'employee'];
    if (restrictedRoles.includes(user.role)) {
      const allowed = Array.isArray(user.allowedLoginIps) ? user.allowedLoginIps : [];
      if (!allowed.length) {
        this.logger.warn(`IP restriction: user ${user.email} (${user.role}) has no allowedLoginIps configured`);
        throw new UnauthorizedException('Tài khoản này yêu cầu cấu hình IP đăng nhập');
      }
      
      // Chuẩn hóa danh sách IP allowed để so khớp
      const allowedNormalized = allowed.map((x) => this.normalizeClientIp(String(x))).map((x) => x.trim());
      
      // Kiểm tra tất cả IP có thể (clientIp và tất cả IP trong x-forwarded-for)
      const allPossibleIps = [clientIp];
      if (forwardedIps && forwardedIps.length > 0) {
        allPossibleIps.push(...forwardedIps);
      }
      
      // Chuẩn hóa tất cả IP và kiểm tra xem có IP nào được phép không
      const normalizedIps = allPossibleIps.map(ip => this.normalizeClientIp(ip)).filter(ip => ip);
      const isAllowed = normalizedIps.some(ip => allowedNormalized.includes(ip));
      
      if (!isAllowed) {
        this.logger.warn(
          `IP restriction: denied login for ${user.email} from IPs [${normalizedIps.join(', ')}]; allowed: [${allowedNormalized.join(', ')}]`,
        );
        throw new UnauthorizedException('IP không được phép đăng nhập');
      }
      
      // Tìm IP được phép đầu tiên để log
      const allowedIp = normalizedIps.find(ip => allowedNormalized.includes(ip));
      this.logger.log(`IP restriction: allowed login for ${user.email} from IP ${allowedIp}`);
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

  // Ghi log đăng nhập
  await this.sessionLogService.logLogin(String(user._id), clientIp);

  return tokenPayload;
  }

  async register(registerDto: RegisterDto) {
    // Kiểm tra email đã tồn tại
    const existingUser = await this.userModel.findOne({ email: registerDto.email }).exec();
    if (existingUser) {
      throw new UnauthorizedException('Email đã được sử dụng');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Tạo user mới
    const newUser = new this.userModel({
      ...registerDto,
      password: hashedPassword,
      isActive: true,
    });

    const savedUser = await newUser.save();
    const { password, ...result } = savedUser.toObject();

    return result;
  }

  async findUserById(id: string) {
    return this.userModel.findById(id).select('-password').exec();
  }

  // Kiểm tra quyền truy cập theo role
  hasPermission(userRole: string, requiredPermissions: string[]): boolean {
    const rolePermissions = {
      'director': [
  'users', 'orders', 'products', 'product-categories',
        'delivery-status', 'production-status', 'order-status',
  'ad-accounts', 'ad-groups', 'advertising-costs',
  'labor-costs', 'other-costs', 'salary-config',
  // Newly explicit permissions
  'customers', 'purchase-costs',
  'quotes', 'reports', 'export', 'import', 'settings'
      ],
      'manager': [
        'orders', // Đơn hàng
        'ad-accounts', 'ad-groups', 'advertising-costs' // Quảng cáo
      ],
      'employee': [
        'orders'
      ],
      'internal_agent': ['orders', 'delivery-status', 'products'],
      'external_agent': ['orders', 'delivery-status'],
      'internal_supplier': ['products', 'quotes'],
      'external_supplier': ['quotes'],
    };

    const userPermissions = rolePermissions[userRole] || [];
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }
}
