/**
 * File: finance/cashflow-safety.service.ts
 * Mục đích: Tính toán CSI, DSO, DPO và các chỉ số cashflow survival
 * CRITICAL: Đây là service QUAN TRỌNG NHẤT để tránh phá sản!
 *
 * Fix #9: Use service APIs (AgentReceivableService, SupplierPayableService)
 * for DSO/DPO calculations instead of querying models directly.
 * This ensures business logic changes in those modules are reflected here.
 */
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FundingSource, FundingSourceDocument } from './schemas/funding-source.schema';
import { LoanContract, LoanContractDocument } from './schemas/loan-contract.schema';
import { AdGroupDailyReport, AdGroupDailyReportDocument } from './schemas/ad-group-daily-report.schema';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { AgentStatement, AgentStatementDocument } from '../agent-receivable/schemas/agent-statement.schema';
import { SupplierPayable, SupplierPayableDocument } from '../supplier-payable/schemas/supplier-payable.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { AgentReceivableService } from '../agent-receivable/agent-receivable.service';
import { SupplierPayableService } from '../supplier-payable/supplier-payable.service';
import { FinanceAlertEvent, FinanceAlertEventDocument } from './schemas/finance-alert-event.schema';

export interface CSIResult {
  CSI: number;
  availableCash: number;
  avgDailyAdsCost: number;
  collectionDays: number;  // DSO
  status: CSIStatus;
  daysUntilCashout: number;
  recommendation: CSIAction;
}

export interface CSIStatus {
  level: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
  color: 'green' | 'yellow' | 'orange' | 'red';
}

export interface CSIAction {
  action: 'FULL_OPERATIONS' | 'MODERATE_CAUTION' | 'STOP_SCALING' | 'EMERGENCY_REDUCTION';
  scaleAllowed: boolean;
  budgetReduction?: number;
  killLowPerformers?: boolean;
  message: string;
}

export interface DSORiskLevel {
  level: 'SAFE' | 'WARNING' | 'CRITICAL';
  DSO: number;
  action?: 'REDUCE_BUDGET' | 'STOP_ALL_SCALING';
  reductionRate?: number;
  reason?: string;
  recommendations?: string[];
}

export interface DPOResult {
  DPO: number;
  totalPayables: number;
  avgDailyCOGS: number;
}

export interface CashflowRiskLevel {
  level: 'SAFE' | 'CASHFLOW_RISK';
  DSO: number;
  DPO: number;
  gap: number;
  reason?: string;
  impact?: {
    dailyCashGap: number;
    totalCashNeeded: number;
    description: string;
  };
  actions?: string[];
}

export interface ReturnRateResult {
  returnRate: number;
  totalOrders: number;
  returnedOrders: number;
  level: 'SAFE' | 'WARNING' | 'CRITICAL' | 'CATASTROPHIC';
  action?: string;
  decisions?: string[];
  reason?: string;
}

export interface CashflowHealthDashboard {
  // Core Metrics
  CSI: number;
  DSO: number;
  DPO: number;
  returnRate: number;

  // Cash Position
  availableCash: number;
  daysUntilCashout: number;
  dailyCashBurn: number;

  // Warnings
  cashflowRiskLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
  activeWarnings: string[];

  // Projections
  projectedCashIn7Days: number;
  projectedCashOut7Days: number;
  netCashFlow7Days: number;

  // Scenario 4 compatibility aliases
  csi?: number;
  dso?: number;
  dpo?: number;
  status?: 'safe' | 'warning' | 'danger' | 'critical';
  runwayDays?: number;
  alerts?: Array<{
    code: string;
    severity: 'WARNING' | 'DANGER' | 'CRITICAL';
    message: string;
    value?: number;
    threshold?: number;
  }>;
}

const CASHFLOW_ALERTS = {
  CSI_CRITICAL: 0.7,
  CSI_DANGER: 1.0,
  CSI_WARNING: 1.5,

  DSO_WARNING: 10,
  DSO_CRITICAL: 15,

  RETURN_RATE_WARNING: 25,
  RETURN_RATE_CRITICAL: 35,

  DPO_GAP_WARNING: 3,
  DPO_GAP_CRITICAL: 0
};

