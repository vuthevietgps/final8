import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../user/user.schema';

/**
 * Bậc thưởng chuyên cần theo tổng giờ làm việc
 */
export class AttendanceTier {
  @Prop({ type: Number, required: true })
  minHours: number; // Từ X giờ

  @Prop({ type: Number, required: true })
  maxHours: number; // Đến Y giờ (exclusive)

  @Prop({ type: Number, required: true })
  bonusAmount: number; // Số tiền thưởng
}

/**
 * Bậc thưởng theo % hoàn thành KPI
 */
export class KpiBonusTier {
  @Prop({ type: Number, required: true })
  minPercent: number; // Từ X%

  @Prop({ type: Number, required: true })
  maxPercent: number; // Đến Y% (exclusive)

  @Prop({ type: Number, required: true })
  bonusAmount: number; // Số tiền thưởng
}

/**
 * Quy tắc thưởng/phạt chấm công đúng giờ
 */
export class PunctualityRules {
  @Prop({ type: String, required: true })
  checkInDeadline: string; // Giờ deadline check-in, VD: "08:30"

  @Prop({ type: Number, default: 0 })
  onTimeBonus: number; // Thưởng mỗi ngày đúng giờ (VD: 10,000đ)

  @Prop({ type: Number, default: 0 })
  latePenalty: number; // Phạt mỗi ngày trễ (VD: 20,000đ, lưu số dương)

  @Prop({ type: Number, default: 5 })
  gracePeriodMinutes: number; // Thời gian ân hạn (phút)
}

@Schema({ timestamps: true })
export class SalaryConfig {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true, index: true })
  userId: Types.ObjectId;

  // === Chu kỳ tính lương ===
  @Prop({ type: String, enum: ['weekly', 'monthly'], default: 'monthly' })
  payrollCycle: 'weekly' | 'monthly';

  // === Ngày thanh toán lương trong tháng ===
  // VD: [5] = ngày 5 hàng tháng, [5, 20] = ngày 5 và 20 (trả 2 kỳ)
  @Prop({ type: [Number], default: [5] })
  paymentDays: number[];

  // === Lương cơ bản theo giờ ===
  @Prop({ type: Number, required: true, min: 0 })
  hourlyRate: number;

  // === Bậc thưởng chuyên cần ===
  @Prop({ type: [{ minHours: Number, maxHours: Number, bonusAmount: Number }], default: [] })
  attendanceTiers: AttendanceTier[];

  // === Bậc thưởng KPI ===
  @Prop({ type: [{ minPercent: Number, maxPercent: Number, bonusAmount: Number }], default: [] })
  kpiBonusTiers: KpiBonusTier[];

  // === Quy tắc thưởng/phạt chấm công ===
  @Prop({ type: { 
    checkInDeadline: String, 
    onTimeBonus: Number, 
    latePenalty: Number, 
    gracePeriodMinutes: Number 
  }, default: null })
  punctualityRules: PunctualityRules | null;

  @Prop({ type: String })
  notes?: string;
}

export type SalaryConfigDocument = HydratedDocument<SalaryConfig>;
export const SalaryConfigSchema = SchemaFactory.createForClass(SalaryConfig);
