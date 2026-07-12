/**
 * File: schemas/fanpage.schema.ts
 * Mục đích: Định nghĩa schema MongoDB cho Fanpage (trang Facebook)
 * Chứa thông tin kết nối, token, scripts phản hồi tự động và thống kê
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FanpageDocument = Fanpage & Document;

@Schema({ timestamps: true })
export class Fanpage {
  @Prop({ required: true, unique: true, trim: true })
  pageId: string; // Facebook Page ID

  @Prop({ required: true, trim: true })
  name: string;

  /** Legacy read-only field. New writes persist credentials in ApiToken.tokenEnc. */
  @Prop({ required: false, select: false })
  accessToken?: string;

  /** Non-secret readiness marker for UI/reporting without reading credentials. */
  @Prop({ default: false, index: true })
  hasAccessToken: boolean;

  @Prop({ enum: ['active','inactive'], default: 'active', index: true })
  status: 'active' | 'inactive';

  @Prop({ type: Date })
  connectedAt?: Date;

  @Prop({ type: Date })
  lastRefreshAt?: Date;

  @Prop({ trim: true })
  avatarUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  connectedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ProductCategory' })
  defaultProductGroup?: Types.ObjectId;

  @Prop({ trim: true })
  description?: string;

  // Chat fallback scripts - các script phản hồi tự động
  @Prop({ trim: true }) greetingScript?: string; // Lời chào
  @Prop({ trim: true }) clarifyScript?: string; // Yêu cầu làm rõ
  @Prop({ trim: true }) productSuggestScript?: string; // Đề xuất sản phẩm
  @Prop({ trim: true }) fallbackScript?: string; // Phản hồi khi không xác định được
  @Prop({ trim: true }) closingScript?: string; // Lời kết thúc

  // Thống kê và giới hạn
  @Prop({ default: 0 }) subscriberCount: number; // Số người theo dõi
  @Prop({ default: 10000 }) messageQuota: number; // Giới hạn tin nhắn/tháng
  @Prop({ default: 0 }) sentThisMonth: number; // Đã gửi trong tháng

  // Cờ trạng thái
  @Prop({ default: false }) subscribedWebhook: boolean; // Đã đăng ký webhook
  @Prop({ default: false }) aiEnabled: boolean; // Bật AI chatbot

  // Múi giờ mặc định
  @Prop({ trim: true, default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  // Liên kết cấu hình OpenAI ưu tiên cụ thể (nếu đặt) thay vì auto pick
  @Prop({ type: Types.ObjectId, ref: 'OpenAIConfig' })
  openAIConfigId?: Types.ObjectId;
}

export const FanpageSchema = SchemaFactory.createForClass(Fanpage);
// pageId already has unique + implicit index from @Prop; avoid duplicate index declaration
