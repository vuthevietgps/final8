/**
 * File: import-user.module.ts
 * Mục đích: Module nhập dữ liệu người dùng từ file (CSV/Excel) vào hệ thống.
 */
/**
 * Import User Module - Module chuyên nhập dữ liệu User từ file CSV
 * 
 * Chức năng:
 * - Định nghĩa Import User feature module
 * - Import User schema và UserModule
 * - Cung cấp service import CSV
 * - Kết nối các component: Service, Controller
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImportUserService } from './import-user.service';
import { ImportUserController } from './import-user.controller';
import { User, UserSchema } from '../user/user.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    // Đăng ký User schema để có thể query và insert data
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Import UserModule để sử dụng UserService
    UserModule,
  ],
  controllers: [ImportUserController], // Controller xử lý API import
  providers: [ImportUserService], // Service xử lý logic import CSV
  exports: [ImportUserService], // Export service để module khác có thể sử dụng
})
export class ImportUserModule {}
