/**
 * File: advanced-analytics.module.ts
 * Mục đích: Module integration for advanced optimization algorithms
 */
import { Module } from '@nestjs/common';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { MLOptimizationService } from './ml-optimization.service';
// TODO: Rebuild from OrderTest2
// import { AdGroupProfitModule } from '../../ad-group-profit/ad-group-profit.module';

@Module({
  imports: [
    // AdGroupProfitModule // Temporarily disabled - will rebuild from OrderTest2
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