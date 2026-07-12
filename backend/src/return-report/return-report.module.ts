import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReturnReportService } from './return-report.service';
import { ReturnReportController } from './return-report.controller';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { DeliveryStatusModule } from '../delivery-status/delivery-status.module';

@Module({
  imports: [
    DeliveryStatusModule,
    MongooseModule.forFeature([
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: Product.name, schema: ProductSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
    ]),
  ],
  providers: [ReturnReportService],
  controllers: [ReturnReportController],
})
export class ReturnReportModule {}
