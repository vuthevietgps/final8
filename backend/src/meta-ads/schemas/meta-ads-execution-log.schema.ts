import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MetaAdsExecutionReservation } from './meta-ads-execution-reservation.schema';
import { META_ADS_ACTION_TYPES, MetaAdsActionType } from '../meta-ads.types';

export type MetaAdsExecutionLogDocument = HydratedDocument<MetaAdsExecutionLog>;

export type MetaAdsExecutionLogStatus =
  | 'dry_run'
  | 'executing'
  | 'provider_outcome_unknown'
  | 'provider_failed_definitive'
  | 'provider_mutation_succeeded'
  | 'reconciled';

@Schema({ collection: 'meta_ads_execution_logs', timestamps: true })
export class MetaAdsExecutionLog {
  @Prop({ required: true, trim: true, index: true })
  planId: string;

  @Prop({ required: true, trim: true, index: true })
  actionId: string;

  @Prop({ required: true, trim: true, index: true })
  idempotencyKey: string;

  @Prop({ type: Types.ObjectId, ref: MetaAdsExecutionReservation.name, index: true })
  reservationId?: Types.ObjectId;

  @Prop({ required: true, enum: META_ADS_ACTION_TYPES, index: true })
  actionType: MetaAdsActionType;

  @Prop({ required: true, trim: true, index: true })
  adAccountId: string;

  @Prop({ trim: true, index: true })
  campaignId?: string;

  @Prop({ trim: true, index: true })
  adSetId?: string;

  @Prop({ trim: true, index: true })
  creativeId?: string;

  @Prop({ trim: true, index: true })
  adId?: string;

  @Prop({ trim: true, index: true })
  resourceId?: string;

  @Prop({ required: true, enum: [
    'dry_run',
    'executing',
    'provider_outcome_unknown',
    'provider_failed_definitive',
    'provider_mutation_succeeded',
    'reconciled',
  ], index: true })
  status: MetaAdsExecutionLogStatus;

  @Prop({ required: true, trim: true })
  payloadHash: string;

  @Prop({ trim: true })
  validationBeforeStateHash?: string;

  @Prop({ trim: true })
  executionBeforeStateHash?: string;

  @Prop({ trim: true })
  graphApiVersion?: string;

  @Prop({ trim: true })
  credentialReferenceId?: string;

  @Prop({ trim: true })
  approvedByUserId?: string;

  @Prop({ required: true, trim: true })
  executedByUserId: string;

  @Prop({ type: Object })
  beforeState?: Record<string, unknown>;

  @Prop({ type: Object })
  providerResponse?: Record<string, unknown>;

  @Prop({ type: Object })
  afterState?: Record<string, unknown>;

  @Prop({ trim: true })
  providerRequestId?: string;

  @Prop({ type: [Object], default: [] })
  providerErrors: Array<{ code?: string; message: string }>;

  @Prop({ type: Date, default: Date.now, index: true })
  executedAt: Date;

  @Prop({ type: Date })
  reconciledAt?: Date;
}

export const MetaAdsExecutionLogSchema = SchemaFactory.createForClass(MetaAdsExecutionLog);

MetaAdsExecutionLogSchema.index(
  { planId: 1, executedAt: -1 },
  { name: 'idx_meta_ads_execution_log_plan_date' },
);
MetaAdsExecutionLogSchema.index(
  { idempotencyKey: 1, executedAt: -1 },
  { name: 'idx_meta_ads_execution_log_idempotency_date' },
);
