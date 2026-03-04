/**
 * File: cashflow-control/controllers/dashboard.controller.ts
 * Purpose: REST API for main dashboard summary
 * 
 * Endpoint: GET /cashflow/dashboard/summary
 * 
 * This is the primary endpoint for the "one glance" executive view.
 * Returns the essential metrics Owner/CFO needs to assess financial health.
 */

import { Controller, Get } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';
import { FeatureModule } from '../../plan/feature-module.decorator';

@FeatureModule('cashflow-control')
@Controller('cashflow/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /cashflow/dashboard/summary
   * 
   * Returns the main dashboard summary with:
   * - bankBalance: Total cash in all accounts
   * - committedCash: Allocated to pending obligations
   * - freeCash: BankBalance - CommittedCash (actually spendable)
   * - adsFundBalance: Reserved for marketing
   * - cashflowSafetyIndex: 0-1 health indicator
   */
  @Get('summary')
  async getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }
}
