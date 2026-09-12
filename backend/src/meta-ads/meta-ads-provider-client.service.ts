import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiTokenService, MetaAdsExecutionCredential } from '../api-token/api-token.service';
import { getMetaGraphApiVersion } from '../common/ads-api-version';
import { redactSecrets, redactSecretString } from '../common/utils/secret-redaction.util';
import { metaAdsCanonicalHash } from './meta-ads-canonical.util';
import {
  META_ADS_BID_STRATEGIES,
  META_ADS_BILLING_EVENTS,
  META_ADS_CALL_TO_ACTION_TYPES,
  META_ADS_CUSTOM_EVENT_TYPES,
  META_ADS_DESTINATION_TYPES,
  META_ADS_ODAX_OBJECTIVES,
  META_ADS_OPTIMIZATION_GOALS,
  META_ADS_SPECIAL_AD_CATEGORIES,
  MetaAdsActionType,
} from './meta-ads.types';

export type MetaAdsCanonicalActionLike = {
  actionType: MetaAdsActionType;
  adAccountId: string;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
  internalAdGroupId?: string;
  internalProductIds?: string[];
  name?: string;
  objective?: string;
  status?: string;
  buyingType?: string;
  specialAdCategories?: string[];
  specialAdCategoryCountries?: string[];
  budgetMode?: 'ABO' | 'CBO';
  budgetType?: 'NONE' | 'DAILY' | 'LIFETIME';
  dailyBudgetVnd?: number;
  lifetimeBudgetVnd?: number;
  bidStrategy?: string;
  bidAmountVnd?: number;
  spendCapVnd?: number;
  startTime?: string;
  stopTime?: string;
  appId?: string;
  optimizationGoal?: string;
  billingEvent?: string;
  destinationType?: string;
  targetingCountries?: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: Array<1 | 2>;
  publisherPlatforms?: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
  pageId?: string;
  instagramActorId?: string;
  pixelId?: string;
  applicationId?: string;
  objectStoreUrl?: string;
  customEventType?: string;
  message?: string;
  headline?: string;
  description?: string;
  callToActionType?: string;
  destinationUrl?: string;
  imageHash?: string;
  videoId?: string;
  urlTags?: string;
};

export type MetaAdsCampaignSnapshot = {
  resourceType?: 'CAMPAIGN';
  adAccountId: string;
  campaignId: string;
  name: string;
  objective: string;
  status: string;
  effectiveStatus?: string;
  buyingType: string;
  specialAdCategories: string[];
  specialAdCategoryCountries: string[];
  budgetMode: 'ABO' | 'CBO';
  budgetType: 'NONE' | 'DAILY' | 'LIFETIME';
  dailyBudgetVnd?: number;
  lifetimeBudgetVnd?: number;
  bidStrategy?: string;
  spendCapVnd?: number;
  startTime?: string;
  stopTime?: string;
  appId?: string;
  providerUpdatedAt?: string;
};

export type MetaAdsAdSetSnapshot = {
  resourceType: 'AD_SET';
  adAccountId: string;
  campaignId: string;
  adSetId: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  budgetMode: 'ABO' | 'CBO';
  budgetType: 'NONE' | 'DAILY' | 'LIFETIME';
  dailyBudgetVnd?: number;
  lifetimeBudgetVnd?: number;
  bidStrategy?: string;
  bidAmountVnd?: number;
  optimizationGoal: string;
  billingEvent: string;
  destinationType: string;
  targetingCountries: string[];
  ageMin?: number;
  ageMax?: number;
  genders: Array<1 | 2>;
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
  pageId?: string;
  pixelId?: string;
  applicationId?: string;
  objectStoreUrl?: string;
  customEventType?: string;
  startTime?: string;
  stopTime?: string;
  providerUpdatedAt?: string;
};

export type MetaAdsAdCreativeSnapshot = {
  resourceType: 'AD_CREATIVE';
  adAccountId: string;
  creativeId: string;
  name: string;
  pageId: string;
  instagramActorId?: string;
  message: string;
  headline: string;
  description: string;
  callToActionType: string;
  destinationUrl: string;
  imageHash?: string;
  videoId?: string;
  urlTags?: string;
};

export type MetaAdsAdSnapshot = {
  resourceType: 'AD';
  adAccountId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  providerUpdatedAt?: string;
};

export type MetaAdsResourceSnapshot =
  | MetaAdsCampaignSnapshot
  | MetaAdsAdSetSnapshot
  | MetaAdsAdCreativeSnapshot
  | MetaAdsAdSnapshot;

export type MetaAdsProviderMutation = {
  actionType: MetaAdsCanonicalActionLike['actionType'];
  adAccountId: string;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
  path: string;
  fields: Record<string, string>;
};

export type MetaAdsProviderMutationResult = {
  providerRequestId?: string;
  resourceId?: string;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
  response: Record<string, unknown>;
  credentialReferenceId: string;
};

export type MetaAdsHttpRequest = {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
};

export type MetaAdsHttpResponse = {
  status: number;
  headers?: Record<string, string | undefined> | Headers;
  data?: any;
};

export interface MetaAdsHttpTransport {
  request(input: MetaAdsHttpRequest): Promise<MetaAdsHttpResponse>;
}

export class MetaAdsProviderError extends Error {
  constructor(
    message: string,
    readonly outcome: 'definitive_failure' | 'unknown',
    readonly providerRequestId?: string,
    readonly providerCode?: string,
  ) {
    super(message);
  }
}

const META_OBJECTIVES = new Set<string>(META_ADS_ODAX_OBJECTIVES);
const META_BID_STRATEGIES = new Set<string>(META_ADS_BID_STRATEGIES);
const META_SPECIAL_AD_CATEGORIES = new Set<string>(META_ADS_SPECIAL_AD_CATEGORIES);
const META_OPTIMIZATION_GOALS = new Set<string>(META_ADS_OPTIMIZATION_GOALS);
const META_BILLING_EVENTS = new Set<string>(META_ADS_BILLING_EVENTS);
const META_DESTINATION_TYPES = new Set<string>(META_ADS_DESTINATION_TYPES);
const META_CALL_TO_ACTION_TYPES = new Set<string>(META_ADS_CALL_TO_ACTION_TYPES);
const META_CUSTOM_EVENT_TYPES = new Set<string>(META_ADS_CUSTOM_EVENT_TYPES);