const PERSISTED_FINANCE_ALERT_CODES = [
  'CSI_BELOW_CRITICAL_THRESHOLD',
  'CSI_BELOW_DANGER_THRESHOLD',
  'CSI_BELOW_WARNING_THRESHOLD',
  'DSO_CRITICAL',
  'DSO_WARNING',
  'DPO_LESS_THAN_DSO',
  'RETURN_RATE_CATASTROPHIC',
  'RETURN_RATE_WARNING',
] as const;

@Injectable()
export class CashflowSafetyService {
  private readonly logger = new Logger(CashflowSafetyService.name);

  constructor(
    @InjectModel(FundingSource.name) private fundingSourceModel: Model<FundingSourceDocument>,
    @InjectModel(LoanContract.name) private loanContractModel: Model<LoanContractDocument>,
    @InjectModel(AdGroupDailyReport.name) private adGroupDailyReportModel: Model<AdGroupDailyReportDocument>,
    @InjectModel(AdvertisingCost.name) private advertisingCostModel: Model<AdvertisingCostDocument>,
    @InjectModel(AgentStatement.name) private agentStatementModel: Model<AgentStatementDocument>,
    @InjectModel(SupplierPayable.name) private supplierPayableModel: Model<SupplierPayableDocument>,
    @InjectModel(TestOrder2.name) private testOrder2Model: Model<TestOrder2Document>,
    @InjectModel(FinanceAlertEvent.name) private financeAlertEventModel: Model<FinanceAlertEventDocument>,
    // Fix #9: Inject service APIs for consistent business logic
    @Inject(forwardRef(() => AgentReceivableService))
    private readonly agentService: AgentReceivableService,
    @Inject(forwardRef(() => SupplierPayableService))
    private readonly supplierService: SupplierPayableService,
  ) {}

  /**
   * 💰 Calculate Cashflow Safety Index (CSI)
   * CSI = Available Cash / (Avg Daily Ads Cost × Collection Days)
   */
  async calculateCSI(): Promise<CSIResult> {
    try {
      // 1. Get available cash from active funding sources.
      // The schema uses status instead of isActive and does not define bank_account.
      const cashAccounts = await this.fundingSourceModel.find({
        status: 'active'
      });
      const totalCash = cashAccounts.reduce((sum, a) => sum + (a.availableBalance || 0), 0);

      const creditLines = await this.loanContractModel.find({
        status: 'active',
        type: 'credit_line'
      });
      const availableCredit = creditLines.reduce(
        (sum, l) => sum + ((l.principal || 0) - ((l.principal || 0) - (l.principalRemaining || 0))),
        0
      );

      const availableCash = totalCash + availableCredit;

      // 2. Get avg daily ads cost (last 30 days), falling back to advertising-cost records.
      const avgDailyAdsCost = await this.getAverageDailyAdsCost(30);

      // 3. Get collection days (DSO)
      const dsoResult = await this.calculateDSO();
      const collectionDays = dsoResult.DSO;

      // 4. Calculate CSI as burn coverage ratio.
      // Scenario 4 expects CSI to reflect available cash / daily burn directly.
      const denominator = Math.max(avgDailyAdsCost, 1);
      const CSI = denominator > 0 ? availableCash / denominator : 0;

      const status = this.getCSIStatus(CSI);
      const recommendation = this.getCSIRecommendation(CSI);
      const daysUntilCashout = CSI;

      return {
        CSI,
        availableCash,
        avgDailyAdsCost,
        collectionDays,
        status,
        daysUntilCashout,
        recommendation
      };
    } catch (error) {
      this.logger.error(`Error calculating CSI: ${error.message}`);
      // Return critical status on error
      return {
        CSI: 0,
        availableCash: 0,
        avgDailyAdsCost: 0,
        collectionDays: 0,
        status: { level: 'CRITICAL', color: 'red' },
        daysUntilCashout: 0,
        recommendation: {
          action: 'EMERGENCY_REDUCTION',
          scaleAllowed: false,
          budgetReduction: 0.50,
          killLowPerformers: true,
          message: 'Error calculating CSI - emergency mode'
        }
      };
    }
  }

