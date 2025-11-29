/**
 * File: advanced-analytics.module.ts
 * Mục đích: Module integration for advanced optimization algorithms
 */
import { Module } from '@nestjs/common';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { MLOptimizationService } from './ml-optimization.service';
import { AdGroupProfitModule } from '../../ad-group-profit/ad-group-profit.module';

@Module({
  imports: [
    AdGroupProfitModule
  ],
  providers: [
    AdvancedAnalyticsService,
    MLOptimizationService
  ],
  exports: [
    AdvancedAnalyticsService,
    MLOptimizationService
  ]
})
export class AdvancedAnalyticsModule {}