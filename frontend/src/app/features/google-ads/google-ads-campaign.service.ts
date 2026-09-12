import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type GoogleCampaignActionType =
  | 'create_search_campaign'
  | 'update_search_campaign'
  | 'update_campaign_bidding_strategy'
  | 'update_campaign_budget'
  | 'pause_campaign'
  | 'resume_campaign'
  | 'create_ad_group'
  | 'update_ad_group'
  | 'pause_ad_group'
  | 'resume_ad_group'
  | 'create_keyword'
  | 'update_keyword'
  | 'pause_keyword'
  | 'resume_keyword'
  | 'create_responsive_search_ad'
  | 'update_responsive_search_ad'
  | 'pause_responsive_search_ad'
  | 'resume_responsive_search_ad';

export type GoogleKeywordMatchType = 'EXACT' | 'PHRASE' | 'BROAD';
export type GoogleRsaHeadlinePinnedField = 'HEADLINE_1' | 'HEADLINE_2' | 'HEADLINE_3';
export type GoogleRsaDescriptionPinnedField = 'DESCRIPTION_1' | 'DESCRIPTION_2';

export interface GoogleRsaAssetPin<T extends string = string> {
  index: number;
  pinnedField: T;
}

export type GoogleCampaignBiddingStrategy =
  | 'MANUAL_CPC'
  | 'MAXIMIZE_CLICKS'
  | 'MAXIMIZE_CONVERSIONS'
  | 'MAXIMIZE_CONVERSION_VALUE';

export type GoogleAdsBiddingLifecycleStage =
  | 'MAXIMIZE_CLICKS'
  | 'MAXIMIZE_CLICKS_CPC_CEILING'
  | 'MAXIMIZE_CONVERSIONS'
  | 'MAXIMIZE_CONVERSIONS_TARGET_CPA';

export type GoogleAdsBiddingLifecycleDecision =
  | 'NOT_EVALUATED'
  | 'NO_ACTION'
  | 'BLOCKED'
  | 'DRAFT_CREATED'
  | 'DRAFT_ALREADY_EXISTS'
  | 'FAILED';

export interface GoogleAdsBiddingLifecyclePolicy {
  enabled: boolean;
  clickThreshold: number;
  clickWindowDays: number;
  maxCpcBidCeilingVnd: number;
  maximizeConversionsMinConversions: number;
  conversionWindowDays: number;
  targetCpaMinConversions: number;
  targetCpaVnd: number;
  cooldownHours: number;
  minimumStageDwellHours: number;
  draftOnly: true;
}

export interface GoogleAdsBiddingLifecyclePendingDraft {
  planId: string;
  actionId?: string;
  fromStage?: GoogleAdsBiddingLifecycleStage;
  toStage?: GoogleAdsBiddingLifecycleStage;
  status?: string;
  createdAt?: string;
}

export interface GoogleAdsBiddingLifecycleState {
  currentStage?: GoogleAdsBiddingLifecycleStage;
  canonicalBiddingStrategyType?: GoogleCampaignBiddingStrategy;
  observedClicks?: number;
  observedConversions?: number;
  observedCpaVnd?: number;
  metricsFrom?: string;
  metricsTo?: string;
  lastEvaluatedAt?: string;
  lastTransitionAt?: string;
  nextEligibleAt?: string;
  lastDecision?: GoogleAdsBiddingLifecycleDecision;
  lastDecisionReason?: string;
  blockers?: string[];
  pendingDraft?: GoogleAdsBiddingLifecyclePendingDraft;
}

export interface GoogleAdsBiddingLifecycleResponse {
  policy: GoogleAdsBiddingLifecyclePolicy;
  state: GoogleAdsBiddingLifecycleState;
}

export type GooglePositiveGeoTargetType = 'PRESENCE' | 'PRESENCE_OR_INTEREST';

export interface GoogleAdsCapabilityOption<T extends string = string> {
  value: T;
  label?: string;
  disabled?: boolean;
  blockers?: string[];
}

