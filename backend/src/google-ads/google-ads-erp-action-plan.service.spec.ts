import { GoogleAdsErpActionPlanService } from './google-ads-erp-action-plan.service';

const lean = (value: any) => ({ lean: jest.fn().mockResolvedValue(value) });

describe('GoogleAdsErpActionPlanService', () => {
  const created: any[] = [];
  const actionPlanModel = {
    create: jest.fn(async (value) => {
      created.push(value);
      return { toObject: () => value };
    }),
  };
  const directAccount = {
    accountId: '123-456-7890',
    accountType: 'google',
    isActive: true,
    name: 'Google Direct',
    currency: 'VND',
    timezoneId: 'Asia/Ho_Chi_Minh',
    lastSyncStatus: 'ok',
    lastSyncAt: new Date(),
  };
  const adAccountModel = {
    find: jest.fn(() => lean([directAccount])),
  };
  const campaignModel = {
    findOne: jest.fn(() => lean({
      customerId: '1234567890',
      campaignId: '111',
      resourceName: 'customers/1234567890/campaigns/111',
      campaignName: 'Canonical Search',
      advertisingChannelType: 'SEARCH',
      campaignBudgetId: '222',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/222',
      endDate: '2026-12-31',
      biddingStrategyType: 'MANUAL_CPC',
      lastSyncAt: new Date(),
    })),
  };
  const budgetModel = {
    findOne: jest.fn(() => lean({
      customerId: '1234567890',
      campaignBudgetId: '222',
      resourceName: 'customers/1234567890/campaignBudgets/222',
      amountVnd: 500_000,
      lastSyncAt: new Date(),
    })),
  };
  const adGroupModel = {
    findOne: jest.fn(() => lean(null)),
    find: jest.fn(() => lean([])),
  };
  const keywordModel = { findOne: jest.fn(() => lean(null)) };
  const adModel = { findOne: jest.fn(() => lean(null)) };
  const managerModel = { find: jest.fn(() => lean([])) };
  const campaignCriterionModel = { find: jest.fn(() => lean([])) };
  const service = new GoogleAdsErpActionPlanService(
    actionPlanModel as any,
    adAccountModel as any,
    campaignModel as any,
    budgetModel as any,
    adGroupModel as any,
    keywordModel as any,
    adModel as any,
    managerModel as any,
    campaignCriterionModel as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    created.length = 0;
    process.env.GOOGLE_ADS_MAX_DAILY_BUDGET_VND = '5000000';
    delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST = 'htxbachgia.shop';
    adAccountModel.find.mockReturnValue(lean([directAccount]));
    managerModel.find.mockReturnValue(lean([]));
    adGroupModel.find.mockReturnValue(lean([]));
    adGroupModel.findOne.mockReturnValue(lean(null));
    keywordModel.findOne.mockReturnValue(lean(null));
    adModel.findOne.mockReturnValue(lean(null));
    campaignCriterionModel.find.mockReturnValue(lean([]));
    campaignModel.findOne.mockReturnValue(lean({
      customerId: '1234567890',
      campaignId: '111',
      resourceName: 'customers/1234567890/campaigns/111',
      campaignName: 'Canonical Search',
      advertisingChannelType: 'SEARCH',
      campaignBudgetId: '222',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/222',
      endDate: '2026-12-31',
      biddingStrategyType: 'MANUAL_CPC',
      lastSyncAt: new Date(),
    }));
    budgetModel.findOne.mockReturnValue(lean({
      customerId: '1234567890',
      campaignBudgetId: '222',
      resourceName: 'customers/1234567890/campaignBudgets/222',
      amountVnd: 500_000,
      lastSyncAt: new Date(),
    }));
  });

  afterAll(() => {
    delete process.env.GOOGLE_ADS_MAX_DAILY_BUDGET_VND;
    delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST;
  });

  it('creates an ERP plan with a forced PAUSED Search campaign and no browser credentials', async () => {
    const result = await service.createPlan({
      planName: 'Safe Google Search launch',
      actions: [{
        actionType: 'create_search_campaign',
        customerId: '1234567890',
        reason: 'Launch a controlled Search campaign',
        payload: {
          campaignName: 'Search - Vietnam',
          dailyBudgetVnd: 500_000,
          biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
          startDate: futureDate(2),
          geoTargetConstantIds: ['2704'],
          languageConstantIds: ['1040'],
          doesNotContainEuPoliticalAdvertising: true,
        },
      }],
    }, 'maker-1');

    expect(result.success).toBe(true);
    expect(created[0]).toEqual(expect.objectContaining({
      source: 'erp_ui',
      createdByUserId: 'maker-1',
      planName: 'Safe Google Search launch',
    }));
    expect(created[0].items[0].typedPayload).toEqual(expect.objectContaining({
      advertisingChannelType: 'SEARCH',
      status: 'PAUSED',
      searchPartnersEnabled: false,
      positiveGeoTargetType: 'PRESENCE',
      doesNotContainEuPoliticalAdvertising: true,
    }));
    expect(created[0].items[0]).not.toHaveProperty('credentialReferenceId');
    expect(result.plan.items[0]).not.toHaveProperty('loginCustomerId');
  });

  it('splits a safe campaign update from its canonical budget update', async () => {
    await service.createPlan({
      planName: 'Update Search',
      actions: [{
        actionType: 'update_search_campaign',
        customerId: '1234567890',
        campaignId: '111',
        reason: 'Rename, shorten, and adjust budget',
        idempotencyKey: 'update-search-111',
        payload: {
          campaignName: 'Canonical Search - July',
          endDate: futureDate(30),
          dailyBudgetVnd: 550_000,
        },
      }],
    }, 'maker-1');

    expect(created[0].items).toHaveLength(2);
    expect(created[0].items.map((item: any) => item.actionType)).toEqual([
      'update_search_campaign',
      'update_campaign_budget',
    ]);
    expect(created[0].items[1].typedPayload).toEqual(expect.objectContaining({
      campaignId: '111',
      campaignBudgetId: '222',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/222',
      dailyBudget: 550_000,
    }));
    expect(created[0].items.map((item: any) => item.idempotencyKey)).toEqual([
      'update-search-111:campaign',
      'update-search-111:budget',
    ]);
  });

  it('creates a high-risk typed bidding draft with exact micros and automation provenance', async () => {
    await service.createPlan({
      planName: 'Automatic bidding transition',
      actions: [{
        actionType: 'update_campaign_bidding_strategy',
        customerId: '1234567890',
        campaignId: '111',
        reason: 'Click threshold reached in canonical metrics',
        idempotencyKey: 'GADS:BID:1234567890:111:2026-07-16:CPC',
        payload: {
          biddingStrategyType: 'MAXIMIZE_CLICKS',
          maxCpcBidCeilingVnd: 2_500,
        },
      }],
    }, 'google-ads-bidding-lifecycle', 'erp_automation');

    expect(created[0]).toEqual(expect.objectContaining({
      source: 'erp_automation',
      executionMode: 'pending_approval',
      status: 'pending_approval',
    }));
    expect(created[0].items[0]).toEqual(expect.objectContaining({
      actionType: 'update_campaign_bidding_strategy',
      risk: 'high',
      approvalRequired: true,
      status: 'pending',
      dataQuality: 'erp_automation_policy+canonical_lookup',
      evidence: expect.objectContaining({ source: 'erp_automation' }),
      typedPayload: expect.objectContaining({
        biddingStrategyType: 'MAXIMIZE_CLICKS',
        maxCpcBidCeilingMicros: 2_500_000_000,
      }),
    }));
  });

  it('never falls back from campaignId to campaignBudgetId', async () => {
    campaignModel.findOne.mockReturnValueOnce(lean({
      customerId: '1234567890',
      campaignId: '111',
      resourceName: 'customers/1234567890/campaigns/111',
      advertisingChannelType: 'SEARCH',
      lastSyncAt: new Date(),
    }));

    await expect(service.createPlan({
      planName: 'Unsafe budget mapping',
      actions: [{
        actionType: 'update_campaign_budget',
        customerId: '1234567890',
        campaignId: '111',
        reason: 'Budget update',
        payload: { dailyBudgetVnd: 400_000 },
      }],
    }, 'maker-1')).rejects.toThrow('never used as a budget fallback');
    expect(budgetModel.findOne).not.toHaveBeenCalled();
  });

  it('fails closed when a configured MCC is not provider-verified', async () => {
    adAccountModel.find.mockReturnValueOnce(lean([{
      ...directAccount,
      loginCustomerId: '999-888-7777',
    }]));
    managerModel.find.mockReturnValueOnce(lean([{
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '9998887777',
      isActive: true,
      providerVerificationStatus: 'never_verified',
    }]));

    await expect(service.createPlan({
      planName: 'MCC blocked',
      actions: [{
        actionType: 'pause_campaign',
        customerId: '1234567890',
        campaignId: '111',
        reason: 'Pause',
        payload: {},
      }],
    }, 'maker-1')).rejects.toThrow('MCC readiness blocked');
  });

  it('binds a verified MCC action to its server-side credential reference and hides it from UI', async () => {
    adAccountModel.find.mockReturnValueOnce(lean([{
      ...directAccount,
      loginCustomerId: '999-888-7777',
    }]));
    managerModel.find.mockReturnValueOnce(lean([{
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '9998887777',
      isActive: true,
      providerVerificationStatus: 'verified',
      providerVerificationExpiresAt: new Date(Date.now() + 60_000),
      runtimeCredentialResolved: true,
      providerConnectionVerified: true,
      childAccountsVerifiedByProvider: true,
      vaultProvider: 'erp_secret_store',
      credentialReferenceId: '507f1f77bcf86cd799439011',
      verifiedChildAccounts: [{
        accountId: '1234567890',
        name: 'Child',
        currency: 'VND',
        timezoneId: 'Asia/Ho_Chi_Minh',
        status: 'ENABLED',
      }],
    }]));

    const result = await service.createPlan({
      planName: 'Verified MCC pause',
      actions: [{
        actionType: 'pause_campaign',
        customerId: '1234567890',
        campaignId: '111',
        reason: 'Pause from ERP',
        payload: {},
      }],
    }, 'maker-1');

    expect(created[0].items[0]).toEqual(expect.objectContaining({
      loginCustomerId: '9998887777',
      credentialReferenceId: '507f1f77bcf86cd799439011',
    }));
    expect(result.plan.items[0]).not.toHaveProperty('loginCustomerId');
    expect(result.plan.items[0]).not.toHaveProperty('credentialReferenceId');
  });

  it('blocks conversion-bidding campaign activation until canonical goal evidence exists', async () => {
    const syncedAt = new Date();
    campaignModel.findOne.mockReturnValueOnce(lean({
      customerId: '1234567890',
      campaignId: '111',
      resourceName: 'customers/1234567890/campaigns/111',
      advertisingChannelType: 'SEARCH',
      biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
      status: 'PAUSED',
      targetGoogleSearch: true,
      targetContentNetwork: false,
      targetPartnerSearchNetwork: false,
      lastSyncAt: syncedAt,
    }));
    campaignCriterionModel.find
      .mockReturnValueOnce(lean([{
        criterionType: 'LOCATION',
        negative: false,
        status: 'ENABLED',
        lastSyncAt: syncedAt,
      }]))
      .mockReturnValueOnce(lean([{
        criterionType: 'LANGUAGE',
        negative: false,
        status: 'ENABLED',
        lastSyncAt: syncedAt,
      }]));
    adGroupModel.find.mockReturnValueOnce(lean([{
      campaignId: '111',
      adGroupId: '333',
      type: 'SEARCH_STANDARD',
      status: 'ENABLED',
      lastSyncAt: syncedAt,
    }]));
    keywordModel.findOne.mockReturnValueOnce(lean({
      campaignId: '111',
      adGroupId: '333',
      negative: false,
      status: 'ENABLED',
      lastSyncAt: syncedAt,
    }));
    adModel.findOne.mockReturnValueOnce(lean({
      campaignId: '111',
      adGroupId: '333',
      adType: 'RESPONSIVE_SEARCH_AD',
      status: 'ENABLED',
      policyApprovalStatus: 'APPROVED',
      finalUrls: ['https://htxbachgia.shop/san-pham'],
      lastSyncAt: syncedAt,
    }));

    await expect(service.createPlan({
      planName: 'Unsafe conversion activation',
      actions: [{
        actionType: 'resume_campaign',
        customerId: '1234567890',
        campaignId: '111',
        reason: 'Activate after staged child verification',
        payload: {},
      }],
    }, 'maker-1')).rejects.toThrow(
      'blocked until canonical primary conversion actions and biddable campaign goals are synced',
    );
    expect(campaignCriterionModel.find).toHaveBeenCalledWith(expect.objectContaining({
      criterionType: 'LOCATION',
      status: 'ENABLED',
    }));
    expect(campaignCriterionModel.find).toHaveBeenCalledWith(expect.objectContaining({
      criterionType: 'LANGUAGE',
      status: 'ENABLED',
    }));
    expect(actionPlanModel.create).not.toHaveBeenCalled();
  });
});

function futureDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
