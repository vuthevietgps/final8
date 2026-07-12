import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BUSINESS_NOTE_SOURCES, BusinessNoteSource } from '../schemas/business-daily-note.schema';

export class CreateLandingPageDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url: string;

  @IsMongoId()
  productId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mainCta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  lastCheckedAt?: string;
}

export class UpdateLandingPageDto extends PartialType(CreateLandingPageDto) {}

export class RejectLandingPageDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class CreateBusinessDailyNoteDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  summary: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  anomalies?: string[];

  @IsOptional()
  @IsIn(BUSINESS_NOTE_SOURCES)
  source?: BusinessNoteSource;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  affectedCustomerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  affectedCampaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  affectedAdGroupId?: string;

  @IsOptional()
  @IsMongoId()
  affectedProductId?: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: 'info' | 'warning' | 'critical';
}

export class UpdateBusinessDailyNoteDto extends PartialType(CreateBusinessDailyNoteDto) {}
