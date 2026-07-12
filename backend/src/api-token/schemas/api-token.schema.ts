/**
 * Schema: ApiToken
 * Purpose: Store provider tokens and lightweight lifecycle metadata.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ApiTokenDocument = ApiToken & Document;

@Schema({ timestamps: true })
export class ApiToken {
  @Prop({ required: true, trim: true }) name: string;
  /** Legacy read-only field; new writes use tokenEnc and migration unsets this value. */
  @Prop({ trim: true, required: false, select: false }) token?: string;
  @Prop({ trim: true, required: false }) tokenEnc?: string;
  @Prop({ trim: true, index: true }) tokenHash?: string;
  @Prop({ trim: true, required: false }) providerConfigEnc?: string;
  @Prop({ enum: ['facebook', 'zalo', 'google', 'tiktok', 'other'], default: 'facebook', index: true })
  provider: 'facebook' | 'zalo' | 'google' | 'tiktok' | 'other';
  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';
  @Prop({ enum: ['system_settings', 'business_center', 'ad_account', 'refresh_token', 'access_token', 'other'], default: 'access_token', index: true })
  tokenType?: 'system_settings' | 'business_center' | 'ad_account' | 'refresh_token' | 'access_token' | 'other';
  @Prop({ type: Types.ObjectId, ref: 'Fanpage' }) fanpageId?: Types.ObjectId;
  @Prop({ trim: true, index: true }) adAccountId?: string;
  @Prop({ trim: true }) adAccountName?: string;
  @Prop({ trim: true, index: true }) businessCenterId?: string;
  @Prop({ trim: true }) businessCenterName?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) ownerUserId?: Types.ObjectId;
  @Prop({ trim: true }) ownerName?: string;
  @Prop({ trim: true }) notes?: string;
  @Prop({ default: false, index: true }) isPrimary: boolean;
  @Prop() expireAt?: Date;
  @Prop() lastCheckedAt?: Date;
  @Prop({ enum: ['valid', 'invalid', 'expired'], required: false })
  lastCheckStatus?: 'valid' | 'invalid' | 'expired';
  @Prop({ trim: true }) lastCheckMessage?: string;
  @Prop({ default: 0 }) consecutiveFail?: number;
  @Prop({ default: false }) degraded?: boolean;
  @Prop({ type: Types.ObjectId, ref: 'ApiToken' }) rotatedFrom?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'ApiToken' }) rotatedTo?: Types.ObjectId;
  @Prop([String]) scopes?: string[];
  @Prop() nextCheckAt?: Date;
  @Prop() lastUsedAt?: Date;
}

export const ApiTokenSchema = SchemaFactory.createForClass(ApiToken);
ApiTokenSchema.index({ provider: 1, status: 1 });
ApiTokenSchema.index({ fanpageId: 1, isPrimary: 1 });
ApiTokenSchema.index({ nextCheckAt: 1 });
ApiTokenSchema.index({ adAccountId: 1, provider: 1 });
ApiTokenSchema.index({ businessCenterId: 1, provider: 1 });
ApiTokenSchema.index(
  { provider: 1, tokenType: 1, adAccountId: 1, isPrimary: 1 },
  {
    sparse: true,
    name: 'idx_api_token_provider_account_profile_primary',
  },
);
ApiTokenSchema.index(
  { provider: 1, tokenType: 1, businessCenterId: 1, isPrimary: 1 },
  {
    sparse: true,
    name: 'idx_api_token_provider_business_profile_primary',
  },
);
ApiTokenSchema.index(
  { provider: 1, tokenType: 1, ownerUserId: 1 },
  { name: 'idx_api_token_provider_owner_profile' },
);
