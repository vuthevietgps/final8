/**
 * File: ad-group-profit-report/dto/ad-group-profit-response.dto.ts
 * Mục đích: DTO cho response báo cáo lợi nhuận nhóm quảng cáo.
 */

export interface DailyProfit {
  date: string; // YYYY-MM-DD
  profit: number;
  revenue: number;
  cost: number;
  orders: number;
}

export interface AdGroupProfitData {
  adGroupId: string;
  adGroupName: string;
  productId: string;
  productName: string;
  agentId: string;
  agentName: string;
  platform: string;
  totalProfit: number;
  totalRevenue: number;
  totalCost: number;
  totalOrders: number;
  dailyProfits: DailyProfit[];
  avgDailyProfit: number;
  profitGrowthRate: number; // % tăng trưởng so với kỳ trước
}

export interface AdGroupProfitReportResponse {
  period: {
    fromDate: string;
    toDate: string;
    description: string;
  };
  summary: {
    totalAdGroups: number;
    totalProfit: number;
    totalRevenue: number;
    totalCost: number;
    totalOrders: number;
    avgProfitPerAdGroup: number;
    profitMargin: number; // % lợi nhuận = profit/revenue
  };
  dateColumns: string[]; // Danh sách ngày để hiển thị cột
  adGroups: AdGroupProfitData[];
}
