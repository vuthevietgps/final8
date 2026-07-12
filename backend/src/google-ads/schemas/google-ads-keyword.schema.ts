import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsKeywordDocument = HydratedDocument<GoogleAdsKeyword>;

@Schema({ collection: 'google_ads_keywords', timestamps: true })
export class GoogleAdsKeyword {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  adGroupId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  criterionId: string;

  @Prop({ required: true, trim: true, match: /^customers\/\d+\/adGroupCriteria\/\d+~\d+$/ })
  resourceName: string;

  @Prop({ required: true, trim: true })
  keywordText: string;

  @Prop({ required: true, trim: true, enum: ['EXACT', 'PHRASE', 'BROAD'] })
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';

  @Prop({ type: Boolean, default: false })
  negative: boolean;

  @Prop({ trim: true })
  status?: string;

  @Prop({ type: Number, min: 0, max: 10 })
  qualityScore?: number;

  @Prop({ type: Date })
  lastSyncAt?: Date;
}

export const GoogleAdsKeywordSchema = SchemaFactory.createForClass(GoogleAdsKeyword);

GoogleAdsKeywordSchema.index(
  { customerId: 1, adGroupId: 1, criterionId: 1 },
  { unique: true, name: 'uniq_google_ads_keyword_customer_ad_group_criterion' },
);
GoogleAdsKeywordSchema.index(
  { resourceName: 1 },
  { unique: true, name: 'uniq_google_ads_keyword_resource_name' },
);
GoogleAdsKeywordSchema.index(
  { customerId: 1, campaignId: 1, adGroupId: 1, status: 1 },
  { name: 'idx_google_ads_keyword_hierarchy_status' },
);
GoogleAdsKeywordSchema.index(
  { customerId: 1, keywordText: 1, matchType: 1 },
  { name: 'idx_google_ads_keyword_text_match_type' },
);
