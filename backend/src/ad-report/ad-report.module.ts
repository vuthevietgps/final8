import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdReportService } from './ad-report.service';
import { AdReportController } from './ad-report.controller';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
    ]),
  ],
  controllers: [AdReportController],
  providers: [AdReportService],
  exports: [AdReportService],
})
export class AdReportModule {}
