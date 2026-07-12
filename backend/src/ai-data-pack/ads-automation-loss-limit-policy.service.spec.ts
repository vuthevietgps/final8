import { AdsAutomationLossLimitPolicyService } from './ads-automation-loss-limit-policy.service';
import { ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE } from './ads-automation-loss-limit-policy.fixture';
import type {
  AdsAutomationLossLimitPolicyInput,
} from './contracts/ads-automation-loss-limit-policy.contract';

function cloneInput(
  overrides: Partial<AdsAutomationLossLimitPolicyInput> = {},
): AdsAutomationLossLimitPolicyInput {
  return {
    ...JSON.parse(JSON.stringify(ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE)),
    ...overrides,
  };
}

function safeScaleInput(
  overrides: Partial<AdsAutomationLossLimitPolicyInput> = {},
): AdsAutomationLossLimitPolicyInput {
  return cloneInput({
    approval: {
      approvalRequired: true,
      approvalId: 'ADSAPPROVAL-safe-scale-2001',
      approvedByUserId: 'director-1',
      approvedAt: '2026-07-04T04:45:00.000Z',
      status: 'approved',
    },
    globalLimits: {
      dailyLossLimitVnd: 700000,
      currentDailyLossVnd: 250000,
      projectedDailyLossAfterActionVnd: 310000,
      monthToDateLossLimitVnd: 6200000,
      currentMonthToDateLossVnd: 2700000,
      projectedMonthToDateLossAfterActionVnd: 3000000,
      emergencyStopEnabled: false,
      killSwitchEnabled: false,
      killSwitchReason: null,
    },
    action: {
      ...ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE.action,
      requestedDailyBudgetVnd: 1100000,
    },
    spendCaps: ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE.spendCaps.map((row) => ({
      ...row,
      requestedDailyBudgetVnd: 1100000,
      maxDailyBudgetVnd: 1200000,
      maxIncreasePercent: 20,
      currentMonthSpendVnd: 2100000,
      monthlySpendCapVnd: 4500000,
    })),
    economics: ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE.economics.map((row) => ({
      ...row,
      contributionProfitVnd: 720000,
      minContributionProfitVnd: 500000,
      cashConversionDays: 14,
      maxCashConversionDays: 21,
      workingCapitalAvailableVnd: 3600000,
      minWorkingCapitalRequiredVnd: 2500000,
      stockCoverageSafe: true,
      supplierReliabilitySafe: true,
      fulfillmentCapacitySafe: true,
      returnRefundRiskSafe: true,
      dataFreshnessSafe: true,
    })),
    ...overrides,
  });
}