@Injectable()
export class DefaultMetaAdsHttpTransport implements MetaAdsHttpTransport {
  async request(input: MetaAdsHttpRequest): Promise<MetaAdsHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        signal: controller.signal,
      });
      return {
        status: response.status,
        headers: response.headers,
        data: await response.json().catch(() => ({})),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * The only Meta Marketing API mutation boundary. Paths and fields are built
 * from a small typed allowlist; callers cannot supply a URL or raw provider body.
 */
@Injectable()
export class MetaAdsProviderClientService {
  constructor(
    private readonly apiTokenService: ApiTokenService,
    private readonly transport: DefaultMetaAdsHttpTransport,
  ) {}

  graphApiVersion(): 'v25.0' {
    const configured = getMetaGraphApiVersion();
    if (configured !== 'v25.0') {
      throw new BadRequestException(
        'Canonical Meta Ads execution requires the effective FB_GRAPH_API_VERSION/META_GRAPH_API_VERSION to be v25.0.',
      );
    }
    return 'v25.0';
  }

  buildMutation(action: MetaAdsCanonicalActionLike): MetaAdsProviderMutation {
    this.rejectRawOrUnknownFields(action);
    const adAccountId = this.numericId(action.adAccountId, 'adAccountId');
    switch (action.actionType) {
      case 'create_campaign': {
        if (!META_OBJECTIVES.has(String(action.objective || ''))) {
          throw new BadRequestException('Unsupported Meta ODAX campaign objective.');
        }
        if (action.status !== 'PAUSED' || action.buyingType !== 'AUCTION') {
          throw new BadRequestException('New Meta campaigns must use PAUSED status and AUCTION buying type.');
        }
        const specialAdCategories = this.specialAdCategories(action.specialAdCategories);
        const fields: Record<string, string> = {
          name: this.name(action.name),
          objective: String(action.objective),
          status: 'PAUSED',
          buying_type: 'AUCTION',
          // NONE is the ERP audit sentinel. Meta expects an empty provider list.
          special_ad_categories: JSON.stringify(
            specialAdCategories[0] === 'NONE' ? [] : specialAdCategories,
          ),
        };
        if (specialAdCategories[0] !== 'NONE') {
          fields.special_ad_category_country = JSON.stringify(
            this.countryCodes(action.specialAdCategoryCountries),
          );
        } else if (action.specialAdCategoryCountries?.length) {
          throw new BadRequestException('specialAdCategoryCountries is not allowed when specialAdCategories is NONE.');
        }
        if (action.budgetMode === 'CBO') {
          if (!META_BID_STRATEGIES.has(String(action.bidStrategy || ''))) {
            throw new BadRequestException('Unsupported Meta campaign bid strategy.');
          }
          fields.bid_strategy = String(action.bidStrategy);
        } else if (action.bidStrategy !== undefined) {
          throw new BadRequestException(
            'ABO bid strategy must be configured on create_ad_set, not Campaign.',
          );
        }
        if (action.budgetMode === 'CBO' && action.budgetType === 'DAILY') {
          fields.daily_budget = this.vndAmount(action.dailyBudgetVnd, 'dailyBudgetVnd');
          if (action.lifetimeBudgetVnd !== undefined) {
            throw new BadRequestException('A CBO daily campaign cannot also define lifetimeBudgetVnd.');
          }
        } else if (action.budgetMode === 'CBO' && action.budgetType === 'LIFETIME') {
          fields.lifetime_budget = this.vndAmount(action.lifetimeBudgetVnd, 'lifetimeBudgetVnd');
          if (action.dailyBudgetVnd !== undefined) {
            throw new BadRequestException('A CBO lifetime campaign cannot also define dailyBudgetVnd.');
          }
          fields.start_time = this.isoTime(action.startTime, 'startTime');
          fields.stop_time = this.isoTime(action.stopTime, 'stopTime');
        } else if (action.budgetMode !== 'ABO' || action.budgetType !== 'NONE'
          || action.dailyBudgetVnd !== undefined || action.lifetimeBudgetVnd !== undefined) {
          throw new BadRequestException('ABO must use budgetType=NONE; CBO must use exactly one campaign budget.');
        }
        if (action.startTime !== undefined) {
          fields.start_time = this.isoTime(action.startTime, 'startTime');
        }
        if (action.stopTime !== undefined) {
          fields.stop_time = this.isoTime(action.stopTime, 'stopTime');
        }
        if (action.spendCapVnd !== undefined) {
          fields.spend_cap = this.vndAmount(action.spendCapVnd, 'spendCapVnd');
        }
        if (action.objective === 'OUTCOME_APP_PROMOTION') {
          fields.promoted_object = JSON.stringify({
            application_id: this.numericId(action.appId, 'appId'),
          });
        } else if (action.appId !== undefined) {
          throw new BadRequestException('appId is only allowed for OUTCOME_APP_PROMOTION.');
        }
        return {
          actionType: action.actionType,
          adAccountId,
          path: `/act_${adAccountId}/campaigns`,
          fields,
        };
      }
      case 'create_ad_set': {
        const campaignId = this.numericId(action.campaignId, 'campaignId');
        if (action.status !== 'PAUSED') {
          throw new BadRequestException('New Meta Ad Sets must use PAUSED status.');
        }
        if (!META_OPTIMIZATION_GOALS.has(String(action.optimizationGoal || ''))
          || !META_BILLING_EVENTS.has(String(action.billingEvent || ''))
          || !META_DESTINATION_TYPES.has(String(action.destinationType || ''))) {
          throw new BadRequestException(
            'Meta Ad Set optimizationGoal, billingEvent, or destinationType is unsupported.',
          );
        }
        const countries = this.countryCodes(action.targetingCountries);
        const targeting: Record<string, unknown> = {
          geo_locations: { countries },
        };
        if (action.ageMin !== undefined) targeting.age_min = this.integerRange(action.ageMin, 'ageMin', 18, 65);
        if (action.ageMax !== undefined) targeting.age_max = this.integerRange(action.ageMax, 'ageMax', 18, 65);
        if (action.genders?.length) targeting.genders = this.numericChoices(action.genders, [1, 2], 'genders');
        if (action.publisherPlatforms?.length) {
          targeting.publisher_platforms = this.lowercaseChoices(
            action.publisherPlatforms,
            ['AUDIENCE_NETWORK', 'FACEBOOK', 'INSTAGRAM', 'MESSENGER'],
            'publisherPlatforms',
          );
        }
        if (action.facebookPositions?.length) {
          targeting.facebook_positions = this.lowercaseChoices(
            action.facebookPositions,
            ['FEED', 'INSTREAM_VIDEO', 'MARKETPLACE', 'RIGHT_HAND_COLUMN', 'SEARCH', 'STORY'],
            'facebookPositions',
          );
        }
        if (action.instagramPositions?.length) {
          targeting.instagram_positions = this.lowercaseChoices(
            action.instagramPositions,
            ['EXPLORE', 'PROFILE_FEED', 'REELS', 'STORY', 'STREAM'],
            'instagramPositions',
          );
        }
        const fields: Record<string, string> = {
          campaign_id: campaignId,
          name: this.name(action.name),
          status: 'PAUSED',
          optimization_goal: String(action.optimizationGoal),
          billing_event: String(action.billingEvent),
          destination_type: String(action.destinationType),
          targeting: JSON.stringify(targeting),
        };
        if (action.budgetMode === 'ABO' && action.budgetType === 'DAILY') {
          fields.daily_budget = this.vndAmount(action.dailyBudgetVnd, 'dailyBudgetVnd');
        } else if (action.budgetMode === 'ABO' && action.budgetType === 'LIFETIME') {
          fields.lifetime_budget = this.vndAmount(
            action.lifetimeBudgetVnd,
            'lifetimeBudgetVnd',
          );
        } else if (action.budgetMode !== 'CBO' || action.budgetType !== 'NONE'
          || action.dailyBudgetVnd !== undefined || action.lifetimeBudgetVnd !== undefined) {
          throw new BadRequestException(
            'Meta Ad Set budget ownership must be ABO with one budget or CBO with NONE.',
          );
        }
        if (action.budgetMode === 'ABO') {
          if (!['COST_CAP', 'LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP']
            .includes(String(action.bidStrategy || ''))) {
            throw new BadRequestException('Unsupported Meta ABO Ad Set bid strategy.');
          }
          fields.bid_strategy = String(action.bidStrategy);
          if (action.bidAmountVnd !== undefined) {
            fields.bid_amount = this.vndAmount(action.bidAmountVnd, 'bidAmountVnd');
          }
        } else if (action.bidStrategy !== undefined || action.bidAmountVnd !== undefined) {
          throw new BadRequestException('CBO Ad Sets cannot own bid strategy or bid amount.');
        }
        if (action.startTime !== undefined) {
          fields.start_time = this.isoTime(action.startTime, 'startTime');
        }
        if (action.stopTime !== undefined) {
          fields.end_time = this.isoTime(action.stopTime, 'stopTime');
        }
        const promotedObject = this.providerPromotedObject(action);
        if (Object.keys(promotedObject).length) {
          fields.promoted_object = JSON.stringify(promotedObject);
        }
        return {
          actionType: action.actionType,
          adAccountId,
          campaignId,
          path: `/act_${adAccountId}/adsets`,
          fields,
        };
      }
      case 'pause_ad_set': {
        const campaignId = this.numericId(action.campaignId, 'campaignId');
        const adSetId = this.numericId(action.adSetId, 'adSetId');
        return {
          actionType: action.actionType,
          adAccountId,
          campaignId,
          adSetId,
          path: `/${adSetId}`,
          fields: { status: 'PAUSED' },
        };
      }
      case 'create_ad_creative': {
        if (!META_CALL_TO_ACTION_TYPES.has(String(action.callToActionType || ''))) {
          throw new BadRequestException('Unsupported Meta creative call-to-action type.');
        }
        const destinationUrl = this.httpsUrl(action.destinationUrl, 'destinationUrl');
        const pageId = this.numericId(action.pageId, 'pageId');
        const callToAction = {
          type: String(action.callToActionType),
          value: { link: destinationUrl },
        };
        const story: Record<string, unknown> = { page_id: pageId };
        if (action.instagramActorId !== undefined) {
          story.instagram_user_id = this.numericId(
            action.instagramActorId,
            'instagramActorId',
          );
        }
        if (action.imageHash !== undefined && action.videoId === undefined) {
          story.link_data = {
            link: destinationUrl,
            message: this.text(action.message, 'message', 5000),
            name: this.text(action.headline, 'headline', 255),
            description: this.text(action.description, 'description', 1000),
            image_hash: this.imageHash(action.imageHash),
            call_to_action: callToAction,
          };
        } else if (action.videoId !== undefined && action.imageHash === undefined) {
          story.video_data = {
            video_id: this.numericId(action.videoId, 'videoId'),
            message: this.text(action.message, 'message', 5000),
            title: this.text(action.headline, 'headline', 255),
            link_description: this.text(action.description, 'description', 1000),
            call_to_action: callToAction,
          };
        } else {
          throw new BadRequestException(
            'Meta creative requires exactly one imageHash or videoId.',
          );
        }
        return {
          actionType: action.actionType,
          adAccountId,
          path: `/act_${adAccountId}/adcreatives`,
          fields: {
            name: this.name(action.name),
            object_story_spec: JSON.stringify(story),
            ...(action.urlTags === undefined
              ? {}
              : { url_tags: this.text(action.urlTags, 'urlTags', 2048) }),
          },
        };
      }
      case 'create_ad': {
        const adSetId = this.numericId(action.adSetId, 'adSetId');
        const creativeId = this.numericId(action.creativeId, 'creativeId');
        if (action.status !== 'PAUSED') {
          throw new BadRequestException('New Meta Ads must use PAUSED status.');
        }
        return {
          actionType: action.actionType,
          adAccountId,
          adSetId,
          creativeId,
          path: `/act_${adAccountId}/ads`,
          fields: {
            name: this.name(action.name),
            adset_id: adSetId,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: 'PAUSED',
          },
        };
      }
      case 'update_campaign': {
        const campaignId = this.numericId(action.campaignId, 'campaignId');
        const fields: Record<string, string> = {};
        if (action.name !== undefined) fields.name = this.name(action.name);
        if (action.dailyBudgetVnd !== undefined) {
          if (action.budgetMode !== 'CBO' || action.budgetType !== 'DAILY') {
            throw new BadRequestException('Daily budget updates require CBO and budgetType=DAILY.');
          }
          fields.daily_budget = this.vndAmount(action.dailyBudgetVnd, 'dailyBudgetVnd');
        }
        if (action.lifetimeBudgetVnd !== undefined) {
          if (action.budgetMode !== 'CBO' || action.budgetType !== 'LIFETIME') {
            throw new BadRequestException('Lifetime budget updates require CBO and budgetType=LIFETIME.');
          }
          fields.lifetime_budget = this.vndAmount(action.lifetimeBudgetVnd, 'lifetimeBudgetVnd');
        }
        if (action.spendCapVnd !== undefined) {
          fields.spend_cap = this.vndAmount(action.spendCapVnd, 'spendCapVnd');
        }
        if (action.stopTime !== undefined) fields.stop_time = this.isoTime(action.stopTime, 'stopTime');
        if (!Object.keys(fields).length) throw new BadRequestException('Meta campaign update has no allowed field.');
        return { actionType: action.actionType, adAccountId, campaignId, path: `/${campaignId}`, fields };
      }
      case 'pause_campaign': {
        const campaignId = this.numericId(action.campaignId, 'campaignId');
        return {
          actionType: action.actionType,
          adAccountId,
          campaignId,
          path: `/${campaignId}`,
          fields: { status: 'PAUSED' },
        };
      }
      default:
        throw new BadRequestException('Unsupported Meta campaign action.');
    }
  }

  payloadHash(action: MetaAdsCanonicalActionLike): string {
    const canonical = this.canonicalPayload(action);
    this.buildMutation(canonical);
    return metaAdsCanonicalHash(canonical);
  }

  canonicalPayload(action: MetaAdsCanonicalActionLike): MetaAdsCanonicalActionLike {
    return Object.fromEntries(Object.entries({
      actionType: action.actionType,
      adAccountId: action.adAccountId,
      campaignId: action.campaignId,
      adSetId: action.adSetId,
      creativeId: action.creativeId,
      adId: action.adId,
      internalAdGroupId: action.internalAdGroupId,
      internalProductIds: action.internalProductIds,
      name: action.name,
      objective: action.objective,
      status: action.status,
      buyingType: action.buyingType,
      specialAdCategories: action.specialAdCategories,
      specialAdCategoryCountries: action.specialAdCategoryCountries,
      budgetMode: action.budgetMode,
      budgetType: action.budgetType,
      dailyBudgetVnd: action.dailyBudgetVnd,
      lifetimeBudgetVnd: action.lifetimeBudgetVnd,
      bidStrategy: action.bidStrategy,
      bidAmountVnd: action.bidAmountVnd,
      spendCapVnd: action.spendCapVnd,
      startTime: action.startTime,
      stopTime: action.stopTime,
      appId: action.appId,
      optimizationGoal: action.optimizationGoal,
      billingEvent: action.billingEvent,
      destinationType: action.destinationType,
      targetingCountries: action.targetingCountries,
      ageMin: action.ageMin,
      ageMax: action.ageMax,
      genders: action.genders,
      publisherPlatforms: action.publisherPlatforms,
      facebookPositions: action.facebookPositions,
      instagramPositions: action.instagramPositions,
      pageId: action.pageId,
      instagramActorId: action.instagramActorId,
      pixelId: action.pixelId,
      applicationId: action.applicationId,
      objectStoreUrl: action.objectStoreUrl,
      customEventType: action.customEventType,
      message: action.message,
      headline: action.headline,
      description: action.description,
      callToActionType: action.callToActionType,
      destinationUrl: action.destinationUrl,
      imageHash: action.imageHash,
      videoId: action.videoId,
      urlTags: action.urlTags,
    }).filter(([, value]) => value !== undefined)) as unknown as MetaAdsCanonicalActionLike;
  }

  stateHash(snapshot?: MetaAdsResourceSnapshot | Record<string, unknown> | null): string {
    return metaAdsCanonicalHash(snapshot || null);
  }

  async executionContext(adAccountIdInput: string): Promise<{
    graphApiVersion: 'v25.0';
    credentialReferenceId: string;
  }> {
    const adAccountId = this.numericId(adAccountIdInput, 'adAccountId');
    const credential = await this.credential(adAccountId);
    return {
      graphApiVersion: this.graphApiVersion(),
      credentialReferenceId: credential.credentialReferenceId,
    };
  }

  async validateOnly(
    action: MetaAdsCanonicalActionLike,
    expectedCredentialReferenceId?: string,
  ): Promise<MetaAdsProviderMutationResult> {
    return this.postMutation(action, true, expectedCredentialReferenceId);
  }

  async mutate(
    action: MetaAdsCanonicalActionLike,
    expectedCredentialReferenceId?: string,
  ): Promise<MetaAdsProviderMutationResult> {
    return this.postMutation(action, false, expectedCredentialReferenceId);
  }

  async readCampaign(
    adAccountIdInput: string,
    campaignIdInput: string,
    options: { attempts?: number; expectedCredentialReferenceId?: string } = {},
  ): Promise<MetaAdsCampaignSnapshot> {
    const adAccountId = this.numericId(adAccountIdInput, 'adAccountId');
    const campaignId = this.numericId(campaignIdInput, 'campaignId');
    const credential = await this.credential(adAccountId, options.expectedCredentialReferenceId);
    const attempts = Math.min(3, Math.max(1, Number(options.attempts) || 3));
    let lastError: any;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const query = new URLSearchParams({
          fields: [
            'id',
            'account_id',
            'name',
            'objective',
            'status',
            'effective_status',
            'buying_type',
            'special_ad_categories',
            'special_ad_category_country',
            'daily_budget',
            'lifetime_budget',
            'bid_strategy',
            'spend_cap',
            'start_time',
            'stop_time',
            'promoted_object',
            'updated_time',
          ].join(','),
        });
        const response = await this.request({
          method: 'GET',
          path: `/${campaignId}?${query.toString()}`,
          credential,
        });
        if (response.status >= 200 && response.status < 300 && response.data?.id) {
          return this.snapshot(response.data, adAccountId, campaignId);
        }
        throw this.responseError(response);
      } catch (error: any) {
        lastError = error;
        if (attempt < attempts) await this.readRetryDelay(attempt);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new MetaAdsProviderError('Meta campaign readback failed.', 'unknown');
  }

  async readAdSet(
    adAccountIdInput: string,
    adSetIdInput: string,
    options: { attempts?: number; expectedCredentialReferenceId?: string } = {},
  ): Promise<MetaAdsAdSetSnapshot> {
    const adAccountId = this.numericId(adAccountIdInput, 'adAccountId');
    const adSetId = this.numericId(adSetIdInput, 'adSetId');
    const data = await this.readNode(
      adAccountId,
      adSetId,
      [
        'id', 'account_id', 'campaign_id', 'name', 'status', 'effective_status',
        'daily_budget', 'lifetime_budget', 'bid_strategy', 'bid_amount',
        'optimization_goal', 'billing_event', 'destination_type', 'targeting',
        'promoted_object', 'start_time', 'end_time', 'updated_time',
      ],
      options,
    );
    return this.adSetSnapshot(data, adAccountId, adSetId);
  }

  async readAdCreative(
    adAccountIdInput: string,
    creativeIdInput: string,
    options: { attempts?: number; expectedCredentialReferenceId?: string } = {},
  ): Promise<MetaAdsAdCreativeSnapshot> {
    const adAccountId = this.numericId(adAccountIdInput, 'adAccountId');
    const creativeId = this.numericId(creativeIdInput, 'creativeId');
    const data = await this.readNode(
      adAccountId,
      creativeId,
      ['id', 'account_id', 'name', 'object_story_spec', 'url_tags'],
      options,
    );
    return this.adCreativeSnapshot(data, adAccountId, creativeId);
  }

  async readAd(
    adAccountIdInput: string,
    adIdInput: string,
    options: { attempts?: number; expectedCredentialReferenceId?: string } = {},
  ): Promise<MetaAdsAdSnapshot> {
    const adAccountId = this.numericId(adAccountIdInput, 'adAccountId');
    const adId = this.numericId(adIdInput, 'adId');
    const data = await this.readNode(
      adAccountId,
      adId,
      [
        'id', 'account_id', 'adset_id', 'creative{id}', 'name', 'status',
        'effective_status', 'updated_time',
      ],
      options,
    );
    return this.adSnapshot(data, adAccountId, adId);
  }

  private async readNode(
    adAccountId: string,
    resourceId: string,
    fields: string[],
    options: { attempts?: number; expectedCredentialReferenceId?: string },
  ): Promise<any> {
    const credential = await this.credential(
      adAccountId,
      options.expectedCredentialReferenceId,
    );
    const attempts = Math.min(3, Math.max(1, Number(options.attempts) || 3));
    let lastError: any;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const query = new URLSearchParams({ fields: fields.join(',') });
        const response = await this.request({
          method: 'GET',
          path: `/${resourceId}?${query.toString()}`,
          credential,
        });
        if (response.status >= 200 && response.status < 300 && response.data?.id) {
          return response.data;
        }
        throw this.responseError(response);
      } catch (error: any) {
        lastError = error;
        if (attempt < attempts) await this.readRetryDelay(attempt);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new MetaAdsProviderError('Meta resource readback failed.', 'unknown');
  }

  private async postMutation(
    action: MetaAdsCanonicalActionLike,
    validateOnly: boolean,
    expectedCredentialReferenceId?: string,
  ): Promise<MetaAdsProviderMutationResult> {
    const operation = this.buildMutation(action);
    const credential = await this.credential(operation.adAccountId, expectedCredentialReferenceId);
    const body = new URLSearchParams(operation.fields);
    if (validateOnly) body.set('execution_options', JSON.stringify(['validate_only']));

    let response: MetaAdsHttpResponse;
    try {
      // Deliberately one request. POST mutations are never retried here.
      response = await this.request({
        method: 'POST',
        path: operation.path,
        credential,
        body: body.toString(),
      });
    } catch (error: any) {
      if (error instanceof MetaAdsProviderError) throw error;
      throw new MetaAdsProviderError(
        redactSecretString(String(error?.message || 'Meta provider request outcome is unknown.')),
        'unknown',
      );
    }

    if (response.status < 200 || response.status >= 300 || response.data?.error) {
      throw this.responseError(response);
    }
    const responseId = response.data?.id ? this.optionalNumericId(response.data.id) : undefined;
    const campaignId = action.actionType === 'create_campaign'
      ? responseId
      : operation.campaignId;
    const adSetId = action.actionType === 'create_ad_set'
      ? responseId
      : operation.adSetId;
    const creativeId = action.actionType === 'create_ad_creative'
      ? responseId
      : operation.creativeId;
    const adId = action.actionType === 'create_ad' ? responseId : operation.adId;
    if (!validateOnly && action.actionType.startsWith('create_') && !responseId) {
      throw new MetaAdsProviderError(
        'Meta create returned no canonical provider resource ID.',
        'unknown',
        this.requestId(response.headers),
      );
    }
    return {
      providerRequestId: this.requestId(response.headers),
      resourceId: responseId
        || adId || creativeId || adSetId || campaignId,
      campaignId,
      adSetId,
      creativeId,
      adId,
      response: redactSecrets(response.data || {}),
      credentialReferenceId: credential.credentialReferenceId,
    };
  }

  private async request(input: {
    method: 'GET' | 'POST';
    path: string;
    credential: MetaAdsExecutionCredential;
    body?: string;
  }): Promise<MetaAdsHttpResponse> {
    const response = await this.transport.request({
      method: input.method,
      url: `https://graph.facebook.com/${this.graphApiVersion()}${input.path}`,
      headers: {
        Authorization: `Bearer ${input.credential.accessToken}`,
        Accept: 'application/json',
        ...(input.method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: input.body,
      timeoutMs: this.timeoutMs(),
    });
    return response;
  }

  private async credential(
    adAccountId: string,
    expectedCredentialReferenceId?: string,
  ): Promise<MetaAdsExecutionCredential> {
    const credential = await this.apiTokenService.getMetaAdsExecutionCredential(adAccountId);
    if (!credential
      || credential.adAccountId !== adAccountId
      || (expectedCredentialReferenceId
        && credential.credentialReferenceId !== expectedCredentialReferenceId)) {
      throw new BadRequestException('No fresh encrypted Meta execution credential is bound to this exact ad account.');
    }
    return credential;
  }

  private snapshot(data: any, expectedAccountId: string, expectedCampaignId: string): MetaAdsCampaignSnapshot {
    const campaignId = this.numericId(data?.id, 'provider campaignId');
    const accountId = this.numericId(data?.account_id, 'provider adAccountId');
    if (campaignId !== expectedCampaignId || accountId !== expectedAccountId) {
      throw new MetaAdsProviderError('Meta readback identity does not match the requested campaign.', 'unknown');
    }
    const dailyBudgetVnd = this.optionalVndAmount(data?.daily_budget);
    const lifetimeBudgetVnd = this.optionalVndAmount(data?.lifetime_budget);
    const providerCategories = Array.isArray(data?.special_ad_categories)
      ? data.special_ad_categories.map((item: unknown) => String(item).trim().toUpperCase())
      : [];
    const budgetType = dailyBudgetVnd !== undefined
      ? 'DAILY'
      : lifetimeBudgetVnd !== undefined
        ? 'LIFETIME'
        : 'NONE';
    return {
      resourceType: 'CAMPAIGN',
      adAccountId: accountId,
      campaignId,
      name: String(data?.name || '').trim(),
      objective: String(data?.objective || '').trim(),
      status: String(data?.status || '').trim().toUpperCase(),
      effectiveStatus: data?.effective_status
        ? String(data.effective_status).trim().toUpperCase()
        : undefined,
      buyingType: String(data?.buying_type || '').trim().toUpperCase(),
      specialAdCategories: providerCategories.length ? providerCategories : ['NONE'],
      specialAdCategoryCountries: Array.isArray(data?.special_ad_category_country)
        ? data.special_ad_category_country.map((item: unknown) => String(item).trim().toUpperCase())
        : [],
      budgetMode: budgetType === 'NONE' ? 'ABO' : 'CBO',
      budgetType,
      dailyBudgetVnd,
      lifetimeBudgetVnd,
      bidStrategy: this.optionalText(data?.bid_strategy)?.toUpperCase(),
      spendCapVnd: this.optionalVndAmount(data?.spend_cap),
      startTime: this.optionalIsoTime(data?.start_time),
      stopTime: this.optionalIsoTime(data?.stop_time),
      appId: this.optionalNumericId(data?.promoted_object?.application_id),
      providerUpdatedAt: data?.updated_time ? String(data.updated_time) : undefined,
    };
  }

  private adSetSnapshot(
    data: any,
    expectedAccountId: string,
    expectedAdSetId: string,
  ): MetaAdsAdSetSnapshot {
    const adSetId = this.numericId(data?.id, 'provider adSetId');
    const accountId = this.numericId(data?.account_id, 'provider adAccountId');
    const campaignId = this.numericId(data?.campaign_id, 'provider campaignId');
    if (adSetId !== expectedAdSetId || accountId !== expectedAccountId) {
      throw new MetaAdsProviderError(
        'Meta Ad Set readback identity does not match the requested resource.',
        'unknown',
      );
    }
    const dailyBudgetVnd = this.optionalVndAmount(data?.daily_budget);
    const lifetimeBudgetVnd = this.optionalVndAmount(data?.lifetime_budget);
    const budgetType = dailyBudgetVnd !== undefined
      ? 'DAILY'
      : lifetimeBudgetVnd !== undefined
        ? 'LIFETIME'
        : 'NONE';
    const targeting = data?.targeting || {};
    const promoted = data?.promoted_object || {};
    return {
      resourceType: 'AD_SET',
      adAccountId: accountId,
      campaignId,
      adSetId,
      name: String(data?.name || '').trim(),
      status: String(data?.status || '').trim().toUpperCase(),
      effectiveStatus: data?.effective_status
        ? String(data.effective_status).trim().toUpperCase()
        : undefined,
      budgetMode: budgetType === 'NONE' ? 'CBO' : 'ABO',
      budgetType,
      dailyBudgetVnd,
      lifetimeBudgetVnd,
      bidStrategy: this.optionalText(data?.bid_strategy)?.toUpperCase(),
      bidAmountVnd: this.optionalVndAmount(data?.bid_amount),
      optimizationGoal: String(data?.optimization_goal || '').trim().toUpperCase(),
      billingEvent: String(data?.billing_event || '').trim().toUpperCase(),
      destinationType: String(data?.destination_type || '').trim().toUpperCase(),
      targetingCountries: this.upperStringArray(targeting?.geo_locations?.countries),
      ageMin: this.optionalBoundedInteger(targeting?.age_min, 18, 65),
      ageMax: this.optionalBoundedInteger(targeting?.age_max, 18, 65),
      genders: this.numericSnapshotChoices(targeting?.genders, [1, 2]) as Array<1 | 2>,
      publisherPlatforms: this.upperStringArray(targeting?.publisher_platforms),
      facebookPositions: this.upperStringArray(targeting?.facebook_positions),
      instagramPositions: this.upperStringArray(targeting?.instagram_positions),
      pageId: this.optionalNumericId(promoted?.page_id),
      pixelId: this.optionalNumericId(promoted?.pixel_id),
      applicationId: this.optionalNumericId(promoted?.application_id),
      objectStoreUrl: this.optionalHttpsUrl(promoted?.object_store_url),
      customEventType: this.optionalText(promoted?.custom_event_type)?.toUpperCase(),
      startTime: this.optionalIsoTime(data?.start_time),
      stopTime: this.optionalIsoTime(data?.end_time),
      providerUpdatedAt: data?.updated_time ? String(data.updated_time) : undefined,
    };
  }

  private adCreativeSnapshot(
    data: any,
    expectedAccountId: string,
    expectedCreativeId: string,
  ): MetaAdsAdCreativeSnapshot {
    const creativeId = this.numericId(data?.id, 'provider creativeId');
    const accountId = this.numericId(data?.account_id, 'provider adAccountId');
    if (creativeId !== expectedCreativeId || accountId !== expectedAccountId) {
      throw new MetaAdsProviderError(
        'Meta Ad Creative readback identity does not match the requested resource.',
        'unknown',
      );
    }
    const story = data?.object_story_spec || {};
    const content = story?.link_data || story?.video_data || {};
    const cta = content?.call_to_action || {};
    const destinationUrl = content?.link || cta?.value?.link;
    return {
      resourceType: 'AD_CREATIVE',
      adAccountId: accountId,
      creativeId,
      name: String(data?.name || '').trim(),
      pageId: this.numericId(story?.page_id, 'provider pageId'),
      instagramActorId: this.optionalNumericId(story?.instagram_user_id),
      message: String(content?.message || '').trim(),
      headline: String(content?.name || content?.title || '').trim(),
      description: String(content?.description || content?.link_description || '').trim(),
      callToActionType: String(cta?.type || '').trim().toUpperCase(),
      destinationUrl: this.httpsUrl(destinationUrl, 'provider destinationUrl'),
      imageHash: content?.image_hash ? this.imageHash(content.image_hash) : undefined,
      videoId: this.optionalNumericId(content?.video_id),
      urlTags: this.optionalText(data?.url_tags),
    };
  }

  private adSnapshot(
    data: any,
    expectedAccountId: string,
    expectedAdId: string,
  ): MetaAdsAdSnapshot {
    const adId = this.numericId(data?.id, 'provider adId');
    const accountId = this.numericId(data?.account_id, 'provider adAccountId');
    if (adId !== expectedAdId || accountId !== expectedAccountId) {
      throw new MetaAdsProviderError(
        'Meta Ad readback identity does not match the requested resource.',
        'unknown',
      );
    }
    return {
      resourceType: 'AD',
      adAccountId: accountId,
      adSetId: this.numericId(data?.adset_id, 'provider adSetId'),
      creativeId: this.numericId(data?.creative?.id, 'provider creativeId'),
      adId,
      name: String(data?.name || '').trim(),
      status: String(data?.status || '').trim().toUpperCase(),
      effectiveStatus: data?.effective_status
        ? String(data.effective_status).trim().toUpperCase()
        : undefined,
      providerUpdatedAt: data?.updated_time ? String(data.updated_time) : undefined,
    };
  }

  private responseError(response: MetaAdsHttpResponse): MetaAdsProviderError {
    const error = response.data?.error || {};
    const requestId = this.requestId(response.headers) || this.optionalText(error?.fbtrace_id);
    const message = redactSecretString(String(error?.message || `Meta API HTTP ${response.status}`));
    return new MetaAdsProviderError(
      message,
      response.status >= 400 && response.status < 500 ? 'definitive_failure' : 'unknown',
      requestId,
      error?.code !== undefined ? String(error.code) : undefined,
    );
  }

  private requestId(headers?: MetaAdsHttpResponse['headers']): string | undefined {
    const value = headers instanceof Headers
      ? headers.get('x-fb-trace-id') || headers.get('x-fb-request-id')
      : headers?.['x-fb-trace-id'] || headers?.['x-fb-request-id'];
    return this.optionalText(value);
  }

  private rejectRawOrUnknownFields(action: MetaAdsCanonicalActionLike): void {
    const allowedByType: Record<string, Set<string>> = {
      create_campaign: new Set([
        'actionType', 'adAccountId', 'name', 'objective', 'status', 'buyingType',
        'specialAdCategories', 'specialAdCategoryCountries', 'budgetMode', 'budgetType',
        'dailyBudgetVnd', 'lifetimeBudgetVnd', 'bidStrategy', 'spendCapVnd',
        'startTime', 'stopTime', 'appId',
      ]),
      create_ad_set: new Set([
        'actionType', 'adAccountId', 'campaignId', 'internalAdGroupId',
        'internalProductIds', 'name', 'status', 'budgetMode', 'budgetType',
        'dailyBudgetVnd', 'lifetimeBudgetVnd', 'bidStrategy', 'bidAmountVnd',
        'optimizationGoal', 'billingEvent', 'destinationType',
        'targetingCountries', 'ageMin', 'ageMax', 'genders',
        'publisherPlatforms', 'facebookPositions', 'instagramPositions',
        'startTime', 'stopTime', 'pageId', 'pixelId', 'applicationId',
        'objectStoreUrl', 'customEventType',
      ]),
      pause_ad_set: new Set([
        'actionType', 'adAccountId', 'campaignId', 'adSetId',
      ]),
      create_ad_creative: new Set([
        'actionType', 'adAccountId', 'name', 'pageId', 'instagramActorId',
        'message', 'headline', 'description', 'callToActionType',
        'destinationUrl', 'imageHash', 'videoId', 'urlTags',
      ]),
      create_ad: new Set([
        'actionType', 'adAccountId', 'adSetId', 'creativeId', 'name',
        'status',
      ]),
      update_campaign: new Set([
        'actionType', 'adAccountId', 'campaignId', 'name', 'budgetMode', 'budgetType',
        'dailyBudgetVnd', 'lifetimeBudgetVnd', 'spendCapVnd', 'stopTime',
      ]),
      pause_campaign: new Set(['actionType', 'adAccountId', 'campaignId']),
    };
    const allowed = allowedByType[action?.actionType];
    if (!allowed || Object.keys(action || {}).some((key) => !allowed.has(key))) {
      throw new BadRequestException('Meta canonical action contains an unknown or raw provider field.');
    }
  }

  private numericId(value: unknown, field: string): string {
    const normalized = String(value || '').trim().replace(/^act_/i, '');
    if (!/^\d+$/.test(normalized)) throw new BadRequestException(`${field} must be a numeric Meta provider ID.`);
    return normalized;
  }

  private optionalNumericId(value: unknown): string | undefined {
    const normalized = String(value || '').trim();
    return /^\d+$/.test(normalized) ? normalized : undefined;
  }

  private name(value: unknown): string {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length > 400) throw new BadRequestException('Meta campaign name is invalid.');
    return normalized;
  }

  private vndAmount(value: unknown, field: string): string {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException(`Meta campaign ${field} must be a positive integer.`);
    }
    return String(amount);
  }

  private providerPromotedObject(
    action: MetaAdsCanonicalActionLike,
  ): Record<string, string> {
    const promoted: Record<string, string> = {};
    if (action.pageId !== undefined) {
      promoted.page_id = this.numericId(action.pageId, 'pageId');
    }
    if (action.pixelId !== undefined) {
      promoted.pixel_id = this.numericId(action.pixelId, 'pixelId');
    }
    if (action.applicationId !== undefined) {
      promoted.application_id = this.numericId(action.applicationId, 'applicationId');
    }
    if (action.objectStoreUrl !== undefined) {
      promoted.object_store_url = this.httpsUrl(action.objectStoreUrl, 'objectStoreUrl');
    }
    if (action.customEventType !== undefined) {
      const event = String(action.customEventType).trim().toUpperCase();
      if (!META_CUSTOM_EVENT_TYPES.has(event)) {
        throw new BadRequestException('Unsupported Meta customEventType.');
      }
      promoted.custom_event_type = event;
    }
    if (Boolean(promoted.pixel_id) !== Boolean(promoted.custom_event_type)) {
      throw new BadRequestException('pixelId and customEventType must be supplied together.');
    }
    if (Boolean(promoted.application_id) !== Boolean(promoted.object_store_url)) {
      throw new BadRequestException(
        'applicationId and objectStoreUrl must be supplied together.',
      );
    }
    return promoted;
  }

  private integerRange(value: unknown, field: string, min: number, max: number): number {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw new BadRequestException(`${field} must be an integer between ${min} and ${max}.`);
    }
    return number;
  }

  private numericChoices(value: unknown, allowed: number[], field: string): number[] {
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException(`${field} must be a non-empty array.`);
    }
    const normalized = value.map((item) => Number(item));
    if (new Set(normalized).size !== normalized.length
      || normalized.some((item) => !allowed.includes(item))) {
      throw new BadRequestException(`${field} contains an unsupported or duplicate value.`);
    }
    return normalized.sort();
  }

  private lowercaseChoices(value: unknown, allowed: string[], field: string): string[] {
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException(`${field} must be a non-empty array.`);
    }
    const normalized = value.map((item) => String(item || '').trim().toUpperCase());
    if (new Set(normalized).size !== normalized.length
      || normalized.some((item) => !allowed.includes(item))) {
      throw new BadRequestException(`${field} contains an unsupported or duplicate value.`);
    }
    return normalized.sort().map((item) => item.toLowerCase());
  }

  private text(value: unknown, field: string, max: number): string {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length > max
      || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
      throw new BadRequestException(`${field} is missing or invalid.`);
    }
    return normalized;
  }

  private httpsUrl(value: unknown, field: string): string {
    const text = String(value || '').trim();
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new BadRequestException(`${field} must be a valid HTTPS URL.`);
    }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
      throw new BadRequestException(`${field} must be a credential-free HTTPS URL.`);
    }
    url.hash = '';
    return url.toString();
  }

  private optionalHttpsUrl(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    try {
      return this.httpsUrl(value, 'provider URL');
    } catch {
      return undefined;
    }
  }

  private imageHash(value: unknown): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(normalized)) {
      throw new BadRequestException('imageHash must be a 32-character hex value.');
    }
    return normalized;
  }

  private upperStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(
      value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean),
    )].sort();
  }

  private numericSnapshotChoices(value: unknown, allowed: number[]): number[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(
      value.map((item) => Number(item)).filter(
        (item) => Number.isSafeInteger(item) && allowed.includes(item),
      ),
    )].sort();
  }

  private optionalBoundedInteger(
    value: unknown,
    min: number,
    max: number,
  ): number | undefined {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= min && number <= max
      ? number
      : undefined;
  }

  private specialAdCategories(value: unknown): string[] {
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException('specialAdCategories must contain at least one canonical value.');
    }
    const normalized = value.map((item) => String(item || '').trim().toUpperCase());
    if (new Set(normalized).size !== normalized.length
      || normalized.some((item) => !META_SPECIAL_AD_CATEGORIES.has(item))
      || (normalized.includes('NONE') && normalized.length !== 1)) {
      throw new BadRequestException('Meta special ad categories are invalid or NONE is not exclusive.');
    }
    return normalized;
  }

  private countryCodes(value: unknown): string[] {
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException('Special ad categories require at least one country code.');
    }
    const normalized = value.map((item) => String(item || '').trim().toUpperCase());
    if (new Set(normalized).size !== normalized.length
      || normalized.some((item) => !/^[A-Z]{2}$/.test(item))) {
      throw new BadRequestException('specialAdCategoryCountries must contain unique ISO alpha-2 codes.');
    }
    return normalized;
  }

  private isoTime(value: unknown, field: string): string {
    const text = String(value || '').trim();
    const date = new Date(text);
    if (!text || Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO timestamp.`);
    }
    return date.toISOString();
  }

  private optionalIsoTime(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private optionalVndAmount(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : undefined;
  }

  private optionalText(value: unknown): string | undefined {
    const normalized = redactSecretString(String(value || '').trim());
    return normalized || undefined;
  }

  private timeoutMs(): number {
    const configured = Number(process.env.META_ADS_MUTATION_TIMEOUT_MS);
    if (!Number.isFinite(configured)) return 30_000;
    return Math.min(120_000, Math.max(5_000, Math.floor(configured)));
  }

  private async readRetryDelay(attempt: number): Promise<void> {
    const delayMs = Math.min(1_000, Math.max(50, 200 * attempt));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
