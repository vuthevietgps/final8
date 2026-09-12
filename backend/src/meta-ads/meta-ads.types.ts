export const META_ADS_GRAPH_API_VERSION = 'v25.0' as const;

export const META_ADS_ACTION_TYPES = [
  'create_campaign',
  'update_campaign',
  'pause_campaign',
  'create_ad_set',
  'pause_ad_set',
  'create_ad_creative',
  'create_ad',
] as const;

export type MetaAdsActionType = (typeof META_ADS_ACTION_TYPES)[number];

export const META_ADS_ODAX_OBJECTIVES = [
  'OUTCOME_APP_PROMOTION',
  'OUTCOME_AWARENESS',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_SALES',
  'OUTCOME_TRAFFIC',
] as const;

export type MetaAdsOdaxObjective = (typeof META_ADS_ODAX_OBJECTIVES)[number];

export const META_ADS_PLAN_STATUSES = [
  'pending_validation',
  'validating',
  'validation_failed',
  'pending_approval',
  'approved',
  'rejected',
  'executing',
  'executed',
  'failed',
] as const;

export type MetaAdsPlanStatus = (typeof META_ADS_PLAN_STATUSES)[number];

export const META_ADS_PROVIDER_VALIDATION_STATUSES = [
  'pending',
  'passed',
  'failed',
] as const;

export type MetaAdsProviderValidationStatus =
  (typeof META_ADS_PROVIDER_VALIDATION_STATUSES)[number];

export type MetaAdsBudgetMode = 'ABO' | 'CBO';

export const META_ADS_BUDGET_MODES = ['ABO', 'CBO'] as const;

export const META_ADS_BUDGET_TYPES = ['NONE', 'DAILY', 'LIFETIME'] as const;

export type MetaAdsBudgetType = (typeof META_ADS_BUDGET_TYPES)[number];

export const META_ADS_BID_STRATEGIES = [
  'COST_CAP',
  'LOWEST_COST_WITHOUT_CAP',
  'LOWEST_COST_WITH_BID_CAP',
  'LOWEST_COST_WITH_MIN_ROAS',
] as const;

export type MetaAdsBidStrategy = (typeof META_ADS_BID_STRATEGIES)[number];

export const META_ADS_AD_SET_BID_STRATEGIES = [
  'COST_CAP',
  'LOWEST_COST_WITHOUT_CAP',
  'LOWEST_COST_WITH_BID_CAP',
] as const;

export type MetaAdsAdSetBidStrategy =
  (typeof META_ADS_AD_SET_BID_STRATEGIES)[number];

export const META_ADS_OPTIMIZATION_GOALS = [
  'APP_INSTALLS',
  'IMPRESSIONS',
  'LANDING_PAGE_VIEWS',
  'LEAD_GENERATION',
  'LINK_CLICKS',
  'OFFSITE_CONVERSIONS',
  'POST_ENGAGEMENT',
  'QUALITY_LEAD',
  'REACH',
  'THRUPLAY',
] as const;

export type MetaAdsOptimizationGoal =
  (typeof META_ADS_OPTIMIZATION_GOALS)[number];

export const META_ADS_BILLING_EVENTS = ['IMPRESSIONS', 'LINK_CLICKS'] as const;
export type MetaAdsBillingEvent = (typeof META_ADS_BILLING_EVENTS)[number];

export const META_ADS_DESTINATION_TYPES = [
  'APP',
  'MESSENGER',
  'ON_AD',
  'WEBSITE',
  'WHATSAPP',
] as const;
export type MetaAdsDestinationType = (typeof META_ADS_DESTINATION_TYPES)[number];

export const META_ADS_PUBLISHER_PLATFORMS = [
  'AUDIENCE_NETWORK',
  'FACEBOOK',
  'INSTAGRAM',
  'MESSENGER',
] as const;
export type MetaAdsPublisherPlatform =
  (typeof META_ADS_PUBLISHER_PLATFORMS)[number];

export const META_ADS_FACEBOOK_POSITIONS = [
  'FEED',
  'INSTREAM_VIDEO',
  'MARKETPLACE',
  'RIGHT_HAND_COLUMN',
  'SEARCH',
  'STORY',
] as const;
export type MetaAdsFacebookPosition =
  (typeof META_ADS_FACEBOOK_POSITIONS)[number];

