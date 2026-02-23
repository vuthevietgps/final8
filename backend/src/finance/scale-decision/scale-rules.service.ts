/**
 * Scale Rules Service
 * 
 * Chứa các rules quyết định KILL / SCALE_DOWN / MAINTAIN / SCALE_UP
 * 
 * ## Nguyên tắc:
 * 1. ROI-based nhưng kết hợp với optimal spend analysis
 * 2. Luôn giới hạn scale tối đa 20% để tránh reset machine learning
 * 3. Ưu tiên horizontal scaling khi còn dư budget
 */

import { Injectable, Logger } from '@nestjs/common';
import { AggregatedMetrics, ScaleDecision, OptimalSpendResult } from './interfaces';

// ============= THRESHOLDS =============

/**
 * Ngưỡng KILL - Ad group sẽ bị tắt
 */
export const KILL_THRESHOLDS = {
  ROI_MIN: 50,              // ROI < 50% → KILL
  PROFIT_MARGIN_MIN: 5,     // Profit margin < 5% → KILL
  SUCCESS_RATE_MIN: 50,     // Tỷ lệ giao hàng < 50% → KILL
  CONSECUTIVE_LOSS_MAX: 3,  // Lỗ >= 3 ngày liên tục → KILL
  RETURN_RATE_MAX: 30,      // Tỷ lệ hoàn hàng > 30% → KILL
  MARGINAL_ROI_MIN: 0,      // Marginal ROI âm → KILL
};

/**
 * Ngưỡng SCALE_DOWN - Giảm budget
 */
export const SCALE_DOWN_THRESHOLDS = {
  ROI_RANGE: [50, 100],           // ROI trong khoảng 50-100% → SCALE_DOWN
  PROFIT_MARGIN_RANGE: [5, 10],   // Profit margin 5-10% → SCALE_DOWN
  SUCCESS_RATE_RANGE: [50, 60],   // Success rate 50-60% → SCALE_DOWN
  MARGINAL_ROI_MAX: 0.5,          // Marginal ROI < 50% → SCALE_DOWN (qua điểm diminishing returns)
  SCALE_RATE: 0.25,               // Giảm 25%
  MIN_BUDGET: 100_000,            // Không giảm dưới 100k
};

/**
 * Ngưỡng MAINTAIN - Giữ nguyên
 */
export const MAINTAIN_THRESHOLDS = {
  ROI_RANGE: [100, 150],          // ROI 100-150% → MAINTAIN
  PROFIT_MARGIN_RANGE: [10, 15],  // Profit margin 10-15% → MAINTAIN
  SUCCESS_RATE_MIN: 60,           // Success rate >= 60%
  NEAR_OPTIMAL_RANGE: 0.2,        // ±20% so với optimal spend
};

/**
 * Ngưỡng SCALE_UP_MODERATE - Tăng vừa phải
 */
export const SCALE_UP_MODERATE_THRESHOLDS = {
  ROI_RANGE: [150, 250],          // ROI 150-250%
  PROFIT_MARGIN_RANGE: [15, 20],  // Profit margin 15-20%
  SUCCESS_RATE_MIN: 70,           // Success rate >= 70%
  MIN_ORDERS_7DAYS: 5,            // Ít nhất 5 đơn trong 7 ngày
  RISK_LEVELS: ['LOW', 'MEDIUM'], // Risk level acceptable
  SCALE_RATE: 0.15,               // Tăng 15%
  MAX_BUDGET: 5_000_000,          // Max 5M/ngày
};

/**
 * Ngưỡng SCALE_UP_AGGRESSIVE - Tăng mạnh (vẫn giới hạn 20%)
 */
