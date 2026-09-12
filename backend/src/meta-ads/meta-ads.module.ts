import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { ApiTokenModule } from '../api-token/api-token.module';
import { MetaAdsActionPlanService } from './meta-ads-action-plan.service';
import { MetaAdsApprovalService } from './meta-ads-approval.service';
import { MetaAdsCapabilitiesService } from './meta-ads-capabilities.service';
import { MetaAdsController } from './meta-ads.controller';
import { MetaAdsExecutionPolicyService } from './meta-ads-execution-policy.service';
import { MetaAdsExecutionService } from './meta-ads-execution.service';
import { MetaAdsLookupService } from './meta-ads-lookup.service';
import {
  DefaultMetaAdsHttpTransport,
  MetaAdsProviderClientService,
} from './meta-ads-provider-client.service';
import { MetaAdsProviderValidationService } from './meta-ads-provider-validation.service';
import {
  MetaAdsActionPlan,
  MetaAdsActionPlanSchema,
} from './schemas/meta-ads-action-plan.schema';
import { MetaAdsCampaign, MetaAdsCampaignSchema } from './schemas/meta-ads-campaign.schema';
import { MetaAdsAdSet, MetaAdsAdSetSchema } from './schemas/meta-ads-ad-set.schema';
import {
  MetaAdsAdCreative,
  MetaAdsAdCreativeSchema,
} from './schemas/meta-ads-ad-creative.schema';
import { MetaAdsAd, MetaAdsAdSchema } from './schemas/meta-ads-ad.schema';
import {
  MetaAdsExecutionLog,
  MetaAdsExecutionLogSchema,
} from './schemas/meta-ads-execution-log.schema';
import {
  MetaAdsExecutionReservation,
  MetaAdsExecutionReservationSchema,
} from './schemas/meta-ads-execution-reservation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: MetaAdsActionPlan.name, schema: MetaAdsActionPlanSchema },
      { name: MetaAdsCampaign.name, schema: MetaAdsCampaignSchema },
      { name: MetaAdsAdSet.name, schema: MetaAdsAdSetSchema },
      { name: MetaAdsAdCreative.name, schema: MetaAdsAdCreativeSchema },
      { name: MetaAdsAd.name, schema: MetaAdsAdSchema },
      { name: MetaAdsExecutionLog.name, schema: MetaAdsExecutionLogSchema },
      { name: MetaAdsExecutionReservation.name, schema: MetaAdsExecutionReservationSchema },
    ]),
    ApiTokenModule,
  ],
  controllers: [MetaAdsController],
  providers: [
    DefaultMetaAdsHttpTransport,
    MetaAdsProviderClientService,
    MetaAdsActionPlanService,
    MetaAdsApprovalService,
    MetaAdsCapabilitiesService,
    MetaAdsLookupService,
    MetaAdsExecutionPolicyService,
    MetaAdsProviderValidationService,
    MetaAdsExecutionService,
  ],
  exports: [MetaAdsActionPlanService, MetaAdsExecutionService],
})
export class MetaAdsModule {}
