/**
 * File: delivery-status.module.ts
 * Mục đích: Module quản lý trạng thái giao hàng (controller/service/schema).
 */
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeliveryStatusController } from './delivery-status.controller';
import { DeliveryStatusService } from './delivery-status.service';
import { DeliveryStatus, DeliveryStatusSchema } from './schemas/delivery-status.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryStatus.name, schema: DeliveryStatusSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
    ])
  ],
  controllers: [DeliveryStatusController],
  providers: [DeliveryStatusService],
  exports: [DeliveryStatusService],
})
export class DeliveryStatusModule {}
