import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdsAutomationLossLimitPolicyActionInput,
  AdsAutomationLossLimitPolicyActionMode,
  AdsAutomationLossLimitPolicyApprovalInput,
  AdsAutomationLossLimitPolicyCheck,
  AdsAutomationLossLimitPolicyCheckKey,
  AdsAutomationLossLimitPolicyEconomicsDecision,
  AdsAutomationLossLimitPolicyEconomicsInput,
  AdsAutomationLossLimitPolicyGlobalLimitsInput,
  AdsAutomationLossLimitPolicyInput,
  AdsAutomationLossLimitPolicyResponse,
  AdsAutomationLossLimitPolicySpendCapDecision,
  AdsAutomationLossLimitPolicySpendCapInput,
} from './contracts/ads-automation-loss-limit-policy.contract';

@Injectable()
export class AdsAutomationLossLimitPolicyService {
  build(input: AdsAutomationLossLimitPolicyInput): AdsAutomationLossLimitPolicyResponse {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('loss-limit policy payload is required');
    }

    const reportDate = this.isoDate(input.reportDate, 'reportDate');
    const generatedAt = (input.now ? this.dateTime(input.now, 'now') : new Date()).toISOString();
    const action = this.action(input.action);
    const actionMode = this.actionMode(action);
    const approval = this.approval(input.approval);
    const globalLimits = this.globalLimits(input.globalLimits);
    const spendCapDecisions = this.spendCapDecisions(input.spendCaps, actionMode);
    const economicsDecisions = this.economicsDecisions(input.economics);
    const humanApprovalPresent = approval.approvalRequired === true
      && approval.status === 'approved'
      && Boolean(approval.approvedByUserId)
      && Boolean(approval.approvedAt);
    const dailyLossSafe = globalLimits.projectedDailyLossAfterActionVnd <= globalLimits.dailyLossLimitVnd
      && globalLimits.currentDailyLossVnd <= globalLimits.dailyLossLimitVnd;
    const monthlyLossSafe = globalLimits.projectedMonthToDateLossAfterActionVnd <= globalLimits.monthToDateLossLimitVnd
      && globalLimits.currentMonthToDateLossVnd <= globalLimits.monthToDateLossLimitVnd;
    const emergencyStopActive = globalLimits.emergencyStopEnabled === true
      || globalLimits.killSwitchEnabled === true;
    const campaignBudgetIdMissing = action.actionType === 'update_campaign_budget'
      && !action.campaignBudgetId;
    const grossMarginSafe = economicsDecisions.every((item) => (
      item.grossMarginPercent >= item.minGrossMarginPercent
    ));
    const contributionProfitSafe = economicsDecisions.every((item) => (
      item.contributionProfitVnd >= item.minContributionProfitVnd
    ));
    const cashConversionWorkingCapitalSafe = economicsDecisions.every((item) => (
      item.cashConversionDays <= item.maxCashConversionDays
      && item.workingCapitalAvailableVnd >= item.minWorkingCapitalRequiredVnd
    ));
    const stockCoverageSafe = this.booleanEvidence(input.economics, 'stockCoverageSafe');
    const supplierReliabilitySafe = this.booleanEvidence(input.economics, 'supplierReliabilitySafe');
    const fulfillmentCapacitySafe = this.booleanEvidence(input.economics, 'fulfillmentCapacitySafe');
    const returnRefundRiskSafe = this.booleanEvidence(input.economics, 'returnRefundRiskSafe');
    const dataFreshnessSafe = this.booleanEvidence(input.economics, 'dataFreshnessSafe');
    const spendCapsSafe = spendCapDecisions.every((item) => item.status === 'safe');

