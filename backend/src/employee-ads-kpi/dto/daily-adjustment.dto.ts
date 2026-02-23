/**
 * DTOs for Daily Budget Adjustment
 */
import { IsString, IsNumber, IsOptional, IsBoolean, Min, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO để confirm một adjustment
 */
export class ConfirmAdjustmentDto {
  @IsNumber()
  @Min(0)
  confirmedBudget: number; // Budget đã set trên platform

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO để bulk confirm nhiều adjustments
 */
export class BulkConfirmDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkConfirmItem)
  items: BulkConfirmItem[];
}

export class BulkConfirmItem {
  @IsString()
  adGroupId: string;

  @IsNumber()
  @Min(0)
  confirmedBudget: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO để query daily suggestions
 */
export class GetDailySuggestionsDto {
  @IsOptional()
  @IsString()
  date?: string; // YYYY-MM-DD, default: today

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(['facebook', 'google', 'tiktok'])
  platform?: 'facebook' | 'google' | 'tiktok';

  @IsOptional()
  @IsBoolean()
  confirmedOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  unconfirmedOnly?: boolean;
}