describe('AdsAutomationLossLimitPolicyService', () => {
  const service = new AdsAutomationLossLimitPolicyService();

  it('blocks unsafe scale-up on daily/monthly losses, spend caps, profit, cash, capacity, and approval', () => {
    const provider = {
      validateOnly: jest.fn(),
      executeLive: jest.fn(),
      syncReadOnly: jest.fn(),
    };

    const response = service.build(ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE);

    expect(provider.validateOnly).not.toHaveBeenCalled();
    expect(provider.executeLive).not.toHaveBeenCalled();
    expect(provider.syncReadOnly).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_loss_limit_policy.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
      fixture_or_payload_only: true,
      persistence_used: false,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      approval_required_for_all_actions: true,
      campaignBudgetId_no_fallback: true,
      execution_allowed_now: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      production_ready: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      requested_action_type: 'update_campaign_budget',
      requested_action_mode: 'scale_up',
      policy_allowed_for_requested_action: false,
      all_safe_for_increase: false,
      scale_up_execution_mode: 'monitor_only',
      human_approval_required: true,
      human_approval_present: false,
      daily_loss_limit_safe: false,
      monthly_loss_limit_safe: false,
      spend_caps_safe: false,
      contribution_profit_safe: false,
      cash_conversion_working_capital_safe: false,
      fulfillment_capacity_safe: false,
      execution_allowed_now: false,
    }));
    expect(response.scaleBlockers).toEqual(expect.arrayContaining([
      'human_approval_missing',
      'daily_loss_limit_breached',
      'monthly_loss_limit_breached',
      'campaign.1001.daily_spend_cap_exceeded',
      'campaign.1001.budget_increase_percent_cap_exceeded',
      'ad_group.2001.daily_spend_cap_exceeded',
      'product.P_SCALE.monthly_spend_cap_exceeded',
      'contribution_profit_missing_or_unsafe',
      'cash_conversion_or_working_capital_health_missing',
      'fulfillment_capacity_missing',
    ]));
    expect(response.safeActionsAvailable).toEqual(expect.arrayContaining([
      'pause_campaign',
      'pause_ad_group',
      'reduce_campaign_budget',
      'monitor_only',
    ]));
    expect(response.markdownPreview).toContain('provider_api_called=false');
  });

  it('allows a local scale-up policy only when every guardrail and human approval is present', () => {
    const response = service.build(safeScaleInput());

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'ready_for_local_review',
      requested_action_mode: 'scale_up',
      policy_allowed_for_requested_action: true,
      all_safe_for_increase: true,
      scale_up_execution_mode: 'pending_validation',
      human_approval_present: true,
      daily_loss_limit_safe: true,
      monthly_loss_limit_safe: true,
      spend_caps_safe: true,
      contribution_profit_safe: true,
      cash_conversion_working_capital_safe: true,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.scaleBlockers).toEqual([]);
    expect(response.requestedActionBlockers).toEqual([]);
    expect(response.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'human_approval_present', passed: true }),
      expect.objectContaining({ key: 'daily_loss_limit_safe', passed: true }),
      expect.objectContaining({ key: 'monthly_loss_limit_safe', passed: true }),
      expect.objectContaining({ key: 'spend_caps_safe', passed: true }),
    ]));
  });

  it('requires campaignBudgetId for budget changes and never falls back to campaignId or adGroupId', () => {
    const input = safeScaleInput({
      action: {
        ...safeScaleInput().action,
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        requestedDailyBudgetVnd: 1100000,
      },
      spendCaps: safeScaleInput().spendCaps.map((row) => ({
        ...row,
        campaignBudgetId: null,
      })),
    });

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      campaignBudgetId_missing: true,
      policy_allowed_for_requested_action: false,
      execution_allowed_now: false,
    }));
    expect(response.action).toEqual(expect.objectContaining({
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: null,
    }));
    expect(response.scaleBlockers).toEqual(expect.arrayContaining([
      'campaignBudgetId_missing_no_fallback',
    ]));
    expect(response.action.campaignBudgetId).not.toBe('1001');
    expect(response.action.campaignBudgetId).not.toBe('2001');
    expect(response.safety.campaignBudgetId_no_fallback).toBe(true);
  });

  it('keeps approved pause or reduce safety actions available when loss limits and kill switch are breached', () => {
    const response = service.build(safeScaleInput({
      action: {
        actionType: 'pause_ad_group',
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        productId: 'P_SCALE',
        currentDailyBudgetVnd: 1000000,
        requestedDailyBudgetVnd: 0,
      },
      globalLimits: {
        ...ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE.globalLimits,
        emergencyStopEnabled: true,
        killSwitchEnabled: true,
        killSwitchReason: 'director_emergency_stop_active',
      },
    }));

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'ready_for_local_review',
      requested_action_type: 'pause_ad_group',
      requested_action_mode: 'reduce_or_pause',
      policy_allowed_for_requested_action: true,
      all_safe_for_increase: false,
      scale_up_execution_mode: 'monitor_only',
      emergency_stop_active: true,
      daily_loss_limit_safe: false,
      monthly_loss_limit_safe: false,
      safe_reduction_or_pause_available: true,
      execution_allowed_now: false,
    }));
    expect(response.scaleBlockers).toEqual(expect.arrayContaining([
      'daily_loss_limit_breached',
      'monthly_loss_limit_breached',
      'emergency_stop_or_kill_switch_active',
    ]));
    expect(response.requestedActionBlockers).toEqual([]);
    expect(response.safeActionsAvailable).toEqual(expect.arrayContaining([
      'pause_ad_group',
      'reduce_campaign_budget',
      'monitor_only',
    ]));
  });

  it('keeps human approval as a hard requirement even when policy evidence is otherwise safe', () => {
    const response = service.build(safeScaleInput({
      approval: {
        approvalRequired: true,
        approvalId: 'ADSAPPROVAL-safe-but-pending',
        approvedByUserId: null,
        approvedAt: null,
        status: 'pending',
      },
    }));

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      all_safe_for_increase: false,
      policy_allowed_for_requested_action: false,
      human_approval_present: false,
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
    }));
    expect(response.requestedActionBlockers).toEqual(['human_approval_missing']);
    expect(response.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'human_approval_present',
        passed: false,
        blockers: ['human_approval_missing'],
      }),
    ]));
  });
});
