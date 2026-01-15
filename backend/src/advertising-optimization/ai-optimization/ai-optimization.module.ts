/**
 * File: ai-optimization/ai-optimization.module.ts
 * Mục đích: Module cho AI Optimization System
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIOptimizationService } from './ai-optimization.service';
import { BudgetApplyService } from './budget-apply.service';
import { AdvertisingCostSuggestion, AdvertisingCostSuggestionSchema } from '../../advertising-cost-suggestion/schemas/advertising-cost-suggestion.schema';
import { OpenAIConfigModule } from '../../openai-config/openai-config.module';

import { AdGroupProfitModule } from '../../ad-group-profit/ad-group-profit.module';
import { QualityControlModule } from '../quality-control/quality-control.module';
import { AdvancedAnalyticsModule } from '../advanced-analytics/advanced-analytics.module';
import { AdGroup, AdGroupSchema } from '../../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountSchema } from '../../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenSchema } from '../../api-token/schemas/api-token.schema';
import { ApiTokenModule } from '../../api-token/api-token.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdvertisingCostSuggestion.name, schema: AdvertisingCostSuggestionSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: ApiToken.name, schema: ApiTokenSchema }
    ]),
    OpenAIConfigModule,
    AdGroupProfitModule,
    QualityControlModule,
    AdvancedAnalyticsModule,
    ApiTokenModule
  ],
  providers: [AIOptimizationService, BudgetApplyService],
  exports: [AIOptimizationService, BudgetApplyService]
})
export class AIOptimizationModule {}