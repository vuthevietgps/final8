import { MetaAdsExecutionService } from './meta-ads-execution.service';
import { MetaAdsProviderError } from './meta-ads-provider-client.service';

describe('MetaAdsExecutionService', () => {
  const action = {
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
    specialAdCategoryCountries: [],
    budgetMode: 'ABO',
    budgetType: 'NONE',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    payloadHash: 'a'.repeat(64),
    workflowStatus: 'approved',
    providerValidationStatus: 'passed',
    providerValidationBeforeStateHash: 'b'.repeat(64),
    approvedByUserId: 'approver-1',
    revision: 2,
  };
  const plan = {
    planId: 'META-PLAN-1',
    planName: 'Plan',
    createdByUserId: 'creator-1',
    actions: [action],
    revision: 1,
  };
  const planModel = {
    findOne: jest.fn().mockResolvedValue(plan),
    exists: jest.fn().mockResolvedValue({ _id: 'plan-object-id' }),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const reservation = { _id: 'reservation-1', ...action, planId: plan.planId, status: 'reserved' };
  const reservationModel = {
    create: jest.fn().mockResolvedValue(reservation),
    findOne: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const log: any = {
    _id: 'log-1',
    status: 'executing',
    providerErrors: [],
    save: jest.fn().mockResolvedValue(undefined),
  };
  const executionLogModel = {
    create: jest.fn().mockResolvedValue(log),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    find: jest.fn(),
  };
  const campaignModel = { updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }) };
  const resourceModel = { updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }) };
  const preflight = {
    plan,
    action,
    providerAction: action,
    payloadHash: action.payloadHash,
    beforeState: undefined,
    beforeStateHash: 'b'.repeat(64),
    credentialReferenceId: 'credential-1',
    graphApiVersion: 'v25.0',
  };
  const policy = {
    preflightLive: jest.fn().mockResolvedValue(preflight),
    dryRunDiagnostic: jest.fn().mockResolvedValue({
      actionId: action.actionId,
      liveEligible: false,
      blockers: ['META_ADS_PRODUCTION_ENABLED'],
      providerNetworkCalled: false,
    }),
    userId: jest.fn(() => 'executor-2'),
  };
  const providerClient = {
    mutate: jest.fn(),
    readCampaign: jest.fn(),
    readAdSet: jest.fn(),
  };
  const service = () => new MetaAdsExecutionService(
    planModel as any,
    reservationModel as any,
    executionLogModel as any,
    campaignModel as any,
    resourceModel as any,
    resourceModel as any,
    resourceModel as any,
    policy as any,
    providerClient as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    planModel.findOne.mockResolvedValue(plan);
    planModel.updateOne.mockResolvedValue({ matchedCount: 1 });
    reservationModel.create.mockResolvedValue({ ...reservation });
    reservationModel.updateOne.mockResolvedValue({ matchedCount: 1 });
    reservationModel.deleteOne.mockResolvedValue({ deletedCount: 1 });
    executionLogModel.create.mockResolvedValue({
      ...log,
      status: 'executing',
      providerErrors: [],
      save: jest.fn().mockResolvedValue(undefined),
    });
    policy.preflightLive.mockResolvedValue(preflight);
    policy.userId.mockReturnValue('executor-2');
  });

  it('keeps immutable idempotency reservation when POST outcome is unknown', async () => {
    providerClient.mutate.mockRejectedValue(
      new MetaAdsProviderError('socket closed', 'unknown'),
    );

    const result = await service().execute(
      { id: 'executor-2' },
      plan.planId,
      { actionIds: [action.actionId], dryRun: false, validateOnly: false, source: 'erp_ui' },
    );

    expect(providerClient.mutate).toHaveBeenCalledTimes(1);
    expect(result.actions[0]).toEqual(expect.objectContaining({
      success: false,
      status: 'provider_outcome_unknown',
      retryMutationAllowed: false,
    }));
    expect(reservationModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'provider_outcome_unknown' }),
      }),
    );
    expect(reservationModel.updateOne.mock.calls.some(([, update]) =>
      update?.$set?.idempotencyReserved === false || update?.$unset?.idempotencyKey)).toBe(false);
    expect(reservationModel.deleteOne).not.toHaveBeenCalled();
  });

  it('releases only an unused reservation when the approved action cannot be claimed', async () => {
    planModel.updateOne.mockResolvedValueOnce({ matchedCount: 0 });

    const result = await service().execute(
      { id: 'executor-2' },
      plan.planId,
      { actionIds: [action.actionId], dryRun: false, validateOnly: false, source: 'erp_ui' },
    );

    expect(result.actions[0]).toEqual(expect.objectContaining({
      success: false,
      status: 'blocked',
    }));
    expect(reservationModel.deleteOne).toHaveBeenCalledWith({
      _id: reservation._id,
      status: 'reserved',
    });
    expect(providerClient.mutate).not.toHaveBeenCalled();
  });

  it('runs dry-run with no provider or reservation call while live flags may be disabled', async () => {
    const result = await service().execute(
      { id: 'executor-2' },
      plan.planId,
      { actionIds: [action.actionId], dryRun: true, source: 'erp_ui' },
    );

    expect(result).toEqual(expect.objectContaining({
      dryRun: true,
      status: 'blocked',
      providerNetworkCalled: false,
    }));
    expect(providerClient.mutate).not.toHaveBeenCalled();
    expect(providerClient.readCampaign).not.toHaveBeenCalled();
    expect(reservationModel.create).not.toHaveBeenCalled();
  });

  it('reads back pause_ad_set by exact ID and preserves existing ERP mapping fields', async () => {
    const pauseAction = {
      ...action,
      actionType: 'pause_ad_set',
      campaignId: '456',
      adSetId: '789',
      idempotencyKey: 'meta:pause:123:789',
    };
    const pausePlan = {
      ...plan,
      actions: [pauseAction],
    };
    const pausePreflight = {
      ...preflight,
      plan: pausePlan,
      action: pauseAction,
      providerAction: pauseAction,
    };
    planModel.findOne.mockResolvedValueOnce(pausePlan);
    policy.preflightLive.mockResolvedValueOnce(pausePreflight);
    providerClient.mutate.mockResolvedValueOnce({
      resourceId: '789',
      campaignId: '456',
      adSetId: '789',
      providerRequestId: 'request-1',
      response: { success: true },
    });
    providerClient.readAdSet.mockResolvedValueOnce({
      resourceType: 'AD_SET',
      adAccountId: '123',
      campaignId: '456',
      adSetId: '789',
      name: 'Canonical Ad Set',
      status: 'PAUSED',
      effectiveStatus: 'PAUSED',
      budgetMode: 'ABO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 100_000,
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      optimizationGoal: 'LINK_CLICKS',
      billingEvent: 'IMPRESSIONS',
      destinationType: 'WEBSITE',
      targetingCountries: ['VN'],
      genders: [],
      publisherPlatforms: [],
      facebookPositions: [],
      instagramPositions: [],
    });

    const result = await service().execute(
      { id: 'executor-2' },
      pausePlan.planId,
      {
        actionIds: [pauseAction.actionId],
        dryRun: false,
        validateOnly: false,
        source: 'erp_ui',
      },
    );

    expect(result).toEqual(expect.objectContaining({
      success: true,
      status: 'executed',
      executed: 1,
    }));
    expect(providerClient.readAdSet).toHaveBeenCalledWith(
      '123',
      '789',
      {
        attempts: 3,
        expectedCredentialReferenceId: 'credential-1',
      },
    );
    const adSetWrite = resourceModel.updateOne.mock.calls.find(
      ([filter]: any[]) => filter?.adSetId === '789',
    );
    expect(adSetWrite).toBeDefined();
    expect(adSetWrite?.[1]?.$set).toEqual(expect.objectContaining({
      campaignId: '456',
      status: 'PAUSED',
    }));
    expect(adSetWrite?.[1]?.$set).not.toHaveProperty('internalAdGroupId');
    expect(adSetWrite?.[1]?.$set).not.toHaveProperty('internalProductIds');
  });

  it('reconciliation uses GET readback only and never repeats POST', async () => {
    reservationModel.findOne.mockResolvedValue({
      ...reservation,
      actionId: action.actionId,
      campaignId: '456',
      credentialReferenceId: 'credential-1',
      status: 'provider_outcome_unknown',
    });
    providerClient.readCampaign.mockResolvedValue({
      adAccountId: '123', campaignId: '456', name: 'Campaign',
      objective: 'OUTCOME_AWARENESS', status: 'PAUSED', effectiveStatus: 'PAUSED',
      buyingType: 'AUCTION', specialAdCategories: ['NONE'], specialAdCategoryCountries: [],
      budgetMode: 'ABO', budgetType: 'NONE', bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    });

    const result = await service().reconcile(action.idempotencyKey);

    expect(result.status).toBe('reconciled');
    expect(providerClient.readCampaign).toHaveBeenCalledTimes(1);
    expect(providerClient.mutate).not.toHaveBeenCalled();
  });

  it('returns bounded newest execution logs without credential reference fields', async () => {
    const lean = jest.fn().mockResolvedValue([{
      planId: plan.planId,
      actionId: action.actionId,
      credentialReferenceId: 'credential-secret-ref',
      providerErrors: [{ message: 'authorization=Bearer actual-secret' }],
    }]);
    const limit = jest.fn(() => ({ lean }));
    const sort = jest.fn(() => ({ limit }));
    executionLogModel.find.mockReturnValue({ sort });

    const result = await service().getExecutions(plan.planId, 10_000);

    expect(limit).toHaveBeenCalledWith(500);
    expect(result.executions[0].credentialReferenceId).toBeUndefined();
    expect(JSON.stringify(result.executions)).not.toContain('actual-secret');
  });
});
