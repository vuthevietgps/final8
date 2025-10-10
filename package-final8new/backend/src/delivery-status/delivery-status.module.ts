/**
 * File: delivery-status.module.ts
 * Mục đích: Module quản lý trạng thái giao hàng (controller/service/schema).
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeliveryStatusController } from './delivery-status.controller';
import { DeliveryStatusService } from './delivery-status.service';
import { DeliveryStatus, DeliveryStatusSchema } from './schemas/delivery-status.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryStatus.name, schema: DeliveryStatusSchema }
    ])
  ],
  controllers: [DeliveryStatusController],
  providers: [DeliveryStatusService],
  exports: [DeliveryStatusService],
})
export class DeliveryStatusModule {}
