import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GoogleAdsMetricLevel } from './google-ads-daily-metric.schema';

export const GOOGLE_ADS_EVALUATION_RESULTS = [
  'success',
  'neutral',
  'failed',
  'insufficient_data',
  'rollback_recommended',
] as const;
export type GoogleAdsEvaluationResult = (typeof GOOGLE_ADS_EVALUATION_RESULTS)[number];
export type GoogleAdsActionEvaluationDocument = HydratedDocument<GoogleAdsActionEvaluation>;

@Schema({ collection: 'google_ads_action_evaluations', timestamps: true })
export class GoogleAdsActionEvaluation {
  @Prop({ required: true, trim: true, unique: true, index: true })
  evaluationId: string;

  @Prop({ type: Types.ObjectId, ref: 'GoogleAdsActionExecutionLog', index: true })
  executionLogId?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  planId: string;

  @Prop({ required: true, trim: true, index: true })
  actionId: string;

  @Prop({ required: true, trim: true, index: true })
  idempotencyKey: string;

  @Prop({ required: true, trim: true })
  actionType: string;

  @Prop({ required: true, trim: true, index: true })
  customerId: string;

  @Prop({ required: true, enum: [3, 7], index: true })
  evaluationDays: 3 | 7;

  @Prop({ required: true, enum: ['campaign', 'ad_group', 'keyword', 'ad'] })
  scopeLevel: GoogleAdsMetricLevel;

  @Prop({ trim: true })
  campaignId?: string;

  @Prop({ trim: true })
  adGroupId?: string;

  @Prop({ trim: true })
  criterionId?: string;

  @Prop({ trim: true })
  adId?: string;

  @Prop({ type: Object, required: true })
  baselineWindow: { from: string; to: string };

  @Prop({ type: Object, required: true })
  evaluationWindow: { from: string; to: string };

  @Prop({ type: Date, required: true, index: true })
  dueAt: Date;

  @Prop({ type: Date, required: true, index: true })
  executedAt: Date;

  @Prop({ required: true, enum: ['pending', 'evaluating', 'completed', 'failed'], default: 'pending', index: true })
  status: 'pending' | 'evaluating' | 'completed' | 'failed';

  @Prop({ enum: GOOGLE_ADS_EVALUATION_RESULTS })
  result?: GoogleAdsEvaluationResult;

  @Prop({ type: Object })
  beforeMetrics?: Record<string, any>;

  @Prop({ type: Object })
  afterMetrics?: Record<string, any>;

  @Prop({ type: Object })
  delta?: Record<string, any>;

  @Prop({ type: Object })
  syncResult?: Record<string, any>;

  @Prop({ trim: true })
  insight?: string;

  @Prop({ trim: true })
  failureMessage?: string;

  @Prop({ type: Date, index: true })
  evaluatedAt?: Date;
}

export const GoogleAdsActionEvaluationSchema = SchemaFactory.createForClass(GoogleAdsActionEvaluation);

GoogleAdsActionEvaluationSchema.index(
  { idempotencyKey: 1, evaluationDays: 1 },
  { unique: true, name: 'uniq_google_ads_action_evaluation_window' },
);
GoogleAdsActionEvaluationSchema.index(
  { status: 1, dueAt: 1 },
  { name: 'idx_google_ads_action_evaluation_due' },
);
GoogleAdsActionEvaluationSchema.index(
  { planId: 1, actionId: 1, evaluationDays: 1 },
  { name: 'idx_google_ads_action_evaluation_plan_action' },
);

