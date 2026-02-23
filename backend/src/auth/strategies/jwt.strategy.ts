import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  
  constructor(
    private authService: AuthService,
    configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    
    if (!secret && isProduction) {
      throw new Error('CRITICAL: JWT_SECRET must be set in production environment!');
    }
    
    const effectiveSecret = secret || 'dev-only-insecure-secret-do-not-use-in-production';
    
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('access_token'), // for SSE/EventSource
      ]),
      ignoreExpiration: false,
      secretOrKey: effectiveSecret,
    });
    // Note: Never log secrets, even partially
    this.logger.log(`JWT Strategy initialized (secret ${secret ? 'configured' : 'using dev fallback'})`);
  }

  async validate(payload: any) {
    this.logger.log(`Validating JWT payload: ${JSON.stringify(payload)}`);
    const user = await this.authService.findUserById(payload.sub);
    this.logger.log(`User found: ${user ? user.email : 'NOT FOUND'}`);
    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    
    // Kiểm tra user có active không
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    return {
      id: user._id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };
  }
}
