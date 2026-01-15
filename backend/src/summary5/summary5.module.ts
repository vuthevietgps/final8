import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Summary5Controller } from './summary5.controller';
import { Summary5Service } from './summary5.service';
import { Summary5, Summary5Schema } from './schemas/summary5.schema';
import { Summary4, Summary4Schema } from '../summary4/schemas/summary4.schema';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Summary5.name, schema: Summary5Schema },
      { name: Summary4.name, schema: Summary4Schema },
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
    ]),
  ],
  controllers: [Summary5Controller],
  providers: [Summary5Service],
  exports: [Summary5Service], // Export để các module khác có thể dùng
})
export class Summary5Module {}
