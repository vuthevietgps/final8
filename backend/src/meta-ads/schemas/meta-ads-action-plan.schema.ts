import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  META_ADS_ACTION_TYPES,
  META_ADS_BILLING_EVENTS,
  META_ADS_BID_STRATEGIES,
  META_ADS_BUDGET_MODES,
  META_ADS_BUDGET_TYPES,
  META_ADS_CALL_TO_ACTION_TYPES,
  META_ADS_CUSTOM_EVENT_TYPES,
  META_ADS_DESTINATION_TYPES,
  META_ADS_FACEBOOK_POSITIONS,
  META_ADS_INSTAGRAM_POSITIONS,
  META_ADS_ODAX_OBJECTIVES,
  META_ADS_OPTIMIZATION_GOALS,
  META_ADS_PLAN_STATUSES,
  META_ADS_PUBLISHER_PLATFORMS,
  META_ADS_PROVIDER_VALIDATION_STATUSES,
  META_ADS_SPECIAL_AD_CATEGORIES,
  MetaAdsActionType,
  MetaAdsBidStrategy,
  MetaAdsBillingEvent,
  MetaAdsBudgetMode,
  MetaAdsBudgetType,
  MetaAdsCallToActionType,
  MetaAdsCustomEventType,
  MetaAdsDestinationType,
  MetaAdsFacebookPosition,
  MetaAdsInstagramPosition,
  MetaAdsOdaxObjective,
  MetaAdsOptimizationGoal,
  MetaAdsPlanStatus,
  MetaAdsPublisherPlatform,
  MetaAdsProviderValidationStatus,
  MetaAdsSpecialAdCategory,
} from '../meta-ads.types';

export type MetaAdsActionPlanDocument = HydratedDocument<MetaAdsActionPlan>;

@Schema({ _id: false, strict: 'throw' })
export class MetaAdsCanonicalAction {
  @Prop({ required: true, trim: true, immutable: true })
  actionId: string;

