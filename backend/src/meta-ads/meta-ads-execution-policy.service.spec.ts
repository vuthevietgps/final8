import { MetaAdsExecutionPolicyService } from './meta-ads-execution-policy.service';

describe('MetaAdsExecutionPolicyService', () => {
  const canonicalProviderProjection = (value: Record<string, any>) => Object.fromEntries(
    [
      'actionType', 'adAccountId', 'campaignId', 'adSetId', 'name', 'objective', 'status', 'buyingType',
      'specialAdCategories', 'specialAdCategoryCountries', 'budgetMode', 'budgetType',
      'dailyBudgetVnd', 'lifetimeBudgetVnd', 'bidStrategy', 'spendCapVnd',
      'startTime', 'stopTime', 'appId',
    ]
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, value[key]]),
  );
  const account = {
    accountType: 'facebook',
    accountId: '123',
    isActive: true,
    currency: 'VND',
    timezoneId: 'Asia/Ho_Chi_Minh',
    accountStatus: 1,
    lastSyncStatus: 'ok',
    lastSyncAt: new Date(),
  };
  const adAccountModel = {
    findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(account) })),
  };
  const providerClient = {
    canonicalPayload: jest.fn(canonicalProviderProjection),
    payloadHash: jest.fn(() => 'a'.repeat(64)),
    executionContext: jest.fn().mockResolvedValue({
      graphApiVersion: 'v25.0',
      credentialReferenceId: 'credential-1',
    }),
    readCampaign: jest.fn(),
    readAdSet: jest.fn(),
    stateHash: jest.fn(() => 'b'.repeat(64)),
    buildMutation: jest.fn((value) => {
      if ('actionId' in value || 'payloadHash' in value) {
        throw new Error('workflow envelope reached provider boundary');
      }
      return {};
    }),
  };
  const service = () => new MetaAdsExecutionPolicyService(adAccountModel as any, providerClient as any);

  const action = (overrides: Record<string, any> = {}) => ({
    actionId: 'META-ACT-1',
    idempotencyKey: 'meta:plan-1:act-1',
    reason: 'Safe campaign test',
    actionType: 'create_campaign',
    adAccountId: '123',
    name: 'Campaign',
    objective: 'OUTCOME_AWARENESS',
    status: 'PAUSED',
    buyingType: 'AUCTION',
    specialAdCategories: ['NONE'],
    budgetMode: 'ABO',
    budgetType: 'NONE',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    payloadHash: 'a'.repeat(64),
    workflowStatus: 'approved',
    providerValidationStatus: 'passed',
    providerValidatedAt: new Date(),
    providerValidationExpiresAt: new Date(Date.now() + 60_000),
    providerValidationPayloadHash: 'a'.repeat(64),
    providerValidationBeforeStateHash: 'b'.repeat(64),
    providerValidationGraphApiVersion: 'v25.0',
    providerValidationCredentialReferenceId: 'credential-1',
    approvedByUserId: 'approver-1',
    revision: 2,
    ...overrides,
  });
  const plan = (item = action()) => ({
    planId: 'META-PLAN-1',
    planName: 'Plan',
    createdByUserId: 'creator-1',
    actions: [item],
    revision: 1,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    adAccountModel.findOne.mockImplementation(() => ({ lean: jest.fn().mockResolvedValue({ ...account, lastSyncAt: new Date() }) }));
    providerClient.canonicalPayload.mockImplementation(canonicalProviderProjection);
    providerClient.payloadHash.mockReturnValue('a'.repeat(64));
    providerClient.executionContext.mockResolvedValue({
      graphApiVersion: 'v25.0',
      credentialReferenceId: 'credential-1',
    });
    providerClient.stateHash.mockReturnValue('b'.repeat(64));
    providerClient.buildMutation.mockImplementation((value) => {
      if ('actionId' in value || 'payloadHash' in value) {
        throw new Error('workflow envelope reached provider boundary');
      }
      return {};
    });
    process.env.META_ADS_ACCOUNT_ID_ALLOWLIST = '123';
    process.env.AI_MARKETING_REQUIRE_APPROVAL = 'true';
    process.env.META_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.META_ADS_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.AI_MARKETING_DRY_RUN = 'false';
    process.env.META_ADS_CAMPAIGN_CREATE_ENABLED = 'true';
    process.env.META_ADS_CAMPAIGN_UPDATE_ENABLED = 'true';
    process.env.META_ADS_CAMPAIGN_PAUSE_ENABLED = 'true';
    process.env.META_ADS_AD_SET_PAUSE_ENABLED = 'true';
    process.env.META_ADS_MAX_DAILY_BUDGET_VND = '5000000';
    process.env.META_ADS_MAX_LIFETIME_BUDGET_VND = '150000000';
    process.env.META_ADS_MAX_SPEND_CAP_VND = '150000000';
    process.env.META_ADS_SPECIAL_CATEGORY_ALLOWLIST = 'NONE';
    process.env.META_ADS_CAMPAIGN_SCHEDULE_MAX_DAYS = '365';
  });

  it('requires exact allowlisted, fresh VND/Vietnam account and SOD for live execution', async () => {
    const item = action();
    const result = await service().preflightLive(plan(item) as any, item as any, { id: 'executor-2' });
    expect(result.credentialReferenceId).toBe('credential-1');
    expect(providerClient.readCampaign).not.toHaveBeenCalled();

    await expect(service().preflightLive(plan(item) as any, item as any, { id: 'approver-1' }))
      .rejects.toThrow('different from the approver');
    await expect(service().preflightLive(plan(item) as any, item as any, { id: 'creator-1' }))
      .rejects.toThrow('different from the plan creator');
  });

  it('blocks budget increases and only permits non-increasing CBO updates', async () => {
    const before = {
      adAccountId: '123', campaignId: '456', name: 'Campaign', objective: 'OUTCOME_SALES',
      status: 'ACTIVE', buyingType: 'AUCTION', specialAdCategories: [], budgetMode: 'CBO',
      budgetType: 'DAILY', dailyBudgetVnd: 100_000,
    };
    providerClient.readCampaign.mockResolvedValue(before);
    providerClient.stateHash.mockReturnValue('b'.repeat(64));

    const increase = action({
      actionType: 'update_campaign', campaignId: '456', name: undefined,
      dailyBudgetVnd: 120_000, budgetMode: 'CBO', budgetType: 'DAILY',
      bidStrategy: undefined, specialAdCategories: undefined, workflowStatus: 'validating',
    });
    await expect(service().preflightValidation(plan(increase) as any, increase as any))
      .rejects.toThrow('increases are not supported');

    const reduction = { ...increase, dailyBudgetVnd: 80_000 };
    await expect(service().preflightValidation(plan(reduction) as any, reduction as any))
      .resolves.toEqual(expect.objectContaining({ beforeState: before }));
  });

  it('validates pause_ad_set against the exact active Ad Set and rejects no-op', async () => {
    const before = {
      resourceType: 'AD_SET',
      adAccountId: '123',
      campaignId: '456',
      adSetId: '789',
      status: 'ACTIVE',
    };
    providerClient.readAdSet.mockResolvedValue(before);
    const item = action({
      actionType: 'pause_ad_set',
      campaignId: '456',
      adSetId: '789',
      name: undefined,
      objective: undefined,
      status: undefined,
      buyingType: undefined,
      specialAdCategories: undefined,
      budgetMode: undefined,
      budgetType: undefined,
      bidStrategy: undefined,
      workflowStatus: 'validating',
    });

    await expect(service().preflightValidation(plan(item) as any, item as any))
      .resolves.toEqual(expect.objectContaining({ beforeState: before }));

    providerClient.readAdSet.mockResolvedValue({ ...before, status: 'PAUSED' });
    await expect(service().preflightValidation(plan(item) as any, item as any))
      .rejects.toThrow('already PAUSED');
  });

  it('fails closed on special-category rollout, lifetime caps and unsafe schedule extension', async () => {
    const scheduleStart = new Date(Date.now() + 86_400_000).toISOString();
    const scheduleStop = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const extendedStop = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const regulated = action({ specialAdCategories: ['HOUSING'] });
    await expect(service().preflightValidation(
      plan({ ...regulated, workflowStatus: 'validating' }) as any,
      { ...regulated, workflowStatus: 'validating' } as any,
    )).rejects.toThrow('SPECIAL_CATEGORY_ALLOWLIST');

    const oversized = action({
      budgetMode: 'CBO', budgetType: 'LIFETIME', dailyBudgetVnd: undefined,
      lifetimeBudgetVnd: 150_000_001,
    });
    await expect(service().preflightValidation(
      plan({ ...oversized, workflowStatus: 'validating' }) as any,
      { ...oversized, workflowStatus: 'validating' } as any,
    )).rejects.toThrow('lifetime budget exceeds');

    providerClient.readCampaign.mockResolvedValue({
      adAccountId: '123', campaignId: '456', name: 'Campaign', objective: 'OUTCOME_SALES',
      status: 'ACTIVE', buyingType: 'AUCTION', specialAdCategories: ['NONE'],
      specialAdCategoryCountries: [], budgetMode: 'CBO', budgetType: 'LIFETIME',
      lifetimeBudgetVnd: 1_000_000,
      startTime: scheduleStart, stopTime: scheduleStop,
    });
    const extension = action({
      actionType: 'update_campaign', campaignId: '456', name: undefined,
      budgetMode: undefined, budgetType: undefined, bidStrategy: undefined,
      specialAdCategories: undefined, stopTime: extendedStop,
      workflowStatus: 'validating',
    });
    await expect(service().preflightValidation(plan(extension) as any, extension as any))
      .rejects.toThrow('schedule extensions');
  });

  it('keeps dry-run provider-free and reports disabled live flags instead of throwing', async () => {
    process.env.META_ADS_PRODUCTION_ENABLED = 'false';
    process.env.META_ADS_PROVIDER_EXECUTION_ENABLED = 'false';
    process.env.AI_MARKETING_DRY_RUN = 'true';

    const result = await service().dryRunDiagnostic(
      action() as any,
      { id: 'executor-2' },
      'creator-1',
    );

    expect(result.providerNetworkCalled).toBe(false);
    expect(result.liveEligible).toBe(false);
    expect(result.blockers.join(' ')).toContain('META_ADS_PRODUCTION_ENABLED');
    expect(providerClient.executionContext).not.toHaveBeenCalled();
    expect(providerClient.readCampaign).not.toHaveBeenCalled();
  });

  it('never marks a non-approved action eligible in dry-run diagnostics', async () => {
    const result = await service().dryRunDiagnostic(
      action({ workflowStatus: 'pending_approval' }) as any,
      { id: 'executor-2' },
      'creator-1',
    );
    expect(result.liveEligible).toBe(false);
    expect(result.blockers.join(' ')).toContain('not approved');
  });

  it('allows exact/subdomain landing hosts and fails closed for other or credentialed URLs', () => {
    process.env.META_ADS_LANDING_PAGE_ALLOWLIST = 'example.com';
    process.env.META_ADS_APP_STORE_HOST_ALLOWLIST = 'apps.apple.com,play.google.com';
    const instance = service() as any;
    expect(() => instance.assertStaticBusinessRules(action({
      actionType: 'create_ad_creative',
      destinationUrl: 'https://shop.example.com/item',
    }))).not.toThrow();
    expect(() => instance.assertStaticBusinessRules(action({
      actionType: 'create_ad_creative',
      destinationUrl: 'https://example.com.evil.test/item',
    }))).toThrow('META_ADS_LANDING_PAGE_ALLOWLIST');
    expect(() => instance.assertStaticBusinessRules(action({
      actionType: 'create_ad_creative',
      destinationUrl: 'https://user:password@example.com/item',
    }))).toThrow('credential-free');
    expect(() => instance.assertStaticBusinessRules(action({
      actionType: 'create_ad_set',
      objectStoreUrl: 'https://apps.apple.com/app/id123',
    }))).not.toThrow();
    expect(() => instance.assertStaticBusinessRules(action({
      actionType: 'create_ad_set',
      objectStoreUrl: 'https://untrusted.example/app',
    }))).toThrow('META_ADS_APP_STORE_HOST_ALLOWLIST');
  });

  it('fails closed on stale canonical account sync', async () => {
    adAccountModel.findOne.mockImplementation(() => ({
      lean: jest.fn().mockResolvedValue({
        ...account,
        lastSyncAt: new Date(Date.now() - 60 * 60 * 1000),
      }),
    }));
    await expect(service().dryRunDiagnostic(
      action() as any,
      { id: 'executor-2' },
      'creator-1',
    ))
      .resolves.toEqual(expect.objectContaining({ liveEligible: false }));
  });
});
