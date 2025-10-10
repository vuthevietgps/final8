/**
 * Interfaces cho chức năng Dự kiến vs Thực tế lợi nhuận & chi phí quảng cáo.
 */

export interface ProfitForecastRow {
  date: string; // YYYY-MM-DD
  adGroupId: string;
  maturedRevenue: number;
  maturedProfit: number;
  maturedOrderCount: number;
  projectedRevenue: number;
  projectedProfit: number;
  projectedOrderCount: number;
  modelVersion: number;
  spend: number;
  blendedRevenue: number;
  blendedProfit: number;
  blendedROAS: number;
  maturedROAS: number;
  confidence: number; // 0..1
  calibrationError: number; // 0..1
}

export interface ProfitForecastSummaryRow {
  date: string;
  maturedRevenue: number;
  maturedProfit: number;
  projectedRevenue: number;
  projectedProfit: number;
  spend: number;
  blendedRevenue: number;
  blendedProfit: number;
  maturedROAS: number;
  blendedROAS: number;
  blendedMargin: number;
}

export interface ProfitForecastSummaryResult {
  rows: ProfitForecastSummaryRow[];
  summary: {
    range: { from: string; to: string };
    maturedRevenue: number;
    maturedProfit: number;
    projectedRevenue: number;
    projectedProfit: number;
    spend: number;
    blendedRevenue: number;
    blendedProfit: number;
    maturedROAS: number;
    blendedROAS: number;
    blendedMargin: number;
  } | null;
}
