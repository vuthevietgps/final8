export type ReturnReportType = 'adGroup' | 'product';

export interface ReturnRow {
  key: string;
  name?: string;
  totalOrders: number;
  returnOrders: number;
  returnRate: number;
  totalQty: number;
  returnQty: number;
  revenue: number;
  returnRevenue: number;
  cost: number;
  returnCost: number;
  cod: number;
  returnCod: number;
}

export interface ReturnReportFilter {
  fromDate?: string;
  toDate?: string;
  adGroupId?: string;
  productId?: string;
}
