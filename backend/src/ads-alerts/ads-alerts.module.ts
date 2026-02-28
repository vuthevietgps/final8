/**
 * File: ads-alerts/ads-alerts.module.ts
 * Mục đích: Module cho Ads Alerts real-time
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdsAlertsController } from './ads-alerts.controller';
import { AdsAlertsService } from './ads-alerts.service';
import { AdsAlertsEventsService } from './ads-alerts-events.service';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
    ]),
  ],
  controllers: [AdsAlertsController],
  providers: [AdsAlertsService, AdsAlertsEventsService],
  exports: [AdsAlertsService, AdsAlertsEventsService],
})
export class AdsAlertsModule {}
