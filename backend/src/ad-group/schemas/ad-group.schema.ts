/**
 * File: ad-group/schemas/ad-group.schema.ts
 * Mục đích: Định nghĩa schema Mongoose cho Nhóm Quảng Cáo (tối giản, không AI/khuyến mại)
 * Chức năng: Quản lý nhóm quảng cáo, sản phẩm và auto-control
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdGroupDocument = AdGroup & Document;

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

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  agentId: Types.ObjectId; // Tham chiếu đại lý (user role: agent)

  @Prop({ type: Types.ObjectId, ref: 'AdAccount', required: true, index: true })
  adAccountId: Types.ObjectId; // Tham chiếu tài khoản quảng cáo

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedEmployeeId?: Types.ObjectId; // Nhân viên phụ trách nhóm quảng cáo này

  // Thông tin mô tả và nội dung
  @Prop({ trim: true })
  description?: string; // Mô tả nhóm quảng cáo

  // Thông tin quảng cáo
  @Prop({ required: true, enum: ['facebook', 'google', 'tiktok'], index: true })
  platform: 'facebook' | 'google' | 'tiktok'; // Nền tảng quảng cáo

  @Prop({ default: true, index: true })
  isActive: boolean; // Trạng thái hoạt động

  @Prop({ trim: true })
  notes?: string; // Ghi chú (không bắt buộc)

  // Webhook và AI processing
  @Prop({ default: false })
  enableWebhook?: boolean; // Bật webhook cho nhóm này

  // Tự động kiểm soát chi tiêu/hiệu quả
  @Prop({ default: false })
  autoControlEnabled?: boolean; // Bật theo dõi tự động và tạm dừng nếu vượt ngưỡng

  @Prop({ type: Number, min: 0 })
  spendThresholdDaily?: number; // Ngưỡng chi tiêu/ngày (VND). Vượt sẽ tạm dừng

  @Prop({ type: Number, min: 0 })
  cprThresholdDaily?: number; // Ngưỡng chi phí trên mỗi hội thoại/ngày (VND)

  @Prop({ type: Number, min: 0, default: 3 })
  minConversations?: number; // Số hội thoại tối thiểu để tính CPR (tránh pause vì mẫu quá nhỏ)

  @Prop({ type: Date })
  lastAutoControlAt?: Date; // Lần cuối hệ thống tự động can thiệp

  @Prop({ trim: true })
  autoPausedReason?: string; // Lý do tự dừng gần nhất

  // Metadata đồng bộ từ provider
  @Prop({ trim: true })
  remoteStatus?: string;

  @Prop({ trim: true })
  effectiveStatus?: string;

  @Prop({ type: Number })
  dailyBudget?: number;

  @Prop({ type: Number })
  bidAmount?: number;

  @Prop({ trim: true })
  campaignId?: string;

  // Nhật ký đồng bộ
  @Prop() lastSyncAt?: Date;

  @Prop({ trim: true }) lastSyncStatus?: 'ok' | 'error';

  @Prop({ trim: true }) lastSyncError?: string;

  @Prop({ type: Number }) lastSyncDurationMs?: number;

  // =============================================
  // 🚀 AUTO-SCALE TESTING PHASE & HORIZONTAL SCALING
  // =============================================

  @Prop({ 
    type: String, 
    enum: ['TESTING', 'GROWTH', 'MATURE', 'STABLE'], 
    default: 'TESTING',
    index: true 
  })
  testingPhase?: 'TESTING' | 'GROWTH' | 'MATURE' | 'STABLE'; // Testing phase cho auto-scale

  @Prop({ type: Date })
  testingStartDate?: Date; // Ngày bắt đầu testing phase

  @Prop({ type: Number, default: 0 })
  daysSinceLaunch?: number; // Số ngày kể từ khi launch (auto-calculated)

  @Prop({ default: false })
  isManualOverride?: boolean; // Nếu true, không áp dụng auto-scale

  @Prop({ type: String })
  manualOverrideReason?: string; // Lý do manual override

  // Frequency metrics (sync từ Facebook API)
  @Prop({ type: Number })
  frequency?: number; // Số lần trung bình 1 người thấy ad

  @Prop({ type: Number })
  reach?: number; // Số người unique đã thấy ad

  @Prop({ type: Number })
  audienceSize?: number; // Kích thước audience targeting

  @Prop({ type: Date })
  lastFrequencyUpdateAt?: Date; // Lần cuối update frequency metrics

  // Horizontal scaling metadata
  @Prop({ type: String })
  basedOnAdGroup?: string; // Nếu ad group này là horizontal scale từ ad group khác

  @Prop({ default: false })
  autoCreated?: boolean; // Được tạo tự động bởi horizontal scaling

  @Prop({ type: String })
  autoCreatedReason?: string; // Lý do tạo tự động

  @Prop({ 
    type: String, 
    enum: ['LOOKALIKE_1', 'LOOKALIKE_2_3', 'INTEREST_TARGETING', 'BROAD_TARGETING'] 
  })
  targetingStrategy?: string; // Chiến lược targeting (cho horizontal scaling)

  @Prop({ default: false })
  preferHorizontalScaling?: boolean; // Ưu tiên horizontal scaling thay vì vertical

  @Prop({ type: Number })
  maxDailyScaleRate?: number; // Max scale rate cho ad group này (override global)

  // Gradual scaling tracking
  @Prop({ type: Number })
  pendingBudgetIncrease?: number; // Budget còn lại cần scale (cho multi-day gradual scale)

  @Prop({ type: Date })
  nextScheduledScaleDate?: Date; // Ngày scale tiếp theo (cho gradual scale)

  @Prop({ type: Number })
  targetBudget?: number; // Budget mục tiêu cuối cùng (cho gradual scale)
}

export const AdGroupSchema = SchemaFactory.createForClass(AdGroup);

// Indexes phục vụ truy vấn phổ biến và chatbot
AdGroupSchema.index({ createdAt: -1 });
AdGroupSchema.index({ fanpageId: 1, isActive: 1 });
AdGroupSchema.index({ enableWebhook: 1 });
AdGroupSchema.index({ adGroupId: 1, fanpageId: 1 }); // Composite index cho webhook lookup