export const SCALE_UP_AGGRESSIVE_THRESHOLDS = {
  ROI_MIN: 250,                   // ROI >= 250%
  PROFIT_MARGIN_MIN: 20,          // Profit margin >= 20%
  SUCCESS_RATE_MIN: 80,           // Success rate >= 80%
  MIN_ORDERS_7DAYS: 10,           // Ít nhất 10 đơn trong 7 ngày
  RISK_LEVEL: 'LOW',              // Chỉ LOW risk
  PROFIT_TREND: 'INCREASING',     // Đang tăng trưởng
  SCALE_RATE: 0.20,               // Tăng tối đa 20% (safe limit)
  MAX_BUDGET: 10_000_000,         // Max 10M/ngày
};

@Injectable()
export class ScaleRulesService {
  private readonly logger = new Logger(ScaleRulesService.name);

  /**
   * Đánh giá và quyết định scale dựa trên metrics + optimal spend
   */
  evaluateDecision(
    metrics: AggregatedMetrics,
    optimalSpendResult: OptimalSpendResult | null,
    reinvestmentFund: number
  ): ScaleDecision {
    
    // Priority 1: Check KILL conditions
    if (this.shouldKill(metrics, optimalSpendResult)) {
      return this.createKillDecision(metrics, optimalSpendResult);
    }

    // Priority 2: Check SCALE_DOWN conditions
    if (this.shouldScaleDown(metrics, optimalSpendResult)) {
      return this.createScaleDownDecision(metrics, optimalSpendResult);
    }

    // Priority 3: Check SCALE_UP_AGGRESSIVE conditions
    if (this.shouldScaleUpAggressive(metrics, optimalSpendResult) && reinvestmentFund > 1_000_000) {
      return this.createScaleUpAggressiveDecision(metrics, optimalSpendResult, reinvestmentFund);
    }

    // Priority 4: Check SCALE_UP_MODERATE conditions
    if (this.shouldScaleUpModerate(metrics, optimalSpendResult) && reinvestmentFund > 500_000) {
      return this.createScaleUpModerateDecision(metrics, optimalSpendResult, reinvestmentFund);
    }

    // Default: MAINTAIN
    return this.createMaintainDecision(metrics, optimalSpendResult);
  }

  // ============= KILL =============

  private shouldKill(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null
  ): boolean {
    // Basic ROI/quality checks
    if (m.roi < KILL_THRESHOLDS.ROI_MIN) return true;
    if (m.profitMargin < KILL_THRESHOLDS.PROFIT_MARGIN_MIN) return true;
    if (m.successRate < KILL_THRESHOLDS.SUCCESS_RATE_MIN) return true;
    if (m.consecutiveLossDays >= KILL_THRESHOLDS.CONSECUTIVE_LOSS_MAX) return true;
    if (m.returnRate > KILL_THRESHOLDS.RETURN_RATE_MAX) return true;
    
    // High risk + low accuracy
    if (m.riskLevel === 'HIGH' && m.predictionAccuracy < 50) return true;

    // Optimal spend says KILL
    if (optimal?.recommendation === 'KILL') return true;

    // Marginal ROI negative
    if (optimal && optimal.marginalROI < KILL_THRESHOLDS.MARGINAL_ROI_MIN) return true;

    return false;
  }

  private createKillDecision(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null
  ): ScaleDecision {
    const reasons: string[] = [];

    if (m.roi < KILL_THRESHOLDS.ROI_MIN) {
      reasons.push(`ROI ${m.roi.toFixed(0)}% < ${KILL_THRESHOLDS.ROI_MIN}%`);
    }
    if (m.profitMargin < KILL_THRESHOLDS.PROFIT_MARGIN_MIN) {
      reasons.push(`Margin ${m.profitMargin.toFixed(0)}% < ${KILL_THRESHOLDS.PROFIT_MARGIN_MIN}%`);
    }
    if (m.successRate < KILL_THRESHOLDS.SUCCESS_RATE_MIN) {
      reasons.push(`Success rate ${m.successRate.toFixed(0)}% < ${KILL_THRESHOLDS.SUCCESS_RATE_MIN}%`);
    }
    if (m.consecutiveLossDays >= KILL_THRESHOLDS.CONSECUTIVE_LOSS_MAX) {
      reasons.push(`Lỗ ${m.consecutiveLossDays} ngày liên tục`);
    }
    if (m.returnRate > KILL_THRESHOLDS.RETURN_RATE_MAX) {
      reasons.push(`Return rate ${m.returnRate.toFixed(0)}% > ${KILL_THRESHOLDS.RETURN_RATE_MAX}%`);
    }
    if (optimal && optimal.marginalROI < 0) {
      reasons.push(`Marginal ROI âm (${(optimal.marginalROI * 100).toFixed(0)}%)`);
    }

    return {
      action: 'KILL',
      newBudget: 0,
      reason: `Auto-killed: ${reasons.join(', ')}`,
      confidence: 95,
      metrics: m,
      optimalSpend: optimal?.optimalSpend,
      optimalSpendReason: optimal?.reason
    };
  }

