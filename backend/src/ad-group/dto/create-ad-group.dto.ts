/**
 * DTO for creating ad groups.
 */
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const emptyStringToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value === 'string' && !value.trim()) return undefined;
  return value;
};

export class CreateAdGroupDto {
  @IsString()
  @Length(2, 200)
  name: string;

  @IsString()
  @Length(1, 200)
  adGroupId: string;

  @IsMongoId()
  fanpageId: string;

  @IsOptional()
  @IsMongoId()
  productCategoryId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1)
  @IsMongoId({ each: true })
  selectedProducts?: string[];

  @IsMongoId()
  agentId: string;

  @IsMongoId()
  adAccountId: string;

  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsMongoId()
  assignedEmployeeId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsEnum(['facebook', 'google', 'tiktok'])
  platform: 'facebook' | 'google' | 'tiktok';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  enableWebhook?: boolean;

  @IsOptional()
  @IsBoolean()
  autoControlEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  spendThresholdDaily?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cprThresholdDaily?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minConversations?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyBudget?: number;

  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 200)
  campaignBudgetId?: string;

  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 300)
  campaignBudgetResourceName?: string;

  @IsOptional()
  @IsEnum(['TESTING', 'GROWTH', 'MATURE', 'STABLE'])
  testingPhase?: 'TESTING' | 'GROWTH' | 'MATURE' | 'STABLE';

  @IsOptional()
  @IsNumber()
  @Min(0)
  daysSinceLaunch?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  frequency?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reach?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  audienceSize?: number;

  @IsOptional()
  @IsBoolean()
  preferHorizontalScaling?: boolean;
}
