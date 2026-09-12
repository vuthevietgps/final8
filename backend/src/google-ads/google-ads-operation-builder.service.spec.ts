import { BadRequestException } from '@nestjs/common';
import { GoogleAdsOperationBuilderService } from './google-ads-operation-builder.service';

describe('GoogleAdsOperationBuilderService', () => {
  const builder = new GoogleAdsOperationBuilderService();

  afterEach(() => {
    delete process.env.GOOGLE_ADS_TRACKING_DOMAIN_ALLOWLIST;
  });

  it('builds a paused Search campaign server-side and ignores raw provider payload fields', () => {
    const operations = builder.build({
      actionType: 'create_search_campaign',
      customerId: '1234567890',
      typedPayload: {
        campaignName: 'Search - Safe Draft',
        budgetName: 'Budget - Safe Draft',
        dailyBudget: 500000,
        advertisingChannelType: 'SEARCH',
        status: 'PAUSED',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
        startDate: '2026-06-13',
        searchPartnersEnabled: false,
        positiveGeoTargetType: 'PRESENCE',
        geoTargetConstantIds: ['2704'],
        languageConstantIds: ['1040'],
        doesNotContainEuPoliticalAdvertising: true,
        finalUrl: 'https://htxbachgia.shop/',
        rawApiRequest: { mutateOperations: [{ campaignOperation: { create: { status: 'ENABLED' } } }] },
      },
    } as any);

    expect(operations).toHaveLength(4);
    expect(operations[1].campaignOperation.create.status).toBe('PAUSED');
    expect(operations[1].campaignOperation.create.advertisingChannelType).toBe('SEARCH');
    expect(JSON.stringify(operations)).not.toContain('rawApiRequest');
    expect(JSON.stringify(operations)).not.toContain('"ENABLED"');
    expect(operations[1].campaignOperation.create.networkSettings).toEqual({
      targetGoogleSearch: true,
      targetSearchNetwork: false,
      targetContentNetwork: false,
      targetPartnerSearchNetwork: false,
    });
    expect(operations[1].campaignOperation.create.containsEuPoliticalAdvertising)
      .toBe('DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING');
    expect(operations[2].campaignCriterionOperation.create.location.geoTargetConstant)
      .toBe('geoTargetConstants/2704');
    expect(operations[3].campaignCriterionOperation.create.language.languageConstant)
      .toBe('languageConstants/1040');
  });

  it('requires a real campaign budget identifier and never falls back to campaignId or adGroupId', () => {
    expect(() => builder.build({
      actionType: 'update_campaign_budget',
      customerId: '1234567890',
      typedPayload: {
        campaignId: '1111111111',
        adGroupId: '2222222222',
        dailyBudget: 600000,
      },
    } as any)).toThrow(BadRequestException);

    const operations = builder.build({
      actionType: 'update_campaign_budget',
      customerId: '1234567890',
      typedPayload: {
        campaignBudgetId: '3333333333',
        campaignId: '1111111111',
        dailyBudget: 600000,
      },
    } as any);
    expect(operations[0].campaignBudgetOperation.update.resourceName)
      .toBe('customers/1234567890/campaignBudgets/3333333333');
  });

  it('rejects an enabled create campaign before any provider call', () => {
    expect(() => builder.build({
      actionType: 'create_search_campaign',
      customerId: '1234567890',
      typedPayload: {
        status: 'ENABLED',
        advertisingChannelType: 'SEARCH',
      },
    } as any)).toThrow('must use status PAUSED');
  });

  it('updates only safe Search campaign fields with an exact update mask', () => {
    const operations = builder.build({
      actionType: 'update_search_campaign',
      customerId: '1234567890',
      typedPayload: {
        campaignId: '1111111111',
        campaignName: 'Safer Search name',
        endDate: '2026-08-31',
      },
    } as any);

    expect(operations).toEqual([{
      campaignOperation: {
        updateMask: 'name,end_date',
        update: {
          resourceName: 'customers/1234567890/campaigns/1111111111',
          name: 'Safer Search name',
          endDate: '20260831',
        },
      },
    }]);
  });

  it('maps Maximize Clicks lifecycle updates to targetSpend with a nested field mask', () => {
    expect(builder.build({
      actionType: 'update_campaign_bidding_strategy',
      customerId: '1234567890',
      typedPayload: {
        campaignId: '1111111111',
        biddingStrategyType: 'MAXIMIZE_CLICKS',
      },
    } as any)).toEqual([{
      campaignOperation: {
        updateMask: 'target_spend.cpc_bid_ceiling_micros',
        update: {
          resourceName: 'customers/1234567890/campaigns/1111111111',
        },
      },
    }]);

    expect(builder.build({
      actionType: 'update_campaign_bidding_strategy',
      customerId: '1234567890',
      typedPayload: {
        campaignId: '1111111111',
        biddingStrategyType: 'MAXIMIZE_CLICKS',
        maxCpcBidCeilingMicros: 2_500_000_000,
      },
    } as any)[0].campaignOperation).toEqual({
      updateMask: 'target_spend.cpc_bid_ceiling_micros',
      update: {
        resourceName: 'customers/1234567890/campaigns/1111111111',
        targetSpend: { cpcBidCeilingMicros: 2_500_000_000 },
      },
    });
  });

  it('maps Maximize Conversions lifecycle updates to optional target CPA', () => {
    expect(builder.build({
      actionType: 'update_campaign_bidding_strategy',
      customerId: '1234567890',
      typedPayload: {
        campaignId: '1111111111',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
      },
    } as any)[0].campaignOperation).toEqual({
      updateMask: 'maximize_conversions.target_cpa_micros',
      update: {
        resourceName: 'customers/1234567890/campaigns/1111111111',
      },
    });

    expect(builder.build({
      actionType: 'update_campaign_bidding_strategy',
      customerId: '1234567890',
      typedPayload: {
        campaignId: '1111111111',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
        targetCpaMicros: 75_000_000_000,
      },
    } as any)[0].campaignOperation).toEqual({
      updateMask: 'maximize_conversions.target_cpa_micros',
      update: {
        resourceName: 'customers/1234567890/campaigns/1111111111',
        maximizeConversions: { targetCpaMicros: 75_000_000_000 },
      },
    });
  });

  it('builds exact update/pause masks for the Search delivery stack', () => {
    expect(builder.build({
      actionType: 'update_ad_group', customerId: '1234567890', typedPayload: {
        adGroupId: '22', adGroupResourceName: 'customers/1234567890/adGroups/22',
        adGroupName: 'Core terms', cpcBidMicros: 2_000_000,
      },
    } as any)[0].adGroupOperation.updateMask).toBe('name,cpc_bid_micros');

    expect(builder.build({
      actionType: 'update_keyword', customerId: '1234567890', typedPayload: {
        adGroupId: '22', criterionId: '33',
        criterionResourceName: 'customers/1234567890/adGroupCriteria/22~33',
        cpcBidMicros: 3_000_000, finalUrl: 'https://htxbachgia.shop/product',
      },
    } as any)[0].adGroupCriterionOperation.updateMask).toBe('cpc_bid_micros,final_urls');

    expect(builder.build({
      actionType: 'pause_responsive_search_ad', customerId: '1234567890', typedPayload: {
        adGroupId: '22', adId: '44',
        adGroupAdResourceName: 'customers/1234567890/adGroupAds/22~44',
      },
    } as any)[0].adGroupAdOperation).toEqual({
      updateMask: 'status',
      update: {
        resourceName: 'customers/1234567890/adGroupAds/22~44',
        status: 'PAUSED',
      },
    });
  });

  it('updates RSA via Ad resource and rejects unsafe tracking or negative keywords', () => {
    process.env.GOOGLE_ADS_TRACKING_DOMAIN_ALLOWLIST = 'tracker.htxbachgia.shop';
    const operation = builder.build({
      actionType: 'update_responsive_search_ad', customerId: '1234567890', typedPayload: {
        adId: '44',
        finalUrl: 'https://htxbachgia.shop/product',
        headlines: ['Một', 'Hai', 'Ba'],
        headlinePins: [],
        trackingUrlTemplate: 'https://tracker.htxbachgia.shop/click?url={lpurl}',
        finalUrlSuffix: 'utm_source=google&utm_medium=cpc',
      },
    } as any)[0].adOperation;
    expect(operation.update.resourceName).toBe('customers/1234567890/ads/44');
    expect(operation.updateMask).toBe(
      'final_urls,responsive_search_ad.headlines,tracking_url_template,final_url_suffix',
    );

    expect(() => builder.build({
      actionType: 'create_keyword', customerId: '1234567890', typedPayload: {
        adGroupId: '22', keywordText: 'loại trừ', matchType: 'EXACT', negative: true,
      },
    } as any)).toThrow('Negative keyword creation is disabled');
    expect(() => builder.build({
      actionType: 'update_responsive_search_ad', customerId: '1234567890', typedPayload: {
        adId: '44', finalUrlSuffix: 'access_token=do-not-store',
      },
    } as any)).toThrow('secret-like');
    expect(() => builder.build({
      actionType: 'create_keyword', customerId: '1234567890', typedPayload: {
        adGroupId: '22', keywordText: 'bí mật', matchType: 'EXACT', negative: false,
        finalUrl: 'https://user:password@htxbachgia.shop/product',
      },
    } as any)).toThrow('without credentials');
    expect(() => builder.build({
      actionType: 'create_keyword', customerId: '1234567890', typedPayload: {
        adGroupId: '22', keywordText: 'bí mật', matchType: 'EXACT', negative: false,
        finalUrl: 'https://htxbachgia.shop/product?client_secret=do-not-store',
      },
    } as any)).toThrow('secret-like');
  });

  it('builds explicit resume operations and preserves intentional RSA pins', () => {
    expect(builder.build({
      actionType: 'resume_keyword', customerId: '1234567890', typedPayload: {
        adGroupId: '22', criterionId: '33',
        criterionResourceName: 'customers/1234567890/adGroupCriteria/22~33',
      },
    } as any)[0].adGroupCriterionOperation).toEqual({
      updateMask: 'status',
      update: {
        resourceName: 'customers/1234567890/adGroupCriteria/22~33',
        status: 'ENABLED',
      },
    });
    expect(builder.build({
      actionType: 'resume_responsive_search_ad', customerId: '1234567890', typedPayload: {
        adGroupId: '22', adId: '44',
        adGroupAdResourceName: 'customers/1234567890/adGroupAds/22~44',
      },
    } as any)[0].adGroupAdOperation.update.status).toBe('ENABLED');

    const create = builder.build({
      actionType: 'create_responsive_search_ad', customerId: '1234567890', typedPayload: {
        adGroupId: '22', finalUrl: 'https://htxbachgia.shop/',
        headlines: ['Một', 'Hai', 'Ba'],
        descriptions: ['Mô tả một', 'Mô tả hai'],
        headlinePins: [{ index: 0, pinnedField: 'HEADLINE_1' }],
        descriptionPins: [{ index: 1, pinnedField: 'DESCRIPTION_2' }],
      },
    } as any)[0].adGroupAdOperation.create.ad.responsiveSearchAd;
    expect(create.headlines[0]).toEqual({ text: 'Một', pinnedField: 'HEADLINE_1' });
    expect(create.descriptions[1]).toEqual({ text: 'Mô tả hai', pinnedField: 'DESCRIPTION_2' });

    expect(() => builder.build({
      actionType: 'update_responsive_search_ad', customerId: '1234567890', typedPayload: {
        adId: '44', headlines: ['Một', 'Hai', 'Ba'],
      },
    } as any)).toThrow('requires headlinePins explicitly');
  });
});
