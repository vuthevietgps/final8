import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdGroupDailyReportDocument = AdGroupDailyReport & Document;

@Schema({ collection: 'ad_group_daily_reports', timestamps: true })
export class AdGroupDailyReport {
  @Prop({ required: true, type: String })
  date: string; // Format: YYYY-MM-DD

  @Prop({ required: true, type: String, index: true })
  adGroupId: string;

  @Prop({ type: String })
  adGroupName: string;

  @Prop({ type: String })
  platform: string; // facebook, google, tiktok

  @Prop({ required: true, type: Number, default: 0 })
  adsCost: number; // Chi phí quảng cáo của nhóm QC

  @Prop({ required: true, type: Number, default: 0 })
  netProfit: number; // Lợi nhuận thuần (tổng từ các đơn hàng)

  @Prop({ type: Date })
  syncedAt: Date; // Thời điểm đồng bộ dữ liệu từ ordertest2
}

export const AdGroupDailyReportSchema = SchemaFactory.createForClass(AdGroupDailyReport);

// Compound index for efficient queries
AdGroupDailyReportSchema.index({ date: 1, adGroupId: 1 }, { unique: true });
AdGroupDailyReportSchema.index({ date: 1, platform: 1 });
AdGroupDailyReportSchema.index({ adGroupId: 1, date: -1 });
