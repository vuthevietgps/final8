import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdsManagerProvider = 'google' | 'facebook' | 'tiktok';
export type AdsManagerAccountType =
  | 'google_ads_mcc'
  | 'meta_business_manager'
  | 'tiktok_business_center';
export type AdsManagerVaultProvider =
  | 'pending'
  | 'erp_secret_store'
  | 'external_vault'
  | 'env_reference';
export type AdsManagerCredentialStatus =
  | 'missing'
  | 'metadata_ready'
  | 'ready_for_import'
  | 'blocked'
  | 'revoked';
export type AdsManagerReadinessStatus =
  | 'not_configured'
  | 'ready_for_import'
  | 'needs_mapping'
  | 'blocked';
export type AdsManagerProviderVerificationStatus =
  | 'never_verified'
  | 'verified'
  | 'failed'
  | 'unsupported';

export interface AdsManagerVerifiedChildAccount {
  accountId: string;
  name: string;
  currency: string;
  timezoneId: string;
  status: string;
}

export type AdsManagerAccountDocument = AdsManagerAccount & Document;

@Schema({ timestamps: true, collection: 'ads_manager_accounts' })
export class AdsManagerAccount {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ required: true, enum: ['google', 'facebook', 'tiktok'], index: true })
  provider: AdsManagerProvider;

  @Prop({
    required: true,
    enum: ['google_ads_mcc', 'meta_business_manager', 'tiktok_business_center'],
    index: true,
  })
  managerAccountType: AdsManagerAccountType;

  @Prop({ required: true, trim: true, index: true })
  managerAccountId: string;

  @Prop({ trim: true })
  managerAccountName?: string;

  @Prop({
    enum: ['pending', 'erp_secret_store', 'external_vault', 'env_reference'],
    default: 'pending',
    index: true,
  })
  vaultProvider: AdsManagerVaultProvider;

  @Prop({ trim: true, default: 'pending_secret_store_onboarding' })
  secretReferenceHandle: string;

  @Prop({ trim: true })
  credentialReferenceId?: string;

  @Prop({
    enum: ['missing', 'metadata_ready', 'ready_for_import', 'blocked', 'revoked'],
    default: 'missing',
    index: true,
  })
  credentialStatus: AdsManagerCredentialStatus;

  @Prop({ type: [String], default: [] })
  requiredScopes: string[];

  @Prop({ type: [String], default: [] })
  grantedScopes: string[];

  @Prop({ type: [String], default: [] })
  childAccountIds: string[];

  @Prop({ type: [String], default: [] })
  blockers: string[];

  @Prop({ type: [String], default: [] })
  warnings: string[];

  @Prop({
    enum: ['not_configured', 'ready_for_import', 'needs_mapping', 'blocked'],
    default: 'not_configured',
    index: true,
  })
  readinessStatus: AdsManagerReadinessStatus;

  @Prop({ default: false })
  canDiscoverChildren: boolean;

  @Prop({ default: false })
  canImportReadOnly: boolean;

  @Prop({ default: false })
  canUseForFutureValidateOnly: boolean;

  @Prop({ default: false })
  canUseForFutureExecution: boolean;

  @Prop({ default: false })
  productionReady: boolean;

  @Prop({ default: false })
  executionAllowedNow: boolean;

  @Prop({ default: false })
  providerApiCalled: boolean;

  @Prop({
    enum: ['never_verified', 'verified', 'failed', 'unsupported'],
    default: 'never_verified',
    index: true,
  })
  providerVerificationStatus: AdsManagerProviderVerificationStatus;

  @Prop({ default: false })
  runtimeCredentialResolved: boolean;

  @Prop({ default: false })
  providerConnectionVerified: boolean;

  @Prop({ default: false })
  childAccountsVerifiedByProvider: boolean;

  @Prop({ type: [String], default: [] })
  providerVerifiedScopes: string[];

  @Prop({
    type: [{
      _id: false,
      accountId: { type: String, required: true },
      name: { type: String, required: true },
      currency: { type: String, required: true },
      timezoneId: { type: String, required: true },
      status: { type: String, required: true },
    }],
    default: [],
  })
  verifiedChildAccounts: AdsManagerVerifiedChildAccount[];

  @Prop()
  providerVerifiedAt?: Date;

  @Prop()
  providerVerificationExpiresAt?: Date;

  @Prop()
  providerVerificationFailedAt?: Date;

  @Prop({ trim: true })
  providerVerificationError?: string;

  @Prop({ trim: true })
  providerVerifiedByUserId?: string;

  @Prop({ default: false })
  validateOnlyCalled: boolean;

  @Prop({ default: false })
  liveAdsExecutionUsed: boolean;

  @Prop({ default: false })
  realCredentialMaterialPresent: boolean;

  @Prop({ default: false })
  plaintextSecretsAdded: boolean;

  @Prop({ type: [String], default: [] })
  supportedMvpActions: string[];

  @Prop({ type: [String], default: [] })
  blockedCapabilities: string[];

  @Prop()
  lastCredentialMetadataAt?: Date;

  @Prop()
  lastDiscoveryAt?: Date;

  @Prop()
  lastImportAt?: Date;

  @Prop()
  lastMappingAuditAt?: Date;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const AdsManagerAccountSchema = SchemaFactory.createForClass(AdsManagerAccount);

AdsManagerAccountSchema.index(
  { provider: 1, managerAccountType: 1, managerAccountId: 1 },
  { unique: true, name: 'idx_ads_manager_account_provider_type_id' },
);
AdsManagerAccountSchema.index({ provider: 1, readinessStatus: 1 });
AdsManagerAccountSchema.index({ credentialStatus: 1, isActive: 1 });
AdsManagerAccountSchema.index({ providerVerificationStatus: 1, providerVerificationExpiresAt: 1 });
