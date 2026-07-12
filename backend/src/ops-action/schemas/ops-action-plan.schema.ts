import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OPS_ACTION_PRIORITIES, OPS_ACTION_TYPES, OpsActionPriority, OpsActionType } from '../interfaces/ops-action.interfaces';

export type OpsActionPlanDocument = HydratedDocument<OpsActionPlan>;

export const OPS_TASK_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const OPS_PLAN_STATUSES = ['draft', 'pending_approval', 'partially_approved', 'approved', 'rejected'] as const;

export type OpsTaskStatus = (typeof OPS_TASK_STATUSES)[number];
export type OpsPlanStatus = (typeof OPS_PLAN_STATUSES)[number];

@Schema({ _id: true })
export class OpsTask {
  _id?: Types.ObjectId;

  @Prop({ type: String, required: true, enum: OPS_ACTION_TYPES, index: true })
  actionType: OpsActionType;

  @Prop({
    type: String,
    required: true,
    enum: OPS_ACTION_PRIORITIES,
    index: true,
  })
  priority: OpsActionPriority;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ trim: true })
  linkTo?: string;

  @Prop({ type: Number })
  amount?: number;

  @Prop({ type: Number })
  count?: number;

  @Prop({ trim: true })
  entityName?: string;

  @Prop({ trim: true, index: true })
  entityId?: string;

  @Prop({ type: Date, index: true })
  sourceGeneratedAt?: Date;

  @Prop({ trim: true, index: true })
  sourceSuggestionKey?: string;

  @Prop({ type: Boolean, default: true })
  requiresApproval: boolean;

  @Prop({
    type: String,
    enum: OPS_TASK_STATUSES,
    default: 'pending',
    index: true,
  })
  status: OpsTaskStatus;

  @Prop({ trim: true })
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ trim: true })
  rejectedBy?: string;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ type: Object })
  sourceSnapshot?: Record<string, any>;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const OpsTaskSchema = SchemaFactory.createForClass(OpsTask);

@Schema({ collection: 'ops_action_plans', timestamps: true })
export class OpsActionPlan {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    type: String,
    enum: OPS_PLAN_STATUSES,
    default: 'draft',
    index: true,
  })
  status: OpsPlanStatus;

  @Prop({ type: String, default: 'ops-action', index: true })
  source: string;

  @Prop({ type: String, default: 'approval_only' })
  mode: 'approval_only';

  @Prop({ type: Object })
  summary?: Record<string, any>;

  @Prop({ type: [OpsTaskSchema], default: [] })
  tasks: OpsTask[];

  @Prop({ trim: true })
  createdBy?: string;

  @Prop({ trim: true })
  notes?: string;
}

export const OpsActionPlanSchema = SchemaFactory.createForClass(OpsActionPlan);

OpsActionPlanSchema.index({ status: 1, createdAt: -1 });
OpsActionPlanSchema.index({ 'tasks.status': 1, createdAt: -1 });
OpsActionPlanSchema.index({ 'tasks.actionType': 1, createdAt: -1 });
OpsActionPlanSchema.index({ 'tasks.entityId': 1, createdAt: -1 });
