import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const BUSINESS_NOTE_SOURCES = ['manual', 'ads', 'finance', 'operations', 'supply'] as const;
export type BusinessNoteSource = (typeof BUSINESS_NOTE_SOURCES)[number];
export type BusinessDailyNoteDocument = HydratedDocument<BusinessDailyNote>;

@Schema({ collection: 'business_daily_notes', timestamps: true })
export class BusinessDailyNote {
  @Prop({ required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true })
  date: string;

  @Prop({ required: true, trim: true })
  summary: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: [String], default: [] })
  anomalies: string[];

  @Prop({ required: true, enum: BUSINESS_NOTE_SOURCES, default: 'manual', index: true })
  source: BusinessNoteSource;

  @Prop({ trim: true })
  affectedCustomerId?: string;

  @Prop({ trim: true })
  affectedCampaignId?: string;

  @Prop({ trim: true })
  affectedAdGroupId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  affectedProductId?: Types.ObjectId;

  @Prop({ enum: ['info', 'warning', 'critical'], default: 'info' })
  severity: 'info' | 'warning' | 'critical';

  @Prop({ trim: true })
  createdByUserId?: string;

  @Prop({ trim: true })
  createdBy?: string;

  @Prop({ trim: true })
  updatedByUserId?: string;

  @Prop({ trim: true })
  updatedBy?: string;
}

export const BusinessDailyNoteSchema = SchemaFactory.createForClass(BusinessDailyNote);
BusinessDailyNoteSchema.index({ date: -1, source: 1 });
BusinessDailyNoteSchema.index({ affectedAdGroupId: 1, date: -1 });
