/**
 * File: cashflow-control/cashflow-control.module.ts
 * Purpose: NestJS module for the Cashflow Control System
 * 
 * This module provides:
 * - Dashboard summary (bank balance, free cash, safety index)
 * - 4 Virtual Funds status
 * - Profit summary with agent model revenue
 * - Ads budget decision (MIN formula)
 * - Proactive cashflow alerts
 * 
 * API Endpoints:
 * - GET /cashflow/dashboard/summary
 * - GET /cashflow/funds/status
 * - GET /cashflow/profit/summary
 * - GET /cashflow/ads/decision
 * - GET /cashflow/alerts
 */

import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';

// Controllers
import { DashboardController } from './controllers/dashboard.controller';
import { FundsController } from './controllers/funds.controller';
import { ProfitController } from './controllers/profit.controller';
import { AdsDecisionController } from './controllers/ads-decision.controller';
import { AlertsController } from './controllers/alerts.controller';

// Services
import { DashboardService } from './services/dashboard.service';
import { FundsService } from './services/funds.service';
import { ProfitService } from './services/profit.service';
import { AdsDecisionService } from './services/ads-decision.service';
import { AlertsService } from './services/alerts.service';

@Module({
  imports: [FinanceModule],
  controllers: [
    DashboardController,
    FundsController,
    ProfitController,
    AdsDecisionController,
    AlertsController,
  ],
  providers: [
    DashboardService,
    FundsService,
    ProfitService,
    AdsDecisionService,
    AlertsService,
  ],
  exports: [
    DashboardService,
    FundsService,
    ProfitService,
    AdsDecisionService,
    AlertsService,
  ],
})
export class CashflowControlModule {}
