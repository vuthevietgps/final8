import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WindsorAdsDailyMetricDocument = HydratedDocument<WindsorAdsDailyMetric>;

@Schema({ collection: 'windsor_ads_daily_metrics', timestamps: true })
export class WindsorAdsDailyMetric {
  @Prop({ type: Types.ObjectId, ref: 'ProviderConnection', required: true, index: true })
  connectionId: Types.ObjectId;
  @Prop({ required: true, enum: ['google'], index: true }) provider: 'google';
  @Prop({ required: true, enum: ['google_ads'] }) connector: 'google_ads';
  @Prop({ required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true }) date: string;
  @Prop({ required: true, trim: true, match: /^\d+$/, index: true }) accountId: string;
  @Prop({ required: true, trim: true, match: /^\d+$/, index: true }) campaignId: string;
  @Prop({ required: true, trim: true, match: /^\d+$/, index: true }) adGroupId: string;
  @Prop({ trim: true, maxlength: 500 }) campaignName?: string;
  @Prop({ trim: true, maxlength: 500 }) adGroupName?: string;
  @Prop({ trim: true, uppercase: true, match: /^[A-Z]{3}$/ }) currency?: string;
  @Prop({ trim: true, maxlength: 100 }) timezone?: string;
  @Prop({ type: Number, min: 0, default: 0 }) spend: number;
  @Prop({ type: Number, min: 0, default: 0 }) impressions: number;
  @Prop({ type: Number, min: 0, default: 0 }) clicks: number;
  @Prop({ type: Number, min: 0, default: 0 }) conversions: number;
  @Prop({ type: Number, min: 0, default: 0 }) allConversions: number;
  @Prop({ type: Number, default: 0 }) conversionValue: number;
  @Prop({ type: Number, min: 0, default: 0 }) costPerConversion: number;
  @Prop({ type: Number, min: 0, default: 0 }) ctr: number;
  @Prop({ type: Number, min: 0, default: 0 }) cpc: number;
  @Prop({ type: Number, min: 0, default: 0 }) cpm: number;
  @Prop({ required: true, trim: true }) lastSyncRunId: string;
  @Prop({ type: Date, required: true, index: true }) fetchedAt: Date;
}

export const WindsorAdsDailyMetricSchema = SchemaFactory.createForClass(WindsorAdsDailyMetric);
WindsorAdsDailyMetricSchema.index(
  { connectionId: 1, date: 1, accountId: 1, campaignId: 1, adGroupId: 1 },
  { unique: true, name: 'uniq_windsor_ads_daily_metric_scope' },
);
WindsorAdsDailyMetricSchema.index(
  { provider: 1, accountId: 1, adGroupId: 1, date: -1 },
  { name: 'idx_windsor_ads_daily_metric_group_date' },
);
WindsorAdsDailyMetricSchema.index(
  { connectionId: 1, lastSyncRunId: 1, date: 1 },
  { name: 'idx_windsor_ads_daily_metric_run_materialization' },
);
