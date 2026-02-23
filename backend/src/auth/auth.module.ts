import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { User, UserSchema } from '../user/user.schema';
import { JwtAuthGuard, RolesGuard } from './guards/auth.guard';
import { SessionLogModule } from '../session-log/session-log.module';
import { SalaryConfig, SalaryConfigSchema } from '../salary-config/schemas/salary-config.schema';
import { LaborCost1, LaborCost1Schema } from '../labor-cost1/schemas/labor-cost1.schema';

@Module({
  imports: [
    PassportModule,
    // Sử dụng registerAsync để đảm bảo env được load trước
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        
        if (!secret && isProduction) {
          throw new Error('CRITICAL: JWT_SECRET must be set in production environment!');
        }
        
        return {
          secret: secret || 'dev-only-insecure-secret-do-not-use-in-production',
          signOptions: { expiresIn: '4h' },
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: SalaryConfig.name, schema: SalaryConfigSchema },
      { name: LaborCost1.name, schema: LaborCost1Schema },
    ]),
    SessionLogModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
