/**
 * DTO for creating ad accounts.
 */
import { IsBoolean, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateAdAccountDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  accountId: string;

  @IsEnum(['facebook', 'google', 'tiktok', 'zalo', 'shopee', 'lazada'])
  accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada';

  @IsOptional()
  @IsEnum(['direct', 'bm', 'mcc', 'bc'])
  managementMode?: 'direct' | 'bm' | 'mcc' | 'bc';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  loginCustomerId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  businessCenterId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  businessCenterName?: string;

  @IsOptional()
  @IsMongoId()
  adsManagerUserId?: string;

  @IsOptional()
  @IsEnum(['system', 'account', 'manual'])
  tokenSource?: 'system' | 'account' | 'manual';
}