    const checks: AdsAutomationLossLimitPolicyCheck[] = [
      this.check(
        'human_approval_present',
        humanApprovalPresent,
        ['human_approval_missing'],
        'Explicit human approval is required for every future ads action.',
      ),
      this.check(
        'campaignBudgetId_present',
        !campaignBudgetIdMissing,
        ['campaignBudgetId_missing_no_fallback'],
        'Budget updates require campaignBudgetId from ERP evidence; campaignId and adGroupId are not fallbacks.',
      ),
      this.check(
        'emergency_stop_clear',
        !emergencyStopActive,
        ['emergency_stop_or_kill_switch_active'],
        globalLimits.killSwitchReason || 'Emergency stop and kill-switch state must be clear before scale-up.',
      ),
      this.check(
        'daily_loss_limit_safe',
        dailyLossSafe,
        ['daily_loss_limit_breached'],
        `projected_daily_loss=${globalLimits.projectedDailyLossAfterActionVnd}; limit=${globalLimits.dailyLossLimitVnd}`,
      ),
      this.check(
        'monthly_loss_limit_safe',
        monthlyLossSafe,
        ['monthly_loss_limit_breached'],
        `projected_month_to_date_loss=${globalLimits.projectedMonthToDateLossAfterActionVnd}; limit=${globalLimits.monthToDateLossLimitVnd}`,
      ),
      this.check(
        'spend_caps_safe',
        spendCapsSafe,
        spendCapDecisions.flatMap((item) => item.blockers),
        `spend_cap_rows=${spendCapDecisions.length}`,
      ),
      this.check(
        'gross_margin_safe',
        grossMarginSafe,
        ['gross_margin_missing_or_unsafe'],
        'Every scoped product/ad group must meet minimum gross margin.',
      ),
      this.check(
        'contribution_profit_positive',
        contributionProfitSafe,
        ['contribution_profit_missing_or_unsafe'],
        'Contribution profit after ads must be positive and above the configured floor.',
      ),
      this.check(
        'cash_conversion_working_capital_safe',
        cashConversionWorkingCapitalSafe,
        ['cash_conversion_or_working_capital_health_missing'],
        'Cash conversion days and working-capital buffer must be safe before increasing spend.',
      ),
      this.check(
        'stock_coverage_safe',
        stockCoverageSafe,
        ['stock_coverage_missing_or_unsafe'],
        'Stock coverage must be explicitly safe before increasing spend.',
      ),
      this.check(
        'supplier_reliability_safe',
        supplierReliabilitySafe,
        ['supplier_reliability_missing_or_unsafe'],
        'Supplier reliability must be explicitly safe before increasing spend.',
      ),
      this.check(
        'fulfillment_capacity_safe',
        fulfillmentCapacitySafe,
        ['fulfillment_capacity_missing'],
        'Fulfillment capacity must be explicitly safe before increasing spend.',
      ),
      this.check(
        'return_refund_risk_safe',
        returnRefundRiskSafe,
        ['return_refund_risk_missing_or_unsafe'],
        'Return, refund, and cancellation risk must be explicitly safe before increasing spend.',
      ),
      this.check(
        'data_freshness_safe',
        dataFreshnessSafe,
        ['data_freshness_or_coverage_not_safe'],
        'All policy evidence must be fresh and covered before increasing spend.',
      ),
    ];

    const scaleBlockers = this.unique(checks.flatMap((check) => check.blockers));
    const requestedActionBlockers = this.requestedActionBlockers({
      action,
      actionMode,
      approval,
      humanApprovalPresent,
      scaleBlockers,
    });
    const allSafeForIncrease = scaleBlockers.length === 0;
    const policyAllowedForRequestedAction = requestedActionBlockers.length === 0;
    const safeReductionOrPauseAvailable = this.safeReductionOrPauseAvailable(action, actionMode, scaleBlockers);

