/**
 * File: advertising-cost-public/advertising-cost-public.module.ts
 * Mục đích: Module cho public endpoints của advertising cost
 */
import { Module } from '@nestjs/common';
import { AdvertisingCostPublicController } from './advertising-cost-public.controller';
import { AdvertisingCostModule } from '../advertising-cost/advertising-cost.module';

@Module({
  imports: [AdvertisingCostModule],
  controllers: [AdvertisingCostPublicController]
})
export class AdvertisingCostPublicModule {}