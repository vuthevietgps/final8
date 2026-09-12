import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MetaAdsAdDocument = HydratedDocument<MetaAdsAd>;

@Schema({ collection: 'meta_ads_ads', timestamps: true })
export class MetaAdsAd {
  @Prop({ required: true, trim: true, index: true })
  adAccountId: string;

  @Prop({ required: true, trim: true, index: true })
  adSetId: string;

  @Prop({ required: true, trim: true, index: true })
  creativeId: string;

  @Prop({ required: true, trim: true, index: true })
  adId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  status: string;

  @Prop({ trim: true, index: true })
  effectiveStatus?: string;

  @Prop({ type: Date })
  providerUpdatedAt?: Date;

  @Prop({ type: Date, required: true, index: true })
  lastReadbackAt: Date;

  @Prop({ trim: true, index: true })
  sourcePlanId?: string;

  @Prop({ trim: true })
  sourceIdempotencyKey?: string;
}

export const MetaAdsAdSchema = SchemaFactory.createForClass(MetaAdsAd);

MetaAdsAdSchema.index(
  { adAccountId: 1, adId: 1 },
  { unique: true, name: 'uniq_meta_ads_ad_account_ad' },
);
MetaAdsAdSchema.index(
  { adAccountId: 1, adSetId: 1, status: 1, lastReadbackAt: -1 },
  { name: 'idx_meta_ads_ad_ad_set_status_readback' },
);
