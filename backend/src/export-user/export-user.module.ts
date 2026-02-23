/**
 * File: export-user.module.ts
 * Mục đích: Module xuất dữ liệu người dùng ra CSV/Excel.
 */
/**
 * Export User Module - Module chuyên xuất dữ liệu User ra file CSV
 * 
 * Chức năng:
 * - Định nghĩa Export User feature module
 * - Import User schema và UserModule
 * - Cung cấp service xuất CSV
 * - Kết nối các component: Service, Controller
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExportUserService } from './export-user.service';
import { ExportUserController } from './export-user.controller';
import { User, UserSchema } from '../user/user.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    // Đăng ký User schema để có thể query data
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Import UserModule để sử dụng UserService
    UserModule,
  ],
  controllers: [ExportUserController], // Controller xử lý API export
  providers: [ExportUserService], // Service xử lý logic export CSV
  exports: [ExportUserService], // Export service để module khác có thể sử dụng
})
export class ExportUserModule {}
