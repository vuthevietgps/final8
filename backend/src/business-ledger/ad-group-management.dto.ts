import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { AD_GROUP_REVIEW_DECISIONS, AdGroupReviewDecision } from './ad-group-management.schema';

export class AdGroupManagementQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(90) maturityDays = 7;
}

export class CreateAdGroupManagementReviewDto {
  @IsString() @IsNotEmpty() @MaxLength(120) requestKey!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) periodFrom!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) periodTo!: string;
  @IsIn(AD_GROUP_REVIEW_DECISIONS) decision!: AdGroupReviewDecision;
  @IsString() @IsNotEmpty() @MaxLength(500) rationale!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!: string;
}

