/**
 * DTO for creating API tokens.
 */
import { IsEnum, IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class CreateApiTokenDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsString()
  token: string;

  @IsEnum(['facebook', 'zalo', 'google', 'tiktok', 'other'])
  provider: 'facebook' | 'zalo' | 'google' | 'tiktok' | 'other';

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsEnum(['system_settings', 'business_center', 'ad_account', 'refresh_token', 'access_token', 'other'])
  tokenType?: 'system_settings' | 'business_center' | 'ad_account' | 'refresh_token' | 'access_token' | 'other';

  @IsOptional()
  @IsMongoId()
  fanpageId?: string;

  @IsOptional()
  @IsString()
  adAccountId?: string;

  @IsOptional()
  @IsString()
  adAccountName?: string;

  @IsOptional()
  @IsString()
  businessCenterId?: string;

  @IsOptional()
  @IsString()
  businessCenterName?: string;

  @IsOptional()
  @IsMongoId()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
