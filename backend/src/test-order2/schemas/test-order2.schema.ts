import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { OrderShipment, OrderShipmentSchema } from './order-shipment.schema';

@Schema({ collection: 'ordertest2', timestamps: true, optimisticConcurrency: true })
export class TestOrder2 {
  // Internal CRM promotion key; never accepted from the public order DTO.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TrackingLead', immutable: true }) trackingLeadId?: Types.ObjectId;
  @Prop({ type: [OrderShipmentSchema], default: [] }) shipments?: OrderShipment[];
  @Prop({ type: Number }) financialModelVersion?: number;
  @Prop({ type: Number }) deliveredQuantity?: number;
  @Prop({ type: Number }) dealerShippingCharges?: number;
  @Prop({ type: Number }) dealerReturnCharges?: number;
  @Prop({ type: Number }) supplierFreightObligation?: number;
  @Prop({ type: String, enum: ['supplier', 'inventory', 'dealer_custody'], default: 'supplier' })
  productSource?: string;

  @Prop({ type: Types.ObjectId, ref: 'InventoryBatch' })
  inventoryBatchId?: Types.ObjectId;

  @Prop({ type: Number, min: 0 })
  inventoryUnitCostSnapshot?: number;

  @Prop({ type: String })
  originalOrderId?: string;

  // Full agreed retail goods amount, independent of deposits and collection instructions.
  @Prop({ type: Number, min: 0 })
  retailSaleAmount?: number;

  @Prop({ type: String, enum: ['company', 'supplier', 'agent'] })
  senderKind?: string;
  @Prop({ type: String }) senderId?: string;
  @Prop({ type: String }) senderAddress?: string;
  @Prop({ type: Number, default: 0 }) receivedReturnQuantity?: number;

  @Prop({ type: String, enum: ['not_resellable', 'resellable', 'inspect'], default: 'inspect' })
  resalePolicySnapshot?: string;

  @Prop({ type: Number, min: 0, default: 0 })
  recoveredInventoryValue?: number;

  @Prop({ type: Number, min: 0 })
  dealerShippingFeeSnapshot?: number;

  @Prop({ type: Number, min: 0 })
  dealerReturnFeeSnapshot?: number;
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

  // Commercial buyer relationship. Internal agents represent the company;
  // only an external agent is a dealer buying goods from the company.
  @Prop({ type: String, enum: ['retail', 'dealer'], index: true })
  saleMode?: 'retail' | 'dealer';

  @Prop({ type: String, enum: ['internal_agent', 'external_agent'] })
  agentRoleSnapshot?: 'internal_agent' | 'external_agent';

  @Prop({ type: String, index: true })
  adGroupId?: string;

  @Prop({ type: String, enum: ['ads', 'non_ads'], index: true })
  customerAcquisitionSource?: 'ads' | 'non_ads';

  @Prop({ type: String, enum: ['google', 'facebook', 'tiktok'], index: true })
  adsProvider?: 'google' | 'facebook' | 'tiktok';

  @Prop({ type: String, trim: true, match: /^\d+$/, index: true })
  adAccountProviderId?: string;

  @Prop({ type: String, trim: true, match: /^\d+$/, index: true })
  adCampaignId?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  adAccountNameSnapshot?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  adCampaignNameSnapshot?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  adGroupNameSnapshot?: string;

  @Prop({ type: String, enum: ['windsor', 'erp_ad_group', 'manual'] })
  adsAttributionSource?: 'windsor' | 'erp_ad_group' | 'manual';

  @Prop({ type: Date })
  adsAttributionSyncedAt?: Date;

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

  // Dealer is the end customer of the company. Server-managed recognition/custody.
  @Prop({ type: Date })
  dealerSaleRecognizedAt?: Date;

  @Prop({ type: Date })
  dealerReturnedAt?: Date;

  @Prop({ type: String, enum: ['awaiting_dispatch', 'missing_quotes', 'recognized'] })
  dealerProfitState?: string;

