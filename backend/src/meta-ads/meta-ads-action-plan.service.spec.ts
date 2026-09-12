import { BadRequestException } from '@nestjs/common';
import { metaAdsCanonicalHash } from './meta-ads-canonical.util';
import { MetaAdsActionPlanService } from './meta-ads-action-plan.service';

function createInput(overrides: Record<string, unknown> = {}): any {
  return {
    actionType: 'create_campaign',
    adAccountId: '1234567890',
    reason: 'Approved ecommerce campaign draft',
    payload: {
      name: 'ERP Sales Campaign',
      objective: 'OUTCOME_SALES',
      budgetMode: 'CBO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 500000,
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    },
    ...overrides,
  };
}

describe('MetaAdsActionPlanService', () => {
  it('creates a multi-action plan with server-forced safe campaign fields', async () => {
    const model = {
      create: jest.fn(async (value) => value),
    };
    const service = new MetaAdsActionPlanService(model as any);
    const input = createInput();

    const result = await service.createPlan({
      planName: 'July controlled campaign changes',
      actions: [input],
    }, 'creator-1');

    expect(result.status).toBe('pending_validation');
    expect(result.source).toBe('erp_ui');
    expect(result.actions).toHaveLength(1);
    const action = result.actions[0];
    expect(action).toMatchObject({
      actionType: 'create_campaign',
      adAccountId: '1234567890',
      name: 'ERP Sales Campaign',
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      buyingType: 'AUCTION',
      specialAdCategories: ['NONE'],
      budgetMode: 'CBO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 500000,
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      workflowStatus: 'pending_validation',
      providerValidationStatus: 'pending',
      revision: 0,
    });
    const canonical = service.buildCanonicalPayload(input);
    expect(action.payloadHash).toBe(metaAdsCanonicalHash(canonical));
    expect(action.actionId).toMatch(/^META-ACT-/);
    expect(action.idempotencyKey).toContain(action.actionId);
  });

  it('records ERP automation provenance without changing the action safety state', async () => {
    const model = {
      create: jest.fn(async (value) => value),
    };
    const service = new MetaAdsActionPlanService(model as any);

    const result = await service.createPlan({
      planName: 'Automated pause review',
      actions: [{
        actionType: 'pause_ad_set',
        adAccountId: '1234567890',
        campaignId: '200',
        adSetId: '300',
        reason: 'ERP loss evidence',
        idempotencyKey: 'ads:auto:v1:pause:meta:1234567890:300',
        payload: {},
      }],
    }, 'creator-1', 'erp_automation', {
      snapshotId: 'ads-evidence-1',
      snapshotHash: 'a'.repeat(64),
      capturedAt: '2026-07-18T01:05:00.000Z',
    });

    expect(result.source).toBe('erp_automation');
    expect(result).toEqual(expect.objectContaining({
      evidenceSnapshotId: 'ads-evidence-1',
      evidenceSnapshotHash: 'a'.repeat(64),
    }));
    expect(result.actions[0]).toEqual(expect.objectContaining({
      workflowStatus: 'pending_validation',
      providerValidationStatus: 'pending',
    }));
  });

  it('accepts explicit ABO/NONE and forbids campaign-level budgets', () => {
    const service = new MetaAdsActionPlanService({} as any);
    const canonical = service.buildCanonicalPayload(createInput({
      payload: {
        name: 'Awareness',
        objective: 'OUTCOME_AWARENESS',
        budgetMode: 'ABO',
        budgetType: 'NONE',
      },
    }));
    expect(canonical).toMatchObject({
      budgetMode: 'ABO',
      budgetType: 'NONE',
      status: 'PAUSED',
      buyingType: 'AUCTION',
      specialAdCategories: ['NONE'],
    });
    expect(canonical.dailyBudgetVnd).toBeUndefined();
    expect(() => service.buildCanonicalPayload(createInput({
      payload: {
        name: 'Unsafe ABO',
        objective: 'OUTCOME_AWARENESS',
        budgetMode: 'ABO',
        budgetType: 'DAILY',
        dailyBudgetVnd: 100000,
      },
    }))).toThrow('ABO campaigns require budgetType=NONE');
  });

  it('accepts only name and/or CBO daily budget for update', () => {
    const service = new MetaAdsActionPlanService({} as any);
    expect(service.buildCanonicalPayload(createInput({
      actionType: 'update_campaign',
      campaignId: '99887766',
      payload: { name: 'Renamed', dailyBudgetVnd: 300000 },
    }))).toEqual({
      actionType: 'update_campaign',
      adAccountId: '1234567890',
      campaignId: '99887766',
      name: 'Renamed',
      budgetMode: 'CBO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 300000,
    });
    expect(() => service.buildCanonicalPayload(createInput({
      actionType: 'update_campaign',
      campaignId: '99887766',
      payload: {},
    }))).toThrow('requires name, dailyBudgetVnd');
  });

  it('supports a bounded lifetime CBO contract with a canonical UTC window', () => {
    const service = new MetaAdsActionPlanService({} as any);
    const canonical = service.buildCanonicalPayload(createInput({
      payload: {
        name: 'Lifetime Sales',
        objective: 'OUTCOME_SALES',
        budgetMode: 'CBO',
        budgetType: 'LIFETIME',
        lifetimeBudgetVnd: 9000000,
        bidStrategy: 'LOWEST_COST_WITH_MIN_ROAS',
        spendCapVnd: 9000000,
        startTime: '2026-08-01T08:00:00+07:00',
        stopTime: '2026-08-31T23:59:00+07:00',
      },
    }));
    expect(canonical).toMatchObject({
      budgetMode: 'CBO',
      budgetType: 'LIFETIME',
      lifetimeBudgetVnd: 9000000,
      spendCapVnd: 9000000,
      startTime: '2026-08-01T01:00:00.000Z',
      stopTime: '2026-08-31T16:59:00.000Z',
    });
    expect(() => service.buildCanonicalPayload(createInput({
      payload: {
        name: 'Broken Lifetime',
        objective: 'OUTCOME_SALES',
        budgetMode: 'CBO',
        budgetType: 'LIFETIME',
        lifetimeBudgetVnd: 9000000,
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      },
    }))).toThrow('require valid startTime and stopTime');
  });

  it('validates special-ad category countries and APP_PROMOTION app identity', () => {
    const service = new MetaAdsActionPlanService({} as any);
    const regulated = service.buildCanonicalPayload(createInput({
      payload: {
        name: 'Credit Leads',
        objective: 'OUTCOME_LEADS',
        budgetMode: 'ABO',
        budgetType: 'NONE',
        specialAdCategories: ['CREDIT'],
        specialAdCategoryCountries: ['VN'],
      },
    }));
    expect(regulated).toMatchObject({
      specialAdCategories: ['CREDIT'],
      specialAdCategoryCountries: ['VN'],
    });
    expect(() => service.buildCanonicalPayload(createInput({
      payload: {
        name: 'Invalid Categories',
        objective: 'OUTCOME_LEADS',
        budgetMode: 'ABO',
        budgetType: 'NONE',
        specialAdCategories: ['NONE', 'CREDIT'],
      },
    }))).toThrow('NONE is exclusive');
    expect(() => service.buildCanonicalPayload(createInput({
      payload: {
        name: 'App Campaign',
        objective: 'OUTCOME_APP_PROMOTION',
        budgetMode: 'ABO',
        budgetType: 'NONE',
      },
    }))).toThrow('requires payload.appId');
    expect(service.buildCanonicalPayload(createInput({
      payload: {
        name: 'App Campaign',
        objective: 'OUTCOME_APP_PROMOTION',
        budgetMode: 'ABO',
        budgetType: 'NONE',
        appId: '123456789',
      },
    }))).toMatchObject({ appId: '123456789' });
  });

  it('keeps update candidates narrow and rejects objective/category/bid changes', () => {
    const service = new MetaAdsActionPlanService({} as any);
    expect(service.buildCanonicalPayload(createInput({
      actionType: 'update_campaign',
      campaignId: '99887766',
      payload: {
        lifetimeBudgetVnd: 1000000,
        spendCapVnd: 1100000,
        stopTime: '2026-08-31T23:59:00+07:00',
      },
    }))).toMatchObject({
      budgetMode: 'CBO',
      budgetType: 'LIFETIME',
      lifetimeBudgetVnd: 1000000,
      spendCapVnd: 1100000,
      stopTime: '2026-08-31T16:59:00.000Z',
    });
    expect(() => service.buildCanonicalPayload(createInput({
      actionType: 'update_campaign',
      campaignId: '99887766',
      payload: { bidStrategy: 'COST_CAP' },
    }))).toThrow('cannot mutate: bidStrategy');
  });

  it('requires pause payload to be empty and all provider IDs to be digits only', () => {
    const service = new MetaAdsActionPlanService({} as any);
    expect(service.buildCanonicalPayload(createInput({
      actionType: 'pause_campaign',
      campaignId: '99887766',
      payload: {},
    }))).toEqual({
      actionType: 'pause_campaign',
      adAccountId: '1234567890',
      campaignId: '99887766',
    });
    expect(() => service.buildCanonicalPayload(createInput({
      actionType: 'pause_campaign',
      campaignId: '99887766',
      payload: { name: 'not allowed' },
    }))).toThrow('pause_campaign payload must be empty');
    expect(() => service.buildCanonicalPayload(createInput({
      adAccountId: 'act_123',
    }))).toThrow('adAccountId must contain digits only');
  });

  it('canonicalizes pause_ad_set with exact Campaign and Ad Set IDs', () => {
    const service = new MetaAdsActionPlanService({} as any);
    expect(service.buildCanonicalPayload(createInput({
      actionType: 'pause_ad_set',
      campaignId: '99887766',
      adSetId: '88776655',
      payload: {},
    }))).toEqual({
      actionType: 'pause_ad_set',
      adAccountId: '1234567890',
      campaignId: '99887766',
      adSetId: '88776655',
    });
    expect(() => service.buildCanonicalPayload(createInput({
      actionType: 'pause_ad_set',
      campaignId: '99887766',
      adSetId: '88776655',
      payload: { name: 'not allowed' },
    }))).toThrow('pause_ad_set payload must be empty');
    expect(() => service.buildCanonicalPayload(createInput({
      actionType: 'pause_ad_set',
      campaignId: undefined,
      adSetId: '88776655',
      payload: {},
    }))).toThrow('requires campaignId and adSetId');
  });

  it('canonicalizes the staged Ad Set, Creative and Ad create contracts', () => {
    const service = new MetaAdsActionPlanService({} as any);
    const adSet = service.buildCanonicalPayload({
      actionType: 'create_ad_set',
      adAccountId: '1234567890',
      campaignId: '99887766',
      reason: 'Stage delivery safely',
      payload: {
        name: 'ERP Prospecting',
        budgetMode: 'ABO',
        budgetType: 'DAILY',
        dailyBudgetVnd: 250000,
        adSetBidStrategy: 'COST_CAP',
        bidAmountVnd: 45000,
        optimizationGoal: 'LINK_CLICKS',
        billingEvent: 'LINK_CLICKS',
        destinationType: 'WEBSITE',
        targetingCountries: ['VN'],
        publisherPlatforms: ['FACEBOOK', 'INSTAGRAM'],
        facebookPositions: ['FEED'],
        instagramPositions: ['STORY'],
        internalAdGroupId: '507f1f77bcf86cd799439011',
      },
    } as any);
    expect(adSet).toEqual(expect.objectContaining({
      actionType: 'create_ad_set',
      campaignId: '99887766',
      status: 'PAUSED',
      bidStrategy: 'COST_CAP',
      bidAmountVnd: 45000,
      internalAdGroupId: '507f1f77bcf86cd799439011',
    }));

    const creative = service.buildCanonicalPayload({
      actionType: 'create_ad_creative',
      adAccountId: '1234567890',
      reason: 'Stage creative safely',
      payload: {
        name: 'ERP image creative',
        pageId: '123456',
        message: 'Primary copy',
        headline: 'Headline',
        description: 'Description',
        callToActionType: 'LEARN_MORE',
        destinationUrl: 'https://shop.example.com/product?a=1#fragment',
        imageHash: '0123456789abcdef0123456789abcdef',
        urlTags: 'utm_source=erp&utm_campaign=safe',
      },
    } as any);
    expect(creative).toEqual(expect.objectContaining({
      actionType: 'create_ad_creative',
      destinationUrl: 'https://shop.example.com/product?a=1',
      urlTags: 'utm_source=erp&utm_campaign=safe',
    }));
    expect(creative).not.toHaveProperty('status');

    expect(service.buildCanonicalPayload({
      actionType: 'create_ad',
      adAccountId: '1234567890',
      adSetId: '111222333',
      creativeId: '444555666',
      reason: 'Stage ad safely',
      payload: { name: 'ERP Ad' },
    } as any)).toEqual({
      actionType: 'create_ad',
      adAccountId: '1234567890',
      adSetId: '111222333',
      creativeId: '444555666',
      name: 'ERP Ad',
      status: 'PAUSED',
    });
  });

  it('rejects secret-like creative URL tags without echoing the secret', () => {
    const service = new MetaAdsActionPlanService({} as any);
    const input = {
      actionType: 'create_ad_creative',
      adAccountId: '1234567890',
      reason: 'Unsafe tags',
      payload: {
        name: 'Creative',
        pageId: '123456',
        message: 'Primary copy',
        headline: 'Headline',
        description: 'Description',
        callToActionType: 'LEARN_MORE',
        destinationUrl: 'https://shop.example.com/product',
        imageHash: '0123456789abcdef0123456789abcdef',
        urlTags: 'utm_source=erp&access_token=do-not-log-this',
      },
    };
    let error: any;
    try {
      service.buildCanonicalPayload(input as any);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect(String(error?.message)).not.toContain('do-not-log-this');
  });

  it('rejects raw provider fields instead of forwarding or ignoring them', () => {
    const service = new MetaAdsActionPlanService({} as any);
    expect(() => service.buildCanonicalPayload({
      ...createInput(),
      accessToken: 'must-not-be-accepted',
    } as any)).toThrow(BadRequestException);
    expect(() => service.buildCanonicalPayload(createInput({
      payload: {
        name: 'Unsafe',
        objective: 'OUTCOME_SALES',
        budgetMode: 'CBO',
        budgetType: 'DAILY',
        dailyBudgetVnd: 500000,
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        providerUrl: 'https://graph.facebook.com/arbitrary',
      },
    }))).toThrow('unsupported fields');
  });

  it('rejects duplicate caller-provided idempotency keys in one plan', async () => {
    const service = new MetaAdsActionPlanService({ create: jest.fn() } as any);
    await expect(service.createPlan({
      planName: 'Duplicate keys',
      actions: [
        createInput({ idempotencyKey: 'META:duplicate:1' }),
        createInput({ idempotencyKey: 'META:duplicate:1' }),
      ],
    }, 'creator-1')).rejects.toThrow('idempotencyKey values must be unique');
  });
});
