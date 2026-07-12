import { GoogleAdsExecutionPolicyService } from './google-ads-execution-policy.service';
import { GoogleAdsOperationBuilderService } from './google-ads-operation-builder.service';

const leanResult = (value: any) => {
  const query: any = {
    lean: jest.fn().mockResolvedValue(value),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.sort = jest.fn(() => query);
  query.select = jest.fn(() => query);
  return query;
};
const model = (value: any = null, values: any[] = []) => ({
  findOne: jest.fn(() => leanResult(value)),
  find: jest.fn(() => leanResult(values)),
});

const action = (overrides: Record<string, any> = {}) => ({
  actionId: 'ACT001',
  idempotencyKey: 'PLAN-001:ACT001',
  actionType: 'create_search_campaign',
  customerId: '1234567890',
  loginCustomerId: '4345552613',
  status: 'approved',
  providerValidationStatus: 'provider_validate_passed',
  providerValidatedAt: new Date(),
  requireExecutionConfirmation: true,
  typedPayload: {
    campaignName: 'Search - Safe Draft',
    budgetName: 'Budget - Safe Draft',
    dailyBudget: 500000,
    advertisingChannelType: 'SEARCH',
    status: 'PAUSED',
    biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
    startDate: '2026-06-13',
    finalUrl: 'https://htxbachgia.shop/',
  },
  ...overrides,
});

const plan = (overrides: Record<string, any> = {}) => ({
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  ...overrides,
});

describe('GoogleAdsExecutionPolicyService', () => {
  const freshStartedAt = new Date(Date.now() - 60_000);
  const freshCompletedAt = new Date(Date.now() - 30_000);
  const adAccountModel = model({
    accountId: '1234567890',
    currency: 'VND',
    timezoneId: 'Asia/Ho_Chi_Minh',
    loginCustomerId: '4345552613',
  }, [{
    accountId: '1234567890',
    accountType: 'google',
    isActive: true,
    lastSyncStatus: 'ok',
    lastSyncAt: freshCompletedAt,
  }]);
  const campaignModel = model({ campaignId: '111' });
  const budgetModel = model({ campaignBudgetId: '222', amountVnd: 500000 });
  const adGroupModel = model({ adGroupId: '333' });
  const legacyAdGroupModel = model(null, [{ adGroupId: 'LEGACY-GOOGLE-1', platform: 'google' }]);
  const syncRunModel = model({
    status: 'success',
    customerIds: ['1234567890'],
    startedAt: freshStartedAt,
    completedAt: freshCompletedAt,
  });
  const executionLogModel = model(null);
  const financialControlService = {
    getFullMetrics: jest.fn().mockResolvedValue({
      adsBudgetApproved: 7_000_000,
      maxDailyAds: 1_000_000,
      optimalAdsSuggestion: 7_000_000,
      dataQuality: { status: 'ok', isDecisionLocked: false },
    }),
    getOptimalAdsSuggestion: jest.fn().mockResolvedValue({
      adGroups: [{ adGroupId: 'LEGACY-GOOGLE-1', optimalSuggested: 1_000_000 }],
      totalOptimalDaily: 1_000_000,
      totalOptimalWeekly: 7_000_000,
    }),
  };
  const service = new GoogleAdsExecutionPolicyService(
    adAccountModel as any,
    campaignModel as any,
    budgetModel as any,
    adGroupModel as any,
    legacyAdGroupModel as any,
    syncRunModel as any,
    executionLogModel as any,
    new GoogleAdsOperationBuilderService(),
    financialControlService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST = 'htxbachgia.shop';
    process.env.GOOGLE_ADS_MAX_DAILY_BUDGET_VND = '5000000';
    process.env.GOOGLE_ADS_MAX_BUDGET_INCREASE_PERCENT = '20';
    process.env.GOOGLE_ADS_FINANCIAL_SYNC_MAX_AGE_MS = '900000';
    process.env.GOOGLE_ADS_PROVIDER_VALIDATION_TTL_MS = '900000';
    financialControlService.getFullMetrics.mockResolvedValue({
      adsBudgetApproved: 7_000_000,
      maxDailyAds: 1_000_000,
      optimalAdsSuggestion: 7_000_000,
      dataQuality: { status: 'ok', isDecisionLocked: false },
    });
  });

  afterAll(() => {
    delete process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST;
    delete process.env.GOOGLE_ADS_MAX_DAILY_BUDGET_VND;
    delete process.env.GOOGLE_ADS_MAX_BUDGET_INCREASE_PERCENT;
    delete process.env.GOOGLE_ADS_FINANCIAL_SYNC_MAX_AGE_MS;
    delete process.env.GOOGLE_ADS_PROVIDER_VALIDATION_TTL_MS;
  });

  it('builds a new Search campaign as PAUSED during final execution preflight', async () => {
    const result = await service.preflight(plan() as any, [action() as any]);

    expect(result[0].operations[1].campaignOperation.create).toEqual(expect.objectContaining({
      status: 'PAUSED',
      advertisingChannelType: 'SEARCH',
    }));
  });

  it.each([
    ['unapproved action', action({ status: 'pending' }), 'not approved'],
    ['provider validation not passed', action({ providerValidationStatus: 'pending' }), 'provider validateOnly'],
    ['enabled new campaign', action({ typedPayload: { ...action().typedPayload, status: 'ENABLED' } }), 'PAUSED Search campaign'],
    ['budget over policy', action({ typedPayload: { ...action().typedPayload, dailyBudget: 6000000 } }), 'Daily budget violates policy'],
    ['landing page outside allowlist', action({ typedPayload: { ...action().typedPayload, finalUrl: 'https://example.com/' } }), 'not allowlisted'],
    ['raw provider payload', action({ typedPayload: { ...action().typedPayload, rawApiRequest: { mutateOperations: [] } } }), 'Raw provider execution payload'],
  ])('blocks %s', async (_name, invalidAction, message) => {
    await expect(service.preflight(plan() as any, [invalidAction as any])).rejects.toThrow(message);
  });

  it('blocks invalid RSA, keyword match type, budget identifiers, currency, and timezone', async () => {
    await expect(service.preflight(plan() as any, [action({
      actionType: 'create_responsive_search_ad',
      typedPayload: { adGroupId: '333', headlines: ['a'], descriptions: ['a'], finalUrl: '' },
    }) as any])).rejects.toThrow('at least 3 headlines');

    await expect(service.preflight(plan() as any, [action({
      actionType: 'create_keyword',
      typedPayload: { adGroupId: '333', keywordText: 'sample', matchType: 'UNKNOWN', negative: false },
    }) as any])).rejects.toThrow('Invalid keyword matchType');

    await expect(service.preflight(plan() as any, [action({
      actionType: 'update_campaign_budget',
      typedPayload: { campaignId: '111', adGroupId: '333', dailyBudget: 500000 },
    }) as any])).rejects.toThrow('Campaign budget identifier is required');

    await expect(service.preflight(plan({ currency: 'USD' }) as any, [action() as any])).rejects.toThrow('currency VND');
    await expect(service.preflight(plan({ timezone: 'UTC' }) as any, [action() as any])).rejects.toThrow('timezone Asia/Ho_Chi_Minh');
  });

  it('blocks missing, stale, or future provider validateOnly evidence', async () => {
    process.env.GOOGLE_ADS_PROVIDER_VALIDATION_TTL_MS = '60000';
    await expect(service.preflight(plan() as any, [action({
      providerValidatedAt: undefined,
    }) as any])).rejects.toThrow('validateOnly evidence is missing or stale');
    await expect(service.preflight(plan() as any, [action({
      providerValidatedAt: new Date(Date.now() - 61_000),
    }) as any])).rejects.toThrow('validateOnly evidence is missing or stale');
    await expect(service.preflight(plan() as any, [action({
      providerValidatedAt: new Date(Date.now() + 61_000),
    }) as any])).rejects.toThrow('validateOnly evidence is missing or stale');
  });

  it('fails closed when Financial Control is locked, invalid, unavailable, or exceeded', async () => {
    financialControlService.getFullMetrics.mockResolvedValueOnce({
      adsBudgetApproved: 7_000_000,
      maxDailyAds: 1_000_000,
      optimalAdsSuggestion: 7_000_000,
      dataQuality: { status: 'blocked', isDecisionLocked: true },
    });
    await expect(service.preflight(plan() as any, [action() as any]))
      .rejects.toThrow('Financial Control decision is locked');

    financialControlService.getFullMetrics.mockResolvedValueOnce({
      adsBudgetApproved: Number.NaN,
      maxDailyAds: 1_000_000,
      optimalAdsSuggestion: 7_000_000,
      dataQuality: { status: 'ok', isDecisionLocked: false },
    });
    await expect(service.preflight(plan() as any, [action() as any]))
      .rejects.toThrow('invalid Ads budget envelope');

    financialControlService.getFullMetrics.mockRejectedValueOnce(new Error('snapshot failed'));
    await expect(service.preflight(plan() as any, [action() as any]))
      .rejects.toThrow('Financial Control is unavailable');

    financialControlService.getFullMetrics.mockResolvedValueOnce({
      adsBudgetApproved: 2_800_000,
      maxDailyAds: 400_000,
      optimalAdsSuggestion: 7_000_000,
      dataQuality: { status: 'ok', isDecisionLocked: false },
    });
    await expect(service.preflight(plan() as any, [action() as any]))
      .rejects.toThrow('exceeds the Financial Control envelope');
  });

  it('checks the aggregate proposed daily budget instead of each action in isolation', async () => {
    financialControlService.getFullMetrics.mockResolvedValueOnce({
      adsBudgetApproved: 3_500_000,
      maxDailyAds: 500_000,
      optimalAdsSuggestion: 7_000_000,
      dataQuality: { status: 'ok', isDecisionLocked: false },
    });
    const second = action({
      actionId: 'ACT002',
      idempotencyKey: 'PLAN-001:ACT002',
      typedPayload: { ...action().typedPayload, dailyBudget: 300_000 },
    });
    const first = action({
      typedPayload: { ...action().typedPayload, dailyBudget: 300_000 },
    });

    await expect(service.preflight(plan() as any, [first as any, second as any]))
      .rejects.toThrow('exceeds the Financial Control envelope');
  });

  it('allocates only the Google share of a cross-platform Financial Control envelope', async () => {
    financialControlService.getOptimalAdsSuggestion.mockResolvedValueOnce({
      adGroups: [
        { adGroupId: 'LEGACY-GOOGLE-1', optimalSuggested: 400_000 },
        { adGroupId: 'LEGACY-FACEBOOK-1', optimalSuggested: 600_000 },
      ],
      totalOptimalDaily: 1_000_000,
      totalOptimalWeekly: 7_000_000,
    });
    (legacyAdGroupModel.find as jest.Mock).mockReturnValueOnce(leanResult([
      { adGroupId: 'LEGACY-GOOGLE-1', platform: 'google' },
      { adGroupId: 'LEGACY-FACEBOOK-1', platform: 'facebook' },
    ]));

    await expect(service.preflight(plan() as any, [action({
      typedPayload: { ...action().typedPayload, dailyBudget: 500_000 },
    }) as any])).rejects.toThrow('exceeds the Financial Control envelope');
  });

  it('fails closed and reports the reason when the authoritative sync is stale', async () => {
    (syncRunModel.findOne as jest.Mock).mockReturnValueOnce(leanResult({
      status: 'success',
      customerIds: ['1234567890'],
      startedAt: new Date(Date.now() - 3_700_000),
      completedAt: new Date(Date.now() - 3_600_000),
    }));

    const preflight = await service.preflight(plan() as any, [action() as any], {
      enforceFinancialControl: false,
    });
    const diagnostic = await service.evaluateFinancialControl(preflight);

    expect(diagnostic).toEqual(expect.objectContaining({
      checked: true,
      required: true,
      allowed: false,
      reason: expect.stringContaining('missing, stale, or not successful'),
    }));
  });

  it('blocks spend increases after an unreconciled portfolio mutation', async () => {
    (executionLogModel.findOne as jest.Mock).mockReturnValueOnce(leanResult({
      status: 'success',
      actionType: 'update_campaign_budget',
      postExecutionErrors: [{ step: 'post_execution', message: 'sync failed' }],
      executedAt: new Date(),
    }));

    await expect(service.preflight(plan() as any, [action() as any]))
      .rejects.toThrow('not reconciled by a successful sync');
  });

  it('includes unchanged enabled campaign budgets in the portfolio envelope', async () => {
    (campaignModel.find as jest.Mock).mockReturnValueOnce(leanResult([{
      customerId: '1234567890',
      campaignId: '987',
      status: 'ENABLED',
      campaignBudgetId: '654',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/654',
      lastSyncAt: freshCompletedAt,
    }]));
    (budgetModel.find as jest.Mock).mockReturnValueOnce(leanResult([{
      customerId: '1234567890',
      campaignBudgetId: '654',
      resourceName: 'customers/1234567890/campaignBudgets/654',
      amountVnd: 400_000,
      lastSyncAt: freshCompletedAt,
    }]));
    financialControlService.getFullMetrics.mockResolvedValueOnce({
      adsBudgetApproved: 4_900_000,
      maxDailyAds: 700_000,
      optimalAdsSuggestion: 7_000_000,
      dataQuality: { status: 'ok', isDecisionLocked: false },
    });

    await expect(service.preflight(plan() as any, [action({
      typedPayload: { ...action().typedPayload, dailyBudget: 350_000 },
    }) as any])).rejects.toThrow('exceeds the Financial Control envelope');
  });

  it('fails closed when an enabled campaign lacks a canonical budget mapping', async () => {
    (campaignModel.find as jest.Mock).mockReturnValueOnce(leanResult([{
      customerId: '1234567890',
      campaignId: '987',
      status: 'ENABLED',
      lastSyncAt: freshCompletedAt,
    }]));

    await expect(service.preflight(plan() as any, [action() as any]))
      .rejects.toThrow('no canonical campaign budget mapping');
    expect(financialControlService.getFullMetrics).not.toHaveBeenCalled();
  });

  it('allows pause and budget reduction without consulting a locked Financial Control', async () => {
    financialControlService.getFullMetrics.mockRejectedValue(new Error('must not be called'));

    await expect(service.preflight(plan() as any, [action({
      actionType: 'pause_campaign',
      typedPayload: { campaignId: '111' },
    }) as any])).resolves.toHaveLength(1);

    process.env.GOOGLE_ADS_MAX_DAILY_BUDGET_VND = '400000';
    await expect(service.preflight(plan() as any, [action({
      actionType: 'update_campaign_budget',
      typedPayload: {
        campaignBudgetId: '222',
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/222',
        dailyBudget: 450000,
      },
    }) as any])).resolves.toHaveLength(1);

    expect(financialControlService.getFullMetrics).not.toHaveBeenCalled();
  });

  it('allows diagnostic preflight to bypass the live Financial Control gate explicitly', async () => {
    financialControlService.getFullMetrics.mockRejectedValue(new Error('unavailable'));

    await expect(service.preflight(plan() as any, [action() as any], {
      enforceFinancialControl: false,
    })).resolves.toHaveLength(1);
    expect(financialControlService.getFullMetrics).not.toHaveBeenCalled();
  });
});
