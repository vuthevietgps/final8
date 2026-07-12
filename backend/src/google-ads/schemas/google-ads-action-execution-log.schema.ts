import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsActionExecutionLogDocument = HydratedDocument<GoogleAdsActionExecutionLog>;

@Schema({ collection: 'google_ads_action_execution_logs', timestamps: true })
export class GoogleAdsActionExecutionLog {
  @Prop({ required: true, trim: true, index: true })
  planId: string;

  @Prop({ required: true, trim: true, index: true })
  actionId: string;

  @Prop({ required: true, trim: true, index: true })
  idempotencyKey: string;

  @Prop({ required: true, trim: true, index: true })
  actionType: string;

  @Prop({ required: true, enum: ['executing', 'success', 'failed', 'skipped', 'dry_run'], index: true })
  status: 'executing' | 'success' | 'failed' | 'skipped' | 'dry_run';

  @Prop({ type: Boolean, default: false, index: true })
  idempotencyReserved: boolean;

  @Prop({ trim: true })
  approvedBy?: string;

  @Prop({ trim: true, index: true })
  approvedByUserId?: string;

  @Prop({ trim: true })
  executedBy?: string;

  @Prop({ trim: true, index: true })
  executedByUserId?: string;

  @Prop({ trim: true })
  providerRequestId?: string;

  @Prop({ type: [Object], default: [] })
  providerErrors?: Array<Record<string, any>>;

  @Prop({ type: [Object], default: [] })
  requestOperations?: Array<Record<string, any>>;

  @Prop({ type: Object })
  providerResponse?: Record<string, any>;

  @Prop({ type: Object })
  beforeState?: Record<string, any>;

  @Prop({ type: Object })
  afterState?: Record<string, any>;

  @Prop({ type: Object })
  syncedRemoteState?: Record<string, any>;

  @Prop({ type: [Object], default: [] })
  postExecutionErrors?: Array<{ step: string; message: string }>;

  @Prop({ type: Date, default: Date.now, index: true })
  executedAt: Date;
}

export const GoogleAdsActionExecutionLogSchema = SchemaFactory.createForClass(GoogleAdsActionExecutionLog);

GoogleAdsActionExecutionLogSchema.index(
  { planId: 1, executedAt: -1 },
  { name: 'idx_google_ads_execution_plan_date' },
);
GoogleAdsActionExecutionLogSchema.index(
  { planId: 1, actionId: 1, executedAt: -1 },
  { name: 'idx_google_ads_execution_plan_action_date' },
);
GoogleAdsActionExecutionLogSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyReserved: true },
    name: 'uniq_google_ads_reserved_idempotency_key',
  },
);
