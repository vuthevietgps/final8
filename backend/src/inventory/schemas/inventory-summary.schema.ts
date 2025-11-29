import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventorySummaryDocument = InventorySummary & Document;

@Schema({ timestamps: true })
export class InventorySummary {
  @Prop({ type: Types.ObjectId, ref: 'Product', unique: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  onHand!: number;

  @Prop({ type: Number, default: 0 })
  avgCost!: number; // Weighted Average Cost per unit
}

export const InventorySummarySchema = SchemaFactory.createForClass(InventorySummary);
InventorySummarySchema.index({ onHand: -1 });
