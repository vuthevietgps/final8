import { GoogleAdsBiddingLifecycleService } from './google-ads-bidding-lifecycle.service';

function queryResult<T>(value: T) {
  const query: any = {
    lean: jest.fn().mockResolvedValue(value),
    sort: jest.fn(),
    limit: jest.fn(),
  };
  query.sort.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

function dateKey(daysAgo: number) {
  const value = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function policy(overrides: Record<string, any> = {}) {
  return {
    customerId: '1234567890',
    campaignId: '9876543210',
    enabled: true,
    clickThreshold: 50,
    clickWindowDays: 30,
    maxCpcBidCeilingVnd: 20_000,
    maximizeConversionsMinConversions: 15,
    conversionWindowDays: 30,
    targetCpaMinConversions: 30,
    targetCpaVnd: 250_000,
    cooldownHours: 168,
    minimumStageDwellHours: 168,
    draftOnly: true,
    policyVersion: 3,
    observedStage: 'MAXIMIZE_CLICKS',
    stageEnteredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    lastDecision: 'NOT_EVALUATED',
    blockers: [],
    ...overrides,
  };
}

function campaign(overrides: Record<string, any> = {}) {
  return {
    customerId: '1234567890',
    campaignId: '9876543210',
    resourceName: 'customers/1234567890/campaigns/9876543210',
    advertisingChannelType: 'SEARCH',
    status: 'ENABLED',
    biddingStrategyType: 'MAXIMIZE_CLICKS',
    biddingStrategySystemStatus: 'ELIGIBLE',
    targetSpendCpcBidCeilingMicros: 0,
    maximizeConversionsTargetCpaMicros: 0,
    lastSyncAt: new Date(),
    ...overrides,
  };
}

function metric(overrides: Record<string, any> = {}) {
  return {
    date: dateKey(1),
    customerId: '1234567890',
    campaignId: '9876543210',
    level: 'campaign',
    clicks: 60,
    conversions: 10,
    costVnd: 1_200_000,
    lastSyncAt: new Date(),
    ...overrides,
  };
}

function harness(params: {
  storedPolicy?: any;
  leasedPolicy?: any;
  canonicalCampaign?: any;
  metrics?: any[];
  activePlan?: any;
  createdPlan?: any;
  conversionReady?: boolean;
} = {}) {
  const storedPolicy = params.storedPolicy === undefined
    ? policy()
    : params.storedPolicy;
  const leasedPolicy = params.leasedPolicy === undefined
    ? storedPolicy
    : params.leasedPolicy;
  const lifecycleModel = {
    findOne: jest.fn().mockReturnValue(queryResult(storedPolicy)),
    findOneAndUpdate: jest.fn().mockReturnValue(queryResult(leasedPolicy)),
    updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    find: jest.fn().mockReturnValue(queryResult([])),
  };
  const campaignModel = {
    findOne: jest.fn().mockReturnValue(queryResult(
      params.canonicalCampaign === undefined
        ? campaign()
        : params.canonicalCampaign,
    )),
  };
  const dailyMetricModel = {
    find: jest.fn().mockReturnValue(queryResult(
      params.metrics === undefined ? [metric()] : params.metrics,
    )),
  };
  const actionPlanModel = {
    findOne: jest.fn().mockReturnValue(queryResult(params.activePlan || null)),
  };
  const createdPlan = params.createdPlan || {
    planId: 'GADS-PLAN-AUTO-001',
    status: 'pending_approval',
    items: [{
      actionId: 'GADS-ACT-AUTO-001',
      actionType: 'update_campaign_bidding_strategy',
    }],
  };
  const erpActionPlanService = {
    createPlan: jest.fn().mockResolvedValue({
      success: true,
      plan: createdPlan,
    }),
  };
  const conversionReadinessService = params.conversionReady === undefined
    ? undefined
    : {
      evaluate: jest.fn().mockResolvedValue({
        ready: params.conversionReady,
        blockers: params.conversionReady ? [] : ['PRIMARY_CONVERSION_ACTION_NOT_FOUND'],
      }),
    };
  const service = new GoogleAdsBiddingLifecycleService(
    lifecycleModel as any,
    campaignModel as any,
    dailyMetricModel as any,
    actionPlanModel as any,
    erpActionPlanService as any,
    conversionReadinessService as any,
  );
  return {
    service,
    lifecycleModel,
    campaignModel,
    dailyMetricModel,
    actionPlanModel,
    erpActionPlanService,
    conversionReadinessService,
  };
}

describe('GoogleAdsBiddingLifecycleService', () => {
  it('returns a disabled draft-only default without creating a policy or plan', async () => {
    const context = harness({ storedPolicy: null, leasedPolicy: null });

    const result = await context.service.get('1234567890', '9876543210');

    expect(result.policy).toEqual(expect.objectContaining({
      enabled: false,
      clickThreshold: 50,
      maxCpcBidCeilingVnd: 0,
      targetCpaVnd: 0,
      draftOnly: true,
    }));
    expect(result.state.blockers).toEqual(['POLICY_NOT_CONFIGURED']);
    expect(context.erpActionPlanService.createPlan).not.toHaveBeenCalled();
  });

  it('creates only a pending ERP automation draft when the click threshold is reached', async () => {
    const context = harness();

    const result = await context.service.evaluate(
      '1234567890',
      '9876543210',
      'user-operator-1',
    );

    expect(result.state).toEqual(expect.objectContaining({
      currentStage: 'MAXIMIZE_CLICKS',
      canonicalBiddingStrategyType: 'MAXIMIZE_CLICKS',
      observedClicks: 60,
      blockers: [],
      lastDecision: 'DRAFT_CREATED',
      pendingDraft: expect.objectContaining({
        planId: 'GADS-PLAN-AUTO-001',
        actionId: 'GADS-ACT-AUTO-001',
        fromStage: 'MAXIMIZE_CLICKS',
        toStage: 'MAXIMIZE_CLICKS_CPC_CEILING',
        status: 'pending_approval',
      }),
    }));
    expect(context.erpActionPlanService.createPlan).toHaveBeenCalledTimes(1);
    const [draft, actor, source] =
      context.erpActionPlanService.createPlan.mock.calls[0];
    expect(actor).toBe('user-operator-1');
    expect(source).toBe('erp_automation');
    expect(draft.actions).toEqual([expect.objectContaining({
      actionType: 'update_campaign_bidding_strategy',
      customerId: '1234567890',
      campaignId: '9876543210',
      idempotencyKey: expect.stringMatching(
        /^GADS:BID:1234567890:9876543210:MCC:\d{8}:V3:[A-F0-9]{16}$/,
      ),
      payload: {
        biddingStrategyType: 'MAXIMIZE_CLICKS',
        maxCpcBidCeilingVnd: 20_000,
      },
    })]);
    expect(context.lifecycleModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: '1234567890',
        campaignId: '9876543210',
        leaseToken: expect.any(String),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          lastDecision: 'DRAFT_CREATED',
          pendingPlanId: 'GADS-PLAN-AUTO-001',
        }),
        $unset: expect.objectContaining({
          leaseOwner: 1,
          leaseToken: 1,
          leaseExpiresAt: 1,
        }),
      }),
    );
  });

  it('uses deterministic idempotency for the same policy version and metrics', async () => {
    const context = harness();

    await context.service.evaluate('1234567890', '9876543210');
    await context.service.evaluate('1234567890', '9876543210');

    const first = context.erpActionPlanService.createPlan.mock.calls[0][0]
      .actions[0].idempotencyKey;
    const second = context.erpActionPlanService.createPlan.mock.calls[1][0]
      .actions[0].idempotencyKey;
    expect(second).toBe(first);
  });

  it('blocks the conversion transition until canonical primary action and biddable goal evidence exists', async () => {
    const stored = policy({
      observedStage: 'MAXIMIZE_CLICKS_CPC_CEILING',
    });
    const context = harness({
      storedPolicy: stored,
      leasedPolicy: stored,
      canonicalCampaign: campaign({
        targetSpendCpcBidCeilingMicros: 20_000 * 1_000_000,
      }),
      metrics: [metric({ conversions: 20 })],
    });

    const result = await context.service.evaluate(
      '1234567890',
      '9876543210',
    );

    expect(result.state.currentStage).toBe('MAXIMIZE_CLICKS_CPC_CEILING');
    expect(result.state.blockers).toContain(
      'CANONICAL_CONVERSION_ACTION_AND_GOAL_EVIDENCE_NOT_READY',
    );
    expect(context.erpActionPlanService.createPlan).not.toHaveBeenCalled();
  });

  it('creates a Maximize Conversions draft when threshold, dwell, and canonical goals are ready', async () => {
    const stored = policy({
      observedStage: 'MAXIMIZE_CLICKS_CPC_CEILING',
    });
    const context = harness({
      storedPolicy: stored,
      leasedPolicy: stored,
      conversionReady: true,
      canonicalCampaign: campaign({
        targetSpendCpcBidCeilingMicros: 20_000 * 1_000_000,
      }),
      metrics: [metric({ conversions: 20 })],
    });

    const result = await context.service.evaluate('1234567890', '9876543210');

    expect(result.state.blockers).toEqual([]);
    expect(result.state.pendingDraft).toEqual(expect.objectContaining({
      fromStage: 'MAXIMIZE_CLICKS_CPC_CEILING',
      toStage: 'MAXIMIZE_CONVERSIONS',
    }));
    expect(context.conversionReadinessService?.evaluate).toHaveBeenCalledWith(
      '1234567890',
      '9876543210',
    );
    expect(context.erpActionPlanService.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [expect.objectContaining({
          payload: { biddingStrategyType: 'MAXIMIZE_CONVERSIONS' },
        })],
      }),
      expect.any(String),
      'erp_automation',
    );
  });

  it('fails closed for stale canonical data and unsafe bidding system status', async () => {
    const context = harness({
      canonicalCampaign: campaign({
        biddingStrategySystemStatus: 'LEARNING',
        lastSyncAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }),
      metrics: [metric({
        lastSyncAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      })],
    });

    const result = await context.service.evaluate(
      '1234567890',
      '9876543210',
    );

    expect(result.state.blockers).toEqual(expect.arrayContaining([
      'CANONICAL_CAMPAIGN_STALE',
      'CANONICAL_CAMPAIGN_METRICS_STALE',
      'BIDDING_SYSTEM_STATUS_LEARNING',
    ]));
    expect(context.erpActionPlanService.createPlan).not.toHaveBeenCalled();
  });

  it('does not evaluate when another worker owns the atomic lease', async () => {
    const context = harness({ leasedPolicy: null });

    const result = await context.service.evaluate(
      '1234567890',
      '9876543210',
    );

    expect(result.state.blockers).toEqual(['EVALUATION_LEASE_BUSY']);
    expect(context.campaignModel.findOne).not.toHaveBeenCalled();
    expect(context.erpActionPlanService.createPlan).not.toHaveBeenCalled();
  });
});
