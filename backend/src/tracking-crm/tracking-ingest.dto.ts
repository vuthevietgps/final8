import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsDefined, IsIn, IsInt, IsIP, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class TrackingIngestAdsDto {
  @IsIn(['google', 'facebook', 'tiktok', 'unknown']) provider: string;
  @IsOptional() @IsIn(['gclid', 'wbraid', 'gbraid', 'fbclid', 'ttclid', 'utm']) clickIdType?: string;
  @IsOptional() @IsString() @MaxLength(512) clickId?: string;
  @IsOptional() @IsString() @MaxLength(255) campaignId?: string;
  @IsOptional() @IsString() @MaxLength(200) adGroupId?: string;
  @IsOptional() @IsString() @MaxLength(500) keyword?: string;
  @IsOptional() @IsString() @MaxLength(50) network?: string;
  @IsOptional() @IsString() @MaxLength(50) device?: string;
  @IsOptional() @IsString() @MaxLength(50) matchType?: string;
}
export class TrackingEngagementDto {
  @IsInt() @Min(0) @Max(1000000000) pageViews: number;
  @IsInt() @Min(0) @Max(1000000000) engagedSeconds: number;
  @IsInt() @Min(0) @Max(100) maxScroll: number;
  @IsInt() @Min(0) @Max(1000000000) contactActions: number;
  @IsInt() @Min(0) @Max(1000000000) formSubmits: number;
}
export class TrackingIngestVisitDto {
  @IsString() @IsNotEmpty() @MaxLength(200) externalVisitId: string;
  @IsDateString() occurredAt: string;
  @IsDateString() observedAt: string;
  @IsString() @MaxLength(255) @Matches(/^[a-z0-9.-]+$/) landingHost: string;
  @IsString() @MaxLength(500) @Matches(/^\//) landingPath: string;
  @IsOptional() @IsString() @MaxLength(200) landingName?: string;
  @IsOptional() @IsIP() ipAddress?: string;
  @IsOptional() @IsString() @MaxLength(8) country?: string;
  @IsDefined() @ValidateNested() @Type(() => TrackingIngestAdsDto) ads: TrackingIngestAdsDto;
  @IsDefined() @ValidateNested() @Type(() => TrackingEngagementDto) engagement: TrackingEngagementDto;
}
export class TrackingIngestBatchDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => TrackingIngestVisitDto) visits: TrackingIngestVisitDto[];
}
