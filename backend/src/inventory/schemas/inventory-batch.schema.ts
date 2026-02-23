import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryBatchDocument = InventoryBatch & Document;

@Schema({ timestamps: true })
export class InventoryBatch {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ type: String, enum: ['purchase', 'return'], default: 'purchase' })
  source!: 'purchase' | 'return';

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  supplierId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PurchaseOrder', index: true })
  purchaseOrderId?: Types.ObjectId;

  @Prop({ type: Number, required: true })
  quantityRemaining!: number;

  @Prop({ type: Number, required: true })
  unitCost!: number;

  @Prop({ type: Date, default: Date.now, index: true })
  receivedAt!: Date;

  @Prop()
  notes?: string;
}

export const InventoryBatchSchema = SchemaFactory.createForClass(InventoryBatch);
InventoryBatchSchema.index({ productId: 1, receivedAt: 1 });
InventoryBatchSchema.index({ supplierId: 1, receivedAt: 1 });
