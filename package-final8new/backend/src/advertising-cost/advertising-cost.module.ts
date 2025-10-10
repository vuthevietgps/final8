/**
 * File: advertising-cost/advertising-cost.module.ts
 * Mục đích: Module NestJS cho Chi Phí Quảng Cáo.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvertisingCost, AdvertisingCostSchema } from './schemas/advertising-cost.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { AdvertisingCostService } from './advertising-cost.service';
import { AdvertisingCostController } from './advertising-cost.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
    ]),
  ],
  controllers: [AdvertisingCostController],
  providers: [AdvertisingCostService],
  exports: [AdvertisingCostService] // Export service để dùng ở module khác
})
export class AdvertisingCostModule {}
