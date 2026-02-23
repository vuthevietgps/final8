import { IsArray, IsString, IsOptional, IsDateString, IsNumber, IsBoolean } from 'class-validator';

export class CreateSupplierPaymentBatchDto {
  @IsArray()
  @IsString({ each: true })
  orderIds!: string[];

  @IsString()
  batchId!: string;  // VD: "SUPP-2026-01-001"

  @IsDateString()
  paidDate!: string;

  @IsOptional()
  @IsNumber()
  paidAmount?: number;  // Optional: override amount for all orders

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];  // URLs của ảnh chứng từ

  @IsOptional()
  @IsBoolean()
  confirmOverThreshold?: boolean; // Xác nhận khi vượt ngưỡng 5 triệu
}

export class CreateAgentPaymentBatchDto {
  @IsArray()
  @IsString({ each: true })
  orderIds!: string[];

  @IsString()
  batchId!: string;  // VD: "AGENT-2026-01-001"

  @IsDateString()
  paidDate!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];  // URLs của ảnh chứng từ
}

export class PaymentBatchSummary {
  batchId!: string;
  paidDate!: Date;
  orderCount!: number;
  totalAmount!: number;
  note?: string;
  orders?: any[];
}

// ============ SUPPLIER PAYMENT OPS SUMMARY ============

export const SUPPLIER_PAYMENT_ALERT_THRESHOLD = 5_000_000; // 5 triệu VNĐ

export type AgingBucket = '0_7' | '8_14' | '15_plus';

export interface AgingAmount {
  bucket: AgingBucket;
  orderCount: number;
  amount: number;
}

export interface SupplierPaymentSummary {
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
  
  pendingAging: { bucket: AgingBucket; amount: number }[];
  
  isOverThreshold: boolean; // pendingAmount > 5m
}

export interface SupplierPaymentOpsSummary {
  pending: SupplierPaymentSummary;
  paid: SupplierPaymentSummary;
  
  pendingAging: AgingAmount[];
  
  bySupplier: SupplierBreakdown[];
  
  threshold: number;
  asOfDate: string;
  timezone: string;
}
