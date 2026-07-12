import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GoogleAdsChangeLogDocument = HydratedDocument<GoogleAdsChangeLog>;

@Schema({ collection: 'google_ads_change_logs', timestamps: true })
export class GoogleAdsChangeLog {
  @Prop({ required: true, trim: true, unique: true, index: true })
  changeLogId: string;

  @Prop({ type: Types.ObjectId, ref: 'GoogleAdsActionExecutionLog', index: true })
  executionLogId?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  planId: string;

  @Prop({ required: true, trim: true, index: true })
  actionId: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  idempotencyKey: string;

  @Prop({ required: true, trim: true, default: 'google' })
  provider: 'google';

  @Prop({ required: true, trim: true, index: true })
  customerId: string;

  @Prop({ required: true, trim: true, index: true })
  actionType: string;

  @Prop({ trim: true })
  resourceType?: string;

  @Prop({ trim: true, index: true })
  campaignId?: string;

  @Prop({ trim: true, index: true })
  campaignBudgetId?: string;

  @Prop({ trim: true, index: true })
  adGroupId?: string;

  @Prop({ trim: true, index: true })
  criterionId?: string;

  @Prop({ trim: true, index: true })
  adId?: string;

  @Prop({ type: Object })
  beforeValue?: Record<string, any>;

  @Prop({ type: Object })
  afterValue?: Record<string, any>;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ trim: true })
  changedBy?: string;

  @Prop({ trim: true })
  providerRequestId?: string;

  @Prop({ type: Object })
  syncResult?: Record<string, any>;

  @Prop({ type: [Date], default: [] })
  evaluationDueAt: Date[];

  @Prop({ type: Date, required: true, index: true })
  executedAt: Date;
}

export const GoogleAdsChangeLogSchema = SchemaFactory.createForClass(GoogleAdsChangeLog);

GoogleAdsChangeLogSchema.index(
  { planId: 1, actionId: 1 },
  { unique: true, name: 'uniq_google_ads_change_log_plan_action' },
);
GoogleAdsChangeLogSchema.index(
  { customerId: 1, executedAt: -1 },
  { name: 'idx_google_ads_change_log_customer_date' },
);

