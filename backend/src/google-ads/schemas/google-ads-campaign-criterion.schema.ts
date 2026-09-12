import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsCampaignCriterionDocument = HydratedDocument<GoogleAdsCampaignCriterion>;

@Schema({ collection: 'google_ads_campaign_criteria', timestamps: true })
export class GoogleAdsCampaignCriterion {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignId: string;

  @Prop({ required: true, trim: true })
  resourceName: string;

  @Prop({ required: true, enum: ['LOCATION', 'LANGUAGE'] })
  criterionType: 'LOCATION' | 'LANGUAGE';

  @Prop({ type: Boolean, default: false })
  negative: boolean;

  @Prop({ trim: true })
  targetConstantId?: string;

  @Prop({ trim: true })
  status?: string;

  @Prop({ type: Date, required: true })
  lastSyncAt: Date;
}

export const GoogleAdsCampaignCriterionSchema = SchemaFactory.createForClass(
  GoogleAdsCampaignCriterion,
);

GoogleAdsCampaignCriterionSchema.index(
  { customerId: 1, resourceName: 1 },
  { unique: true, name: 'uniq_google_ads_campaign_criterion_resource' },
);
GoogleAdsCampaignCriterionSchema.index(
  { customerId: 1, campaignId: 1, criterionType: 1, negative: 1, status: 1 },
  { name: 'idx_google_ads_campaign_criterion_activation' },
);
