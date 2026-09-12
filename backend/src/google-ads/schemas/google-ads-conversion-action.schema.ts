import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsConversionActionDocument =
  HydratedDocument<GoogleAdsConversionAction>;

@Schema({ collection: 'google_ads_conversion_actions', timestamps: true })
export class GoogleAdsConversionAction {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  conversionActionId: string;

  @Prop({
    required: true,
    trim: true,
    match: /^customers\/\d+\/conversionActions\/\d+$/,
  })
  resourceName: string;

  @Prop({ trim: true, match: /^\d+$/ })
  ownerCustomerId?: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ trim: true })
  status?: string;

  @Prop({ trim: true })
  type?: string;

  @Prop({ trim: true })
  category?: string;

  @Prop({ trim: true })
  origin?: string;

  @Prop({ type: Boolean })
  primaryForGoal?: boolean;

  @Prop({ type: Date })
  lastSyncAt?: Date;
}

export const GoogleAdsConversionActionSchema =
  SchemaFactory.createForClass(GoogleAdsConversionAction);

GoogleAdsConversionActionSchema.index(
  { customerId: 1, conversionActionId: 1 },
  { unique: true, name: 'uniq_google_ads_conversion_action_customer_action' },
);
GoogleAdsConversionActionSchema.index(
  { customerId: 1, category: 1, origin: 1, status: 1, primaryForGoal: 1 },
  { name: 'idx_google_ads_conversion_action_goal_readiness' },
);
