import { GoogleAdsCapabilitiesService } from './google-ads-capabilities.service';

describe('GoogleAdsCapabilitiesService', () => {
  const service = new GoogleAdsCapabilitiesService();

  afterEach(() => {
    delete process.env.GOOGLE_ADS_CAMPAIGN_CREATE_ENABLED;
    delete process.env.GOOGLE_ADS_CAMPAIGN_UPDATE_ENABLED;
    delete process.env.GOOGLE_ADS_CAMPAIGN_BIDDING_UPDATE_ENABLED;
    delete process.env.GOOGLE_ADS_CAMPAIGN_PAUSE_ENABLED;
    delete process.env.GOOGLE_ADS_CAMPAIGN_RESUME_ENABLED;
    delete process.env.GOOGLE_ADS_AD_GROUP_RESUME_ENABLED;
    delete process.env.GOOGLE_ADS_KEYWORD_RESUME_ENABLED;
    delete process.env.GOOGLE_ADS_RSA_RESUME_ENABLED;
    delete process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
    delete process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED;
    delete process.env.AI_MARKETING_DRY_RUN;
  });

  it('reports forced Search-only defaults and fail-closed live action gates', () => {
    const capabilities = service.getCapabilities();

    expect(capabilities.productionEnabled).toBe(false);
    expect(capabilities.liveActionGates).toEqual(expect.objectContaining({
      create: false,
      update: false,
      biddingStrategyUpdate: false,
      pause: false,
      resume: false,
      adGroup: expect.objectContaining({ resume: false }),
      keyword: expect.objectContaining({ resume: false }),
      responsiveSearchAd: expect.objectContaining({ resume: false }),
    }));
    expect(capabilities.invariants).toEqual(expect.objectContaining({
      createStatus: 'PAUSED',
      advertisingChannelType: 'SEARCH',
      targetContentNetwork: false,
      credentialsAcceptedFromBrowser: false,
    }));
    expect(capabilities.defaultTargeting).toEqual(expect.objectContaining({
      geoTargetConstantIds: ['2704'],
      languageConstantIds: ['1040'],
      positiveGeoTargetType: 'PRESENCE',
    }));
    expect(capabilities.unsupportedCampaignTypes).toContain('PERFORMANCE_MAX');
    expect(capabilities.unsupportedMutations).toContain('delete');
    expect(capabilities.biddingStrategies).toContain('MAXIMIZE_CLICKS');
    expect(capabilities.biddingLifecycle).toEqual(expect.objectContaining({
      supported: true,
      draftOnly: true,
      defaultEnabled: false,
      defaultClickThreshold: 50,
    }));
  });

  it('reports production and per-action gates only from explicit environment flags', () => {
    process.env.GOOGLE_ADS_CAMPAIGN_CREATE_ENABLED = 'true';
    process.env.GOOGLE_ADS_CAMPAIGN_UPDATE_ENABLED = 'true';
    process.env.GOOGLE_ADS_CAMPAIGN_BIDDING_UPDATE_ENABLED = 'true';
    process.env.GOOGLE_ADS_CAMPAIGN_PAUSE_ENABLED = 'true';
    process.env.GOOGLE_ADS_CAMPAIGN_RESUME_ENABLED = 'true';
    process.env.GOOGLE_ADS_AD_GROUP_RESUME_ENABLED = 'true';
    process.env.GOOGLE_ADS_KEYWORD_RESUME_ENABLED = 'true';
    process.env.GOOGLE_ADS_RSA_RESUME_ENABLED = 'true';
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.AI_MARKETING_DRY_RUN = 'false';

    const capabilities = service.getCapabilities();

    expect(capabilities.productionEnabled).toBe(true);
    expect(capabilities.liveActionGates).toEqual(expect.objectContaining({
      create: true,
      update: true,
      biddingStrategyUpdate: true,
      pause: true,
      resume: true,
      adGroup: expect.objectContaining({ resume: true }),
      keyword: expect.objectContaining({ resume: true }),
      responsiveSearchAd: expect.objectContaining({ resume: true }),
    }));
  });
});
