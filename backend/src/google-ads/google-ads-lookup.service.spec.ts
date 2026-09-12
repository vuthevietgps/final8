import { GoogleAdsLookupService } from './google-ads-lookup.service';

const query = (value: any) => {
  const result: any = { lean: jest.fn().mockResolvedValue(value) };
  result.sort = jest.fn(() => result);
  result.limit = jest.fn(() => result);
  return result;
};

describe('GoogleAdsLookupService', () => {
  const accounts = [{
    accountId: '123-456-7890',
    name: 'Google Direct',
    accountType: 'google',
    isActive: true,
    currency: 'VND',
    timezoneId: 'Asia/Ho_Chi_Minh',
    lastSyncStatus: 'ok',
    lastSyncAt: new Date(),
  }];
  const adAccountModel = { find: jest.fn(() => query(accounts)) };
  const campaignModel = { find: jest.fn(() => query([{
    customerId: '1234567890',
    campaignId: '111',
    campaignName: 'Canonical Search',
    status: 'PAUSED',
    advertisingChannelType: 'SEARCH',
    biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
    campaignBudgetId: '222',
    campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/222',
    lastSyncAt: new Date(),
  }])) };
  const budgetModel = { find: jest.fn(() => query([{
    campaignBudgetId: '222',
    resourceName: 'customers/1234567890/campaignBudgets/222',
    name: 'Daily budget',
    amountVnd: 500_000,
    deliveryMethod: 'STANDARD',
    explicitlyShared: false,
  }])) };
  const managerModel = { find: jest.fn(() => query([])) };
  const service = new GoogleAdsLookupService(
    adAccountModel as any,
    campaignModel as any,
    budgetModel as any,
    managerModel as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    adAccountModel.find.mockReturnValue(query(accounts));
    managerModel.find.mockReturnValue(query([]));
  });

  afterAll(() => delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

  it('returns canonical account and Search campaign choices without login or credential data', async () => {
    const accountChoices = await service.listAdAccounts();
    const campaignChoices = await service.listCampaigns('1234567890');

    expect(accountChoices[0]).toEqual(expect.objectContaining({
      customerId: '1234567890',
      eligible: true,
    }));
    expect(accountChoices[0]).not.toHaveProperty('loginCustomerId');
    expect(campaignChoices[0]).toEqual(expect.objectContaining({
      campaignId: '111',
      advertisingChannelType: 'SEARCH',
      budget: expect.objectContaining({
        campaignBudgetId: '222',
        dailyBudgetVnd: 500_000,
        explicitlyShared: false,
      }),
    }));
  });

  it('reports MCC readiness blockers without returning the manager ID', async () => {
    adAccountModel.find.mockReturnValueOnce(query([{
      ...accounts[0],
      loginCustomerId: '999-888-7777',
    }]));
    managerModel.find.mockReturnValueOnce(query([{
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '9998887777',
      isActive: true,
      providerVerificationStatus: 'verified',
      providerVerificationExpiresAt: new Date(Date.now() - 1),
    }]));

    const result = await service.listAdAccounts();

    expect(result[0].eligible).toBe(false);
    expect(result[0].readinessBlockers).toContain('MCC_PROVIDER_VERIFICATION_EXPIRED');
    expect(result[0]).not.toHaveProperty('loginCustomerId');
    expect(JSON.stringify(result[0])).not.toContain('9998887777');
  });
});
