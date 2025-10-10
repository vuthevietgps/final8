/**
 * Schema: PendingOrder
 * Mục đích: Lưu tạm đơn hàng được tạo từ cuộc hội thoại (conversation) trước khi duyệt
 * Workflow trạng thái: draft -> awaiting -> approved / rejected
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PendingOrderDocument = PendingOrder & Document;

@Schema({ timestamps: true })
export class PendingOrder {
  /** Fanpage nguồn tạo order */
  @Prop({ type: Types.ObjectId, ref: 'Fanpage', index: true }) fanpageId?: Types.ObjectId;
  /** Facebook sender PSID của khách hàng */
  @Prop({ trim: true }) senderPsid?: string;
  /** Sản phẩm chọn để tạo đơn */
  @Prop({ type: Types.ObjectId, ref: 'Product', required: false }) productId?: Types.ObjectId;
  /** Đại lý / nhân viên phụ trách (nếu đã chọn) */
  @Prop({ type: Types.ObjectId, ref: 'User', required: false }) agentId?: Types.ObjectId;
  /** Ad group mapping từ hội thoại / tracking */
  @Prop({ trim: true }) adGroupId?: string;
  /** Thông tin khách hàng */
  @Prop({ trim: true }) customerName?: string;
  @Prop({ trim: true }) phone?: string;
  @Prop({ trim: true }) address?: string;
  /** Số lượng sản phẩm */
  @Prop({ default: 1 }) quantity?: number;
  /** Trạng thái của đơn nháp */
  @Prop({ default: 'draft', enum: ['draft','awaiting','approved','rejected'] }) status: 'draft' | 'awaiting' | 'approved' | 'rejected';
  /** Ghi chú nội bộ */
  @Prop({ trim: true }) notes?: string;
  /** Thời điểm capture */
  @Prop({ type: Date, default: Date.now }) capturedAt: Date;
}

export const PendingOrderSchema = SchemaFactory.createForClass(PendingOrder);
// Index phục vụ truy vấn danh sách theo fanpage + status + mới nhất trước
PendingOrderSchema.index({ fanpageId: 1, status: 1, createdAt: -1 });
