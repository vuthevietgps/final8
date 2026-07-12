import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdGroupProfitReportModule } from '../ad-group-profit-report/ad-group-profit-report.module';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';
import { AIOptimizationModule } from '../advertising-optimization/ai-optimization/ai-optimization.module';
import { ChatMessage, ChatMessageSchema } from '../chat-message/schemas/chat-message.schema';
import { PendingOrder, PendingOrderSchema } from '../pending-order/schemas/pending-order.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { AiMarketingController } from './ai-marketing.controller';
import { AiMarketingService } from './ai-marketing.service';
import { AdsActionEvaluation, AdsActionEvaluationSchema } from './schemas/ads-action-evaluation.schema';
import { AdsActionExecutionLog, AdsActionExecutionLogSchema } from './schemas/ads-action-execution-log.schema';
import { AdsActionPlan, AdsActionPlanSchema } from './schemas/ads-action-plan.schema';
import { CreativeAsset, CreativeAssetSchema } from './schemas/creative-asset.schema';
import { MarketingLead, MarketingLeadSchema } from './schemas/marketing-lead.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketingLead.name, schema: MarketingLeadSchema },
      { name: AdsActionPlan.name, schema: AdsActionPlanSchema },
      { name: AdsActionExecutionLog.name, schema: AdsActionExecutionLogSchema },
      { name: AdsActionEvaluation.name, schema: AdsActionEvaluationSchema },
      { name: CreativeAsset.name, schema: CreativeAssetSchema },
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: PendingOrder.name, schema: PendingOrderSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: AdGroup.name, schema: AdGroupSchema },
    ]),
    AdGroupProfitReportModule,
    AIOptimizationModule,
  ],
  controllers: [AiMarketingController],
  providers: [AiMarketingService],
  exports: [AiMarketingService],
})
export class AiMarketingModule {}
