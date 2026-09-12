import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type MetaAdsResourceStage = 'campaign' | 'ad_set' | 'creative' | 'ad';
export type MetaCampaignActionType =
  | 'create_campaign'
  | 'update_campaign'
  | 'pause_campaign'
  | 'create_ad_set'
  | 'pause_ad_set'
  | 'create_ad_creative'
  | 'create_ad';

export type MetaCampaignObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_APP_PROMOTION';

export type MetaCampaignBudgetMode = 'ABO' | 'CBO';
export type MetaCampaignBudgetType = 'NONE' | 'DAILY' | 'LIFETIME';
export type MetaCampaignBidStrategy =
  | 'COST_CAP'
  | 'LOWEST_COST_WITHOUT_CAP'
  | 'LOWEST_COST_WITH_BID_CAP'
  | 'LOWEST_COST_WITH_MIN_ROAS';
export type MetaCampaignSpecialAdCategory =
  | 'CREDIT'
  | 'EMPLOYMENT'
  | 'FINANCIAL_PRODUCTS_SERVICES'
  | 'HOUSING'
  | 'ISSUES_ELECTIONS_POLITICS'
  | 'NONE'
  | 'ONLINE_GAMBLING_AND_GAMING';
export type MetaAdSetBidStrategy =
  | 'COST_CAP'
  | 'LOWEST_COST_WITHOUT_CAP'
  | 'LOWEST_COST_WITH_BID_CAP';
export type MetaAdSetOptimizationGoal =
  | 'APP_INSTALLS'
  | 'IMPRESSIONS'
  | 'LANDING_PAGE_VIEWS'
  | 'LEAD_GENERATION'
  | 'LINK_CLICKS'
  | 'OFFSITE_CONVERSIONS'
  | 'POST_ENGAGEMENT'
  | 'QUALITY_LEAD'
  | 'REACH'
  | 'THRUPLAY';
export type MetaAdSetBillingEvent = 'IMPRESSIONS' | 'LINK_CLICKS';
export type MetaAdSetDestinationType = 'APP' | 'MESSENGER' | 'ON_AD' | 'WEBSITE' | 'WHATSAPP';
export type MetaPublisherPlatform = 'AUDIENCE_NETWORK' | 'FACEBOOK' | 'INSTAGRAM' | 'MESSENGER';
export type MetaFacebookPosition =
  | 'FEED'
  | 'INSTREAM_VIDEO'
  | 'MARKETPLACE'
  | 'RIGHT_HAND_COLUMN'
  | 'SEARCH'
  | 'STORY';
export type MetaInstagramPosition = 'EXPLORE' | 'PROFILE_FEED' | 'REELS' | 'STORY' | 'STREAM';
export type MetaCallToActionType =
  | 'APPLY_NOW'
  | 'BOOK_NOW'
  | 'CONTACT_US'
  | 'DOWNLOAD'
  | 'GET_QUOTE'
  | 'LEARN_MORE'
  | 'SEND_MESSAGE'
  | 'SHOP_NOW'
  | 'SIGN_UP'
  | 'WHATSAPP_MESSAGE';
export type MetaCustomEventType =
  | 'ADD_TO_CART'
  | 'COMPLETE_REGISTRATION'
  | 'CONTACT'
  | 'CONTENT_VIEW'
  | 'INITIATED_CHECKOUT'
  | 'LEAD'
  | 'PURCHASE'
  | 'SEARCH'
  | 'SUBMIT_APPLICATION';

export interface MetaAdsCapabilityOption<T extends string = string> {
  value: T;
  label?: string;
  disabled?: boolean;
  blockers?: string[];
}

