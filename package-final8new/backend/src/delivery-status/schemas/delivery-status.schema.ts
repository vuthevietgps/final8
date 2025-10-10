/**
 * File: schemas/delivery-status.schema.ts
 * Mục đích: Định nghĩa schema cho trạng thái giao hàng.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeliveryStatusDocument = DeliveryStatus & Document;

@Schema({ timestamps: true })
export class DeliveryStatus {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  color: string;

  @Prop({ required: true })
  icon: string;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ default: false })
  isFinal: boolean;

  @Prop({ default: 0 })
  order: number;

  @Prop()
  estimatedDays?: number;

  @Prop()
  trackingNote?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const DeliveryStatusSchema = SchemaFactory.createForClass(DeliveryStatus);
