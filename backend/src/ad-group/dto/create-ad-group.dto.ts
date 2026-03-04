/**
 * File: ad-group/dto/create-ad-group.dto.ts
 * Mục đích: DTO tạo mới Nhóm Quảng Cáo (tối giản, không AI/khuyến mại)
 */
import { IsBoolean, IsEnum, IsMongoId, IsOptional, IsString, Length, IsArray, IsNumber, Min, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class CreateAdGroupDto {
  @IsString()
  @Length(2, 200)
  name: string;

  @IsString()
  @Length(1, 200)
  adGroupId: string;

  // Tham chiếu entities chính
  @IsMongoId()
  fanpageId: string;

  @IsMongoId()
  productCategoryId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @IsMongoId({ each: true })
  selectedProducts: string[];

  @IsMongoId()
  agentId: string;

  @IsMongoId()
  adAccountId: string;

  // Nội dung và mô tả
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  // Cấu hình quảng cáo
  @IsEnum(['facebook', 'google', 'tiktok'])
  platform: 'facebook' | 'google' | 'tiktok';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  // Cấu hình webhook
  @IsOptional()
  @IsBoolean()
  enableWebhook?: boolean;

  // Auto control (tự dừng theo ngưỡng)
  @IsOptional() @IsBoolean()
  autoControlEnabled?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  spendThresholdDaily?: number; // VND

  @IsOptional() @IsNumber() @Min(0)
  cprThresholdDaily?: number; // VND / conversation

  @IsOptional() @IsNumber() @Min(0)
  minConversations?: number;
}
