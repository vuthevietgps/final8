import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  GOOGLE_ADS_ERP_ACTION_TYPES,
  GoogleAdsErpActionType,
} from '../google-ads-action-types';

export { GOOGLE_ADS_ERP_ACTION_TYPES, GoogleAdsErpActionType } from '../google-ads-action-types';

export const GOOGLE_ADS_KEYWORD_MATCH_TYPES = [
  'EXACT',
  'PHRASE',
  'BROAD',
] as const;

export const GOOGLE_ADS_BIDDING_STRATEGIES = [
  'MAXIMIZE_CLICKS',
  'MAXIMIZE_CONVERSIONS',
  'MAXIMIZE_CONVERSION_VALUE',
  'MANUAL_CPC',
] as const;

export const GOOGLE_ADS_POSITIVE_GEO_TARGET_TYPES = [
  'PRESENCE',
  'PRESENCE_OR_INTEREST',
] as const;

export type GoogleAdsBiddingStrategy = (typeof GOOGLE_ADS_BIDDING_STRATEGIES)[number];
export type GoogleAdsPositiveGeoTargetType = (typeof GOOGLE_ADS_POSITIVE_GEO_TARGET_TYPES)[number];
export type GoogleAdsKeywordMatchType = (typeof GOOGLE_ADS_KEYWORD_MATCH_TYPES)[number];

export const GOOGLE_ADS_HEADLINE_PIN_FIELDS = ['HEADLINE_1', 'HEADLINE_2', 'HEADLINE_3'] as const;
export const GOOGLE_ADS_DESCRIPTION_PIN_FIELDS = ['DESCRIPTION_1', 'DESCRIPTION_2'] as const;

export class GoogleAdsHeadlinePinDto {
  @IsInt()
  @Min(0)
  @Max(14)
  index: number;

  @IsEnum(GOOGLE_ADS_HEADLINE_PIN_FIELDS)
  pinnedField: (typeof GOOGLE_ADS_HEADLINE_PIN_FIELDS)[number];
}

export class GoogleAdsDescriptionPinDto {
  @IsInt()
  @Min(0)
  @Max(3)
  index: number;

  @IsEnum(GOOGLE_ADS_DESCRIPTION_PIN_FIELDS)
  pinnedField: (typeof GOOGLE_ADS_DESCRIPTION_PIN_FIELDS)[number];
}

export class GoogleAdsCampaignActionPayloadDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  campaignName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  budgetName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  dailyBudgetVnd?: number;

  @IsOptional()
  @IsEnum(GOOGLE_ADS_BIDDING_STRATEGIES)
  biddingStrategyType?: GoogleAdsBiddingStrategy;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  maxCpcBidCeilingVnd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  targetCpaVnd?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  searchPartnersEnabled?: boolean;

  @IsOptional()
  @IsEnum(GOOGLE_ADS_POSITIVE_GEO_TARGET_TYPES)
  positiveGeoTargetType?: GoogleAdsPositiveGeoTargetType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Matches(/^\d+$/, { each: true })
  geoTargetConstantIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Matches(/^\d+$/, { each: true })
  languageConstantIds?: string[];

  @IsOptional()
  @IsBoolean()
  @Equals(true)
  doesNotContainEuPoliticalAdvertising?: true;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  adGroupName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  cpcBidVnd?: number;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  keywordText?: string;

  @IsOptional()
  @IsEnum(GOOGLE_ADS_KEYWORD_MATCH_TYPES)
  matchType?: GoogleAdsKeywordMatchType;

  @IsOptional()
  @IsBoolean()
  negative?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  finalUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(15)
  @IsString({ each: true })
  headlines?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  descriptions?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => GoogleAdsHeadlinePinDto)
  headlinePins?: GoogleAdsHeadlinePinDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => GoogleAdsDescriptionPinDto)
  descriptionPins?: GoogleAdsDescriptionPinDto[];

  @IsOptional()
  @IsString()
  @Length(1, 15)
  path1?: string;

  @IsOptional()
  @IsString()
  @Length(1, 15)
  path2?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  trackingUrlTemplate?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  finalUrlSuffix?: string;
}

export class CreateGoogleAdsActionDto {
  @IsEnum(GOOGLE_ADS_ERP_ACTION_TYPES)
  actionType: GoogleAdsErpActionType;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  customerId: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  adGroupId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  criterionId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  adId?: string;

  @IsString()
  @Length(1, 500)
  reason: string;

  @IsOptional()
  @IsString()
  @Length(8, 140)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  idempotencyKey?: string;

  @ValidateNested()
  @Type(() => GoogleAdsCampaignActionPayloadDto)
  payload: GoogleAdsCampaignActionPayloadDto;
}

export class CreateGoogleAdsActionPlanDto {
  @IsString()
  @Length(1, 200)
  planName: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateGoogleAdsActionDto)
  actions: CreateGoogleAdsActionDto[];
}
