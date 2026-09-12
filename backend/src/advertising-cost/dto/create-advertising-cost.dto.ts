/**
 * DTO for creating advertising cost records.
 */
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAdvertisingCostDto {
  @IsOptional()
  @IsIn(['facebook', 'google', 'tiktok', 'zalo', 'other'])
  channel?: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  frequency?: number;

  @IsString()
  adGroupId: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  businessCenterId?: string;

  @IsOptional()
  @IsIn(['direct', 'bm', 'mcc', 'bc'])
  managementMode?: 'direct' | 'bm' | 'mcc' | 'bc';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  spentAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  cpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  cpc?: number;

  @IsOptional()
  @IsNumber()
  impressions?: number;

  @IsOptional()
  @IsNumber()
  clicks?: number;

  @IsOptional()
  @IsNumber()
  conversions?: number;

  @IsOptional()
  @IsNumber()
  allConversions?: number;

  @IsOptional()
  @IsNumber()
  conversionValue?: number;

  @IsOptional()
  @IsNumber()
  costPerConversion?: number;

  @IsOptional()
  @IsNumber()
  reach?: number;

  @IsOptional()
  @IsNumber()
  messagingConversationStarted7d?: number;

  @IsOptional()
  @IsNumber()
  costPerMessagingConversation?: number;

  @IsOptional()
  @IsNumber()
  messagingFirstReply?: number;
}
