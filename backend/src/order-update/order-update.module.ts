/**
 * File: order-update/order-update.module.ts
 * Mục đích: Module quản lý chức năng cập nhật thông tin đơn hàng từ Excel
 */
import { Module } from '@nestjs/common';
import { OrderUpdateController } from './order-update.controller';
import { OrderUpdateService } from './order-update.service';
import { TestOrder2Module } from '../test-order2/test-order2.module';

@Module({
  imports: [
    TestOrder2Module,
  ],
  controllers: [OrderUpdateController],
  providers: [OrderUpdateService],
  exports: [OrderUpdateService],
})
export class OrderUpdateModule {}