    return {
      schemaVersion: 'ads_automation_loss_limit_policy.v1',
      generatedAt,
      reportDate,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        fixture_or_payload_only: true,
        persistence_used: false,
        durable_storage_used: false,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        approval_required_for_all_actions: true,
        campaignBudgetId_no_fallback: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      },
      summary: {
        status: policyAllowedForRequestedAction ? 'ready_for_local_review' : 'blocked',
        fixture_mode: input.fixtureMode || 'custom_local_payload',
        requested_action_type: action.actionType,
        requested_action_mode: actionMode,
        policy_allowed_for_requested_action: policyAllowedForRequestedAction,
        all_safe_for_increase: allSafeForIncrease,
        scale_up_execution_mode: allSafeForIncrease ? 'pending_validation' : 'monitor_only',
        human_approval_required: true,
        human_approval_present: humanApprovalPresent,
        emergency_stop_active: emergencyStopActive,
        daily_loss_limit_safe: dailyLossSafe,
        monthly_loss_limit_safe: monthlyLossSafe,
        spend_caps_safe: spendCapsSafe,
        gross_margin_safe: grossMarginSafe,
        contribution_profit_safe: contributionProfitSafe,
        cash_conversion_working_capital_safe: cashConversionWorkingCapitalSafe,
        stock_coverage_safe: stockCoverageSafe,
        supplier_reliability_safe: supplierReliabilitySafe,
        fulfillment_capacity_safe: fulfillmentCapacitySafe,
        return_refund_risk_safe: returnRefundRiskSafe,
        data_freshness_safe: dataFreshnessSafe,
        campaignBudgetId_missing: campaignBudgetIdMissing,
        safe_reduction_or_pause_available: safeReductionOrPauseAvailable,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: policyAllowedForRequestedAction
          ? 'review_local_loss_limit_policy_evidence'
          : 'resolve_loss_limit_policy_blockers',
      },
      action,
      approval,
      checks,
      spendCapDecisions,
      economicsDecisions,
      scaleBlockers,
      requestedActionBlockers,
      safeActionsAvailable: safeReductionOrPauseAvailable
        ? ['pause_campaign', 'pause_ad_group', 'reduce_campaign_budget', 'monitor_only']
        : ['monitor_only'],
      markdownPreview: this.markdownPreview({
        reportDate,
        actionMode,
        allSafeForIncrease,
        policyAllowedForRequestedAction,
        scaleBlockers,
        requestedActionBlockers,
      }),
    };
  }

  private requestedActionBlockers(input: {
    action: Required<AdsAutomationLossLimitPolicyActionInput>;
    actionMode: AdsAutomationLossLimitPolicyActionMode;
    approval: Required<AdsAutomationLossLimitPolicyApprovalInput>;
    humanApprovalPresent: boolean;
    scaleBlockers: string[];
  }): string[] {
    const blockers: string[] = [];
    if (!input.humanApprovalPresent) blockers.push('human_approval_missing');

    if (input.action.actionType === 'pause_campaign' && !input.action.campaignId) {
      blockers.push('campaignId_missing');
    }
    if (input.action.actionType === 'pause_ad_group' && !input.action.adGroupId) {
      blockers.push('adGroupId_missing');
    }
    if (input.action.actionType === 'update_campaign_budget') {
      if (!input.action.campaignBudgetId) blockers.push('campaignBudgetId_missing_no_fallback');
      if (input.action.requestedDailyBudgetVnd == null) blockers.push('requestedDailyBudgetVnd_missing');
      if (input.action.currentDailyBudgetVnd == null) blockers.push('currentDailyBudgetVnd_missing');
    }

    if (input.actionMode === 'scale_up') {
      blockers.push(...input.scaleBlockers);
    }

    return this.unique(blockers);
  }

  private safeReductionOrPauseAvailable(
    action: Required<AdsAutomationLossLimitPolicyActionInput>,
    actionMode: AdsAutomationLossLimitPolicyActionMode,
    scaleBlockers: string[],
  ): boolean {
    if (actionMode === 'reduce_or_pause') return true;
    return scaleBlockers.length > 0 && Boolean(action.campaignId || action.adGroupId);
  }

  private spendCapDecisions(
    rows: AdsAutomationLossLimitPolicySpendCapInput[],
    actionMode: AdsAutomationLossLimitPolicyActionMode,
  ): AdsAutomationLossLimitPolicySpendCapDecision[] {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('spendCaps must be a non-empty array');
    }

    return rows.map((row) => {
      if (!row || typeof row !== 'object') {
        throw new BadRequestException('spendCaps entries must be objects');
      }
      if (!['campaign', 'ad_group', 'product'].includes(row.scopeType)) {
        throw new BadRequestException('spendCaps.scopeType is unsupported');
      }
      const scopeId = this.requiredText(row.scopeId, 'spendCaps.scopeId');
      const currentDailyBudgetVnd = this.nonNegativeNumber(row.currentDailyBudgetVnd, 'spendCaps.currentDailyBudgetVnd');
      const requestedDailyBudgetVnd = this.nonNegativeNumber(row.requestedDailyBudgetVnd, 'spendCaps.requestedDailyBudgetVnd');
      const maxDailyBudgetVnd = this.nonNegativeNumber(row.maxDailyBudgetVnd, 'spendCaps.maxDailyBudgetVnd');
      const maxIncreasePercent = this.nonNegativeNumber(row.maxIncreasePercent, 'spendCaps.maxIncreasePercent');
      const currentMonthSpendVnd = row.currentMonthSpendVnd == null
        ? null
        : this.nonNegativeNumber(row.currentMonthSpendVnd, 'spendCaps.currentMonthSpendVnd');
      const monthlySpendCapVnd = row.monthlySpendCapVnd == null
        ? null
        : this.nonNegativeNumber(row.monthlySpendCapVnd, 'spendCaps.monthlySpendCapVnd');
      const increasePercent = currentDailyBudgetVnd === 0
        ? (requestedDailyBudgetVnd > 0 ? 100 : 0)
        : ((requestedDailyBudgetVnd - currentDailyBudgetVnd) / currentDailyBudgetVnd) * 100;
      const blockers: string[] = [];

      if (actionMode === 'scale_up') {
        if (requestedDailyBudgetVnd > maxDailyBudgetVnd) {
          blockers.push(`${row.scopeType}.${scopeId}.daily_spend_cap_exceeded`);
        }
        if (increasePercent > maxIncreasePercent) {
          blockers.push(`${row.scopeType}.${scopeId}.budget_increase_percent_cap_exceeded`);
        }
        if (
          currentMonthSpendVnd !== null
          && monthlySpendCapVnd !== null
          && currentMonthSpendVnd + Math.max(0, requestedDailyBudgetVnd - currentDailyBudgetVnd) > monthlySpendCapVnd
        ) {
          blockers.push(`${row.scopeType}.${scopeId}.monthly_spend_cap_exceeded`);
        }
      }

      return {
        scopeType: row.scopeType,
        scopeId,
        campaignBudgetId: this.text(row.campaignBudgetId),
        currentDailyBudgetVnd,
        requestedDailyBudgetVnd,
        maxDailyBudgetVnd,
        maxIncreasePercent,
        increasePercent: Math.round(increasePercent * 100) / 100,
        currentMonthSpendVnd,
        monthlySpendCapVnd,
        status: blockers.length ? 'blocked' : 'safe',
        blockers,
      };
    });
  }

  private economicsDecisions(
    rows: AdsAutomationLossLimitPolicyEconomicsInput[],
  ): AdsAutomationLossLimitPolicyEconomicsDecision[] {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('economics must be a non-empty array');
    }

    return rows.map((row) => {
      if (!row || typeof row !== 'object') {
        throw new BadRequestException('economics entries must be objects');
      }
      const grossMarginPercent = this.nonNegativeNumber(row.grossMarginPercent, 'economics.grossMarginPercent');
      const minGrossMarginPercent = this.nonNegativeNumber(row.minGrossMarginPercent, 'economics.minGrossMarginPercent');
      const contributionProfitVnd = this.number(row.contributionProfitVnd, 'economics.contributionProfitVnd');
      const minContributionProfitVnd = this.number(row.minContributionProfitVnd, 'economics.minContributionProfitVnd');
      const cashConversionDays = this.nonNegativeNumber(row.cashConversionDays, 'economics.cashConversionDays');
      const maxCashConversionDays = this.nonNegativeNumber(row.maxCashConversionDays, 'economics.maxCashConversionDays');
      const workingCapitalAvailableVnd = this.number(row.workingCapitalAvailableVnd, 'economics.workingCapitalAvailableVnd');
      const minWorkingCapitalRequiredVnd = this.number(row.minWorkingCapitalRequiredVnd, 'economics.minWorkingCapitalRequiredVnd');
      const blockers: string[] = [];

      if (grossMarginPercent < minGrossMarginPercent) blockers.push('gross_margin_missing_or_unsafe');
      if (contributionProfitVnd < minContributionProfitVnd) {
        blockers.push('contribution_profit_missing_or_unsafe');
      }
      if (cashConversionDays > maxCashConversionDays) {
        blockers.push('cash_conversion_days_too_high');
      }
      if (workingCapitalAvailableVnd < minWorkingCapitalRequiredVnd) {
        blockers.push('working_capital_buffer_too_low');
      }

      return {
        productId: this.text(row.productId),
        adGroupId: this.text(row.adGroupId),
        grossMarginPercent,
        minGrossMarginPercent,
        contributionProfitVnd,
        minContributionProfitVnd,
        cashConversionDays,
        maxCashConversionDays,
        workingCapitalAvailableVnd,
        minWorkingCapitalRequiredVnd,
        status: blockers.length ? 'blocked' : 'safe',
        blockers: this.unique(blockers),
      };
    });
  }

  private action(
    value: AdsAutomationLossLimitPolicyActionInput,
  ): Required<AdsAutomationLossLimitPolicyActionInput> {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('action is required');
    }
    if (!['update_campaign_budget', 'pause_campaign', 'pause_ad_group', 'monitor_only'].includes(value.actionType)) {
      throw new BadRequestException('action.actionType is unsupported');
    }
    const currentDailyBudgetVnd = value.currentDailyBudgetVnd == null
      ? null
      : this.nonNegativeNumber(value.currentDailyBudgetVnd, 'action.currentDailyBudgetVnd');
    const requestedDailyBudgetVnd = value.requestedDailyBudgetVnd == null
      ? null
      : this.nonNegativeNumber(value.requestedDailyBudgetVnd, 'action.requestedDailyBudgetVnd');

    return {
      actionType: value.actionType,
      customerId: this.text(value.customerId),
      campaignId: this.text(value.campaignId),
      adGroupId: this.text(value.adGroupId),
      campaignBudgetId: this.text(value.campaignBudgetId),
      campaignBudgetResourceName: this.text(value.campaignBudgetResourceName),
      productId: this.text(value.productId),
      currentDailyBudgetVnd,
      requestedDailyBudgetVnd,
    };
  }

  private approval(
    value?: AdsAutomationLossLimitPolicyApprovalInput,
  ): Required<AdsAutomationLossLimitPolicyApprovalInput> {
    const approval = value || {};
    const status = approval.status || null;
    if (status && !['approved', 'pending', 'rejected'].includes(status)) {
      throw new BadRequestException('approval.status is unsupported');
    }
    return {
      approvalRequired: true,
      approvalId: this.text(approval.approvalId),
      approvedByUserId: this.text(approval.approvedByUserId),
      approvedAt: approval.approvedAt
        ? this.dateTime(approval.approvedAt, 'approval.approvedAt').toISOString()
        : null,
      status,
    };
  }

  private globalLimits(
    value: AdsAutomationLossLimitPolicyGlobalLimitsInput,
  ): AdsAutomationLossLimitPolicyGlobalLimitsInput {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('globalLimits is required');
    }
    return {
      dailyLossLimitVnd: this.nonNegativeNumber(value.dailyLossLimitVnd, 'globalLimits.dailyLossLimitVnd'),
      currentDailyLossVnd: this.nonNegativeNumber(value.currentDailyLossVnd, 'globalLimits.currentDailyLossVnd'),
      projectedDailyLossAfterActionVnd: this.nonNegativeNumber(value.projectedDailyLossAfterActionVnd, 'globalLimits.projectedDailyLossAfterActionVnd'),
      monthToDateLossLimitVnd: this.nonNegativeNumber(value.monthToDateLossLimitVnd, 'globalLimits.monthToDateLossLimitVnd'),
      currentMonthToDateLossVnd: this.nonNegativeNumber(value.currentMonthToDateLossVnd, 'globalLimits.currentMonthToDateLossVnd'),
      projectedMonthToDateLossAfterActionVnd: this.nonNegativeNumber(value.projectedMonthToDateLossAfterActionVnd, 'globalLimits.projectedMonthToDateLossAfterActionVnd'),
      emergencyStopEnabled: value.emergencyStopEnabled === true,
      killSwitchEnabled: value.killSwitchEnabled === true,
      killSwitchReason: this.text(value.killSwitchReason),
    };
  }

  private actionMode(
    action: Required<AdsAutomationLossLimitPolicyActionInput>,
  ): AdsAutomationLossLimitPolicyActionMode {
    if (action.actionType === 'monitor_only') return 'monitor_only';
    if (action.actionType === 'pause_campaign' || action.actionType === 'pause_ad_group') {
      return 'reduce_or_pause';
    }
    if (action.currentDailyBudgetVnd != null && action.requestedDailyBudgetVnd != null) {
      return action.requestedDailyBudgetVnd > action.currentDailyBudgetVnd
        ? 'scale_up'
        : 'reduce_or_pause';
    }
    return 'scale_up';
  }

  private check(
    key: AdsAutomationLossLimitPolicyCheckKey,
    passed: boolean,
    blockers: string[],
    evidence: string,
  ): AdsAutomationLossLimitPolicyCheck {
    return {
      key,
      passed,
      blockers: passed ? [] : this.unique(blockers),
      evidence,
    };
  }

  private booleanEvidence(
    rows: AdsAutomationLossLimitPolicyEconomicsInput[],
    key: keyof Pick<
      AdsAutomationLossLimitPolicyEconomicsInput,
      | 'stockCoverageSafe'
      | 'supplierReliabilitySafe'
      | 'fulfillmentCapacitySafe'
      | 'returnRefundRiskSafe'
      | 'dataFreshnessSafe'
    >,
  ): boolean {
    return rows.every((row) => row[key] === true);
  }

  private markdownPreview(input: {
    reportDate: string;
    actionMode: AdsAutomationLossLimitPolicyActionMode;
    allSafeForIncrease: boolean;
    policyAllowedForRequestedAction: boolean;
    scaleBlockers: string[];
    requestedActionBlockers: string[];
  }): string {
    return [
      '# Ads Automation Loss-limit Policy',
      `Report date: ${input.reportDate}`,
      `Requested action mode: ${input.actionMode}`,
      `All safe for increase: ${input.allSafeForIncrease}`,
      `Policy allowed for requested action: ${input.policyAllowedForRequestedAction}`,
      `Scale blockers: ${this.joinOrNone(input.scaleBlockers)}`,
      `Requested action blockers: ${this.joinOrNone(input.requestedActionBlockers)}`,
      'Safety gates: provider_api_called=false, google_ads_api_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false',
    ].join('\n');
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return text;
  }

  private dateTime(value: unknown, field: string): Date {
    const parsed = new Date(value as string | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return parsed;
  }

  private nonNegativeNumber(value: unknown, field: string): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
    return numberValue;
  }

  private number(value: unknown, field: string): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new BadRequestException(`${field} must be a finite number`);
    }
    return numberValue;
  }

  private requiredText(value: unknown, field: string): string {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private text(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values.map((value) => String(value || '').trim()).filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
  }
}