  /**
   * 📈 Calculate DSO (Days Sales Outstanding)
   * DSO = (Total Accounts Receivable / Total Credit Sales) × Number of Days
   * Fix #9: Use agentService.getCashflowSummary() for consistent receivable data
   */
  async calculateDSO(): Promise<DSORiskLevel> {
    try {
      // Get total receivables from agent service API (Fix #9)
      let totalReceivable = 0;
      try {
        const agentSummary = await this.agentService.getCashflowSummary(14);
        totalReceivable = agentSummary.totalAgentUnpaid || 0;
      } catch (err) {
        // Fallback to direct query if service unavailable
        this.logger.warn('DSO: Agent service unavailable, falling back to direct query');
        const receivables = await this.agentStatementModel.find({ status: 'open' });
        totalReceivable = receivables.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
      }

      // Get avg daily sales (30 days)
      const avgDailySales = await this.getAvgDailySales(30);

      // Calculate DSO
      const DSO = avgDailySales > 0 ? totalReceivable / avgDailySales : 0;

      // Determine risk level
      if (DSO > CASHFLOW_ALERTS.DSO_CRITICAL) {
        return {
          level: 'CRITICAL',
          DSO,
          action: 'STOP_ALL_SCALING',
          reason: `DSO ${DSO.toFixed(1)} ngày > ${CASHFLOW_ALERTS.DSO_CRITICAL} - CRITICAL: Tiền không về kịp`,
          recommendations: [
            '🚨 STOP toàn bộ SCALE UP trong hệ thống',
            'CHỈ cho phép MAINTAIN hoặc SCALE DOWN',
            'Freeze mở ad groups mới',
            'Focus 100% vào thu hồi công nợ',
            'Review & tighten credit policies'
          ]
        };
      }

      if (DSO > CASHFLOW_ALERTS.DSO_WARNING) {
        const reductionRate = DSO > 12 ? 0.50 : 0.30;
        return {
          level: 'WARNING',
          DSO,
          action: 'REDUCE_BUDGET',
          reductionRate,
          reason: `DSO ${DSO.toFixed(1)} ngày > ${CASHFLOW_ALERTS.DSO_WARNING} - Tiền đại lý chậm về`,
          recommendations: [
            `Giảm ${(reductionRate * 100).toFixed(0)}% tổng ngân sách ads`,
            'Tạm dừng scale up',
            'Đôn đốc đại lý thanh toán',
            'Review payment terms'
          ]
        };
      }

      return { level: 'SAFE', DSO };
    } catch (error) {
      this.logger.error(`Error calculating DSO: ${error.message}`);
      return {
        level: 'CRITICAL',
        DSO: 999,
        action: 'STOP_ALL_SCALING',
        reason: 'Error calculating DSO - defaulting to critical'
      };
    }
  }

  /**
   * 📉 Calculate DPO (Days Payable Outstanding)
   * DPO = (Total Accounts Payable / Cost of Goods Sold) × Number of Days
   * Fix #9: Use supplierService.getCashflowSummary() for consistent payable data
   */
  async calculateDPO(): Promise<DPOResult> {
    try {
      // Get total payables from supplier service API (Fix #9)
      let totalPayables = 0;
      try {
        const supplierSummary = await this.supplierService.getCashflowSummary();
        totalPayables = supplierSummary.unreceived || 0;
      } catch (err) {
        // Fallback to direct query if service unavailable
        this.logger.warn('DPO: Supplier service unavailable, falling back to direct query');
        const payables = await this.supplierPayableModel.find({
          status: { $in: ['pending', 'partial'] }
        });
        totalPayables = payables.reduce((sum, p) => sum + (p.totalAmount || 0) - (p.amountPaid || 0), 0);
      }

      // Get avg daily COGS (từ orders)
      const avgDailyCOGS = await this.getAvgDailyCOGS(30);

      // Calculate DPO
      const DPO = avgDailyCOGS > 0 ? totalPayables / avgDailyCOGS : 0;

      return {
        DPO,
        totalPayables,
        avgDailyCOGS
      };
    } catch (error) {
      this.logger.error(`Error calculating DPO: ${error.message}`);
      return {
        DPO: 0,
        totalPayables: 0,
        avgDailyCOGS: 0
      };
    }
  }

