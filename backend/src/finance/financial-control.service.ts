/**
 * FINANCIAL CONTROL SERVICE - CFO Spec v3.1
 * ===========================================
 * Mục tiêu: Quản lý sự sống còn, tốc độ scale, số tiền owner có thể rút, và dự báo 7 ngày.
 * Nguyên tắc:
 * - Chỉ có Cash In/Cash Out làm thay đổi Bank Balance
 * - FC chỉ đọc số đã chuẩn hóa từ các module, không query trực tiếp
 * - Internal transfer giữa quỹ/ví = đổi nhãn tiền, KHÔNG tính Cash In/Out
 *
 * ⚠️ WARNING ON TERMINOLOGY ⚠️
 * Collection `supplier-payable` (DB: supplier_payables) là Account Receivable (AR)
 * — Tiền Nhà Cung Cấp Nợ và PHẢI TRẢ cho công ty (thu hộ COD trừ COGS).
 * Trong công thức dòng tiền đây là INFLOW, không phải OUTFLOW.
 * Tên cũ giữ nguyên để tránh rủi ro data migration.
 */

import { BadRequestException, ConflictException, Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { LaborStatement, LaborStatementDocument } from '../labor-cost1/schemas/labor-statement.schema';
import { OtherCost, OtherCostDocument } from '../other-cost/schemas/other-cost.schema';
import { FundingSource, FundingSourceDocument } from './schemas/funding-source.schema';
import { LoanContract, LoanContractDocument } from './schemas/loan-contract.schema';
import { SystemSettings, SystemSettingsDocument } from './schemas/system-settings.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { AdGroupDailyReportService } from './ad-group-daily-report.service';
import { FinanceService } from './finance.service';
import { CashflowSnapshotService } from './cashflow-snapshot.service';
import {
  FinancialControlConfig,
  FinancialControlDashboard,
  FinancialControlFull,
  CommittedCashBreakdown,
  MonthlyBurnBreakdown,
  AdGroupOptimalSpend,
  OptimalAdsSuggestionResult,
  ForecastDay,
  Forecast7DResult,
  ExpectedInflowBreakdown,
  ExpectedOutflowBreakdown,
  FinancialControlDataQuality,
  DEFAULT_CONFIG,
} from './interfaces/financial-control.interface';
import { FinanceEvents } from './events/finance-events.constants';
import {
  TAX_OBLIGATION_SOURCES,
  UpsertTaxObligationSnapshotDto,
} from './dto/upsert-tax-obligation-snapshot.dto';

const BUSINESS_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface TaxObligationSnapshot {
  totalTaxDue: number;
  dueByDay7d: Array<{ date: string; amount: number }>;
  asOf: string;
  source: typeof TAX_OBLIGATION_SOURCES[number];
  evidence: string;
  updatedBy: string;
}

type FullMetricsCacheEntry = {
  policyVersion: string;
  payload: FinancialControlFull;
};

type SnapshotQualityState = {
  staleModules: string[];
  invalidModules: string[];
  notes: string[];
};

@Injectable()
export class FinancialControlService implements OnModuleInit {
  private readonly logger = new Logger(FinancialControlService.name);
  private config: FinancialControlConfig = { ...DEFAULT_CONFIG };
  private static readonly SETTINGS_KEY = 'financial_control';
  // Cache keys usados con CacheManager
  private static readonly CACHE_KEY_FULL = 'fc:full_metrics';
  private static readonly CACHE_KEY_OUTFLOW = 'fc:outflow_maps';
  private static readonly CACHE_KEY_INFLOW = 'fc:inflow_map';
  private static readonly CACHE_TTL_FULL = 30_000;    // 30 segundos
  private static readonly CACHE_TTL_FLOWS = 300_000;  // 5 minutos
  private static readonly SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  private static readonly SUPPORTED_COMMITTED_WINDOWS = [7, 14, 30] as const;

  // CFO Sign-off Condition #2: Cycle guard to prevent recursive calls
  private isCalculating = false;
  private calculationStartTime: Date | null = null;
  private pendingCalculation: Promise<FinancialControlFull> | null = null;
  private calculationVersion = 0;
  private pendingCalculationVersion: number | null = null;
  private lastGoodFullMetrics: FinancialControlFull | null = null;
  private policyVersion = this.getPolicyVersion(this.config);
  private policyUpdatedAt: Date | null = null;
  // NOTE: cachedResult / cacheExpiry removed — handled by shared CacheManager (Redis-backed)

  constructor(
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(LaborStatement.name)
    private readonly laborModel: Model<LaborStatementDocument>,
    @InjectModel(OtherCost.name)
    private readonly otherCostModel: Model<OtherCostDocument>,
    @InjectModel(FundingSource.name)
    private readonly fundingSourceModel: Model<FundingSourceDocument>,
    @InjectModel(LoanContract.name)
    private readonly loanModel: Model<LoanContractDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdvertisingCost.name)
    private readonly adsCostModel: Model<AdvertisingCostDocument>,
    @Inject(forwardRef(() => AdGroupDailyReportService))
    private readonly adGroupDailyReportService: AdGroupDailyReportService,
    // CFO Spec v3.1: Inject FinanceService for Debt summary (same module — no circular dep)
    @Inject(forwardRef(() => FinanceService))
    private readonly financeService: FinanceService,
    // Phase 3: Snapshot service reads pre-computed domain summaries (no cross-module circular dep)
    private readonly snapshotService: CashflowSnapshotService,
    @InjectModel(SystemSettings.name)
    private readonly settingsModel: Model<SystemSettingsDocument>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // MAIN API: Get Dashboard 8 Numbers
  // ═══════════════════════════════════════════════════════════

  async getDashboard(forceRefresh = false): Promise<FinancialControlDashboard> {
    const full = await this.getFullMetrics(forceRefresh);
    return {
      bankBalance: full.bankBalance,
      committedCash: full.committedCash,
      freeCash: full.freeCash,
      monthlyBurn: full.monthlyBurn,
      runwayMonths: full.runwayMonths,
      adsBudgetApproved: full.adsBudgetApproved,
      ownerWithdrawable: full.ownerWithdrawable,
      forecast7DLowPoint: full.forecast7DLowPoint,
      totalDebtOutstanding: full.totalDebtOutstanding,
      calculatedAt: full.calculatedAt,
      config: full.config,
      dataQuality: full.dataQuality,
    };
  }

  async getForecastForDashboard(): Promise<Forecast7DResult> {
    const full = await this.getFullMetrics();
    return full.forecast7D;
  }

  // ═══════════════════════════════════════════════════════════
  // FULL METRICS
  // ═══════════════════════════════════════════════════════════

  async getFullMetrics(forceRefresh = false): Promise<FinancialControlFull> {
    // Read the small canonical policy document before consulting the shared metrics cache.
    // The stable policy fingerprint is identical on every pod, unlike a local counter.
    await this.synchronizeConfigFromDatabase();

    // 1. Check shared CacheManager (Redis khi multi-pod, in-memory khi single-pod)
    // forceRefresh=true: bỏ qua cache để trả về số mới nhất (Issue 1 — Eventual Consistency)
    if (!forceRefresh) {
      const cached = await this.readCachedFullMetrics();
      if (cached) {
        this.logger.debug('[CACHE_HIT] Returning cached getFullMetrics result');
        this.lastGoodFullMetrics = cached;
        return cached;
      }
    } else {
      this.logger.debug('[FORCE_REFRESH] Skipping cache read, recalculating immediately');
    }

    // 2. Nếu đang tính (cycle guard) thì chờ kết quả đang chạy
    // forceRefresh vẫn phải chờ nếu có pending calculation (chống Cache Stampede)
    const pendingCalculation = this.pendingCalculation;
    const pendingCalculationVersion = this.pendingCalculationVersion;
    if (
      this.isCalculating &&
      pendingCalculation &&
      pendingCalculationVersion === this.calculationVersion
    ) {
      this.logger.debug('[WAITING] Waiting for pending getFullMetrics calculation');
      const result = await pendingCalculation;
      if (pendingCalculationVersion === this.calculationVersion) {
        return result;
      }
      this.logger.debug(
        `[CACHE_RETRY] Pending getFullMetrics result became stale (pendingVersion=${pendingCalculationVersion}, currentVersion=${this.calculationVersion})`,
      );
    }

    const calculationVersion = this.calculationVersion;
    this.isCalculating = true;
    this.calculationStartTime = new Date();
    const calculationPromise = this.doGetFullMetrics();
    this.pendingCalculation = calculationPromise;
    this.pendingCalculationVersion = calculationVersion;

    try {
      const result = await calculationPromise;
      // Lưu vào shared cache
      if (
        this.pendingCalculationVersion === calculationVersion &&
        this.calculationVersion === calculationVersion
      ) {
        await this.cacheManager.set(
          FinancialControlService.CACHE_KEY_FULL,
          { policyVersion: this.policyVersion, payload: result } as FullMetricsCacheEntry,
          FinancialControlService.CACHE_TTL_FULL,
        );
      } else {
        this.logger.debug(
          `[CACHE_SKIP] Dropping stale getFullMetrics result (calcVersion=${calculationVersion}, currentVersion=${this.calculationVersion})`,
        );
      }
      this.lastGoodFullMetrics = result;
      return result;
    } finally {
      if (this.pendingCalculation === calculationPromise) {
        this.isCalculating = false;
        this.pendingCalculation = null;
        this.pendingCalculationVersion = null;
      }
    }
  }

  private async readCachedFullMetrics(allowStale = false): Promise<FinancialControlFull | null> {
    const cached = await this.cacheManager.get<FullMetricsCacheEntry | FinancialControlFull>(
      FinancialControlService.CACHE_KEY_FULL,
    );
    if (!cached) {
      return null;
    }

    if (
      typeof cached === 'object' &&
      'policyVersion' in cached &&
      'payload' in cached &&
      typeof cached.policyVersion === 'string' &&
      cached.payload
    ) {
      if (cached.policyVersion === this.policyVersion) {
        return cached.payload;
      }

      if (allowStale) {
        this.logger.debug(
          `[CACHE_STALE_ALLOWED] Using stale full metrics as estimation base (cachePolicy=${cached.policyVersion}, currentPolicy=${this.policyVersion})`,
        );
        return cached.payload;
      }

      this.logger.debug(
        `[CACHE_STALE] Ignoring stale full metrics cache entry (cachePolicy=${cached.policyVersion}, currentPolicy=${this.policyVersion})`,
      );
      return null;
    }

    this.logger.debug('[CACHE_STALE] Ignoring legacy unversioned full metrics cache entry');
    return null;
  }

  private async getLastKnownFullMetrics(): Promise<FinancialControlFull | null> {
    return this.lastGoodFullMetrics || this.readCachedFullMetrics(true);
  }

  private async doGetFullMetrics(): Promise<FinancialControlFull> {
    try {
      // Parallel fetch: Bank Balance, Committed Cash, Monthly Burn, Optimal Ads, Loan Summary
      const [bankBalance, committedBreakdown, monthlyBurnBreakdown, optimalSpendState, loanSummaryState, snapshotQuality] =
        await Promise.all([
          this.getBankBalance(),
          this.getCommittedCash(),
          this.getMonthlyBurn(),
          this.getOptimalAdsSuggestion().then(
            (result) => ({ result, error: null as Error | null }),
          ).catch((err) => {
            this.logger.warn('Failed to get optimal spend from AdGroupDailyReportService, using fallback');
            return { result: null, error: err instanceof Error ? err : new Error(String(err)) };
          }),
          this.financeService.getLoanSummary().then(
            (result) => ({ result, error: null as Error | null }),
          ).catch((err) => {
            this.logger.warn('Failed to get loan summary, skipping');
            return { result: null, error: err instanceof Error ? err : new Error(String(err)) };
          }),
          this.getSnapshotQualityState(),
        ]);
      const optimalSpendResult = optimalSpendState.result;
      const loanSummaryResult = loanSummaryState.result;

      const committedCash = committedBreakdown.total;
      const freeCash = bankBalance - committedCash;
      const monthlyBurn = monthlyBurnBreakdown.total;

      // 5. Survival
      const survivalFloor = this.config.SurvivalMonths * monthlyBurn;
      const availableAfterSurvival = Math.max(0, freeCash - survivalFloor);

      // 6. Runway - CFO Sign-off Condition #4: Sanity rules
      let runwayMonths: number | null;
      if (monthlyBurn === 0) {
        runwayMonths = null;
      } else if (freeCash < 0) {
        runwayMonths = 0;
      } else {
        runwayMonths = freeCash / monthlyBurn;
      }
      const runwayStatus = this.getRunwayStatus(runwayMonths);

      // 7. Optimal Ads Suggestion
      const optimalAdsSuggestion = optimalSpendResult
        ? optimalSpendResult.totalOptimalWeekly
        : 0;

      const dataQuality = this.buildDataQuality(committedBreakdown, monthlyBurnBreakdown, {
        optimalAdsUnavailable: !optimalSpendResult,
        loanSummaryUnavailable: !loanSummaryResult,
        optimalAdsError: optimalSpendState.error?.message,
        loanSummaryError: loanSummaryState.error?.message,
        staleModules: snapshotQuality.staleModules,
        invalidModules: snapshotQuality.invalidModules,
        snapshotNotes: snapshotQuality.notes,
      });

      // 8. Ads Budget Approved
      // Missing critical data locks risky decisions instead of showing optimistic numbers.
      const adsBudgetApproved = dataQuality.isDecisionLocked
        ? 0
        : Math.min(optimalAdsSuggestion, availableAfterSurvival);

      // 9. Max Daily Ads
      // AdsBudgetApproved is a 7-day envelope, so normalize by 7 days for daily limit.
      const maxDailyAds = (adsBudgetApproved / 7) * this.config.SafetyFactor;

      // 10. Owner Withdrawable
      const ownerWithdrawable = dataQuality.isDecisionLocked
        ? 0
        : Math.max(0, availableAfterSurvival - adsBudgetApproved);

      // 11. Forecast 7D (FIXED: Sử dụng chi phí Ads trung bình mỗi ngày đã được approve để dự báo)
      const forecast7D = await this.getForecast7D(bankBalance, maxDailyAds, monthlyBurnBreakdown);
      if (dataQuality.isDecisionLocked && !forecast7D.isCashCrunch) {
        forecast7D.isSurvivalRisk = true;
      }

      // 12. Build aggregated alerts with source (CFO v3.1)
      const alerts = this.buildAggregatedAlerts(
        forecast7D,
        runwayStatus,
        monthlyBurnBreakdown,
        freeCash,
        monthlyBurn,
        dataQuality,
      );

      const loanSummary = loanSummaryResult;

      return {
        // Dashboard 8 số + totalDebtOutstanding
        bankBalance,
        committedCash,
        freeCash,
        monthlyBurn,
        runwayMonths,
        adsBudgetApproved,
        ownerWithdrawable,
        forecast7DLowPoint: {
          amount: forecast7D.lowPoint,
          day: forecast7D.lowPointDay,
        },
        totalDebtOutstanding: loanSummary?.totalPrincipalRemaining || 0,
        calculatedAt: new Date(),
        config: this.config,
        dataQuality,

        // Chi tiết
        survivalFloor,
        availableAfterSurvival,
        optimalAdsSuggestion,
        maxDailyAds,
        forecast7D,
        isCashCrunch: forecast7D.isCashCrunch,
        isSurvivalRisk: forecast7D.isSurvivalRisk,
        runwayStatus,
        alerts,
        committedBreakdown,
        monthlyBurnBreakdown,
        loanSummary: loanSummary ? {
          totalPrincipal: loanSummary.totalPrincipal,
          totalDisbursed: loanSummary.totalDisbursed,
          totalPendingDisbursement: loanSummary.totalPendingDisbursement,
          totalDebtOutstanding: loanSummary.totalPrincipalRemaining,
          totalPrincipalPaid: loanSummary.totalPrincipalPaid,
          totalInterestPaid: loanSummary.totalInterestPaid,
          upcomingRepayments: loanSummary.upcomingRepayments,
        } : undefined,
      };
    } catch (err) {
      this.logger.error('doGetFullMetrics failed', err);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // BANK BALANCE
  // ═══════════════════════════════════════════════════════════

  private async getBankBalance(): Promise<number> {
    return this.calculateBankBalanceFromTransactions();

    // Get từ funding sources (bank accounts)
    const bankAccounts = await this.fundingSourceModel.find({
      type: 'bank_account',
      isActive: true,
    });

    let balance = bankAccounts.reduce((sum, acc) => sum + (acc.availableBalance || 0), 0);

    // Nếu không có bank account, tính từ vốn + doanh thu - chi phí
    if (balance === 0) {
      balance = await this.calculateBankBalanceFromTransactions();
    }

    return balance;
  }

  /**
   * Lấy tổng Owner Fund Reserved (tiền owner đã chuyển vào quỹ riêng)
   * Đây là tiền KHÔNG THỂ sử dụng cho công ty
   */
  private async getOwnerFundBalance(): Promise<number> {
    try {
      // Query từ owner_fund_accounts collection
      const ownerFundAccount = await this.financeService.getOwnerFundAccountBalance();
      return ownerFundAccount || 0;
    } catch (error) {
      this.logger.warn('Failed to get Owner Fund balance, assuming 0');
      return 0;
    }
  }

  private async calculateBankBalanceFromTransactions(): Promise<number> {
    // Delegate to the single authoritative implementation in FinanceService.
    // This ensures CFO Dashboard and Funds Dashboard always report the same Bank Balance.
    return this.financeService.calculateMasterBankBalance();
  }

  // ═══════════════════════════════════════════════════════════
  // COMMITTED CASH (14D Window) - Gọi từ summary APIs
  // ═══════════════════════════════════════════════════════════

  private async getCommittedCash(): Promise<CommittedCashBreakdown> {
    const windowDays = this.config.CommittedWindowDays;

    // CFO Sign-off Condition #1 & #3: Parallel calls với timeout
    const SUMMARY_TIMEOUT = 3000; // 3 seconds per summary call
    const timeoutErrors: string[] = [];

    type LaborCommittedSummary = { totalPayrollDue14d: number; dueByDay7d: Array<{ date: string; amount: number }>; __missing?: boolean };
    type OpsCommittedSummary = { totalOpsDue14d: number; byCategory: Array<{ category: string; due14d: number }>; dueByDay7d: Array<{ date: string; amount: number }>; __missing?: boolean };
    type AgentCommittedSummary = { totalAgentDue14d: number; byAgent: Array<{ nextDueDate: string; unpaid: number }>; dueByDay7d: Array<{ date: string; amount: number }>; __missing?: boolean };
    type TaxCommittedSummary = TaxObligationSnapshot & { __missing?: boolean };

    const cachedFullMetrics = await this.getLastKnownFullMetrics();
    const estimateCommittedFromCachedBurn = (field: keyof MonthlyBurnBreakdown): number => {
      const value = Number(cachedFullMetrics?.monthlyBurnBreakdown?.[field] || 0);
      return Math.max(0, Math.round((value * windowDays) / 30));
    };

    const summaryPromises = {
      labor: this.withTimeout(
        this.snapshotService.read<LaborCommittedSummary>('labor', windowDays)
          .then(s => s ? this.validateLaborSnapshot(s) : { totalPayrollDue14d: 0, dueByDay7d: [], __missing: true }),
        SUMMARY_TIMEOUT,
        'labor',
      ),
      ops: this.withTimeout(
        this.snapshotService.read<OpsCommittedSummary>('ops', windowDays)
          .then(s => s ? this.validateOpsSnapshot(s) : { totalOpsDue14d: 0, byCategory: [], dueByDay7d: [], __missing: true }),
        SUMMARY_TIMEOUT,
        'ops',
      ),
      agent: this.withTimeout(
        this.snapshotService.read<AgentCommittedSummary>('agent', windowDays)
          .then(s => s ? this.validateAgentSnapshot(s) : { totalAgentDue14d: 0, byAgent: [], dueByDay7d: [], __missing: true }),
        SUMMARY_TIMEOUT,
        'agent',
      ),
      debt: this.withTimeout(
        this.financeService.getDebtCashflowSummary(windowDays).then((summary) => ({
          ...summary,
          totalDebtDue14d: this.requireNonNegativeFinite(summary.totalDebtDue14d, 'debt.totalDebtDue14d'),
        })),
        SUMMARY_TIMEOUT,
        'debt',
      ),
      tax: this.withTimeout(
        this.snapshotService.read<TaxCommittedSummary>('tax', -1)
          .then(s => s ? this.validateTaxSnapshot(s) : {
            totalTaxDue: 0,
            dueByDay7d: [],
            asOf: '',
            source: 'manual_reconciliation' as const,
            evidence: '',
            updatedBy: '',
            __missing: true,
          }),
        SUMMARY_TIMEOUT,
        'tax',
      ),
    };

    const results = await Promise.allSettled([
      summaryPromises.labor,
      summaryPromises.ops,
      summaryPromises.agent,
      summaryPromises.debt,
      summaryPromises.tax,
    ]);

    // Extract values with fallback
    let labor = 0;
    let operations = 0;
    let agents = 0;
    let loanPayment = 0;
    let tax = 0;
    const estimationNotes: string[] = [];

    // Labor
    if (results[0].status === 'fulfilled') {
      labor = results[0].value.totalPayrollDue14d;
      if (results[0].value.__missing) {
        labor = estimateCommittedFromCachedBurn('laborCore');
        estimationNotes.push(labor > 0
          ? 'labor: thieu snapshot 14 ngay, dung uoc tinh tu lan tinh truoc'
          : 'labor: thieu snapshot 14 ngay va chua co so uoc tinh truoc');
      }
    } else {
      this.logger.warn(`Failed to get labor summary: ${results[0].reason}`);
      if (results[0].reason?.message === 'TIMEOUT') {
        timeoutErrors.push('labor: TIMEOUT');
      }
      // FIX: Trả về mức lương dự kiến trung bình (1/2 monthlyBurn) thay vì 0 để tránh bơm phồng Free Cash
      labor = estimateCommittedFromCachedBurn('laborCore');
      estimationNotes.push(labor > 0
        ? 'labor: loi doc du lieu, dung uoc tinh tu lan tinh truoc'
        : 'labor: loi doc du lieu va chua co so uoc tinh truoc');
    }

    // Ops
    if (results[1].status === 'fulfilled') {
      operations = results[1].value.totalOpsDue14d;
      if (results[1].value.__missing) {
        operations = estimateCommittedFromCachedBurn('operationsMandatory');
        estimationNotes.push(operations > 0
          ? 'ops: thieu snapshot 14 ngay, dung uoc tinh tu lan tinh truoc'
          : 'ops: thieu snapshot 14 ngay va chua co so uoc tinh truoc');
      }
    } else {
      this.logger.warn(`Failed to get ops summary: ${results[1].reason}`);
      if (results[1].reason?.message === 'TIMEOUT') {
        timeoutErrors.push('ops: TIMEOUT');
      }
      // FIX: Trả về ops trung bình thay vì 0
      operations = estimateCommittedFromCachedBurn('operationsMandatory');
      estimationNotes.push(operations > 0
        ? 'ops: loi doc du lieu, dung uoc tinh tu lan tinh truoc'
        : 'ops: loi doc du lieu va chua co so uoc tinh truoc');
    }

    // Agent
    if (results[2].status === 'fulfilled') {
      agents = results[2].value.totalAgentDue14d;
      if (results[2].value.__missing) {
        agents = estimateCommittedFromCachedBurn('agentCommission');
        estimationNotes.push(agents > 0
          ? 'agent: thieu snapshot 14 ngay, dung uoc tinh tu lan tinh truoc'
          : 'agent: thieu snapshot 14 ngay va chua co so uoc tinh truoc');
      }
    } else {
      this.logger.warn(`Failed to get agent summary: ${results[2].reason}`);
      if (results[2].reason?.message === 'TIMEOUT') {
        timeoutErrors.push('agent: TIMEOUT');
      }
      // Thà dự báo bảo thủ còn hơn overspend
      agents = estimateCommittedFromCachedBurn('agentCommission');
      estimationNotes.push(agents > 0
        ? 'agent: loi doc du lieu, dung uoc tinh tu lan tinh truoc'
        : 'agent: loi doc du lieu va chua co so uoc tinh truoc');
    }

    // Debt
    if (results[3].status === 'fulfilled') {
      loanPayment = results[3].value.totalDebtDue14d;
    } else {
      this.logger.warn(`Failed to get debt summary: ${results[3].reason}`);
      if (results[3].reason?.message === 'TIMEOUT') {
        timeoutErrors.push('debt: TIMEOUT');
      }
      loanPayment = estimateCommittedFromCachedBurn('loanPayment');
      estimationNotes.push(loanPayment > 0
        ? 'debt: loi doc lich tra no, dung uoc tinh tu lan tinh truoc'
        : 'debt: loi doc lich tra no va chua co so uoc tinh truoc');
    }

    // 4. Thuế (TODO: tạm = 0, cần module thuế)
    if (results[4].status === 'fulfilled') {
      tax = results[4].value.totalTaxDue;
      if (results[4].value.__missing) {
        estimationNotes.push('tax: thieu snapshot nghia vu thue canonical');
      }
    } else {
      this.logger.warn(`Failed to get tax obligation snapshot: ${results[4].reason}`);
      if (results[4].reason?.message === 'TIMEOUT') timeoutErrors.push('tax: TIMEOUT');
      estimationNotes.push('tax: snapshot nghia vu thue khong hop le hoac khong doc duoc');
    }

    for (const timeoutError of timeoutErrors) {
      estimationNotes.push(timeoutError);
    }

    const total = labor + operations + agents + tax + loanPayment;

    return {
      labor,
      operations,
      agents,
      tax,
      loanPayment,
      total,
      windowDays,
      isEstimated: estimationNotes.length > 0,
      estimationNotes: estimationNotes.length > 0 ? estimationNotes : undefined,
    };
  }

  /**
   * CFO Sign-off Condition #3: Timeout wrapper for fail-soft
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, source: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          this.logger.warn(`[TIMEOUT] ${source} summary call exceeded ${ms}ms`);
          reject(new Error('TIMEOUT'));
        }, ms)
      ),
    ]);
  }

  // ═══════════════════════════════════════════════════════════
  // MONTHLY BURN - business rule: exclude ads, include pending obligations
  // ═══════════════════════════════════════════════════════════

  private async getMonthlyBurn(): Promise<MonthlyBurnBreakdown> {
    const windowDays = 30;

    let laborCore = 0;
    let operationsMandatory = 0;
    let loanPayment = 0;
    let agentCommission = 0;
    let supplierPendingPayment = 0;
    let isEstimated = false;
    const estimationNotes: string[] = [];
    const cachedFullMetrics = await this.getLastKnownFullMetrics();
    const estimateMonthlyFromCache = (field: keyof MonthlyBurnBreakdown): number => {
      const value = Number(cachedFullMetrics?.monthlyBurnBreakdown?.[field] || 0);
      return Math.max(0, Math.round(value));
    };

    // 1) Payroll due in next 30 days
    try {
      const laborSummary = await this.snapshotService.read<{ totalPayrollDue14d: number }>('labor', windowDays);
      if (!laborSummary) {
        isEstimated = true;
        laborCore = estimateMonthlyFromCache('laborCore');
        estimationNotes.push(laborCore > 0
          ? 'labor: thieu snapshot 30 ngay, dung uoc tinh tu lan tinh truoc'
          : 'labor: thieu snapshot 30 ngay va chua co so uoc tinh truoc');
      } else {
        laborCore = this.validateLaborSnapshot(laborSummary).totalPayrollDue14d;
      }
    } catch (err) {
      // Issue 2 (P2 Fix): Fallback aggregate query removed to prevent DB overload on snapshot failure.
      // If snapshot is unavailable, return 0 safely and flag as estimated so CFO sees the alert.
      this.logger.error('[P2] Failed to get payroll due from summary. Snapshot system issue.');
      isEstimated = true;
      estimationNotes.push('payroll: data unavailable (snapshot failed)');
      laborCore = estimateMonthlyFromCache('laborCore');
    }

    // 2) Mandatory operations due in next 30 days (exclude ads/marketing)
    try {
      const opsSummary = await this.snapshotService.read<{ totalOpsDue14d: number; byCategory: Array<{ category: string; due14d: number }> }>('ops', windowDays);
      if (!opsSummary) {
        isEstimated = true;
        operationsMandatory = estimateMonthlyFromCache('operationsMandatory');
        estimationNotes.push(operationsMandatory > 0
          ? 'ops: thieu snapshot 30 ngay, dung uoc tinh tu lan tinh truoc'
          : 'ops: thieu snapshot 30 ngay va chua co so uoc tinh truoc');
      } else {
        const validatedOps = this.validateOpsSnapshot(opsSummary);
        operationsMandatory = validatedOps.byCategory
          .filter((item) => !this.isAdsCategory(item.category))
          .reduce((sum, item) => sum + item.due14d, 0);
      }
    } catch (err) {
      // Issue 2 (P2 Fix): Fallback aggregate query removed to prevent DB overload on snapshot failure.
      this.logger.error('[P2] Failed to get ops due from summary. Snapshot system issue.');
      isEstimated = true;
      estimationNotes.push('ops: data unavailable (snapshot failed)');
      operationsMandatory = estimateMonthlyFromCache('operationsMandatory');
    }

    // 3) Debt due in next 30 days
    try {
      const debtSummary = await this.financeService.getDebtCashflowSummary(windowDays);
      loanPayment = this.requireNonNegativeFinite(debtSummary.totalDebtDue14d, 'debt.totalDebtDue14d');
    } catch (err) {
      this.logger.warn('[P2] Failed to get debt due from summary, falling back to 0');
      isEstimated = true;
      estimationNotes.push('debt: unavailable');
      loanPayment = estimateMonthlyFromCache('loanPayment');
    }

    // 4) Agent commission pending payment (next 30 days)
    try {
      const agentSummary = await this.snapshotService.read<{ totalAgentDue14d: number }>('agent', windowDays);
      if (!agentSummary) {
        isEstimated = true;
        agentCommission = estimateMonthlyFromCache('agentCommission');
        estimationNotes.push(agentCommission > 0
          ? 'agent: thieu snapshot 30 ngay, dung uoc tinh tu lan tinh truoc'
          : 'agent: thieu snapshot 30 ngay va chua co so uoc tinh truoc');
      } else {
        agentCommission = this.validateAgentSnapshot(agentSummary).totalAgentDue14d;
      }
    } catch (err) {
      // Issue 2 (P2 Fix): Fallback aggregate query removed to prevent DB overload on snapshot failure.
      this.logger.error('[P2] Failed to get agent due from summary. Snapshot system issue.');
      isEstimated = true;
      estimationNotes.push('agent: data unavailable (snapshot failed)');
      agentCommission = estimateMonthlyFromCache('agentCommission');
    }

    // `supplier-payable` is a legacy name for supplier AR (cash inflow), not an
    // operating liability. Preserve the response field for clients, but never
    // include supplier receivables in monthly burn.
    supplierPendingPayment = 0;

    // Ads is explicitly excluded by business rule.
    const total = laborCore + operationsMandatory + loanPayment + agentCommission + supplierPendingPayment;

    this.logger.log(
      `[P2] Monthly burn (exclude ads, include pending) = ${total.toLocaleString('vi-VN')} ` +
      `(labor: ${laborCore}, ops: ${operationsMandatory}, debt: ${loanPayment}, agentPending: ${agentCommission}, supplierPending: ${supplierPendingPayment})`,
    );

    return {
      laborCore,
      operationsMandatory,
      loanPayment,
      agentCommission,
      supplierPendingPayment,
      total,
      isEstimated,
      estimationNotes: isEstimated ? estimationNotes : undefined,
    };
  }

  private isAdsCategory(category?: string): boolean {
    if (!category) return false;
    const normalized = String(category).trim().toLowerCase();
    return normalized.includes('ads')
      || normalized.includes('marketing')
      || normalized.includes('quang cao')
      || normalized.includes('quảng cáo');
  }

  // ═══════════════════════════════════════════════════════════
  // OPTIMAL ADS SUGGESTION (Rule 20%)
  // ═══════════════════════════════════════════════════════════

  async getOptimalAdsSuggestion(): Promise<OptimalAdsSuggestionResult> {
    await this.synchronizeConfigFromDatabase();
    const canonical = await this.adGroupDailyReportService.getOptimalSpendSuggestions({
      minStartBudget: this.config.MinStartBudget,
      upperCapMultiplier: this.config.UpperCapMultiplier,
      lowerCapMultiplier: this.config.LowerCapMultiplier,
    });
    const results: AdGroupOptimalSpend[] = canonical.adGroupSuggestions.map((item) => {
      const spendYesterday = this.requireNonNegativeFinite(item.spendYesterday, 'ads.spendYesterday');
      const avgSpendLast3Days = this.requireNonNegativeFinite(item.currentAvgSpend, 'ads.currentAvgSpend');
      const baselineSpend = this.requireNonNegativeFinite(item.baselineSpend, 'ads.baselineSpend');
      const optimalRaw = this.requireNonNegativeFinite(item.suggestedSpend, 'ads.suggestedSpend');
      const optimalSuggested = this.requireNonNegativeFinite(item.suggestedSpendWithCap, 'ads.suggestedSpendWithCap');
      const upperCap = baselineSpend * this.config.UpperCapMultiplier;
      const lowerCap = baselineSpend * this.config.LowerCapMultiplier;
      const isCapped = optimalSuggested !== optimalRaw;

      return {
        adGroupId: String(item.adGroupId || ''),
        adGroupName: String(item.adGroupName || item.adGroupId || ''),
        spendYesterday,
        avgSpendLast3Days,
        optimalRaw,
        baselineSpend,
        upperCap,
        lowerCap,
        optimalSuggested,
        isNewAdGroup: spendYesterday === 0 && avgSpendLast3Days === 0,
        isCapped,
        capReason: isCapped ? (optimalRaw > upperCap ? 'upper' : 'lower') : undefined,
      };
    });
    const totalOptimalDaily = this.requireNonNegativeFinite(
      canonical.totalSuggestedSpendWithCap,
      'ads.totalSuggestedSpendWithCap',
    );
    const recomputedTotal = results.reduce((sum, result) => sum + result.optimalSuggested, 0);
    if (Math.abs(totalOptimalDaily - recomputedTotal) > 1) {
      throw new Error('Invalid optimal Ads aggregate: item total does not match canonical total');
    }

    return {
      adGroups: results,
      totalOptimalDaily,
      totalOptimalWeekly: totalOptimalDaily * 7,
      cappedCount: results.filter((result) => result.isCapped).length,
    };
  }

  private async calculateAdGroupOptimal(adGroup: any): Promise<AdGroupOptimalSpend> {
    const adGroupId = adGroup._id.toString();

    // 1. Get spend yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayResult = await this.adsCostModel.aggregate([
      {
        $match: {
          adGroupId,
          date: { $gte: yesterday, $lte: yesterdayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$spentAmount' } } },
    ]);
    const spendYesterday = yesterdayResult[0]?.total || 0;

    // 2. Get avg spend last 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const avg3DaysResult = await this.adsCostModel.aggregate([
      {
        $match: {
          adGroupId,
          date: { $gte: threeDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$spentAmount' }, count: { $sum: 1 } } },
    ]);
    const avgSpendLast3Days = (avg3DaysResult[0]?.total || 0) / 3;

    // 3. Get optimal raw from ROI calculation (TODO: từ ad-group-profit service)
    // Tạm thời dùng budget hiện tại của ad group
    const optimalRaw = adGroup.dailyBudget || spendYesterday || this.config.MinStartBudget;

    // 4. Calculate baseline, caps, and final
    const isNewAdGroup = spendYesterday === 0 && avgSpendLast3Days === 0;
    const baselineSpend = Math.max(
      spendYesterday,
      avgSpendLast3Days,
      this.config.MinStartBudget,
    );
    const upperCap = baselineSpend * this.config.UpperCapMultiplier;
    const lowerCap = baselineSpend * this.config.LowerCapMultiplier;

    // 5. Clamp
    let optimalSuggested = optimalRaw;
    let isCapped = false;
    let capReason: 'upper' | 'lower' | undefined;

    if (optimalRaw > upperCap) {
      optimalSuggested = upperCap;
      isCapped = true;
      capReason = 'upper';
    } else if (optimalRaw < lowerCap) {
      optimalSuggested = lowerCap;
      isCapped = true;
      capReason = 'lower';
    }

    return {
      adGroupId,
      adGroupName: adGroup.name || adGroupId,
      spendYesterday,
      avgSpendLast3Days,
      optimalRaw,
      baselineSpend,
      upperCap,
      lowerCap,
      optimalSuggested,
      isNewAdGroup,
      isCapped,
      capReason,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // FORECAST 7 DAYS
  // ═══════════════════════════════════════════════════════════

  async getForecast7D(
    bankBalance?: number,
    dailyAds?: number,
    monthlyBurnBreakdown?: MonthlyBurnBreakdown,
  ): Promise<Forecast7DResult> {
    if (bankBalance === undefined) {
      bankBalance = await this.getBankBalance();
    }
    if (dailyAds === undefined) {
      dailyAds = 0; // Default to 0 instead of recursive call
    }
    if (!monthlyBurnBreakdown) {
      monthlyBurnBreakdown = await this.getMonthlyBurn();
    }

    const survivalFloor = this.config.SurvivalMonths * monthlyBurnBreakdown.total;

    const expectedInflows: ExpectedInflowBreakdown[] = [];
    const expectedOutflows: ExpectedOutflowBreakdown[] = [];

    // Pre-populate both inflow and outflow caches in parallel before the forecast loop
    await Promise.all([
      this.ensureInflowCachePopulated(),
      this.ensureOutflowCachePopulated(),
    ]);

    // Fetch all 7 days of inflows and outflows in parallel
    const dates: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      dates.push(date);
    }

    const [inflowResults, outflowResults] = await Promise.all([
      Promise.all(dates.map((date) => this.getExpectedInflow(date))),
      Promise.all(dates.map((date) => this.getExpectedOutflow(date, dailyAds))),
    ]);

    const days: ForecastDay[] = [];
    let currentBalance = bankBalance;
    let currentHardOutBalance = bankBalance;
    const hardOutBalances: number[] = [];

    for (let d = 0; d < 7; d++) {
      const inflow = inflowResults[d];
      const adjustedInflow = inflow.total * this.config.RiskAdjustInflow;
      expectedInflows.push({ ...inflow, adjustedTotal: adjustedInflow });

      const outflow = outflowResults[d];
      expectedOutflows.push(outflow);

      currentBalance = currentBalance + adjustedInflow - outflow.total;
      currentHardOutBalance = currentHardOutBalance
        + adjustedInflow
        - (outflow.total - outflow.adsDaily);
      hardOutBalances.push(currentHardOutBalance);

      days.push({
        day: d,
        date: dates[d],
        expectedIn: adjustedInflow,
        expectedOut: outflow.total,
        forecastBank: currentBalance,
        note: this.getNoteForDay(dates[d], outflow),
      });
    }

    // Low Point
    const lowPoint = Math.min(...days.map((d) => d.forecastBank));
    const lowPointDay = days.find((d) => d.forecastBank === lowPoint)?.day || 0;
    const lowPointDate = days.find((d) => d.forecastBank === lowPoint)?.date || new Date();
    const hardOutLowPoint = Math.min(...hardOutBalances);
    const hardOutLowPointDay = hardOutBalances.findIndex((value) => value === hardOutLowPoint);

    return {
      days,
      lowPoint,
      lowPointDay,
      lowPointDate,
      hardOutLowPoint,
      hardOutLowPointDay,
      isCashCrunch: hardOutLowPoint < 0,
      isSurvivalRisk: lowPoint < survivalFloor,
      endBalance: days[6]?.forecastBank ?? currentBalance,
      expectedInflows,
      expectedOutflows,
    };
  }

  // Cache for supplier expected inflows (CFO Spec v3.1)
  // NOTE: local Maps are used only as transient hydration buffer inside the populate methods.
  // The canonical shared cache is CacheManager (Redis-backed in multi-pod).
  private supplierExpectedCache: Map<string, number> | null = null;
  private supplierCacheTimestamp: Date | null = null;

  // CFO Spec v3.1: local Maps hydrated from CacheManager
  private opsOutCache: Map<string, number> | null = null;
  private debtOutCache: Map<string, number> | null = null;
  private payrollOutCache: Map<string, number> | null = null; // CFO Spec v3.2: Fixed type
  private agentOutCache: Map<string, number> | null = null;
  private taxOutCache: Map<string, number> | null = null;
  private outflowCacheTimestamp: Date | null = null;

  private async getExpectedInflow(date: Date): Promise<ExpectedInflowBreakdown> {
    // 1. NCC dự kiến trả - lấy từ cache (đã được khởi tạo bởi ensureInflowCachePopulated)
    let supplierPayments = 0;

    try {
      await this.ensureInflowCachePopulated();
      const dateStr = this.toBusinessDate(date);
      supplierPayments = this.supplierExpectedCache?.get(dateStr) || 0;
    } catch (err) {
      this.logger.warn('Failed to get supplier inflow from cache, assuming 0 (fallback query removed 2026-03-16)');
      supplierPayments = 0;
    }

    // 2. Vay dự kiến giải ngân (TODO)
    const loanDisbursement = 0;

    // 3. Refund dự kiến (TODO)
    const refunds = 0;

    const total = supplierPayments + loanDisbursement + refunds;

    return {
      supplierPayments,
      loanDisbursement,
      refunds,
      other: 0,
      total,
      adjustedTotal: total * this.config.RiskAdjustInflow,
    };
  }

  private async getExpectedOutflow(date: Date, dailyAds: number): Promise<ExpectedOutflowBreakdown> {
    const dateStr = this.toBusinessDate(new Date(date));

    // CFO Spec v3.1: Use cached dueByDay7d from summaries (Hard Out only)
    // Ads is Soft Out (proxy) - not used for cash crunch conclusion
    const adsDaily = dailyAds;

    // Ensure outflow cache is populated (uses shared CacheManager)
    await this.ensureOutflowCachePopulated();

    // 1. Operations - from ops summary dueByDay7d
    const operations = this.opsOutCache?.get(dateStr) || 0;

    // 2. Debt - from debt summary dueByDay7d
    const loanPayment = this.debtOutCache?.get(dateStr) || 0;

    // 3. Payroll - CFO Spec v3.2
    const labor = this.payrollOutCache?.get(dateStr) || 0;

    // 4. Agent - from cached byAgent.nextDueDate
    const agents = this.agentOutCache?.get(dateStr) || 0;

    // 5. Tax (TODO)
    const tax = this.taxOutCache?.get(dateStr) || 0;

    // Total Hard Out (không bao gồm ads proxy để tính cash crunch)
    const totalHardOut = labor + operations + agents + tax + loanPayment;
    const total = adsDaily + totalHardOut;

    return {
      adsDaily,
      labor,
      operations,
      agents,
      tax,
      loanPayment,
      total,
    };
  }

  /**
   * CFO Spec v3.1: Populate inflow cache from supplier cashflow summary.
   * Dữ liệu được lưu vào CacheManager (Redis khi multi-pod) với TTL 5 phút.
   */
  private async ensureInflowCachePopulated(): Promise<void> {
    // Kiểm tra shared cache trước
    const stored = await this.cacheManager.get<Record<string, number>>(
      FinancialControlService.CACHE_KEY_INFLOW,
    );
    if (stored) {
      // Hydrate local Map từ cache nếu chưa có
      if (!this.supplierExpectedCache) {
        this.supplierExpectedCache = new Map(Object.entries(stored));
      }
      return;
    }

    try {
      const supplierSnap = await this.snapshotService.read<{ expectedInflowByDay: Array<{ date: string; netAmount: number }> }>('supplier', -1);
      if (supplierSnap) this.validateSupplierSnapshot(supplierSnap as unknown as Record<string, any>);
      this.supplierExpectedCache = new Map();
      const toStore: Record<string, number> = {};
      for (const dayData of supplierSnap?.expectedInflowByDay || []) {
        this.supplierExpectedCache.set(dayData.date, dayData.netAmount);
        toStore[dayData.date] = dayData.netAmount;
      }
      await this.cacheManager.set(
        FinancialControlService.CACHE_KEY_INFLOW,
        toStore,
        FinancialControlService.CACHE_TTL_FLOWS,
      );
      this.supplierCacheTimestamp = new Date();
    } catch (err) {
      this.logger.error('[P1] Failed to cache supplier inflows — preserving stale cache', err);
      if (!this.supplierExpectedCache) this.supplierExpectedCache = new Map();
    }
  }

  /**
   * CFO Spec v3.1: Populate outflow caches from summaries.
   * Lưu vào CacheManager (Redis khi multi-pod) với TTL 5 phút.
   * Stale-cache fallback: nếu API fail, giữ nguyên dữ liệu cũ để Forecast 7D không báo 0.
   */
  private async ensureOutflowCachePopulated(): Promise<void> {
    // Kiểm tra shared cache
    const stored = await this.cacheManager.get<{
      ops: Record<string, number>;
      debt: Record<string, number>;
      payroll: Record<string, number>;
      agent: Record<string, number>;
      tax?: Record<string, number>;
    }>(FinancialControlService.CACHE_KEY_OUTFLOW);

    if (stored?.tax) {
      // Hydrate local Maps nếu chưa có
      if (!this.opsOutCache) this.opsOutCache = new Map(Object.entries(stored.ops));
      if (!this.debtOutCache) this.debtOutCache = new Map(Object.entries(stored.debt));
      if (!this.payrollOutCache) this.payrollOutCache = new Map(Object.entries(stored.payroll));
      if (!this.agentOutCache) this.agentOutCache = new Map(Object.entries(stored.agent));
      if (!this.taxOutCache) this.taxOutCache = new Map(Object.entries(stored.tax));
      return;
    }

    // --- Fetch from source services ---
    const opsRecord: Record<string, number> = {};
    const debtRecord: Record<string, number> = {};
    const payrollRecord: Record<string, number> = {};
    const agentRecord: Record<string, number> = {};
    const taxRecord: Record<string, number> = {};

    // Populate ops
    try {
      const opsSummary = await this.snapshotService.read<{ dueByDay7d: Array<{ date: string; amount: number }> }>('ops', 7);
      this.opsOutCache = new Map();
      for (const day of opsSummary?.dueByDay7d || []) {
        this.opsOutCache.set(day.date, day.amount);
        opsRecord[day.date] = day.amount;
      }
    } catch (err) {
      this.logger.error('[P1] Failed to cache ops dueByDay7d — preserving stale cache', err);
      if (!this.opsOutCache) this.opsOutCache = new Map();
    }

    // Populate debt
    try {
      const debtSummary = await this.financeService.getDebtCashflowSummary(7);
      this.debtOutCache = new Map();
      for (const day of debtSummary.dueByDay7d || []) {
        this.debtOutCache.set(day.date, day.amount);
        debtRecord[day.date] = day.amount;
      }
    } catch (err) {
      this.logger.error('[P1] Failed to cache debt dueByDay7d — preserving stale cache', err);
      if (!this.debtOutCache) this.debtOutCache = new Map();
    }

    // Populate payroll (CFO Spec v3.2)
    try {
      const laborSummary = await this.snapshotService.read<{ dueByDay7d: Array<{ date: string; amount: number }> }>('labor', 7);
      this.payrollOutCache = new Map();
      for (const day of laborSummary?.dueByDay7d || []) {
        this.payrollOutCache.set(day.date, day.amount);
        payrollRecord[day.date] = day.amount;
      }
    } catch (err) {
      this.logger.error('[P1] Failed to cache payroll dueByDay7d — preserving stale cache', err);
      if (!this.payrollOutCache) this.payrollOutCache = new Map();
    }

    // Populate agent (Fix #6)
    try {
      const agentSummary = await this.snapshotService.read<{ byAgent: Array<{ nextDueDate: string; unpaid: number }> }>('agent', 7);
      this.agentOutCache = new Map();
      for (const agent of agentSummary?.byAgent || []) {
        if (agent.nextDueDate && agent.unpaid) {
          const existing = this.agentOutCache.get(agent.nextDueDate) || 0;
          this.agentOutCache.set(agent.nextDueDate, existing + agent.unpaid);
          agentRecord[agent.nextDueDate] = (agentRecord[agent.nextDueDate] || 0) + agent.unpaid;
        }
      }
    } catch (err) {
      this.logger.error('[P1] Failed to cache agent outflows — preserving stale cache', err);
      if (!this.agentOutCache) this.agentOutCache = new Map();
    }

    // Populate tax from the canonical evidence-backed snapshot.
    try {
      const taxSummary = await this.snapshotService.read<TaxObligationSnapshot>('tax', -1);
      this.taxOutCache = new Map();
      if (taxSummary) {
        const validated = this.validateTaxSnapshot(taxSummary);
        for (const day of validated.dueByDay7d) {
          this.taxOutCache.set(day.date, day.amount);
          taxRecord[day.date] = day.amount;
        }
      }
    } catch (err) {
      this.logger.error('[P1] Failed to cache tax dueByDay7d - preserving stale cache', err);
      if (!this.taxOutCache) this.taxOutCache = new Map();
    }

    // Persist combined record to shared cache
    await this.cacheManager.set(
      FinancialControlService.CACHE_KEY_OUTFLOW,
      { ops: opsRecord, debt: debtRecord, payroll: payrollRecord, agent: agentRecord, tax: taxRecord },
      FinancialControlService.CACHE_TTL_FLOWS,
    );
    this.outflowCacheTimestamp = new Date();
  }

  private getNoteForDay(date: Date, outflow: ExpectedOutflowBreakdown): string | undefined {
    const notes: string[] = [];
    if (outflow.labor > 0) notes.push('Trả lương');
    if (outflow.loanPayment > 0) notes.push('Trả nợ');
    if (outflow.operations > 0) notes.push('Vận hành');
    if (outflow.tax > 0) notes.push('Thuế');
    return notes.length > 0 ? notes.join(', ') : undefined;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private requireNonNegativeFinite(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid financial value: ${field}`);
    }
    return value;
  }

  private toBusinessDate(date: Date): string {
    return new Date(date.getTime() + BUSINESS_UTC_OFFSET_MS).toISOString().slice(0, 10);
  }

  private validateLaborSnapshot<T extends Record<string, any>>(snapshot: T): T & { totalPayrollDue14d: number } {
    const totalPayrollDue14d = this.requireNonNegativeFinite(
      snapshot.totalPayrollDue14d,
      'labor.totalPayrollDue14d',
    );
    if (snapshot.dueByDay7d !== undefined && !Array.isArray(snapshot.dueByDay7d)) {
      throw new Error('Invalid labor.dueByDay7d');
    }
    for (const item of snapshot.dueByDay7d || []) {
      this.requireNonNegativeFinite(item?.amount, 'labor.dueByDay7d.amount');
      if (typeof item?.date !== 'string') throw new Error('Invalid labor.dueByDay7d.date');
    }
    return { ...snapshot, totalPayrollDue14d };
  }

  private validateOpsSnapshot<T extends Record<string, any>>(snapshot: T): T & {
    totalOpsDue14d: number;
    byCategory: Array<{ category: string; due14d: number }>;
  } {
    const totalOpsDue14d = this.requireNonNegativeFinite(snapshot.totalOpsDue14d, 'ops.totalOpsDue14d');
    if (!Array.isArray(snapshot.byCategory)) throw new Error('Invalid ops.byCategory');
    const byCategory = snapshot.byCategory.map((item: any) => ({
      ...item,
      category: String(item?.category || ''),
      due14d: this.requireNonNegativeFinite(item?.due14d, 'ops.byCategory.due14d'),
    }));
    if (snapshot.dueByDay7d !== undefined && !Array.isArray(snapshot.dueByDay7d)) {
      throw new Error('Invalid ops.dueByDay7d');
    }
    for (const item of snapshot.dueByDay7d || []) {
      this.requireNonNegativeFinite(item?.amount, 'ops.dueByDay7d.amount');
      if (typeof item?.date !== 'string') throw new Error('Invalid ops.dueByDay7d.date');
    }
    return { ...snapshot, totalOpsDue14d, byCategory };
  }

  private validateAgentSnapshot<T extends Record<string, any>>(snapshot: T): T & { totalAgentDue14d: number } {
    const totalAgentDue14d = this.requireNonNegativeFinite(snapshot.totalAgentDue14d, 'agent.totalAgentDue14d');
    if (snapshot.byAgent !== undefined && !Array.isArray(snapshot.byAgent)) {
      throw new Error('Invalid agent.byAgent');
    }
    for (const item of snapshot.byAgent || []) {
      this.requireNonNegativeFinite(item?.unpaid, 'agent.byAgent.unpaid');
    }
    return { ...snapshot, totalAgentDue14d };
  }

  private validateSupplierSnapshot(snapshot: Record<string, any>): void {
    if (!Array.isArray(snapshot.expectedInflowByDay)) {
      throw new Error('Invalid supplier.expectedInflowByDay');
    }
    for (const item of snapshot.expectedInflowByDay) {
      this.requireNonNegativeFinite(item?.netAmount, 'supplier.expectedInflowByDay.netAmount');
      if (typeof item?.date !== 'string') throw new Error('Invalid supplier.expectedInflowByDay.date');
    }
  }

  private validateTaxSnapshot<T extends Record<string, any>>(snapshot: T): T & TaxObligationSnapshot {
    const totalTaxDue = this.requireNonNegativeFinite(snapshot.totalTaxDue, 'tax.totalTaxDue');
    if (!Array.isArray(snapshot.dueByDay7d) || snapshot.dueByDay7d.length > 7) {
      throw new Error('Invalid tax.dueByDay7d');
    }

    if (typeof snapshot.asOf !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(snapshot.asOf)) {
      throw new Error('Invalid tax.asOf: timestamp with timezone required');
    }
    const asOf = new Date(snapshot.asOf);
    const asOfMs = asOf.getTime();
    if (!Number.isFinite(asOfMs)) throw new Error('Invalid tax.asOf');
    const ageMs = Date.now() - asOfMs;
    if (ageMs < -5 * 60 * 1000) throw new Error('Invalid tax.asOf: future timestamp');
    if (ageMs > FinancialControlService.SNAPSHOT_MAX_AGE_MS) {
      throw new Error('Invalid tax.asOf: older than 24 hours');
    }

    if (!TAX_OBLIGATION_SOURCES.includes(snapshot.source)) {
      throw new Error('Invalid tax.source');
    }
    const evidence = typeof snapshot.evidence === 'string' ? snapshot.evidence.trim() : '';
    if (evidence.length < 3 || evidence.length > 1000) throw new Error('Invalid tax.evidence');
    const updatedBy = typeof snapshot.updatedBy === 'string' ? snapshot.updatedBy.trim() : '';
    if (!updatedBy || updatedBy.length > 200) throw new Error('Invalid tax.updatedBy');

    const today = this.toBusinessDate(new Date());
    const maxDay = new Date(`${today}T00:00:00.000Z`);
    maxDay.setUTCDate(maxDay.getUTCDate() + 6);
    const maxDate = maxDay.toISOString().slice(0, 10);
    const seenDates = new Set<string>();
    let scheduledTotal = 0;
    const dueByDay7d = snapshot.dueByDay7d.map((item: any) => {
      const date = typeof item?.date === 'string' ? item.date : '';
      const parsed = new Date(`${date}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== date) {
        throw new Error('Invalid tax.dueByDay7d.date');
      }
      if (date < today || date > maxDate) {
        throw new Error('Invalid tax.dueByDay7d.date: must be within today and the next 6 days');
      }
      if (seenDates.has(date)) throw new Error('Invalid tax.dueByDay7d.date: duplicate date');
      seenDates.add(date);
      const amount = this.requireNonNegativeFinite(item?.amount, 'tax.dueByDay7d.amount');
      scheduledTotal += amount;
      return { date, amount };
    });
    if (scheduledTotal > totalTaxDue + 0.001) {
      throw new Error('Invalid tax.dueByDay7d: scheduled amount exceeds totalTaxDue');
    }

    return {
      ...snapshot,
      totalTaxDue,
      dueByDay7d,
      asOf: asOf.toISOString(),
      source: snapshot.source,
      evidence,
      updatedBy,
    } as T & TaxObligationSnapshot;
  }

  async getTaxObligationSnapshot(): Promise<TaxObligationSnapshot | null> {
    const snapshot = await this.snapshotService.read<TaxObligationSnapshot>('tax', -1);
    return snapshot ? this.validateTaxSnapshot(snapshot) : null;
  }

  async upsertTaxObligationSnapshot(
    input: UpsertTaxObligationSnapshotDto,
    currentUser: any,
  ): Promise<TaxObligationSnapshot> {
    const updatedBy = String(currentUser?.id || currentUser?._id || currentUser?.email || '').trim();
    if (!updatedBy) throw new BadRequestException('Authenticated user identity is required');

    let snapshot: TaxObligationSnapshot;
    try {
      snapshot = this.validateTaxSnapshot({
        totalTaxDue: input.totalTaxDue,
        dueByDay7d: input.dueByDay7d,
        asOf: input.asOf,
        source: input.source,
        evidence: input.evidence,
        updatedBy: updatedBy.slice(0, 200),
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid tax obligation snapshot');
    }

    await this.snapshotService.storeTaxWithAudit(
      snapshot as unknown as Record<string, unknown>,
      snapshot.updatedBy,
    );
    this.invalidateCache('tax-obligation-updated');
    return snapshot;
  }

  private async getSnapshotQualityState(): Promise<SnapshotQualityState> {
    const requested = [
      { domain: 'labor' as const, windowDays: this.config.CommittedWindowDays },
      { domain: 'ops' as const, windowDays: this.config.CommittedWindowDays },
      { domain: 'agent' as const, windowDays: this.config.CommittedWindowDays },
      { domain: 'labor' as const, windowDays: 30 },
      { domain: 'ops' as const, windowDays: 30 },
      { domain: 'agent' as const, windowDays: 30 },
      { domain: 'supplier' as const, windowDays: -1 },
      { domain: 'tax' as const, windowDays: -1 },
    ];
    const unique = Array.from(new Map(
      requested.map((entry) => [`${entry.domain}:${entry.windowDays}`, entry]),
    ).values());
    const staleModules = new Set<string>();
    const invalidModules = new Set<string>();
    const notes: string[] = [];

    await Promise.all(unique.map(async ({ domain, windowDays }) => {
      try {
        const [snapshot, staleness] = await Promise.all([
          this.snapshotService.read<Record<string, any>>(domain, windowDays),
          this.snapshotService.getStaleness(domain, windowDays),
        ]);
        if (!snapshot) {
          invalidModules.add(domain);
          notes.push(`${domain}: snapshot ${windowDays} ngay khong ton tai`);
          return;
        }
        if (domain === 'labor') this.validateLaborSnapshot(snapshot);
        if (domain === 'ops') this.validateOpsSnapshot(snapshot);
        if (domain === 'agent') this.validateAgentSnapshot(snapshot);
        if (domain === 'supplier') this.validateSupplierSnapshot(snapshot);
        if (domain === 'tax') this.validateTaxSnapshot(snapshot);
        if (!Number.isFinite(staleness) || staleness > FinancialControlService.SNAPSHOT_MAX_AGE_MS) {
          staleModules.add(domain);
          notes.push(`${domain}: snapshot ${windowDays} ngay da qua 24 gio`);
        }
      } catch (error) {
        invalidModules.add(domain);
        notes.push(`${domain}: ${error instanceof Error ? error.message : 'snapshot invalid'}`);
      }
    }));

    return {
      staleModules: Array.from(staleModules),
      invalidModules: Array.from(invalidModules),
      notes,
    };
  }

  private getRunwayStatus(months: number | null): 'safe' | 'ok' | 'warning' | 'danger' {
    if (months === null) return 'safe'; // Infinite runway
    if (months >= 6) return 'safe';
    if (months >= 3) return 'ok';
    if (months >= 1) return 'warning';
    return 'danger';
  }

  private buildDataQuality(
    committedBreakdown: CommittedCashBreakdown,
    monthlyBurnBreakdown: MonthlyBurnBreakdown,
    options: {
      optimalAdsUnavailable?: boolean;
      loanSummaryUnavailable?: boolean;
      optimalAdsError?: string;
      loanSummaryError?: string;
      staleModules?: string[];
      invalidModules?: string[];
      snapshotNotes?: string[];
    } = {},
  ): FinancialControlDataQuality {
    const estimationNotes = [
      ...(committedBreakdown.estimationNotes || []),
      ...(monthlyBurnBreakdown.estimationNotes || []),
    ];
    const notes = [...estimationNotes, ...(options.snapshotNotes || [])];
    const missingModules = new Set<string>();
    const estimatedModules = new Set<string>();
    const staleModules = new Set(options.staleModules || []);
    const blockingReasons: string[] = [];

    for (const note of estimationNotes) {
      const moduleName = note.split(':')[0]?.trim();
      if (!moduleName) continue;
      missingModules.add(moduleName);
      estimatedModules.add(moduleName);
    }

    if (options.optimalAdsUnavailable) {
      missingModules.add('ads');
      notes.push(`quang cao: khong lay duoc goi y ngan sach${options.optimalAdsError ? ` (${options.optimalAdsError})` : ''}`);
    }

    if (options.loanSummaryUnavailable) {
      missingModules.add('debt');
      notes.push(`no vay: khong lay duoc tong quan khoan vay${options.loanSummaryError ? ` (${options.loanSummaryError})` : ''}`);
    }

    for (const moduleName of options.invalidModules || []) {
      missingModules.add(moduleName);
      notes.push(`${moduleName}: snapshot sai schema hoac co gia tri khong hop le`);
    }

    for (const moduleName of missingModules) {
      blockingReasons.push(`Thiếu dữ liệu ${this.getDataQualityModuleLabel(moduleName)}; tạm khóa rút tiền và tăng ngân sách.`);
    }

    for (const moduleName of staleModules) {
      blockingReasons.push(`Du lieu ${this.getDataQualityModuleLabel(moduleName)} da qua cu; tam khoa rut tien va tang ngan sach.`);
    }

    const isDecisionLocked = blockingReasons.length > 0;
    return {
      status: isDecisionLocked ? 'blocked' : (estimatedModules.size > 0 ? 'estimated' : 'ok'),
      isDecisionLocked,
      missingModules: Array.from(missingModules),
      estimatedModules: Array.from(estimatedModules),
      staleModules: Array.from(staleModules),
      notes,
      blockingReasons,
    };
  }

  private getDataQualityModuleLabel(name: string): string {
    const labels: Record<string, string> = {
      labor: 'nhân công',
      payroll: 'nhân công',
      ops: 'vận hành',
      operations: 'vận hành',
      agent: 'đại lý',
      supplier: 'nhà cung cấp',
      debt: 'nợ vay',
      ads: 'quảng cáo',
      tax: 'thuế',
    };
    return labels[name] || name;
  }

  /**
   * CFO v3.1: Aggregate alerts from modules + FC alerts
   * Format: "source: ALERT_TYPE"
   */
  private buildAggregatedAlerts(
    forecast7D: Forecast7DResult,
    runwayStatus: 'safe' | 'ok' | 'warning' | 'danger',
    burnBreakdown: MonthlyBurnBreakdown,
    freeCash: number,
    monthlyBurn: number,
    dataQuality?: FinancialControlDataQuality,
  ): string[] {
    const alerts: string[] = [];

    // FC alerts
    if (forecast7D.isCashCrunch) {
      alerts.push('fc: CASH_CRUNCH');
    }
    if (forecast7D.isSurvivalRisk) {
      alerts.push('fc: SURVIVAL_RISK');
    }
    if (runwayStatus === 'danger') {
      alerts.push('fc: RUNWAY_DANGER');
    } else if (runwayStatus === 'warning') {
      alerts.push('fc: RUNWAY_WARNING');
    }

    // CFO Sign-off Condition #4: Sanity warnings
    if (monthlyBurn === 0) {
      alerts.push('fc: BURN_ZERO_RUNWAY_INFINITE');
    }
    if (freeCash < 0) {
      alerts.push('fc: NEGATIVE_FREE_CASH');
    }

    // Burn estimation warning (CFO checklist #3)
    if (burnBreakdown.isEstimated) {
      alerts.push('fc: BURN_ESTIMATED_USING_AVAILABLE_DATA');
    }

    if (dataQuality?.isDecisionLocked) {
      alerts.push('fc: DATA_QUALITY_LOCKED_DECISIONS');
    }

    // Module alerts will be collected from cached summaries
    // (Could extend to read alerts from module summaries if available)

    return alerts;
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE INIT — load config từ DB khi khởi động
  // ═══════════════════════════════════════════════════════════

  private getPolicyVersion(config: FinancialControlConfig): string {
    return (Object.keys(DEFAULT_CONFIG) as Array<keyof FinancialControlConfig>)
      .map((key) => `${key}=${config[key]}`)
      .join('|');
  }

  private applyCanonicalConfig(config: FinancialControlConfig): void {
    this.assertValidConfig(config);
    const nextVersion = this.getPolicyVersion(config);
    if (nextVersion === this.policyVersion) return;
    this.config = { ...config };
    this.policyVersion = nextVersion;
    this.invalidateCache('policy-version-changed');
  }

  private async synchronizeConfigFromDatabase(): Promise<void> {
    const doc = await this.settingsModel
      .findOne({ key: FinancialControlService.SETTINGS_KEY })
      .lean();
    if (!doc) {
      throw new Error('Financial Control policy is missing from SystemSettings');
    }
    const storedConfig = { ...DEFAULT_CONFIG, ...(doc.value as Partial<FinancialControlConfig>) };
    try {
      this.applyCanonicalConfig(storedConfig);
      this.policyUpdatedAt = (doc as any).updatedAt ? new Date((doc as any).updatedAt) : null;
    } catch (error) {
      this.logger.error('[CONFIG] Canonical FinancialControlConfig is invalid; refusing calculation');
      throw error;
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      const doc = await this.settingsModel
        .findOne({ key: FinancialControlService.SETTINGS_KEY })
        .lean();
      if (doc) {
        const storedConfig = { ...DEFAULT_CONFIG, ...(doc.value as Partial<FinancialControlConfig>) };
        try {
          this.assertValidConfig(storedConfig);
          this.config = storedConfig;
          this.policyVersion = this.getPolicyVersion(storedConfig);
          this.policyUpdatedAt = (doc as any).updatedAt ? new Date((doc as any).updatedAt) : null;
          this.logger.log('[CONFIG] Loaded FinancialControlConfig from SystemSettings DB');
        } catch {
          this.config = { ...DEFAULT_CONFIG };
          this.policyVersion = this.getPolicyVersion(this.config);
          this.logger.warn('[CONFIG] Stored FinancialControlConfig is invalid; using fail-closed defaults');
        }
      } else {
        // Seed default config vào DB lần đầu chạy
        await this.settingsModel.create({
          key: FinancialControlService.SETTINGS_KEY,
          value: DEFAULT_CONFIG,
          description: 'FinancialControl runtime configuration (CFO Spec v3.x)',
          updatedBy: 'system:init',
        });
        this.logger.log('[CONFIG] Seeded default FinancialControlConfig to SystemSettings DB');
      }
    } catch (err) {
      this.logger.warn('[CONFIG] Failed to load config from DB, using in-memory defaults', err);
    }
  }

  // Update config (ghi vào DB + cập nhật bộ nhớ + xoá cache)
  async updateConfig(
    partial: Partial<FinancialControlConfig>,
    currentUser?: any,
  ): Promise<FinancialControlConfig> {
    // Merge against the latest DB policy, never pod-local stale state. The
    // update endpoint is also the controlled repair path for a legacy policy
    // that is now invalid (for example CommittedWindowDays=21). Calculations
    // still refuse that policy; PATCH may repair it only if the resulting full
    // configuration passes current validation below.
    let baseConfig: FinancialControlConfig;
    try {
      await this.synchronizeConfigFromDatabase();
      baseConfig = { ...this.config };
    } catch {
      const legacyDoc = await this.settingsModel
        .findOne({ key: FinancialControlService.SETTINGS_KEY })
        .lean();
      if (!legacyDoc) {
        throw new BadRequestException('Financial Control policy is missing and cannot be repaired');
      }
      baseConfig = {
        ...DEFAULT_CONFIG,
        ...(legacyDoc.value as Partial<FinancialControlConfig>),
      };
      this.policyUpdatedAt = (legacyDoc as any).updatedAt
        ? new Date((legacyDoc as any).updatedAt)
        : null;
    }
    const allowedFields = Object.keys(DEFAULT_CONFIG) as Array<keyof FinancialControlConfig>;
    const changedFields = Object.keys(partial || {})
      .filter((field) => (partial as any)[field] !== undefined);
    if (!changedFields.length) throw new BadRequestException('At least one financial control field is required');
    if (changedFields.some((field) => !allowedFields.includes(field as keyof FinancialControlConfig))) {
      throw new BadRequestException('Financial control config contains an unsupported field');
    }

    const nextConfig = { ...baseConfig };
    for (const field of changedFields) {
      (nextConfig as any)[field] = Number((partial as any)[field]);
    }
    this.assertValidConfig(nextConfig);
    const actor = this.configActor(currentUser);
    const changedAt = new Date();

    try {
      const persisted = await this.settingsModel.findOneAndUpdate(
        {
          key: FinancialControlService.SETTINGS_KEY,
          ...(this.policyUpdatedAt ? { updatedAt: this.policyUpdatedAt } : {}),
        },
        {
          $set: { value: nextConfig, updatedBy: actor },
          $push: {
            auditHistory: {
              $each: [{
                changedAt,
                changedBy: actor,
                changedFields,
                previousValue: { ...baseConfig },
                nextValue: { ...nextConfig },
              }],
              $slice: -100,
            },
          },
        },
        { upsert: !this.policyUpdatedAt, new: true },
      );
      if (!persisted) {
        throw new ConflictException('Financial Control policy changed concurrently; reload and retry');
      }
      this.policyUpdatedAt = (persisted as any).updatedAt
        ? new Date((persisted as any).updatedAt)
        : this.policyUpdatedAt;
    } catch (err) {
      this.logger.error('[CONFIG] Failed to persist config update to DB');
      throw err;
    }
    // Update in-memory policy only after durable persistence succeeds.
    this.config = nextConfig;
    this.policyVersion = this.getPolicyVersion(nextConfig);
    this.invalidateCache('config-updated');
    if (changedFields.includes('SupplierCashCycleDays')) {
      await this.eventEmitter.emitAsync(FinanceEvents.FINANCIAL_CONTROL_POLICY_UPDATED, {
        changedFields,
        changedBy: actor,
      });
    }
    return { ...this.config };
  }

  async getConfig(): Promise<FinancialControlConfig> {
    await this.synchronizeConfigFromDatabase();
    return { ...this.config };
  }

  private assertValidConfig(config: FinancialControlConfig): void {
    const finite = (value: number) => Number.isFinite(value);
    if (!FinancialControlService.SUPPORTED_COMMITTED_WINDOWS.includes(config.CommittedWindowDays as 7 | 14 | 30)) {
      throw new BadRequestException('CommittedWindowDays must be one of: 7, 14, 30');
    }
    if (!finite(config.SurvivalMonths) || config.SurvivalMonths < 0.5 || config.SurvivalMonths > 24) {
      throw new BadRequestException('SurvivalMonths must be from 0.5 to 24');
    }
    if (!Number.isInteger(config.SupplierCashCycleDays)
      || config.SupplierCashCycleDays < 1
      || config.SupplierCashCycleDays > 365) {
      throw new BadRequestException('SupplierCashCycleDays must be an integer from 1 to 365');
    }
    if (!finite(config.RiskAdjustInflow) || config.RiskAdjustInflow < 0 || config.RiskAdjustInflow > 1) {
      throw new BadRequestException('RiskAdjustInflow must be from 0 to 1');
    }
    if (!finite(config.MinStartBudget) || config.MinStartBudget < 0 || config.MinStartBudget > 1_000_000_000) {
      throw new BadRequestException('MinStartBudget must be from 0 to 1,000,000,000');
    }
    if (!finite(config.UpperCapMultiplier) || config.UpperCapMultiplier < 1 || config.UpperCapMultiplier > 3) {
      throw new BadRequestException('UpperCapMultiplier must be from 1 to 3');
    }
    if (!finite(config.LowerCapMultiplier) || config.LowerCapMultiplier < 0.01 || config.LowerCapMultiplier > 1) {
      throw new BadRequestException('LowerCapMultiplier must be from 0.01 to 1');
    }
    if (config.LowerCapMultiplier > config.UpperCapMultiplier) {
      throw new BadRequestException('LowerCapMultiplier cannot exceed UpperCapMultiplier');
    }
    if (!finite(config.SafetyFactor) || config.SafetyFactor < 0 || config.SafetyFactor > 1) {
      throw new BadRequestException('SafetyFactor must be from 0 to 1');
    }
  }

  private configActor(currentUser: any): string {
    return String(
      currentUser?.fullName
      || currentUser?.email
      || currentUser?.id
      || currentUser?._id
      || 'system',
    ).trim().slice(0, 200) || 'system';
  }

  invalidateCache(reason = 'unspecified'): void {
    this.calculationVersion += 1;
    // Xoá các biến local (hydration buffers)
    this.opsOutCache = null;
    this.debtOutCache = null;
    this.payrollOutCache = null;
    this.agentOutCache = null;
    this.taxOutCache = null;
    this.outflowCacheTimestamp = null;
    this.supplierExpectedCache = null;
    this.supplierCacheTimestamp = null;
    // Xoá shared CacheManager (async, fire-and-forget)
    void Promise.all([
      this.cacheManager.del(FinancialControlService.CACHE_KEY_FULL),
      this.cacheManager.del(FinancialControlService.CACHE_KEY_OUTFLOW),
      this.cacheManager.del(FinancialControlService.CACHE_KEY_INFLOW),
    ]).catch((err) => this.logger.warn('[CACHE_INVALIDATED] Failed to delete from CacheManager', err));
    this.logger.debug(`[CACHE_INVALIDATED] ${reason} (version=${this.calculationVersion})`);
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE HEALTH STATUS (CFO v3.2)
  // ═══════════════════════════════════════════════════════════

  async getModuleHealth(): Promise<{
    overall: 'ok' | 'partial' | 'error';
    modules: Record<string, { status: 'ok' | 'partial' | 'error' | 'timeout'; lastUpdated: Date | null; error?: string; dataCount?: number }>;
    timestamp: Date;
  }> {
    await this.synchronizeConfigFromDatabase();
    const HEALTH_CHECK_TIMEOUT = 2000;
    const modules: Record<string, { status: 'ok' | 'partial' | 'error' | 'timeout'; lastUpdated: Date | null; error?: string; dataCount?: number }> = {};

    // Check each module
    const windowDays = this.config.CommittedWindowDays;
    const checks = [
      {
        name: 'labor', domain: 'labor' as const, windowDays,
        check: () => this.snapshotService.read<Record<string, any>>('labor', windowDays).then((snapshot) => {
          if (!snapshot) throw new Error('Snapshot not populated');
          return this.validateLaborSnapshot(snapshot);
        }),
      },
      {
        name: 'operations', domain: 'ops' as const, windowDays,
        check: () => this.snapshotService.read<Record<string, any>>('ops', windowDays).then((snapshot) => {
          if (!snapshot) throw new Error('Snapshot not populated');
          return this.validateOpsSnapshot(snapshot);
        }),
      },
      {
        name: 'agent', domain: 'agent' as const, windowDays,
        check: () => this.snapshotService.read<Record<string, any>>('agent', windowDays).then((snapshot) => {
          if (!snapshot) throw new Error('Snapshot not populated');
          return this.validateAgentSnapshot(snapshot);
        }),
      },
      { name: 'debt', check: () => this.financeService.getDebtCashflowSummary(windowDays) },
      {
        name: 'supplier', domain: 'supplier' as const, windowDays: -1,
        check: () => this.snapshotService.read<Record<string, any>>('supplier', -1).then((snapshot) => {
          if (!snapshot) throw new Error('Snapshot not populated');
          this.validateSupplierSnapshot(snapshot);
          return snapshot;
        }),
      },
      {
        name: 'tax', domain: 'tax' as const, windowDays: -1,
        check: () => this.snapshotService.read<Record<string, any>>('tax', -1).then((snapshot) => {
          if (!snapshot) throw new Error('Snapshot not populated');
          return this.validateTaxSnapshot(snapshot);
        }),
      },
      { name: 'ads', check: () => this.getOptimalAdsSuggestion() },
    ];

    for (const entry of checks) {
      const { name, check } = entry;
      try {
        const result = await Promise.race([
          check(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), HEALTH_CHECK_TIMEOUT)),
        ]);
        const staleness = 'domain' in entry
          ? await this.snapshotService.getStaleness(entry.domain, entry.windowDays)
          : 0;
        const isStale = !Number.isFinite(staleness)
          || staleness > FinancialControlService.SNAPSHOT_MAX_AGE_MS;
        modules[name] = {
          status: isStale ? 'partial' : 'ok',
          lastUpdated: Number.isFinite(staleness) ? new Date(Date.now() - staleness) : null,
          error: isStale ? 'Snapshot older than 24 hours' : undefined,
          dataCount: typeof result === 'object' && result !== null && 'count' in result ? (result as any).count : undefined,
        };
      } catch (err) {
        const isTimeout = err instanceof Error && err.message === 'timeout';
        modules[name] = {
          status: isTimeout ? 'timeout' : 'error',
          lastUpdated: null,
          error: isTimeout ? 'Module timeout' : (err instanceof Error ? err.message : 'Unknown error'),
        };
      }
    }

    // Calculate overall status
    const statuses = Object.values(modules).map(m => m.status);
    let overall: 'ok' | 'partial' | 'error' = 'ok';
    if (statuses.some(s => s === 'partial' || s === 'error' || s === 'timeout')) {
      overall = statuses.every(s => s === 'error' || s === 'timeout') ? 'error' : 'partial';
    }

    return {
      overall,
      modules,
      timestamp: new Date(),
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION SUGGESTIONS (CFO v3.2)
  // ═══════════════════════════════════════════════════════════

  async getActionSuggestions(): Promise<{
    actions: Array<{
      id: string;
      type: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      description: string;
      reason: string;
      linkTo?: string;
      linkLabel?: string;
      amount?: number;
    }>;
    generatedAt: Date;
    basedOnStatus: {
      runway: string;
      isCashCrunch: boolean;
      isSurvivalRisk: boolean;
    };
    recoveryInfo?: {
      currentFreeCash: number;
      currentMonthlyBurn: number;
      targetFreeCash: number;
      neededCash: number;
      targetBurn: number;
    };
  }> {
    const full = await this.getFullMetrics();
    const actions: Array<{
      id: string;
      type: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      description: string;
      reason: string;
      linkTo?: string;
      linkLabel?: string;
      amount?: number;
    }> = [];

    // CRITICAL: Cash Crunch
    if (full.isCashCrunch) {
      actions.push({
        id: 'action-1',
        type: 'PAUSE_ADS',
        priority: 'critical',
        title: 'Tạm dừng quảng cáo ngay',
        description: 'Dự báo số dư âm trong 7 ngày tới. Cần cắt chi phí ads ngay lập tức.',
        reason: `Forecast Low Point: ${this.formatVND(full.forecast7DLowPoint.amount)} @ T+${full.forecast7DLowPoint.day}`,
        linkTo: '/finance/ad-group-daily-report',
        linkLabel: 'Xem báo cáo Ads',
        amount: full.adsBudgetApproved,
      });
      actions.push({
        id: 'action-2',
        type: 'COLLECT_RECEIVABLES',
        priority: 'critical',
        title: 'Đẩy nhanh thu hồi công nợ',
        description: 'Liên hệ NCC và đại lý để thu hồi tiền nhanh hơn.',
        reason: 'Cần tiền mặt ngay để tránh Cash Crunch',
        linkTo: '/purchases/payables',
        linkLabel: 'Xem công nợ NCC',
      });
    }

    // CRITICAL/HIGH: Runway Danger
    if (full.runwayStatus === 'danger') {
      actions.push({
        id: 'action-3',
        type: 'STOP_OWNER_WITHDRAW',
        priority: 'critical',
        title: 'Không rút tiền Owner',
        description: 'Runway < 1 tháng. Cấm rút tiền cho đến khi ổn định.',
        reason: `Runway: ${full.runwayMonths !== null ? full.runwayMonths.toFixed(1) : '∞'} tháng`,
        linkTo: '/owner-fund',
        linkLabel: 'Xem quỹ Owner',
      });
      actions.push({
        id: 'action-4',
        type: 'PRIORITY_SALARY',
        priority: 'high',
        title: 'Ưu tiên trả lương core',
        description: 'Đảm bảo trả lương nhân sự chủ chốt đúng hạn.',
        reason: 'Giữ chân nhân sự quan trọng trong giai đoạn khó khăn',
        linkTo: '/costs/labor1',
        linkLabel: 'Xem bảng lương',
        amount: full.committedBreakdown.labor,
      });
    }

    // HIGH: Survival Risk
    if (full.isSurvivalRisk && !full.isCashCrunch) {
      actions.push({
        id: 'action-5',
        type: 'REVIEW_OPS_COST',
        priority: 'high',
        title: 'Rà soát chi phí vận hành',
        description: 'Cắt giảm chi phí không cần thiết để tăng buffer.',
        reason: `Dự báo số dư thấp nhất: ${this.formatVND(full.forecast7DLowPoint.amount)}`,
        linkTo: '/costs/other',
        linkLabel: 'Xem chi phí',
        amount: full.committedBreakdown.operations,
      });
    }

    // WARNING: Runway Warning
    if (full.runwayStatus === 'warning') {
      actions.push({
        id: 'action-6',
        type: 'DELAY_PAYMENT',
        priority: 'medium',
        title: 'Xem xét hoãn thanh toán',
        description: 'Đàm phán với NCC để kéo dài thời hạn thanh toán nếu cần.',
        reason: `Runway: ${full.runwayMonths !== null ? full.runwayMonths.toFixed(1) : '∞'} tháng (cảnh báo)`,
        linkTo: '/payments/supplier',
        linkLabel: 'Xem thanh toán NCC',
      });
    }

    // POSITIVE: Safe runway & Available budget
    if (full.runwayStatus === 'safe' || full.runwayStatus === 'ok') {
      if (full.adsBudgetApproved > 0) {
        actions.push({
          id: 'action-7',
          type: 'INCREASE_ADS',
          priority: 'low',
          title: 'Có thể scale quảng cáo',
          description: `Có thể tăng budget ads lên ${this.formatVND(full.adsBudgetApproved / 7)}/ngày.`,
          reason: `Available: ${this.formatVND(full.availableAfterSurvival)}`,
          linkTo: '/finance/ad-group-daily-report',
          linkLabel: 'Xem gợi ý ngân sách',
          amount: full.adsBudgetApproved,
        });
      }
      if (full.ownerWithdrawable > 0) {
        actions.push({
          id: 'action-8',
          type: 'ALLOW_OWNER_WITHDRAW',
          priority: 'low',
          title: 'Owner có thể rút tiền',
          description: `Có thể rút an toàn: ${this.formatVND(full.ownerWithdrawable)}.`,
          reason: `Sau khi trừ Survival Floor + Ads Budget`,
          linkTo: '/owner-fund',
          linkLabel: 'Rút tiền',
          amount: full.ownerWithdrawable,
        });
      }
    }

    // ADDITIONAL: Check for loan payments due
    if (full.committedBreakdown.loanPayment > 0) {
      actions.push({
        id: 'action-9',
        type: 'CHECK_LOAN_PAYMENT',
        priority: full.runwayStatus === 'danger' ? 'high' : 'medium',
        title: 'Kiểm tra khoản vay',
        description: `Có khoản vay cần trả: ${this.formatVND(full.committedBreakdown.loanPayment)} trong 14 ngày tới.`,
        reason: 'Đảm bảo không bị penalty do trả chậm',
        linkTo: '/loans',
        linkLabel: 'Xem khoản vay',
        amount: full.committedBreakdown.loanPayment,
      });
    }

    // ADDITIONAL: High operations cost warning
    if (full.monthlyBurnBreakdown.operationsMandatory > full.monthlyBurnBreakdown.laborCore * 2) {
      actions.push({
        id: 'action-10',
        type: 'REVIEW_OPS_RATIO',
        priority: 'medium',
        title: 'Chi phí vận hành cao',
        description: `Chi phí vận hành (${this.formatVND(full.monthlyBurnBreakdown.operationsMandatory)}) gấp đôi lương nhân công.`,
        reason: 'Nên rà soát để tối ưu hóa chi phí',
        linkTo: '/costs/other',
        linkLabel: 'Phân tích chi phí',
        amount: full.monthlyBurnBreakdown.operationsMandatory,
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Return top 5 actions for better context (increased from 3)
    return {
      actions: actions.slice(0, 5),
      generatedAt: new Date(),
      basedOnStatus: {
        runway: full.runwayStatus,
        isCashCrunch: full.isCashCrunch,
        isSurvivalRisk: full.isSurvivalRisk,
      },
      // Add recovery targets for UI
      recoveryInfo: {
        currentFreeCash: full.freeCash,
        currentMonthlyBurn: full.monthlyBurn,
        targetFreeCash: full.monthlyBurn * 3, // 3 months runway
        neededCash: Math.max(0, full.monthlyBurn * 3 - full.freeCash),
        targetBurn: full.freeCash > 0 ? full.freeCash / 3 : 0,
      },
    };
  }

  private formatVND(value: number): string {
    if (Math.abs(value) < 0.5) return '0 ₫';
    return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
  }
}
