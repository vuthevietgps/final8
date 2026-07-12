import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const GOOGLE_ADS_METRIC_LEVELS = ['campaign', 'ad_group', 'keyword', 'ad'] as const;
export type GoogleAdsMetricLevel = (typeof GOOGLE_ADS_METRIC_LEVELS)[number];
export type GoogleAdsDailyMetricDocument = HydratedDocument<GoogleAdsDailyMetric>;

@Schema({ collection: 'google_ads_daily_metrics', timestamps: true })
export class GoogleAdsDailyMetric {
  @Prop({ required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  date: string;

  @Prop({ required: true, enum: GOOGLE_ADS_METRIC_LEVELS })
  level: GoogleAdsMetricLevel;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({ trim: true, match: /^\d+$/ })
  adGroupId?: string;

  @Prop({ trim: true, match: /^\d+$/ })
  criterionId?: string;

  @Prop({ trim: true, match: /^\d+$/ })
  adId?: string;

  @Prop({ trim: true })
  resourceName?: string;

  @Prop({ trim: true })
  keywordText?: string;

  @Prop({ trim: true, enum: ['EXACT', 'PHRASE', 'BROAD'] })
  matchType?: 'EXACT' | 'PHRASE' | 'BROAD';

  @Prop({ type: Number, min: 0, default: 0 })
  costMicros: number;

  @Prop({ type: Number, min: 0, default: 0 })
  costVnd: number;

  @Prop({ type: Number, min: 0, default: 0 })
  impressions: number;

  @Prop({ type: Number, min: 0, default: 0 })
  clicks: number;

  @Prop({ type: Number, min: 0, default: 0 })
  ctr: number;

  @Prop({ type: Number, min: 0, default: 0 })
  averageCpc: number;

  @Prop({ type: Number, min: 0, default: 0 })
  conversions: number;

  @Prop({ type: Number, min: 0, default: 0 })
  allConversions: number;

  @Prop({ type: Number, default: 0 })
  conversionValue: number;

  @Prop({ type: Number, min: 0, default: 0 })
  costPerConversion: number;

  @Prop({ type: Number, default: 0 })
  revenue: number;

  @Prop({ type: Number, default: 0 })
  grossProfit: number;

  @Prop({ type: Number, default: 0 })
  netProfit: number;

  @Prop({ type: Number, min: 0, default: 0 })
  orders: number;

  @Prop({ type: Number, min: 0, default: 0 })
  confirmedOrders: number;

  @Prop({ type: Number, min: 0, default: 0 })
  cancelledOrders: number;

  @Prop({ type: Number, min: 0, default: 0 })
  returnedOrders: number;

  @Prop({ type: Number, default: 0 })
  profitPerSpend: number;

  @Prop({ type: Number, default: 0 })
  roas: number;

  @Prop({ type: Date })
  lastSyncAt?: Date;

  // ERP-only provenance. Provider sync never supplies or clears these fields.
  @Prop({ type: Date, index: true })
  erpEnrichedAt?: Date;

  @Prop({ type: Date, index: true })
  profitUpdatedAt?: Date;
}

export const GoogleAdsDailyMetricSchema = SchemaFactory.createForClass(GoogleAdsDailyMetric);

GoogleAdsDailyMetricSchema.index(
  { level: 1, date: 1, customerId: 1, campaignId: 1, adGroupId: 1, criterionId: 1, adId: 1 },
  { unique: true, name: 'uniq_google_ads_daily_metric_scope' },
);
GoogleAdsDailyMetricSchema.index(
  { customerId: 1, level: 1, date: -1 },
  { name: 'idx_google_ads_daily_metric_customer_level_date' },
);
GoogleAdsDailyMetricSchema.index(
  { customerId: 1, campaignId: 1, date: -1 },
  { name: 'idx_google_ads_daily_metric_campaign_date' },
);
GoogleAdsDailyMetricSchema.index(
  { customerId: 1, adGroupId: 1, date: -1 },
  { sparse: true, name: 'idx_google_ads_daily_metric_ad_group_date' },
);
GoogleAdsDailyMetricSchema.index(
  { resourceName: 1, date: -1 },
  { sparse: true, name: 'idx_google_ads_daily_metric_resource_date' },
);
