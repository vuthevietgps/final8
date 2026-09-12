import {
  MetaAdsCapabilitiesService,
} from './meta-ads-capabilities.service';
import {
  META_ADS_BID_STRATEGIES,
  META_ADS_SPECIAL_AD_CATEGORIES,
} from './meta-ads.types';

describe('MetaAdsCapabilitiesService', () => {
  it('publishes the six ODAX objectives and the provider-approved enum contract', () => {
    const result = new MetaAdsCapabilitiesService().getCapabilities();

    expect(result.schemaVersion).toBe('v1');
    expect(result.graphApiVersion).toBe('v25.0');
    expect(result.objectives.map((item) => item.value)).toEqual(expect.arrayContaining([
      'OUTCOME_AWARENESS',
      'OUTCOME_TRAFFIC',
      'OUTCOME_ENGAGEMENT',
      'OUTCOME_LEADS',
      'OUTCOME_APP_PROMOTION',
      'OUTCOME_SALES',
    ]));
    expect(result.objectives).toHaveLength(6);
    expect(result.bidStrategies).toEqual(META_ADS_BID_STRATEGIES);
    expect(result.specialAdCategories.officialOptions).toEqual(META_ADS_SPECIAL_AD_CATEGORIES);
  });

  it('makes PAUSED/AUCTION and the staged resource boundary explicit', () => {
    const result = new MetaAdsCapabilitiesService().getCapabilities();

    expect(result.invariants).toEqual({
      createStatus: 'PAUSED',
      buyingType: 'AUCTION',
      rawProviderPayloadAccepted: false,
      creativeIsNonDeliveringResource: true,
    });
    expect(result.actions.create_campaign.forcedFields).toEqual({
      status: 'PAUSED',
      buyingType: 'AUCTION',
    });
    expect(result.budget.types.map((item) => item.value)).toEqual(['NONE', 'DAILY', 'LIFETIME']);
    expect(result.actions.create_campaign.optionalFields).toContain('payload.bidStrategy');
    expect(result.actions.create_ad_set.forcedFields).toEqual({ status: 'PAUSED' });
    expect(result.actions.pause_ad_set).toEqual(expect.objectContaining({
      requiredFields: ['adAccountId', 'campaignId', 'adSetId', 'reason'],
      payloadMustBeEmpty: true,
      forcedFields: { status: 'PAUSED' },
      liveFlag: 'META_ADS_AD_SET_PAUSE_ENABLED',
    }));
    expect(result.actions.create_ad.forcedFields).toEqual({ status: 'PAUSED' });
    expect(result.actions.create_ad_creative.constraints).toContain(
      'Creative is non-delivering and therefore has no PAUSED/ACTIVE status',
    );
    expect(result.delivery.optimizationGoals).toContain('OFFSITE_CONVERSIONS');
    expect(result.delivery.facebookPositions).not.toContain('VIDEO_FEEDS');
    expect(result.specialAdCategories.defaultLiveExecutionAllowlist).toEqual(['NONE']);
    expect(result.resourceSetup).toEqual(expect.objectContaining({
      campaignIsContainerOnly: true,
      stages: ['CAMPAIGN', 'AD_SET', 'CREATIVE', 'AD'],
    }));
    expect(result.resourceSetup.note).toContain('separate staged resources');
  });

  it('returns a detached contract rather than mutable process-wide state', () => {
    const service = new MetaAdsCapabilitiesService();
    const first = service.getCapabilities();
    first.objectives.splice(0, 1);
    first.bidStrategies.splice(0, 1);

    const second = service.getCapabilities();
    expect(second.objectives).toHaveLength(6);
    expect(second.bidStrategies).toHaveLength(4);
  });
});
