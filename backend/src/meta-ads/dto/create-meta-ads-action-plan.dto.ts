import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
  IsISO8601,
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
  META_ADS_ACTION_TYPES,
  META_ADS_AD_SET_BID_STRATEGIES,
  META_ADS_BID_STRATEGIES,
  META_ADS_BILLING_EVENTS,
  META_ADS_BUDGET_MODES,
  META_ADS_BUDGET_TYPES,
  META_ADS_CALL_TO_ACTION_TYPES,
  META_ADS_CUSTOM_EVENT_TYPES,
  META_ADS_DESTINATION_TYPES,
  META_ADS_FACEBOOK_POSITIONS,
  META_ADS_INSTAGRAM_POSITIONS,
  META_ADS_ODAX_OBJECTIVES,
  META_ADS_OPTIMIZATION_GOALS,
  META_ADS_PUBLISHER_PLATFORMS,
  META_ADS_SPECIAL_AD_CATEGORIES,
  MetaAdsAdSetBidStrategy,
  MetaAdsActionType,
  MetaAdsBidStrategy,
  MetaAdsBillingEvent,
  MetaAdsBudgetMode,
  MetaAdsBudgetType,
  MetaAdsCallToActionType,
  MetaAdsCustomEventType,
  MetaAdsDestinationType,
  MetaAdsFacebookPosition,
  MetaAdsInstagramPosition,
  MetaAdsOdaxObjective,
  MetaAdsOptimizationGoal,
  MetaAdsPublisherPlatform,
  MetaAdsSpecialAdCategory,
} from '../meta-ads.types';

export class MetaAdsCampaignActionPayloadDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsEnum(META_ADS_ODAX_OBJECTIVES)
  objective?: MetaAdsOdaxObjective;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  dailyBudgetVnd?: number;

  @IsOptional()
  @IsEnum(META_ADS_BUDGET_MODES)
  budgetMode?: MetaAdsBudgetMode;

  @IsOptional()
  @IsEnum(META_ADS_BUDGET_TYPES)
  budgetType?: MetaAdsBudgetType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  lifetimeBudgetVnd?: number;

  @IsOptional()
  @IsEnum(META_ADS_BID_STRATEGIES)
  bidStrategy?: MetaAdsBidStrategy;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  spendCapVnd?: number;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  startTime?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  stopTime?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(META_ADS_SPECIAL_AD_CATEGORIES.length)
  @IsEnum(META_ADS_SPECIAL_AD_CATEGORIES, { each: true })
  specialAdCategories?: MetaAdsSpecialAdCategory[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @Matches(/^[A-Z]{2}$/, { each: true })
  specialAdCategoryCountries?: string[];

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  appId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{24}$/)
  internalAdGroupId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Matches(/^[a-fA-F0-9]{24}$/, { each: true })
  internalProductIds?: string[];

  @IsOptional()
  @IsEnum(META_ADS_AD_SET_BID_STRATEGIES)
  adSetBidStrategy?: MetaAdsAdSetBidStrategy;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  bidAmountVnd?: number;

  @IsOptional()
  @IsEnum(META_ADS_OPTIMIZATION_GOALS)
  optimizationGoal?: MetaAdsOptimizationGoal;

  @IsOptional()
  @IsEnum(META_ADS_BILLING_EVENTS)
  billingEvent?: MetaAdsBillingEvent;

  @IsOptional()
  @IsEnum(META_ADS_DESTINATION_TYPES)
  destinationType?: MetaAdsDestinationType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @Matches(/^[A-Z]{2}$/, { each: true })
  targetingCountries?: string[];

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(65)
  ageMin?: number;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(65)
  ageMax?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsIn([1, 2], { each: true })
  genders?: Array<1 | 2>;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(META_ADS_PUBLISHER_PLATFORMS.length)
  @IsEnum(META_ADS_PUBLISHER_PLATFORMS, { each: true })
  publisherPlatforms?: MetaAdsPublisherPlatform[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(META_ADS_FACEBOOK_POSITIONS.length)
  @IsEnum(META_ADS_FACEBOOK_POSITIONS, { each: true })
  facebookPositions?: MetaAdsFacebookPosition[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(META_ADS_INSTAGRAM_POSITIONS.length)
  @IsEnum(META_ADS_INSTAGRAM_POSITIONS, { each: true })
  instagramPositions?: MetaAdsInstagramPosition[];

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  pageId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  instagramActorId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  pixelId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  applicationId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  @Matches(/^https:\/\//i)
  objectStoreUrl?: string;

  @IsOptional()
  @IsEnum(META_ADS_CUSTOM_EVENT_TYPES)
  customEventType?: MetaAdsCustomEventType;

  @IsOptional()
  @IsString()
  @Length(1, 5000)
  message?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  headline?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @IsOptional()
  @IsEnum(META_ADS_CALL_TO_ACTION_TYPES)
  callToActionType?: MetaAdsCallToActionType;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  @Matches(/^https:\/\//i)
  destinationUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{32}$/)
  imageHash?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  videoId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  @Matches(/^[^\u0000-\u001F\u007F]+$/)
  urlTags?: string;
}

export class CreateMetaAdsActionDto {
  @IsEnum(META_ADS_ACTION_TYPES)
  actionType: MetaAdsActionType;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{1,32}$/)
  adAccountId: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  adSetId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  creativeId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  adId?: string;

  @IsString()
  @Length(1, 500)
  reason: string;

  @IsOptional()
  @IsString()
  @Length(8, 160)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  idempotencyKey?: string;

  @ValidateNested()
  @Type(() => MetaAdsCampaignActionPayloadDto)
  payload: MetaAdsCampaignActionPayloadDto;
}

export class CreateMetaAdsActionPlanDto {
  @IsString()
  @Length(1, 200)
  planName: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateMetaAdsActionDto)
  actions: CreateMetaAdsActionDto[];
}
