/**
 * File: cashflow-control/controllers/profit.controller.ts
 * Purpose: REST API for profit summary
 * 
 * Endpoint: GET /cashflow/profit/summary
 * 
 * CRITICAL: Revenue is NET revenue (agent model)
 * We receive payment AFTER supplier deducts their cost.
 * Never expose COD as revenue - that's misleading.
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ProfitService } from '../services/profit.service';
import { ProfitSummaryDto } from '../dto/profit-summary.dto';

@Controller('cashflow/profit')
export class ProfitController {
  constructor(private readonly profitService: ProfitService) {}

  /**
   * GET /cashflow/profit/summary
   * 
   * Returns profit summary with:
   * - netRevenue: What we actually receive (NOT COD!)
   * - totalCost: All operating costs
   * - netProfit: Revenue - Costs
   * - profitAllocation: How profit is distributed to funds
   * 
   * @param days Number of days to include (default 30)
   */
  @Get('summary')
  getProfitSummary(@Query('days') days?: number): ProfitSummaryDto {
    return this.profitService.getProfitSummary(days || 30);
  }
}