export interface MetaAdsCampaignCapabilities {
  schemaVersion?: string;
  provider?: 'meta';
  graphApiVersion?: string;
  objectives?: Array<MetaCampaignObjective | MetaAdsCapabilityOption<MetaCampaignObjective>>;
  supportedObjectives?: MetaCampaignObjective[];
  budgetModes?: Array<MetaCampaignBudgetMode | MetaAdsCapabilityOption<MetaCampaignBudgetMode>>;
  budgetTypes?: Array<MetaCampaignBudgetType | MetaAdsCapabilityOption<MetaCampaignBudgetType>>;
  budget?: {
    modes?: Array<MetaAdsCapabilityOption<MetaCampaignBudgetMode> & { ownerResource?: string }>;
    types?: Array<MetaAdsCapabilityOption<MetaCampaignBudgetType> & {
      campaignExecutionSupport?: 'SUPPORTED' | 'STAGED_RESOURCE_ONLY';
    }>;
    currency?: string;
    campaignDailyBudgetField?: string;
    campaignLifetimeBudgetField?: string;
  };
  bidStrategies?: Array<MetaCampaignBidStrategy | MetaAdsCapabilityOption<MetaCampaignBidStrategy>>;
  specialAdCategories?:
    | Array<MetaCampaignSpecialAdCategory | MetaAdsCapabilityOption<MetaCampaignSpecialAdCategory>>
    | {
      officialOptions?: MetaCampaignSpecialAdCategory[];
      selectionRequired?: boolean;
      defaultLiveExecutionAllowlist?: MetaCampaignSpecialAdCategory[];
    };
  countries?: Array<string | MetaAdsCapabilityOption>;
  specialAdCategoryCountries?: Array<string | MetaAdsCapabilityOption>;
  forced?: {
    buyingType?: 'AUCTION';
    createStatus?: 'PAUSED';
  };
  invariants?: {
    buyingType?: 'AUCTION';
    createStatus?: 'PAUSED';
  };
  actions?: Partial<Record<MetaCampaignActionType, unknown>>;
  delivery?: {
    adSetBidStrategies?: Array<MetaAdSetBidStrategy | MetaAdsCapabilityOption<MetaAdSetBidStrategy>>;
    optimizationGoals?: Array<MetaAdSetOptimizationGoal | MetaAdsCapabilityOption<MetaAdSetOptimizationGoal>>;
    billingEvents?: Array<MetaAdSetBillingEvent | MetaAdsCapabilityOption<MetaAdSetBillingEvent>>;
    destinationTypes?: Array<MetaAdSetDestinationType | MetaAdsCapabilityOption<MetaAdSetDestinationType>>;
    publisherPlatforms?: Array<MetaPublisherPlatform | MetaAdsCapabilityOption<MetaPublisherPlatform>>;
    facebookPositions?: Array<MetaFacebookPosition | MetaAdsCapabilityOption<MetaFacebookPosition>>;
    instagramPositions?: Array<MetaInstagramPosition | MetaAdsCapabilityOption<MetaInstagramPosition>>;
    callToActionTypes?: Array<MetaCallToActionType | MetaAdsCapabilityOption<MetaCallToActionType>>;
    customEventTypes?: Array<MetaCustomEventType | MetaAdsCapabilityOption<MetaCustomEventType>>;
  };
  resourceSetup?: {
    campaignIsContainerOnly?: boolean;
    stages?: string[];
    note?: string;
  };
  blockers?: string[];
}

export type MetaAdsCampaignCapabilitiesResponse =
  | MetaAdsCampaignCapabilities
  | { data: MetaAdsCampaignCapabilities };

export interface MetaAdsAdAccountOption {
  adAccountId?: string;
  accountId?: string;
  name: string;
  currency?: string;
  timezone?: string;
  timezoneId?: string;
  eligible?: boolean;
  liveEligible?: boolean;
  blockers?: string[];
  accountStatus?: string | number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  readinessBlockers?: Array<{ code?: string; message: string }>;
}

export type MetaAdsAdAccountLookupResponse =
  | MetaAdsAdAccountOption[]
  | { data: MetaAdsAdAccountOption[] }
  | { accounts: MetaAdsAdAccountOption[] };

export interface MetaAdsCampaignLookupOption {
  campaignId: string;
  name: string;
  objective?: MetaCampaignObjective;
  status?: string;
  effectiveStatus?: string;
  budgetMode?: MetaCampaignBudgetMode;
  budgetType?: MetaCampaignBudgetType;
  dailyBudgetVnd?: number;
  lifetimeBudgetVnd?: number;
  spendCapVnd?: number;
  startTime?: string;
  stopTime?: string;
  lastReadbackAt?: string;
}

