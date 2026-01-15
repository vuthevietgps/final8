/**
 * File: advertising-cost/dto/create-advertising-cost.dto.ts
 * Mục đích: DTO tạo mới Chi Phí Quảng Cáo với validate.
 */
import { IsDateString, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAdvertisingCostDto {
  @IsOptional()
  @IsIn(['facebook', 'google', 'tiktok', 'zalo', 'other'])
  channel?: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';

  @IsOptional()
  @IsDateString()
  date?: string; // Định dạng ISO, frontend sẽ nhập mm/dd/yyyy rồi convert

  @IsOptional()
  @IsNumber()
  frequency?: number; // Không bắt buộc

  @IsString()
  adGroupId: string; // Bắt buộc

  @IsOptional()
  @IsNumber()
  spentAmount?: number;

  @IsOptional()
  @IsNumber()
  cpm?: number;

  @IsOptional()
  @IsNumber()
  cpc?: number;

  // === NEW MESSAGING METRICS ===
  @IsOptional()
  @IsNumber()
  impressions?: number;

  @IsOptional()
  @IsNumber()
  clicks?: number;

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
