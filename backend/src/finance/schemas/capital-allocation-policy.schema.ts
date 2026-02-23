import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CapitalAllocationPolicyDocument = HydratedDocument<CapitalAllocationPolicy>;

/**
 * Chính sách phân bổ vốn từ lợi nhuận thuần
 * Các tỷ lệ được lưu dưới dạng % (0-100)
 */
@Schema({ collection: 'capitalallocationpolicies', timestamps: true })
export class CapitalAllocationPolicy {
  @Prop({ type: String, required: true, unique: true })
  name: string; // 'default', 'aggressive', 'conservative'

  @Prop({ type: String })
  description?: string;

  // Tái đầu tư / Ads (40-50%)
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  reinvestmentRatio: number;

  // Dự phòng an toàn (20-25%)
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  safetyReserveRatio: number;

  // Thu nhập cá nhân (20-25%)
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  personalIncomeRatio: number;

  // Tài sản dài hạn (10-15%)
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  longTermAssetRatio: number;

  @Prop({ type: Boolean, default: false })
  isActive: boolean;

  @Prop({ type: Date })
  activatedAt?: Date;

  @Prop({ type: String })
  notes?: string;
}

export const CapitalAllocationPolicySchema = SchemaFactory.createForClass(CapitalAllocationPolicy);

// Index for quick lookup of active policy
CapitalAllocationPolicySchema.index({ isActive: 1, name: 1 });
