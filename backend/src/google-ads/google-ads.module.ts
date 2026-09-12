import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import {
  AdsManagerAccount,
  AdsManagerAccountSchema,
} from '../ads-manager-account/schemas/ads-manager-account.schema';
import { ApiTokenModule } from '../api-token/api-token.module';
import { FinanceModule } from '../finance/finance.module';
import { FinancialControlService } from '../finance/financial-control.service';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsActionPlanImportService } from './google-ads-action-plan-import.service';
import { GoogleAdsExportService } from './google-ads-export.service';
import { GoogleAdsExecutionPolicyService } from './google-ads-execution-policy.service';
import { GoogleAdsFinancialExecutionLeaseService } from './google-ads-financial-execution-lease.service';
import { GOOGLE_ADS_FINANCIAL_CONTROL } from './google-ads-financial-control.port';
import { GoogleAdsExecutionService } from './google-ads-execution.service';
import { GoogleAdsEvaluationService } from './google-ads-evaluation.service';
import { GoogleAdsPostExecutionService } from './google-ads-post-execution.service';
import { GoogleAdsActionApprovalPolicyService } from './google-ads-action-approval-policy.service';
import { GoogleAdsActionPlanService } from './google-ads-action-plan.service';
import { GoogleAdsOperationBuilderService } from './google-ads-operation-builder.service';
import { GoogleAdsProviderValidationService } from './google-ads-provider-validation.service';
import { GoogleAdsReadonlySyncService } from './google-ads-readonly-sync.service';
import { GoogleAdsProfitEnrichmentService } from './google-ads-profit-enrichment.service';
import { GoogleAdsCapabilitiesService } from './google-ads-capabilities.service';
import { GoogleAdsErpActionPlanService } from './google-ads-erp-action-plan.service';
import { GoogleAdsLookupService } from './google-ads-lookup.service';
import { GoogleAdsConversionReadinessService } from './google-ads-conversion-readiness.service';
import { GoogleAdsBiddingLifecycleService } from './google-ads-bidding-lifecycle.service';
import {
  GoogleAdsBiddingLifecycle,
  GoogleAdsBiddingLifecycleSchema,
} from './schemas/google-ads-bidding-lifecycle.schema';
import { GoogleAdsAd, GoogleAdsAdSchema } from './schemas/google-ads-ad.schema';
import { GoogleAdsAdGroup, GoogleAdsAdGroupSchema } from './schemas/google-ads-ad-group.schema';
import { GoogleAdsCampaign, GoogleAdsCampaignSchema } from './schemas/google-ads-campaign.schema';
import {
  GoogleAdsCampaignBudget,
  GoogleAdsCampaignBudgetSchema,
} from './schemas/google-ads-campaign-budget.schema';
import {
  GoogleAdsCampaignCriterion,
  GoogleAdsCampaignCriterionSchema,
} from './schemas/google-ads-campaign-criterion.schema';
import {
  GoogleAdsCampaignConversionGoal,
  GoogleAdsCampaignConversionGoalSchema,
} from './schemas/google-ads-campaign-conversion-goal.schema';
import {
  GoogleAdsConversionAction,
  GoogleAdsConversionActionSchema,
} from './schemas/google-ads-conversion-action.schema';
import {
  GoogleAdsConversionGoalCampaignConfig,
  GoogleAdsConversionGoalCampaignConfigSchema,
} from './schemas/google-ads-conversion-goal-campaign-config.schema';
import { GoogleAdsDailyMetric, GoogleAdsDailyMetricSchema } from './schemas/google-ads-daily-metric.schema';
import { GoogleAdsKeyword, GoogleAdsKeywordSchema } from './schemas/google-ads-keyword.schema';
import { GoogleAdsSyncRun, GoogleAdsSyncRunSchema } from './schemas/google-ads-sync-run.schema';
import { GoogleAdsExport, GoogleAdsExportSchema } from './schemas/google-ads-export.schema';
import { GoogleAdsActionPlan, GoogleAdsActionPlanSchema } from './schemas/google-ads-action-plan.schema';
import {
  GoogleAdsActionExecutionLog,
  GoogleAdsActionExecutionLogSchema,
} from './schemas/google-ads-action-execution-log.schema';
import {
  GoogleAdsActionEvaluation,
  GoogleAdsActionEvaluationSchema,
} from './schemas/google-ads-action-evaluation.schema';
import { GoogleAdsChangeLog, GoogleAdsChangeLogSchema } from './schemas/google-ads-change-log.schema';
import {
  GoogleAdsFinancialExecutionLease,
  GoogleAdsFinancialExecutionLeaseSchema,
} from './schemas/google-ads-financial-execution-lease.schema';

