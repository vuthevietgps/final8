/**
 * File: cashflow-control/services/alerts.service.ts
 * Purpose: Generate proactive cashflow alerts
 * 
 * Alerts help Owner/CFO take action BEFORE problems become critical.
 * The system monitors key metrics and generates alerts when:
 * - Cashflow safety drops below thresholds
 * - Fund balances breach minimums
 * - Major commitments are due soon
 * - Ads budget is being restricted
 * - Profit turns negative
 */

import { Injectable } from '@nestjs/common';
import { AlertsResponseDto, AlertDto } from '../dto/alert.dto';
import { AlertType, AlertSeverity } from '../interfaces/cashflow.interfaces';

@Injectable()
export class AlertsService {

  /**
   * Alert thresholds
   */
  private readonly THRESHOLDS = {
    csiDanger: 0.3,
    csiWarning: 0.5,
    adsFundDangerDays: 3,
    adsFundWarningDays: 7,
    survivalBufferMinPercent: 80, // % of target
  };

  /**
   * Get all active alerts
   */
  getAlerts(): AlertsResponseDto {
    const alerts = this.generateAlerts();
    
    const bySeverity = {
      info: alerts.filter(a => a.severity === AlertSeverity.INFO).length,
      warning: alerts.filter(a => a.severity === AlertSeverity.WARNING).length,
      danger: alerts.filter(a => a.severity === AlertSeverity.DANGER).length,
      critical: alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
    };

    return {
      alerts,
      totalCount: alerts.length,
      criticalCount: bySeverity.critical,
      bySeverity,
      asOf: new Date(),
    };
  }

  /**
   * Generate alerts based on current state
   */
  private generateAlerts(): AlertDto[] {
    const alerts: AlertDto[] = [];

    // Check cashflow safety
    alerts.push(...this.checkCashflowSafety());
    
    // Check ads fund
    alerts.push(...this.checkAdsFund());
    
    // Check upcoming commitments
    alerts.push(...this.checkUpcomingCommitments());
    
    // Check ads budget restrictions
    alerts.push(...this.checkAdsBudgetRestrictions());
    
    // Check profit status
    alerts.push(...this.checkProfitStatus());

    // Sort by severity (critical first)
    return this.sortBySeverity(alerts);
  }

  /**
   * Check cashflow safety index
   */
  private checkCashflowSafety(): AlertDto[] {
    const alerts: AlertDto[] = [];
    const csi = 0.55; // Mock - in production, get from DashboardService

    if (csi < this.THRESHOLDS.csiDanger) {
      alerts.push({
        id: `alert-csi-${Date.now()}`,
        alertType: AlertType.CASHFLOW_LOW,
        severity: AlertSeverity.CRITICAL,
        title: 'Critical Cashflow Risk',
        message: `Cashflow Safety Index at ${(csi * 100).toFixed(0)}% - below danger threshold of ${this.THRESHOLDS.csiDanger * 100}%`,
        triggeredAt: new Date(),
        actionRequired: true,
        suggestedAction: 'Immediately review all non-essential spending. Consider pausing ads. Accelerate receivables collection.',
        relatedEntity: 'CASHFLOW_SAFETY_INDEX',
      });
    } else if (csi < this.THRESHOLDS.csiWarning) {
      alerts.push({
        id: `alert-csi-${Date.now()}`,
        alertType: AlertType.CASHFLOW_LOW,
        severity: AlertSeverity.WARNING,
        title: 'Cashflow Warning',
        message: `Cashflow Safety Index at ${(csi * 100).toFixed(0)}% - approaching danger zone`,
        triggeredAt: new Date(),
        actionRequired: true,
        suggestedAction: 'Review upcoming commitments and consider reducing discretionary spending.',
        relatedEntity: 'CASHFLOW_SAFETY_INDEX',
      });
    }

    return alerts;
  }

  /**
   * Check ads fund runway
   */
  private checkAdsFund(): AlertDto[] {
    const alerts: AlertDto[] = [];
    const adsFundBalance = 180000000;
    const dailyBurn = 22000000;
    const daysRunway = adsFundBalance / dailyBurn;

    if (daysRunway < this.THRESHOLDS.adsFundDangerDays) {
      alerts.push({
        id: `alert-ads-${Date.now()}`,
        alertType: AlertType.FUND_THRESHOLD_BREACH,
        severity: AlertSeverity.DANGER,
        title: 'Ads Fund Running Low',
        message: `Only ${daysRunway.toFixed(1)} days of ads budget remaining at current spend rate`,
        triggeredAt: new Date(),
        actionRequired: true,
        suggestedAction: 'Reduce daily ads spend or allocate more funds from profit.',
        relatedEntity: 'ADS_FUND',
      });
    } else if (daysRunway < this.THRESHOLDS.adsFundWarningDays) {
      alerts.push({
        id: `alert-ads-${Date.now()}`,
        alertType: AlertType.FUND_THRESHOLD_BREACH,
        severity: AlertSeverity.WARNING,
        title: 'Ads Fund Below Optimal',
        message: `${daysRunway.toFixed(1)} days of ads budget remaining - below recommended ${this.THRESHOLDS.adsFundWarningDays} days`,
        triggeredAt: new Date(),
        actionRequired: false,
        suggestedAction: 'Monitor daily and consider topping up from next profit allocation.',
        relatedEntity: 'ADS_FUND',
      });
    }

    return alerts;
  }

