import { Injectable } from '@nestjs/common';
import {
  META_ADS_BID_STRATEGIES,
  META_ADS_AD_SET_BID_STRATEGIES,
  META_ADS_BILLING_EVENTS,
  META_ADS_BUDGET_MODES,
  META_ADS_BUDGET_TYPES,
  META_ADS_CALL_TO_ACTION_TYPES,
  META_ADS_CUSTOM_EVENT_TYPES,
  META_ADS_DESTINATION_TYPES,
  META_ADS_FACEBOOK_POSITIONS,
  META_ADS_GRAPH_API_VERSION,
  META_ADS_INSTAGRAM_POSITIONS,
  META_ADS_ODAX_OBJECTIVES,
  META_ADS_OPTIMIZATION_GOALS,
  META_ADS_PUBLISHER_PLATFORMS,
  META_ADS_SPECIAL_AD_CATEGORIES,
  MetaAdsBidStrategy,
  MetaAdsBudgetType,
  MetaAdsOdaxObjective,
  MetaAdsSpecialAdCategory,
} from './meta-ads.types';

export type MetaAdsCapabilitiesV1 = {
  schemaVersion: 'v1';
  provider: 'meta';
  graphApiVersion: typeof META_ADS_GRAPH_API_VERSION;
  objectives: Array<{
    value: MetaAdsOdaxObjective;
    label: string;
  }>;
  budget: {
    modes: Array<{
      value: (typeof META_ADS_BUDGET_MODES)[number];
      ownerResource: 'AD_SET' | 'CAMPAIGN';
    }>;
    types: Array<{
      value: MetaAdsBudgetType;
      campaignExecutionSupport: 'SUPPORTED' | 'STAGED_RESOURCE_ONLY';
    }>;
    currency: 'VND';
    campaignDailyBudgetField: 'dailyBudgetVnd';
    campaignLifetimeBudgetField: 'lifetimeBudgetVnd';
  };
  bidStrategies: MetaAdsBidStrategy[];
  specialAdCategories: {
    officialOptions: MetaAdsSpecialAdCategory[];
    selectionRequired: true;
    defaultLiveExecutionAllowlist: ['NONE'];
  };
  invariants: {
    createStatus: 'PAUSED';
    buyingType: 'AUCTION';
    rawProviderPayloadAccepted: false;
    creativeIsNonDeliveringResource: true;
  };
  actions: Record<string, {
    requiredFields: string[];
    optionalFields: string[];
    conditionalRequirements?: string[];
    constraints?: string[];
    forcedFields?: Record<string, string>;
    payloadMustBeEmpty?: boolean;
    liveFlag?: string;
  }>;
  delivery: {
    adSetBidStrategies: string[];
    optimizationGoals: string[];
    billingEvents: string[];
    destinationTypes: string[];
    publisherPlatforms: string[];
    facebookPositions: string[];
    instagramPositions: string[];
    callToActionTypes: string[];
    customEventTypes: string[];
  };
  resourceSetup: {
    campaignIsContainerOnly: true;
    stages: ['CAMPAIGN', 'AD_SET', 'CREATIVE', 'AD'];
    note: string;
  };
  blockers: string[];
};

const OBJECTIVE_LABELS: Record<MetaAdsOdaxObjective, string> = {
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_APP_PROMOTION: 'App promotion',
  OUTCOME_SALES: 'Sales',
};

