import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../user/user.schema';
import { SessionLogService } from '../session-log/session-log.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SalaryConfig, SalaryConfigDocument } from '../salary-config/schemas/salary-config.schema';
import { LaborCost1, LaborCost1Document } from '../labor-cost1/schemas/labor-cost1.schema';
import { enforceActiveUserLimit } from '../plan/user-limit.util';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SalaryConfig.name) private salaryModel: Model<SalaryConfigDocument>,
    @InjectModel(LaborCost1.name) private laborCostModel: Model<LaborCost1Document>,
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

    // Tùy chọn: Bật kiểm tra IP qua biến môi trường AUTH_ENABLE_IP_RESTRICTION
    // Mặc định: TẮT (không hạn chế IP cho bất kỳ vai trò nào)
    const ipRestrictionEnabled =
      String(process.env.AUTH_ENABLE_IP_RESTRICTION || '').trim().toLowerCase() === 'true';
    // Giữ logic cũ nhưng chỉ chạy khi được bật rõ ràng qua ENV
    if (ipRestrictionEnabled) {
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
    }
    
    const payload = { 
      email: user.email, 
      sub: user._id, 
      role: user.role,
      name: user.fullName,
      tokenVersion: Number(user.tokenVersion || 0),
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
  await this.sessionLogService.logLogin(String(user._id), clientIp, {
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });

  return tokenPayload;
  }

  async register(registerDto: RegisterDto) {
    // Kiểm tra email đã tồn tại
    const existingUser = await this.userModel.findOne({ email: registerDto.email }).exec();
    if (existingUser) {
      throw new UnauthorizedException('Email da duoc su dung');
    }
    
    // Register tao user active mac dinh -> phai check quota theo goi
    await enforceActiveUserLimit(() => this.userModel.countDocuments({ isActive: true }).exec());

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Tạo user mới
    const newUser = new this.userModel({
      ...registerDto,
      password: hashedPassword,
      isActive: true,
      tokenVersion: 0,
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
        'users', 'orders', 'orders-test2', 'products', 'product-categories',
        'delivery-status', 'production-status', 'order-status',
        'ad-accounts', 'ad-groups', 'advertising-costs', 'media',
        'labor-costs', 'other-costs', 'salary-config',
        // Newly explicit permissions
        'customers', 'purchase-costs', 'fanpages', 'openai-configs', 'api-tokens',
        'supplier-quotes.approve', 'orders.confirm-business',
        'quotes', 'reports', 'export', 'import', 'settings',
        'ads-budget', 'employee-ads-kpi', 'owner-fund', 'finance', 'finance.budget-buckets.manage',
        'finance.policy.manage', 'finance.loan.manage', 'finance.cashflow.manage',
        'order-update', 'chat-messages', 'ai-assistant',
        'google-ads.read', 'google-ads.plan', 'google-ads.approve', 'google-ads.execute',
        'google-ads.credentials.read', 'google-ads.credentials.write', 'google-ads.emergency-pause'
      ],
      'manager': [
        'orders-test2', 'pending-orders', 'orders.confirm-business',
        'ad-accounts', 'ad-groups', 'advertising-costs', 'media', // Ads + media
        'fanpages', 'openai-configs', 'chat-messages', 'ai-assistant',
        'ads-budget', 'employee-ads-kpi', 'reports',
        'google-ads.read', 'google-ads.plan'
      ],
      'employee': [
        'orders-test2', 'order-update', 'chat-messages'
      ],
      'internal_agent': ['orders-test2'],
      'external_agent': ['orders-test2'],
      'internal_supplier': ['orders-test2'],
      'external_supplier': ['orders-test2'],
      // Nhà đầu tư: chỉ xem báo cáo/finance (cấu hình chi tiết sau)
      'investor': ['finance', 'reports'],
      // Người cho vay: xem finance, hợp đồng vay
      'lender': ['finance'],
    };

    const userPermissions = rolePermissions[userRole] || [];
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * Logout - Ghi nhận thời gian đăng xuất và tự động tạo LaborCost
   * 
   * Logic:
   * 1. Tìm session đang mở (chưa có logoutAt)
   * 2. Cập nhật logoutAt = now
   * 3. Tính workMinutes = logoutAt - loginAt
   * 4. Lấy hourlyRate từ SalaryConfig
   * 5. Tạo LaborCost1 record với cost = (workMinutes / 60) * hourlyRate
   */
  async logout(userId: string) {
    // 1. Cập nhật logoutAt trong session log
    await this.userModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }).exec();
    const session = await this.sessionLogService.logLogout(userId);
    
    if (!session) {
      this.logger.warn(`Logout: No open session found for user ${userId}`);
      return { 
        success: true, 
        message: 'Đăng xuất thành công (không có phiên đang mở)',
        laborCostCreated: false 
      };
    }

    const loginAt = session.loginAt;
    const logoutAt = session.logoutAt || new Date();

    // 2. Tính thời gian làm việc (phút)
    const workMinutes = Math.round((logoutAt.getTime() - loginAt.getTime()) / (1000 * 60));
    const workHours = Number((workMinutes / 60).toFixed(4)); // Chính xác đến phút

    // 3. Lấy hourlyRate từ SalaryConfig
    const salary = await this.salaryModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    const hourlyRate = salary?.hourlyRate ?? 0;

    // 4. Tính cost (chính xác theo phút)
    const cost = Number((workHours * hourlyRate).toFixed(2));

    // 5. Format thời gian
    const formatTime = (d: Date) => {
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    const startTime = formatTime(loginAt);
    const endTime = formatTime(logoutAt);
    const date = new Date(loginAt);
    date.setHours(0, 0, 0, 0);

    // 6. Tạo LaborCost1 record
    try {
      const laborCost = await this.laborCostModel.create({
        date,
        userId: new Types.ObjectId(userId),
        startTime,
        endTime,
        workHours,
        hourlyRate,
        cost,
        notes: `Tự động từ logout - Phiên ${session._id}`,
        sessionCount: 1,
      });

      this.logger.log(
        `Logout: User ${userId} worked ${workMinutes} minutes (${workHours.toFixed(2)}h) × ${hourlyRate} VND/h = ${cost.toLocaleString()} VND`
      );

      return {
        success: true,
        message: 'Đăng xuất thành công',
        laborCostCreated: true,
        session: {
          id: session._id,
          loginAt,
          logoutAt,
          workMinutes,
          workHours: Number(workHours.toFixed(2)),
        },
        laborCost: {
          id: laborCost._id,
          date,
          startTime,
          endTime,
          workHours: Number(workHours.toFixed(2)),
          hourlyRate,
          cost,
        },
      };
    } catch (error) {
      this.logger.error(`Logout: Failed to create labor cost for user ${userId}`, error);
      return {
        success: true,
        message: 'Đăng xuất thành công nhưng không tạo được chi phí nhân công',
        laborCostCreated: false,
        error: error.message,
      };
    }
  }
}