  @Prop({ required: true, trim: true, immutable: true })
  idempotencyKey: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 500, immutable: true })
  reason: string;

  @Prop({ required: true, enum: META_ADS_ACTION_TYPES, immutable: true })
  actionType: MetaAdsActionType;

  @Prop({ required: true, trim: true, match: /^\d{1,32}$/, immutable: true })
  adAccountId: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  campaignId?: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  adSetId?: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  creativeId?: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  adId?: string;

  @Prop({ trim: true, match: /^[a-fA-F0-9]{24}$/, immutable: true })
  internalAdGroupId?: string;

  @Prop({
    type: [String],
    match: /^[a-fA-F0-9]{24}$/,
    default: undefined,
    immutable: true,
  })
  internalProductIds?: string[];

  @Prop({ trim: true, minlength: 1, maxlength: 200, immutable: true })
  name?: string;

  @Prop({ enum: META_ADS_ODAX_OBJECTIVES, immutable: true })
  objective?: MetaAdsOdaxObjective;

  @Prop({ enum: ['PAUSED'], immutable: true })
  status?: 'PAUSED';

  @Prop({ enum: ['AUCTION'], immutable: true })
  buyingType?: 'AUCTION';

  @Prop({
    type: [String],
    enum: META_ADS_SPECIAL_AD_CATEGORIES,
    default: undefined,
    immutable: true,
  })
  specialAdCategories?: MetaAdsSpecialAdCategory[];

  @Prop({
    type: [String],
    match: /^[A-Z]{2}$/,
    default: undefined,
    immutable: true,
  })
  specialAdCategoryCountries?: string[];

  @Prop({ enum: META_ADS_BUDGET_MODES, immutable: true })
  budgetMode?: MetaAdsBudgetMode;

  @Prop({ enum: META_ADS_BUDGET_TYPES, immutable: true })
  budgetType?: MetaAdsBudgetType;

  @Prop({
    type: Number,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    immutable: true,
  })
  dailyBudgetVnd?: number;

  @Prop({
    type: Number,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    immutable: true,
  })
  lifetimeBudgetVnd?: number;

  @Prop({ enum: META_ADS_BID_STRATEGIES, immutable: true })
  bidStrategy?: MetaAdsBidStrategy;

  @Prop({
    type: Number,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    immutable: true,
  })
  bidAmountVnd?: number;

  @Prop({
    type: Number,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    immutable: true,
  })
  spendCapVnd?: number;

  @Prop({ trim: true, immutable: true })
  startTime?: string;

  @Prop({ trim: true, immutable: true })
  stopTime?: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  appId?: string;

  @Prop({ enum: META_ADS_OPTIMIZATION_GOALS, immutable: true })
  optimizationGoal?: MetaAdsOptimizationGoal;

  @Prop({ enum: META_ADS_BILLING_EVENTS, immutable: true })
  billingEvent?: MetaAdsBillingEvent;

  @Prop({ enum: META_ADS_DESTINATION_TYPES, immutable: true })
  destinationType?: MetaAdsDestinationType;

  @Prop({ type: [String], match: /^[A-Z]{2}$/, default: undefined, immutable: true })
  targetingCountries?: string[];

  @Prop({ type: Number, min: 18, max: 65, immutable: true })
  ageMin?: number;

  @Prop({ type: Number, min: 18, max: 65, immutable: true })
  ageMax?: number;

  @Prop({ type: [Number], enum: [1, 2], default: undefined, immutable: true })
  genders?: Array<1 | 2>;

  @Prop({
    type: [String],
    enum: META_ADS_PUBLISHER_PLATFORMS,
    default: undefined,
    immutable: true,
  })
  publisherPlatforms?: MetaAdsPublisherPlatform[];

  @Prop({
    type: [String],
    enum: META_ADS_FACEBOOK_POSITIONS,
    default: undefined,
    immutable: true,
  })
  facebookPositions?: MetaAdsFacebookPosition[];

  @Prop({
    type: [String],
    enum: META_ADS_INSTAGRAM_POSITIONS,
    default: undefined,
    immutable: true,
  })
  instagramPositions?: MetaAdsInstagramPosition[];

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  pageId?: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  instagramActorId?: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  pixelId?: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  applicationId?: string;

  @Prop({ trim: true, maxlength: 2048, immutable: true })
  objectStoreUrl?: string;

  @Prop({ enum: META_ADS_CUSTOM_EVENT_TYPES, immutable: true })
  customEventType?: MetaAdsCustomEventType;

  @Prop({ trim: true, minlength: 1, maxlength: 5000, immutable: true })
  message?: string;

  @Prop({ trim: true, minlength: 1, maxlength: 255, immutable: true })
  headline?: string;

  @Prop({ trim: true, minlength: 1, maxlength: 1000, immutable: true })
  description?: string;

  @Prop({ enum: META_ADS_CALL_TO_ACTION_TYPES, immutable: true })
  callToActionType?: MetaAdsCallToActionType;

  @Prop({ trim: true, maxlength: 2048, immutable: true })
  destinationUrl?: string;

  @Prop({ trim: true, match: /^[a-fA-F0-9]{32}$/, immutable: true })
  imageHash?: string;

  @Prop({ trim: true, match: /^\d{1,32}$/, immutable: true })
  videoId?: string;

  @Prop({ trim: true, maxlength: 2048, immutable: true })
  urlTags?: string;

  @Prop({
    required: true,
    trim: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  })
  payloadHash: string;

  @Prop({
    required: true,
    enum: META_ADS_PLAN_STATUSES,
    default: 'pending_validation',
  })
  workflowStatus: MetaAdsPlanStatus;

  @Prop({
    required: true,
    enum: META_ADS_PROVIDER_VALIDATION_STATUSES,
    default: 'pending',
  })
  providerValidationStatus: MetaAdsProviderValidationStatus;

  @Prop({ type: Date })
  providerValidationStartedAt?: Date;

  @Prop({ type: Date })
  providerValidatedAt?: Date;

  @Prop({ type: Date })
  providerValidationExpiresAt?: Date;

  @Prop({ trim: true, match: /^[a-f0-9]{64}$/ })
  providerValidationPayloadHash?: string;

  @Prop({ trim: true, match: /^[a-f0-9]{64}$/ })
  providerValidationBeforeStateHash?: string;

  @Prop({ enum: ['v25.0'] })
  providerValidationGraphApiVersion?: 'v25.0';

  @Prop({ trim: true, maxlength: 160 })
  providerValidationCredentialReferenceId?: string;

  @Prop({ trim: true, maxlength: 240 })
  providerRequestId?: string;

  @Prop({ trim: true, maxlength: 120 })
  providerValidationErrorCode?: string;

  @Prop({ trim: true, maxlength: 1000 })
  providerValidationError?: string;

  @Prop({ trim: true })
  approvedByUserId?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ trim: true, maxlength: 500 })
  approvalNote?: string;

  @Prop({ trim: true })
  rejectedByUserId?: string;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ trim: true, maxlength: 500 })
  rejectionReason?: string;

  @Prop({ required: true, type: Number, min: 0, default: 0 })
  revision: number;
}

