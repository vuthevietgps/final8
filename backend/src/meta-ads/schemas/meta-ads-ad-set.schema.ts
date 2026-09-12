import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MetaAdsAdSetDocument = HydratedDocument<MetaAdsAdSet>;

@Schema({ collection: 'meta_ads_ad_sets', timestamps: true })
export class MetaAdsAdSet {
  @Prop({ required: true, trim: true, index: true })
  adAccountId: string;

  @Prop({ required: true, trim: true, index: true })
  campaignId: string;

  @Prop({ required: true, trim: true, index: true })
  adSetId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  status: string;

  @Prop({ trim: true, index: true })
  effectiveStatus?: string;

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
  bidAmountVnd?: number;

  @Prop({ required: true, trim: true })
  optimizationGoal: string;

  @Prop({ required: true, trim: true })
  billingEvent: string;

  @Prop({ required: true, trim: true })
  destinationType: string;

  @Prop({ type: [String], default: [] })
  targetingCountries: string[];

  @Prop({ type: Number })
  ageMin?: number;

  @Prop({ type: Number })
  ageMax?: number;

  @Prop({ type: [Number], default: [] })
  genders: number[];

  @Prop({ type: [String], default: [] })
  publisherPlatforms: string[];

  @Prop({ type: [String], default: [] })
  facebookPositions: string[];

  @Prop({ type: [String], default: [] })
  instagramPositions: string[];

  @Prop({ trim: true })
  pageId?: string;

  @Prop({ trim: true })
  pixelId?: string;

  @Prop({ trim: true })
  applicationId?: string;

  @Prop({ trim: true })
  objectStoreUrl?: string;

  @Prop({ trim: true })
  customEventType?: string;

  @Prop({ type: Date })
  startTime?: Date;

  @Prop({ type: Date })
  stopTime?: Date;

  @Prop({ trim: true, index: true })
  internalAdGroupId?: string;

  @Prop({ type: [String], default: [] })
  internalProductIds: string[];

  @Prop({ type: Date })
  providerUpdatedAt?: Date;

  @Prop({ type: Date, required: true, index: true })
  lastReadbackAt: Date;

  @Prop({ trim: true, index: true })
  sourcePlanId?: string;

  @Prop({ trim: true })
  sourceIdempotencyKey?: string;
}

export const MetaAdsAdSetSchema = SchemaFactory.createForClass(MetaAdsAdSet);

MetaAdsAdSetSchema.index(
  { adAccountId: 1, adSetId: 1 },
  { unique: true, name: 'uniq_meta_ads_ad_set_account_ad_set' },
);
MetaAdsAdSetSchema.index(
  { adAccountId: 1, campaignId: 1, status: 1, lastReadbackAt: -1 },
  { name: 'idx_meta_ads_ad_set_campaign_status_readback' },
);