export interface GoogleAdsCampaignCapabilities {
  schemaVersion?: string;
  provider?: 'google';
  apiVersion?: string;
  googleAdsApiVersion?: string;
  channelTypes?: string[];
  campaignTypes?: string[];
  biddingStrategies?: Array<GoogleCampaignBiddingStrategy | GoogleAdsCapabilityOption<GoogleCampaignBiddingStrategy>>;
  actions?: Record<string, unknown>;
  supportedActionTypes?: string[];
  invariants?: {
    createStatus?: 'PAUSED';
    advertisingChannelType?: 'SEARCH';
    currency?: 'VND';
  };
  forced?: {
    createStatus?: 'PAUSED';
    advertisingChannelType?: 'SEARCH';
  };
  productionEnabled?: boolean;
  liveActionGates?: {
    create?: boolean;
    update?: boolean;
    biddingStrategyUpdate?: boolean;
    pause?: boolean;
    resume?: boolean;
    adGroup?: { create?: boolean; update?: boolean; pause?: boolean; resume?: boolean };
    keyword?: { create?: boolean; update?: boolean; pause?: boolean; resume?: boolean };
    responsiveSearchAd?: { create?: boolean; update?: boolean; pause?: boolean; resume?: boolean };
    default?: string;
  };
  defaults?: {
    geoTargetConstantIds?: string[];
    languageConstantIds?: string[];
    positiveGeoTargetType?: GooglePositiveGeoTargetType;
    searchPartnersEnabled?: boolean;
  };
  defaultTargeting?: {
    geoTargetConstantIds?: string[];
    languageConstantIds?: string[];
    positiveGeoTargetType?: GooglePositiveGeoTargetType;
    searchPartnersEnabled?: boolean;
  };
  biddingLifecycle?: {
    supported?: boolean;
    draftOnly?: boolean;
    defaultEnabled?: boolean;
    defaultClickThreshold?: number;
    stages?: GoogleAdsBiddingLifecycleStage[];
    endpoint?: string;
  };
  blockers?: string[];
}

export type GoogleAdsCampaignCapabilitiesResponse =
  | GoogleAdsCampaignCapabilities
  | { data: GoogleAdsCampaignCapabilities };

export interface GoogleAdsAccountOption {
  customerId: string;
  name?: string;
  descriptiveName?: string;
  currencyCode?: string;
  currency?: string;
  timeZone?: string;
  timezone?: string;
  eligible?: boolean;
  liveEligible?: boolean;
  accountStatus?: string;
  lastSyncAt?: string;
  blockers?: string[];
  readinessBlockers?: Array<string | { code?: string; message: string }>;
}

export type GoogleAdsAccountLookupResponse =
  | GoogleAdsAccountOption[]
  | { data: GoogleAdsAccountOption[] }
  | { accounts: GoogleAdsAccountOption[] };

export interface GoogleAdsCampaignOption {
  campaignId: string;
  campaignResourceName?: string;
  campaignBudgetId?: string;
  campaignBudgetResourceName?: string;
  name: string;
  status?: string;
  advertisingChannelType?: string;
  biddingStrategyType?: GoogleCampaignBiddingStrategy;
  maxCpcBidCeilingVnd?: number;
  targetCpaVnd?: number;
  dailyBudgetVnd?: number;
  amountMicros?: number;
  startDate?: string;
  endDate?: string;
  lastSyncAt?: string;
  eligible?: boolean;
  liveEligible?: boolean;
  blockers?: string[];
  readiness?: GoogleAdsSearchReadiness;
  budget?: {
    campaignBudgetId: string;
    name?: string;
    dailyBudgetVnd?: number;
    deliveryMethod?: string;
    explicitlyShared?: boolean;
  };
}

export type GoogleAdsCampaignLookupResponse =
  | GoogleAdsCampaignOption[]
  | { data: GoogleAdsCampaignOption[] }
  | { campaigns: GoogleAdsCampaignOption[] };

export interface GoogleAdsAdGroupOption {
  customerId?: string;
  campaignId: string;
  adGroupId: string;
  adGroupResourceName?: string;
  resourceName?: string;
  adGroupName?: string;
  name?: string;
  status?: string;
  type?: string;
  cpcBidVnd?: number;
  cpcBidMicros?: number;
  lastSyncAt?: string;
  eligible?: boolean;
  liveEligible?: boolean;
  blockers?: string[];
}

export type GoogleAdsAdGroupLookupResponse =
  | GoogleAdsAdGroupOption[]
  | { data: GoogleAdsAdGroupOption[] }
  | { adGroups: GoogleAdsAdGroupOption[] };

export interface GoogleAdsKeywordOption {
  customerId?: string;
  campaignId: string;
  adGroupId: string;
  criterionId: string;
  criterionResourceName?: string;
  resourceName?: string;
  keywordText: string;
  matchType: GoogleKeywordMatchType;
  negative?: boolean;
  status?: string;
  cpcBidVnd?: number;
  cpcBidMicros?: number;
  finalUrl?: string;
  finalUrls?: string[];
  lastSyncAt?: string;
  eligible?: boolean;
  liveEligible?: boolean;
  blockers?: string[];
  mutable?: boolean;
}

