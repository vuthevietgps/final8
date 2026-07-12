import { AdsAutomationDecisionDraftPreviewService } from './ads-automation-decision-draft-preview.service';
import { ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE } from './ads-automation-decision-foundation-snapshot.fixture';
import { AdsAutomationDecisionFoundationSnapshotService } from './ads-automation-decision-foundation-snapshot.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE } from './ads-automation-loss-limit-policy.fixture';
import { AdsAutomationLossLimitPolicyService } from './ads-automation-loss-limit-policy.service';
import { ADS_AUTOMATION_PROVIDER_ACCOUNT_READINESS_FIXTURE } from './ads-automation-provider-account-readiness.fixture';
import { AdsAutomationProviderAccountReadinessService } from './ads-automation-provider-account-readiness.service';
import { AdsAutomationSmallCapReadinessSimulatorService } from './ads-automation-small-cap-readiness-simulator.service';
import type {
  AdsAutomationSmallCapReadinessSimulatorInput,
} from './contracts/ads-automation-small-cap-readiness-simulator.contract';

describe('AdsAutomationSmallCapReadinessSimulatorService', () => {
  const decisionService = new AdsAutomationDecisionService();
  const foundationService = new AdsAutomationDecisionFoundationSnapshotService(decisionService);
  const draftPreviewService = new AdsAutomationDecisionDraftPreviewService();
  const lossLimitPolicyService = new AdsAutomationLossLimitPolicyService();
  const providerReadinessService = new AdsAutomationProviderAccountReadinessService();
  const simulator = new AdsAutomationSmallCapReadinessSimulatorService();

  it('builds a local-only monitor_only small-cap simulation when loss limits are unsafe', () => {
    const response = simulator.build(baseInput());

    expect(response.schemaVersion).toBe('ads_automation_small_cap_readiness_simulator.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      campaignBudgetId_no_fallback: true,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked_monitor_only',
      update_budget_drafts: 1,
      eligible_small_cap_candidates: 1,
      requested_increase_vnd: 200000,
      simulated_capped_increase_vnd: 100000,
      approved_increase_vnd: 0,
      scale_up_execution_mode: 'monitor_only',
      small_cap_live_test_allowed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.budgetCandidates[0]).toEqual(expect.objectContaining({
      campaignBudgetId: 'BUDGET_SCALE',
      campaignBudgetIdNoFallback: true,
      simulatedCappedIncreaseVnd: 100000,
      approvedIncreaseVnd: 0,
    }));
    expect(response.cashflowAndLossLimitBlockers).toEqual(expect.arrayContaining([
      'daily_loss_limit_breached',
      'monthly_loss_limit_breached',
      'human_approval_missing',
      'loss_limit_policy.all_safe_for_increase_false',
    ]));
  });

  it('can become ready for a human approval dry-run while still blocking live execution', () => {
    const response = simulator.build(baseInput({
      decisionInput: safeScaleDecisionInput(),
      lossLimitPolicyInput: safeLossLimitPolicyInput(),
      maxSmallCapIncreaseVnd: 75000,
      maxSmallCapIncreasePercent: 20,
    }));

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'ready_for_human_approval_dry_run',
      scale_up_execution_mode: 'pending_validation',
      requested_increase_vnd: 200000,
      simulated_capped_increase_vnd: 75000,
      approved_increase_vnd: 0,
      small_cap_live_test_allowed: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.cashflowAndLossLimitBlockers).toEqual([]);
    expect(response.providerReadinessBlockers).toEqual([]);
    expect(response.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'approval_gate', status: 'pending' }),
      expect.objectContaining({ stage: 'validate_only_gate', status: 'pending' }),
      expect.objectContaining({ stage: 'execution_preflight', status: 'blocked' }),
    ]));
  });

  it('blocks budget candidates that do not carry campaignBudgetId and never falls back to campaign or ad group IDs', () => {
    const input = baseInput();
    input.draftPreview = {
      ...input.draftPreview,
      drafts: input.draftPreview.drafts.map((draft) => (
        draft.action_type === 'update_campaign_budget'
          ? {
            ...draft,
            typedPayload: {
              ...draft.typedPayload,
              campaignBudgetId: null,
              campaignId: 'CAMP_SHOULD_NOT_BE_BUDGET',
              adGroupId: 'AG_SHOULD_NOT_BE_BUDGET',
            },
          }
          : draft
      )),
    };

    const response = simulator.build(input);

    expect(response.budgetCandidates[0]).toEqual(expect.objectContaining({
      campaignBudgetId: null,
      campaignId: 'CAMP_SHOULD_NOT_BE_BUDGET',
      adGroupId: 'AG_SHOULD_NOT_BE_BUDGET',
      campaignBudgetIdNoFallback: true,
      status: 'blocked_missing_campaignBudgetId',
      blockers: expect.arrayContaining(['campaignBudgetId_missing_no_fallback']),
    }));
    expect(response.budgetCandidates[0].campaignBudgetId).not.toBe('CAMP_SHOULD_NOT_BE_BUDGET');
    expect(response.budgetCandidates[0].campaignBudgetId).not.toBe('AG_SHOULD_NOT_BE_BUDGET');
    expect(response.readinessBlockers).toEqual(expect.arrayContaining([
      'campaignBudgetId_missing_no_fallback',
    ]));
  });

  function baseInput(overrides: {
    decisionInput?: any;
    lossLimitPolicyInput?: any;
    maxSmallCapIncreaseVnd?: number;
    maxSmallCapIncreasePercent?: number;
  } = {}): AdsAutomationSmallCapReadinessSimulatorInput {
    const decisionSnapshot = decisionService.build(
      overrides.decisionInput || ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE,
    );
    const foundationSnapshot = foundationService.fromDecisionSnapshot(decisionSnapshot);
    const draftPreview = draftPreviewService.build(decisionSnapshot);
    const lossLimitPolicy = lossLimitPolicyService.build(
      overrides.lossLimitPolicyInput || ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE,
    );
    const providerAccountReadiness = providerReadinessService.build(
      ADS_AUTOMATION_PROVIDER_ACCOUNT_READINESS_FIXTURE,
    );

    return {
      reportDate: '2026-07-04',
      now: '2026-07-04T06:00:00.000Z',
      fixtureMode: 'htx_ads_small_cap_readiness_demo',
      maxSmallCapIncreaseVnd: overrides.maxSmallCapIncreaseVnd ?? 100000,
      maxSmallCapIncreasePercent: overrides.maxSmallCapIncreasePercent ?? 10,
      foundationSnapshot,
      draftPreview,
      lossLimitPolicy,
      providerAccountReadiness,
    };
  }
});

