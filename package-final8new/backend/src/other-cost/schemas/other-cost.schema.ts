/**
 * File: other-cost/schemas/other-cost.schema.ts
 * Mục đích: Schema Mongoose cho Chi Phí Khác.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtherCostDocument = OtherCost & Document;

@Schema({ timestamps: true })
export class OtherCost {
  @Prop({ type: Date, required: true })
  date: Date; // Ngày phát sinh chi phí

  @Prop({ type: Number, required: true, min: 0 })
  amount: number; // Số tiền chi phí

  @Prop({ type: String, trim: true })
  notes?: string; // Ghi chú (không bắt buộc)

  @Prop({ type: String, trim: true })
  documentLink?: string; // Link chứng từ (text)

  // Các trường timestamps do Mongoose thêm khi bật { timestamps: true }
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const OtherCostSchema = SchemaFactory.createForClass(OtherCost);
OtherCostSchema.index({ date: -1 });
OtherCostSchema.index({ createdAt: -1 });
