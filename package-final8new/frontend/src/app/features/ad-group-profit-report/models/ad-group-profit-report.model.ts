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

export interface AdGroupRef { id: string; name: string; }

export interface AdGroupDailyRow {
  adGroupId: string;
  adGroupName: string;
  dailyProfits: { [date: string]: number };
  dailyCosts?: { [date: string]: number };
  totalProfit: number;
  totalRevenue: number;
  totalCost: number;
  totalOrders: number;
}

export interface AdGroupDailyReport {
  adGroups: AdGroupRef[];
  dates: string[];
  data: AdGroupDailyRow[];
  summary: {
    totalProfit: number;
    totalRevenue: number;
    totalCost: number;
    totalOrders: number;
  };
}

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
