/**
 * File: features/ad-group-profit-report/models/ad-group-profit-report.model.ts
 * Mục đích: Định nghĩa interfaces cho báo cáo lợi nhuận quảng cáo theo ngày (giống sản phẩm)
 */

export type PeriodOptionValue = 'week' | '10days' | '30days' | 'lastMonth' | 'thisMonth' | 'custom';

export interface AdGroupDailyFilter {
  year?: number;
  period?: PeriodOptionValue;
  fromDate?: string;
  toDate?: string;
  adGroupId?: string;
}

export interface AdGroupDailyRow {
  adGroupId: string;
  adGroupName: string;
  dailyProfits: Record<string, number>;
  dailyCosts?: Record<string, number>;
  totalProfit: number;
}

export interface AdGroupDailyReport {
  dates: string[];
  data: AdGroupDailyRow[];
  summary?: {
    totalRevenue?: number;
    totalCost?: number;
    totalOrders?: number;
  };
}

// ROI and cashflow interfaces removed per request

export interface ChartDataPoint {
  date: string;
  profit: number;
  revenue: number;
  cost: number;
}

export interface AdGroupChartData {
  adGroupId: string;
  adGroupName: string;
  chartData: ChartDataPoint[];
}

export interface PeriodOption { value: PeriodOptionValue; label: string; }

// Daily cost/profit (Bảng 1)
export interface AdGroupDailyCostProfitRow {
  date: string;
  adGroupId: string;
  adGroupName: string;
  adCost: number;
  revenue: number;
  profit: number;
}

// Optimal spend suggestion (Bảng 2)
export interface AdGroupOptimalSpendRow {
  adGroupId: string;
  adGroupName: string;
  lastSpend: number;
  lastProfit: number;
  optimalSpend: number;
  appliedSpend: number;
}

// Profit 30d pivot (Bảng 3)
export interface Profit30dResponse {
  dates: string[];
  data: Array<{ adGroupId: string; adGroupName: string; dailyProfits: Record<string, number> }>;
}

// Horizontal scale suggestion (scale ads theo chiều ngang)
export interface HorizontalScaleSuggestion {
  adGroupId: string;
  adGroupName: string;
  lastSpend: number;
  lastProfit: number;
  optimalSpend: number;
  appliedSpend: number;
  overflow: number;
  recommendedGroups: number;
  recommendedBudgetPerGroup: number;
  recommendedTotal: number;
  availableFundsCapped: number | null;
  reason: string;
}

export interface HorizontalScaleResponse {
  availableFunds: number;
  count: number;
  data: HorizontalScaleSuggestion[];
}
