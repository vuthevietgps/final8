/**
 * File: cashflow-control/dto/ads-decision.dto.ts
 * Purpose: DTO for today's ads budget decision
 * 
 * CORE FORMULA:
 * AdsBudgetToday = MIN(OptimalBudget, AllowedByCashflow)
 * 
 * This ensures we NEVER overspend on ads at the cost of operational survival.
 * Cashflow safety takes precedence over marketing optimization.
 */

export class AdsDecisionDto {
  /** What the ads team wants to spend based on performance optimization */
  optimalAdsBudget: number;

  /** Maximum amount cashflow permits without endangering operations */
  allowedByCashflow: number;

  /** Final approved budget: MIN(optimal, allowed) */
  finalAdsBudget: number;

  /** If budget is restricted, explains why */
  restrictionReason: string | null;

  /** Whether the budget is restricted by cashflow constraints */
  isRestricted: boolean;

  /** How many days we can sustain current ads spend with available funds */
  daysRemaining: number;

  /** Current Ads Fund balance */
  adsFundBalance: number;

  /** Daily burn rate for ads (7-day average) */
  dailyAdsBurnRate: number;

  /** Recommendation for the ads team */
  recommendation: 'SCALE_UP' | 'MAINTAIN' | 'SCALE_DOWN' | 'PAUSE';

  /** Explanation of the decision formula */
  formula: {
    description: string;
    calculation: string;
  };
}
