/**
 * File: schemas/advertising-cost-suggestion.schema.ts
 * Mục đích: Định nghĩa schema cho MongoDB collection lưu trữ đề xuất chi phí quảng cáo
 * Bao gồm: Nhóm quảng cáo, chi phí đề xuất và các tính toán liên quan
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdvertisingCostSuggestionDocument = AdvertisingCostSuggestion & Document;

@Schema({ 
  timestamps: true,
  collection: 'advertising_cost_suggestions'
})
export class AdvertisingCostSuggestion {
  @Prop({ required: true, type: String, index: true })
  adGroupId: string; // ID thật của nhóm quảng cáo (không phải ObjectId reference)

  @Prop({ required: true })
  adGroupName: string;

  @Prop({ required: true, min: 0 })
  suggestedCost: number; // Chi phí đề xuất (nhập bằng tay)

  @Prop({ default: 0, min: 0 })
  dailyCost: number; // Chi phí hàng ngày (lấy từ advertising-cost2)

  @Prop({ default: 0 })
  dailyDifference: number; // Chênh lệch = dailyCost - suggestedCost

  @Prop({ default: 0 })
  dailyDifferencePercent: number; // Chênh lệch % = (chênh lệch / đề xuất) * 100

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes: string; // Ghi chú
}

export const AdvertisingCostSuggestionSchema = SchemaFactory.createForClass(AdvertisingCostSuggestion);

// Tự động tính toán các trường khi save
AdvertisingCostSuggestionSchema.pre('save', function() {
  if (this.suggestedCost > 0) {
    this.dailyDifference = this.dailyCost - this.suggestedCost;
    this.dailyDifferencePercent = (this.dailyDifference / this.suggestedCost) * 100;
  }
});