  // ============= SCALE DOWN =============

  private shouldScaleDown(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null
  ): boolean {
    // ROI in scale-down range
    const roiInRange = m.roi >= SCALE_DOWN_THRESHOLDS.ROI_RANGE[0] && 
                       m.roi < SCALE_DOWN_THRESHOLDS.ROI_RANGE[1];
    
    // Profit margin in scale-down range
    const marginInRange = m.profitMargin >= SCALE_DOWN_THRESHOLDS.PROFIT_MARGIN_RANGE[0] && 
                          m.profitMargin < SCALE_DOWN_THRESHOLDS.PROFIT_MARGIN_RANGE[1];
    
    // Success rate in scale-down range
    const successInRange = m.successRate >= SCALE_DOWN_THRESHOLDS.SUCCESS_RATE_RANGE[0] && 
                           m.successRate < SCALE_DOWN_THRESHOLDS.SUCCESS_RATE_RANGE[1];

    // High risk
    const isHighRisk = m.riskLevel === 'HIGH';

    // Optimal spend recommends scale down
    const optimalSaysDown = optimal?.recommendation === 'SCALE_DOWN';

    // Past diminishing returns point (marginal ROI < 50%)
    const pastDiminishingReturns = optimal && 
      optimal.marginalROI < SCALE_DOWN_THRESHOLDS.MARGINAL_ROI_MAX;

    return roiInRange || marginInRange || successInRange || isHighRisk || 
           optimalSaysDown || pastDiminishingReturns;
  }

  private createScaleDownDecision(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null
  ): ScaleDecision {
    let newBudget: number;
    let reason: string;

    // Nếu có optimal spend, dùng nó làm target
    if (optimal && optimal.suggestedSpend < m.currentBudget) {
      newBudget = Math.max(optimal.suggestedSpend, SCALE_DOWN_THRESHOLDS.MIN_BUDGET);
      reason = `Giảm về ${(newBudget / 1_000_000).toFixed(1)}M (optimal spend). ${optimal.reason}`;
    } else {
      // Default: giảm 25%
      newBudget = Math.max(
        m.currentBudget * (1 - SCALE_DOWN_THRESHOLDS.SCALE_RATE),
        SCALE_DOWN_THRESHOLDS.MIN_BUDGET
      );
      reason = `Giảm ${SCALE_DOWN_THRESHOLDS.SCALE_RATE * 100}% - ROI: ${m.roi.toFixed(0)}%, Margin: ${m.profitMargin.toFixed(0)}%`;
    }

    return {
      action: 'SCALE_DOWN',
      newBudget,
      reason,
      confidence: 85,
      metrics: m,
      expectedROI: m.roi * 1.1,  // Expect ROI improvement with lower budget
      expectedProfit: (newBudget * m.roi / 100) * 1.1,
      optimalSpend: optimal?.optimalSpend,
      diminishingReturnsPoint: optimal?.diminishingReturnsPoint
    };
  }

  // ============= MAINTAIN =============

