/**
 * Phase Rules Service
 * 
 * Điều chỉnh rules theo từng phase của ad group:
 * - TESTING (0-7 ngày): Thận trọng, kill threshold thấp, max 10% scale
 * - GROWTH (8-30 ngày): Moderate, max 15% scale
 * - MATURE (30-90 ngày): Full rules, max 20% scale
 * - STABLE (90+ ngày): Ưu tiên horizontal scaling
 */

import { Injectable, Logger } from '@nestjs/common';
import { AggregatedMetrics, ScaleDecision, TestingPhase, OptimalSpendResult } from './interfaces';
import { 
  KILL_THRESHOLDS, 
  SCALE_DOWN_THRESHOLDS,
  ScaleRulesService 
} from './scale-rules.service';

// Phase-specific thresholds
export const PHASE_THRESHOLDS = {
  TESTING: {
    maxDays: 7,
    killROI: 30,          // Lower kill threshold
    scaleRate: 0.10,      // Max +10%
    maxBudget: 1_000_000, // Max 1M/day
    scaleDownRate: 0.15,  // Only -15%
  },
  GROWTH: {
    maxDays: 30,
    killROI: KILL_THRESHOLDS.ROI_MIN,  // Standard
    scaleRate: 0.15,      // Max +15%
    maxBudget: 3_000_000, // Max 3M/day
    scaleDownRate: 0.20,  // -20%
  },
  MATURE: {
    maxDays: 90,
    killROI: KILL_THRESHOLDS.ROI_MIN,  // Standard
    scaleRate: 0.20,      // Max +20%
    maxBudget: 10_000_000, // Max 10M/day
    scaleDownRate: 0.25,  // -25%
  },
  STABLE: {
    maxDays: Infinity,
    killROI: KILL_THRESHOLDS.ROI_MIN,  // Standard
    scaleRate: 0.10,      // Max +10% (prefer horizontal)
    maxBudget: 10_000_000,
    scaleDownRate: 0.25,
    preferHorizontal: true,  // Always suggest horizontal scaling
  }
};

@Injectable()
export class PhaseRulesService {
  private readonly logger = new Logger(PhaseRulesService.name);

  constructor(
    private readonly scaleRulesService: ScaleRulesService,
  ) {}

  /**
   * Xác định testing phase dựa trên số ngày kể từ launch
   */
  determinePhase(daysSinceLaunch: number): TestingPhase {
    if (daysSinceLaunch <= PHASE_THRESHOLDS.TESTING.maxDays) {
      return 'TESTING';
    }
    if (daysSinceLaunch <= PHASE_THRESHOLDS.GROWTH.maxDays) {
      return 'GROWTH';
    }
    if (daysSinceLaunch <= PHASE_THRESHOLDS.MATURE.maxDays) {
      return 'MATURE';
    }
    return 'STABLE';
  }

  /**
   * Apply phase-specific rules
   */
  applyPhaseRules(
    metrics: AggregatedMetrics,
    optimalSpend: OptimalSpendResult | null,
    reinvestmentFund: number,
    phase: TestingPhase,
    daysSinceLaunch: number
  ): ScaleDecision {
    switch (phase) {
      case 'TESTING':
        return this.applyTestingPhaseRules(metrics, optimalSpend, reinvestmentFund);
      case 'GROWTH':
        return this.applyGrowthPhaseRules(metrics, optimalSpend, reinvestmentFund);
      case 'STABLE':
        return this.applyStablePhaseRules(metrics, optimalSpend, reinvestmentFund);
      default:
        // MATURE: Use standard rules
        return this.scaleRulesService.evaluateDecision(metrics, optimalSpend, reinvestmentFund);
    }
  }

