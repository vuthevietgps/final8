/**
 * File: ad-account/schemas/ad-account.schema.ts
 * Mục đích: Định nghĩa schema Mongoose cho Tài Khoản Quảng Cáo.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdAccountDocument = AdAccount & Document;

@Schema({ timestamps: true })
export class AdAccount {
  @Prop({ required: true, trim: true })
  name: string; // Tên tài khoản quảng cáo

  @Prop({ required: true, trim: true, unique: true, index: true })
  accountId: string; // ID tài khoản quảng cáo (nhập tay)

  @Prop({ required: true, enum: ['facebook', 'google', 'tiktok', 'zalo', 'shopee', 'lazada'], index: true })
  accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada'; // Loại tài khoản quảng cáo

  @Prop({ enum: ['direct', 'bm', 'mcc', 'bc'], default: 'direct', index: true })
  managementMode?: 'direct' | 'bm' | 'mcc' | 'bc'; // direct / BM / MCC / BC

  @Prop({ default: true, index: true })
  isActive: boolean; // Trạng thái hoạt động

  @Prop({ trim: true })
  notes?: string; // Ghi chú (không bắt buộc)

  @Prop({ trim: true })
  description?: string; // Mô tả tài khoản

  // Metadata đồng bộ từ provider
  @Prop({ trim: true })
  currency?: string;

  @Prop({ trim: true })
  timezoneId?: string;

  @Prop({ trim: true })
  businessName?: string;

  @Prop({ trim: true, index: true })
  businessCenterId?: string; // TikTok Business Center ID

  @Prop({ trim: true })
  businessCenterName?: string; // TikTok Business Center name

  @Prop({ type: Number })
  spendCap?: number;

  @Prop({ type: Number })
  amountSpent?: number;

  @Prop({ type: Number })
  accountStatus?: number; // Facebook account_status code

  // Nhật ký đồng bộ
  @Prop() lastSyncAt?: Date;

  @Prop({ trim: true }) lastSyncStatus?: 'ok' | 'error';

  @Prop({ trim: true }) lastSyncError?: string;

  @Prop({ type: Number }) lastSyncDurationMs?: number;

  // Google Ads: login customer ID (manager) để thực thi API
  @Prop({ trim: true }) loginCustomerId?: string;

  @Prop({ enum: ['system', 'account', 'manual'], default: 'system' })
  tokenSource?: 'system' | 'account' | 'manual';

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  adsManagerUserId?: Types.ObjectId; // Nguoi phu trach ads noi bo

  @Prop({ type: Date })
  lastOperatorActivityAt?: Date; // Moc hoat dong ERP gan nhat cua nguoi phu trach ads
}

export const AdAccountSchema = SchemaFactory.createForClass(AdAccount);

// Indexes phục vụ truy vấn phổ biến
AdAccountSchema.index({ createdAt: -1 });
AdAccountSchema.index({ accountType: 1, isActive: 1 });