  /**
   * Check upcoming commitment payments
   */
  private checkUpcomingCommitments(): AlertDto[] {
    const alerts: AlertDto[] = [];
    
    // Mock upcoming commitments
    const commitments = [
      { description: 'Supplier A Payment', amount: 150000000, daysUntilDue: 3 },
      { description: 'February Salaries', amount: 120000000, daysUntilDue: 7 },
    ];

    for (const c of commitments) {
      if (c.daysUntilDue <= 3) {
        alerts.push({
          id: `alert-commit-${Date.now()}-${c.description}`,
          alertType: AlertType.COMMITMENT_DUE,
          severity: c.daysUntilDue <= 1 ? AlertSeverity.DANGER : AlertSeverity.WARNING,
          title: `Payment Due Soon: ${c.description}`,
          message: `${this.formatCurrency(c.amount)} due in ${c.daysUntilDue} day(s)`,
          triggeredAt: new Date(),
          actionRequired: c.daysUntilDue <= 1,
          suggestedAction: 'Ensure sufficient funds are available for payment.',
          relatedEntity: 'COMMITTED_CASH',
        });
      }
    }

    return alerts;
  }

  /**
   * Check if ads budget is being restricted
   */
  private checkAdsBudgetRestrictions(): AlertDto[] {
    const alerts: AlertDto[] = [];
    
    // Mock - in production, get from AdsDecisionService
    const optimalBudget = 25000000;
    const allowedBudget = 18000000;
    const isRestricted = allowedBudget < optimalBudget;

    if (isRestricted) {
      const reductionPercent = ((optimalBudget - allowedBudget) / optimalBudget * 100).toFixed(0);
      alerts.push({
        id: `alert-ads-restrict-${Date.now()}`,
        alertType: AlertType.ADS_BUDGET_RESTRICTED,
        severity: AlertSeverity.WARNING,
        title: 'Ads Budget Restricted',
        message: `Daily ads budget reduced by ${reductionPercent}% (${this.formatCurrency(optimalBudget)} → ${this.formatCurrency(allowedBudget)}) due to cashflow constraints`,
        triggeredAt: new Date(),
        actionRequired: false,
        suggestedAction: 'Improve cashflow safety index to unlock full ads budget.',
        relatedEntity: 'ADS_FUND',
      });
    }

    return alerts;
  }

  /**
   * Check profit status
   */
  private checkProfitStatus(): AlertDto[] {
    const alerts: AlertDto[] = [];
    
    // Mock - in production, get from ProfitService
    const netProfit = 130000000; // Positive profit
    const profitMargin = 28.9;

    if (netProfit < 0) {
      alerts.push({
        id: `alert-profit-${Date.now()}`,
        alertType: AlertType.PROFIT_NEGATIVE,
        severity: AlertSeverity.CRITICAL,
        title: 'Negative Profit Alert',
        message: `Net profit is negative: ${this.formatCurrency(netProfit)}. Costs exceed revenue.`,
        triggeredAt: new Date(),
        actionRequired: true,
        suggestedAction: 'Urgently review costs and revenue. Consider pausing unprofitable campaigns.',
        relatedEntity: 'PROFIT',
      });
    } else if (profitMargin < 15) {
      alerts.push({
        id: `alert-margin-${Date.now()}`,
        alertType: AlertType.PROFIT_NEGATIVE,
        severity: AlertSeverity.WARNING,
        title: 'Low Profit Margin',
        message: `Profit margin at ${profitMargin.toFixed(1)}% - below healthy threshold of 15%`,
        triggeredAt: new Date(),
        actionRequired: false,
        suggestedAction: 'Review cost structure and consider pricing adjustments.',
        relatedEntity: 'PROFIT',
      });
    }

    return alerts;
  }

  /**
   * Sort alerts by severity (critical first)
   */
  private sortBySeverity(alerts: AlertDto[]): AlertDto[] {
    const severityOrder = {
      [AlertSeverity.CRITICAL]: 0,
      [AlertSeverity.DANGER]: 1,
      [AlertSeverity.WARNING]: 2,
      [AlertSeverity.INFO]: 3,
    };

    return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
