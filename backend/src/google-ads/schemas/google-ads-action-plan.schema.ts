import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsActionPlanDocument = HydratedDocument<GoogleAdsActionPlan>;

@Schema({ _id: true })
export class GoogleAdsActionPlanItem {
  @Prop({ required: true, trim: true })
  actionId: string;

  @Prop({ required: true, trim: true })
  idempotencyKey: string;

  @Prop({ required: true, trim: true, default: 'google' })
  provider: 'google';

  @Prop({ required: true, trim: true })
  actionType: string;

  @Prop({ required: true, trim: true })
  customerId: string;

  @Prop({ trim: true })
  loginCustomerId?: string;

  @Prop({ required: true, trim: true })
  resourceType: string;

  @Prop({ required: true, trim: true })
  operation: string;

  @Prop({ type: Object, required: true })
  typedPayload: Record<string, any>;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ type: Object, default: {} })
  evidence: Record<string, any>;

  @Prop({ type: Number, min: 0, max: 1 })
  confidence: number;

  @Prop({ required: true, enum: ['low', 'medium', 'high'] })
  risk: 'low' | 'medium' | 'high';

  @Prop({ required: true, trim: true })
  dataQuality: string;

  @Prop({ type: Boolean, required: true, default: true })
  approvalRequired: true;

  @Prop({ type: [String], default: [] })
  rollbackIf: string[];

  @Prop({ required: true, enum: ['pending', 'approved', 'rejected', 'executed', 'failed'], default: 'pending', index: true })
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

  @Prop({
    required: true,
    enum: ['pending', 'provider_validate_passed', 'provider_validate_failed'],
    default: 'pending',
  })
  providerValidationStatus: 'pending' | 'provider_validate_passed' | 'provider_validate_failed';

  @Prop({ type: [Object], default: [] })
  providerValidationErrors: Array<{
    code?: string;
    message: string;
    fieldPath?: string;
  }>;

  @Prop({ trim: true })
  providerRequestId?: string;

  @Prop({ type: Date })
  providerValidatedAt?: Date;

  @Prop()
  approvalText?: string;

  @Prop({ trim: true })
  approvedBy?: string;

  @Prop({ trim: true })
  approvedByUserId?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ enum: ['codex_operator'] })
  approvedBySource?: 'codex_operator';

  @Prop({ type: Boolean, default: true })
  requireExecutionConfirmation?: boolean;

  @Prop()
  rejectionReason?: string;

  @Prop({ trim: true })
  rejectedBy?: string;

  @Prop({ trim: true })
  rejectedByUserId?: string;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ enum: ['codex_operator'] })
  rejectedBySource?: 'codex_operator';

  @Prop({ type: [Object], default: [] })
  approvalHistory?: Array<{
    decision: 'approved' | 'rejected';
    text: string;
    by: string;
    byUserId?: string;
    source: 'codex_operator';
    at: Date;
  }>;
}

export const GoogleAdsActionPlanItemSchema = SchemaFactory.createForClass(GoogleAdsActionPlanItem);

@Schema({ collection: 'google_ads_action_plans', timestamps: true })
export class GoogleAdsActionPlan {
  @Prop({ required: true, trim: true, unique: true, index: true })
  planId: string;

  @Prop({ required: true, trim: true, index: true })
  sourceExportId: string;

  @Prop({ required: true, trim: true, default: '2.0' })
  schemaVersion: '2.0';

  @Prop({ required: true, trim: true, default: 'google' })
  targetProvider: 'google';

  @Prop({ required: true, trim: true, default: 'VND' })
  currency: 'VND';

  @Prop({ required: true, trim: true, default: 'Asia/Ho_Chi_Minh' })
  timezone: 'Asia/Ho_Chi_Minh';

  @Prop({ required: true, trim: true, default: 'pending_approval' })
  executionMode: 'pending_approval';

  @Prop({ required: true, enum: ['pending_approval', 'partially_approved', 'approved', 'rejected', 'executing', 'executed', 'failed'], default: 'pending_approval', index: true })
  status: 'pending_approval' | 'partially_approved' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed';

  @Prop({ required: true, enum: ['pending', 'passed', 'partial', 'failed'], default: 'pending', index: true })
  providerValidationStatus: 'pending' | 'passed' | 'partial' | 'failed';

  @Prop({ type: [Object], default: [] })
  providerValidationErrors: Array<{
    actionId: string;
    code?: string;
    message: string;
    fieldPath?: string;
  }>;

  @Prop({ type: Date })
  providerValidatedAt?: Date;

  @Prop({ type: Object, required: true })
  analysisSummary: Record<string, any>;

  @Prop({ type: [GoogleAdsActionPlanItemSchema], default: [] })
  items: GoogleAdsActionPlanItem[];

  @Prop({ type: [String], required: true })
  actionIds: string[];

  @Prop({ type: [String], required: true })
  idempotencyKeys: string[];

  @Prop({ type: Object, required: true })
  manifest: Record<string, any>;

  @Prop({ trim: true })
  source?: string;

  @Prop({ trim: true })
  originalFileName?: string;

  @Prop({ trim: true })
  originalZipSha256?: string;
}

export const GoogleAdsActionPlanSchema = SchemaFactory.createForClass(GoogleAdsActionPlan);

GoogleAdsActionPlanSchema.index(
  { idempotencyKeys: 1 },
  { unique: true, name: 'uniq_google_ads_action_plan_idempotency_key' },
);
GoogleAdsActionPlanSchema.index(
  { 'items.status': 1, createdAt: -1 },
  { name: 'idx_google_ads_action_plan_item_status' },
);
