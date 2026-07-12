/**
 * Interface cho báo cáo performance của từng Ad Group
 * Dùng để định danh chi phí và lợi nhuận thuần cho mỗi nhóm quảng cáo
 *
 * LƯU Ý: Chỉ tính đơn ĐÃ KẾT THÚC (Giao thành công + Hàng hoàn)
 * - Đơn hoàn sẽ có netProfit âm → ROI chính xác hơn
 * - Đơn đang giao không được tính → tránh lạc quan quá mức
 */

export interface AdGroupPerformance {
  adGroupId: string;
  adGroupName: string;

  // Metrics chính
  totalOrders: number;          // Tổng số đơn đã kết thúc (thành công + hoàn)
  successOrders: number;        // Số đơn giao thành công
  returnOrders: number;         // Số đơn hoàn hàng
  returnRate: number;           // Tỷ lệ hoàn hàng (%)
  totalRevenue: number;         // Tổng doanh thu (COD collected)
  totalCost: number;            // Tổng chi phí (product + shipping + ads)
  totalAdsSpent: number;        // Chi phí quảng cáo
  totalNetProfit: number;       // Lợi nhuận thuần = successProfit + returnLoss
  successProfit: number;        // Lợi nhuận từ đơn thành công
  returnLoss: number;           // Loss từ đơn hoàn (thường âm)

  // Performance metrics
  roi: number;                  // ROI = netProfit / adsSpent * 100
  profitMargin: number;         // Profit margin = netProfit / revenue * 100
  averageOrderValue: number;    // Giá trị trung bình đơn hàng
  conversionRate?: number;      // Tỷ lệ chuyển đổi (nếu có dữ liệu leads)

  // Phân loại theo trạng thái đơn hàng
  realizedProfit: number;       // Lợi nhuận từ đơn đã giao thành công
  pendingProfit: number;        // Lợi nhuận từ đơn đang giao
  riskyProfit: number;          // Lợi nhuận từ đơn mới tạo

  // Chi tiết đơn hàng theo trạng thái
  ordersByStatus: {
    status: string;
    count: number;
    revenue: number;
    profit: number;
  }[];

  // Thời gian
  startDate: Date;
  endDate: Date;
  daysInPeriod: number;

  // Metrics theo ngày
  avgDailyOrders: number;
  avgDailyRevenue: number;
  avgDailyProfit: number;
  avgDailySpent: number;
}

export interface OptimalSpendSuggestion {
  adGroupId: string;
  adGroupName: string;

  // Hiện tại
  lastSpend: number;            // Chi phí ads ngày gần nhất
  lastProfit: number;           // Lợi nhuận ngày gần nhất
  currentROI: number;           // ROI hiện tại (đã tính hàng hoàn)

  // Thống kê đơn hàng
  returnRate: number;           // Tỷ lệ hoàn hàng (%)
  totalOrders: number;          // Tổng đơn đã kết thúc
  successOrders: number;        // Đơn thành công
  returnOrders: number;         // Đơn hoàn

  // Gợi ý
  suggestedSpend: number;       // Chi phí đề xuất
  appliedSpend: number;         // Chi phí sau khi áp dụng constraints
  expectedProfit: number;       // Lợi nhuận kỳ vọng
  expectedROI: number;          // ROI kỳ vọng

  // Lý do
  scaleAction: 'increase' | 'decrease' | 'maintain' | 'kill';
  reason: string;
  confidence: number;           // 0-100%

  // Constraints
  minBudget: number;
  maxBudget: number;

  // Performance history (7 ngày gần nhất)
  last7Days: {
    date: string;
    spent: number;
    profit: number;
    roi: number;
    orders: number;
  }[];
}

export interface AdGroupProfitSummary {
  totalAdGroups: number;
  totalRevenue: number;
  totalProfit: number;
  totalAdsSpent: number;
  averageROI: number;

  // Top performers
  topByProfit: AdGroupPerformance[];
  topByROI: AdGroupPerformance[];

  // Low performers
  lowPerformers: AdGroupPerformance[];

  // Tổng hợp theo trạng thái
  profitByStatus: {
    realized: number;
    pending: number;
    risky: number;
  };
}

export type AdGroupProfitClassificationStatus =
  | 'profitable'
  | 'loss'
  | 'break_even'
  | 'insufficient_data';

export interface AdGroupProfitClassificationItem {
  adGroupId: string;
  name: string;
  platform: string | null;
  accountName: string | null;
  isActive: boolean;
  spend: number;
  leads: number;
  inbox: number;
  orders: number;
  revenue: number;
  grossProfit: number;
  netProfitAfterAds: number | null;
  roi: number | null;
  status: AdGroupProfitClassificationStatus;
  reason: string;
}

export interface AdGroupProfitClassificationReport {
  periodDays: number;
  dateRange: {
    from: string;
    to: string;
  };
  total: number;
  summary: {
    profitable: number;
    loss: number;
    breakEven: number;
    insufficientData: number;
  };
  groups: AdGroupProfitClassificationItem[];
  dataQuality: {
    syncOk: boolean | null;
    tokenIssues: number | null;
    attributionCoverage: number;
    notes: string[];
  };
}
