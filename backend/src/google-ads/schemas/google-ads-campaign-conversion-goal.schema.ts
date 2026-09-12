import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsCampaignConversionGoalDocument =
  HydratedDocument<GoogleAdsCampaignConversionGoal>;

@Schema({ collection: 'google_ads_campaign_conversion_goals', timestamps: true })
export class GoogleAdsCampaignConversionGoal {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({
    required: true,
    trim: true,
    match: /^customers\/\d+\/campaignConversionGoals\/\d+~[A-Z_]+~[A-Z_]+$/,
  })
  resourceName: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  origin: string;

  @Prop({ required: true, type: Boolean })
  biddable: boolean;

  @Prop({ type: Date })
  lastSyncAt?: Date;
}

export const GoogleAdsCampaignConversionGoalSchema =
  SchemaFactory.createForClass(GoogleAdsCampaignConversionGoal);

GoogleAdsCampaignConversionGoalSchema.index(
  { customerId: 1, campaignId: 1, category: 1, origin: 1 },
  { unique: true, name: 'uniq_google_ads_campaign_conversion_goal' },
);
GoogleAdsCampaignConversionGoalSchema.index(
  { customerId: 1, campaignId: 1, biddable: 1, lastSyncAt: -1 },
  { name: 'idx_google_ads_campaign_conversion_goal_readiness' },
);
