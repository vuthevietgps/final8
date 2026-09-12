import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { META_ADS_ACTION_TYPES, MetaAdsActionType } from '../meta-ads.types';

export type MetaAdsExecutionReservationDocument = HydratedDocument<MetaAdsExecutionReservation>;

export type MetaAdsExecutionReservationStatus =
  | 'reserved'
  | 'provider_call_started'
  | 'provider_outcome_unknown'
  | 'provider_failed_definitive'
  | 'provider_mutation_succeeded'
  | 'reconciled';

@Schema({ collection: 'meta_ads_execution_reservations', timestamps: true })
export class MetaAdsExecutionReservation {
  @Prop({ required: true, trim: true })
  idempotencyKey: string;

  @Prop({ required: true, trim: true, index: true })
  planId: string;

  @Prop({ required: true, trim: true, index: true })
  actionId: string;

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

  @Prop({
    required: true,
    enum: [
      'reserved',
      'provider_call_started',
      'provider_outcome_unknown',
      'provider_failed_definitive',
      'provider_mutation_succeeded',
      'reconciled',
    ],
    index: true,
  })
  status: MetaAdsExecutionReservationStatus;

  @Prop({ required: true, trim: true })
  payloadHash: string;

  @Prop({ required: true, trim: true })
  validationBeforeStateHash: string;

  @Prop({ required: true, trim: true })
  executedByUserId: string;

  @Prop({ trim: true })
  approvedByUserId?: string;

  @Prop({ trim: true })
  credentialReferenceId?: string;

  @Prop({ type: Date })
  providerCallStartedAt?: Date;

  @Prop({ type: Date })
  providerRespondedAt?: Date;

  @Prop({ trim: true })
  providerRequestId?: string;

  @Prop({ type: Date })
  reconciledAt?: Date;
}

export const MetaAdsExecutionReservationSchema = SchemaFactory.createForClass(
  MetaAdsExecutionReservation,
);

MetaAdsExecutionReservationSchema.index(
  { idempotencyKey: 1 },
  { unique: true, name: 'uniq_meta_ads_execution_reservation_idempotency_key' },
);
MetaAdsExecutionReservationSchema.index(
  { status: 1, updatedAt: -1 },
  { name: 'idx_meta_ads_execution_reservation_status_date' },
);