export const META_ADS_INSTAGRAM_POSITIONS = [
  'EXPLORE',
  'PROFILE_FEED',
  'REELS',
  'STORY',
  'STREAM',
] as const;
export type MetaAdsInstagramPosition =
  (typeof META_ADS_INSTAGRAM_POSITIONS)[number];

export const META_ADS_CALL_TO_ACTION_TYPES = [
  'APPLY_NOW',
  'BOOK_NOW',
  'CONTACT_US',
  'DOWNLOAD',
  'GET_QUOTE',
  'LEARN_MORE',
  'SEND_MESSAGE',
  'SHOP_NOW',
  'SIGN_UP',
  'WHATSAPP_MESSAGE',
] as const;
export type MetaAdsCallToActionType =
  (typeof META_ADS_CALL_TO_ACTION_TYPES)[number];

export const META_ADS_CUSTOM_EVENT_TYPES = [
  'ADD_TO_CART',
  'COMPLETE_REGISTRATION',
  'CONTACT',
  'CONTENT_VIEW',
  'INITIATED_CHECKOUT',
  'LEAD',
  'PURCHASE',
  'SEARCH',
  'SUBMIT_APPLICATION',
] as const;
export type MetaAdsCustomEventType =
  (typeof META_ADS_CUSTOM_EVENT_TYPES)[number];

/**
 * Graph API v25 Campaign.SpecialAdCategories. Keep this allowlist versioned
 * with META_ADS_GRAPH_API_VERSION; arbitrary provider values must never pass
 * through the ERP action contract.
 */
export const META_ADS_SPECIAL_AD_CATEGORIES = [
  'CREDIT',
  'EMPLOYMENT',
  'FINANCIAL_PRODUCTS_SERVICES',
  'HOUSING',
  'ISSUES_ELECTIONS_POLITICS',
  'NONE',
  'ONLINE_GAMBLING_AND_GAMING',
] as const;

export type MetaAdsSpecialAdCategory =
  (typeof META_ADS_SPECIAL_AD_CATEGORIES)[number];

export interface MetaAdsCanonicalActionData {
  actionType: MetaAdsActionType;
  adAccountId: string;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
  internalAdGroupId?: string;
  internalProductIds?: string[];
  name?: string;
  objective?: MetaAdsOdaxObjective;
  status?: 'PAUSED';
  buyingType?: 'AUCTION';
  specialAdCategories?: MetaAdsSpecialAdCategory[];
  specialAdCategoryCountries?: string[];
  budgetMode?: MetaAdsBudgetMode;
  budgetType?: MetaAdsBudgetType;
  dailyBudgetVnd?: number;
  lifetimeBudgetVnd?: number;
  bidStrategy?: MetaAdsBidStrategy;
  bidAmountVnd?: number;
  spendCapVnd?: number;
  startTime?: string;
  stopTime?: string;
  appId?: string;
  optimizationGoal?: MetaAdsOptimizationGoal;
  billingEvent?: MetaAdsBillingEvent;
  destinationType?: MetaAdsDestinationType;
  targetingCountries?: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: Array<1 | 2>;
  publisherPlatforms?: MetaAdsPublisherPlatform[];
  facebookPositions?: MetaAdsFacebookPosition[];
  instagramPositions?: MetaAdsInstagramPosition[];
  pageId?: string;
  instagramActorId?: string;
  pixelId?: string;
  applicationId?: string;
  objectStoreUrl?: string;
  customEventType?: MetaAdsCustomEventType;
  message?: string;
  headline?: string;
  description?: string;
  callToActionType?: MetaAdsCallToActionType;
  destinationUrl?: string;
  imageHash?: string;
  videoId?: string;
  urlTags?: string;
}

export interface MetaAdsProviderValidationResult {
  passed: boolean;
  providerRequestId?: string;
  errorCode?: string;
  errorMessage?: string;
  beforeStateHash?: string;
  graphApiVersion?: typeof META_ADS_GRAPH_API_VERSION;
  credentialReferenceId?: string;
}
