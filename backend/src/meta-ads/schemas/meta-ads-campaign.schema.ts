import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MetaAdsCampaignDocument = HydratedDocument<MetaAdsCampaign>;

@Schema({ collection: 'meta_ads_campaigns', timestamps: true })
export class MetaAdsCampaign {
  @Prop({ required: true, trim: true, index: true })
  adAccountId: string;

  @Prop({ required: true, trim: true, index: true })
  campaignId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  objective: string;

  @Prop({ required: true, trim: true, index: true })
  status: string;

  @Prop({ trim: true, index: true })
  effectiveStatus?: string;

  @Prop({ required: true, trim: true, default: 'AUCTION' })
  buyingType: string;

  @Prop({ type: [String], default: [] })
  specialAdCategories: string[];

  @Prop({ type: [String], default: [] })
  specialAdCategoryCountries: string[];

  @Prop({ enum: ['ABO', 'CBO'], index: true })
  budgetMode?: 'ABO' | 'CBO';

  @Prop({ enum: ['NONE', 'DAILY', 'LIFETIME'], index: true })
  budgetType?: 'NONE' | 'DAILY' | 'LIFETIME';

  @Prop({ type: Number, min: 0 })
  dailyBudgetVnd?: number;

  @Prop({ type: Number, min: 0 })
  lifetimeBudgetVnd?: number;

  @Prop({ trim: true })
  bidStrategy?: string;

  @Prop({ type: Number, min: 0 })
  spendCapVnd?: number;

  @Prop({ type: Date })
  startTime?: Date;

  @Prop({ type: Date })
  stopTime?: Date;

  @Prop({ trim: true, match: /^\d{1,32}$/ })
  appId?: string;

  @Prop({ type: Date })
  providerUpdatedAt?: Date;

  @Prop({ type: Date, required: true, index: true })
  lastReadbackAt: Date;

  @Prop({ trim: true, index: true })
  sourcePlanId?: string;

  @Prop({ trim: true })
  sourceIdempotencyKey?: string;
}

export const MetaAdsCampaignSchema = SchemaFactory.createForClass(MetaAdsCampaign);

MetaAdsCampaignSchema.index(
  { adAccountId: 1, campaignId: 1 },
  { unique: true, name: 'uniq_meta_ads_campaign_account_campaign' },
);
MetaAdsCampaignSchema.index(
  { adAccountId: 1, status: 1, lastReadbackAt: -1 },
  { name: 'idx_meta_ads_campaign_account_status_readback' },
);
