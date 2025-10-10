import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProfitForecastSnapshotDocument = ProfitForecastSnapshot & Document;

@Schema({ timestamps: true })
export class ProfitForecastSnapshot {
  @Prop({ required: true }) date: string; // YYYY-MM-DD
  @Prop({ required: true }) adGroupId: string;
  @Prop({ required: true }) modelVersion: number;
  @Prop({ required: true, default: 0 }) maturedRevenue: number;
  @Prop({ required: true, default: 0 }) maturedProfit: number;
  @Prop({ required: true, default: 0 }) maturedOrderCount: number;
  @Prop({ required: true, default: 0 }) projectedRevenue: number;
  @Prop({ required: true, default: 0 }) projectedProfit: number;
  @Prop({ required: true, default: 0 }) projectedOrderCount: number;
  @Prop({ required: true, default: 0 }) spend: number;
  @Prop({ required: true, default: 0 }) blendedRevenue: number;
  @Prop({ required: true, default: 0 }) blendedProfit: number;
  @Prop({ required: true, default: 0 }) blendedROAS: number;
  @Prop({ required: true, default: 0 }) maturedROAS: number;
  @Prop({ required: true, default: 0 }) confidence: number; // 0..1
  @Prop({ required: true, default: 0 }) calibrationError: number; // 0..1
}

export const ProfitForecastSnapshotSchema = SchemaFactory.createForClass(ProfitForecastSnapshot);
ProfitForecastSnapshotSchema.index({ date: 1, adGroupId: 1 }, { unique: true });