export const MetaAdsCanonicalActionSchema =
  SchemaFactory.createForClass(MetaAdsCanonicalAction);

@Schema({ collection: 'meta_ads_action_plans', timestamps: true, strict: 'throw' })
export class MetaAdsActionPlan {
  @Prop({ required: true, trim: true, immutable: true })
  planId: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 200, immutable: true })
  planName: string;

  @Prop({ required: true, trim: true, immutable: true, index: true })
  createdByUserId: string;

  @Prop({
    required: true,
    trim: true,
    immutable: true,
    enum: ['erp_ui', 'erp_automation'],
    default: 'erp_ui',
    index: true,
  })
  source: 'erp_ui' | 'erp_automation';

  @Prop({ trim: true, immutable: true, maxlength: 200 })
  evidenceSnapshotId?: string;

  @Prop({ trim: true, immutable: true, match: /^[a-f0-9]{64}$/ })
  evidenceSnapshotHash?: string;

  @Prop({ type: Date, immutable: true })
  evidenceSnapshotCapturedAt?: Date;

  @Prop({
    type: [MetaAdsCanonicalActionSchema],
    required: true,
    validate: {
      validator: (actions: MetaAdsCanonicalAction[]) =>
        Array.isArray(actions) && actions.length >= 1 && actions.length <= 50,
      message: 'Meta Ads action plan must contain between 1 and 50 actions.',
    },
  })
  actions: MetaAdsCanonicalAction[];

  @Prop({ required: true, type: Number, min: 0, default: 0 })
  revision: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MetaAdsActionPlanSchema =
  SchemaFactory.createForClass(MetaAdsActionPlan);

MetaAdsActionPlanSchema.index(
  { planId: 1 },
  { unique: true, name: 'uniq_meta_ads_action_plan_id' },
);
MetaAdsActionPlanSchema.index(
  { 'actions.actionId': 1 },
  { unique: true, name: 'uniq_meta_ads_action_id' },
);
MetaAdsActionPlanSchema.index(
  { 'actions.idempotencyKey': 1 },
  { unique: true, name: 'uniq_meta_ads_action_idempotency_key' },
);
MetaAdsActionPlanSchema.index(
  { 'actions.workflowStatus': 1, createdAt: -1 },
  { name: 'idx_meta_ads_action_workflow_status' },
);
MetaAdsActionPlanSchema.index(
  { 'actions.providerValidationExpiresAt': 1 },
  { name: 'idx_meta_ads_action_validation_expiry' },
);
