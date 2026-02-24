/**
 * FINANCIAL CONTROL SERVICE - CFO Spec v3.1
 * ===========================================
 * Mục tiêu: Quản lý sự sống còn, tốc độ scale, số tiền owner có thể rút, và dự báo 7 ngày.
 * Nguyên tắc: 
 * - Chỉ có Cash In/Cash Out làm thay đổi Bank Balance
 * - FC chỉ đọc số đã chuẩn hóa từ các module, không query trực tiếp
 * - Internal transfer giữa quỹ/ví = đổi nhãn tiền, KHÔNG tính Cash In/Out
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { LaborStatement, LaborStatementDocument } from '../labor-cost1/schemas/labor-statement.schema';
import { OtherCost, OtherCostDocument } from '../other-cost/schemas/other-cost.schema';
import { FundingSource, FundingSourceDocument } from './schemas/funding-source.schema';
import { LoanContract, LoanContractDocument } from './schemas/loan-contract.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { COMPLETED_ORDER_STATUSES, PaymentStatus } from '../test-order2/constants/test-order2.constants';
import { AdGroupDailyReportService } from './ad-group-daily-report.service';
import { FinanceService } from './finance.service';
import { SupplierPayableService } from '../supplier-payable/supplier-payable.service';
import { AgentReceivableService } from '../agent-receivable/agent-receivable.service';
import { LaborStatementService } from '../labor-cost1/labor-statement.service';
import { OtherCostService } from '../other-cost/other-cost.service';
import { AdvertisingCostService } from '../advertising-cost/advertising-cost.service';
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
  DEFAULT_CONFIG,
} from './interfaces/financial-control.interface';

@Injectable()
export class FinancialControlService {
  private readonly logger = new Logger(FinancialControlService.name);
  private config: FinancialControlConfig = DEFAULT_CONFIG;

  // CFO Checklist #5: Track deprecated fallback usage for monitoring
  private deprecatedFallbackCounts = {
    labor: 0,
    ops: 0,
    agent: 0,
    supplier: 0,
  };

  // CFO Sign-off Condition #2: Cycle guard to prevent recursive calls
  private isCalculating = false;
  private calculationStartTime: Date | null = null;
  private pendingCalculation: Promise<FinancialControlFull> | null = null;
  private cachedResult: FinancialControlFull | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_TTL_MS = 30000; // Cache for 30 seconds - financial data doesn't need real-time

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
    // Inject các services để gọi summary APIs (CFO Spec v3.1)
    @Inject(forwardRef(() => SupplierPayableService))
    private readonly supplierService: SupplierPayableService,
    @Inject(forwardRef(() => AgentReceivableService))
    private readonly agentService: AgentReceivableService,
    @Inject(forwardRef(() => LaborStatementService))
    private readonly laborStatementService: LaborStatementService,
    @Inject(forwardRef(() => OtherCostService))
    private readonly otherCostService: OtherCostService,
    @Inject(forwardRef(() => AdvertisingCostService))
    private readonly adsCostService: AdvertisingCostService,
    // CFO Spec v3.1: Inject FinanceService for Debt summary
    @Inject(forwardRef(() => FinanceService))
    private readonly financeService: FinanceService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // MAIN API: Get Dashboard 8 Numbers
  // ═══════════════════════════════════════════════════════════

  async getDashboard(): Promise<FinancialControlDashboard> {
    const full = await this.getFullMetrics();
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
    };
  }

  // ═══════════════════════════════════════════════════════════
  // FULL METRICS
  // ═══════════════════════════════════════════════════════════

  async getFullMetrics(): Promise<FinancialControlFull> {
    // Check cache first (handles parallel calls efficiently)
    if (this.cachedResult && this.cacheExpiry && new Date() < this.cacheExpiry) {
      this.logger.debug('[CACHE_HIT] Returning cached getFullMetrics result');
      return this.cachedResult;
    }

    // If already calculating, wait for pending calculation instead of throwing
    if (this.isCalculating && this.pendingCalculation) {
      this.logger.debug('[WAITING] Waiting for pending getFullMetrics calculation');
      return this.pendingCalculation;
    }

    this.isCalculating = true;
    this.calculationStartTime = new Date();

    // Create the calculation promise
    this.pendingCalculation = this.doGetFullMetrics();

    try {
      const result = await this.pendingCalculation;
      // Cache the result
      this.cachedResult = result;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_TTL_MS);
      return result;
    } finally {
      this.isCalculating = false;
      this.pendingCalculation = null;
    }
  }

  private async doGetFullMetrics(): Promise<FinancialControlFull> {
    try {
      // Parallel fetch: Bank Balance, Committed Cash, Monthly Burn, Optimal Ads, Loan Summary
      const [bankBalance, committedBreakdown, monthlyBurnBreakdown, optimalSpendResult, loanSummaryResult] =
        await Promise.all([
          this.getBankBalance(),
          this.getCommittedCash(),
          this.getMonthlyBurn(),
          this.adGroupDailyReportService.getOptimalSpendSuggestions().catch((err) => {
            this.logger.warn('Failed to get optimal spend from AdGroupDailyReportService, using fallback');
            return null;
          }),
          this.financeService.getLoanSummary().catch((err) => {
            this.logger.warn('Failed to get loan summary, skipping');
            return null;
          }),
        ]);

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
        ? optimalSpendResult.totalSuggestedSpendWithCap * 7
        : 0;

      // 8. Ads Budget Approved
      const adsBudgetApproved = Math.min(optimalAdsSuggestion, availableAfterSurvival);

      // 9. Max Daily Ads
      // AdsBudgetApproved is a 7-day envelope, so normalize by 7 days for daily limit.
      const maxDailyAds = (adsBudgetApproved / 7) * this.config.SafetyFactor;

      // 10. Owner Withdrawable
      const ownerWithdrawable = Math.max(0, availableAfterSurvival - adsBudgetApproved);

      // 11. Forecast 7D (base-case: exclude ads spend)
      const forecast7D = await this.getForecast7D(bankBalance, 0, monthlyBurnBreakdown);

      // 12. Build aggregated alerts with source (CFO v3.1)
      const alerts = this.buildAggregatedAlerts(
        forecast7D,
        runwayStatus,
        monthlyBurnBreakdown,
        freeCash,
        monthlyBurn,
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
    // ═══════════════════════════════════════════════════════════
    // VỐN BAN ĐẦU (Capital)
    // ═══════════════════════════════════════════════════════════
    
    // 1. Vốn cá nhân từ FundingSource
    const personalCapital = await this.fundingSourceModel.aggregate([
      { $match: { type: 'personal_capital', isActive: true } },
      { $group: { _id: null, total: { $sum: '$initialAmount' } } },
    ]);
    const personalCapitalAmount = personalCapital[0]?.total || 0;

    // 2. Vốn vay ĐÃ GIẢI NGÂN từ LoanContract (chỉ tính tiền đã thực nhận)
    const loanDisbursed = await this.loanModel.aggregate([
      { $match: { status: { $ne: 'closed' }, disbursedAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$disbursedAmount' } } },
    ]);
    const loanDisbursedAmount = loanDisbursed[0]?.total || 0;

    // 3. Tiền đã trả nợ vay (gốc + lãi) - tính từ LoanContract
    const loanPaid = await this.loanModel.aggregate([
      { $match: { status: { $ne: 'closed' } } },
      { $group: { 
        _id: null, 
        totalPrincipal: { $sum: { $ifNull: ['$totalPrincipalPaid', 0] } },
        totalInterest: { $sum: { $ifNull: ['$totalInterestPaid', 0] } }
      } },
    ]);
    const loanPaidAmount = (loanPaid[0]?.totalPrincipal || 0) + (loanPaid[0]?.totalInterest || 0);

    const capital = personalCapitalAmount + loanDisbursedAmount - loanPaidAmount;

    // ═══════════════════════════════════════════════════════════
    // DOANH THU & CHI PHÍ
    // ═══════════════════════════════════════════════════════════

    // Doanh thu đã thu (NCC đã trả) - Fix #5: Exclude returns, subtract all costs
    const revenueResult = await this.orderModel.aggregate([
      { $match: { supplierPaymentStatus: 'paid' } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $subtract: [
                // Effective COD: 0 for returned orders, codAmount for delivered
                { $cond: [
                  { $in: ['$orderStatus', ['Hoàn', 'Boom', 'Từ chối nhận', 'Đổi trả']] },
                  0,
                  { $ifNull: ['$codAmount', 0] },
                ] },
                // Subtract: COGS + shipping + return fees + agent paid
                { $add: [
                  { $multiply: [{ $ifNull: ['$supplierAppliedPrice', 0] }, { $ifNull: ['$quantity', 1] }] },
                  { $ifNull: ['$shippingFee', 0] },
                  { $ifNull: ['$returnFee', 0] },
                  { $ifNull: ['$agentPaidAmount', 0] },
                ] },
              ],
            },
          },
        },
      },
    ]);
    const revenue = revenueResult[0]?.total || 0;

    // Chi phí ads đã chi
    const adsResult = await this.adsCostModel.aggregate([
      { $group: { _id: null, total: { $sum: '$spentAmount' } } },
    ]);
    const adsCost = adsResult[0]?.total || 0;

    // Lương đã trả
    const laborResult = await this.laborModel.aggregate([
      { $match: { status: 'closed' } },
      { $group: { _id: null, total: { $sum: '$statementPaymentTotal' } } },
    ]);
    const laborCost = laborResult[0]?.total || 0;

    // Chi phí vận hành đã trả
    const otherResult = await this.otherCostModel.aggregate([
      { $match: { isConfirmed: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const otherCost = otherResult[0]?.total || 0;

    // ═══════════════════════════════════════════════════════════
    // CASHFLOW ENTRIES (Owner Fund transfers, etc.)
    // - direction: 'out' = tiền ra khỏi Bank (VD: chuyển vào Owner Fund)
    // - direction: 'in' + sourceType != 'revenue' = tiền vào Bank (VD: Owner trả lại)
    // ═══════════════════════════════════════════════════════════
    const { cashflowOut, cashflowIn } = await this.financeService.getCashflowTotals();

    return capital + revenue - adsCost - laborCost - otherCost - cashflowOut + cashflowIn;
  }

  // ═══════════════════════════════════════════════════════════
  // COMMITTED CASH (14D Window) - Gọi từ summary APIs
  // ═══════════════════════════════════════════════════════════

  private async getCommittedCash(): Promise<CommittedCashBreakdown> {
    const windowDays = this.config.CommittedWindowDays;

    // CFO Sign-off Condition #1 & #3: Parallel calls với timeout
    const SUMMARY_TIMEOUT = 3000; // 3 seconds per summary call
    const timeoutErrors: string[] = [];

    const summaryPromises = {
      labor: this.withTimeout(
        this.laborStatementService.getCashflowSummary(windowDays),
        SUMMARY_TIMEOUT,
        'labor',
      ),
      ops: this.withTimeout(
        this.otherCostService.getCashflowSummary(windowDays),
        SUMMARY_TIMEOUT,
        'ops',
      ),
      agent: this.withTimeout(
        this.agentService.getCashflowSummary(windowDays),
        SUMMARY_TIMEOUT,
        'agent',
      ),
      debt: this.withTimeout(
        this.financeService.getDebtCashflowSummary(windowDays),
        SUMMARY_TIMEOUT,
        'debt',
      ),
    };

    const results = await Promise.allSettled([
      summaryPromises.labor,
      summaryPromises.ops,
      summaryPromises.agent,
      summaryPromises.debt,
    ]);

    // Extract values with fallback
    let labor = 0;
    let operations = 0;
    let agents = 0;
    let loanPayment = 0;

    // Labor
    if (results[0].status === 'fulfilled') {
      labor = results[0].value.totalPayrollDue14d;
    } else {
      this.logger.warn(`Failed to get labor summary: ${results[0].reason}`);
      if (results[0].reason?.message === 'TIMEOUT') {
        timeoutErrors.push('labor: TIMEOUT');
      }
      labor = await this.getCommittedLaborFallback(windowDays);
    }

    // Ops
    if (results[1].status === 'fulfilled') {
      operations = results[1].value.totalOpsDue14d;
    } else {
      this.logger.warn(`Failed to get ops summary: ${results[1].reason}`);
      if (results[1].reason?.message === 'TIMEOUT') {
        timeoutErrors.push('ops: TIMEOUT');
      }
      operations = await this.getCommittedOpsFallback(windowDays);
    }

    // Agent
    if (results[2].status === 'fulfilled') {
      agents = results[2].value.totalAgentDue14d;
    } else {
      this.logger.warn(`Failed to get agent summary: ${results[2].reason}`);
      if (results[2].reason?.message === 'TIMEOUT') {
        timeoutErrors.push('agent: TIMEOUT');
      }
      agents = await this.getCommittedAgentFallback();
    }

    // Debt
    if (results[3].status === 'fulfilled') {
      loanPayment = results[3].value.totalDebtDue14d;
    } else {
      this.logger.warn(`Failed to get debt summary: ${results[3].reason}`);
      if (results[3].reason?.message === 'TIMEOUT') {
        timeoutErrors.push('debt: TIMEOUT');
      }
      loanPayment = 0; // Safe fallback
    }

    // 4. Thuế (TODO: tạm = 0, cần module thuế)
    const tax = 0;

    const total = labor + operations + agents + tax + loanPayment;

    return {
      labor,
      operations,
      agents,
      tax,
      loanPayment,
      total,
      windowDays,
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
  // FALLBACK METHODS (DEPRECATED - Remove after summary APIs stable)
  // CFO Spec v3.1: These are only used when summary APIs fail
  // TODO: Remove after 2 weeks of stable operation
  // ═══════════════════════════════════════════════════════════

  /** @deprecated Use laborStatementService.getCashflowSummary() instead */
  private async getCommittedLaborFallback(windowDays: number): Promise<number> {
    this.deprecatedFallbackCounts.labor++;
    this.logger.warn(`[DEPRECATED] Using getCommittedLaborFallback - should use summary API (count: ${this.deprecatedFallbackCounts.labor})`);
    const today = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(today.getDate() + windowDays);

    const result = await this.laborModel.aggregate([
      {
        $match: {
          status: { $in: ['draft', 'open', 'approved'] },
          $or: [
            { dueDate: { $gte: today, $lte: windowEnd } },
            { dueDate: { $exists: false } },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: '$closingBalance' } } },
    ]);
    return Math.max(0, result[0]?.total || 0);
  }

  /** @deprecated Use otherCostService.getCashflowSummary() instead */
  private async getCommittedOpsFallback(windowDays: number): Promise<number> {
    this.deprecatedFallbackCounts.ops++;
    this.logger.warn(`[DEPRECATED] Using getCommittedOpsFallback - should use summary API (count: ${this.deprecatedFallbackCounts.ops})`);
    const today = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(today.getDate() + windowDays);

    const result = await this.otherCostModel.aggregate([
      {
        $match: {
          isConfirmed: { $ne: true },
          $or: [
            { dueDate: { $gte: today, $lte: windowEnd } },
            { dueDate: { $exists: false } },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  /** @deprecated Use agentService.getCashflowSummary() instead */
  private async getCommittedAgentFallback(): Promise<number> {
    this.deprecatedFallbackCounts.agent++;
    this.logger.warn(`[DEPRECATED] Using getCommittedAgentFallback - should use summary API (count: ${this.deprecatedFallbackCounts.agent})`);
    const result = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: 'Giao thành công',
          agentPaymentStatus: { $ne: 'paid' },
          agentQuote: { $gt: 0 },
        },
      },
      { 
        $group: { 
          _id: null, 
          total: { 
            $sum: { 
              $multiply: ['$agentQuote', { $ifNull: ['$quantity', 1] }] 
            } 
          } 
        } 
      },
    ]);
    return result[0]?.total || 0;
  }

  // ═══════════════════════════════════════════════════════════
  // MONTHLY BURN - business rule: exclude ads, include pending obligations
  // ═══════════════════════════════════════════════════════════

  private async getMonthlyBurn(): Promise<MonthlyBurnBreakdown> {
    const windowDays = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + windowDays);

    let laborCore = 0;
    let operationsMandatory = 0;
    let loanPayment = 0;
    let agentCommission = 0;
    let supplierPendingPayment = 0;
    let isEstimated = false;
    const estimationNotes: string[] = [];

    // 1) Payroll due in next 30 days
    try {
      const laborSummary = await this.laborStatementService.getCashflowSummary(windowDays);
      laborCore = Math.max(0, laborSummary.totalPayrollDue14d || 0);
    } catch (err) {
      this.logger.warn('[P2] Failed to get payroll due from summary, falling back to direct query');
      isEstimated = true;
      estimationNotes.push('payroll: fallback query');
      const laborResult = await this.laborModel.aggregate([
        {
          $match: {
            status: { $in: ['draft', 'open', 'approved'] },
            $or: [
              { dueDate: { $lte: windowEnd } },
              { dueDate: { $exists: false } },
            ],
          },
        },
        { $group: { _id: null, total: { $sum: '$closingBalance' } } },
      ]);
      laborCore = Math.max(0, laborResult[0]?.total || 0);
    }

    // 2) Mandatory operations due in next 30 days (exclude ads/marketing)
    try {
      const opsSummary = await this.otherCostService.getCashflowSummary(windowDays);
      operationsMandatory = (opsSummary.byCategory || [])
        .filter((item) => !this.isAdsCategory(item.category))
        .reduce((sum, item) => sum + (item.due14d || 0), 0);
    } catch (err) {
      this.logger.warn('[P2] Failed to get ops due from summary, falling back to direct query');
      isEstimated = true;
      estimationNotes.push('ops: fallback query');
      const opsResult = await this.otherCostModel.aggregate([
        {
          $match: {
            isConfirmed: { $ne: true },
            $and: [
              {
                $or: [
                  { dueDate: { $lte: windowEnd } },
                  { dueDate: { $exists: false } },
                ],
              },
              {
                $or: [
                  { category: { $exists: false } },
                  { category: { $not: /(ads|marketing|quang cao|quảng cáo)/i } },
                ],
              },
            ],
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      operationsMandatory = Math.max(0, opsResult[0]?.total || 0);
    }

    // 3) Debt due in next 30 days
    try {
      const debtSummary = await this.financeService.getDebtCashflowSummary(windowDays);
      loanPayment = Math.max(0, debtSummary.totalDebtDue14d || 0);
    } catch (err) {
      this.logger.warn('[P2] Failed to get debt due from summary, falling back to 0');
      isEstimated = true;
      estimationNotes.push('debt: unavailable');
      loanPayment = 0;
    }

    // 4) Agent commission pending payment (next 30 days)
    try {
      const agentSummary = await this.agentService.getCashflowSummary(windowDays);
      agentCommission = Math.max(0, agentSummary.totalAgentDue14d || 0);
    } catch (err) {
      this.logger.warn('[P2] Failed to get agent due from summary, falling back to direct query');
      isEstimated = true;
      estimationNotes.push('agent: fallback query');
      const agentFallback = await this.orderModel.aggregate([
        {
          $match: {
            orderStatus: { $in: [...COMPLETED_ORDER_STATUSES] },
            agentPaymentStatus: PaymentStatus.PENDING,
            agentQuote: { $gt: 0 },
            agentId: { $exists: true, $ne: null },
            isActive: { $ne: false },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$agentQuote', 0] },
                  { $ifNull: ['$quantity', 1] },
                ],
              },
            },
          },
        },
      ]);
      agentCommission = Math.max(0, agentFallback[0]?.total || 0);
    }

    // 5) Supplier pending payment
    try {
      supplierPendingPayment = await this.getPendingSupplierPaymentAmount();
    } catch (err) {
      this.logger.warn('[P2] Failed to get supplier pending payment');
      isEstimated = true;
      estimationNotes.push('supplier: unavailable');
      supplierPendingPayment = 0;
    }

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

  private async getPendingSupplierPaymentAmount(): Promise<number> {
    const result = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: { $in: [...COMPLETED_ORDER_STATUSES] },
          supplierPaymentStatus: PaymentStatus.PENDING,
          supplierId: { $exists: true, $ne: null },
          supplierQuote: { $gt: 0 },
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: [
                { $ifNull: ['$supplierQuote', 0] },
                { $ifNull: ['$quantity', 1] },
              ],
            },
          },
        },
      },
    ]);

    return Math.max(0, result[0]?.total || 0);
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
    const adGroups = await this.adGroupModel.find({ isActive: true });
    const results: AdGroupOptimalSpend[] = [];
    let cappedCount = 0;

    for (const adGroup of adGroups) {
      const result = await this.calculateAdGroupOptimal(adGroup);
      results.push(result);
      if (result.isCapped) cappedCount++;
    }

    const totalOptimalDaily = results.reduce((sum, r) => sum + r.optimalSuggested, 0);

    return {
      adGroups: results,
      totalOptimalDaily,
      totalOptimalWeekly: totalOptimalDaily * 7,
      cappedCount,
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
    if (!bankBalance) {
      bankBalance = await this.getBankBalance();
    }
    if (!dailyAds) {
      dailyAds = 0; // Default to 0 instead of recursive call
    }
    if (!monthlyBurnBreakdown) {
      monthlyBurnBreakdown = await this.getMonthlyBurn();
    }

    const survivalFloor = this.config.SurvivalMonths * monthlyBurnBreakdown.total;

    const expectedInflows: ExpectedInflowBreakdown[] = [];
    const expectedOutflows: ExpectedOutflowBreakdown[] = [];

    // Pre-populate outflow cache once before the loop
    await this.ensureOutflowCachePopulated();

    // Fetch all 7 days of inflows and outflows in parallel
    const dates: Date[] = [];
    for (let d = 1; d <= 7; d++) {
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

    for (let d = 0; d < 7; d++) {
      const inflow = inflowResults[d];
      const adjustedInflow = inflow.total * this.config.RiskAdjustInflow;
      expectedInflows.push({ ...inflow, adjustedTotal: adjustedInflow });

      const outflow = outflowResults[d];
      expectedOutflows.push(outflow);

      currentBalance = currentBalance + adjustedInflow - outflow.total;

      days.push({
        day: d + 1,
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

    return {
      days,
      lowPoint,
      lowPointDay,
      lowPointDate,
      isCashCrunch: lowPoint < 0,
      isSurvivalRisk: lowPoint < survivalFloor,
      endBalance: days[6]?.forecastBank || currentBalance,
      expectedInflows,
      expectedOutflows,
    };
  }

  // Cache for supplier expected inflows (CFO Spec v3.1)
  private supplierExpectedCache: Map<string, number> | null = null;
  private supplierCacheTimestamp: Date | null = null;

  // CFO Spec v3.1: Cache for expected outflows (dueByDay7d from summaries)
  private opsOutCache: Map<string, number> | null = null;
  private debtOutCache: Map<string, number> | null = null;
  private payrollOutCache: Map<string, number> | null = null; // CFO Spec v3.2: Fixed type
  private agentOutCache: Map<string, number> | null = null;
  private outflowCacheTimestamp: Date | null = null;

  private async getExpectedInflow(date: Date): Promise<ExpectedInflowBreakdown> {
    // 1. NCC dự kiến trả - lấy từ supplier summary (CFO Spec v3.1)
    let supplierPayments = 0;
    
    try {
      // Cache supplier expected inflows cho 5 phút
      const now = new Date();
      if (!this.supplierExpectedCache || 
          !this.supplierCacheTimestamp || 
          (now.getTime() - this.supplierCacheTimestamp.getTime()) > 5 * 60 * 1000) {
        
        const supplierSummary = await this.supplierService.getCashflowSummary();
        this.supplierExpectedCache = new Map();
        for (const dayData of supplierSummary.expectedInflowByDay) {
          // CFO Spec v3.1: Dùng netAmount (đã tính riskAdjustment + onTimeAdjustment)
          this.supplierExpectedCache.set(dayData.date, dayData.netAmount);
        }
        this.supplierCacheTimestamp = now;
      }
      
      const dateStr = date.toISOString().split('T')[0];
      supplierPayments = this.supplierExpectedCache.get(dateStr) || 0;
    } catch (err) {
      this.logger.warn('Failed to get supplier cashflow summary, falling back to direct query');
      supplierPayments = await this.estimateSupplierPaymentFallback(date);
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

  /** @deprecated Use supplierService.getCashflowSummary() instead */
  private async estimateSupplierPaymentFallback(date: Date): Promise<number> {
    this.deprecatedFallbackCounts.supplier++;
    this.logger.warn(`[DEPRECATED] Using estimateSupplierPaymentFallback - should use summary API (count: ${this.deprecatedFallbackCounts.supplier})`);
    // Fallback: Giả định NCC trả theo chu kỳ 10 ngày
    // Tìm các đơn giao thành công cách đây 7-10 ngày, chưa nhận tiền
    const cycleDays = this.config.SupplierCashCycleDays;
    const orderDate = new Date(date);
    orderDate.setDate(orderDate.getDate() - cycleDays);

    const result = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: 'Giao thành công',
          supplierPaymentStatus: { $ne: 'paid' },
          updatedAt: {
            $gte: new Date(orderDate.setHours(0, 0, 0, 0)),
            $lte: new Date(orderDate.setHours(23, 59, 59, 999)),
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $subtract: [
                { $ifNull: ['$codAmount', 0] },
                { $multiply: [{ $ifNull: ['$supplierAppliedPrice', 0] }, { $ifNull: ['$quantity', 1] }] },
              ],
            },
          },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  private async getExpectedOutflow(date: Date, dailyAds: number): Promise<ExpectedOutflowBreakdown> {
    const dateStr = new Date(date).toISOString().split('T')[0];

    // CFO Spec v3.1: Use cached dueByDay7d from summaries (Hard Out only)
    // Ads is Soft Out (proxy) - not used for cash crunch conclusion
    const adsDaily = dailyAds;

    // Ensure outflow cache is populated
    await this.ensureOutflowCachePopulated();

    // 1. Operations - from ops summary dueByDay7d
    const operations = this.opsOutCache?.get(dateStr) || 0;

    // 2. Debt - from debt summary dueByDay7d
    const loanPayment = this.debtOutCache?.get(dateStr) || 0;

    // 3. Payroll - CFO Spec v3.2: Use dueByDay7d from labor summary (cached)
    const labor = this.payrollOutCache?.get(dateStr) || 0;

    // 4. Agent - from cached byAgent.nextDueDate (Fix #6: use cache, no per-day API call)
    const agents = this.agentOutCache?.get(dateStr) || 0;

    // 5. Tax (TODO)
    const tax = 0;

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
   * CFO Spec v3.1: Populate outflow cache from summaries
   * Cache ops.dueByDay7d and debt.dueByDay7d
   */
  private async ensureOutflowCachePopulated(): Promise<void> {
    const now = new Date();
    // Cache for 5 minutes
    if (this.outflowCacheTimestamp && 
        (now.getTime() - this.outflowCacheTimestamp.getTime()) < 5 * 60 * 1000) {
      return;
    }

    // Populate ops cache
    try {
      const opsSummary = await this.otherCostService.getCashflowSummary(7);
      this.opsOutCache = new Map();
      for (const day of opsSummary.dueByDay7d || []) {
        this.opsOutCache.set(day.date, day.amount);
      }
    } catch (err) {
      this.logger.warn('[P1] Failed to cache ops dueByDay7d');
      this.opsOutCache = new Map();
    }

    // Populate debt cache
    try {
      const debtSummary = await this.financeService.getDebtCashflowSummary(7);
      this.debtOutCache = new Map();
      for (const day of debtSummary.dueByDay7d || []) {
        this.debtOutCache.set(day.date, day.amount);
      }
    } catch (err) {
      this.logger.warn('[P1] Failed to cache debt dueByDay7d');
      this.debtOutCache = new Map();
    }

    // Populate payroll cache (CFO Spec v3.2)
    try {
      const laborSummary = await this.laborStatementService.getCashflowSummary(7);
      this.payrollOutCache = new Map();
      for (const day of laborSummary.dueByDay7d || []) {
        this.payrollOutCache.set(day.date, day.amount);
      }
    } catch (err) {
      this.logger.warn('[P1] Failed to cache payroll dueByDay7d');
      this.payrollOutCache = new Map();
    }

    // Populate agent cache (Fix #6: avoid 7x redundant calls in forecast loop)
    try {
      const agentSummary = await this.agentService.getCashflowSummary(7);
      this.agentOutCache = new Map();
      for (const agent of agentSummary.byAgent || []) {
        if (agent.nextDueDate && agent.unpaid) {
          const existing = this.agentOutCache.get(agent.nextDueDate) || 0;
          this.agentOutCache.set(agent.nextDueDate, existing + agent.unpaid);
        }
      }
    } catch (err) {
      this.logger.warn('[P1] Failed to cache agent outflows');
      this.agentOutCache = new Map();
    }

    this.outflowCacheTimestamp = now;
  }

  private getNoteForDay(date: Date, outflow: ExpectedOutflowBreakdown): string | undefined {
    const notes: string[] = [];
    if (outflow.labor > 0) notes.push('Trả lương');
    if (outflow.loanPayment > 0) notes.push('Trả nợ');
    if (outflow.operations > 0) notes.push('Vận hành');
    return notes.length > 0 ? notes.join(', ') : undefined;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private getRunwayStatus(months: number | null): 'safe' | 'ok' | 'warning' | 'danger' {
    if (months === null) return 'safe'; // Infinite runway
    if (months >= 6) return 'safe';
    if (months >= 3) return 'ok';
    if (months >= 1) return 'warning';
    return 'danger';
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

    // Module alerts will be collected from cached summaries
    // (Could extend to read alerts from module summaries if available)

    return alerts;
  }

  // Update config
  updateConfig(config: Partial<FinancialControlConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): FinancialControlConfig {
    return { ...this.config };
  }

  /**
   * CFO Checklist #5: Get deprecation stats for monitoring
   * Target removal: 2026-02-17
   */
  getDeprecationStats() {
    return {
      ...this.deprecatedFallbackCounts,
      total: Object.values(this.deprecatedFallbackCounts).reduce((a, b) => a + b, 0),
      targetRemovalDate: '2026-02-17',
      message: this.deprecatedFallbackCounts.labor === 0 && 
               this.deprecatedFallbackCounts.ops === 0 &&
               this.deprecatedFallbackCounts.agent === 0 &&
               this.deprecatedFallbackCounts.supplier === 0
        ? 'All summary APIs working correctly, fallbacks not used'
        : 'Some fallbacks were used - investigate summary API issues',
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE HEALTH STATUS (CFO v3.2)
  // ═══════════════════════════════════════════════════════════

  async getModuleHealth(): Promise<{
    overall: 'ok' | 'partial' | 'error';
    modules: Record<string, { status: 'ok' | 'partial' | 'error' | 'timeout'; lastUpdated: Date | null; error?: string; dataCount?: number }>;
    timestamp: Date;
  }> {
    const HEALTH_CHECK_TIMEOUT = 2000;
    const modules: Record<string, { status: 'ok' | 'partial' | 'error' | 'timeout'; lastUpdated: Date | null; error?: string; dataCount?: number }> = {};

    // Check each module
    const checks = [
      { name: 'labor', check: () => this.laborStatementService.getCashflowSummary(14) },
      { name: 'operations', check: () => this.otherCostService.getCashflowSummary(14) },
      { name: 'agent', check: () => this.agentService.getCashflowSummary(14) },
      { name: 'debt', check: () => this.financeService.getDebtCashflowSummary(14) },
      { name: 'supplier', check: () => this.supplierService.getCashflowSummary() },
      { name: 'ads', check: () => this.adGroupDailyReportService.getOptimalSpendSuggestions() },
    ];

    for (const { name, check } of checks) {
      try {
        const result = await Promise.race([
          check(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), HEALTH_CHECK_TIMEOUT)),
        ]);
        modules[name] = {
          status: 'ok',
          lastUpdated: new Date(),
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

    // Tax module - simplified check
    modules['tax'] = { status: 'ok', lastUpdated: new Date(), dataCount: 0 };

    // Calculate overall status
    const statuses = Object.values(modules).map(m => m.status);
    let overall: 'ok' | 'partial' | 'error' = 'ok';
    if (statuses.some(s => s === 'error' || s === 'timeout')) {
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
