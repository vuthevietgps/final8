/**
 * File: emergency-action/schemas/emergency-action-log.schema.ts
 * Mục đích: Schema lưu trạng thái task khẩn cấp Ads Budget vào MongoDB
 * thay vì localStorage. Hỗ trợ audit trail, sync giữa users, verification.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmergencyActionLogDocument = EmergencyActionLog & Document;

@Schema({ timestamps: true, collection: 'emergency_action_logs' })
export class EmergencyActionLog {
  @Prop({ required: true, trim: true })
  taskId: string; // e.g. "pause:123456", "change-budget:789"

  @Prop({ required: true, trim: true, index: true })
  date: string; // ISO date "2026-02-26"

  @Prop({
    required: true,
    enum: ['create-account', 'create-ad-group', 'change-budget', 'pause-ad-group'],
  })
  taskType: string;

  @Prop({ required: true, enum: ['critical', 'high', 'medium'] })
  priority: string;

  @Prop({ trim: true })
  platform: string;

  @Prop({ trim: true })
  adGroupId?: string;

  @Prop({ trim: true })
  adGroupName?: string;

  @Prop({ trim: true })
  actionText: string;

  @Prop({ trim: true })
  reason: string;

  @Prop({ trim: true })
  deadline: string; // "Trước 09:00", "Xử lý ngay", etc.

  // --- Status tracking ---
  @Prop({ default: false })
  done: boolean;

  @Prop()
  doneAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  doneBy?: Types.ObjectId;

  @Prop({ trim: true })
  doneByName?: string;

  // --- Verification ---
  @Prop({
    enum: ['pending', 'verified', 'failed', 'skipped'],
    default: 'pending',
  })
  verificationStatus: string;

  @Prop()
  verifiedAt?: Date;

  @Prop({ trim: true })
  verificationDetails?: string; // JSON string of platform check result

  // --- Budget fields (for change-budget tasks) ---
  @Prop({ type: Number })
  currentSpend?: number;

  @Prop({ type: Number })
  targetSpend?: number;

  @Prop({ type: Number })
  actualSpendAfter?: number; // Actual spend from platform after verification
}

export const EmergencyActionLogSchema =
  SchemaFactory.createForClass(EmergencyActionLog);

// Compound unique index: 1 task per day
EmergencyActionLogSchema.index({ date: 1, taskId: 1 }, { unique: true });
// Query by done status within a day
EmergencyActionLogSchema.index({ done: 1, date: 1 });
