import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdsAlertsModule } from '../ads-alerts/ads-alerts.module';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdGroupProfitReportModule } from '../ad-group-profit-report/ad-group-profit-report.module';
import { AdReportModule } from '../ad-report/ad-report.module';
import { AiMarketingModule } from '../ai-marketing/ai-marketing.module';
import { AgentStatement, AgentStatementSchema } from '../agent-receivable/schemas/agent-statement.schema';
import { ApiTokenModule } from '../api-token/api-token.module';
import { AdvertisingCostModule } from '../advertising-cost/advertising-cost.module';
import { Conversation, ConversationSchema } from '../chat-message/schemas/conversation.schema';
import { Customer, CustomerSchema } from '../customer/schemas/customer.schema';
import { EmployeeAdsKpiModule } from '../employee-ads-kpi/employee-ads-kpi.module';
import { Fanpage, FanpageSchema } from '../fanpage/schemas/fanpage.schema';
import { FinanceModule } from '../finance/finance.module';
import { Media, MediaSchema } from '../media/schemas/media.schema';
import { OpenAIConfigModule } from '../openai-config/openai-config.module';
import { OpsActionModule } from '../ops-action/ops-action.module';
import { PendingOrder, PendingOrderSchema } from '../pending-order/schemas/pending-order.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { SupplierPayable, SupplierPayableSchema } from '../supplier-payable/schemas/supplier-payable.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { AiOperatorController } from './ai-operator.controller';
import { AiOperatorService } from './ai-operator.service';
import { AiOperatorMessage, AiOperatorMessageSchema } from './schemas/ai-operator-message.schema';
import { AiOperatorSession, AiOperatorSessionSchema } from './schemas/ai-operator-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: SupplierPayable.name, schema: SupplierPayableSchema },
      { name: AgentStatement.name, schema: AgentStatementSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: PendingOrder.name, schema: PendingOrderSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Media.name, schema: MediaSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: Fanpage.name, schema: FanpageSchema },
      { name: AiOperatorSession.name, schema: AiOperatorSessionSchema },
      { name: AiOperatorMessage.name, schema: AiOperatorMessageSchema },
    ]),
    FinanceModule,
    AdGroupProfitReportModule,
    AiMarketingModule,
    EmployeeAdsKpiModule,
    ApiTokenModule,
    AdvertisingCostModule,
    AdReportModule,
    AdsAlertsModule,
    OpsActionModule,
    OpenAIConfigModule,
  ],
  controllers: [AiOperatorController],
  providers: [AiOperatorService],
  exports: [AiOperatorService],
})
export class AiOperatorModule {}
