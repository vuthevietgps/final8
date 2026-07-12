import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemSettingsDocument = SystemSettings & Document;

@Schema({ _id: false })
export class SystemSettingsAuditEntry {
  @Prop({ type: Date, required: true })
  changedAt!: Date;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  changedBy!: string;

  @Prop({ type: [String], required: true })
  changedFields!: string[];

  @Prop({ type: Object, required: true })
  previousValue!: Record<string, unknown>;

  @Prop({ type: Object, required: true })
  nextValue!: Record<string, unknown>;
}

export const SystemSettingsAuditEntrySchema = SchemaFactory.createForClass(SystemSettingsAuditEntry);

/**
 * SystemSettings — Lưu cấu hình FinancialControl vào MongoDB
 * Mỗi bản ghi có một key duy nhất ("financial_control").
 * Giải quyết vấn đề Multi-pod: mọi Pod đọc chung từ DB thay vì RAM cục bộ.
 */
@Schema({ collection: 'system_settings', timestamps: true })
export class SystemSettings {
  /** Định danh duy nhất của nhóm cấu hình, ví dụ: "financial_control" */
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  /** Giá trị cấu hình — lưu dưới dạng Map để linh hoạt với mọi kiểu dữ liệu */
  @Prop({ type: Object, required: true })
  value!: Record<string, unknown>;

  /** Mô tả ngắn về nhóm cấu hình (tuỳ chọn) */
  @Prop({ default: '' })
  description?: string;

  /** Người cập nhật lần cuối (email hoặc userId) */
  @Prop({ default: 'system', trim: true, maxlength: 200 })
  updatedBy?: string;

  /** Last 100 policy changes; values are configuration only, never secrets. */
  @Prop({ type: [SystemSettingsAuditEntrySchema], default: [] })
  auditHistory?: SystemSettingsAuditEntry[];
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);
