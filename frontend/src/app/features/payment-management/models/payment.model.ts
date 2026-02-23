export interface Order {
  _id: string;
  customerName?: string;
  trackingNumber?: string;
  quantity?: number;
  supplierId?: string;
  agentId?: string;
  supplierQuote?: number;
  agentQuote?: number;
  agentAppliedPrice?: number;
  orderDate?: string;
  orderStatus?: string;
  productionStatus?: string;
  
  // Payment amounts
  codAmount?: number;
  shippingFee?: number;
  returnFee?: number;
  
  // Supplier payment tracking
  supplierPaymentStatus?: 'pending' | 'paid';
  supplierPaymentBatchId?: string;
  supplierPaidAt?: string;
  supplierPaidAmount?: number;
  supplierPaymentNote?: string;
  
  // Agent payment tracking
  agentPaymentStatus?: 'pending' | 'paid' | 'n/a';
  agentPaymentBatchId?: string;
  agentPaidAt?: string;
  agentPaidAmount?: number;
  agentPaymentNote?: string;
  agentEligibleAt?: string;  // Ngày đủ điều kiện thanh toán
  agentCommissionFinal?: number;  // Snapshot hoa hồng cuối cùng
  
  // Timestamps
  updatedAt?: string;
  createdAt?: string;
  
  // UI helper
  selected?: boolean;
}

export interface PaymentBatch {
  batchId: string;
  paidDate: string;
  orderCount: number;
  totalAmount: number;
  note?: string;
  attachments?: string[]; // Link chứng từ thanh toán
}

export interface PendingOrdersResponse {
  orders: Order[];
  count: number;
  totalAmount?: number;
  totalCommission?: number;
}

// ============ SUPPLIER PAYMENT OPS SUMMARY ============

export const SUPPLIER_PAYMENT_ALERT_THRESHOLD = 5_000_000; // 5 triệu VNĐ

export interface AgingAmount {
  bucket: '0_7' | '8_14' | '15_plus';
  orderCount: number;
  amount: number;
}

export interface SupplierBreakdown {
  supplierId: string;
  supplierName: string;
  
  pendingOrderCount: number;
  pendingAmount: number;
  
  paidOrderCount: number;
  paidAmount: number;
  
  pendingAging: { bucket: string; amount: number }[];
  
  isOverThreshold: boolean; // pendingAmount > 5m
}

export interface SupplierPaymentOpsSummary {
  pending: { orderCount: number; amount: number };
  paid: { orderCount: number; amount: number };
  
  pendingAging: AgingAmount[];
  
  bySupplier: SupplierBreakdown[];
  
  threshold: number;
  asOfDate: string;
  timezone: string;
}
