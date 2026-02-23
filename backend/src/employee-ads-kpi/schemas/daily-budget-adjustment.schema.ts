/**
 * Daily Budget Adjustment Schema
 * 
 * Track xác nhận chỉnh sửa budget hàng ngày cho nhân viên ads.
 * Liên kết với KPI nhân viên - phải confirm 100% mỗi ngày.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailyBudgetAdjustmentDocument = DailyBudgetAdjustment & Document;

@Schema({ timestamps: true })
export class DailyBudgetAdjustment {
  @Prop({ required: true, index: true })
  date: string; // YYYY-MM-DD format

  @Prop({ required: true, index: true })
  adGroupId: string; // ID nhóm ads (từ platform)

  @Prop({ required: true, trim: true })
  adGroupName: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  employeeId: Types.ObjectId; // Nhân viên phụ trách

  @Prop({ required: true, enum: ['facebook', 'google', 'tiktok'], index: true })
  platform: 'facebook' | 'google' | 'tiktok';

  @Prop({ type: Types.ObjectId, ref: 'ProductCategory', index: true })
  productCategoryId?: Types.ObjectId;

  @Prop({ trim: true })
  productCategoryName?: string;

  // ===== SPEND DATA =====
  @Prop({ type: Number, default: 0 })
  spendYesterday: number; // Chi phí hôm qua (thực tế từ platform)

  @Prop({ type: Number, default: 0 })
  suggestedSpend: number; // Chi phí gợi ý từ thuật toán (không có cap)

  @Prop({ type: Number, default: 0 })
  suggestedSpendCapped: number; // Chi phí gợi ý có trần 20% tăng / 30% giảm

  @Prop({ type: Number })
  avgSpendLast3Days?: number; // Trung bình 3 ngày gần nhất

  // ===== PROFIT DATA =====
  @Prop({ type: Number, default: 0 })
  profitYesterday: number; // Lợi nhuận hôm qua

  @Prop({ type: Boolean, default: false })
  isProfitable: boolean; // Có lợi nhuận không?

  @Prop({ type: Number })
  roi?: number; // ROI hôm qua (%)

  // ===== CONFIRMATION =====
  @Prop({ default: false, index: true })
  confirmed: boolean; // Đã xác nhận chỉnh chưa?

  @Prop({ type: Date })
  confirmedAt?: Date; // Thời điểm confirm

  @Prop({ type: Number })
  confirmedBudget?: number; // Budget đã set trên platform (nhân viên nhập)

  @Prop({ trim: true })
  notes?: string; // Ghi chú của nhân viên

  // ===== RECOMMENDATION =====
  @Prop({ enum: ['increase', 'maintain', 'decrease', 'pause'], default: 'maintain' })
  recommendation: 'increase' | 'maintain' | 'decrease' | 'pause';

  @Prop({ trim: true })
  recommendationReason?: string;
}

export const DailyBudgetAdjustmentSchema = SchemaFactory.createForClass(DailyBudgetAdjustment);

// Compound index for unique daily adjustment per ad group
DailyBudgetAdjustmentSchema.index({ date: 1, adGroupId: 1 }, { unique: true });

// Index for querying by employee + date
DailyBudgetAdjustmentSchema.index({ employeeId: 1, date: 1 });

// Index for querying unconfirmed adjustments
DailyBudgetAdjustmentSchema.index({ confirmed: 1, date: 1 });
