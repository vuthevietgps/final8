import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Summary5Controller } from './summary5.controller';
import { Summary5Service } from './summary5.service';
import { Summary5, Summary5Schema } from './schemas/summary5.schema';
import { Summary4, Summary4Schema } from '../summary4/schemas/summary4.schema';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';
import { LaborCost1, LaborCost1Schema } from '../labor-cost1/schemas/labor-cost1.schema';
import { OtherCost, OtherCostSchema } from '../other-cost/schemas/other-cost.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { User, UserSchema } from '../user/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Summary5.name, schema: Summary5Schema },
      { name: Summary4.name, schema: Summary4Schema },
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
      { name: LaborCost1.name, schema: LaborCost1Schema },
      { name: OtherCost.name, schema: OtherCostSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [Summary5Controller],
  providers: [Summary5Service],
  exports: [Summary5Service],
})
export class Summary5Module {}
