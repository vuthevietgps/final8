export interface Summary5 {
  _id: string;
  testOrder2Id: string;
  orderDate: string;
  customerName: string;
  product: string;
  quantity: number;
  agentName: string;
  adGroupId: string;
  isActive: boolean;
  serviceDetails?: string;
  productionStatus: string;
  orderStatus: string;
  submitLink?: string;
  trackingNumber?: string;
  depositAmount: number;
  codAmount: number;
  agentId: string;
  productId: string;
  approvedQuotePrice: number;
  mustPayToCompany: number;
  paidToCompany: number;
  manualPayment: number;
  needToPay: number;
  // extra
  adCost: number;
  laborCost: number;
  otherCost: number;
  costOfGoods: number;
  revenue: number;
  profit: number;
}

export interface Summary5Filter {
  agentId?: string;
  productId?: string;
  productionStatus?: string;
  orderStatus?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface Summary5Response {
  data: Summary5[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Summary5Stats {
  totalRecords: number;
  totalAdCost: number;
  totalLaborCost: number;
  totalOtherCost: number;
  totalCostOfGoods: number;
  totalRevenue: number;
  totalProfit: number;
}