export interface MetaCampaignActionPayload {
  name?: string;
  objective?: MetaCampaignObjective;
  budgetMode?: MetaCampaignBudgetMode;
  budgetType?: MetaCampaignBudgetType;
  dailyBudgetVnd?: number;
  lifetimeBudgetVnd?: number;
  bidStrategy?: MetaCampaignBidStrategy;
  spendCapVnd?: number;
  startTime?: string;
  stopTime?: string;
  specialAdCategories?: MetaCampaignSpecialAdCategory[];
  specialAdCategoryCountries?: string[];
  appId?: string;
  internalAdGroupId?: string;
  internalProductIds?: string[];
  adSetBidStrategy?: MetaAdSetBidStrategy;
  bidAmountVnd?: number;
  optimizationGoal?: MetaAdSetOptimizationGoal;
  billingEvent?: MetaAdSetBillingEvent;
  destinationType?: MetaAdSetDestinationType;
  targetingCountries?: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: Array<1 | 2>;
  publisherPlatforms?: MetaPublisherPlatform[];
  facebookPositions?: MetaFacebookPosition[];
  instagramPositions?: MetaInstagramPosition[];
  pageId?: string;
  instagramActorId?: string;
  pixelId?: string;
  applicationId?: string;
  objectStoreUrl?: string;
  customEventType?: MetaCustomEventType;
  message?: string;
  headline?: string;
  description?: string;
  callToActionType?: MetaCallToActionType;
  destinationUrl?: string;
  imageHash?: string;
  videoId?: string;
  urlTags?: string;
}

export interface CreateMetaCampaignActionPlanRequest {
  planName: string;
  actions: Array<{
    actionType: MetaCampaignActionType;
    adAccountId: string;
    campaignId?: string;
    adSetId?: string;
    creativeId?: string;
    adId?: string;
    reason: string;
    idempotencyKey?: string;
    payload: MetaCampaignActionPayload;
  }>;
}

export interface MetaCampaignPlanAction {
  _id?: string;
  id?: string;
  actionId?: string;
  actionType: MetaCampaignActionType;
  adAccountId: string;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
  status: string;
  workflowStatus?: string;
  providerValidationStatus?: 'pending' | 'passed' | 'failed';
  providerValidatedAt?: string;
  providerValidationExpiresAt?: string;
  providerValidationErrorCode?: string;
  providerValidationError?: string;
  payloadHash?: string;
  providerValidationBeforeStateHash?: string;
  revision?: number;
  reason?: string;
  payload?: Record<string, unknown>;
  name?: string;
  objective?: MetaCampaignObjective;
  budgetMode?: MetaCampaignBudgetMode;
  budgetType?: MetaCampaignBudgetType;
  dailyBudgetVnd?: number;
  lifetimeBudgetVnd?: number;
  bidStrategy?: MetaCampaignBidStrategy;
  spendCapVnd?: number;
  startTime?: string;
  stopTime?: string;
  specialAdCategories?: MetaCampaignSpecialAdCategory[];
  specialAdCategoryCountries?: string[];
  appId?: string;
  internalAdGroupId?: string;
  internalProductIds?: string[];
  bidAmountVnd?: number;
  optimizationGoal?: MetaAdSetOptimizationGoal;
  billingEvent?: MetaAdSetBillingEvent;
  destinationType?: MetaAdSetDestinationType;
  targetingCountries?: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: Array<1 | 2>;
  publisherPlatforms?: MetaPublisherPlatform[];
  facebookPositions?: MetaFacebookPosition[];
  instagramPositions?: MetaInstagramPosition[];
  pageId?: string;
  instagramActorId?: string;
  pixelId?: string;
  applicationId?: string;
  objectStoreUrl?: string;
  customEventType?: MetaCustomEventType;
  message?: string;
  headline?: string;
  description?: string;
  callToActionType?: MetaCallToActionType;
  destinationUrl?: string;
  imageHash?: string;
  videoId?: string;
  urlTags?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  providerCampaignId?: string;
  providerAdSetId?: string;
  providerCreativeId?: string;
  providerAdId?: string;
  idempotencyKey?: string;
  blockers?: string[];
}

export interface MetaCampaignActionPlan {
  _id?: string;
  id?: string;
  planId?: string;
  planName: string;
  status: string;
  createdByUserId?: string;
  createdAt?: string;
  actions: MetaCampaignPlanAction[];
  providerValidation?: {
    passed: boolean;
    validatedAt?: string;
    expiresAt?: string;
    blockers?: string[];
  };
  liveEligible?: boolean;
  liveEligibility?: {
    eligible: boolean;
    blockers?: string[];
  };
  blockers?: string[];
}

