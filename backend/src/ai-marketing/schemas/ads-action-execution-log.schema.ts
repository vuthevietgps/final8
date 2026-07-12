import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ADS_ACTION_TYPES, AdsActionType } from './ads-action-plan.schema';

export type AdsActionExecutionLogDocument = HydratedDocument<AdsActionExecutionLog>;

export const ADS_EXECUTION_STATUSES = ['success', 'failed', 'skipped', 'dry_run'] as const;
export type AdsExecutionStatus = (typeof ADS_EXECUTION_STATUSES)[number];

@Schema({ collection: 'ads_action_execution_logs', timestamps: true })
export class AdsActionExecutionLog {
  @Prop({ type: Types.ObjectId, ref: 'AdsActionPlan', required: true, index: true })
  planId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  itemId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ADS_ACTION_TYPES, index: true })
  actionType: AdsActionType;

  @Prop({ trim: true, index: true })
  adGroupId?: string;

  @Prop({ trim: true, index: true })
  platform?: string;

  @Prop({ type: Number })
  currentValue?: number;

  @Prop({ type: Number })
  targetValue?: number;

  @Prop({ type: String, enum: ADS_EXECUTION_STATUSES, required: true, index: true })
  status: AdsExecutionStatus;

  @Prop({ type: Boolean, default: false })
  dryRun: boolean;

  @Prop({ trim: true })
  approvedBy?: string;

  @Prop({ type: Date, default: Date.now, index: true })
  executedAt: Date;

  @Prop({ type: Object })
  beforeSnapshot?: Record<string, any>;

  @Prop({ type: Object })
  afterSnapshot?: Record<string, any>;

  @Prop({ type: Object })
  requestPayload?: Record<string, any>;

  @Prop({ type: Object })
  providerResponse?: Record<string, any>;

  @Prop({ trim: true })
  errorMessage?: string;

  @Prop({ type: Date, index: true })
  evaluationDueAt?: Date;
}

export const AdsActionExecutionLogSchema = SchemaFactory.createForClass(AdsActionExecutionLog);

AdsActionExecutionLogSchema.index({ adGroupId: 1, executedAt: -1 });
AdsActionExecutionLogSchema.index({ status: 1, evaluationDueAt: 1 });