  /**
   * Testing Phase Rules (0-7 days)
   * - Kill threshold thấp hơn (ROI < 30%)
   * - Scale nhẹ (+10% max)
   * - Budget cap 1M
   */
  private applyTestingPhaseRules(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null,
    reinvestmentFund: number
  ): ScaleDecision {
    const config = PHASE_THRESHOLDS.TESTING;

    // KILL với threshold thấp hơn
    if (m.roi < config.killROI || m.consecutiveLossDays >= 3) {
      return {
        action: 'KILL',
        newBudget: 0,
        reason: `Testing phase FAILED: ROI ${m.roi.toFixed(0)}% < ${config.killROI}%`,
        confidence: 90,
        metrics: m,
        optimalSpend: optimal?.optimalSpend
      };
    }

    // SCALE DOWN với rate thấp hơn
    if (m.roi >= config.killROI && m.roi < 70) {
      const newBudget = Math.max(
        m.currentBudget * (1 - config.scaleDownRate),
        SCALE_DOWN_THRESHOLDS.MIN_BUDGET
      );
      
      return {
        action: 'SCALE_DOWN',
        newBudget,
        reason: `Testing phase - low ROI ${m.roi.toFixed(0)}%, giảm ${config.scaleDownRate * 100}%`,
        confidence: 80,
        metrics: m
      };
    }

    // MAINTAIN nếu 70-100%
    if (m.roi >= 70 && m.roi < 100) {
      return {
        action: 'MAINTAIN',
        newBudget: m.currentBudget,
        reason: `Testing phase - monitoring (ROI ${m.roi.toFixed(0)}%)`,
        confidence: 70,
        metrics: m
      };
    }

    // SCALE UP với rate và budget thấp
    if (m.roi >= 100) {
      const newBudget = Math.min(
        m.currentBudget * (1 + config.scaleRate),
        config.maxBudget
      );
      
      const budgetNeeded = newBudget - m.currentBudget;
      const recommendHorizontal = reinvestmentFund > budgetNeeded * 3;

      return {
        action: 'SCALE_UP_MODERATE',
        newBudget,
        reason: `Testing phase SUCCESS! +${config.scaleRate * 100}% (ROI ${m.roi.toFixed(0)}%)`,
        confidence: 75,
        metrics: m,
        optimalSpend: optimal?.optimalSpend,
        recommendHorizontalScaling: recommendHorizontal,
        horizontalScalingReason: recommendHorizontal 
          ? 'Testing thành công - nên nhân bản nhóm này'
          : undefined
      };
    }

    return {
      action: 'MAINTAIN',
      newBudget: m.currentBudget,
      reason: 'Testing phase - default maintain',
      confidence: 60,
      metrics: m
    };
  }

  /**
   * Growth Phase Rules (8-30 days)
   * - Standard kill threshold
   * - Moderate scale (+15% max)
   * - Budget cap 3M
   */
  private applyGrowthPhaseRules(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null,
    reinvestmentFund: number
  ): ScaleDecision {
    const config = PHASE_THRESHOLDS.GROWTH;

    // KILL với standard threshold
    if (this.shouldKillStandard(m, optimal)) {
      return {
        action: 'KILL',
        newBudget: 0,
        reason: this.getKillReason(m),
        confidence: 95,
        metrics: m
      };
    }

    // SCALE DOWN
    if (this.shouldScaleDownStandard(m, optimal)) {
      const newBudget = Math.max(
        m.currentBudget * (1 - config.scaleDownRate),
        SCALE_DOWN_THRESHOLDS.MIN_BUDGET
      );
      
      return {
        action: 'SCALE_DOWN',
        newBudget,
        reason: `Growth phase - below target (ROI ${m.roi.toFixed(0)}%)`,
        confidence: 85,
        metrics: m
      };
    }

    // MAINTAIN
    if (this.shouldMaintainStandard(m, optimal)) {
      return {
        action: 'MAINTAIN',
        newBudget: m.currentBudget,
        reason: `Growth phase - acceptable (ROI ${m.roi.toFixed(0)}%)`,
        confidence: 70,
        metrics: m
      };
    }

    // SCALE UP với growth phase limits
    if (m.roi >= 150 || (optimal && optimal.recommendation === 'SCALE_UP')) {
      const newBudget = Math.min(
        m.currentBudget * (1 + config.scaleRate),
        config.maxBudget
      );
      
      const budgetNeeded = newBudget - m.currentBudget;
      const recommendHorizontal = reinvestmentFund > budgetNeeded * 2;

      return {
        action: 'SCALE_UP_MODERATE',
        newBudget,
        reason: `Growth phase - scaling +${config.scaleRate * 100}% (ROI ${m.roi.toFixed(0)}%)`,
        confidence: 80,
        metrics: m,
        optimalSpend: optimal?.optimalSpend,
        recommendHorizontalScaling: recommendHorizontal,
        horizontalScalingReason: recommendHorizontal
          ? `Growth phase có dư ${((reinvestmentFund - budgetNeeded) / 1_000_000).toFixed(1)}M`
          : undefined
      };
    }

    return {
      action: 'MAINTAIN',
      newBudget: m.currentBudget,
      reason: 'Growth phase - default maintain',
      confidence: 65,
      metrics: m
    };
  }

