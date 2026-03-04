/**
 * File: cashflow-control/controllers/ads-decision.controller.ts
 * Purpose: REST API for daily ads budget decision
 * 
 * Endpoint: GET /cashflow/ads/decision
 * 
 * CORE FORMULA:
 * AdsBudgetToday = MIN(OptimalBudget, AllowedByCashflow)
 * 
 * This endpoint provides THE decision for today's ads spending,
 * ensuring we never overspend at the cost of operational survival.
 */

import { Controller, Get } from '@nestjs/common';
import { AdsDecisionService } from '../services/ads-decision.service';
import { AdsDecisionDto } from '../dto/ads-decision.dto';
import { FeatureModule } from '../../plan/feature-module.decorator';

@FeatureModule('cashflow-control')
@Controller('cashflow/ads')
export class AdsDecisionController {
  constructor(private readonly adsDecisionService: AdsDecisionService) {}

  /**
   * GET /cashflow/ads/decision
   * 
   * Returns today's ads budget decision:
   * - optimalAdsBudget: What ads team wants
   * - allowedByCashflow: What cashflow permits
   * - finalAdsBudget: MIN(optimal, allowed)
   * - restrictionReason: Why budget might be limited
   * - recommendation: SCALE_UP / MAINTAIN / SCALE_DOWN / PAUSE
   */
  @Get('decision')
  getAdsDecision(): AdsDecisionDto {
    return this.adsDecisionService.getAdsDecision();
  }
}
