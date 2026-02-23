import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { FinanceService } from './finance.service';
import { CreateFundingSourceDto } from './dto/create-funding-source.dto';
import { UpdateFundingSourceDto } from './dto/update-funding-source.dto';
import { CreateBudgetBucketDto } from './dto/create-budget-bucket.dto';
import { UpdateBudgetBucketDto } from './dto/update-budget-bucket.dto';
import { CreateCashflowEntryDto } from './dto/create-cashflow-entry.dto';
import { CreateLoanContractDto } from './dto/create-loan-contract.dto';
import { UpdateLoanContractDto } from './dto/update-loan-contract.dto';
import { CreateLoanRepaymentDto } from './dto/create-loan-repayment.dto';
import { CaptureAvailableFundDto } from './dto/capture-available-fund.dto';
import { CashflowSafetyService } from './cashflow-safety.service';
import { AutoScaleDecisionService } from './auto-scale-decision.service';
import { AutoScaleExecutionService } from './auto-scale-execution.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly cashflowSafety: CashflowSafetyService,
    private readonly autoScaleDecision: AutoScaleDecisionService,
    private readonly autoScaleExecution: AutoScaleExecutionService,
  ) {}

  // Funding sources (vay vốn / góp vốn / nội bộ)
  @Post('funding-sources')
  createFundingSource(@Body() dto: CreateFundingSourceDto) {
    return this.financeService.createFundingSource(dto);
  }

  @Get('funding-sources')
  listFundingSources(@Query('type') type?: string, @Query('status') status?: string) {
    return this.financeService.listFundingSources({ type, status });
  }

  @Patch('funding-sources/:id')
  updateFundingSource(@Param('id') id: string, @Body() dto: UpdateFundingSourceDto) {
    return this.financeService.updateFundingSource(id, dto);
  }

  // Budget buckets (ngân sách theo nhóm sản phẩm / kênh)
  @Post('budget-buckets')
  createBudgetBucket(@Body() dto: CreateBudgetBucketDto) {
    return this.financeService.createBudgetBucket(dto);
  }

  @Get('budget-buckets')
  listBudgetBuckets() {
    return this.financeService.listBudgetBuckets();
  }

  @Patch('budget-buckets/:id')
  updateBudgetBucket(@Param('id') id: string, @Body() dto: UpdateBudgetBucketDto) {
    return this.financeService.updateBudgetBucket(id, dto);
  }

  // Cashflow entries (tiền vào/ra)
  @Post('cashflows')
  createCashflow(@Body() dto: CreateCashflowEntryDto) {
    return this.financeService.createCashflow(dto);
  }

  @Get('cashflows')
  listCashflows(
    @Query('direction') direction?: string,
    @Query('sourceType') sourceType?: string,
    @Query('bucketId') bucketId?: string,
  ) {
    return this.financeService.listCashflows({ direction, sourceType, bucketId });
  }

  // Tổng quan ngân sách và nguồn vốn
  @Get('summary')
  summary() {
    return this.financeService.summary();
  }

  // Available funds (computed + snapshot)
  // LOGIC MỚI: Dựa trên realizedNetProfit (đơn đã thanh toán cả NCC và Đại lý)
  @Get('available-funds/current')
  currentAvailable(
    @Query('mode') mode?: 'conservative' | 'moderate' | 'aggressive',
  ) {
    // Dùng logic mới: Vốn khả dụng = realizedNetProfit (đã thanh toán cả 2 bên)
    return this.financeService.computeRealAvailableFunds(mode || 'conservative');
  }

  @Get('available-funds')
  listAvailable() {
    return this.financeService.listAvailableFundSnapshots();
  }

  @Post('available-funds/capture')
  captureAvailable(@Body() dto: CaptureAvailableFundDto) {
    return this.financeService.captureAvailableFunds(dto);
  }

  // Loan management
  @Post('loans')
  createLoan(@Body() dto: CreateLoanContractDto) {
    return this.financeService.createLoanContract(dto);
  }

  @Get('loans')
  listLoans(@Query('status') status?: string) {
    return this.financeService.listLoanContracts(status);
  }

  /**
   * GET /finance/loans/summary
   * Tổng hợp thông tin vay nợ cho CFO Dashboard
   * NOTE: Must be BEFORE loans/:id to avoid route conflict
   */
  @Get('loans/summary')
  getLoanSummary() {
    return this.financeService.getLoanSummary();
  }

  @Patch('loans/:id')
  updateLoan(@Param('id') id: string, @Body() dto: UpdateLoanContractDto) {
    return this.financeService.updateLoanContract(id, dto);
  }

  @Get('loans/:id')
  getLoan(@Param('id') id: string) {
    return this.financeService.getLoanContract(id);
  }

  @Post('loans/:id/repayments')
  createRepayment(@Param('id') id: string, @Body() dto: CreateLoanRepaymentDto) {
    return this.financeService.createLoanRepayment({ ...dto, loanId: id });
  }

  @Get('loans/:id/repayments')
  listRepayments(@Param('id') id: string) {
    return this.financeService.listLoanRepayments(id);
  }

  @Get('repayments/upcoming')
  listUpcoming(@Query('days') days?: string) {
    return this.financeService.listUpcomingRepayments(days ? +days : 7);
  }

  // ═══════════════════════════════════════════════════════════
  // LOAN DISBURSEMENT & SUMMARY
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /finance/loans/:id/disburse
   * Ghi nhận giải ngân khoản vay (tiền VÀO Bank Balance)
   */
  @Post('loans/:id/disburse')
  recordDisbursement(
    @Param('id') id: string,
    @Body() dto: { amount: number; date?: string; notes?: string },
  ) {
    return this.financeService.recordDisbursement(id, dto);
  }

  /**
   * POST /finance/repayments/:id/pay
   * Đánh dấu một kỳ trả nợ đã trả
   */
  @Post('repayments/:id/pay')
  markRepaymentPaid(
    @Param('id') id: string,
    @Body() dto: { paidDate?: string; referenceId?: string; notes?: string },
  ) {
    return this.financeService.markRepaymentPaid(id, dto);
  }

  // ============================================
  // CFO SPEC v1: DEBT CASHFLOW SUMMARY
  // ============================================

  /**
   * GET /finance/loan-contracts/summary/cashflow
   * 
   * Returns debt cashflow summary for Financial Control.
   * Includes: disbursed, paid, outstanding, due14d, forecast 7d, alerts.
   */
  @Get('loan-contracts/summary/cashflow')
  getDebtCashflowSummary(@Query('windowDays') windowDays?: string) {
    return this.financeService.getDebtCashflowSummary(windowDays ? +windowDays : 14);
  }

  // ============================================
  // CASHFLOW & AUTO SCALE ENDPOINTS
  // ============================================

  /**
   * GET /finance/cashflow-health
   * 
   * Returns complete cashflow health dashboard with CSI, DSO, DPO, Return Rate.
   */
  @Get('cashflow-health')
  async getCashflowHealth() {
    return await this.cashflowSafety.getCashflowHealthDashboard();
  }

  /**
   * GET /finance/dashboard
   * 
   * Executive summary for dashboard display.
   */
  @Get('dashboard')
  async getDashboard() {
    const health = await this.cashflowSafety.getCashflowHealthDashboard();
    
    return {
      summary: {
        csi: health.CSI,
        csiStatus: health.cashflowRiskLevel,
        daysUntilCashout: health.daysUntilCashout,
        dso: health.DSO,
        returnRate: health.returnRate,
        totalCash: health.availableCash,
        dailyBurn: health.dailyCashBurn,
      },
      health: {
        overall: this.getOverallHealth(health),
        risks: this.extractRisks(health),
      },
      activeAlerts: health.activeWarnings.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * GET /finance/alerts
   * 
   * Returns all active warnings and alerts.
   */
  @Get('alerts')
  async getAlerts(@Query('level') level?: string) {
    const health = await this.cashflowSafety.getCashflowHealthDashboard();
    
    const alerts = [
      ...this.formatCSIAlerts(health),
      ...this.formatDSOAlerts(health),
      ...this.formatReturnRateAlerts(health),
      ...this.formatCashflowRiskAlerts(health),
    ];

    const filteredAlerts = level
      ? alerts.filter(a => a.level === level.toUpperCase())
      : alerts;

    return {
      alerts: filteredAlerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.level === 'CRITICAL').length,
        danger: alerts.filter(a => a.level === 'DANGER').length,
        warning: alerts.filter(a => a.level === 'WARNING').length,
      },
    };
  }

  /**
   * GET /finance/ad-groups/:id/recommendation
   * 
   * Get scale recommendation for specific ad group.
   */
  @Get('ad-groups/:id/recommendation')
  async getAdGroupRecommendation(@Param('id') adGroupId: string) {
    // Get current budget from ad group
    // TODO: Query ad group to get current budget
    const currentBudget = 0; // Placeholder
    
    const decision = await this.autoScaleDecision.makeDecision(adGroupId, currentBudget);
    
    return {
      adGroupId,
      decision,
      explanation: this.explainDecision(decision),
      safeToExecute: !decision.cashflowProtection,
    };
  }

  /**
   * POST /finance/ad-groups/:id/manual-scale
   * 
   * Trigger manual scale for specific ad group.
   */
  @Post('ad-groups/:id/manual-scale')
  async manualScale(@Param('id') adGroupId: string) {
    const result = await this.autoScaleExecution.runManualAutoScale(adGroupId);
    
    return {
      success: true,
      adGroupId: result.adGroupId,
      action: result.decision.action,
      currentBudget: result.currentBudget,
      recommendedBudget: result.decision.newBudget,
      executedAt: new Date().toISOString(),
      decision: result.decision,
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private getOverallHealth(health: any): string {
    // Use cashflowRiskLevel as overall health indicator
    return health.cashflowRiskLevel;
  }

  private extractRisks(health: any): string[] {
    const risks: string[] = [];
    
    if (health.CSI < 1.5) {
      risks.push('CSI_LOW');
    }
    
    if (health.DSO > 7) {
      risks.push('DSO_HIGH');
    }
    
    if (health.returnRate > 20) {
      risks.push('RETURN_RATE_HIGH');
    }
    
    if (health.DPO < health.DSO) {
      risks.push('CASHFLOW_RISK');
    }
    
    return risks;
  }

  private formatCSIAlerts(health: any): any[] {
    const alerts = [];
    const csi = health.CSI;
    const status = health.cashflowRiskLevel;
    
    if (status === 'CRITICAL' || csi < 0.7) {
      alerts.push({
        type: 'CSI',
        level: 'CRITICAL',
        message: `CSI ${csi.toFixed(2)} - Emergency mode activated`,
        value: csi,
        threshold: 0.7,
        action: 'EMERGENCY_BUDGET_REDUCTION',
      });
    } else if (status === 'DANGER' || csi < 1.0) {
      alerts.push({
        type: 'CSI',
        level: 'DANGER',
        message: `CSI ${csi.toFixed(2)} - Stop all scaling`,
        value: csi,
        threshold: 1.0,
        action: 'STOP_SCALE',
      });
    } else if (status === 'WARNING' || csi < 1.5) {
      alerts.push({
        type: 'CSI',
        level: 'WARNING',
        message: `CSI ${csi.toFixed(2)} - Reduce scale rate`,
        value: csi,
        threshold: 1.5,
        action: 'REDUCE_SCALE',
      });
    }
    
    return alerts;
  }

  private formatDSOAlerts(health: any): any[] {
    const alerts = [];
    const dso = health.DSO;
    
    if (dso > 15) {
      alerts.push({
        type: 'DSO',
        level: 'CRITICAL',
        message: `DSO ${dso.toFixed(1)} days - Collection too slow`,
        value: dso,
        threshold: 15,
        action: 'STOP_ALL_SCALE',
      });
    } else if (dso > 10) {
      alerts.push({
        type: 'DSO',
        level: 'DANGER',
        message: `DSO ${dso.toFixed(1)} days - Reduce scale 50%`,
        value: dso,
        threshold: 10,
        action: 'REDUCE_50%',
      });
    } else if (dso > 7) {
      alerts.push({
        type: 'DSO',
        level: 'WARNING',
        message: `DSO ${dso.toFixed(1)} days - Reduce scale 30%`,
        value: dso,
        threshold: 7,
        action: 'REDUCE_30%',
      });
    }
    
    return alerts;
  }

  private formatReturnRateAlerts(health: any): any[] {
    const alerts = [];
    const returnRate = health.returnRate;
    
    if (returnRate > 35) {
      alerts.push({
        type: 'RETURN_RATE',
        level: 'CRITICAL',
        message: `Return rate ${returnRate.toFixed(1)}% - Emergency mode`,
        value: returnRate,
        threshold: 35,
        action: 'KILL_ALL_EXCEPT_TOP',
      });
    } else if (returnRate > 25) {
      alerts.push({
        type: 'RETURN_RATE',
        level: 'DANGER',
        message: `Return rate ${returnRate.toFixed(1)}% - Stop scaling`,
        value: returnRate,
        threshold: 25,
        action: 'STOP_SCALE',
      });
    } else if (returnRate > 20) {
      alerts.push({
        type: 'RETURN_RATE',
        level: 'WARNING',
        message: `Return rate ${returnRate.toFixed(1)}% - Block aggressive scale`,
        value: returnRate,
        threshold: 20,
        action: 'BLOCK_AGGRESSIVE',
      });
    }
    
    return alerts;
  }

  private formatCashflowRiskAlerts(health: any): any[] {
    const alerts = [];
    
    // Check if DPO < DSO (paying suppliers before collecting)
    if (health.DPO < health.DSO) {
      alerts.push({
        type: 'CASHFLOW_RISK',
        level: 'DANGER',
        message: `DPO ${health.DPO.toFixed(1)} < DSO ${health.DSO.toFixed(1)} - Paying suppliers before collecting from agents`,
        value: health.DSO - health.DPO,
        action: 'CAP_AGGRESSIVE_TO_MODERATE',
      });
    }
    
    return alerts;
  }

  private explainDecision(decision: any): string {
    const { action, reason, scaleRate, cashflowProtection } = decision;
    
    if (cashflowProtection) {
      return `🛡️ Cashflow protection active. ${reason}. ${decision.alert || ''}`;
    }
    
    switch (action) {
      case 'KILL':
        return `❌ Kill recommended due to ${reason}. Performance below threshold.`;
      case 'SCALE_DOWN':
        return `📉 Scale down ${Math.abs(scaleRate)}% due to ${reason}.`;
      case 'MAINTAIN':
        return `⏸️ Maintain current budget. ${reason}.`;
      case 'SCALE_UP_MODERATE':
        return `📈 Scale up ${scaleRate}% (moderate). ${reason}.`;
      case 'SCALE_UP_AGGRESSIVE':
        return `🚀 Scale up ${scaleRate}% (aggressive). ${reason}.`;
      default:
        return `Action: ${action}. Reason: ${reason}.`;
    }
  }
}
