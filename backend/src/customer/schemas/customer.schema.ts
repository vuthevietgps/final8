/**
 * File: customer/schemas/customer.schema.ts
 * Mục đích: Schema Mongoose cho Khách Hàng - trích xuất từ TestOrder2.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ required: true, trim: true, index: true })
  customerName: string; // Tên khách hàng

  @Prop({ required: true, trim: true, index: true })
  phoneNumber: string; // Số điện thoại

  @Prop({ required: true, trim: true })
  address: string; // Địa chỉ

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId; // Sản phẩm

  @Prop({ required: true })
  latestPurchaseDate: Date; // Ngày mua gần nhất

  @Prop({ required: true, min: 1 })
  usageDurationMonths: number; // Thời hạn sử dụng (tháng) - từ Product

  @Prop({ required: true, min: 0 })
  remainingDays: number; // Thời gian còn lại (ngày) - tính toán

  @Prop({ default: false })
  isDisabled: boolean; // Trạng thái vô hiệu hóa

  @Prop({ type: String, trim: true })
  notes?: string; // Ghi chú

  // Trường phụ trợ để tracking
  @Prop({ type: Types.ObjectId, ref: 'TestOrder2', index: true })
  latestOrderId: Types.ObjectId; // ID đơn hàng gần nhất

  @Prop({ default: Date.now })
  lastCalculated: Date; // Lần tính toán cuối cùng
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

// Indexes for performance
CustomerSchema.index({ customerName: 1, phoneNumber: 1 }, { unique: true });
CustomerSchema.index({ remainingDays: 1 });
CustomerSchema.index({ isDisabled: 1 });
CustomerSchema.index({ latestPurchaseDate: -1 });