const CAPABILITIES: MetaAdsCapabilitiesV1 = {
  schemaVersion: 'v1',
  provider: 'meta',
  graphApiVersion: META_ADS_GRAPH_API_VERSION,
  objectives: META_ADS_ODAX_OBJECTIVES.map((value) => ({
    value,
    label: OBJECTIVE_LABELS[value],
  })),
  budget: {
    modes: [
      { value: 'ABO', ownerResource: 'AD_SET' },
      { value: 'CBO', ownerResource: 'CAMPAIGN' },
    ],
    types: [
      { value: 'NONE', campaignExecutionSupport: 'SUPPORTED' },
      { value: 'DAILY', campaignExecutionSupport: 'SUPPORTED' },
      { value: 'LIFETIME', campaignExecutionSupport: 'SUPPORTED' },
    ],
    currency: 'VND',
    campaignDailyBudgetField: 'dailyBudgetVnd',
    campaignLifetimeBudgetField: 'lifetimeBudgetVnd',
  },
  bidStrategies: [...META_ADS_BID_STRATEGIES],
  specialAdCategories: {
    officialOptions: [...META_ADS_SPECIAL_AD_CATEGORIES],
    selectionRequired: true,
    defaultLiveExecutionAllowlist: ['NONE'],
  },
  invariants: {
    createStatus: 'PAUSED',
    buyingType: 'AUCTION',
    rawProviderPayloadAccepted: false,
    creativeIsNonDeliveringResource: true,
  },
  actions: {
    create_campaign: {
      requiredFields: [
        'adAccountId',
        'reason',
        'payload.name',
        'payload.objective',
        'payload.budgetMode',
        'payload.budgetType',
        'payload.specialAdCategories',
      ],
      optionalFields: [
        'idempotencyKey',
        'payload.dailyBudgetVnd',
        'payload.lifetimeBudgetVnd',
        'payload.spendCapVnd',
        'payload.startTime',
        'payload.stopTime',
        'payload.specialAdCategoryCountries',
        'payload.appId',
        'payload.bidStrategy',
      ],
      conditionalRequirements: [
        'ABO requires budgetType=NONE and no campaign-level budget',
        'ABO forbids campaign-level bidStrategy; bidding belongs to the Ad Set',
        'CBO DAILY requires dailyBudgetVnd',
        'CBO LIFETIME requires lifetimeBudgetVnd, startTime and stopTime',
        'CBO requires a campaign-level bidStrategy',
        'non-NONE special categories require specialAdCategoryCountries',
        'OUTCOME_APP_PROMOTION requires appId',
      ],
      forcedFields: {
        status: 'PAUSED',
        buyingType: 'AUCTION',
      },
      liveFlag: 'META_ADS_CAMPAIGN_CREATE_ENABLED',
    },
    update_campaign: {
      requiredFields: ['adAccountId', 'campaignId', 'reason'],
      optionalFields: [
        'idempotencyKey',
        'payload.name',
        'payload.dailyBudgetVnd',
        'payload.lifetimeBudgetVnd',
        'payload.spendCapVnd',
        'payload.stopTime',
      ],
      constraints: [
        'at least one supported update field is required',
        'only one campaign budget candidate may be supplied at a time',
        'budget and spend-cap changes remain subject to execution-policy financial gates',
      ],
      liveFlag: 'META_ADS_CAMPAIGN_UPDATE_ENABLED',
    },
    pause_campaign: {
      requiredFields: ['adAccountId', 'campaignId', 'reason'],
      optionalFields: ['idempotencyKey'],
      forcedFields: { status: 'PAUSED' },
      payloadMustBeEmpty: true,
      liveFlag: 'META_ADS_CAMPAIGN_PAUSE_ENABLED',
    },
    create_ad_set: {
      requiredFields: [
        'adAccountId', 'campaignId', 'reason', 'payload.name', 'payload.budgetMode',
        'payload.budgetType', 'payload.optimizationGoal', 'payload.billingEvent',
        'payload.destinationType', 'payload.targetingCountries',
      ],
      optionalFields: [
        'idempotencyKey', 'payload.internalAdGroupId', 'payload.internalProductIds',
        'payload.dailyBudgetVnd', 'payload.lifetimeBudgetVnd',
        'payload.adSetBidStrategy', 'payload.bidAmountVnd', 'payload.ageMin', 'payload.ageMax',
        'payload.genders', 'payload.publisherPlatforms', 'payload.facebookPositions',
        'payload.instagramPositions', 'payload.pageId', 'payload.pixelId',
        'payload.applicationId', 'payload.objectStoreUrl', 'payload.customEventType',
        'payload.startTime', 'payload.stopTime',
      ],
      conditionalRequirements: [
        'at least one ERP mapping is required: internalAdGroupId or internalProductIds',
        'ABO owns Ad Set budget and bidding; CBO forbids Ad Set budget and bid fields',
        'COST_CAP and LOWEST_COST_WITH_BID_CAP require bidAmountVnd',
        'promoted-object identifiers depend on optimizationGoal and destinationType',
      ],
      constraints: [
        'Page, Pixel and application IDs are user-entered and validate_only checked; provider discovery is unavailable',
        'live create additionally requires META_ADS_INTERNAL_MAPPING_VERIFIED_ENABLED=true',
        'update and resume are not implemented in this phase',
      ],
      forcedFields: { status: 'PAUSED' },
      liveFlag: 'META_ADS_AD_SET_CREATE_ENABLED',
    },
    pause_ad_set: {
      requiredFields: ['adAccountId', 'campaignId', 'adSetId', 'reason'],
      optionalFields: ['idempotencyKey'],
      constraints: [
        'requires exact same-account Campaign and Ad Set readback',
        'already PAUSED, archived, or deleted Ad Sets are rejected as no-op/invalid',
      ],
      forcedFields: { status: 'PAUSED' },
      payloadMustBeEmpty: true,
      liveFlag: 'META_ADS_AD_SET_PAUSE_ENABLED',
    },
    create_ad_creative: {
      requiredFields: [
        'adAccountId', 'reason', 'payload.name', 'payload.pageId', 'payload.message',
        'payload.headline', 'payload.description', 'payload.callToActionType',
        'payload.destinationUrl',
      ],
      optionalFields: [
        'idempotencyKey', 'payload.instagramActorId', 'payload.imageHash',
        'payload.videoId', 'payload.urlTags',
      ],
      conditionalRequirements: ['exactly one of imageHash or videoId is required'],
      constraints: [
        'Creative is non-delivering and therefore has no PAUSED/ACTIVE status',
        'Page, Instagram and media IDs are user-entered and validate_only checked; provider discovery is unavailable',
        'update is not implemented in this phase',
      ],
      liveFlag: 'META_ADS_AD_CREATIVE_CREATE_ENABLED',
    },
    create_ad: {
      requiredFields: ['adAccountId', 'adSetId', 'creativeId', 'reason', 'payload.name'],
      optionalFields: ['idempotencyKey'],
      constraints: [
        'requires exact same-account PAUSED Ad Set and canonical Creative readback',
        'update and resume are not implemented in this phase',
      ],
      forcedFields: { status: 'PAUSED' },
      liveFlag: 'META_ADS_AD_CREATE_ENABLED',
    },
  },
  delivery: {
    adSetBidStrategies: [...META_ADS_AD_SET_BID_STRATEGIES],
    optimizationGoals: [...META_ADS_OPTIMIZATION_GOALS],
    billingEvents: [...META_ADS_BILLING_EVENTS],
    destinationTypes: [...META_ADS_DESTINATION_TYPES],
    publisherPlatforms: [...META_ADS_PUBLISHER_PLATFORMS],
    facebookPositions: [...META_ADS_FACEBOOK_POSITIONS],
    instagramPositions: [...META_ADS_INSTAGRAM_POSITIONS],
    callToActionTypes: [...META_ADS_CALL_TO_ACTION_TYPES],
    customEventTypes: [...META_ADS_CUSTOM_EVENT_TYPES],
  },
  resourceSetup: {
    campaignIsContainerOnly: true,
    stages: ['CAMPAIGN', 'AD_SET', 'CREATIVE', 'AD'],
    note: 'Ad Set, Creative and Ad are configured and validated as separate staged resources; creating a Campaign alone does not create a delivery-ready ad.',
  },
  blockers: [],
};

@Injectable()
export class MetaAdsCapabilitiesService {
  getCapabilities(): MetaAdsCapabilitiesV1 {
    // Return a detached read model so a request cannot mutate the process-wide contract.
    return JSON.parse(JSON.stringify(CAPABILITIES)) as MetaAdsCapabilitiesV1;
  }
}
