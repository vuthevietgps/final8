/**
 * File: order-status.module.ts
 * Mục đích: Module quản lý trạng thái đơn hàng (controller/service/schema).
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderStatusController } from './order-status.controller';
import { OrderStatusService } from './order-status.service';
import { OrderStatus, OrderStatusSchema } from './schemas/order-status.schema';

/**
 * Module quản lý trạng thái đơn hàng
 * Tổ chức và cấu hình tất cả các component liên quan đến trạng thái đơn hàng
 */
@Module({
  imports: [
    // Đăng ký schema OrderStatus với MongoDB
    MongooseModule.forFeature([
      { name: OrderStatus.name, schema: OrderStatusSchema },
    ]),
  ],
  controllers: [OrderStatusController],
  providers: [OrderStatusService],
  // Export service để các module khác có thể sử dụng
  exports: [OrderStatusService],
})
export class OrderStatusModule {}
