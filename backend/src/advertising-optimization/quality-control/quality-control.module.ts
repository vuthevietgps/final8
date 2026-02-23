/**
 * File: quality-control/quality-control.module.ts
 * Mục đích: Module cho Quality Control System
 */
import { Module } from '@nestjs/common';
import { QualityControlService } from './quality-control.service';
import { DeliveryStatusModule } from '../../delivery-status/delivery-status.module';
// TODO: Rebuild from OrderTest2
// import { AdGroupProfitModule } from '../../ad-group-profit/ad-group-profit.module';

@Module({
  imports: [
    DeliveryStatusModule,
    // AdGroupProfitModule // Temporarily disabled - will rebuild from OrderTest2
  ],
  providers: [QualityControlService],
  exports: [QualityControlService]
})
export class QualityControlModule {}