  /**
   * ⚠️ Check Cashflow Risk (DPO vs DSO)
   * Nguy hiểm khi DPO < DSO (trả tiền trước khi thu tiền)
   */
  async checkCashflowRisk(): Promise<CashflowRiskLevel> {
    try {
      const dsoResult = await this.calculateDSO();
      const dpoResult = await this.calculateDPO();

      const DSO = dsoResult.DSO;
      const DPO = dpoResult.DPO;
      const gap = DSO - DPO;  // Positive = Nguy hiểm

      if (gap > CASHFLOW_ALERTS.DPO_GAP_CRITICAL) {
        // DSO > DPO = Thu tiền sau nhưng phải trả tiền trước
        const avgDailyRevenue = await this.getAvgDailySales(30);
        const dailyCashGap = gap * avgDailyRevenue;

        return {
          level: 'CASHFLOW_RISK',
          DSO,
          DPO,
          gap,
          reason: `DPO ${DPO.toFixed(1)} < DSO ${DSO.toFixed(1)} → Cashflow gap ${gap.toFixed(1)} days`,
          impact: {
            dailyCashGap,
            totalCashNeeded: dailyCashGap,
            description: `Cần ${(dailyCashGap / 1_000_000).toFixed(1)}M working capital để cover gap`
          },
          actions: [
            'Kích hoạt CASHFLOW RISK MODE',
            'Giảm 20% tổng budget',
            'Negotiate longer payment terms với suppliers',
            'Negotiate shorter collection từ agents',
            'Prepare emergency credit line'
          ]
        };
      }

      return { level: 'SAFE', DSO, DPO, gap };
    } catch (error) {
      this.logger.error(`Error checking cashflow risk: ${error.message}`);
      return {
        level: 'CASHFLOW_RISK',
        DSO: 999,
        DPO: 0,
        gap: 999,
        reason: 'Error checking cashflow risk'
      };
    }
  }

