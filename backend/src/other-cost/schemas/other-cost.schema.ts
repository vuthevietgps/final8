/**
 * File: other-cost/schemas/other-cost.schema.ts
 * Mục đích: Schema Mongoose cho Chi Phí Khác (Operating Expenses).
 * 
 * CFO v3.1 Update:
 * - Thêm dueDate (required) để tính Committed Cash chính xác
 * - Thêm category để phân loại chi phí vận hành
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtherCostDocument = OtherCost & Document;

// Danh sách category chuẩn
export const OPS_CATEGORIES = [
  'rent',           // Thuê văn phòng/kho
  'utilities',      // Điện, nước, gas
  'internet',       // Internet, điện thoại
  'tools',          // Công cụ, phần mềm
  'shipping-fee',   // Phí vận chuyển
  'packaging',      // Đóng gói
  'maintenance',    // Bảo trì, sửa chữa
  'insurance',      // Bảo hiểm
  'legal',          // Pháp lý, tư vấn
  'marketing',      // Marketing (không phải ads)
  'travel',         // Công tác
  'office-supplies',// Văn phòng phẩm
  'other',          // Khác
] as const;

export type OpsCategory = typeof OPS_CATEGORIES[number];

@Schema({ timestamps: true })
export class OtherCost {
  @Prop({ type: Date, required: true })
  date: Date; // Ngày phát sinh chi phí

  @Prop({ type: Number, required: true, min: 0 })
  amount: number; // Số tiền chi phí

  /**
   * dueDate: Ngày đến hạn thanh toán (CFO v3.1 - REQUIRED)
   * - Quan trọng để tính Committed Cash chính xác
   * - Nếu không có → Free Cash và Forecast sẽ sai
   */
  @Prop({ type: Date, required: true })
  dueDate: Date;

  /**
   * category: Phân loại chi phí vận hành
   * - Dùng cho byCategory breakdown
   * - Default 'other' cho backward compatibility
   */
  @Prop({ 
    type: String, 
    enum: OPS_CATEGORIES,
    default: 'other',
    index: true 
  })
  category: OpsCategory;

  @Prop({ type: String, trim: true })
  notes?: string; // Ghi chú (không bắt buộc)

  @Prop({ type: String, trim: true })
  documentLink?: string; // Link chứng từ (text)

  /**
   * isConfirmed: Trạng thái xác nhận chi (payment status)
   * - false (default): CHƯA CHI → unpaid (AP) → tính vào Committed
   * - true: ĐÃ CHI → paid (cash-out) → trừ Bank Balance
   */
  @Prop({ type: Boolean, default: false })
  isConfirmed?: boolean;

  @Prop({ type: Date })
  confirmedAt?: Date; // Thời điểm xác nhận chi

  // Các trường timestamps do Mongoose thêm khi bật { timestamps: true }
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const OtherCostSchema = SchemaFactory.createForClass(OtherCost);
OtherCostSchema.index({ date: -1 });
OtherCostSchema.index({ dueDate: 1, isConfirmed: 1 }); // Quan trọng cho query committed
OtherCostSchema.index({ category: 1, isConfirmed: 1 });
OtherCostSchema.index({ createdAt: -1 });
OtherCostSchema.index({ isConfirmed: 1, date: -1 });
