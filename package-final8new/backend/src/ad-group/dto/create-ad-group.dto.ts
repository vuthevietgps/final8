/**
 * File: ad-group/dto/create-ad-group.dto.ts
 * Mục đích: DTO cho tạo mới Nhóm Quảng Cáo với tích hợp chatbot
 * Chức năng: Validation cho tạo ad group với fanpage, products, scripts và AI config
 */
import { IsBoolean, IsEnum, IsMongoId, IsOptional, IsString, Length, IsArray, IsNumber, Min, Max, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// DTO cho script chat
export class ChatScriptDto {
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  greeting?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  upsellHint?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  closing?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  attributes?: string;
}

// DTO cho chương trình discount
export class DiscountProgramDto {
  @IsOptional()
  @IsString()
  @Length(0, 200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  conditions?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

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

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  selectedProducts?: string[];

  @IsOptional()
  @IsMongoId()
  openAIConfigId?: string;

  @IsMongoId()
  agentId: string;

  @IsMongoId()
  adAccountId: string;

  // Nội dung và mô tả
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatScriptDto)
  chatScript?: ChatScriptDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountProgramDto)
  discount?: DiscountProgramDto;

  // Cấu hình quảng cáo
  @IsEnum(['facebook', 'google', 'ticktock'])
  platform: 'facebook' | 'google' | 'ticktock';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  // Cấu hình webhook và AI
  @IsOptional()
  @IsBoolean()
  enableWebhook?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAIChat?: boolean;
}
