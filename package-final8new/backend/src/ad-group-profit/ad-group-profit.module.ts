/**
 * File: ad-group-profit/ad-group-profit.module.ts
 * Mục đích: Module cho chức năng báo cáo lợi nhuận nhóm quảng cáo
 */
import { Module } from '@nestjs/common';
import { AdGroupProfitController } from './ad-group-profit.controller';
import { AdGroupProfitService } from './ad-group-profit.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { Summary5, Summary5Schema } from '../summary5/schemas/summary5.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Summary5.name, schema: Summary5Schema },
    ])
  ],
  controllers: [AdGroupProfitController],
  providers: [AdGroupProfitService],
  exports: [AdGroupProfitService],
})
export class AdGroupProfitModule {}
