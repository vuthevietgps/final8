/**
 * File: advertising-cost/schemas/advertising-cost.schema.ts
 * Mục đích: Định nghĩa schema Mongoose cho Chi Phí Quảng Cáo.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdvertisingCostDocument = AdvertisingCost & Document;

@Schema({ timestamps: true })
export class AdvertisingCost {
  // Ngày (mặc định: hôm nay)
  @Prop({ type: Date, required: true, default: () => new Date() })
  date: Date;

  // Tần suất (không bắt buộc)
  @Prop({ type: Number, required: false })
  frequency?: number;

  // ID Nhóm quảng cáo (bắt buộc) - dùng chuỗi adGroupId do người dùng nhập
  @Prop({ type: String, required: true, index: true, trim: true })
  adGroupId: string;

  // Số tiền đã chi tiêu (mặc định 0)
  @Prop({ type: Number, required: false, default: 0 })
  spentAmount?: number;

  // CPM (mặc định 0)
  @Prop({ type: Number, required: false, default: 0 })
  cpm?: number;

  // CPC (mặc định 0)
  @Prop({ type: Number, required: false, default: 0 })
  cpc?: number;

  // === NEW MESSAGING METRICS ===
  // Số lượt hiển thị
  @Prop({ type: Number, required: false, default: 0 })
  impressions?: number;

  // Số lượt click
  @Prop({ type: Number, required: false, default: 0 })
  clicks?: number;

  // Độ phủ sóng (số người tiếp cận)
  @Prop({ type: Number, required: false, default: 0 })
  reach?: number;

  // Số lượt bắt đầu cuộc trò chuyện qua tin nhắn (7 ngày)
  @Prop({ type: Number, required: false, default: 0 })
  messagingConversationStarted7d?: number;

  // Chi phí trên mỗi lượt bắt đầu cuộc trò chuyện qua tin nhắn
  @Prop({ type: Number, required: false, default: 0 })
  costPerMessagingConversation?: number;

  // Lượt phản hồi tin nhắn đầu tiên
  @Prop({ type: Number, required: false, default: 0 })
  messagingFirstReply?: number;
}

export const AdvertisingCostSchema = SchemaFactory.createForClass(AdvertisingCost);

AdvertisingCostSchema.index({ date: -1 });
AdvertisingCostSchema.index({ createdAt: -1 });
// Đảm bảo một bản ghi duy nhất cho mỗi cặp (adGroupId, date)
// Lưu ý: date nên được chuẩn hoá về 00:00:00 UTC trước khi lưu để tránh trùng lặp theo múi giờ
AdvertisingCostSchema.index({ adGroupId: 1, date: 1 }, { unique: true, name: 'uniq_adGroupId_date' });
