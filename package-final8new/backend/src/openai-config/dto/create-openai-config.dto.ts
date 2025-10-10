/**
 * File: openai-config/dto/create-openai-config.dto.ts
 * Mục đích: DTO validation cho tạo mới cấu hình OpenAI
 * Chức năng: Validate dữ liệu đầu vào khi tạo config
 */
import { IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Length, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOpenAIConfigDto {
  @IsString() @Length(1,200) name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() model: string;
  @IsString() apiKey: string;
  @IsString() systemPrompt: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(4000) maxTokens?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2) temperature?: number;
  @IsEnum(['global','fanpage','adgroup','messageScope']) scopeType: 'global' | 'fanpage' | 'adgroup' | 'messageScope';
  @IsOptional() @IsMongoId() scopeRef?: string;
  @IsOptional() @IsEnum(['active','inactive']) status?: 'active' | 'inactive';
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
