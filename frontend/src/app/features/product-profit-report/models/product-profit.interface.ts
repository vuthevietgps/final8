/**
 * File: product-profit-report/models/product-profit.interface.ts
 * Mục đích: Interface cho dữ liệu báo cáo lợi nhuận sản phẩm theo ngày
 */

export interface ProductProfitFilter {
  year?: number;
  period?: 'week' | '10days' | '30days' | 'lastMonth' | 'thisMonth' | 'custom';
  fromDate?: string;
  toDate?: string;
  productName?: string;
}

export interface Product {
  _id: string;
  name: string;
}

export interface ProductProfitRow {
  productId: string;
  productName: string;
  dailyProfits: { [date: string]: number };
  totalProfit: number;
  totalRevenue: number;
  totalCost: number;
  totalQuantity: number;
}

export interface ProductProfitReport {
  products: Product[];
  dates: string[];
  data: ProductProfitRow[];
  summary: {
    totalProfit: number;
    totalRevenue: number;
    totalCost: number;
    totalQuantity: number;
  };
}

// Weekly/Monthly aggregate view
export interface ProductPeriodicalRow {
  productName: string;
  periodKey: string; // YYYY-WW or YYYY-MM
  periodLabel: string;
  revenue: number;
  adCost: number;
  profit: number;
  netCash: number;
  orders: number;
  weekStart?: string;
  weekEnd?: string;
  year?: number;
  month?: number;
}

export interface ProductPeriodicalResponse {
  period: { from: string | null; to: string | null };
  summary: {
    revenue: number;
    adCost: number;
    profit: number;
    netCash: number;
    orders: number;
  };
  items: ProductPeriodicalRow[];
}

export interface ChartDataPoint {
  date: string;
  profit: number;
  revenue: number;
  cost: number;
}

export interface ProductChartData {
  productId: string;
  productName: string;
  chartData: ChartDataPoint[];
}
