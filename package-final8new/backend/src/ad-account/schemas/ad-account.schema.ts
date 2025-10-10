/**
 * File: ad-account/schemas/ad-account.schema.ts
 * Mục đích: Định nghĩa schema Mongoose cho Tài Khoản Quảng Cáo.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdAccountDocument = AdAccount & Document;

@Schema({ timestamps: true })
export class AdAccount {
  @Prop({ required: true, trim: true })
  name: string; // Tên tài khoản quảng cáo

  @Prop({ required: true, trim: true, unique: true, index: true })
  accountId: string; // ID tài khoản quảng cáo (nhập tay)

  @Prop({ required: true, enum: ['facebook', 'google', 'tiktok', 'zalo', 'shopee', 'lazada'], index: true })
  accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada'; // Loại tài khoản quảng cáo

  @Prop({ default: true, index: true })
  isActive: boolean; // Trạng thái hoạt động

  @Prop({ trim: true })
  notes?: string; // Ghi chú (không bắt buộc)

  @Prop({ trim: true })
  description?: string; // Mô tả tài khoản
}

export const AdAccountSchema = SchemaFactory.createForClass(AdAccount);

// Indexes phục vụ truy vấn phổ biến
AdAccountSchema.index({ createdAt: -1 });
AdAccountSchema.index({ accountType: 1, isActive: 1 });
