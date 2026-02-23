import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * SupplierPayable Schema
 * 
 * TERMINOLOGY CLARIFICATION (QUAN TRỌNG!):
 * ==========================================
 * Tên "supplier-payable" CÓ THỂ GÂY HIỂU NHẦM!
 * 
 * ❌ KHÔNG PHẢI: User nợ supplier (user phải trả supplier)
 * ✅ ĐÚNG LÀ: Supplier nợ user (supplier phải trả user)
 * 
 * MÔ HÌNH COMMISSION:
 * -------------------
 * 1. User chuyển order cho Supplier
 * 2. Supplier ship COD, thu tiền khách hàng
 * 3. Supplier GIỮ TIỀN (COD collected)
 * 4. Mỗi 10 ngày reconcile:
 *    - Supplier tính: COD - COGS = Commission
 *    - Supplier TRẢ TIỀN cho user
 * 
 * VÍ DỤ:
 * ------
 * Order: COD 1,000,000 đ, COGS 700,000 đ
 * - Supplier thu: 1,000,000 đ từ khách
 * - Supplier trả user: 300,000 đ (commission)
 * - totalAmount: 300,000 đ (số tiền supplier NỢ user)
 * - amountPaid: 0 đ (chưa trả)
 * - balance: 300,000 đ (còn nợ)
 * 
 * STATUS:
 * -------
 * - unpaid: Chưa reconcile, supplier chưa trả
 * - partial: Đã trả một phần
 * - paid: Đã trả đủ
 * 
 * ĐỀ XUẤT TÊN CHÍNH XÁC HƠN:
 * "SupplierReceivable" hoặc "PendingReconciliation"
 * (Nhưng giữ tên cũ để tránh breaking change)
 */

export type SupplierPayableDocument = SupplierPayable & Document;

@Schema({ _id: false, timestamps: false })
export class SupplierPayableItem {
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  @Prop()
  productNameSnap?: string;

  @Prop({ type: Number, default: 0 })
  quantity?: number;

  @Prop({ type: Number, default: 0 })
  unitPrice?: number;

  @Prop({ type: Number, default: 0 })
  amount?: number;
}

export const SupplierPayableItemSchema = SchemaFactory.createForClass(SupplierPayableItem);

@Schema({ _id: false, timestamps: false })
export class SupplierPayment {
  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: Date, required: true })
  paidAt!: Date;

  @Prop()
  method?: string; // chuyển khoản / tiền mặt

  @Prop()
  reference?: string; // mã giao dịch / phiếu chi

  @Prop()
  notes?: string;

  @Prop()
  createdBy?: string;
}

export const SupplierPaymentSchema = SchemaFactory.createForClass(SupplierPayment);

@Schema({ timestamps: true })
export class SupplierPayable {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  supplierId!: Types.ObjectId;  // Supplier đang GIỮ TIỀN chưa trả

  @Prop()
  supplierNameSnap?: string;

  @Prop({ type: Types.ObjectId, ref: 'TestOrder2', index: true })
  orderId?: Types.ObjectId;  // Order liên quan

  @Prop({ type: String, enum: ['draft', 'unpaid', 'partial', 'paid'], default: 'unpaid', index: true })
  status!: string;  // unpaid = supplier chưa trả, paid = đã trả

  @Prop({ type: [SupplierPayableItemSchema], default: [] })
  items!: SupplierPayableItem[];

  @Prop({ type: Number, default: 0 })
  totalAmount!: number;  // Tổng tiền supplier NỢ user (commission sau khi trừ COGS)

  @Prop({ type: Number, default: 0 })
  amountPaid!: number;  // Số tiền supplier đã TRẢ cho user

  @Prop({ type: Number, default: 0 })
  balance!: number;  // Số tiền supplier CÒN NỢ user

  @Prop({ type: String, default: 'VND' })
  currency!: string;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop()
  notes?: string;

  @Prop({ type: [SupplierPaymentSchema], default: [] })
  payments!: SupplierPayment[];
}

export const SupplierPayableSchema = SchemaFactory.createForClass(SupplierPayable);
SupplierPayableSchema.index({ supplierId: 1, dueDate: -1 });
