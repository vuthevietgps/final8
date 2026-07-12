import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsAdDocument = HydratedDocument<GoogleAdsAd>;

@Schema({ collection: 'google_ads_ads', timestamps: true })
export class GoogleAdsAd {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  adGroupId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  adId: string;

  @Prop({ required: true, trim: true, match: /^customers\/\d+\/adGroupAds\/\d+~\d+$/ })
  resourceName: string;

  @Prop({ trim: true, default: 'RESPONSIVE_SEARCH_AD' })
  adType: string;

  @Prop({ trim: true })
  status?: string;

  @Prop({ type: [Object], default: [] })
  headlines: Record<string, any>[];

  @Prop({ type: [Object], default: [] })
  descriptions: Record<string, any>[];

  @Prop({ type: [String], default: [] })
  finalUrls: string[];

  @Prop({ trim: true })
  path1?: string;

  @Prop({ trim: true })
  path2?: string;

  @Prop({ trim: true })
  policyApprovalStatus?: string;

  @Prop({ trim: true })
  policyReviewStatus?: string;

  @Prop({ trim: true })
  creativeAssetId?: string;

  @Prop({ type: Date })
  lastSyncAt?: Date;
}

export const GoogleAdsAdSchema = SchemaFactory.createForClass(GoogleAdsAd);

GoogleAdsAdSchema.index(
  { customerId: 1, adGroupId: 1, adId: 1 },
  { unique: true, name: 'uniq_google_ads_ad_customer_ad_group_ad' },
);
GoogleAdsAdSchema.index(
  { resourceName: 1 },
  { unique: true, name: 'uniq_google_ads_ad_resource_name' },
);
GoogleAdsAdSchema.index(
  { customerId: 1, campaignId: 1, adGroupId: 1, status: 1 },
  { name: 'idx_google_ads_ad_hierarchy_status' },
);
GoogleAdsAdSchema.index(
  { creativeAssetId: 1 },
  { sparse: true, name: 'idx_google_ads_ad_creative_mapping' },
);
