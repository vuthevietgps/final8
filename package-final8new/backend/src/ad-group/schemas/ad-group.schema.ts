/**
 * File: ad-group/schemas/ad-group.schema.ts
 * Mục đích: Định nghĩa schema Mongoose cho Nhóm Quảng Cáo với tích hợp chatbot
 * Chức năng: Quản lý nhóm quảng cáo, sản phẩm, script chat và cấu hình AI
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdGroupDocument = AdGroup & Document;

// Schema cho script chat
@Schema({ _id: false })
export class ChatScript {
  @Prop({ trim: true })
  greeting?: string; // Script chào hỏi

  @Prop({ trim: true })
  upsellHint?: string; // Gợi ý bán thêm

  @Prop({ trim: true })
  closing?: string; // Script kết thúc

  @Prop({ trim: true })
  attributes?: string; // Thuộc tính sản phẩm (nội trước, phẫy)
}

// Schema cho chương trình discount
@Schema({ _id: false })
export class DiscountProgram {
  @Prop({ trim: true })
  name?: string; // Tên chương trình

  @Prop({ type: Number, min: 0, max: 100 })
  percentage?: number; // Phần trăm giảm giá

  @Prop({ type: Number, min: 0 })
  fixedAmount?: number; // Số tiền giảm cố định

  @Prop({ trim: true })
  conditions?: string; // Điều kiện áp dụng

  @Prop({ type: Date })
  startDate?: Date; // Ngày bắt đầu

  @Prop({ type: Date })
  endDate?: Date; // Ngày kết thúc

  @Prop({ default: true })
  isActive?: boolean; // Trạng thái hoạt động
}

@Schema({ timestamps: true })
export class AdGroup {
  @Prop({ required: true, trim: true })
  name: string; // Tên nhóm quảng cáo

  @Prop({ required: true, trim: true, unique: true, index: true })
  adGroupId: string; // ID nhóm quảng cáo (nhập tay)

  // Tham chiếu các entity chính
  @Prop({ type: Types.ObjectId, ref: 'Fanpage', required: true, index: true })
  fanpageId: Types.ObjectId; // Tham chiếu fanpage

  @Prop({ type: Types.ObjectId, ref: 'ProductCategory', required: true, index: true })
  productCategoryId: Types.ObjectId; // Tham chiếu nhóm sản phẩm

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  selectedProducts: Types.ObjectId[]; // Danh sách sản phẩm được chọn

  @Prop({ type: Types.ObjectId, ref: 'OpenAIConfig', index: true })
  openAIConfigId?: Types.ObjectId; // Cấu hình OpenAI

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  agentId: Types.ObjectId; // Tham chiếu đại lý (user role: agent)

  @Prop({ type: Types.ObjectId, ref: 'AdAccount', required: true, index: true })
  adAccountId: Types.ObjectId; // Tham chiếu tài khoản quảng cáo

  // Thông tin mô tả và nội dung
  @Prop({ trim: true })
  description?: string; // Mô tả nhóm quảng cáo

  @Prop({ type: ChatScript })
  chatScript?: ChatScript; // Các script chat

  @Prop({ type: DiscountProgram })
  discount?: DiscountProgram; // Chương trình giảm giá

  // Thông tin quảng cáo
  @Prop({ required: true, enum: ['facebook', 'google', 'ticktock'], index: true })
  platform: 'facebook' | 'google' | 'ticktock'; // Nền tảng quảng cáo

  @Prop({ default: true, index: true })
  isActive: boolean; // Trạng thái hoạt động

  @Prop({ trim: true })
  notes?: string; // Ghi chú (không bắt buộc)

  // Webhook và AI processing
  @Prop({ default: false })
  enableWebhook?: boolean; // Bật webhook cho nhóm này

  @Prop({ default: false })
  enableAIChat?: boolean; // Bật AI chat tự động
}

export const AdGroupSchema = SchemaFactory.createForClass(AdGroup);

// Indexes phục vụ truy vấn phổ biến và chatbot
AdGroupSchema.index({ createdAt: -1 });
AdGroupSchema.index({ fanpageId: 1, isActive: 1 });
AdGroupSchema.index({ productCategoryId: 1 });
AdGroupSchema.index({ enableWebhook: 1, enableAIChat: 1 });
AdGroupSchema.index({ adGroupId: 1, fanpageId: 1 }); // Composite index cho webhook lookup
