import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinanceAlertEventDocument = FinanceAlertEvent & Document;

@Schema({ collection: 'finance_alert_events', timestamps: false })
export class FinanceAlertEvent {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  dateString: string;

  @Prop({ required: true })
  severity: 'WARNING' | 'DANGER' | 'CRITICAL';

  @Prop({ required: true })
  message: string;

  @Prop()
  value?: number;

  @Prop()
  threshold?: number;

  @Prop({ default: false })
  isResolved: boolean;

  @Prop()
  resolvedAt?: Date;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const FinanceAlertEventSchema = SchemaFactory.createForClass(FinanceAlertEvent);

FinanceAlertEventSchema.index({ code: 1, dateString: 1 }, { unique: true, name: 'uniq_finance_alert_code_day' });
FinanceAlertEventSchema.index({ isResolved: 1, code: 1, dateString: 1 }, { name: 'finance_alert_resolution_lookup' });