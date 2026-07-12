/**
 * Interfaces cho Scale Decision System
 * Tách riêng để dễ maintain và import từ nhiều nơi
 */

export interface AggregatedMetrics {
  adGroupId: string;
  currentBudget: number;

  // Performance (7 days average)
  roi: number;
  roas: number;
  profitMargin: number;

  // Volume
  totalOrders_7days: number;
  deliveredOrders: number;
  returnedOrders: number;

  // Quality
  successRate: number;
  returnRate: number;

  // Trend
  profitTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
  consecutiveLossDays: number;

  // Risk
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  predictionAccuracy: number;

  // Testing Phase
  testingPhase?: 'TESTING' | 'GROWTH' | 'MATURE' | 'STABLE';
  daysSinceLaunch?: number;

  // Frequency
  frequency?: number;
  reach?: number;
  audienceSize?: number;

  // Historical data for optimal spend calculation
  historicalSpends?: number[];
  historicalProfits?: number[];
}

export interface ScaleDecision {
  action: 'KILL' | 'SCALE_DOWN' | 'MAINTAIN' | 'SCALE_UP_MODERATE' | 'SCALE_UP_AGGRESSIVE' | 'SCALE_UP_GRADUAL';
  newBudget: number;
  reason: string;
  confidence: number;
  metrics: AggregatedMetrics;
  expectedROI?: number;
  expectedProfit?: number;

  // Optimal spend info
  optimalSpend?: number;
  optimalSpendReason?: string;
  diminishingReturnsPoint?: number;

  // Gradual scaling
  remainingIncrease?: number;
  scheduleNextIncrease?: boolean;
  targetBudget?: number;

  // Horizontal scaling
  recommendHorizontalScaling?: boolean;
  horizontalScalingReason?: string;

  // Cashflow protection
  cashflowProtection?: boolean;
  alert?: string;
  protectionAction?: string;
  systemLocked?: boolean;
}

export interface FrequencyCheck {
  canScale: boolean;
  maxScaleRate?: number;
  recommendation?: 'HORIZONTAL_SCALE' | 'VERTICAL_SCALE';
  reason: string;
  action: 'KILL' | 'SCALE_DOWN' | 'MAINTAIN' | 'SCALE_UP_MODERATE' | 'SCALE_UP_AGGRESSIVE';
}

export interface OptimalSpendResult {
  optimalSpend: number;
  currentSpend: number;
  expectedProfit: number;
  expectedROI: number;
  confidence: number;

  // Diminishing returns analysis
  diminishingReturnsPoint: number;
  marginalROI: number;

  // Recommendation
  recommendation: 'SCALE_UP' | 'SCALE_DOWN' | 'MAINTAIN' | 'KILL';
  reason: string;

  // Safe scaling
  safeMaxSpend: number;  // Max 20% increase
  suggestedSpend: number;  // Optimal but capped at 20%
}

export interface SpendProfitDataPoint {
  spend: number;
  profit: number;
  orders: number;
  date: Date;
}

export type TestingPhase = 'TESTING' | 'GROWTH' | 'MATURE' | 'STABLE';
