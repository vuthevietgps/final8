import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WindsorAdsResourceDocument = HydratedDocument<WindsorAdsResource>;

@Schema({ collection: 'windsor_ads_resources', timestamps: true })
export class WindsorAdsResource {
  @Prop({ type: Types.ObjectId, ref: 'ProviderConnection', required: true, index: true })
  connectionId: Types.ObjectId;

  @Prop({ required: true, enum: ['google'], index: true }) provider: 'google';
  @Prop({ required: true, enum: ['google_ads'] }) connector: 'google_ads';
  @Prop({ required: true, enum: ['account', 'campaign', 'ad_group'], index: true })
  resourceType: 'account' | 'campaign' | 'ad_group';
  @Prop({ required: true, trim: true, match: /^\d+$/, index: true }) accountId: string;
  @Prop({ required: true, trim: true, match: /^\d+$/, index: true }) providerId: string;
  @Prop({ trim: true, match: /^\d+$/ }) campaignId?: string;
  @Prop({ trim: true, maxlength: 500 }) name?: string;
  @Prop({ trim: true, maxlength: 100 }) status?: string;
  @Prop({ trim: true, maxlength: 100 }) resourceSubtype?: string;
  @Prop({ trim: true, uppercase: true, match: /^[A-Z]{3}$/ }) currency?: string;
  @Prop({ trim: true, maxlength: 100 }) timezone?: string;
  @Prop({ trim: true, match: /^\d+$/ }) campaignBudgetId?: string;
  @Prop({ required: true, trim: true }) lastSyncRunId: string;
  @Prop({ type: Date, required: true, index: true }) lastSeenAt: Date;
}

export const WindsorAdsResourceSchema = SchemaFactory.createForClass(WindsorAdsResource);
WindsorAdsResourceSchema.index(
  { connectionId: 1, resourceType: 1, accountId: 1, providerId: 1 },
  { unique: true, name: 'uniq_windsor_ads_resource_scope' },
);
WindsorAdsResourceSchema.index(
  { provider: 1, accountId: 1, resourceType: 1, status: 1 },
  { name: 'idx_windsor_ads_resource_status' },
);
