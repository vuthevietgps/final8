import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'ordertest2', timestamps: true })
export class TestOrder2 {
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  // Snapshot thời hạn sử dụng tại thời điểm tạo/cập nhật đơn
  @Prop({ type: Number, min: 1 })
  productUsageDurationMonths?: number;

  @Prop({ type: String })
  customerName?: string;

  @Prop({ type: Number, default: 1 })
  quantity?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  @Prop({ type: String, index: true })
  adGroupId?: string;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;

  @Prop({ type: String, default: 'Chưa làm' })
  productionStatus?: string;

  @Prop({ type: String, default: 'Chưa có mã vận đơn' })
  orderStatus?: string;

  @Prop({ type: String })
  serviceDetails?: string;

  @Prop({ type: String })
  submitLink?: string;

  @Prop({ type: String })
  trackingNumber?: string;

  @Prop({ type: Number, default: 0 })
  depositAmount?: number;

  @Prop({ type: Number, default: 0 })
  codAmount?: number;

  @Prop({ type: Number, default: 0 })
  manualPayment?: number;

  // Phí giao hàng và phí hoàn để tính công nợ
  @Prop({ type: Number, default: 0 })
  shippingFee?: number;

  @Prop({ type: Number, default: 0 })
  returnFee?: number;

  // COD thu hộ bởi nhà cung cấp khi giao thành công
  @Prop({ type: Number, default: 0 })
  codCollectedBySupplier?: number;

  // Báo giá nhà cung cấp và đại lý (tính toán sẵn)
  @Prop({ type: Number, default: 0 })
  supplierQuote?: number;

  // ============ AGENT QUOTE SNAPSHOT (Audit Trail) ============
  // Reference đến báo giá đại lý được sử dụng
  @Prop({ type: String })
  agentQuoteId?: string;

  // Snapshot giá đại lý tại thời điểm apply (không đổi sau khi set)
  @Prop({ type: Number, default: 0 })
  agentAppliedPrice?: number;

  // Thời điểm apply báo giá đại lý (để audit)
  @Prop({ type: Date })
  agentQuoteSnapshotAt?: Date;

  // Ngày đến hạn thanh toán đại lý (biweekly: ngày 1 hoặc 15)
  @Prop({ type: Date })
  agentPaymentDueDate?: Date;

  @Prop({ type: Number, default: 0 })
  agentQuote?: number;

  // Loại hàng / Phân loại sản phẩm
  @Prop({ type: String })
  productType?: string;

  @Prop({ type: Types.ObjectId, ref: 'Supplier' })
  supplierId?: Types.ObjectId;

  @Prop({ type: Number, enum: [1,2,3], default: 1 })
  supplierPriceLevel?: number;

  // ============ SUPPLIER QUOTE SNAPSHOT (Audit Trail) ============
  // Reference đến báo giá NCC được sử dụng
  @Prop({ type: Types.ObjectId, ref: 'SupplierQuote' })
  supplierQuoteId?: Types.ObjectId;

  // Snapshot giá NCC tại thời điểm apply (không đổi sau khi set)
  @Prop({ type: Number, default: 0 })
  supplierAppliedPrice?: number;

  // Thời điểm apply báo giá NCC (để audit)
  @Prop({ type: Date })
  supplierQuoteSnapshotAt?: Date;

  // Phí ship và phí hoàn từ quote NCC (snapshot)
  @Prop({ type: Number })
  supplierShippingFeeSnapshot?: number;

  @Prop({ type: Number })
  supplierReturnFeeSnapshot?: number;

  // Chính sách hoàn hàng từ quote NCC (snapshot tại thời điểm tạo đơn)
  // true = NCC nhận lại hàng & hoàn tiền hàng; false = NCC không nhận lại (mất giá hàng)
  @Prop({ type: Boolean })
  supplierIsReturnableSnapshot?: boolean;

  // ============ LỢI NHUẬN ƯỚC TÍNH (Accrual-based) ============
  // Tính ngay khi đơn hàng kết thúc (Giao thành công / Hàng hoàn)
  
  // Lợi nhuận gộp ước tính
  @Prop({ type: Number, default: 0 })
  grossProfit?: number;

  // Chi phí quảng cáo phân bổ cho đơn hàng này
  @Prop({ type: Number, default: 0 })
  advertisingCost?: number;

  // Chi phí nhân công phân bổ cho đơn hàng này
  @Prop({ type: Number, default: 0 })
  laborCostAllocation?: number;

  // Chi phí khác phân bổ cho đơn hàng này
  @Prop({ type: Number, default: 0 })
  otherCostAllocation?: number;

