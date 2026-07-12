import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CreativeAssetDocument = HydratedDocument<CreativeAsset>;

export const CREATIVE_ASSET_TYPES = ['image', 'video', 'carousel', 'text', 'landing_page', 'other'] as const;
export const CREATIVE_STATUSES = ['draft', 'approved', 'active', 'paused', 'archived'] as const;

export type CreativeAssetType = (typeof CREATIVE_ASSET_TYPES)[number];
export type CreativeStatus = (typeof CREATIVE_STATUSES)[number];

@Schema({ collection: 'creative_assets', timestamps: true })
export class CreativeAsset {
  @Prop({ required: true, trim: true, unique: true, index: true })
  creativeId: string;

  @Prop({ type: String, enum: ['facebook', 'google', 'tiktok', 'zalo', 'other'], required: true, index: true })
  platform: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';

  @Prop({ trim: true })
  name?: string;

  @Prop({ type: String, enum: CREATIVE_ASSET_TYPES, default: 'other', index: true })
  assetType: CreativeAssetType;

  @Prop({ trim: true })
  assetUrl?: string;

  @Prop({ trim: true })
  thumbnailUrl?: string;

  @Prop({ trim: true })
  caption?: string;

  @Prop({ trim: true })
  headline?: string;

  @Prop({ trim: true })
  cta?: string;

  @Prop({ trim: true })
  audience?: string;

  @Prop({ trim: true })
  landingPage?: string;

  @Prop({ type: [String], default: [], index: true })
  adGroupIds: string[];

  @Prop({ trim: true, index: true })
  campaignId?: string;

  @Prop({ trim: true, index: true })
  adSetId?: string;

  @Prop({ trim: true, index: true })
  adId?: string;

  @Prop({ type: String, enum: CREATIVE_STATUSES, default: 'draft', index: true })
  status: CreativeStatus;

  @Prop({ trim: true })
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Object })
  raw?: Record<string, any>;
}

export const CreativeAssetSchema = SchemaFactory.createForClass(CreativeAsset);

CreativeAssetSchema.index({ platform: 1, status: 1, updatedAt: -1 });
CreativeAssetSchema.index({ adGroupIds: 1, status: 1 });
