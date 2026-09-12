import { GoogleAdsConversionReadinessService } from './google-ads-conversion-readiness.service';

const leanOne = (value: any) => ({ lean: jest.fn().mockResolvedValue(value) });
const leanMany = (value: any[]) => ({ lean: jest.fn().mockResolvedValue(value) });

describe('GoogleAdsConversionReadinessService', () => {
  const now = new Date();
  const accountModel = {
    findOne: jest.fn(() => leanOne({
      accountId: '123-456-7890',
      googleAdsConversionCustomer: 'customers/1234567890',
      conversionTrackingStatus: 'CONVERSION_TRACKING_MANAGED_BY_SELF',
    })),
  };
  const actionModel = {
    find: jest.fn(() => leanMany([{
      ownerCustomerId: '1234567890',
      status: 'ENABLED',
      primaryForGoal: true,
      category: 'PURCHASE',
      origin: 'WEBSITE',
      lastSyncAt: now,
    }])),
  };
  const goalModel = {
    find: jest.fn(() => leanMany([{
      category: 'PURCHASE',
      origin: 'WEBSITE',
      biddable: true,
      lastSyncAt: now,
    }])),
  };
  const configModel = {
    findOne: jest.fn(() => leanOne({
      goalConfigLevel: 'CUSTOMER',
      lastSyncAt: now,
    })),
  };
  const service = new GoogleAdsConversionReadinessService(
    accountModel as any,
    actionModel as any,
    goalModel as any,
    configModel as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accountModel.findOne.mockReturnValue(leanOne({
      accountId: '123-456-7890',
      googleAdsConversionCustomer: 'customers/1234567890',
      conversionTrackingStatus: 'CONVERSION_TRACKING_MANAGED_BY_SELF',
    }));
    actionModel.find.mockReturnValue(leanMany([{
      ownerCustomerId: '1234567890',
      status: 'ENABLED',
      primaryForGoal: true,
      category: 'PURCHASE',
      origin: 'WEBSITE',
      lastSyncAt: new Date(),
    }]));
    goalModel.find.mockReturnValue(leanMany([{
      category: 'PURCHASE',
      origin: 'WEBSITE',
      biddable: true,
      lastSyncAt: new Date(),
    }]));
    configModel.findOne.mockReturnValue(leanOne({
      goalConfigLevel: 'CUSTOMER',
      lastSyncAt: new Date(),
    }));
  });

  it('passes only when a fresh primary action matches a biddable campaign goal', async () => {
    await expect(service.evaluate('1234567890', '111')).resolves.toEqual(
      expect.objectContaining({
        ready: true,
        blockers: [],
        evidence: expect.objectContaining({
          conversionCustomerId: '1234567890',
          conversionTrackingStatus: 'CONVERSION_TRACKING_MANAGED_BY_SELF',
          primaryActionCount: 1,
          biddableGoalCount: 1,
          matchedGoalCount: 1,
        }),
      }),
    );
  });

  it('fails closed for custom goals or mismatched canonical evidence', async () => {
    configModel.findOne.mockReturnValueOnce(leanOne({
      goalConfigLevel: 'CAMPAIGN',
      customConversionGoalResourceName:
        'customers/1234567890/customConversionGoals/99',
      lastSyncAt: new Date(),
    }));
    goalModel.find.mockReturnValueOnce(leanMany([{
      category: 'SIGNUP',
      origin: 'WEBSITE',
      biddable: true,
      lastSyncAt: new Date(),
    }]));

    const result = await service.evaluate('1234567890', '111');
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'CUSTOM_CONVERSION_GOAL_EVIDENCE_NOT_SUPPORTED',
      'PRIMARY_ACTION_AND_BIDDABLE_GOAL_DO_NOT_MATCH',
    ]));
  });

  it('fails closed when conversion tracking status is not enabled', async () => {
    accountModel.findOne.mockReturnValueOnce(leanOne({
      accountId: '123-456-7890',
      googleAdsConversionCustomer: 'customers/1234567890',
      conversionTrackingStatus: 'NOT_CONVERSION_TRACKED',
    }));

    const result = await service.evaluate('1234567890', '111');

    expect(result.ready).toBe(false);
    expect(result.blockers).toContain(
      'CONVERSION_TRACKING_NOT_ENABLED_OR_UNCONFIRMED',
    );
  });
});
