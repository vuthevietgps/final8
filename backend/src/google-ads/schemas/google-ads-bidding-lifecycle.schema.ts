import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const GOOGLE_ADS_BIDDING_LIFECYCLE_STAGES = [
  'UNMANAGED',
  'MAXIMIZE_CLICKS',
  'MAXIMIZE_CLICKS_CPC_CEILING',
  'MAXIMIZE_CONVERSIONS',
  'MAXIMIZE_CONVERSIONS_TARGET_CPA',
] as const;

export type GoogleAdsBiddingLifecycleStage =
  (typeof GOOGLE_ADS_BIDDING_LIFECYCLE_STAGES)[number];

export const GOOGLE_ADS_BIDDING_LIFECYCLE_DECISIONS = [
  'NOT_EVALUATED',
  'NO_ACTION',
  'BLOCKED',
  'DRAFT_CREATED',
  'DRAFT_ALREADY_EXISTS',
  'FAILED',
] as const;

export type GoogleAdsBiddingLifecycleDecision =
  (typeof GOOGLE_ADS_BIDDING_LIFECYCLE_DECISIONS)[number];

export type GoogleAdsBiddingLifecycleDocument =
  HydratedDocument<GoogleAdsBiddingLifecycle>;

@Schema({
  collection: 'google_ads_bidding_lifecycles',
  timestamps: true,
})
export class GoogleAdsBiddingLifecycle {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  enabled: boolean;

  @Prop({ type: Number, required: true, min: 1, default: 50 })
  clickThreshold: number;

  @Prop({ type: Number, required: true, min: 1, max: 90, default: 30 })
  clickWindowDays: number;

  @Prop({ type: Number, min: 0, max: 2_000_000_000 })
  maxCpcBidCeilingVnd?: number;

  @Prop({ type: Number, required: true, min: 1, default: 15 })
  maximizeConversionsMinConversions: number;

  @Prop({ type: Number, required: true, min: 1, max: 90, default: 30 })
  conversionWindowDays: number;

  @Prop({ type: Number, required: true, min: 1, default: 30 })
  targetCpaMinConversions: number;

  @Prop({ type: Number, min: 0, max: 2_000_000_000 })
  targetCpaVnd?: number;

  @Prop({ type: Number, required: true, min: 0, default: 168 })
  cooldownHours: number;

  @Prop({ type: Number, required: true, min: 0, default: 168 })
  minimumStageDwellHours: number;

  @Prop({ type: Boolean, required: true, default: true, immutable: true })
  draftOnly: true;

  @Prop({ type: Number, required: true, min: 1, default: 1 })
  policyVersion: number;

  @Prop({
    required: true,
    enum: GOOGLE_ADS_BIDDING_LIFECYCLE_STAGES,
    default: 'UNMANAGED',
  })
  observedStage: GoogleAdsBiddingLifecycleStage;

  @Prop({ enum: GOOGLE_ADS_BIDDING_LIFECYCLE_STAGES })
  proposedStage?: GoogleAdsBiddingLifecycleStage;

  @Prop({ trim: true })
  canonicalBiddingStrategyType?: string;

  @Prop({ type: Date })
  stageEnteredAt?: Date;

  @Prop({ type: Date })
  observedAt?: Date;

  @Prop({ type: Date, index: true })
  lastEvaluatedAt?: Date;

  @Prop({
    required: true,
    enum: GOOGLE_ADS_BIDDING_LIFECYCLE_DECISIONS,
    default: 'NOT_EVALUATED',
  })
  lastDecision: GoogleAdsBiddingLifecycleDecision;

  @Prop({ trim: true })
  lastDecisionReason?: string;

  @Prop({ type: [String], default: [] })
  blockers: string[];

  @Prop({ type: Object })
  lastMetrics?: Record<string, any>;

  @Prop({ type: Object })
  lastMetricsWindow?: {
    clickFrom: string;
    conversionFrom: string;
    to: string;
  };

  @Prop({ trim: true, match: /^[a-f0-9]{64}$/ })
  lastMetricsHash?: string;

  @Prop({ trim: true })
  pendingPlanId?: string;

  @Prop({ trim: true })
  pendingActionId?: string;

  @Prop({ trim: true })
  pendingPlanStatus?: string;

  @Prop({ type: Date })
  pendingPlanCreatedAt?: Date;

  @Prop({ trim: true })
  lastDraftIdempotencyKey?: string;

  @Prop({ type: Date })
  lastDraftAt?: Date;

  @Prop({ trim: true })
  updatedByUserId?: string;

  @Prop({ trim: true })
  leaseOwner?: string;

  @Prop({ trim: true })
  leaseToken?: string;

  @Prop({ type: Date, index: true })
  leaseExpiresAt?: Date;
}

export const GoogleAdsBiddingLifecycleSchema =
  SchemaFactory.createForClass(GoogleAdsBiddingLifecycle);

GoogleAdsBiddingLifecycleSchema.index(
  { customerId: 1, campaignId: 1 },
  {
    unique: true,
    name: 'uniq_google_ads_bidding_lifecycle_campaign',
  },
);
GoogleAdsBiddingLifecycleSchema.index(
  { enabled: 1, lastEvaluatedAt: 1 },
  { name: 'idx_google_ads_bidding_lifecycle_evaluation' },
);
