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
}

export const AdvertisingCostSchema = SchemaFactory.createForClass(AdvertisingCost);

AdvertisingCostSchema.index({ date: -1 });
AdvertisingCostSchema.index({ createdAt: -1 });
