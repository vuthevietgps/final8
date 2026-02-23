/**
 * File: shared/interfaces/quality-control.interface.ts
 * Mục đích: Shared interfaces cho Quality Control system
 */

export interface PredictionAccuracy {
  adGroupId: string;
  predictionDate: string;
  predictedProfit: number;
  actualProfit?: number;
  accuracyScore?: number;
  confidence: number;
  isValidated: boolean;
  validatedAt?: Date;
}

export interface QualityMetrics {
  overallAccuracy: number;
  recentAccuracy: number;
  predictionCount: number;
  validatedCount: number;
  riskScore: number;
}

export interface SafetyCheck {
  shouldPause: boolean;
  shouldReduceBudget: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
}

export interface DeliveryMetrics {
  successRate: number;
  avgDeliveryDays: number;
}

export interface OptimizationRecommendation {
  type: 'INCREASE' | 'DECREASE' | 'PAUSE' | 'MAINTAIN';
  suggestedBudget: number;
  confidence: number;
  reasoning: string;
  expectedProfit?: number;
  appliedAt?: Date;
  actualOutcome?: 'SUCCESS' | 'FAILED' | 'PENDING';
}

export interface AIAnalysisResult {
  recommendedAction: string;
  suggestedBudget: number;
  confidence: number;
  reasoning: string;
  expectedProfit: number;
  marketConditions?: string;
  riskFactors?: string[];
}