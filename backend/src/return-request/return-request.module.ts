import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryModule } from '../inventory/inventory.module';
import { TestOrder2Module } from '../test-order2/test-order2.module';
import { ReturnRequestController } from './return-request.controller';
import { ReturnRequestService } from './return-request.service';
import { ReturnRequest, ReturnRequestSchema } from './return-request.schema';

@Module({
  imports: [
    InventoryModule,
    TestOrder2Module,
    MongooseModule.forFeature([
      { name: ReturnRequest.name, schema: ReturnRequestSchema },
    ]),
  ],
  controllers: [ReturnRequestController],
  providers: [ReturnRequestService],
  exports: [ReturnRequestService],
})
export class ReturnRequestModule {}
