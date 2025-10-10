/**
 * File: features/ad-group-profit/models/ad-group-profit.interface.ts
 * Mục đích: Interface cho báo cáo lợi nhuận nhóm quảng cáo
 */

export interface AdGroupProfitReport {
  date: string; // Ngày tháng (YYYY-MM-DD)
  adGroupId: string; // ID nhóm quảng cáo
  adGroupName: string; // Tên nhóm quảng cáo
  adsCost: number; // Chi phí quảng cáo theo ngày (QC2)
  totalProfit: number; // Lợi nhuận tổng hợp
  orderCount: number; // Số đơn hàng
  totalQuantity: number; // Tổng số lượng
  totalRevenue: number; // Tổng doanh thu
}

export interface AdGroupProfitStats {
  totalProfit: number;
  totalOrders: number;
  totalAdGroups: number;
  avgProfitPerOrder: number;
}