  /**
   * Stable Phase Rules (90+ days)
   * - Ưu tiên horizontal scaling over vertical
   * - Small scale only (+10%)
   * - Recommend duplicate high performers
   */
  private applyStablePhaseRules(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null,
    reinvestmentFund: number
  ): ScaleDecision {
    const config = PHASE_THRESHOLDS.STABLE;

    // KILL
    if (this.shouldKillStandard(m, optimal)) {
      return {
        action: 'KILL',
        newBudget: 0,
        reason: this.getKillReason(m),
        confidence: 95,
        metrics: m
      };
    }

    // SCALE DOWN
    if (this.shouldScaleDownStandard(m, optimal)) {
      const newBudget = Math.max(
        m.currentBudget * (1 - config.scaleDownRate),
        SCALE_DOWN_THRESHOLDS.MIN_BUDGET
      );
      
      return {
        action: 'SCALE_DOWN',
        newBudget,
        reason: `Stable phase - declining (ROI ${m.roi.toFixed(0)}%)`,
        confidence: 85,
        metrics: m
      };
    }

    // HIGH PERFORMANCE → Recommend horizontal scaling
    if (m.roi >= 200) {
      return {
        action: 'MAINTAIN',
        newBudget: m.currentBudget,
        reason: `Stable phase + High ROI ${m.roi.toFixed(0)}% → Recommend horizontal scaling`,
        confidence: 85,
        metrics: m,
        optimalSpend: optimal?.optimalSpend,
        recommendHorizontalScaling: true,
        horizontalScalingReason: 'Ad group STABLE với ROI cao - tạo nhóm mới thay vì tăng budget'
      };
    }

    // MODERATE PERFORMANCE → Small scale only
    if (m.roi >= 150) {
      const newBudget = Math.min(
        m.currentBudget * (1 + config.scaleRate),
        config.maxBudget
      );

      return {
        action: 'SCALE_UP_MODERATE',
        newBudget,
        reason: `Stable phase - small +${config.scaleRate * 100}% only (ROI ${m.roi.toFixed(0)}%)`,
        confidence: 75,
        metrics: m,
        recommendHorizontalScaling: true,
        horizontalScalingReason: 'Stable phase - nên tạo thêm nhóm thay vì scale quá nhiều'
      };
    }

    return {
      action: 'MAINTAIN',
      newBudget: m.currentBudget,
      reason: 'Stable phase - maintain',
      confidence: 70,
      metrics: m
    };
  }

  // ============= Helper Methods =============

  private shouldKillStandard(m: AggregatedMetrics, optimal: OptimalSpendResult | null): boolean {
    return (
      m.roi < KILL_THRESHOLDS.ROI_MIN ||
      m.profitMargin < KILL_THRESHOLDS.PROFIT_MARGIN_MIN ||
      m.successRate < KILL_THRESHOLDS.SUCCESS_RATE_MIN ||
      m.consecutiveLossDays >= KILL_THRESHOLDS.CONSECUTIVE_LOSS_MAX ||
      m.returnRate > KILL_THRESHOLDS.RETURN_RATE_MAX ||
      (m.riskLevel === 'HIGH' && m.predictionAccuracy < 50) ||
      optimal?.recommendation === 'KILL'
    );
  }

  private shouldScaleDownStandard(m: AggregatedMetrics, optimal: OptimalSpendResult | null): boolean {
    return (
      (m.roi >= 50 && m.roi < 100) ||
      (m.profitMargin >= 5 && m.profitMargin < 10) ||
      m.riskLevel === 'HIGH' ||
      optimal?.recommendation === 'SCALE_DOWN'
    );
  }

  private shouldMaintainStandard(m: AggregatedMetrics, optimal: OptimalSpendResult | null): boolean {
    return (
      (m.roi >= 100 && m.roi < 150) &&
      (m.profitMargin >= 10 && m.profitMargin < 15) &&
      m.successRate >= 60
    );
  }

  private getKillReason(m: AggregatedMetrics): string {
    const reasons: string[] = [];
    
    if (m.roi < KILL_THRESHOLDS.ROI_MIN) {
      reasons.push(`ROI ${m.roi.toFixed(0)}% < ${KILL_THRESHOLDS.ROI_MIN}%`);
    }
    if (m.profitMargin < KILL_THRESHOLDS.PROFIT_MARGIN_MIN) {
      reasons.push(`Margin ${m.profitMargin.toFixed(0)}%`);
    }
    if (m.successRate < KILL_THRESHOLDS.SUCCESS_RATE_MIN) {
      reasons.push(`Success ${m.successRate.toFixed(0)}%`);
    }
    if (m.consecutiveLossDays >= KILL_THRESHOLDS.CONSECUTIVE_LOSS_MAX) {
      reasons.push(`Lỗ ${m.consecutiveLossDays} ngày`);
    }
    if (m.returnRate > KILL_THRESHOLDS.RETURN_RATE_MAX) {
      reasons.push(`Return ${m.returnRate.toFixed(0)}%`);
    }
    
    return `Auto-killed: ${reasons.join(', ')}`;
  }
}
