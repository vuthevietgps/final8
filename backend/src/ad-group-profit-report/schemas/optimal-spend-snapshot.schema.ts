import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OptimalSpendSnapshotDocument = OptimalSpendSnapshot & Document;

/**
 * Lưu trữ gợi ý chi phí tối ưu hàng ngày cho từng ad group
 * Cập nhật bởi cron job mỗi ngày lúc 06:00
 */
@Schema({ timestamps: true })
export class OptimalSpendSnapshot {
  @Prop({ required: true })
  adGroupId: string;

  @Prop()
  adGroupName: string;

  @Prop({ required: true })
  date: Date; // Ngày tính toán

  // Chi phí hiện tại (trung bình 7 ngày gần nhất)
  @Prop({ default: 0 })
  currentSpend: number;

  // Chi phí tối ưu (tính từ marginal efficiency)
  @Prop({ default: 0 })
  optimalSpend: number;

  // Chênh lệch (%)
  @Prop({ default: 0 })
  spendDiffPercent: number;

  // ROI hiện tại
  @Prop({ default: 0 })
  currentROI: number;

  // ROI kỳ vọng nếu đạt optimal
  @Prop({ default: 0 })
  expectedROI: number;

  // Tỷ lệ hoàn hàng
  @Prop({ default: 0 })
  returnRate: number;

  // Thống kê đơn hàng
  @Prop({ default: 0 })
  totalOrders: number;

  @Prop({ default: 0 })
  successOrders: number;

  @Prop({ default: 0 })
  returnOrders: number;

  // Gợi ý hành động
  @Prop({ enum: ['increase', 'decrease', 'maintain', 'kill'] })
  scaleAction: string;

  @Prop()
  reason: string;

  @Prop({ default: 0 })
  confidence: number;

  // Lịch sử 7 ngày gần nhất (JSON)
  @Prop({ type: Object })
  last7Days: any[];
}

export const OptimalSpendSnapshotSchema = SchemaFactory.createForClass(OptimalSpendSnapshot);

// Index để query nhanh
OptimalSpendSnapshotSchema.index({ adGroupId: 1, date: -1 });
OptimalSpendSnapshotSchema.index({ date: -1 });
