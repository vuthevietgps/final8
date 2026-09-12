import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsConversionGoalCampaignConfigDocument =
  HydratedDocument<GoogleAdsConversionGoalCampaignConfig>;

@Schema({
  collection: 'google_ads_conversion_goal_campaign_configs',
  timestamps: true,
})
export class GoogleAdsConversionGoalCampaignConfig {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({
    required: true,
    trim: true,
    match: /^customers\/\d+\/conversionGoalCampaignConfigs\/\d+$/,
  })
  resourceName: string;

  @Prop({ trim: true })
  goalConfigLevel?: string;

  @Prop({
    trim: true,
    match: /^customers\/\d+\/customConversionGoals\/\d+$/,
  })
  customConversionGoalResourceName?: string;

  @Prop({ type: Date })
  lastSyncAt?: Date;
}

export const GoogleAdsConversionGoalCampaignConfigSchema =
  SchemaFactory.createForClass(GoogleAdsConversionGoalCampaignConfig);

GoogleAdsConversionGoalCampaignConfigSchema.index(
  { customerId: 1, campaignId: 1 },
  { unique: true, name: 'uniq_google_ads_conversion_goal_campaign_config' },
);
