import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReturnRequestDocument = ReturnRequest & Document;

@Schema({ timestamps: false })
export class ReturnItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  quantityReturned!: number;

  @Prop({ type: String })
  decision?: 'restock' | 'scrap';

  @Prop({ type: Number })
  processedQuantity?: number;

  @Prop({ type: Number })
  recoveryUnitCost?: number;

  @Prop()
  notes?: string;
}

const ReturnItemSchema = SchemaFactory.createForClass(ReturnItem);

@Schema({ timestamps: true })
export class ReturnRequest {
  @Prop({ type: Types.ObjectId, ref: 'TestOrder2', required: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  supplierId?: Types.ObjectId;

  @Prop({ type: String, enum: ['pending', 'resolved'], default: 'pending', index: true })
  status!: 'pending' | 'resolved';

  @Prop({ type: [ReturnItemSchema], default: [] })
  items!: ReturnItem[];

  @Prop()
  reason?: string;

  @Prop({ type: Date })
  resolvedAt?: Date;
}

export const ReturnRequestSchema = SchemaFactory.createForClass(ReturnRequest);
ReturnRequestSchema.index({ orderId: 1, createdAt: -1 });
ReturnRequestSchema.index(
  { orderId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  },
);
