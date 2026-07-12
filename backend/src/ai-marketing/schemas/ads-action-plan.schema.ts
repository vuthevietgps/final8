import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdsActionPlanDocument = HydratedDocument<AdsActionPlan>;

export const ADS_ACTION_TYPES = [
  'increase_budget',
  'decrease_budget',
  'pause_ad_group',
  'resume_ad_group',
  'create_remarketing',
  'creative_test',
  'sale_followup_task',
] as const;

export const ADS_PLAN_ITEM_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'applied',
  'failed',
  'skipped',
] as const;

export const ADS_PLAN_STATUSES = [
  'draft',
  'pending_approval',
  'partially_approved',
  'approved',
  'partially_applied',
  'applied',
  'rejected',
] as const;

export type AdsActionType = (typeof ADS_ACTION_TYPES)[number];
export type AdsPlanItemStatus = (typeof ADS_PLAN_ITEM_STATUSES)[number];
export type AdsPlanStatus = (typeof ADS_PLAN_STATUSES)[number];

@Schema({ _id: true })
export class AdsActionPlanItem {
  _id?: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ADS_ACTION_TYPES, index: true })
  actionType: AdsActionType;

  @Prop({ trim: true, index: true })
  adGroupId?: string;

  @Prop({ trim: true })
  adGroupName?: string;

  @Prop({ trim: true, index: true })
  platform?: string;

  @Prop({ trim: true })
  targetId?: string;

  @Prop({ type: Number })
  currentValue?: number;

  @Prop({ type: Number })
  targetValue?: number;

  @Prop({ type: Number })
  expectedProfit?: number;

  @Prop({ type: Number })
  expectedRoi?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  confidence?: number;

  @Prop({ trim: true })
  reason?: string;

  @Prop({ trim: true })
  riskLevel?: 'low' | 'medium' | 'high';

  @Prop({ type: Boolean, default: true })
  requiresApproval: boolean;

  @Prop({ type: String, enum: ADS_PLAN_ITEM_STATUSES, default: 'pending', index: true })
  status: AdsPlanItemStatus;

  @Prop({ trim: true })
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ type: Object })
  beforeSnapshot?: Record<string, any>;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ type: Types.ObjectId, ref: 'AdsActionExecutionLog' })
  executionLogId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AdsActionEvaluation' })
  evaluationId?: Types.ObjectId;
}

export const AdsActionPlanItemSchema = SchemaFactory.createForClass(AdsActionPlanItem);

@Schema({ collection: 'ads_action_plans', timestamps: true })
export class AdsActionPlan {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, enum: ADS_PLAN_STATUSES, default: 'draft', index: true })
  status: AdsPlanStatus;

  @Prop({ type: String, default: 'ai-marketing', index: true })
  source: string;

  @Prop({ type: String, default: 'suggest_only' })
  mode: 'suggest_only' | 'approval_required' | 'manual_apply';

  @Prop({ type: Object, required: true })
  dateWindow: {
    from: Date;
    to: Date;
    lookbackDays: number;
  };

  @Prop({ type: Object })
  summary?: Record<string, any>;

  @Prop({ type: [AdsActionPlanItemSchema], default: [] })
  items: AdsActionPlanItem[];

  @Prop({ trim: true })
  createdBy?: string;

  @Prop({ trim: true })
  notes?: string;
}

export const AdsActionPlanSchema = SchemaFactory.createForClass(AdsActionPlan);

AdsActionPlanSchema.index({ status: 1, createdAt: -1 });
AdsActionPlanSchema.index({ 'items.adGroupId': 1, createdAt: -1 });