  @Prop({ type: String, enum: ['dealer'] })
  goodsOwner?: string;

  @Prop({ type: String, enum: ['dealer_custody'] })
  returnDisposition?: string;

  @Prop({ type: Boolean, default: false })
  dealerShippingIncludedInPrice?: boolean;

  @Prop({ type: Number })
  recognizedRevenue?: number;

  @Prop({ type: Number })
  recognizedGoodsCost?: number;

  @Prop({ type: Number })
  dealerRecoverableFees?: number;

  @Prop({ type: Number })
  dealerReturnFeeReceivable?: number;

  // Contractual obligation, not an outstanding balance or actual receipt.
  @Prop({ type: Number })
  dealerContractAmount?: number;

  @Prop({ type: Number })
  supplierContractAmount?: number;

  @Prop({ type: String, enum: ['awaiting_delivery', 'missing_quotes', 'missing_sale_price', 'recognized'] })
  retailProfitState?: string;

  @Prop({ type: Number, default: 0 })
  depositAmount?: number;

  @Prop({ type: Number, default: 0 })
  codAmount?: number;

  @Prop({ type: Number, default: 0 })
  manualPayment?: number;

  // Phí giao hàng và phí hoàn để tính công nợ
  @Prop({ type: Number })
  shippingFee?: number;

  @Prop({ type: Number })
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

  @Prop({ type: Date })
  agentQuoteEffectiveAt?: Date;

  // Ngày đến hạn thanh toán đại lý (biweekly: ngày 1 hoặc 15)
  @Prop({ type: Date })
  agentPaymentDueDate?: Date;

  @Prop({ type: Number, default: 0 })
  agentQuote?: number;

  @Prop({ type: Number })
  agentCommissionAmount?: number; // Hoa hồng thuần phát sinh (Accrual basis)

  // Loại hàng / Phân loại sản phẩm
  @Prop({ type: String })
  productType?: string;

  // Immutable category identity used by historical product/category profit reports.
  @Prop({ type: Types.ObjectId, ref: 'ProductCategory' })
  productCategoryIdSnapshot?: Types.ObjectId;

  @Prop({ type: String })
  productCategoryNameSnapshot?: string;

  @Prop({ type: String })
  productCategoryCodeSnapshot?: string;

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

  @Prop({ type: Date })
  supplierQuoteEffectiveAt?: Date;

  @Prop({ type: String, enum: ['supplier_quote', 'product_fallback', 'inventory'] })
  supplierPriceSource?: string;

  @Prop({ type: Number, min: 0 })
  packagingCostSnapshot?: number;

  @Prop({ type: Date })
  costAllocatedAt?: Date;

  @Prop({ type: Date })
  costAllocationDate?: Date;

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

  @Prop({ type: Boolean, default: false })
  advertisingCostEstimated?: boolean;

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

  // Immutable canonical timestamp for the explicit business confirmation
  // transition. It is server-timed and never inferred from payment/delivery.
  @Prop({ type: Date, index: true })
  businessConfirmedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  businessConfirmedBy?: Types.ObjectId;

  @Prop({ type: String, enum: ['erp_manual_confirmation', 'pending_order_approval'] })
  businessConfirmationSource?: 'erp_manual_confirmation' | 'pending_order_approval';

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
TestOrder2Schema.index({ trackingLeadId: 1 }, { unique: true, sparse: true, name: 'order_tracking_lead_unique' });

// Indexes for performance optimization
TestOrder2Schema.index({ trackingNumber: 1 });
TestOrder2Schema.index({ adGroupId: 1, orderDate: 1 });
TestOrder2Schema.index({ adsProvider: 1, adAccountProviderId: 1, adCampaignId: 1, adGroupId: 1 });
TestOrder2Schema.index({ orderDate: 1 }); // For recalculation queries
TestOrder2Schema.index({ supplierQuoteId: 1 }); // Audit trail - trace orders by quote
