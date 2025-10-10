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
