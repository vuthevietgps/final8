import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryTransactionDocument = InventoryTransaction & Document;

export type InventoryTxType = 'receive' | 'adjust' | 'sale' | 'return';

@Schema({ timestamps: true })
export class InventoryTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Product', index: true, required: true })
  productId!: Types.ObjectId;

  @Prop({ type: String, enum: ['receive','adjust','sale','return'], required: true, index: true })
  type!: InventoryTxType;

  @Prop({ type: Number, required: true })
  quantity!: number; // + for inbound, - for outbound

  @Prop({ type: Number })
  unitCost?: number; // applicable for inbound/positive adjustments to compute WAC

  @Prop({ type: Types.ObjectId, ref: 'PurchaseOrder' })
  purchaseOrderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  supplierId?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now, index: true })
  occurredAt!: Date;

  @Prop({ type: String })
  notes?: string;
}

export const InventoryTransactionSchema = SchemaFactory.createForClass(InventoryTransaction);
InventoryTransactionSchema.index({ productId: 1, occurredAt: -1 });
InventoryTransactionSchema.index({ type: 1, occurredAt: -1 });
