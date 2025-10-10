/**
 * File: ad-group/ad-group.module.ts
 * Mục đích: Module Nhóm Quảng Cáo.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdGroupController } from './ad-group.controller';
import { AdGroupService } from './ad-group.service';
import { AdGroup, AdGroupSchema } from './schemas/ad-group.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Product.name, schema: ProductSchema }
    ])
  ],
  controllers: [AdGroupController],
  providers: [AdGroupService],
})
export class AdGroupModule {}