  // Lợi nhuận thuần ước tính
  @Prop({ type: Number, default: 0 })
  netProfit?: number;

  // ============ LỢI NHUẬN THỰC TẾ (Cash-based) ============
  // Chỉ tính khi ĐÃ THANH TOÁN CẢ 2 BÊN (NCC và Đại lý)
  
  @Prop({ type: Number })
  realizedGrossProfit?: number;  // Lợi nhuận gộp thực tế = supplierPaidAmount - agentPaidAmount

  @Prop({ type: Number })
  realizedNetProfit?: number;  // Lợi nhuận thuần thực tế = realizedGrossProfit - chi phí phân bổ

  @Prop({ type: Date })
  realizedAt?: Date;  // Ngày đã thanh toán xong cả 2 bên (tiền chắc ăn)

  @Prop({ type: String })
  receiverName?: string;

  @Prop({ type: String })
  receiverPhone?: string;

  @Prop({ type: String })
  receiverAddress?: string;

  @Prop({ type: Date })
  orderDate?: Date;

  // ============ ORDER-LEVEL PAYMENT TRACKING ============
  // Trạng thái thanh toán nhà cung cấp
  @Prop({ 
    type: String, 
    enum: ['pending', 'paid'], 
    default: 'pending',
    index: true 
  })
  supplierPaymentStatus?: string;  // 'pending' = Chưa thanh toán, 'paid' = Đã thanh toán

  @Prop({ type: String, index: true })
  supplierPaymentBatchId?: string;  // Mã phiếu thanh toán NCC (VD: "PTTT-NCC-2026-01-001")

  @Prop({ type: Date })
  supplierPaidAt?: Date;  // Ngày thanh toán NCC

  @Prop({ type: Number })
  supplierPaidAmount?: number;  // Số tiền NCC trả cho công ty (có thể âm nếu hàng hoàn)

  @Prop({ type: String })
  supplierPaymentNote?: string;  // Ghi chú thanh toán NCC

  @Prop({ type: [String], default: [] })
  supplierPaymentAttachments?: string[];  // Ảnh chứng từ thanh toán NCC (URLs)

  // Trạng thái thanh toán đại lý (hoa hồng)
  @Prop({ 
    type: String, 
    enum: ['pending', 'paid', 'n/a'], 
    default: 'n/a',
    index: true 
  })
  agentPaymentStatus?: string;  // 'pending' = Chưa trả, 'paid' = Đã trả, 'n/a' = Không có agent

  @Prop({ type: String, index: true })
  agentPaymentBatchId?: string;  // Mã phiếu thanh toán Agent (VD: "PTTT-AGENT-2026-01-001")

  @Prop({ type: Date })
  agentPaidAt?: Date;  // Ngày thanh toán hoa hồng

  @Prop({ type: Number })
  agentPaidAmount?: number;  // Số tiền hoa hồng đã trả

  @Prop({ type: String })
  agentPaymentNote?: string;  // Ghi chú thanh toán Agent

  @Prop({ type: [String], default: [] })
  agentPaymentAttachments?: string[];  // Ảnh chứng từ thanh toán Agent (URLs)

  // ============ CFO SPEC v2.0: Mốc tính aging & snapshot ============
  
  @Prop({ type: Date, index: true })
  agentEligibleAt?: Date;  // Ngày đủ điều kiện phát sinh công nợ đại lý (khi orderStatus chuyển sang completed)

  @Prop({ type: Number })
  agentCommissionFinal?: number;  // Hoa hồng cuối cùng đã chốt (snapshot, không đổi sau khi set)

  @Prop({ type: Boolean, default: false })
  confirmOverThreshold?: boolean;  // Đã xác nhận thanh toán vượt ngưỡng 5M

  @Prop({ type: String })
  confirmedBy?: string;  // User ID người xác nhận (nếu > 5M)

  @Prop({ type: Date })
  confirmedAt?: Date;  // Thời điểm xác nhận (nếu > 5M)

  // timestamps (added for proper TypeScript typing)
  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export type TestOrder2Document = HydratedDocument<TestOrder2>;
export const TestOrder2Schema = SchemaFactory.createForClass(TestOrder2);

// Indexes for performance optimization
TestOrder2Schema.index({ trackingNumber: 1 });
TestOrder2Schema.index({ adGroupId: 1, orderDate: 1 });
TestOrder2Schema.index({ orderDate: 1 }); // For recalculation queries
TestOrder2Schema.index({ supplierQuoteId: 1 }); // Audit trail - trace orders by quote
