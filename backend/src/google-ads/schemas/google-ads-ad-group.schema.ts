import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsAdGroupDocument = HydratedDocument<GoogleAdsAdGroup>;

@Schema({ collection: 'google_ads_ad_groups', timestamps: true })
export class GoogleAdsAdGroup {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  adGroupId: string;

  @Prop({ required: true, trim: true, match: /^customers\/\d+\/adGroups\/\d+$/ })
  resourceName: string;

  @Prop({ trim: true })
  adGroupName?: string;

  @Prop({ trim: true })
  status?: string;

  @Prop({ trim: true })
  type?: string;

  @Prop({ type: Number, min: 0 })
  cpcBidMicros?: number;

  @Prop({ trim: true })
  internalAdGroupId?: string;

  @Prop({ type: [String], default: [] })
  internalProductIds: string[];

  @Prop({ type: Date })
  lastSyncAt?: Date;
}

export const GoogleAdsAdGroupSchema = SchemaFactory.createForClass(GoogleAdsAdGroup);

GoogleAdsAdGroupSchema.index(
  { customerId: 1, adGroupId: 1 },
  { unique: true, name: 'uniq_google_ads_ad_group_customer_ad_group' },
);
GoogleAdsAdGroupSchema.index(
  { resourceName: 1 },
  { unique: true, name: 'uniq_google_ads_ad_group_resource_name' },
);
GoogleAdsAdGroupSchema.index(
  { customerId: 1, campaignId: 1, status: 1 },
  { name: 'idx_google_ads_ad_group_campaign_status' },
);
GoogleAdsAdGroupSchema.index(
  { internalAdGroupId: 1 },
  { sparse: true, name: 'idx_google_ads_ad_group_internal_mapping' },
);