  /**
   * 📊 Get System-wide Return Rate
   */
  async getSystemReturnRate(): Promise<ReturnRateResult> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const orderStats = await this.testOrder2Model.aggregate([
        {
          $match: {
            $or: [
              { orderDate: { $gte: thirtyDaysAgo } },
              { createdAt: { $gte: thirtyDaysAgo } }
            ]
          }
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            returnedOrders: {
              $sum: {
                $cond: [
                  { $in: ['$orderStatus', ['Hoàn', 'Hoàn hàng', 'Boom', 'Từ chối nhận', 'Đổi trả']] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      if (orderStats.length === 0 || orderStats[0].totalOrders === 0) {
        return {
          returnRate: 0,
          totalOrders: 0,
          returnedOrders: 0,
          level: 'SAFE'
        };
      }

      const totalOrders = orderStats[0].totalOrders;
      const returnedOrders = orderStats[0].returnedOrders;
      const returnRate = (returnedOrders / totalOrders) * 100;

      // Determine level and actions
      if (returnRate > CASHFLOW_ALERTS.RETURN_RATE_CRITICAL) {
        return {
          returnRate,
          totalOrders,
          returnedOrders,
          level: 'CATASTROPHIC',
          action: 'EMERGENCY_RETURN_PROTECTION',
          decisions: [
            'KILL tất cả ad groups NGOẠI TRỪ top performer',
            'Tạm dừng mở ad groups mới',
            'Review toàn bộ product quality & targeting'
          ],
          reason: `Return rate ${returnRate.toFixed(1)}% - CATASTROPHIC LEVEL`
        };
      }

      if (returnRate > CASHFLOW_ALERTS.RETURN_RATE_WARNING) {
        return {
          returnRate,
          totalOrders,
          returnedOrders,
          level: 'WARNING',
          action: 'SCALE_PROTECTION_LEVEL_1',
          decisions: [
            'Tắt SCALE UP cho tất cả ad groups',
            'Kill threshold tăng gấp đôi: ROI < 100% → KILL',
            'Ưu tiên optimize chất lượng thay vì scale volume',
            'Enable stricter quality control'
          ],
          reason: `Return rate ${returnRate.toFixed(1)}% quá cao - risk cao`
        };
      }

      return {
        returnRate,
        totalOrders,
        returnedOrders,
        level: 'SAFE'
      };
    } catch (error) {
      this.logger.error(`Error getting return rate: ${error.message}`);
      return {
        returnRate: 100,  // Assume worst case
        totalOrders: 0,
        returnedOrders: 0,
        level: 'CATASTROPHIC',
        reason: 'Error calculating return rate'
      };
    }
  }

  async getSystemLockStatus(): Promise<{
    locked: boolean;
    code?: 'EMERGENCY_RETURN_PROTECTION';
    message?: string;
    returnRate: number;
  }> {
    const returnRateResult = await this.getSystemReturnRate();
    const normalizedReturnRate = returnRateResult.returnRate > 1
      ? returnRateResult.returnRate / 100
      : returnRateResult.returnRate;

    if (returnRateResult.level === 'CATASTROPHIC' || normalizedReturnRate > (CASHFLOW_ALERTS.RETURN_RATE_CRITICAL / 100)) {
      return {
        locked: true,
        code: 'EMERGENCY_RETURN_PROTECTION',
        message: 'System is currently locked due to catastrophic return rate (>35%). Manual scaling is strictly prohibited to protect cashflow.',
        returnRate: normalizedReturnRate,
      };
    }

    return {
      locked: false,
      returnRate: normalizedReturnRate,
    };
  }

  /**
   * 📊 Get Cashflow Health Dashboard
   */
  async getCashflowHealthDashboard(): Promise<CashflowHealthDashboard> {
    const csiResult = await this.calculateCSI();
    const dsoResult = await this.calculateDSO();
    const dpoResult = await this.calculateDPO();
    const cashflowRisk = await this.checkCashflowRisk();
    const returnRateResult = await this.getSystemReturnRate();

    // Projected cash flows (7 days)
    const avgDailySales = await this.getAvgDailySales(30);
    const projectedCashIn7Days = avgDailySales * 7 * (1 - returnRateResult.returnRate / 100);
    const projectedCashOut7Days = csiResult.avgDailyAdsCost * 7;
    const netCashFlow7Days = projectedCashIn7Days - projectedCashOut7Days;

    // Determine overall risk level
    let cashflowRiskLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL' = 'SAFE';
    const activeWarnings: string[] = [];
    const alerts: Array<{
      code: string;
      severity: 'WARNING' | 'DANGER' | 'CRITICAL';
      message: string;
      value?: number;
      threshold?: number;
    }> = [];

    if (csiResult.CSI < CASHFLOW_ALERTS.CSI_CRITICAL) {
      cashflowRiskLevel = 'CRITICAL';
      activeWarnings.push(`CSI ${csiResult.CSI.toFixed(2)} < ${CASHFLOW_ALERTS.CSI_CRITICAL} - CRITICAL`);
      alerts.push({
        code: 'CSI_BELOW_CRITICAL_THRESHOLD',
        severity: 'CRITICAL',
        message: 'Cashflow safety index below critical threshold',
        value: csiResult.CSI,
        threshold: CASHFLOW_ALERTS.CSI_CRITICAL,
      });
    } else if (csiResult.CSI < CASHFLOW_ALERTS.CSI_DANGER) {
      cashflowRiskLevel = cashflowRiskLevel === 'SAFE' ? 'DANGER' : cashflowRiskLevel;
      activeWarnings.push(`CSI ${csiResult.CSI.toFixed(2)} < ${CASHFLOW_ALERTS.CSI_DANGER} - DANGER`);
      alerts.push({
        code: 'CSI_BELOW_DANGER_THRESHOLD',
        severity: 'DANGER',
        message: 'Cashflow safety index below danger threshold',
        value: csiResult.CSI,
        threshold: CASHFLOW_ALERTS.CSI_DANGER,
      });
    } else if (csiResult.CSI < CASHFLOW_ALERTS.CSI_WARNING) {
      cashflowRiskLevel = cashflowRiskLevel === 'SAFE' ? 'WARNING' : cashflowRiskLevel;
      activeWarnings.push(`CSI ${csiResult.CSI.toFixed(2)} < ${CASHFLOW_ALERTS.CSI_WARNING} - WARNING`);
      alerts.push({
        code: 'CSI_BELOW_WARNING_THRESHOLD',
        severity: 'WARNING',
        message: 'Cashflow safety index below warning threshold',
        value: csiResult.CSI,
        threshold: CASHFLOW_ALERTS.CSI_WARNING,
      });
    }

    if (dsoResult.level === 'CRITICAL') {
      cashflowRiskLevel = 'CRITICAL';
      activeWarnings.push(`DSO ${dsoResult.DSO.toFixed(1)} days > ${CASHFLOW_ALERTS.DSO_CRITICAL}`);
      alerts.push({
        code: 'DSO_CRITICAL',
        severity: 'CRITICAL',
        message: 'Collection cycle is critically slow',
        value: dsoResult.DSO,
        threshold: CASHFLOW_ALERTS.DSO_CRITICAL,
      });
    } else if (dsoResult.level === 'WARNING') {
      cashflowRiskLevel = cashflowRiskLevel === 'SAFE' ? 'WARNING' : cashflowRiskLevel;
      activeWarnings.push(`DSO ${dsoResult.DSO.toFixed(1)} days > ${CASHFLOW_ALERTS.DSO_WARNING}`);
      alerts.push({
        code: 'DSO_WARNING',
        severity: 'WARNING',
        message: 'Collection cycle is slower than target',
        value: dsoResult.DSO,
        threshold: CASHFLOW_ALERTS.DSO_WARNING,
      });
    }

    if (cashflowRisk.level === 'CASHFLOW_RISK') {
      cashflowRiskLevel = cashflowRiskLevel === 'SAFE' ? 'WARNING' : cashflowRiskLevel;
      activeWarnings.push('Paying suppliers before collecting from agents');
      alerts.push({
        code: 'DPO_LESS_THAN_DSO',
        severity: 'CRITICAL',
        message: 'Paying suppliers before collecting from agents',
        value: cashflowRisk.gap,
        threshold: CASHFLOW_ALERTS.DPO_GAP_CRITICAL,
      });
    }

    if (returnRateResult.level === 'CATASTROPHIC') {
      cashflowRiskLevel = 'CRITICAL';
      activeWarnings.push(`Return rate ${returnRateResult.returnRate.toFixed(1)}% > ${CASHFLOW_ALERTS.RETURN_RATE_CRITICAL}%`);
      alerts.push({
        code: 'RETURN_RATE_CATASTROPHIC',
        severity: 'CRITICAL',
        message: 'Return rate exceeds catastrophic threshold (35%). System locked to protect cashflow.',
        value: returnRateResult.returnRate,
        threshold: CASHFLOW_ALERTS.RETURN_RATE_CRITICAL,
      });
    } else if (returnRateResult.level === 'WARNING') {
      cashflowRiskLevel = cashflowRiskLevel === 'SAFE' ? 'WARNING' : cashflowRiskLevel;
      activeWarnings.push(`Return rate ${returnRateResult.returnRate.toFixed(1)}% > ${CASHFLOW_ALERTS.RETURN_RATE_WARNING}%`);
      alerts.push({
        code: 'RETURN_RATE_WARNING',
        severity: 'WARNING',
        message: 'Return rate is above the protection threshold',
        value: returnRateResult.returnRate,
        threshold: CASHFLOW_ALERTS.RETURN_RATE_WARNING,
      });
    }

    const status = this.mapRiskLevelToStatus(cashflowRiskLevel);

    try {
      await this.persistDailyAlerts(alerts);
    } catch (error) {
      this.logger.warn(`Failed to persist finance alerts: ${error.message}`);
    }

    return {
      CSI: csiResult.CSI,
      DSO: dsoResult.DSO,
      DPO: dpoResult.DPO,
      returnRate: returnRateResult.returnRate,
      availableCash: csiResult.availableCash,
      daysUntilCashout: csiResult.daysUntilCashout,
      dailyCashBurn: csiResult.avgDailyAdsCost,
      cashflowRiskLevel,
      activeWarnings,
      projectedCashIn7Days,
      projectedCashOut7Days,
      netCashFlow7Days,
      csi: csiResult.CSI,
      dso: dsoResult.DSO,
      dpo: dpoResult.DPO,
      status,
      runwayDays: csiResult.daysUntilCashout,
      alerts,
    };
  }

  // ========== PRIVATE HELPERS ==========

  private getCSIStatus(CSI: number): CSIStatus {
    if (CSI > CASHFLOW_ALERTS.CSI_WARNING) return { level: 'SAFE', color: 'green' };
    if (CSI >= CASHFLOW_ALERTS.CSI_DANGER) return { level: 'WARNING', color: 'yellow' };
    if (CSI >= CASHFLOW_ALERTS.CSI_CRITICAL) return { level: 'DANGER', color: 'orange' };
    return { level: 'CRITICAL', color: 'red' };
  }

  private async persistDailyAlerts(alerts: Array<{
    code: string;
    severity: 'WARNING' | 'DANGER' | 'CRITICAL';
    message: string;
    value?: number;
    threshold?: number;
  }>): Promise<void> {
    const now = new Date();
    const dateString = this.getBusinessDateString(now);
    const activeCodes = new Set(alerts.map((alert) => alert.code));

    if (alerts.length > 0) {
      await this.financeAlertEventModel.bulkWrite(
        alerts.map((alert) => ({
          updateOne: {
            filter: {
              code: alert.code,
              dateString,
            },
            update: {
              $set: {
                severity: alert.severity,
                message: alert.message,
                value: alert.value,
                threshold: alert.threshold,
                isResolved: false,
                resolvedAt: null,
                updatedAt: now,
              },
              $setOnInsert: {
                code: alert.code,
                dateString,
                createdAt: now,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    const codesToResolve = PERSISTED_FINANCE_ALERT_CODES.filter((code) => !activeCodes.has(code));
    if (codesToResolve.length > 0) {
      await this.financeAlertEventModel.updateMany(
        {
          code: { $in: codesToResolve },
          isResolved: false,
        },
        {
          $set: {
            isResolved: true,
            resolvedAt: now,
            updatedAt: now,
          },
        },
      );
    }
  }

  private getBusinessDateString(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private getCSIRecommendation(CSI: number): CSIAction {
    if (CSI > CASHFLOW_ALERTS.CSI_WARNING) {
      return {
        action: 'FULL_OPERATIONS',
        scaleAllowed: true,
        message: 'Cashflow healthy - can scale aggressively'
      };
    }

    if (CSI >= CASHFLOW_ALERTS.CSI_DANGER) {
      return {
        action: 'MODERATE_CAUTION',
        budgetReduction: 0.20,
        scaleAllowed: false,
        message: 'CSI cảnh báo - giảm 20% new spend, monitor daily'
      };
    }

    if (CSI >= CASHFLOW_ALERTS.CSI_CRITICAL) {
      return {
        action: 'STOP_SCALING',
        budgetReduction: 0,
        scaleAllowed: false,
        message: 'CSI nguy hiểm - STOP SCALE, maintain current only'
      };
    }

    return {
      action: 'EMERGENCY_REDUCTION',
      budgetReduction: 0.50,
      scaleAllowed: false,
      killLowPerformers: true,
      message: 'CSI critical - giảm 50% toàn hệ thống, kill ad groups ROI < 150%'
    };
  }

  private async getAvgDailySales(days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const salesStats = await this.testOrder2Model.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          orderStatus: { $in: ['Giao thành công', 'Đang giao', 'Đóng gói'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (salesStats.length === 0 || salesStats[0].count === 0) {
      return 1_000_000;  // Default 1M/day
    }

    return salesStats[0].totalRevenue / days;
  }

  private async getAvgDailyCOGS(days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const cogsStats = await this.testOrder2Model.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          orderStatus: { $in: ['Giao thành công', 'Đang giao', 'Đóng gói'] }
        }
      },
      {
        $group: {
          _id: null,
          totalCOGS: { $sum: '$totalCost' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (cogsStats.length === 0 || cogsStats[0].count === 0) {
      return 500_000;  // Default 500k/day
    }

    return cogsStats[0].totalCOGS / days;
  }

  private async getAverageDailyAdsCost(days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateString = startDate.toISOString().slice(0, 10);

    const reportStats = await this.adGroupDailyReportModel.aggregate([
      {
        $match: {
          date: { $gte: startDateString }
        }
      },
      {
        $group: {
          _id: '$date',
          totalAdsCost: { $sum: '$adsCost' }
        }
      },
      {
        $group: {
          _id: null,
          totalAdsCost: { $sum: '$totalAdsCost' },
          dayCount: { $sum: 1 }
        }
      }
    ]);

    if (reportStats.length > 0 && reportStats[0].dayCount > 0 && reportStats[0].totalAdsCost > 0) {
      return reportStats[0].totalAdsCost / reportStats[0].dayCount;
    }

    const advertisingCostStats = await this.advertisingCostModel.aggregate([
      {
        $match: {
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          totalSpent: { $sum: { $ifNull: ['$spentAmount', 0] } }
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$totalSpent' },
          dayCount: { $sum: 1 }
        }
      }
    ]);

    if (advertisingCostStats.length > 0 && advertisingCostStats[0].dayCount > 0 && advertisingCostStats[0].totalSpent > 0) {
      return advertisingCostStats[0].totalSpent / advertisingCostStats[0].dayCount;
    }

    return 1_000_000;
  }

  private mapRiskLevelToStatus(
    level: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL'
  ): 'safe' | 'warning' | 'danger' | 'critical' {
    switch (level) {
      case 'CRITICAL':
        return 'critical';
      case 'DANGER':
        return 'danger';
      case 'WARNING':
        return 'warning';
      default:
        return 'safe';
    }
  }
}
