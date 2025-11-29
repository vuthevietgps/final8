/**
 * File: quality-control/quality-control.module.ts
 * Mục đích: Module cho Quality Control System
 */
import { Module } from '@nestjs/common';
import { QualityControlService } from './quality-control.service';
import { DeliveryStatusModule } from '../../delivery-status/delivery-status.module';
import { AdGroupProfitModule } from '../../ad-group-profit/ad-group-profit.module';

@Module({
  imports: [
    DeliveryStatusModule,
    AdGroupProfitModule
  ],
  providers: [QualityControlService],
  exports: [QualityControlService]
})
export class QualityControlModule {}