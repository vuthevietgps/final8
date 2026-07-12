import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CREATIVE_ASSET_TYPES, CREATIVE_STATUSES } from '../schemas/creative-asset.schema';
import { MARKETING_LEAD_STATUSES } from '../schemas/marketing-lead.schema';

export class DateWindowQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(90)
  lookbackDays?: number;
}

export class LeadFunnelQueryDto extends DateWindowQueryDto {
  @IsOptional()
  @IsString()
  adGroupId?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

export class CreateMarketingLeadDto {
  @IsOptional()
  @IsString()
  sourceLeadKey?: string;

  @IsIn(['facebook', 'google', 'tiktok', 'zalo', 'other'])
  sourcePlatform: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';

  @IsOptional()
  @IsDateString()
  leadCreatedAt?: string;

  @IsOptional()
  @IsString()
  fanpageId?: string;

  @IsOptional()
  @IsString()
  adAccountId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  adSetId?: string;

  @IsOptional()
  @IsString()
  adId?: string;

  @IsOptional()
  @IsString()
  adGroupId?: string;

  @IsOptional()
  @IsString()
  creativeId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  senderPsid?: string;

  @IsOptional()
  @IsMongoId()
  assignedSaleId?: string;

  @IsOptional()
  @IsIn(MARKETING_LEAD_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  firstResponseAt?: string;

  @IsOptional()
  @IsDateString()
  lastFollowUpAt?: string;

  @IsOptional()
  @IsString()
  qualificationReason?: string;

  @IsOptional()
  @IsString()
  lostReason?: string;
}

export class SyncLeadsDto extends DateWindowQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10000)
  limit?: number;
}

export class UpdateMarketingLeadDto {
  @IsOptional()
  @IsIn(MARKETING_LEAD_STATUSES)
  status?: string;

  @IsOptional()
  @IsMongoId()
  assignedSaleId?: string;

  @IsOptional()
  @IsDateString()
  firstResponseAt?: string;

  @IsOptional()
  @IsDateString()
  lastFollowUpAt?: string;

  @IsOptional()
  @IsString()
  qualificationReason?: string;

  @IsOptional()
  @IsString()
  lostReason?: string;

  @IsOptional()
  @IsString()
  adGroupId?: string;
}

export class GenerateAdsPlanDto extends DateWindowQueryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudgetIncreasePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudgetDecreasePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1000000)
  minRoi?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minLeadsForSaleIssue?: number;
}

export class ListPlansQueryDto extends DateWindowQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ApprovePlanItemDto {
  @IsBoolean()
  approved: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  confirmedTargetValue?: number;
}

export class ApplyPlanDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(14)
  evaluationDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}

export class DirectAdGroupActionDto {
  @IsIn(['pause', 'resume', 'set_budget'])
  action: 'pause' | 'resume' | 'set_budget';

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetBudget?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class EvaluationQueryDto extends DateWindowQueryDto {
  @IsOptional()
  @IsString()
  adGroupId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  refresh?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateCreativeAssetDto {
  @IsString()
  creativeId: string;

  @IsIn(['facebook', 'google', 'tiktok', 'zalo', 'other'])
  platform: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(CREATIVE_ASSET_TYPES)
  assetType?: string;

  @IsOptional()
  @IsString()
  assetUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  cta?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  landingPage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adGroupIds?: string[];

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  adSetId?: string;

  @IsOptional()
  @IsString()
  adId?: string;

  @IsOptional()
  @IsIn(CREATIVE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCreativeAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(CREATIVE_ASSET_TYPES)
  assetType?: string;

  @IsOptional()
  @IsString()
  assetUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  cta?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  landingPage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adGroupIds?: string[];

  @IsOptional()
  @IsIn(CREATIVE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreativePerformanceQueryDto extends DateWindowQueryDto {
  @IsOptional()
  @IsString()
  creativeId?: string;

  @IsOptional()
  @IsString()
  adGroupId?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
