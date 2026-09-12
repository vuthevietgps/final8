import { MetaAdsLookupService } from './meta-ads-lookup.service';

describe('MetaAdsLookupService', () => {
  const originalAllowlist = process.env.META_ADS_ACCOUNT_ID_ALLOWLIST;
  const originalMaxAge = process.env.META_ADS_ACCOUNT_SYNC_MAX_AGE_MS;
  const exec = jest.fn();
  const lean = jest.fn(() => ({ exec }));
  const model = { find: jest.fn(() => ({ lean })) };
  const campaignExec = jest.fn();
  const campaignLean = jest.fn(() => ({ exec: campaignExec }));
  const campaignLimit = jest.fn(() => ({ lean: campaignLean }));
  const campaignSort = jest.fn(() => ({ limit: campaignLimit }));
  const campaignModel = { find: jest.fn(() => ({ sort: campaignSort })) };
  const resourceModel = { find: jest.fn(() => ({ sort: campaignSort })) };

  const service = () => new MetaAdsLookupService(
    model as any,
    campaignModel as any,
    resourceModel as any,
    resourceModel as any,
    resourceModel as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.META_ADS_ACCOUNT_ID_ALLOWLIST = '123,act_456';
    process.env.META_ADS_ACCOUNT_SYNC_MAX_AGE_MS = String(15 * 60 * 1000);
  });

  afterAll(() => {
    if (originalAllowlist === undefined) delete process.env.META_ADS_ACCOUNT_ID_ALLOWLIST;
    else process.env.META_ADS_ACCOUNT_ID_ALLOWLIST = originalAllowlist;
    if (originalMaxAge === undefined) delete process.env.META_ADS_ACCOUNT_SYNC_MAX_AGE_MS;
    else process.env.META_ADS_ACCOUNT_SYNC_MAX_AGE_MS = originalMaxAge;
  });

  it('queries only active Facebook accounts with a safe projection', async () => {
    exec.mockResolvedValue([]);

    await service().listAdAccounts();

    expect(model.find).toHaveBeenCalledWith(
      { accountType: 'facebook', isActive: true },
      {
        _id: 0,
        accountId: 1,
        name: 1,
        currency: 1,
        timezoneId: 1,
        accountStatus: 1,
        lastSyncAt: 1,
        lastSyncStatus: 1,
      },
    );
    const projection = (model.find.mock.calls as any[][])[0][1];
    expect(projection).not.toHaveProperty('loginCustomerId');
    expect(projection).not.toHaveProperty('adsManagerUserId');
    expect(projection).not.toHaveProperty('tokenSource');
    expect(projection).not.toHaveProperty('lastSyncError');
  });

  it('normalizes IDs and marks a ready allowlisted account eligible', async () => {
    exec.mockResolvedValue([{
      accountId: 'act_123',
      name: '  Tài khoản chính  ',
      currency: 'VND',
      timezoneId: 'Asia/Ho_Chi_Minh',
      accountStatus: 1,
      lastSyncStatus: 'ok',
      lastSyncAt: new Date(),
      adsManagerUserId: 'must-not-leak',
      loginCustomerId: 'must-not-leak',
    }]);

    const result = await service().listAdAccounts();

    expect(result).toEqual([expect.objectContaining({
      adAccountId: '123',
      name: 'Tài khoản chính',
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      accountStatus: 1,
      lastSyncStatus: 'ok',
      eligible: true,
      readinessBlockers: [],
    })]);
    expect(result[0]).not.toHaveProperty('adsManagerUserId');
    expect(result[0]).not.toHaveProperty('loginCustomerId');
  });

  it('excludes malformed IDs and returns normalized readiness blockers only', async () => {
    exec.mockResolvedValue([
      { accountId: 'invalid-id', name: 'Invalid' },
      {
        accountId: '456',
        name: 'Stale account',
        currency: 'USD',
        timezoneId: 'UTC',
        accountStatus: 2,
        lastSyncStatus: 'error',
        lastSyncAt: new Date(Date.now() - 60 * 60 * 1000),
        lastSyncError: 'access_token=secret-provider-message',
      },
    ]);

    const result = await service().listAdAccounts();

    expect(result).toHaveLength(1);
    expect(result[0].adAccountId).toBe('456');
    expect(result[0].eligible).toBe(false);
    expect(result[0].readinessBlockers.map((item) => item.code)).toEqual([
      'CURRENCY_NOT_VND',
      'TIMEZONE_NOT_VIETNAM',
      'PROVIDER_ACCOUNT_NOT_ACTIVE',
      'SYNC_NOT_SUCCESSFUL',
      'SYNC_STALE',
    ]);
    expect(JSON.stringify(result)).not.toContain('secret-provider-message');
  });

  it('fails account readiness closed when the allowlist is empty', async () => {
    process.env.META_ADS_ACCOUNT_ID_ALLOWLIST = '';
    exec.mockResolvedValue([{
      accountId: '123',
      name: 'Account',
      currency: 'VND',
      timezoneId: 'Asia/Ho_Chi_Minh',
      accountStatus: 1,
      lastSyncStatus: 'ok',
      lastSyncAt: new Date(),
    }]);

    const [result] = await service().listAdAccounts();
    expect(result.eligible).toBe(false);
    expect(result.readinessBlockers).toEqual([expect.objectContaining({ code: 'NOT_ALLOWLISTED' })]);
  });

  it('returns only sanitized canonical ERP campaigns for an allowlisted account', async () => {
    campaignExec.mockResolvedValue([{
      campaignId: '987654321',
      name: 'Campaign ERP',
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      effectiveStatus: 'PAUSED',
      budgetMode: 'CBO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 500_000,
      lastReadbackAt: new Date(),
      sourceIdempotencyKey: 'must-not-leak',
    }]);

    const result = await service().listCampaigns('act_123');

    expect(campaignModel.find).toHaveBeenCalledWith(
      { adAccountId: '123', status: { $nin: ['ARCHIVED', 'DELETED'] } },
      expect.not.objectContaining({ sourceIdempotencyKey: 1 }),
    );
    expect(campaignSort).toHaveBeenCalledWith({ lastReadbackAt: -1, campaignId: 1 });
    expect(campaignLimit).toHaveBeenCalledWith(500);
    expect(result).toEqual([expect.objectContaining({
      campaignId: '987654321',
      name: 'Campaign ERP',
      budgetType: 'DAILY',
      dailyBudgetVnd: 500_000,
    })]);
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });
});
