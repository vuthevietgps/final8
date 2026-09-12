import { Injectable } from '@nestjs/common';
import { getGoogleAdsApiVersion } from '../common/ads-api-version';
import {
  GOOGLE_ADS_BIDDING_STRATEGIES,
  GOOGLE_ADS_ERP_ACTION_TYPES,
  GOOGLE_ADS_POSITIVE_GEO_TARGET_TYPES,
} from './dto/create-google-ads-action-plan.dto';

@Injectable()
export class GoogleAdsCapabilitiesService {
  getCapabilities() {
    return {
      schemaVersion: 'v1',
      provider: 'google',
      googleAdsApiVersion: getGoogleAdsApiVersion(),
      productionEnabled: this.enabled('GOOGLE_ADS_PRODUCTION_ENABLED')
        && this.enabled('AI_MARKETING_PROVIDER_EXECUTION_ENABLED')
        && !this.enabled('AI_MARKETING_DRY_RUN'),
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      campaignTypes: ['SEARCH'],
      biddingStrategies: [...GOOGLE_ADS_BIDDING_STRATEGIES],
      positiveGeoTargetTypes: [...GOOGLE_ADS_POSITIVE_GEO_TARGET_TYPES],
      defaultTargeting: {
        geoTargetConstantIds: ['2704'],
        languageConstantIds: ['1040'],
        positiveGeoTargetType: 'PRESENCE',
        provenance: 'ERP-curated defaults; provider validateOnly verifies every plan.',
      },
      targetingOptions: {
        geoTargets: [{ id: '2704', label: 'Vietnam', provenance: 'ERP-curated' }],
        languages: [{ id: '1040', label: 'Vietnamese', provenance: 'ERP-curated' }],
      },
      liveActionGates: {
        create: this.enabled('GOOGLE_ADS_CAMPAIGN_CREATE_ENABLED'),
        update: this.enabled('GOOGLE_ADS_CAMPAIGN_UPDATE_ENABLED'),
        biddingStrategyUpdate: this.enabled(
          'GOOGLE_ADS_CAMPAIGN_BIDDING_UPDATE_ENABLED',
        ),
        pause: this.enabled('GOOGLE_ADS_CAMPAIGN_PAUSE_ENABLED'),
        resume: this.enabled('GOOGLE_ADS_CAMPAIGN_RESUME_ENABLED'),
        adGroup: {
          create: this.enabled('GOOGLE_ADS_AD_GROUP_CREATE_ENABLED'),
          update: this.enabled('GOOGLE_ADS_AD_GROUP_UPDATE_ENABLED'),
          pause: this.enabled('GOOGLE_ADS_AD_GROUP_PAUSE_ENABLED'),
          resume: this.enabled('GOOGLE_ADS_AD_GROUP_RESUME_ENABLED'),
        },
        keyword: {
          create: this.enabled('GOOGLE_ADS_KEYWORD_CREATE_ENABLED'),
          update: this.enabled('GOOGLE_ADS_KEYWORD_UPDATE_ENABLED'),
          pause: this.enabled('GOOGLE_ADS_KEYWORD_PAUSE_ENABLED'),
          resume: this.enabled('GOOGLE_ADS_KEYWORD_RESUME_ENABLED'),
        },
        responsiveSearchAd: {
          create: this.enabled('GOOGLE_ADS_RSA_CREATE_ENABLED'),
          update: this.enabled('GOOGLE_ADS_RSA_UPDATE_ENABLED'),
          pause: this.enabled('GOOGLE_ADS_RSA_PAUSE_ENABLED'),
          resume: this.enabled('GOOGLE_ADS_RSA_RESUME_ENABLED'),
        },
        default: 'disabled',
      },
      invariants: {
        createStatus: 'PAUSED',
        advertisingChannelType: 'SEARCH',
        budgetDeliveryMethod: 'STANDARD',
        budgetExplicitlyShared: false,
        targetGoogleSearch: true,
        targetContentNetwork: false,
        targetPartnerSearchNetwork: false,
        searchPartnersDefault: false,
        containsEuPoliticalAdvertising:
          'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
        rawProviderPayloadAccepted: false,
        credentialsAcceptedFromBrowser: false,
      },
      actions: {
        create_search_campaign: {
          requiredFields: [
            'customerId',
            'reason',
            'payload.campaignName',
            'payload.dailyBudgetVnd',
            'payload.startDate',
            'payload.geoTargetConstantIds',
            'payload.languageConstantIds',
            'payload.doesNotContainEuPoliticalAdvertising',
          ],
          optionalFields: [
            'idempotencyKey',
            'payload.budgetName',
            'payload.endDate',
            'payload.biddingStrategyType',
            'payload.maxCpcBidCeilingVnd',
            'payload.targetCpaVnd',
            'payload.searchPartnersEnabled',
            'payload.positiveGeoTargetType',
          ],
          forcedFields: {
            status: 'PAUSED',
            advertisingChannelType: 'SEARCH',
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false,
          },
        },
        update_search_campaign: {
          requiredFields: ['customerId', 'campaignId', 'reason'],
          optionalFields: [
            'idempotencyKey',
            'payload.campaignName',
            'payload.endDate',
            'payload.dailyBudgetVnd',
          ],
          constraints: [
            'only name and a non-extending endDate are mutable on Campaign',
            'dailyBudgetVnd is expanded into a separate update_campaign_budget action',
          ],
        },
        update_campaign_bidding_strategy: {
          requiredFields: [
            'customerId',
            'campaignId',
            'reason',
            'payload.biddingStrategyType',
          ],
          optionalFields: [
            'idempotencyKey',
            'payload.maxCpcBidCeilingVnd',
            'payload.targetCpaVnd',
          ],
          constraints: [
            'MAXIMIZE_CLICKS maps to targetSpend; CPC ceiling is optional',
            'MAXIMIZE_CONVERSIONS maps to maximizeConversions; target CPA is optional',
            'portfolio bidding strategies are blocked',
            'conversion bidding remains fail-closed without canonical primary action and biddable goal evidence',
          ],
        },
        update_campaign_budget: {
          requiredFields: [
            'customerId',
            'campaignId',
            'reason',
            'payload.dailyBudgetVnd',
          ],
          optionalFields: ['idempotencyKey'],
          constraints: [
            'campaignBudgetId is resolved only from canonical synced ERP data',
            'budget increases remain subject to Financial Control',
          ],
        },
        pause_campaign: {
          requiredFields: ['customerId', 'campaignId', 'reason'],
          optionalFields: ['idempotencyKey'],
          payloadMustBeEmpty: true,
          forcedFields: { status: 'PAUSED' },
        },
        create_ad_group: {
          requiredFields: ['customerId', 'campaignId', 'reason', 'payload.adGroupName'],
          optionalFields: ['idempotencyKey', 'payload.cpcBidVnd'],
          forcedFields: { status: 'PAUSED', type: 'SEARCH_STANDARD' },
        },
        update_ad_group: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'reason'],
          optionalFields: ['idempotencyKey', 'payload.adGroupName', 'payload.cpcBidVnd'],
        },
        pause_ad_group: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'reason'],
          optionalFields: ['idempotencyKey'],
          payloadMustBeEmpty: true,
          forcedFields: { status: 'PAUSED' },
        },
        create_keyword: {
          requiredFields: [
            'customerId', 'campaignId', 'adGroupId', 'reason',
            'payload.keywordText', 'payload.matchType',
          ],
          optionalFields: [
            'idempotencyKey', 'payload.cpcBidVnd', 'payload.finalUrl',
          ],
          forcedFields: { status: 'PAUSED' },
          constraints: [
            'matchType is EXACT, PHRASE, or BROAD',
            'negative keyword creation is disabled in this phase',
          ],
        },
        update_keyword: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'criterionId', 'reason'],
          optionalFields: ['idempotencyKey', 'payload.cpcBidVnd', 'payload.finalUrl'],
          constraints: ['positive keywords only; text, match type, and negative flag are immutable'],
        },
        pause_keyword: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'criterionId', 'reason'],
          optionalFields: ['idempotencyKey'],
          payloadMustBeEmpty: true,
          constraints: ['positive keywords only; Google does not allow updating negative criteria'],
        },
        create_responsive_search_ad: {
          requiredFields: [
            'customerId', 'campaignId', 'adGroupId', 'reason', 'payload.finalUrl',
            'payload.headlines', 'payload.descriptions',
          ],
          optionalFields: [
            'idempotencyKey', 'payload.path1', 'payload.path2',
            'payload.trackingUrlTemplate', 'payload.finalUrlSuffix',
            'payload.headlinePins', 'payload.descriptionPins',
          ],
          forcedFields: { status: 'PAUSED', adType: 'RESPONSIVE_SEARCH_AD' },
        },
        update_responsive_search_ad: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'adId', 'reason'],
          optionalFields: [
            'idempotencyKey', 'payload.finalUrl', 'payload.headlines',
            'payload.descriptions', 'payload.path1', 'payload.path2',
            'payload.trackingUrlTemplate', 'payload.finalUrlSuffix',
            'payload.headlinePins', 'payload.descriptionPins',
          ],
          constraints: [
            'headline/description replacement requires explicit pin arrays; [] intentionally clears pins',
          ],
        },
        pause_responsive_search_ad: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'adId', 'reason'],
          optionalFields: ['idempotencyKey'],
          payloadMustBeEmpty: true,
          forcedFields: { status: 'PAUSED' },
        },
        resume_responsive_search_ad: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'adId', 'reason'],
          optionalFields: ['idempotencyKey'],
          payloadMustBeEmpty: true,
          constraints: ['campaign must remain PAUSED; RSA must be policy APPROVED'],
        },
        resume_keyword: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'criterionId', 'reason'],
          optionalFields: ['idempotencyKey'],
          payloadMustBeEmpty: true,
          constraints: ['positive keyword only; campaign must remain PAUSED'],
        },
        resume_ad_group: {
          requiredFields: ['customerId', 'campaignId', 'adGroupId', 'reason'],
          optionalFields: ['idempotencyKey'],
          payloadMustBeEmpty: true,
          constraints: ['campaign must remain PAUSED; enabled keyword/RSA graph required'],
        },
        resume_campaign: {
          requiredFields: ['customerId', 'campaignId', 'reason'],
          optionalFields: ['idempotencyKey'],
          payloadMustBeEmpty: true,
          constraints: [
            'fresh coherent enabled Search delivery graph required',
            'MANUAL_CPC only until canonical primary conversion-action and biddable-goal evidence is synced',
          ],
        },
      },
      supportedActionTypes: [...GOOGLE_ADS_ERP_ACTION_TYPES],
      unsupportedCampaignTypes: [
        'PERFORMANCE_MAX',
        'SHOPPING',
        'DISPLAY',
        'VIDEO',
      ],
      unsupportedMutations: [
        'delete',
        'auto_publish',
        'update_negative_keyword',
        'pause_negative_keyword',
        'create_negative_keyword',
        'resume_negative_keyword',
      ],
      readiness: {
        endpoint: '/api/google-ads/lookups/readiness/:customerId/:campaignId',
        source: 'canonical_google_ads_readonly_sync',
        conversionMutationSupported: false,
        conversionBiddingSupported: true,
        conversionBiddingRequires: [
          'fresh ENABLED conversion_action with primary_for_goal=true',
          'fresh matching campaign_conversion_goal with biddable=true',
          'conversion_goal_campaign_config without unsupported custom goal',
        ],
        trackingDomainAllowlistRequired: true,
      },
      biddingLifecycle: {
        supported: true,
        draftOnly: true,
        defaultEnabled: false,
        defaultClickThreshold: 50,
        stages: [
          'MAXIMIZE_CLICKS',
          'MAXIMIZE_CLICKS_CPC_CEILING',
          'MAXIMIZE_CONVERSIONS',
          'MAXIMIZE_CONVERSIONS_TARGET_CPA',
        ],
        endpoint: '/api/google-ads/bidding-lifecycle/:customerId/:campaignId',
      },
      workflow: [
        'erp_plan',
        'provider_validate_only',
        'approval',
        'live_execution_gate',
        'erp_provider_mutate',
        'readback',
      ],
    };
  }

  private enabled(name: string) {
    return String(process.env[name] || '').trim().toLowerCase() === 'true';
  }
}