function safeScaleDecisionInput() {
  const fixture = clone(ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE);
  fixture.adGroups = [fixture.adGroups[0]];
  fixture.products = [fixture.products[0]];
  fixture.suppliers = [fixture.suppliers[0]];
  return fixture;
}

function safeLossLimitPolicyInput() {
  const fixture = clone(ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE);
  fixture.approval = {
    approvalRequired: true,
    approvalId: 'ADSAPPROVAL-safe-small-cap-demo',
    approvedByUserId: 'director-1',
    approvedAt: '2026-07-04T05:55:00.000Z',
    status: 'approved',
  };
  fixture.action = {
    ...fixture.action,
    requestedDailyBudgetVnd: 1100000,
  };
  fixture.globalLimits = {
    ...fixture.globalLimits,
    currentDailyLossVnd: 100000,
    projectedDailyLossAfterActionVnd: 150000,
    currentMonthToDateLossVnd: 1000000,
    projectedMonthToDateLossAfterActionVnd: 1100000,
  };
  fixture.spendCaps = fixture.spendCaps.map((cap) => ({
    ...cap,
    requestedDailyBudgetVnd: 1100000,
    maxDailyBudgetVnd: 1200000,
    currentMonthSpendVnd: 1000000,
    monthlySpendCapVnd: 5000000,
  }));
  fixture.economics = fixture.economics.map((row) => ({
    ...row,
    contributionProfitVnd: 650000,
    cashConversionDays: 14,
    workingCapitalAvailableVnd: 3000000,
    fulfillmentCapacitySafe: true,
  }));
  return fixture;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