export const GOOGLE_ADS_MODEL_DEFINITIONS = [
  { name: GoogleAdsCampaign.name, schema: GoogleAdsCampaignSchema },
  { name: GoogleAdsBiddingLifecycle.name, schema: GoogleAdsBiddingLifecycleSchema },
  { name: GoogleAdsCampaignBudget.name, schema: GoogleAdsCampaignBudgetSchema },
  { name: GoogleAdsCampaignCriterion.name, schema: GoogleAdsCampaignCriterionSchema },
  { name: GoogleAdsConversionAction.name, schema: GoogleAdsConversionActionSchema },
  {
    name: GoogleAdsCampaignConversionGoal.name,
    schema: GoogleAdsCampaignConversionGoalSchema,
  },
  {
    name: GoogleAdsConversionGoalCampaignConfig.name,
    schema: GoogleAdsConversionGoalCampaignConfigSchema,
  },
  { name: GoogleAdsAdGroup.name, schema: GoogleAdsAdGroupSchema },
  { name: GoogleAdsKeyword.name, schema: GoogleAdsKeywordSchema },
  { name: GoogleAdsAd.name, schema: GoogleAdsAdSchema },
  { name: GoogleAdsDailyMetric.name, schema: GoogleAdsDailyMetricSchema },
  { name: GoogleAdsSyncRun.name, schema: GoogleAdsSyncRunSchema },
  { name: GoogleAdsExport.name, schema: GoogleAdsExportSchema },
  { name: GoogleAdsActionPlan.name, schema: GoogleAdsActionPlanSchema },
  { name: GoogleAdsActionExecutionLog.name, schema: GoogleAdsActionExecutionLogSchema },
  { name: GoogleAdsChangeLog.name, schema: GoogleAdsChangeLogSchema },
  { name: GoogleAdsActionEvaluation.name, schema: GoogleAdsActionEvaluationSchema },
  { name: GoogleAdsFinancialExecutionLease.name, schema: GoogleAdsFinancialExecutionLeaseSchema },
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdsManagerAccount.name, schema: AdsManagerAccountSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      ...GOOGLE_ADS_MODEL_DEFINITIONS,
    ]),
    ApiTokenModule,
    FinanceModule,
  ],
  controllers: [GoogleAdsController],
  providers: [
    GoogleAdsReadonlySyncService,
    GoogleAdsProfitEnrichmentService,
    GoogleAdsExportService,
    GoogleAdsActionPlanImportService,
    GoogleAdsErpActionPlanService,
    GoogleAdsCapabilitiesService,
    GoogleAdsLookupService,
    GoogleAdsConversionReadinessService,
    GoogleAdsBiddingLifecycleService,
    GoogleAdsOperationBuilderService,
    GoogleAdsProviderValidationService,
    GoogleAdsActionApprovalPolicyService,
    GoogleAdsActionPlanService,
    {
      provide: GOOGLE_ADS_FINANCIAL_CONTROL,
      useExisting: FinancialControlService,
    },
    GoogleAdsExecutionPolicyService,
    GoogleAdsFinancialExecutionLeaseService,
    GoogleAdsEvaluationService,
    GoogleAdsPostExecutionService,
    GoogleAdsExecutionService,
  ],
  exports: [
    MongooseModule,
    GoogleAdsReadonlySyncService,
    GoogleAdsProfitEnrichmentService,
    GoogleAdsExportService,
    GoogleAdsActionPlanImportService,
    GoogleAdsErpActionPlanService,
    GoogleAdsCapabilitiesService,
    GoogleAdsLookupService,
    GoogleAdsConversionReadinessService,
    GoogleAdsBiddingLifecycleService,
    GoogleAdsOperationBuilderService,
    GoogleAdsProviderValidationService,
    GoogleAdsActionApprovalPolicyService,
    GoogleAdsActionPlanService,
    GoogleAdsExecutionPolicyService,
    GoogleAdsFinancialExecutionLeaseService,
    GoogleAdsEvaluationService,
    GoogleAdsPostExecutionService,
    GoogleAdsExecutionService,
  ],
})
export class GoogleAdsModule {}
