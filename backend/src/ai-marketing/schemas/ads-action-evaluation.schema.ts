import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdsActionEvaluationDocument = HydratedDocument<AdsActionEvaluation>;

export const ADS_EVALUATION_STATUSES = ['pending', 'evaluated', 'insufficient_data'] as const;
export type AdsEvaluationStatus = (typeof ADS_EVALUATION_STATUSES)[number];

@Schema({ collection: 'ads_action_evaluations', timestamps: true })
export class AdsActionEvaluation {
  @Prop({ type: Types.ObjectId, ref: 'AdsActionExecutionLog', required: true, index: true })
  executionLogId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AdsActionPlan', required: true, index: true })
  planId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  itemId: Types.ObjectId;

  @Prop({ trim: true, index: true })
  adGroupId?: string;

  @Prop({ trim: true, index: true })
  platform?: string;

  @Prop({ type: Object, required: true })
  baselineWindow: { from: Date; to: Date };

  @Prop({ type: Object, required: true })
  evaluationWindow: { from: Date; to: Date };

  @Prop({ type: String, enum: ADS_EVALUATION_STATUSES, default: 'pending', index: true })
  status: AdsEvaluationStatus;

  @Prop({ type: Object })
  beforeMetrics?: Record<string, any>;

  @Prop({ type: Object })
  afterMetrics?: Record<string, any>;

  @Prop({ type: Object })
  delta?: Record<string, any>;

  @Prop({ trim: true })
  verdict?: 'improved' | 'regressed' | 'mixed' | 'unchanged';

  @Prop({ trim: true })
  insight?: string;

  @Prop({ type: Date, index: true })
  evaluatedAt?: Date;
}

export const AdsActionEvaluationSchema = SchemaFactory.createForClass(AdsActionEvaluation);

AdsActionEvaluationSchema.index({ status: 1, 'evaluationWindow.to': 1 });
AdsActionEvaluationSchema.index({ adGroupId: 1, evaluatedAt: -1 });