export interface MetaCampaignExecution {
  _id?: string;
  executionId?: string;
  status: string;
  dryRun: boolean;
  createdAt?: string;
  completedAt?: string;
  actionIds?: string[];
  providerCampaignIds?: string[];
  blockers?: string[];
}

export interface AdsAutomationDraftMaterialization {
  platform: 'google_ads' | 'meta_ads';
  created: number;
  deduplicated: number;
  rejected: number;
  eligible: number;
  drafts: Array<{
    planId: string;
    actionId?: string;
    status: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class MetaAdsCampaignService {
  private readonly metaAdsUrl = `${environment.apiUrl}/meta-ads`;
  private readonly baseUrl = `${this.metaAdsUrl}/action-plans`;
  private readonly automationDraftUrl =
    `${environment.apiUrl}/ads-automation/drafts/meta/pause-review`;

  constructor(private readonly http: HttpClient) {}

  getCapabilities(adAccountId?: string): Observable<MetaAdsCampaignCapabilitiesResponse> {
    let params = new HttpParams();
    if (adAccountId) params = params.set('adAccountId', adAccountId);
    return this.http.get<MetaAdsCampaignCapabilitiesResponse>(`${this.metaAdsUrl}/capabilities`, { params });
  }

  getAdAccountOptions(): Observable<MetaAdsAdAccountLookupResponse> {
    return this.http.get<MetaAdsAdAccountLookupResponse>(`${this.metaAdsUrl}/lookups/ad-accounts`);
  }

  getCampaignOptions(adAccountId: string): Observable<MetaAdsCampaignLookupOption[]> {
    return this.http.get<MetaAdsCampaignLookupOption[]>(
      `${this.metaAdsUrl}/lookups/campaigns/${encodeURIComponent(adAccountId)}`,
    );
  }

  createPlan(body: CreateMetaCampaignActionPlanRequest): Observable<MetaCampaignActionPlan> {
    return this.http.post<MetaCampaignActionPlan>(this.baseUrl, body);
  }

  materializePauseReviewDrafts(limit = 20): Observable<AdsAutomationDraftMaterialization> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.post<AdsAutomationDraftMaterialization>(
      this.automationDraftUrl,
      {},
      { params },
    );
  }

  getPlan(planId: string): Observable<MetaCampaignActionPlan> {
    return this.http.get<MetaCampaignActionPlan>(`${this.baseUrl}/${encodeURIComponent(planId)}`);
  }

  validatePlan(planId: string): Observable<MetaCampaignActionPlan> {
    return this.http.post<MetaCampaignActionPlan>(
      `${this.baseUrl}/${encodeURIComponent(planId)}/validate`,
      { validateOnly: true },
    );
  }

  approveAction(
    planId: string,
    actionId: string,
    expectedActionRevision: number,
  ): Observable<MetaCampaignActionPlan> {
    return this.http.patch<MetaCampaignActionPlan>(
      `${this.baseUrl}/${encodeURIComponent(planId)}/actions/${encodeURIComponent(actionId)}/approve`,
      {
        expectedActionRevision,
        note: 'Approved in ERP Meta campaign control',
      },
    );
  }

  rejectAction(
    planId: string,
    actionId: string,
    reason: string,
    expectedActionRevision: number,
  ): Observable<MetaCampaignActionPlan> {
    return this.http.patch<MetaCampaignActionPlan>(
      `${this.baseUrl}/${encodeURIComponent(planId)}/actions/${encodeURIComponent(actionId)}/reject`,
      { reason, expectedActionRevision },
    );
  }

  executePlan(planId: string, actionIds: string[], dryRun: boolean): Observable<MetaCampaignExecution> {
    return this.http.post<MetaCampaignExecution>(
      `${this.baseUrl}/${encodeURIComponent(planId)}/execute`,
      {
        actionIds,
        dryRun,
        validateOnly: false,
        source: 'erp_ui',
      },
    );
  }

  getExecutions(planId: string): Observable<MetaCampaignExecution[]> {
    return this.http.get<MetaCampaignExecution[]>(
      `${this.baseUrl}/${encodeURIComponent(planId)}/executions`,
    );
  }
}
