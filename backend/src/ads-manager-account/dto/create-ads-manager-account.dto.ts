import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import type {
  AdsManagerAccountType,
  AdsManagerCredentialStatus,
  AdsManagerProvider,
  AdsManagerVaultProvider,
} from '../schemas/ads-manager-account.schema';

const SAFE_HANDLE_PATTERN = /^(pending_secret_store_onboarding|(?:erp-vault|vault|secret|env):\/\/[A-Za-z0-9._:\/-]+)$/;

export class CreateAdsManagerAccountDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name: string;

  @IsEnum(['google', 'facebook', 'tiktok'])
  provider: AdsManagerProvider;

  @IsEnum(['google_ads_mcc', 'meta_business_manager', 'tiktok_business_center'])
  managerAccountType: AdsManagerAccountType;

  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  managerAccountId: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  managerAccountName?: string;

  @IsOptional()
  @IsEnum(['pending', 'erp_secret_store', 'external_vault', 'env_reference'])
  vaultProvider?: AdsManagerVaultProvider;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  @Matches(SAFE_HANDLE_PATTERN, {
    message: 'secretReferenceHandle must be a vault/env reference handle or pending_secret_store_onboarding',
  })
  secretReferenceHandle?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  credentialReferenceId?: string;

  @IsOptional()
  @IsEnum(['missing', 'metadata_ready', 'ready_for_import', 'blocked', 'revoked'])
  credentialStatus?: AdsManagerCredentialStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  requiredScopes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  grantedScopes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  childAccountIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  blockers?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  warnings?: string[];

  @IsOptional()
  @IsISO8601()
  lastCredentialMetadataAt?: string;

  @IsOptional()
  @IsISO8601()
  lastDiscoveryAt?: string;

  @IsOptional()
  @IsISO8601()
  lastImportAt?: string;

  @IsOptional()
  @IsISO8601()
  lastMappingAuditAt?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
