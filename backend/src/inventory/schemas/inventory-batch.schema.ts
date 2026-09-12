import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryBatchDocument = InventoryBatch & Document;

@Schema({ timestamps: true })
export class InventoryBatch {
  @Prop({ type: String, enum: ['company', 'dealer'], index: true })
  ownerKind?: string;

  @Prop({ type: String, index: true })
  ownerId?: string;

  @Prop({ type: String, enum: ['company', 'supplier', 'agent'] })
  holderKind?: string;

  @Prop({ type: String })
  holderId?: string;

  @Prop({ type: String })
  holderAddress?: string;

  @Prop({ type: String, index: true })
  originalOrderId?: string;

  @Prop({ type: String, unique: true, sparse: true })
  receiptKey?: string;

  @Prop({ type: String, enum: ['resellable', 'unusable'], default: 'resellable' })
  condition?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  quantityReserved?: number;

  @Prop({ type: [{ orderId: String, quantity: Number, state: String }], default: [] })
  reservations?: Array<{ orderId: string; quantity: number; state: string }>;
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
