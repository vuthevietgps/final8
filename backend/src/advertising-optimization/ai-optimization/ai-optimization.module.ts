/**
 * File: ai-optimization/ai-optimization.module.ts
 * Mục đích: Module cho AI Optimization System
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIOptimizationService } from './ai-optimization.service';
import { AdvertisingCostSuggestion, AdvertisingCostSuggestionSchema } from '../../advertising-cost-suggestion/schemas/advertising-cost-suggestion.schema';
import { OpenAIConfigModule } from '../../openai-config/openai-config.module';

import { AdGroupProfitModule } from '../../ad-group-profit/ad-group-profit.module';
import { QualityControlModule } from '../quality-control/quality-control.module';
import { AdvancedAnalyticsModule } from '../advanced-analytics/advanced-analytics.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdvertisingCostSuggestion.name, schema: AdvertisingCostSuggestionSchema }
    ]),
    OpenAIConfigModule,
    AdGroupProfitModule,
    QualityControlModule,
    AdvancedAnalyticsModule
  ],
  providers: [AIOptimizationService],
  exports: [AIOptimizationService]
})
export class AIOptimizationModule {}