import { BudgetApplyService } from './budget-apply.service';

describe('BudgetApplyService legacy mutation guardrail', () => {
  const previousEnv = process.env;

  afterEach(() => {
    process.env = previousEnv;
  });

  const createService = () => {
    const adGroupModel = { findOne: jest.fn(), updateMany: jest.fn() };
    const adAccountModel = { findById: jest.fn() };
    const service = new BudgetApplyService(
      adGroupModel as any,
      adAccountModel as any,
    );
    return { service, adGroupModel, adAccountModel };
  };

  it('stays fail-closed even when every legacy execution flag is enabled', async () => {
    process.env = {
      ...previousEnv,
      AI_MARKETING_PROVIDER_EXECUTION_ENABLED: 'true',
      GOOGLE_ADS_PRODUCTION_ENABLED: 'true',
    };
    const { service, adGroupModel, adAccountModel } = createService();

    const result = await service.applyBudgetToProviderDetailed(
      {
        platform: 'google',
        adGroupId: '222222',
        campaignBudgetId: '444444',
        campaignBudgetResourceName: 'customers/111111/campaignBudgets/444444',
      } as any,
      { accountId: '111111' } as any,
      100000,
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CANONICAL_GOOGLE_ADS_V2_EXECUTION_REQUIRED');
    expect(result.message).toContain('validateOnly');
    expect(adGroupModel.updateMany).not.toHaveBeenCalled();
    expect(adAccountModel.findById).not.toHaveBeenCalled();
  });

  it('blocks legacy pause and resume mutations without touching persistence', async () => {
    process.env = {
      ...previousEnv,
      AI_MARKETING_PROVIDER_EXECUTION_ENABLED: 'true',
      GOOGLE_ADS_PRODUCTION_ENABLED: 'true',
    };
    const { service, adGroupModel, adAccountModel } = createService();
    const adGroup = { platform: 'google', adGroupId: '222222' } as any;
    const account = { accountId: '111111' } as any;

    const pauseResult = await service.pauseAdGroupOnProvider(adGroup, account);
    const resumeResult = await service.resumeAdGroupOnProvider(adGroup, account);

    expect(pauseResult).toEqual(expect.objectContaining({
      ok: false,
      action: 'pause',
      code: 'CANONICAL_GOOGLE_ADS_V2_EXECUTION_REQUIRED',
    }));
    expect(resumeResult).toEqual(expect.objectContaining({
      ok: false,
      action: 'resume',
      code: 'CANONICAL_GOOGLE_ADS_V2_EXECUTION_REQUIRED',
    }));
    expect(adGroupModel.updateMany).not.toHaveBeenCalled();
    expect(adAccountModel.findById).not.toHaveBeenCalled();
  });

  it('contains no legacy provider mutation implementations', () => {
    const { service } = createService();

    expect((service as any).applyFacebookBudget).toBeUndefined();
    expect((service as any).applyGoogleBudget).toBeUndefined();
    expect((service as any).applyTiktokBudget).toBeUndefined();
    expect((service as any).setFacebookStatus).toBeUndefined();
    expect((service as any).setGoogleStatus).toBeUndefined();
    expect((service as any).setTiktokStatus).toBeUndefined();
    expect((service as any).getTiktokAccessToken).toBeUndefined();
  });
});