export type GoogleAdsKeywordLookupResponse =
  | GoogleAdsKeywordOption[]
  | { data: GoogleAdsKeywordOption[] }
  | { keywords: GoogleAdsKeywordOption[] };

export interface GoogleAdsResponsiveSearchAdOption {
  customerId?: string;
  campaignId: string;
  adGroupId: string;
  adId: string;
  adResourceName?: string;
  resourceName?: string;
  status?: string;
  finalUrl?: string;
  finalUrls?: string[];
  headlines?: Array<string | { text?: string }>;
  descriptions?: Array<string | { text?: string }>;
  path1?: string;
  path2?: string;
  trackingUrlTemplate?: string;
  finalUrlSuffix?: string;
  headlinePins?: Array<GoogleRsaAssetPin<GoogleRsaHeadlinePinnedField>>;
  descriptionPins?: Array<GoogleRsaAssetPin<GoogleRsaDescriptionPinnedField>>;
  policyApprovalStatus?: string;
  policyReviewStatus?: string;
  lastSyncAt?: string;
  eligible?: boolean;
  liveEligible?: boolean;
  blockers?: string[];
}

export type GoogleAdsResponsiveSearchAdLookupResponse =
  | GoogleAdsResponsiveSearchAdOption[]
  | { data: GoogleAdsResponsiveSearchAdOption[] }
  | { ads: GoogleAdsResponsiveSearchAdOption[] };

export interface GoogleAdsReadinessCheck {
  code?: string;
  label?: string;
  message?: string;
  passed?: boolean;
  status?: string;
}

export interface GoogleAdsSearchReadiness {
  customerId?: string;
  campaignId?: string;
  ready?: boolean;
  eligible?: boolean;
  conversionTrackingConfigured?: boolean;
  conversionGoalsConfigured?: boolean;
  primaryConversionActionCount?: number;
  trackingConfigured?: boolean;
  landingPageAllowlisted?: boolean;
  canonicalDataFresh?: boolean;
  checks?: GoogleAdsReadinessCheck[];
  blockers?: string[];
  warnings?: string[];
  conversion?: {
    ready?: boolean;
    status?: string;
    ownerCustomer?: string;
    acceptedCustomerDataTerms?: boolean;
    enhancedConversionsForLeadsEnabled?: boolean;
    source?: string;
  };
  tracking?: {
    httpsRequired?: boolean;
    trackingTemplateRequiresLpurl?: boolean;
    configuredDomainCount?: number;
  };
  deliveryStack?: {
    adGroups?: number;
    positiveKeywords?: number;
    responsiveSearchAds?: number;
  };
  activation?: {
    ready?: boolean;
    eligible?: boolean;
    nextStage?: string;
    requiredOrder?: string[];
    blockers?: string[];
    stages?: Record<string, {
      ready?: boolean;
      eligible?: boolean;
      status?: string;
      blockers?: string[];
    }>;
  };
}

export type GoogleAdsSearchReadinessResponse =
  | GoogleAdsSearchReadiness
  | { data: GoogleAdsSearchReadiness }
  | { readiness: GoogleAdsSearchReadiness };

export interface GoogleCampaignActionPayload {
  campaignName?: string;
  budgetName?: string;
  dailyBudgetVnd?: number;
  biddingStrategyType?: GoogleCampaignBiddingStrategy;
  biddingLifecycleStage?: GoogleAdsBiddingLifecycleStage;
  maxCpcBidCeilingVnd?: number;
  targetCpaVnd?: number;
  startDate?: string;
  endDate?: string;
  status?: 'PAUSED';
  advertisingChannelType?: 'SEARCH';
  searchPartnersEnabled?: boolean;
  geoTargetConstantIds?: string[];
  languageConstantIds?: string[];
  positiveGeoTargetType?: GooglePositiveGeoTargetType;
  doesNotContainEuPoliticalAdvertising?: true;
  adGroupName?: string;
  cpcBidVnd?: number;
  keywordText?: string;
  matchType?: GoogleKeywordMatchType;
  negative?: boolean;
  finalUrl?: string;
  headlines?: string[];
  descriptions?: string[];
  path1?: string;
  path2?: string;
  trackingUrlTemplate?: string;
  finalUrlSuffix?: string;
  headlinePins?: Array<GoogleRsaAssetPin<GoogleRsaHeadlinePinnedField>>;
  descriptionPins?: Array<GoogleRsaAssetPin<GoogleRsaDescriptionPinnedField>>;
}

export interface CreateGoogleCampaignActionPlanRequest {
  planName: string;
  actions: Array<{
    actionType: GoogleCampaignActionType;
    customerId: string;
    campaignId?: string;
    adGroupId?: string;
    criterionId?: string;
    adId?: string;
    reason: string;
    idempotencyKey?: string;
    payload: GoogleCampaignActionPayload;
  }>;
}

