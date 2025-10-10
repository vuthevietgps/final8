import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfitForecastService } from './profit-forecast.service';
import { ProfitForecastController } from './profit-forecast.controller';
import { ProfitForecastSnapshot, ProfitForecastSnapshotSchema } from './schemas/profit-forecast-snapshot.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestOrder2.name, schema: TestOrder2Schema },
  { name: Product.name, schema: ProductSchema },
  { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
  { name: ProfitForecastSnapshot.name, schema: ProfitForecastSnapshotSchema },
    ])
  ],
  controllers: [ProfitForecastController],
  providers: [ProfitForecastService],
  exports: [ProfitForecastService]
})
export class ProfitForecastModule {}
