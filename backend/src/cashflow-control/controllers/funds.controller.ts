/**
 * File: cashflow-control/controllers/funds.controller.ts
 * Purpose: REST API for the 4 Virtual Funds system
 * 
 * Endpoint: GET /cashflow/funds/status
 * 
 * Returns detailed status of all 4 virtual funds:
 * 1. Committed Cash - What we owe
 * 2. Ads Fund - Marketing budget
 * 3. Survival Buffer - Emergency reserve
 * 4. Owner Fund - Withdrawable profit
 */

import { Controller, Get } from '@nestjs/common';
import { FundsService } from '../services/funds.service';
import { FundsListResponseDto } from '../dto/fund-status.dto';
import { FeatureModule } from '../../plan/feature-module.decorator';

@FeatureModule('cashflow-control')
@Controller('cashflow/funds')
export class FundsController {
  constructor(private readonly fundsService: FundsService) {}

  /**
   * GET /cashflow/funds/status
   * 
   * Returns the status of all 4 virtual funds with:
   * - Current balance
   * - Yesterday's change
   * - 7-day projection
   * - Threshold and status (safe/warning/danger)
   * - Usage rules
   */
  @Get('status')
  getFundsStatus(): FundsListResponseDto {
    return this.fundsService.getFundsStatus();
  }
}