  private shouldMaintain(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null
  ): boolean {
    const roiInRange = m.roi >= MAINTAIN_THRESHOLDS.ROI_RANGE[0] && 
                       m.roi < MAINTAIN_THRESHOLDS.ROI_RANGE[1];
    
    const marginInRange = m.profitMargin >= MAINTAIN_THRESHOLDS.PROFIT_MARGIN_RANGE[0] && 
                          m.profitMargin < MAINTAIN_THRESHOLDS.PROFIT_MARGIN_RANGE[1];
    
    const successOk = m.successRate >= MAINTAIN_THRESHOLDS.SUCCESS_RATE_MIN;

    // Near optimal spend
    const nearOptimal = optimal && 
      m.currentBudget >= optimal.optimalSpend * (1 - MAINTAIN_THRESHOLDS.NEAR_OPTIMAL_RANGE) &&
      m.currentBudget <= optimal.optimalSpend * (1 + MAINTAIN_THRESHOLDS.NEAR_OPTIMAL_RANGE);

    return (roiInRange && marginInRange && successOk) || nearOptimal || 
           optimal?.recommendation === 'MAINTAIN';
  }

  private createMaintainDecision(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null
  ): ScaleDecision {
    const nearOptimalInfo = optimal && 
      Math.abs(m.currentBudget - optimal.optimalSpend) / optimal.optimalSpend < 0.2
        ? ` (Gần optimal ${(optimal.optimalSpend / 1_000_000).toFixed(1)}M)`
        : '';

    return {
      action: 'MAINTAIN',
      newBudget: m.currentBudget,
      reason: `Giữ nguyên - ROI: ${m.roi.toFixed(0)}%, Margin: ${m.profitMargin.toFixed(0)}%${nearOptimalInfo}`,
      confidence: 70,
      metrics: m,
      expectedROI: m.roi,
      expectedProfit: m.currentBudget * m.roi / 100,
      optimalSpend: optimal?.optimalSpend,
      optimalSpendReason: optimal?.reason
    };
  }

  // ============= SCALE UP MODERATE =============

  private shouldScaleUpModerate(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null
  ): boolean {
    const roiInRange = m.roi >= SCALE_UP_MODERATE_THRESHOLDS.ROI_RANGE[0] && 
                       m.roi < SCALE_UP_MODERATE_THRESHOLDS.ROI_RANGE[1];
    
    const marginInRange = m.profitMargin >= SCALE_UP_MODERATE_THRESHOLDS.PROFIT_MARGIN_RANGE[0] && 
                          m.profitMargin < SCALE_UP_MODERATE_THRESHOLDS.PROFIT_MARGIN_RANGE[1];
    
    const successOk = m.successRate >= SCALE_UP_MODERATE_THRESHOLDS.SUCCESS_RATE_MIN;
    const ordersOk = m.totalOrders_7days >= SCALE_UP_MODERATE_THRESHOLDS.MIN_ORDERS_7DAYS;
    const riskOk = SCALE_UP_MODERATE_THRESHOLDS.RISK_LEVELS.includes(m.riskLevel);

    // Below optimal spend and marginal ROI is good
    const belowOptimal = optimal && 
      m.currentBudget < optimal.optimalSpend * 0.8 &&
      optimal.marginalROI >= 0.7;

    return (roiInRange && marginInRange && successOk && ordersOk && riskOk) || belowOptimal;
  }

