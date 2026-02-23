/**
 * File: advertising-optimization/advertising-optimization.module.ts
 * Mục đích: Main module cho Advertising Optimization System
 * Tích hợp: Quality Control, AI Optimization, Advanced Analytics
 */
import { Module } from '@nestjs/common';
import { QualityControlModule } from './quality-control/quality-control.module';
import { AIOptimizationModule } from './ai-optimization/ai-optimization.module';
import { AdvancedAnalyticsModule } from './advanced-analytics/advanced-analytics.module';

@Module({
  imports: [
    QualityControlModule,
    AIOptimizationModule,
    AdvancedAnalyticsModule
  ],
  exports: [
    QualityControlModule,
    AIOptimizationModule,
    AdvancedAnalyticsModule
  ]
})
export class AdvertisingOptimizationModule {}