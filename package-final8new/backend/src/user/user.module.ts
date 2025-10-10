/**
 * File: user.module.ts
 * Mục đích: Gom các thành phần liên quan tới Người dùng (User) gồm controller, service, schema.
 */
/**
 * User Module - Module chứa tất cả User feature
 * 
 * Chức năng:
 * - Định nghĩa User feature module
 * - Import MongoDB schema
 * - Export UserService để các module khác sử dụng
 * - Kết nối các component: Schema, Service, Controller
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, UserSchema } from './user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // Đăng ký User schema với MongoDB thông qua Mongoose
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Import AuthModule để dùng guards (JwtAuthGuard, RolesGuard)
    AuthModule,
  ],
  controllers: [UserController], // Đăng ký controller xử lý API endpoints
  providers: [UserService], // Đăng ký service xử lý business logic
  exports: [UserService], // Export service để các module khác có thể inject
})
export class UserModule {}
