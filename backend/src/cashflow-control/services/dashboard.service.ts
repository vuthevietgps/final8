/**
 * File: cashflow-control/services/dashboard.service.ts
 * Purpose: Business logic for the main dashboard summary
 */

import { Injectable } from '@nestjs/common';
import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';
import { FinancialControlService } from '../../finance/financial-control.service';

@Injectable()
export class DashboardService {
  constructor(private readonly financialControlService: FinancialControlService) {}

  /**
   * Get the main dashboard summary
   * This is the "one glance" view for Owner/CFO
   */
  async getSummary(): Promise<DashboardSummaryDto> {
    const dashboard = await this.financialControlService.getDashboard();
    const bankBalance = this.toNumber(dashboard.bankBalance);
    const committedCash = this.toNumber(dashboard.committedCash);
    const freeCash = this.toNumber(dashboard.freeCash);
    const adsFundBalance = this.toNumber(dashboard.adsBudgetApproved);
    const cashflowSafetyIndex = this.calculateSafetyIndex(
      freeCash,
      this.toNumber(dashboard.monthlyBurn),
    );

    return {
      bankBalance,
      committedCash,
      freeCash,
      adsFundBalance,
      cashflowSafetyIndex,
      asOf: dashboard.calculatedAt || new Date(),
      formulas: {
        freeCash: 'BankBalance - CommittedCash',
        safetyIndex: 'min(max((FreeCash / MonthlyBurn) / 3, 0), 1)',
      },
    };
  }

  private toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Calculate Cashflow Safety Index (CSI)
   * CSI = FreeCash / MonthlyBurn, normalized to 0..1 using 3 months runway as safe.
   */
  private calculateSafetyIndex(freeCash: number, monthlyBurn: number): number {
    if (freeCash <= 0) return 0;
    if (monthlyBurn <= 0) return 1;

    const monthsRunway = freeCash / monthlyBurn;
    const normalized = Math.min(monthsRunway / 3, 1);

    return Math.max(0, Math.round(normalized * 100) / 100);
  }
}
