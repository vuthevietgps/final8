/**
 * Auto Scale Decision Service (Refactored)
 *
 * Service chính để quyết định scale/kill cho ad groups
 *
 * ## Cấu trúc mới:
 * - Sử dụng OptimalSpendCalculatorService để tính chi phí tối ưu
 * - Sử dụng ScaleRulesService cho các rules cơ bản
 * - Sử dụng PhaseRulesService cho rules theo testing phase
 *
 * ## Flow:
 * 1. Cashflow Safety Checks (CSI, DSO, Return Rate)
 * 2. Calculate Optimal Spend (diminishing returns analysis)
 * 3. Apply Phase-specific Rules
 * 4. Apply Learning Phase Protection (max 20% increase)
 * 5. Return final decision
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdGroup, AdGroupDocument } from '../../ad-group/schemas/ad-group.schema';
import { AdGroupDailyReportService } from '../ad-group-daily-report.service';
import { CapitalAllocationService } from '../capital-allocation.service';
import { CashflowSafetyService } from '../cashflow-safety.service';
import { QualityControlService } from '../../advertising-optimization/quality-control/quality-control.service';

// Import from refactored modules
import {
  AggregatedMetrics,
  ScaleDecision,
  FrequencyCheck,
  OptimalSpendResult,
  TestingPhase
} from './interfaces';
import { OptimalSpendCalculatorService } from './optimal-spend-calculator.service';
import { PhaseRulesService } from './phase-rules.service';

// Re-export interfaces for backward compatibility
export { AggregatedMetrics, ScaleDecision, FrequencyCheck } from './interfaces';

// Constants
const MAX_SAFE_INCREASE_RATE = 0.20;
const LEARNING_PHASE_INCREASE_RATE = 0.15;

@Injectable()
export class AutoScaleDecisionService {
  private readonly logger = new Logger(AutoScaleDecisionService.name);

  constructor(
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    private readonly adGroupDailyReportService: AdGroupDailyReportService,
    private readonly capitalAllocationService: CapitalAllocationService,
    private readonly cashflowSafetyService: CashflowSafetyService,
    private readonly qualityControlService: QualityControlService,
    private readonly optimalSpendCalculator: OptimalSpendCalculatorService,
    private readonly phaseRulesService: PhaseRulesService,
  ) {}

  /**
   * Quyết định scale/kill cho một ad group
   *
   * Priority Order:
   * 1. Cashflow Safety (CSI, DSO, Return Rate)
   * 2. Optimal Spend Analysis
   * 3. Phase-specific Rules
   * 4. Learning Phase Protection
   */
  async makeDecision(adGroupId: string, currentBudget: number): Promise<ScaleDecision> {
    try {
      // 0. Get ad group info
      const adGroup = await this.adGroupModel.findOne({ adGroupId });

      if (!adGroup) {
        throw new Error(`Ad group ${adGroupId} not found`);
      }

      // Check manual override
      if (adGroup.isManualOverride) {
        return this.createManualOverrideDecision(currentBudget, adGroup.manualOverrideReason);
      }

      // ===== STEP 1: CASHFLOW SAFETY CHECKS =====
      const cashflowDecision = await this.checkCashflowSafety(currentBudget);
      if (cashflowDecision) {
        return cashflowDecision;
      }

      // ===== STEP 2: CALCULATE OPTIMAL SPEND =====
      const optimalSpend = await this.optimalSpendCalculator.calculateOptimalSpend(
        adGroupId,
        currentBudget,
        30  // Last 30 days
      );

      // ===== STEP 3: GET AGGREGATED METRICS =====
      const metrics = await this.getAggregatedMetrics(adGroupId, currentBudget, adGroup);

      // ===== STEP 4: GET REINVESTMENT FUND =====
      const capitalAllocation = await this.capitalAllocationService.computeAllocation();
      const reinvestmentFund = capitalAllocation.reinvestmentAmount || 0;

      // ===== STEP 5: CHECK FREQUENCY =====
      const frequencyCheck = this.checkFrequencyBeforeScale(
        adGroup.frequency || 0,
        adGroup.reach || 0,
        adGroup.audienceSize || 1_000_000
      );

      if (!frequencyCheck.canScale && frequencyCheck.action !== 'KILL') {
        return this.createFrequencyBlockedDecision(currentBudget, metrics, frequencyCheck);
      }

      // ===== STEP 6: APPLY PHASE RULES WITH OPTIMAL SPEND =====
      const phase = this.phaseRulesService.determinePhase(adGroup.daysSinceLaunch || 999);

      let decision = this.phaseRulesService.applyPhaseRules(
        metrics,
        optimalSpend,
        reinvestmentFund,
        phase,
        adGroup.daysSinceLaunch || 999
      );

      // Add optimal spend info to decision
      decision.optimalSpend = optimalSpend.optimalSpend;
      decision.optimalSpendReason = optimalSpend.reason;
      decision.diminishingReturnsPoint = optimalSpend.diminishingReturnsPoint;

      // ===== STEP 7: APPLY FREQUENCY CAP =====
      if (decision.action.includes('SCALE_UP') && frequencyCheck.maxScaleRate) {
        decision = this.applyFrequencyCap(decision, currentBudget, frequencyCheck);
      }

      // ===== STEP 8: APPLY LEARNING PHASE PROTECTION =====
      if (decision.action.includes('SCALE_UP')) {
        decision = this.applyLearningPhaseProtection(
          decision,
          currentBudget,
          adGroup.daysSinceLaunch || 999,
          metrics
        );
      }

      return decision;
    } catch (error) {
      this.logger.error(`Failed to make decision for ${adGroupId}:`, error);
      return this.createErrorFallbackDecision(currentBudget);
    }
  }

  /**
   * Batch process multiple ad groups
   */
  async makeDecisions(adGroupIds: string[]): Promise<Map<string, ScaleDecision>> {
    const results = new Map<string, ScaleDecision>();

    for (const adGroupId of adGroupIds) {
      const adGroup = await this.adGroupModel.findOne({ adGroupId });
      const currentBudget = adGroup?.dailyBudget || 0;

      const decision = await this.makeDecision(adGroupId, currentBudget);
      results.set(adGroupId, decision);
    }

    return results;
  }

  // ===== CASHFLOW SAFETY =====

  private async checkCashflowSafety(currentBudget: number): Promise<ScaleDecision | null> {
    // Check CSI
    const csiResult = await this.cashflowSafetyService.calculateCSI();

    if (csiResult.CSI < 0.7) {
      return {
        action: 'SCALE_DOWN',
        newBudget: currentBudget * 0.50,
        reason: `🚨 CSI ${csiResult.CSI.toFixed(2)} CRITICAL - Emergency 50% reduction`,
        confidence: 99,
        cashflowProtection: true,
        alert: '🚨 CASHFLOW EMERGENCY',
        protectionAction: 'CRITICAL_CASH_SHORTAGE',
        systemLocked: true,
        metrics: null as any
      };
    }

    if (csiResult.CSI < 1.0) {
      return {
        action: 'MAINTAIN',
        newBudget: currentBudget,
        reason: `⚠️ CSI ${csiResult.CSI.toFixed(2)} - Scaling DISABLED`,
        confidence: 95,
        cashflowProtection: true,
        metrics: null as any
      };
    }

    // Check DSO
    const dsoResult = await this.cashflowSafetyService.calculateDSO();

    if (dsoResult.level === 'CRITICAL') {
      return {
        action: 'MAINTAIN',
        newBudget: currentBudget,
        reason: `⚠️ DSO ${dsoResult.DSO.toFixed(1)} days > 15 - STOP SCALE`,
        confidence: 95,
        cashflowProtection: true,
        alert: '⚠️ DSO CRITICAL',
        protectionAction: 'STOP_SCALE',
        systemLocked: true,
        metrics: null as any
      };
    }

    // Check System Return Rate
    const returnRateResult = await this.cashflowSafetyService.getSystemReturnRate();

    if (returnRateResult.level === 'CATASTROPHIC') {
      return {
        action: 'KILL',
        newBudget: 0,
        reason: 'Return rate exceeds catastrophic threshold (35%). System locked to protect cashflow. Forced kill for low ROI.',
        confidence: 99,
        cashflowProtection: true,
        alert: 'EMERGENCY_RETURN_PROTECTION',
        protectionAction: 'EMERGENCY_RETURN_PROTECTION',
        systemLocked: true,
        metrics: null as any
      };
    }

    return null;  // No cashflow issues
  }

  // ===== FREQUENCY CHECK =====

  private checkFrequencyBeforeScale(
    frequency: number,
    reach: number,
    audienceSize: number
  ): FrequencyCheck {

    // High Frequency = Audience Fatigue
    if (frequency >= 2.5) {
      return {
        canScale: false,
        reason: `Frequency quá cao (${frequency.toFixed(2)}). Audience đã bão hòa`,
        recommendation: 'HORIZONTAL_SCALE',
        action: 'MAINTAIN'
      };
    }

    // Medium Frequency
    if (frequency >= 1.5 && frequency < 2.5) {
      const reachRate = reach / audienceSize;

      if (reachRate < 0.3) {
        return {
          canScale: true,
          maxScaleRate: 0.15,
          reason: `Frequency ${frequency.toFixed(2)}, reach ${(reachRate * 100).toFixed(0)}%`,
          action: 'SCALE_UP_MODERATE'
        };
      }

      return {
        canScale: false,
        reason: 'Đã reach >30% audience với frequency cao',
        recommendation: 'HORIZONTAL_SCALE',
        action: 'MAINTAIN'
      };
    }

    // Low Frequency = Healthy
    if (frequency < 1.5) {
      return {
        canScale: true,
        maxScaleRate: MAX_SAFE_INCREASE_RATE,
        reason: `Frequency thấp (${frequency.toFixed(2)}) - có thể scale`,
        action: 'SCALE_UP_AGGRESSIVE'
      };
    }

    return {
      canScale: true,
      maxScaleRate: MAX_SAFE_INCREASE_RATE,
      reason: 'Normal frequency',
      action: 'SCALE_UP_MODERATE'
    };
  }

  // ===== APPLY CAPS & PROTECTIONS =====

  private applyFrequencyCap(
    decision: ScaleDecision,
    currentBudget: number,
    frequencyCheck: FrequencyCheck
  ): ScaleDecision {
    const maxIncrease = currentBudget * frequencyCheck.maxScaleRate!;
    const cappedBudget = Math.min(
      decision.newBudget,
      currentBudget + maxIncrease
    );

    if (cappedBudget < decision.newBudget) {
      decision.reason += ` (Capped by frequency: max +${(frequencyCheck.maxScaleRate! * 100).toFixed(0)}%)`;
      decision.newBudget = cappedBudget;
    }

    return decision;
  }

  private applyLearningPhaseProtection(
    decision: ScaleDecision,
    currentBudget: number,
    daysSinceLaunch: number,
    metrics: AggregatedMetrics
  ): ScaleDecision {
    const maxSafeIncrease = daysSinceLaunch < 30
      ? LEARNING_PHASE_INCREASE_RATE
      : MAX_SAFE_INCREASE_RATE;

    const increaseRate = (decision.newBudget - currentBudget) / currentBudget;

    if (increaseRate > maxSafeIncrease) {
      const safeNewBudget = currentBudget * (1 + maxSafeIncrease);
      const daysNeeded = Math.ceil(increaseRate / maxSafeIncrease);

      return {
        action: 'SCALE_UP_GRADUAL',
        newBudget: safeNewBudget,
        reason: `${decision.reason} (Gradual Day 1/${daysNeeded} to avoid learning reset)`,
        confidence: decision.confidence,
        metrics,
        remainingIncrease: decision.newBudget - safeNewBudget,
        scheduleNextIncrease: true,
        targetBudget: decision.newBudget,
        optimalSpend: decision.optimalSpend,
        optimalSpendReason: decision.optimalSpendReason
      };
    }

    return decision;
  }

  // ===== HELPER DECISIONS =====

  private createManualOverrideDecision(currentBudget: number, reason?: string): ScaleDecision {
    return {
      action: 'MAINTAIN',
      newBudget: currentBudget,
      reason: `Manual override: ${reason || 'No auto-scale'}`,
      confidence: 100,
      metrics: null as any
    };
  }

  private createFrequencyBlockedDecision(
    currentBudget: number,
    metrics: AggregatedMetrics,
    frequencyCheck: FrequencyCheck
  ): ScaleDecision {
    return {
      action: frequencyCheck.action,
      newBudget: currentBudget,
      reason: frequencyCheck.reason,
      confidence: 95,
      metrics,
      recommendHorizontalScaling: frequencyCheck.recommendation === 'HORIZONTAL_SCALE',
      horizontalScalingReason: frequencyCheck.reason
    };
  }

  private createErrorFallbackDecision(currentBudget: number): ScaleDecision {
    return {
      action: 'MAINTAIN',
      newBudget: currentBudget,
      reason: 'Error occurred - maintaining current budget',
      confidence: 0,
      metrics: null as any
    };
  }

  // ===== GET METRICS =====

  private async getAggregatedMetrics(
    adGroupId: string,
    currentBudget: number,
    adGroup: AdGroupDocument
  ): Promise<AggregatedMetrics> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const summary = await this.adGroupDailyReportService.getAdGroupDailyReport({
      adGroupId,
      fromDate: startDate.toISOString().split('T')[0],
      toDate: endDate.toISOString().split('T')[0]
    });

    const reports = summary?.details || [];

    if (reports.length === 0) {
      return this.createDefaultMetrics(adGroupId, currentBudget, adGroup);
    }

    // Calculate aggregates
    const totalAdsCost = reports.reduce((sum, r) => sum + (r.adsCost || 0), 0);
    const totalNetProfit = reports.reduce((sum, r) => sum + (r.netProfit || 0), 0);
    const totalRevenue = totalNetProfit > 0 ? totalNetProfit / 0.4 : 0;

    const roi = totalAdsCost > 0 ? (totalNetProfit / totalAdsCost) * 100 : 0;
    const roas = totalAdsCost > 0 ? totalRevenue / totalAdsCost : 0;
    const profitMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

    // Calculate trend
    const recentProfit = reports.slice(0, 3).reduce((sum, r) => sum + (r.netProfit || 0), 0);
    const olderProfit = reports.slice(3, 7).reduce((sum, r) => sum + (r.netProfit || 0), 0);
    const profitTrend = recentProfit > olderProfit * 1.1 ? 'INCREASING' :
                       recentProfit < olderProfit * 0.9 ? 'DECREASING' : 'STABLE';

    // Consecutive loss days
    let consecutiveLossDays = 0;
    for (const report of reports) {
      if ((report.netProfit || 0) < 0) {
        consecutiveLossDays++;
      } else {
        break;
      }
    }

    // Risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    let predictionAccuracy = 0;

    try {
      const safetyCheck = await this.qualityControlService.performSafetyCheck(adGroupId);
      riskLevel = safetyCheck.riskLevel;

      const qualityMetrics = await this.qualityControlService.getQualityMetrics(adGroupId);
      predictionAccuracy = qualityMetrics.recentAccuracy || 0;
    } catch {
      this.logger.warn(`Failed to get quality metrics for ${adGroupId}`);
    }

    return {
      adGroupId,
      currentBudget,
      roi,
      roas,
      profitMargin,
      totalOrders_7days: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      successRate: 100,
      returnRate: 0,
      profitTrend,
      consecutiveLossDays,
      riskLevel,
      predictionAccuracy,
      testingPhase: adGroup.testingPhase || 'MATURE',
      daysSinceLaunch: adGroup.daysSinceLaunch || 999,
      frequency: adGroup.frequency,
      reach: adGroup.reach,
      audienceSize: adGroup.audienceSize,
      historicalSpends: reports.map(r => r.adsCost || 0),
      historicalProfits: reports.map(r => r.netProfit || 0)
    };
  }

  private createDefaultMetrics(
    adGroupId: string,
    currentBudget: number,
    adGroup: AdGroupDocument
  ): AggregatedMetrics {
    return {
      adGroupId,
      currentBudget,
      roi: 0,
      roas: 0,
      profitMargin: 0,
      totalOrders_7days: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      successRate: 0,
      returnRate: 0,
      profitTrend: 'STABLE',
      consecutiveLossDays: 0,
      riskLevel: 'HIGH',
      predictionAccuracy: 0,
      testingPhase: adGroup?.testingPhase || 'MATURE',
      daysSinceLaunch: adGroup?.daysSinceLaunch || 999
    };
  }
}