export interface GoogleCampaignPlanItem {
  _id?: string;
  actionId: string;
  actionType: GoogleCampaignActionType;
  customerId: string;
  status: string;
  providerValidationStatus?: 'pending' | 'provider_validate_passed' | 'provider_validate_failed';
  providerValidationErrors?: Array<{ code?: string; message: string; fieldPath?: string }>;
  approvedByUserId?: string;
  approvedAt?: string;
  rejectionReason?: string;
  reason?: string;
  typedPayload?: GoogleCampaignActionPayload & Record<string, unknown>;
  payload?: GoogleCampaignActionPayload & Record<string, unknown>;
  campaignId?: string;
  adGroupId?: string;
  criterionId?: string;
  adId?: string;
  blockers?: string[];
}

export interface GoogleCampaignActionPlan {
  _id?: string;
  id?: string;
  planId: string;
  planName?: string;
  source?: string;
  status: string;
  providerValidationStatus?: 'pending' | 'passed' | 'partial' | 'failed';
  providerValidatedAt?: string;
  createdByUserId?: string;
  createdAt?: string;
  items: GoogleCampaignPlanItem[];
  actions?: GoogleCampaignPlanItem[];
  liveEligible?: boolean;
  liveEligibility?: { eligible: boolean; blockers?: string[] };
  blockers?: string[];
}

export interface GoogleCampaignExecution {
  _id?: string;
  executionId?: string;
  status: string;
  dryRun: boolean;
  createdAt?: string;
  completedAt?: string;
  actionIds?: string[];
  blockers?: string[];
  reconciliationRequired?: boolean;
  reconciliationReason?: string;
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
export class GoogleAdsCampaignService {
  private readonly googleAdsUrl = `${environment.apiUrl}/google-ads`;
  private readonly baseUrl = `${this.googleAdsUrl}/action-plans`;
  private readonly automationDraftUrl =
    `${environment.apiUrl}/ads-automation/drafts/google/pause-review`;

  constructor(private readonly http: HttpClient) {}

  getCapabilities(customerId?: string): Observable<GoogleAdsCampaignCapabilitiesResponse> {
    let params = new HttpParams();
    if (customerId) params = params.set('customerId', customerId);
    return this.http.get<GoogleAdsCampaignCapabilitiesResponse>(`${this.googleAdsUrl}/capabilities`, { params });
  }

  getAccountOptions(): Observable<GoogleAdsAccountLookupResponse> {
    return this.http.get<GoogleAdsAccountLookupResponse>(`${this.googleAdsUrl}/lookups/ad-accounts`);
  }

  getCampaignOptions(customerId: string): Observable<GoogleAdsCampaignLookupResponse> {
    return this.http.get<GoogleAdsCampaignLookupResponse>(
      `${this.googleAdsUrl}/lookups/campaigns/${encodeURIComponent(customerId)}`,
    );
  }

  getAdGroupOptions(customerId: string, campaignId: string): Observable<GoogleAdsAdGroupLookupResponse> {
    return this.http.get<GoogleAdsAdGroupLookupResponse>(
      `${this.googleAdsUrl}/lookups/ad-groups/${encodeURIComponent(customerId)}/${encodeURIComponent(campaignId)}`,
    );
  }

  getKeywordOptions(customerId: string, adGroupId: string): Observable<GoogleAdsKeywordLookupResponse> {
    return this.http.get<GoogleAdsKeywordLookupResponse>(
      `${this.googleAdsUrl}/lookups/keywords/${encodeURIComponent(customerId)}/${encodeURIComponent(adGroupId)}`,
    );
  }

  getResponsiveSearchAdOptions(
    customerId: string,
    adGroupId: string,
  ): Observable<GoogleAdsResponsiveSearchAdLookupResponse> {
    return this.http.get<GoogleAdsResponsiveSearchAdLookupResponse>(
      `${this.googleAdsUrl}/lookups/responsive-search-ads/${encodeURIComponent(customerId)}/${encodeURIComponent(adGroupId)}`,
    );
  }

  getSearchReadiness(customerId: string, campaignId: string): Observable<GoogleAdsSearchReadinessResponse> {
    return this.http.get<GoogleAdsSearchReadinessResponse>(
      `${this.googleAdsUrl}/lookups/readiness/${encodeURIComponent(customerId)}/${encodeURIComponent(campaignId)}`,
    );
  }

