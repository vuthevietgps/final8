/**
 * File: test-order2/schemas/test-order2.schema.ts
 * Mục đích: Schema Mongoose cho Đơn Hàng Thử Nghiệm 2 (collection: ordertest2).
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TestOrder2Document = TestOrder2 & Document;

@Schema({ timestamps: true, collection: 'ordertest2' })
export class TestOrder2 {
  // Ngày tạo đơn (sử dụng createdAt của timestamps làm ngày tạo thao tác)

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId; // Sản phẩm (bắt buộc)

  @Prop({ type: String, required: true, trim: true })
  customerName: string; // Tên Khách Hàng (bắt buộc)

  @Prop({ type: Number, required: true, min: 1, default: 1 })
  quantity: number; // Số lượng (mặc định 1)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  agentId: Types.ObjectId; // Đại lý (bắt buộc)

  @Prop({ type: String, required: true, trim: true, default: '0', index: true })
  adGroupId: string; // Nhóm quảng cáo (ID hoặc '0')

  @Prop({ type: Boolean, default: true })
  isActive: boolean; // Trạng thái (Hoạt động)

  @Prop({ type: String, trim: true })
  serviceDetails?: string; // Chi tiết dịch vụ (không bắt buộc)

  @Prop({ type: String, required: true, trim: true, default: 'Chưa làm', index: true })
  productionStatus: string; // Trạng thái Sản Xuất (mặc định Chưa làm)

  @Prop({ type: String, required: true, trim: true, default: 'Chưa có mã vận đơn', index: true })
  orderStatus: string; // Trạng thái Vận Đơn (mặc định Chưa có mã vận đơn)

  @Prop({ type: String, trim: true })
  submitLink?: string; // Link nộp (text)

  @Prop({ type: String, trim: true })
  trackingNumber?: string; // Số vận đơn (text)

  @Prop({ type: Number, default: 0, min: 0 })
  depositAmount?: number; // Số tiền đã cọc

  @Prop({ type: Number, default: 0, min: 0 })
  codAmount?: number; // Số tiền thu hộ COD

  @Prop({ type: Number, default: 0, min: 0 })
  manualPayment?: number; // Thanh toán tay (nhập tay hoặc CSV)

  @Prop({ type: String, trim: true })
  receiverName?: string; // Tên người nhận

  @Prop({ type: String, trim: true })
  receiverPhone?: string; // Số điện thoại người nhận

  @Prop({ type: String, trim: true })
  receiverAddress?: string; // Địa chỉ người nhận

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const TestOrder2Schema = SchemaFactory.createForClass(TestOrder2);
TestOrder2Schema.index({ createdAt: -1 });
