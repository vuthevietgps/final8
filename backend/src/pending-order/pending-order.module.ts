import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PendingOrder, PendingOrderSchema } from './schemas/pending-order.schema';
import { PendingOrderService } from './pending-order.service';
import { PendingOrderController } from './pending-order.controller';
import { TestOrder2Module } from '../test-order2/test-order2.module';

@Module({
  imports:[MongooseModule.forFeature([{ name: PendingOrder.name, schema: PendingOrderSchema }]), TestOrder2Module],
  controllers:[PendingOrderController],
  providers:[PendingOrderService],
  exports:[PendingOrderService]
})
export class PendingOrderModule {}
