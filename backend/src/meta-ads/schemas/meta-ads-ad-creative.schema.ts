import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MetaAdsAdCreativeDocument = HydratedDocument<MetaAdsAdCreative>;

@Schema({ collection: 'meta_ads_ad_creatives', timestamps: true })
export class MetaAdsAdCreative {
  @Prop({ required: true, trim: true, index: true })
  adAccountId: string;

  @Prop({ required: true, trim: true, index: true })
  creativeId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  pageId: string;

  @Prop({ trim: true, index: true })
  instagramActorId?: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ required: true, trim: true })
  headline: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, trim: true })
  callToActionType: string;

  @Prop({ required: true, trim: true })
  destinationUrl: string;

  @Prop({ trim: true })
  imageHash?: string;

  @Prop({ trim: true })
  videoId?: string;

  @Prop({ trim: true })
  urlTags?: string;

  @Prop({ type: Date, required: true, index: true })
  lastReadbackAt: Date;

  @Prop({ trim: true, index: true })
  sourcePlanId?: string;

  @Prop({ trim: true })
  sourceIdempotencyKey?: string;
}

export const MetaAdsAdCreativeSchema =
  SchemaFactory.createForClass(MetaAdsAdCreative);

MetaAdsAdCreativeSchema.index(
  { adAccountId: 1, creativeId: 1 },
  { unique: true, name: 'uniq_meta_ads_ad_creative_account_creative' },
);
MetaAdsAdCreativeSchema.index(
  { adAccountId: 1, lastReadbackAt: -1 },
  { name: 'idx_meta_ads_ad_creative_account_readback' },
);
