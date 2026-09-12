import { ConflictException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../auth/decorators/auth.decorator';
import { bangkokDateKey } from '../ads-automation-evidence/ads-automation-evidence-snapshot-store.service';
import { AdsAutomationDraftController } from './ads-automation-draft.controller';
import { AdsAutomationDraftService } from './ads-automation-draft.service';

const HASH = 'a'.repeat(64);

function candidate(overrides: Record<string, any> = {}) {
  return {
    platform: 'google_ads',
    childAccountId: '1234567890',
    campaignId: '200',
    campaignBudgetId: '400',
    adGroupId: '300',
    name: 'Loss-making resource',
    status: 'ENABLED',
    productIds: ['507f1f77bcf86cd799439011'],
    decisionReadiness: 'blocked',
    executionReadiness: 'execution_blocked',
    readinessStatus: 'blocked',
    recommendedActionFamily: 'pause_review',
    mappingHealth: {
      status: 'mapped',
      confidence: 'high',
      productIds: ['507f1f77bcf86cd799439011'],
      missingLinks: [],
      dataFreshness: [],
    },
    commerceEvidence: {
      orders: 4,
      revenue: 1_000_000,
      cancellations: 0,
      returns: 0,
      grossProfit: 100_000,
      netProfitAfterAds: -50_000,
      marginPercent: -5,
      dataFreshness: 'fresh',
    },
    inventoryEvidence: {
      productIds: ['507f1f77bcf86cd799439011'],
      stockRisk: 'ok',
      fulfillmentRisk: 'ok',
      dataFreshness: 'fresh',
    },
    supplierEvidence: {
      supplierIds: [],
      quoteCount: 0,
      openPayableBalance: 0,
      quoteStatus: 'missing',
      payableStatus: 'unknown',
      supplierRisk: 'unknown',
      dataFreshness: 'missing',
    },
    financeGate: {
      status: 'hold',
      currentDailySpend: 0,
      currentMonthlySpend: 0,
      realizedLoss: 50_000,
      blockers: [],
      dataFreshness: 'fresh',
    },
    adsGate: {
      executable: false,
      productionEnabled: false,
      providerExecutionEnabled: false,
      dryRun: true,
      killSwitchActive: false,
      providerValidateOnlyPassed: false,
      approved: false,
      idempotencyReady: false,
      beforeStateSnapshotReady: false,
      auditReady: false,
      blockers: [],
    },
    decisionBlockers: [{
      code: 'COMMERCE_NET_PROFIT_AFTER_ADS_NEGATIVE',
      severity: 'error',
      message: 'Negative',
    }],
    executionBlockers: [],
    blockers: [],
    evidenceRefs: [],
    ...overrides,
  };
}

function snapshot(adGroups: any[], overrides: Record<string, any> = {}) {
  return {
    schemaVersion: 'ads_automation_evidence_snapshot.v1',
    snapshotId: 'ads-evidence-current',
    generatedAt: new Date().toISOString(),
    environment: 'local',
    productionEnabled: false,
    providerExecutionEnabled: false,
    productionEnabledByPlatform: { googleAds: false, metaAds: false },
    providerExecutionEnabledByPlatform: { googleAds: false, metaAds: false },
    dryRun: true,
    killSwitchActive: false,
    summary: {
      totalAdGroups: adGroups.length,
      scaleReady: 0,
      hold: 0,
      monitorOnly: 0,
      blocked: adGroups.length,
      needsMapping: 0,
      executionReady: 0,
      executionBlocked: adGroups.length,
    },
    adGroups,
    globalBlockers: [],
    safety: {
      localOnly: true,
      providerApiCalled: false,
      googleAdsApiCalled: false,
      metaAdsApiCalled: false,
      liveExecutionUsed: false,
      secretsRedacted: true,
      campaignBudgetIdNoFallback: true,
    },
    ...overrides,
  };
}

function harness(adGroups: any[]) {
  const payload = snapshot(adGroups);
  const snapshotStore = {
    latest: jest.fn(async () => ({
      dateKey: bangkokDateKey(new Date()),
      capturedAt: new Date(),
      hash: HASH,
      payload,
    })),
    hashPayload: jest.fn(() => HASH),
  };
  const googlePlanService = {
    createPlan: jest.fn(async () => ({
      plan: {
        planId: 'GADS-PLAN-1',
        status: 'pending_approval',
        items: [{ actionId: 'GADS-ACT-1', status: 'pending' }],
      },
    })),
  };
  const metaPlanService = {
    createPlan: jest.fn(async () => ({
      planId: 'META-PLAN-1',
      status: 'pending_validation',
      actions: [{
        actionId: 'META-ACT-1',
        workflowStatus: 'pending_validation',
      }],
    })),
  };
  return {
    snapshotStore,
    googlePlanService,
    metaPlanService,
    service: new AdsAutomationDraftService(
      snapshotStore as any,
      googlePlanService as any,
      metaPlanService as any,
    ),
  };
}

describe('AdsAutomationDraftService', () => {
  const previousEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...previousEnv,
      ADS_AUTOMATION_DRAFTS_ENABLED: 'false',
    };
  });

  afterEach(() => {
    process.env = previousEnv;
  });

  it('previews only exact, fresh, active and negative-profit pause candidates', async () => {
    const context = harness([
      candidate(),
      candidate({ adGroupId: '301', status: 'PAUSED' }),
      candidate({
        adGroupId: '302',
        mappingHealth: {
          ...candidate().mappingHealth,
          confidence: 'low',
        },
      }),
      candidate({
        adGroupId: '303',
        commerceEvidence: {
          ...candidate().commerceEvidence,
          dataFreshness: 'stale',
        },
      }),
    ]);

    const result = await context.service.previewPauseReviewDrafts('google_ads');

    expect(result.eligible).toBe(1);
    expect(result.candidates[0].resourceId).toBe('300');
    expect(result.skippedByReason).toEqual({
      RESOURCE_NOT_ACTIVE: 1,
      ERP_MAPPING_NOT_EXACT: 1,
      COMMERCE_EVIDENCE_NOT_FRESH: 1,
    });
    expect(context.googlePlanService.createPlan).not.toHaveBeenCalled();
    expect(context.metaPlanService.createPlan).not.toHaveBeenCalled();
  });

  it('materializes a Google pause draft with stable identity and immutable evidence provenance', async () => {
    const context = harness([candidate()]);

    const result = await context.service.materializePauseReviewDrafts(
      'google_ads',
      'planner-1',
    );

    expect(result.created).toBe(1);
    expect(result.drafts[0]).toEqual(expect.objectContaining({
      planId: 'GADS-PLAN-1',
      actionId: 'GADS-ACT-1',
      status: 'pending',
    }));
    expect(context.googlePlanService.createPlan).toHaveBeenCalledWith(
      {
        planName: expect.stringContaining('Google'),
        actions: [expect.objectContaining({
          actionType: 'pause_ad_group',
          customerId: '1234567890',
          campaignId: '200',
          adGroupId: '300',
          idempotencyKey: 'ads:auto:v1:pause:google:1234567890:300',
          payload: {},
        })],
      },
      'planner-1',
      'erp_automation',
      {
        snapshotId: 'ads-evidence-current',
        snapshotHash: HASH,
        capturedAt: expect.any(String),
      },
    );
    expect(context.metaPlanService.createPlan).not.toHaveBeenCalled();
  });

  it('materializes Meta pause_ad_set and reports idempotency conflict as deduplicated', async () => {
    const metaCandidate = candidate({
      platform: 'meta_ads',
      childAccountId: '99887766',
      campaignId: '220',
      campaignBudgetId: undefined,
      adGroupId: '330',
      status: 'ACTIVE',
    });
    const context = harness([metaCandidate]);

    const first = await context.service.materializePauseReviewDrafts(
      'meta_ads',
      'planner-1',
    );
    expect(first.created).toBe(1);
    expect(context.metaPlanService.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [expect.objectContaining({
          actionType: 'pause_ad_set',
          adAccountId: '99887766',
          campaignId: '220',
          adSetId: '330',
          idempotencyKey: 'ads:auto:v1:pause:meta:99887766:330',
          payload: {},
        })],
      }),
      'planner-1',
      'erp_automation',
      expect.objectContaining({
        snapshotId: 'ads-evidence-current',
        snapshotHash: HASH,
      }),
    );

    context.metaPlanService.createPlan.mockRejectedValueOnce(
      new ConflictException('duplicate'),
    );
    const second = await context.service.materializePauseReviewDrafts(
      'meta_ads',
      'planner-1',
    );
    expect(second.created).toBe(0);
    expect(second.deduplicated).toBe(1);
  });

  it('fails closed for a kill switch or a tampered snapshot', async () => {
    const context = harness([candidate()]);
    context.snapshotStore.latest.mockResolvedValueOnce({
      dateKey: bangkokDateKey(new Date()),
      capturedAt: new Date(),
      hash: HASH,
      payload: snapshot([candidate()], { killSwitchActive: true }),
    });
    await expect(context.service.materializePauseReviewDrafts(
      'google_ads',
      'planner-1',
    )).rejects.toThrow('kill switch');

    context.snapshotStore.hashPayload.mockReturnValueOnce('b'.repeat(64));
    await expect(context.service.previewPauseReviewDrafts(
      'google_ads',
    )).rejects.toThrow('hash mismatch');
    expect(context.googlePlanService.createPlan).not.toHaveBeenCalled();
  });

  it('keeps the scheduled compiler disabled by default', async () => {
    const context = harness([candidate()]);

    await context.service.materializeScheduledDrafts();

    expect(context.snapshotStore.latest).not.toHaveBeenCalled();
    expect(context.googlePlanService.createPlan).not.toHaveBeenCalled();
    expect(context.metaPlanService.createPlan).not.toHaveBeenCalled();
  });
});

describe('AdsAutomationDraftController permissions', () => {
  it('separates Google and Meta read/plan permissions', () => {
    expect(Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdsAutomationDraftController.prototype.previewGoogle,
    )).toEqual(['google-ads.read']);
    expect(Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdsAutomationDraftController.prototype.materializeGoogle,
    )).toEqual(['google-ads.plan']);
    expect(Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdsAutomationDraftController.prototype.previewMeta,
    )).toEqual(['meta-ads.read']);
    expect(Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdsAutomationDraftController.prototype.materializeMeta,
    )).toEqual(['meta-ads.plan']);
  });
});
