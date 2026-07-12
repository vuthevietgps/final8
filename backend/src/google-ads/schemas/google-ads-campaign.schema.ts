import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsCampaignDocument = HydratedDocument<GoogleAdsCampaign>;

@Schema({ collection: 'google_ads_campaigns', timestamps: true })
export class GoogleAdsCampaign {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({ required: true, trim: true, match: /^customers\/\d+\/campaigns\/\d+$/ })
  resourceName: string;

  @Prop({ trim: true })
  campaignName?: string;

  @Prop({ trim: true })
  status?: string;

  @Prop({ trim: true })
  advertisingChannelType?: string;

  @Prop({ trim: true })
  biddingStrategyType?: string;

  @Prop({ trim: true, match: /^\d+$/ })
  campaignBudgetId?: string;

  @Prop({ trim: true, match: /^customers\/\d+\/campaignBudgets\/\d+$/ })
  campaignBudgetResourceName?: string;

  @Prop({ trim: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  startDate?: string;

  @Prop({ trim: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  endDate?: string;

  @Prop({ trim: true })
  internalProductId?: string;

  @Prop({ type: Date })
  lastSyncAt?: Date;
}

export const GoogleAdsCampaignSchema = SchemaFactory.createForClass(GoogleAdsCampaign);

GoogleAdsCampaignSchema.index(
  { customerId: 1, campaignId: 1 },
  { unique: true, name: 'uniq_google_ads_campaign_customer_campaign' },
);
GoogleAdsCampaignSchema.index(
  { resourceName: 1 },
  { unique: true, name: 'uniq_google_ads_campaign_resource_name' },
);
GoogleAdsCampaignSchema.index(
  { customerId: 1, status: 1, updatedAt: -1 },
  { name: 'idx_google_ads_campaign_customer_status' },
);
GoogleAdsCampaignSchema.index(
  { customerId: 1, campaignBudgetResourceName: 1 },
  { name: 'idx_google_ads_campaign_budget_resource' },
);
