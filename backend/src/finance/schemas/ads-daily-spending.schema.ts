import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdsDailySpendingDocument = AdsDailySpending & Document;

/**
 * Schema tracking chi phí ads hàng ngày
 * Tránh trùng lặp khi sync lại và có audit trail
 */
@Schema({
  collection: 'ads_daily_spendings',
  timestamps: true
})
export class AdsDailySpending {
  @Prop({ required: true, index: true })
  date: string; // YYYY-MM-DD

  @Prop({ type: Types.ObjectId, ref: 'CapitalAllocationSnapshot', index: true })
  snapshotId: Types.ObjectId; // Snapshot được update

  @Prop({ required: true, default: 0 })
  totalAdsCost: number;

  @Prop({ type: [Object], default: [] })
  breakdown: Array<{
    adGroupId: string;
    adGroupName: string;
    adsCost: number;
  }>;

  @Prop({ default: Date.now })
  syncedAt: Date;

  @Prop({ enum: ['auto-sync', 'manual', 're-sync'], default: 'auto-sync' })
  source: string;

  @Prop()
  note?: string;
}

export const AdsDailySpendingSchema = SchemaFactory.createForClass(AdsDailySpending);

// Unique index: mỗi ngày chỉ sync 1 lần cho 1 snapshot
AdsDailySpendingSchema.index({ date: 1, snapshotId: 1 }, { unique: true });
