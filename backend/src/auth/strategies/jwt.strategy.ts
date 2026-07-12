import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
        ExtractJwt.fromUrlQueryParameter('access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: effectiveSecret,
    });
    this.logger.log(`JWT Strategy initialized (secret ${secret ? 'configured' : 'using dev fallback'})`);
  }

  async validate(payload: any) {
    const user = await this.authService.findUserById(payload.sub);
    if (!user) {
      this.logger.warn(`JWT user lookup failed for subject ${payload?.sub ?? 'unknown'}`);
      throw new UnauthorizedException('Token khong hop le');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tai khoan da bi vo hieu hoa');
    }

    const currentTokenVersion = Number((user as any).tokenVersion || 0);
    const payloadTokenVersion = Number(payload?.tokenVersion || 0);
    if (payloadTokenVersion !== currentTokenVersion) {
      throw new UnauthorizedException('Token khong hop le');
    }

    return {
      id: user._id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };
  }
}