  private createScaleUpModerateDecision(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null,
    reinvestmentFund: number
  ): ScaleDecision {
    const scaleRate = SCALE_UP_MODERATE_THRESHOLDS.SCALE_RATE;
    
    // Use optimal spend as target if available
    let targetBudget = m.currentBudget * (1 + scaleRate);
    
    if (optimal && optimal.suggestedSpend > m.currentBudget) {
      // Cap at optimal's suggested spend (which is already capped at 20%)
      targetBudget = Math.min(targetBudget, optimal.suggestedSpend);
    }

    const newBudget = Math.min(
      targetBudget,
      SCALE_UP_MODERATE_THRESHOLDS.MAX_BUDGET
    );

    const budgetNeeded = newBudget - m.currentBudget;
    const recommendHorizontal = reinvestmentFund > budgetNeeded * 2;

    return {
      action: 'SCALE_UP_MODERATE',
      newBudget,
      reason: `Tăng +${(scaleRate * 100).toFixed(0)}% - ROI: ${m.roi.toFixed(0)}%, Marginal ROI: ${optimal ? (optimal.marginalROI * 100).toFixed(0) + '%' : 'N/A'}`,
      confidence: 80,
      metrics: m,
      expectedROI: m.roi * 0.98,
      expectedProfit: newBudget * (m.roi * 0.98) / 100,
      optimalSpend: optimal?.optimalSpend,
      diminishingReturnsPoint: optimal?.diminishingReturnsPoint,
      recommendHorizontalScaling: recommendHorizontal,
      horizontalScalingReason: recommendHorizontal 
        ? `Còn dư ${((reinvestmentFund - budgetNeeded) / 1_000_000).toFixed(1)}M - có thể tạo thêm nhóm quảng cáo`
        : undefined
    };
  }

  // ============= SCALE UP AGGRESSIVE =============

  private shouldScaleUpAggressive(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null
  ): boolean {
    const roiOk = m.roi >= SCALE_UP_AGGRESSIVE_THRESHOLDS.ROI_MIN;
    const marginOk = m.profitMargin >= SCALE_UP_AGGRESSIVE_THRESHOLDS.PROFIT_MARGIN_MIN;
    const successOk = m.successRate >= SCALE_UP_AGGRESSIVE_THRESHOLDS.SUCCESS_RATE_MIN;
    const ordersOk = m.totalOrders_7days >= SCALE_UP_AGGRESSIVE_THRESHOLDS.MIN_ORDERS_7DAYS;
    const riskOk = m.riskLevel === SCALE_UP_AGGRESSIVE_THRESHOLDS.RISK_LEVEL;
    const trendOk = m.profitTrend === SCALE_UP_AGGRESSIVE_THRESHOLDS.PROFIT_TREND;

    // High marginal ROI from optimal spend analysis
    const highMarginalROI = optimal && optimal.marginalROI >= 1.0;

    return (roiOk && marginOk && successOk && ordersOk && riskOk && trendOk) || highMarginalROI;
  }

  private createScaleUpAggressiveDecision(
    m: AggregatedMetrics,
    optimal: OptimalSpendResult | null,
    reinvestmentFund: number
  ): ScaleDecision {
    const scaleRate = SCALE_UP_AGGRESSIVE_THRESHOLDS.SCALE_RATE;  // Fixed 20%
    
    let targetBudget = m.currentBudget * (1 + scaleRate);
    
    if (optimal && optimal.suggestedSpend > m.currentBudget) {
      targetBudget = Math.min(targetBudget, optimal.suggestedSpend);
    }

    const newBudget = Math.min(
      targetBudget,
      SCALE_UP_AGGRESSIVE_THRESHOLDS.MAX_BUDGET
    );

    const budgetNeeded = newBudget - m.currentBudget;
    const recommendHorizontal = reinvestmentFund > budgetNeeded * 2;

    return {
      action: 'SCALE_UP_AGGRESSIVE',
      newBudget,
      reason: `Excellent! Tăng +${(scaleRate * 100).toFixed(0)}% (max safe) - ROI: ${m.roi.toFixed(0)}%, Trend: ${m.profitTrend}`,
      confidence: 90,
      metrics: m,
      expectedROI: m.roi * 0.95,
      expectedProfit: newBudget * (m.roi * 0.95) / 100,
      optimalSpend: optimal?.optimalSpend,
      diminishingReturnsPoint: optimal?.diminishingReturnsPoint,
      recommendHorizontalScaling: recommendHorizontal,
      horizontalScalingReason: recommendHorizontal
        ? `Còn dư ${((reinvestmentFund - budgetNeeded) / 1_000_000).toFixed(1)}M - nên tạo thêm nhóm quảng cáo tương tự`
        : undefined
    };
  }
}
