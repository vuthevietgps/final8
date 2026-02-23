/**
 * File: cashflow-control/services/ads-decision.service.ts
 * Purpose: Business logic for daily ads budget decision
 * 
 * CORE PRINCIPLE:
 * Cashflow survival > Marketing optimization
 * 
 * The ads team might want to spend 50M/day based on ROAS,
 * but if that endangers our ability to pay suppliers/salaries,
 * we MUST restrict it.
 * 
 * FORMULA:
 * AdsBudgetToday = MIN(OptimalBudget, AllowedByCashflow)
 * 
 * AllowedByCashflow is determined by:
 * 1. Current Ads Fund balance
 * 2. Cashflow Safety Index
 * 3. Upcoming commitments
 * 4. Minimum survival buffer requirements
 */

import { Injectable } from '@nestjs/common';
import { AdsDecisionDto } from '../dto/ads-decision.dto';

@Injectable()
export class AdsDecisionService {

  /**
   * Safety thresholds for ads spending
   */
  private readonly SAFETY_RULES = {
    // Max % of ads fund that can be spent daily
    maxDailySpendPercent: 15, // 15% of fund
    
    // CSI thresholds for spending limits
    csiFullSpend: 0.6,    // Above 0.6: allow full optimal budget
    csiReducedSpend: 0.4, // 0.4-0.6: reduce by 30%
    csiMinimalSpend: 0.3, // 0.3-0.4: reduce by 50%
    csiPause: 0.2,        // Below 0.2: pause ads
    
    // Minimum days of runway required
    minDaysRunway: 3,
  };

  /**
   * Calculate today's ads budget decision
   */
  getAdsDecision(): AdsDecisionDto {
    // Get current state (in production, from other services)
    const adsFundBalance = this.getAdsFundBalance();
    const cashflowSafetyIndex = this.getCashflowSafetyIndex();
    const optimalAdsBudget = this.getOptimalBudgetFromAdsTeam();
    const dailyBurnRate = this.getDailyAdsBurnRate();

    // Calculate what cashflow allows
    const allowedByCashflow = this.calculateAllowedBudget(
      adsFundBalance,
      cashflowSafetyIndex,
      dailyBurnRate
    );

    // CORE FORMULA: Final = MIN(Optimal, Allowed)
    const finalAdsBudget = Math.min(optimalAdsBudget, allowedByCashflow);
    
    // Is budget restricted?
    const isRestricted = finalAdsBudget < optimalAdsBudget;
    const restrictionReason = isRestricted 
      ? this.getRestrictionReason(cashflowSafetyIndex, adsFundBalance, dailyBurnRate)
      : null;

    // Calculate days remaining
    const daysRemaining = dailyBurnRate > 0 
      ? Math.floor(adsFundBalance / dailyBurnRate)
      : 999;

    // Determine recommendation
    const recommendation = this.getRecommendation(
      cashflowSafetyIndex, 
      daysRemaining, 
      isRestricted
    );

    return {
      optimalAdsBudget,
      allowedByCashflow,
      finalAdsBudget,
      restrictionReason,
      isRestricted,
      daysRemaining,
      adsFundBalance,
      dailyAdsBurnRate: dailyBurnRate,
      recommendation,
      formula: {
        description: 'Ads budget is restricted by cashflow safety',
        calculation: `MIN(${this.formatCurrency(optimalAdsBudget)}, ${this.formatCurrency(allowedByCashflow)}) = ${this.formatCurrency(finalAdsBudget)}`,
      },
    };
  }

  /**
   * Calculate maximum budget allowed by cashflow
   * 
   * Rules:
   * 1. Never exceed 15% of ads fund daily
   * 2. Adjust based on CSI (safety index)
   * 3. Ensure minimum 3 days runway remains
   */
  private calculateAllowedBudget(
    adsFundBalance: number,
    csi: number,
    dailyBurnRate: number
  ): number {
    // Rule 1: Max 15% of fund daily
    const maxByFund = adsFundBalance * (this.SAFETY_RULES.maxDailySpendPercent / 100);

    // Rule 2: Adjust by CSI
    let csiMultiplier = 1.0;
    if (csi < this.SAFETY_RULES.csiPause) {
      csiMultiplier = 0; // Pause ads
    } else if (csi < this.SAFETY_RULES.csiMinimalSpend) {
      csiMultiplier = 0.5; // 50% reduction
    } else if (csi < this.SAFETY_RULES.csiReducedSpend) {
      csiMultiplier = 0.7; // 30% reduction
    } else if (csi < this.SAFETY_RULES.csiFullSpend) {
      csiMultiplier = 0.85; // 15% reduction
    }

    // Rule 3: Ensure minimum runway
    const reserveForRunway = dailyBurnRate * this.SAFETY_RULES.minDaysRunway;
    const maxAfterReserve = Math.max(0, adsFundBalance - reserveForRunway);

    // Take the most restrictive limit
    const allowedBudget = Math.min(maxByFund * csiMultiplier, maxAfterReserve);

    return Math.round(allowedBudget);
  }

  /**
   * Generate human-readable restriction reason
   */
  private getRestrictionReason(
    csi: number,
    adsFundBalance: number,
    dailyBurnRate: number
  ): string {
    const daysRunway = dailyBurnRate > 0 ? adsFundBalance / dailyBurnRate : 999;

    if (csi < this.SAFETY_RULES.csiPause) {
      return `CRITICAL: Cashflow Safety Index (${(csi * 100).toFixed(0)}%) below minimum threshold. Ads paused to protect operations.`;
    }

    if (daysRunway < this.SAFETY_RULES.minDaysRunway) {
      return `Ads Fund runway too low (${daysRunway.toFixed(1)} days). Minimum ${this.SAFETY_RULES.minDaysRunway} days required.`;
    }

    if (csi < this.SAFETY_RULES.csiMinimalSpend) {
      return `Low cashflow safety (${(csi * 100).toFixed(0)}%). Budget reduced by 50% to protect operations.`;
    }

    if (csi < this.SAFETY_RULES.csiReducedSpend) {
      return `Cashflow safety index (${(csi * 100).toFixed(0)}%) below optimal. Budget reduced by 30%.`;
    }

    return `Cashflow constraints applied. Safety Index: ${(csi * 100).toFixed(0)}%`;
  }

  /**
   * Get recommendation for ads team
   */
  private getRecommendation(
    csi: number,
    daysRemaining: number,
    isRestricted: boolean
  ): 'SCALE_UP' | 'MAINTAIN' | 'SCALE_DOWN' | 'PAUSE' {
    if (csi < this.SAFETY_RULES.csiPause || daysRemaining < 2) {
      return 'PAUSE';
    }

    if (isRestricted || csi < this.SAFETY_RULES.csiMinimalSpend) {
      return 'SCALE_DOWN';
    }

    if (csi > 0.7 && daysRemaining > 10) {
      return 'SCALE_UP';
    }

    return 'MAINTAIN';
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MOCK DATA (Replace with actual service calls in production)
  // ═══════════════════════════════════════════════════════════════════════════

  private getAdsFundBalance(): number {
    return 180000000; // 180M VND
  }

  private getCashflowSafetyIndex(): number {
    return 0.55; // Slightly below optimal (will trigger restriction)
  }

  private getOptimalBudgetFromAdsTeam(): number {
    // What ads team wants based on ROAS optimization
    return 25000000; // 25M VND
  }

  private getDailyAdsBurnRate(): number {
    // 7-day average daily spend
    return 22000000; // 22M VND
  }
}
