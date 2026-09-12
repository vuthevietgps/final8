import { BadRequestException } from '@nestjs/common';
import {
  MetaAdsProviderClientService,
  MetaAdsProviderError,
} from './meta-ads-provider-client.service';

describe('MetaAdsProviderClientService', () => {
  const credential = {
    accessToken: 'secret-access-token',
    credentialReferenceId: 'credential-1',
    adAccountId: '123456789',
    lastCheckedAt: new Date(),
  };
  const apiTokenService = {
    getMetaAdsExecutionCredential: jest.fn().mockResolvedValue(credential),
  };
  const transport = { request: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.META_GRAPH_API_VERSION = 'v25.0';
    delete process.env.FB_GRAPH_API_VERSION;
  });

  const service = () => new MetaAdsProviderClientService(apiTokenService as any, transport as any);
  const createAction = () => ({
    actionType: 'create_campaign' as const,
    adAccountId: '123456789',
    name: 'ERP awareness campaign',
    objective: 'OUTCOME_AWARENESS',
    status: 'PAUSED',
    buyingType: 'AUCTION',
    specialAdCategories: ['NONE'] as ['NONE'],
    budgetMode: 'CBO' as const,
    budgetType: 'DAILY' as const,
    dailyBudgetVnd: 500_000,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
  });

  it('builds a v25 validate_only create with fixed safe fields and no token in URL/body', async () => {
    transport.request.mockResolvedValue({
      status: 200,
      headers: { 'x-fb-trace-id': 'trace-1' },
      data: { success: true },
    });

    const result = await service().validateOnly(createAction());

    expect(result.providerRequestId).toBe('trace-1');
    expect(transport.request).toHaveBeenCalledTimes(1);
    const request = transport.request.mock.calls[0][0];
    expect(request.url).toBe('https://graph.facebook.com/v25.0/act_123456789/campaigns');
    expect(request.headers.Authorization).toBe('Bearer secret-access-token');
    expect(request.url).not.toContain('secret-access-token');
    expect(request.body).not.toContain('secret-access-token');
    const body = new URLSearchParams(request.body);
    expect(body.get('status')).toBe('PAUSED');
    expect(body.get('buying_type')).toBe('AUCTION');
    expect(body.get('special_ad_categories')).toBe('[]');
    expect(body.get('bid_strategy')).toBe('LOWEST_COST_WITHOUT_CAP');
    expect(body.get('execution_options')).toBe('["validate_only"]');
  });

  it('maps controlled CBO lifetime, schedule, spend cap and app dependency fields', () => {
    const mutation = service().buildMutation({
      ...createAction(),
      objective: 'OUTCOME_APP_PROMOTION',
      budgetMode: 'CBO',
      budgetType: 'LIFETIME',
      dailyBudgetVnd: undefined,
      lifetimeBudgetVnd: 3_000_000,
      spendCapVnd: 2_500_000,
      startTime: '2026-08-01T00:00:00.000Z',
      stopTime: '2026-08-31T00:00:00.000Z',
      appId: '987654321',
    });

    expect(mutation.fields).toEqual(expect.objectContaining({
      lifetime_budget: '3000000',
      spend_cap: '2500000',
      start_time: '2026-08-01T00:00:00.000Z',
      stop_time: '2026-08-31T00:00:00.000Z',
      promoted_object: '{"application_id":"987654321"}',
    }));
    expect(mutation.fields.daily_budget).toBeUndefined();
  });

  it('maps allowlisted special categories and country scope without raw payload escape', () => {
    const mutation = service().buildMutation({
      ...createAction(),
      specialAdCategories: ['HOUSING'],
      specialAdCategoryCountries: ['VN'],
    });

    expect(mutation.fields.special_ad_categories).toBe('["HOUSING"]');
    expect(mutation.fields.special_ad_category_country).toBe('["VN"]');
    expect(() => service().buildMutation({
      ...createAction(),
      specialAdCategories: ['NONE', 'HOUSING'],
    })).toThrow('NONE is not exclusive');
  });

  it('maps staged Ad Set, Creative and Ad through typed allowlists only', () => {
    const client = service();
    const adSet = client.buildMutation({
      actionType: 'create_ad_set',
      adAccountId: '123456789',
      campaignId: '456789',
      name: 'ERP Ad Set',
      status: 'PAUSED',
      budgetMode: 'ABO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 250000,
      bidStrategy: 'COST_CAP',
      bidAmountVnd: 45000,
      optimizationGoal: 'LINK_CLICKS',
      billingEvent: 'LINK_CLICKS',
      destinationType: 'WEBSITE',
      targetingCountries: ['VN'],
      publisherPlatforms: ['FACEBOOK'],
      facebookPositions: ['FEED'],
      internalAdGroupId: '507f1f77bcf86cd799439011',
    });
    expect(adSet.path).toBe('/act_123456789/adsets');
    expect(adSet.fields).toEqual(expect.objectContaining({
      campaign_id: '456789',
      status: 'PAUSED',
      daily_budget: '250000',
      bid_strategy: 'COST_CAP',
      bid_amount: '45000',
    }));
    expect(JSON.parse(adSet.fields.targeting)).toEqual({
      geo_locations: { countries: ['VN'] },
      publisher_platforms: ['facebook'],
      facebook_positions: ['feed'],
    });
    expect(JSON.stringify(adSet.fields)).not.toContain('internalAdGroupId');
    expect(JSON.stringify(adSet.fields)).not.toContain('507f1f77bcf86cd799439011');

    const creative = client.buildMutation({
      actionType: 'create_ad_creative',
      adAccountId: '123456789',
      name: 'ERP Creative',
      pageId: '123456',
      instagramActorId: '654321',
      message: 'Primary copy',
      headline: 'Headline',
      description: 'Description',
      callToActionType: 'LEARN_MORE',
      destinationUrl: 'https://shop.example.com/item',
      imageHash: '0123456789abcdef0123456789abcdef',
      urlTags: 'utm_source=erp',
    });
    expect(creative.path).toBe('/act_123456789/adcreatives');
    expect(creative.fields.status).toBeUndefined();
    expect(creative.fields.url_tags).toBe('utm_source=erp');
    expect(JSON.parse(creative.fields.object_story_spec)).toEqual(expect.objectContaining({
      page_id: '123456',
      instagram_user_id: '654321',
      link_data: expect.objectContaining({
        message: 'Primary copy',
        name: 'Headline',
        description: 'Description',
      }),
    }));

    const ad = client.buildMutation({
      actionType: 'create_ad',
      adAccountId: '123456789',
      adSetId: '111222',
      creativeId: '333444',
      name: 'ERP Ad',
      status: 'PAUSED',
    });
    expect(ad.path).toBe('/act_123456789/ads');
    expect(ad.fields).toEqual(expect.objectContaining({
      adset_id: '111222',
      creative: '{"creative_id":"333444"}',
      status: 'PAUSED',
    }));
  });

  it('builds pause_ad_set as an exact-ID PAUSED-only mutation', () => {
    const mutation = service().buildMutation({
      actionType: 'pause_ad_set',
      adAccountId: '123456789',
      campaignId: '456789',
      adSetId: '111222',
    });

    expect(mutation).toEqual({
      actionType: 'pause_ad_set',
      adAccountId: '123456789',
      campaignId: '456789',
      adSetId: '111222',
      path: '/111222',
      fields: { status: 'PAUSED' },
    });
    expect(() => service().buildMutation({
      actionType: 'pause_ad_set',
      adAccountId: '123456789',
      campaignId: '456789',
      adSetId: '111222',
      name: 'raw-field-is-not-allowed',
    })).toThrow('unknown or raw provider field');
  });

  it('reads Ad Creative with v25 fields and canonical instagram_user_id', async () => {
    transport.request.mockResolvedValue({
      status: 200,
      data: {
        id: '777888',
        account_id: '123456789',
        name: 'ERP Creative',
        object_story_spec: {
          page_id: '123456',
          instagram_user_id: '654321',
          link_data: {
            link: 'https://shop.example.com/item',
            message: 'Primary copy',
            name: 'Headline',
            description: 'Description',
            image_hash: '0123456789abcdef0123456789abcdef',
            call_to_action: {
              type: 'LEARN_MORE',
              value: { link: 'https://shop.example.com/item' },
            },
          },
        },
        url_tags: 'utm_source=erp',
      },
    });

    const result = await service().readAdCreative('123456789', '777888', { attempts: 1 });

    expect(result).toEqual(expect.objectContaining({
      creativeId: '777888',
      instagramActorId: '654321',
    }));
    const request = transport.request.mock.calls[0][0];
    expect(request.url).not.toContain('created_time');
    expect(request.url).not.toContain('updated_time');
  });

  it('never retries a POST when the provider outcome is unknown', async () => {
    transport.request.mockRejectedValue(new Error('socket closed'));

    await expect(service().mutate(createAction())).rejects.toEqual(
      expect.objectContaining({ outcome: 'unknown' }),
    );
    expect(transport.request).toHaveBeenCalledTimes(1);
  });

  it('bounds GET readback retries and validates exact account/campaign identity', async () => {
    transport.request
      .mockRejectedValueOnce(new Error('temporary network error'))
      .mockResolvedValueOnce({
        status: 200,
        data: {
          id: '456',
          account_id: '123456789',
          name: 'Campaign',
          objective: 'OUTCOME_TRAFFIC',
          status: 'PAUSED',
          effective_status: 'PAUSED',
          buying_type: 'AUCTION',
          special_ad_categories: [],
        },
      });

    const result = await service().readCampaign('123456789', '456', { attempts: 2 });

    expect(result).toEqual(expect.objectContaining({
      adAccountId: '123456789',
      campaignId: '456',
      budgetMode: 'ABO',
      budgetType: 'NONE',
      specialAdCategories: ['NONE'],
    }));
    expect(transport.request).toHaveBeenCalledTimes(2);
    expect(transport.request.mock.calls.every(([request]) => request.method === 'GET')).toBe(true);
  });

  it('classifies provider 4xx as definitive and 5xx as outcome unknown', async () => {
    transport.request.mockResolvedValueOnce({
      status: 400,
      data: { error: { code: 100, message: 'invalid field' } },
    });
    await expect(service().mutate(createAction())).rejects.toEqual(
      expect.objectContaining({ outcome: 'definitive_failure', providerCode: '100' }),
    );

    transport.request.mockResolvedValueOnce({
      status: 503,
      data: { error: { code: 2, message: 'temporary' } },
    });
    await expect(service().mutate(createAction())).rejects.toEqual(
      expect.objectContaining({ outcome: 'unknown', providerCode: '2' }),
    );
  });

  it('rejects raw or unsupported fields and any non-v25 effective API version', () => {
    expect(() => service().buildMutation({
      ...createAction(),
      rawPayload: { status: 'ACTIVE' },
    } as any)).toThrow(BadRequestException);

    process.env.META_GRAPH_API_VERSION = 'v24.0';
    expect(() => service().graphApiVersion()).toThrow('v25.0');
  });

  it('projects the persisted workflow envelope to canonical provider fields only', () => {
    const canonical = service().canonicalPayload({
      ...createAction(),
      actionId: 'META-ACT-1',
      payloadHash: 'a'.repeat(64),
      approvedByUserId: 'approver-1',
      providerValidationCredentialReferenceId: 'credential-1',
    } as any);

    expect(canonical).not.toHaveProperty('actionId');
    expect(canonical).not.toHaveProperty('approvedByUserId');
    expect(() => service().buildMutation(canonical)).not.toThrow();
  });

  it('does not expose the access token in provider errors', async () => {
    transport.request.mockRejectedValue(new Error('Bearer secret-access-token failed'));
    let error: any;
    try {
      await service().mutate(createAction());
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(MetaAdsProviderError);
    expect(error.message).not.toContain('secret-access-token');
  });
});
