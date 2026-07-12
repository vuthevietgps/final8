import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { FinanceService } from '../../finance/finance.service';
import { FinancialControlService } from '../../finance/financial-control.service';
import { mapLoanStatus } from '../aliases/erp-field-alias.registry';
import { SectionQuality } from '../contracts/metadata.contract';
import { findRows } from './query.util';

export const SAFE_DIRECTOR_SETTING_KEYS = [
  'minimum_cash_reserve',
  'target_survival_months',
  'max_daily_ads_budget',
  'max_budget_increase_percent',
  'max_test_budget',
  'max_test_loss',
  'monthly_revenue_target',
  'monthly_profit_target',
  'quarterly_revenue_target',
  'quarterly_profit_target',
  'priority_service_groups',
  'protected_campaigns',
  'protected_service_groups',
  'test_allowed_campaigns',
  'test_allowed_service_groups',
  'director_note_today',
];

@Injectable()
export class FinanceDataQuery {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly financialControl: FinancialControlService,
    private readonly financeService: FinanceService,
  ) {}

  async get(reportDate: string) {
    const warnings: string[] = [];
    let full: any = null;
    let debt30: any = null;
    let debt90: any = null;
    try {
      [full, debt30, debt90] = await Promise.all([
        this.financialControl.getFullMetrics(false),
        this.financeService.getDebtCashflowSummary(30),
        this.financeService.getDebtCashflowSummary(90),
      ]);
    } catch (error: any) {
      warnings.push(`Canonical finance source unavailable: ${error?.message || 'unknown error'}`);
    }

    const [loans, settings] = await Promise.all([
      findRows(this.connection, 'loancontracts', {}, {
        name: 1, principal: 1, principalRemaining: 1, interestRate: 1, repaymentCycle: 1,
        startDate: 1, endDate: 1, restricted: 1, status: 1, notes: 1,
        disbursementStatus: 1, disbursedAmount: 1, disbursedDate: 1, updatedAt: 1,
      }),
      findRows(this.connection, 'system_settings', { key: { $in: SAFE_DIRECTOR_SETTING_KEYS } }, { key: 1, value: 1, description: 1, updatedBy: 1, updatedAt: 1 }),
    ]);

    const expectedLoanInflow = loans
      .filter((loan) => mapLoanStatus(loan) === 'approved_not_disbursed')
      .reduce((total, loan) => total + Math.max(0, Number(loan.principal || 0) - Number(loan.disbursedAmount || 0)), 0);

    const financing = loans.map((loan) => ({
      financing_id: String(loan._id),
      type: 'loan',
      name: loan.name,
      status: mapLoanStatus(loan),
      amount: Number(loan.principal || 0),
      interest_rate_year: Number(loan.interestRate || 0),
      term_months: this.termMonths(loan.startDate, loan.endDate),
      disbursement_date: loan.disbursedDate || null,
      disbursed_amount: Number(loan.disbursedAmount || 0),
      debt_service_next_30d: debt30?.byLoan?.find((item: any) => String(item.loanId) === String(loan._id))?.due14d ?? null,
      debt_service_next_90d: debt90?.byLoan?.find((item: any) => String(item.loanId) === String(loan._id))?.due14d ?? null,
      allowed_for_ads: loan.restricted ? false : null,
      confidence: loan.disbursementStatus ? 'medium' : 'low',
      risk_note: loan.notes || null,
    }));

    const debtWarnings = [...(debt30?.alerts || []), ...(debt90?.alerts || [])];
    const debtScheduleStatus = !debt30 || !debt90 ? 'partial' : debtWarnings.length ? 'weak' : 'ok';
    const loanDisbursementStatus = !loans.length
      ? 'partial'
      : loans.every((loan) => mapLoanStatus(loan) !== 'unknown') ? 'ok' : 'partial';
    const qualityDimensions = {
      cash_balance_quality: {
        status: full?.bankBalance === null || full?.bankBalance === undefined ? 'missing' : 'ok',
        source: 'FinancialControlService.bankBalance',
        can_use_for_decision: full?.bankBalance === null || full?.bankBalance === undefined ? 'no' : 'yes',
        value_state: full?.bankBalance === null || full?.bankBalance === undefined ? 'missing' : Number(full.bankBalance) === 0 ? 'zero_value' : 'realized',
      },
      debt_schedule_quality: {
        status: debtScheduleStatus,
        source: 'FinanceService.getDebtCashflowSummary(30/90)',
        can_use_for_decision: debtScheduleStatus === 'ok' ? 'yes' : 'cautious',
        warning: debtWarnings,
        value_state: !debt30 || !debt90 ? 'missing' : 'available',
      },
      loan_disbursement_quality: {
        status: loanDisbursementStatus,
        source: 'loancontracts.disbursementStatus/disbursedAmount',
        can_use_for_decision: loanDisbursementStatus === 'ok' ? 'yes' : 'cautious',
        value_state: loans.length ? 'available' : 'not_applicable',
      },
      cashflow_forecast_quality: {
        status: full?.forecast7D ? 'partial' : 'missing',
        source: 'FinancialControlService.forecast7D',
        can_use_for_decision: full?.forecast7D ? 'cautious' : 'no',
        value_state: full?.forecast7D ? 'estimated' : 'missing',
      },
      overall_financial_context_quality: {
        status: !full ? 'missing' : debtScheduleStatus === 'ok' && full.dataQuality?.status === 'ok' ? 'ok' : 'partial',
        can_use_for_decision: !full ? 'no' : debtScheduleStatus === 'ok' && !full.dataQuality?.isDecisionLocked ? 'yes' : 'cautious',
        value_state: !full ? 'missing' : 'available',
      },
    };
    const quality: SectionQuality = {
      source: 'FinancialControlService + actual cashflow/disbursement + debt schedule',
      source_table_or_service: 'FinancialControlService, loancontracts, loanrepayments',
      freshness_at: full?.calculatedAt ? new Date(full.calculatedAt).toISOString() : null,
      period: 'current',
      calculation_method: 'cash_available=bankBalance; pending loan disbursement excluded and reported as expected inflow',
      data_quality_status: qualityDimensions.overall_financial_context_quality.status as SectionQuality['data_quality_status'],
      confidence: !full || debtScheduleStatus !== 'ok' || full.dataQuality?.isDecisionLocked ? 'low' : 'medium',
      missing_fields: [
        ...(!full ? ['bank_balance', 'committed_cash', 'free_cash'] : []),
        ...(!debt30 || (debt30?.alerts || []).length ? ['complete_debt_schedule_30d'] : []),
        ...(!debt90 || (debt90?.alerts || []).length ? ['complete_debt_schedule_90d'] : []),
      ],
      warning: [
        ...warnings,
        ...(full?.dataQuality?.notes || []),
        ...debtWarnings,
        'FinanceService.computeAvailableFunds/getCollectedRevenueToday/getLoanRoomAvailable are intentionally excluded.',
      ],
      can_use_for_decision: qualityDimensions.overall_financial_context_quality.can_use_for_decision as SectionQuality['can_use_for_decision'],
      data_state: !full ? 'missing' : 'available',
      empty_reason: !full ? 'missing' : null,
    };

    return {
      financial_context: {
        cash_available: full?.bankBalance ?? null,
        bank_balance: full?.bankBalance ?? null,
        free_cash: full?.freeCash ?? null,
        committed_cash: full?.committedCash ?? null,
        survival_buffer: full?.survivalFloor ?? null,
        ads_fund_remaining: full?.adsBudgetApproved ?? null,
        expected_cash_inflow_from_approved_loans: expectedLoanInflow,
        debt_service_next_30d: debt30?.totalDebtDue14d ?? null,
        debt_service_next_90d: debt90?.totalDebtDue14d ?? null,
        forecast_7d: this.normalizeForecast(full?.forecast7D, reportDate),
        quality_dimensions: qualityDimensions,
        quality,
      },
      financing_context: financing,
      director_manual_inputs: settings,
      cashflow_scenarios: [{
        scenario: 'canonical_current',
        cash_available: full?.bankBalance ?? null,
        expected_cash_inflow: expectedLoanInflow,
        committed_cash: full?.committedCash ?? null,
        survival_buffer: full?.survivalFloor ?? null,
        debt_service_next_30d: debt30?.totalDebtDue14d ?? null,
        debt_service_next_90d: debt90?.totalDebtDue14d ?? null,
        quality_flag: debt90?.alerts?.length ? 'partial_obligations' : 'estimated',
      }],
      alerts: [...(full?.alerts || []), ...(debt30?.alerts || []), ...(debt90?.alerts || [])],
      quality,
      quality_dimensions: qualityDimensions,
    };
  }

  private normalizeForecast(forecast: any, reportDate: string): any {
    if (!forecast) return null;
    const result = { ...forecast };
    if (Array.isArray(forecast.days)) {
      result.days = forecast.days.map((day: any, index: number) => ({
        ...day,
        date: this.addDays(reportDate, Number(day.day || index + 1)),
      }));
    }
    if (forecast.lowPointDay) result.lowPointDate = this.addDays(reportDate, Number(forecast.lowPointDay));
    return result;
  }

  private addDays(reportDate: string, days: number): string {
    const date = new Date(`${reportDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private termMonths(start?: Date, end?: Date): number | null {
    if (!start || !end) return null;
    return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 2_629_800_000));
  }
}
