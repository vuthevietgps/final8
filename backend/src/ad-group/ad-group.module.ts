/**
 * File: ad-group/ad-group.module.ts
 * Mục đích: Module Nhóm Quảng Cáo.
 */
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdGroupController } from './ad-group.controller';
import { AdGroupService } from './ad-group.service';
import { AdGroup, AdGroupSchema } from './schemas/ad-group.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { AdvertisingCostModule } from '../advertising-cost/advertising-cost.module';
import { ApiTokenModule } from '../api-token/api-token.module';
import { AdGroupAutoControlService } from './ad-group.auto-control.service';
import { AdGroupSyncService } from './ad-group.sync.service';
import { AdGroupRecommendationService } from './ad-group.recommendation.service';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Product.name, schema: ProductSchema },
      { name: AdAccount.name, schema: AdAccountSchema }
    ]),
    forwardRef(() => AdvertisingCostModule),
    ApiTokenModule
  ],
  controllers: [AdGroupController],
  providers: [AdGroupService, AdGroupAutoControlService, AdGroupSyncService, AdGroupRecommendationService],
})
export class AdGroupModule {}
