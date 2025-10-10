/**
 * File: production-status.module.ts
 * Mục đích: Module quản lý trạng thái sản xuất (controller/service/schema).
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductionStatusController } from './production-status.controller';
import { ProductionStatusService } from './production-status.service';
import { ProductionStatus, ProductionStatusSchema } from './schemas/production-status.schema';

/**
 * Module quản lý trạng thái sản xuất
 * Tổ chức và cấu hình tất cả các component liên quan đến trạng thái sản xuất
 */
@Module({
  imports: [
    // Đăng ký schema ProductionStatus với MongoDB
    MongooseModule.forFeature([
      { name: ProductionStatus.name, schema: ProductionStatusSchema },
    ]),
  ],
  controllers: [ProductionStatusController],
  providers: [ProductionStatusService],
  // Export service để các module khác có thể sử dụng
  exports: [ProductionStatusService],
})
export class ProductionStatusModule {}