  getBiddingLifecycle(
    customerId: string,
    campaignId: string,
  ): Observable<GoogleAdsBiddingLifecycleResponse> {
    return this.http.get<GoogleAdsBiddingLifecycleResponse>(
      `${this.googleAdsUrl}/bidding-lifecycle/${encodeURIComponent(customerId)}/${encodeURIComponent(campaignId)}`,
    );
  }

  updateBiddingLifecycle(
    customerId: string,
    campaignId: string,
    policy: GoogleAdsBiddingLifecyclePolicy,
  ): Observable<GoogleAdsBiddingLifecycleResponse> {
    return this.http.put<GoogleAdsBiddingLifecycleResponse>(
      `${this.googleAdsUrl}/bidding-lifecycle/${encodeURIComponent(customerId)}/${encodeURIComponent(campaignId)}`,
      policy,
    );
  }

  evaluateBiddingLifecycle(
    customerId: string,
    campaignId: string,
  ): Observable<GoogleAdsBiddingLifecycleResponse> {
    return this.http.post<GoogleAdsBiddingLifecycleResponse>(
      `${this.googleAdsUrl}/bidding-lifecycle/${encodeURIComponent(customerId)}/${encodeURIComponent(campaignId)}/evaluate`,
      {},
    );
  }

  createPlan(body: CreateGoogleCampaignActionPlanRequest): Observable<GoogleCampaignActionPlan> {
    return this.http.post<GoogleCampaignActionPlan | { plan: GoogleCampaignActionPlan }>(this.baseUrl, body)
      .pipe(map((response) => this.unwrapPlan(response)));
  }

  materializePauseReviewDrafts(limit = 20): Observable<AdsAutomationDraftMaterialization> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.post<AdsAutomationDraftMaterialization>(
      this.automationDraftUrl,
      {},
      { params },
    );
  }

  getPlan(planId: string): Observable<GoogleCampaignActionPlan> {
    return this.http.get<GoogleCampaignActionPlan | { plan: GoogleCampaignActionPlan }>(
      `${this.baseUrl}/${encodeURIComponent(planId)}`,
    ).pipe(map((response) => this.unwrapPlan(response)));
  }

  validatePlan(planId: string): Observable<GoogleCampaignActionPlan> {
    return this.http.post(
      `${this.baseUrl}/${encodeURIComponent(planId)}/validate`,
      { validateOnly: true },
    ).pipe(switchMap(() => this.getPlan(planId)));
  }

  approveItem(planId: string, actionId: string): Observable<GoogleCampaignActionPlan> {
    return this.http.patch(
      `${this.baseUrl}/${encodeURIComponent(planId)}/items/${encodeURIComponent(actionId)}/approve`,
      {
        approvedBySource: 'erp_ui',
        approvalText: 'Approved in ERP Google Search campaign control',
        requireExecutionConfirmation: true,
      },
    ).pipe(switchMap(() => this.getPlan(planId)));
  }

  rejectItem(planId: string, actionId: string, reason: string): Observable<GoogleCampaignActionPlan> {
    return this.http.patch(
      `${this.baseUrl}/${encodeURIComponent(planId)}/items/${encodeURIComponent(actionId)}/reject`,
      { rejectedBySource: 'erp_ui', reason },
    ).pipe(switchMap(() => this.getPlan(planId)));
  }

  executePlan(planId: string, actionIds: string[], dryRun: boolean): Observable<GoogleCampaignExecution> {
    return this.http.post<any>(
      `${this.baseUrl}/${encodeURIComponent(planId)}/execute`,
      {
        actionIds,
        dryRun,
        validateOnly: false,
        source: 'erp_ui',
      },
    ).pipe(map((response) => ({
      ...response,
      status: response?.status || (response?.success === true ? 'success' : 'failed'),
      dryRun: response?.dryRun === true,
      blockers: response?.blockers
        || response?.financialControl?.blockers
        || (response?.separationOfDuties?.reason ? [response.separationOfDuties.reason] : []),
    })));
  }

  getExecutions(planId: string): Observable<GoogleCampaignExecution[]> {
    return this.http.get<any>(
      `${this.baseUrl}/${encodeURIComponent(planId)}/executions`,
    ).pipe(map((response) => {
      const executions = Array.isArray(response) ? response : response?.executions || [];
      return executions.map((execution: any) => ({
        ...execution,
        executionId: execution.executionId || execution._id,
        dryRun: execution.dryRun === true || execution.status === 'dry_run',
        createdAt: execution.createdAt || execution.executedAt,
      }));
    }));
  }

  private unwrapPlan(
    response: GoogleCampaignActionPlan | { plan: GoogleCampaignActionPlan },
  ): GoogleCampaignActionPlan {
    return 'plan' in response ? response.plan : response;
  }
}
