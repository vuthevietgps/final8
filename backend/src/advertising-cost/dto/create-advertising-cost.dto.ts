/**
 * DTO for creating advertising cost records.
 */
import { IsDateString, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

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
  spentAmount?: number;

  @IsOptional()
  @IsNumber()
  cpm?: number;

  @IsOptional()
  @IsNumber()
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
