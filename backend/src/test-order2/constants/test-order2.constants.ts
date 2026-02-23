/**
 * Constants and Enums for TestOrder2 Module
 * 
 * IMPORTANT: Dùng constants thay vì magic strings để đảm bảo tính nhất quán
 */

// ============ ENUMS ============

export enum ProductionStatus {
  PENDING = 'Chưa làm',
  IN_PROGRESS = 'Đang làm',
  DONE = 'Đã trả kết quả',
}

export enum OrderStatus {
  NO_TRACKING = 'Chưa có mã vận đơn',
  SHIPPING = 'Đang giao',
  DELIVERED = 'Giao thành công',
  RETURNED = 'Hàng hoàn',
}

export enum ProductSource {
  INVENTORY = 'inventory',
  SUPPLIER = 'supplier',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  NOT_APPLICABLE = 'n/a',
}

export enum AgentRole {
  INTERNAL = 'internal_agent',
  EXTERNAL = 'external_agent',
}

// ============ ARRAYS FOR QUERY ============

/** Các trạng thái đơn hàng đã hoàn thành (có thể thanh toán)
 * NOTE: Sử dụng DeliveryStatusService.getPaymentTriggerStatusNames() để lấy dynamic
 * Constant này chỉ là fallback nếu chưa có data trong DB
 */
export const COMPLETED_ORDER_STATUSES: readonly string[] = [
  OrderStatus.DELIVERED,
  OrderStatus.RETURNED,
];

/** Trạng thái hoàn hàng (tính phí hoàn) */
export const RETURN_ORDER_STATUSES: readonly string[] = [
  OrderStatus.RETURNED,
];

// ============ PATTERNS ============

export const ORDER_STATUS_WITH_RETURN_KEYWORD = /hoàn/i;

// ============ DEFAULT VALUES ============

export const DEFAULT_VALUES = {
  QUANTITY: 1,
  DEPOSIT_AMOUNT: 0,
  COD_AMOUNT: 0,
  MANUAL_PAYMENT: 0,
  SHIPPING_FEE: 0,
  RETURN_FEE: 0,
  COD_COLLECTED_BY_SUPPLIER: 0,
  SUPPLIER_QUOTE: 0,
  AGENT_QUOTE: 0,
  ADVERTISING_COST: 0,
  LABOR_COST: 0,
  OTHER_COST: 0,
} as const;

// ============ AUTO-GENERATED NOTES ============

export const SUPPLIER_PAYABLE_AUTO_NOTE = 'Auto tạo công nợ khi Đã trả kết quả (TestOrder2)';
export const INVENTORY_ISSUE_REASON_PREFIX = 'Xuất cho đơn TestOrder2';

// ============ BATCH ID PREFIXES ============

export const BATCH_ID_PREFIX = {
  SUPPLIER: 'PTTT-NCC',
  AGENT: 'PTTT-AGENT',
} as const;
