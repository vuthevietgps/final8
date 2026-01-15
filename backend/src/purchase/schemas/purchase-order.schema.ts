import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PurchaseStatus } from '../dto/create-purchase-order.dto';

export type PurchaseOrderDocument = PurchaseOrder & Document;

@Schema()
export class PurchaseItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop()
  productNameSnap?: string;

  @Prop({ type: Number, required: true })
  quantity!: number; // ordered quantity

  @Prop({ type: Number, required: true })
  unitPrice!: number;

  @Prop()
  currency?: string;

  @Prop({ type: Number, default: 0 })
  quantityReceived!: number; // cumulative received qty

  @Prop()
  notes?: string;
}

const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);

@Schema({ timestamps: true })
export class PurchaseOrder {
  @Prop({ unique: true, sparse: true })
  poNumber?: string; // Số PO (PO-001, PO-002, ...)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  supplierId!: Types.ObjectId;

  @Prop()
  supplierNameSnap?: string;

  @Prop({ type: String, enum: Object.values(PurchaseStatus), default: PurchaseStatus.DRAFT })
  status!: PurchaseStatus;

  @Prop({ type: Date })
  expectedDeliveryDate?: Date;

  @Prop({ type: Date })
  receivedDate?: Date;

  @Prop({ type: [PurchaseItemSchema], default: [] })
  items!: PurchaseItem[];

  // Totals and fees
  @Prop({ type: Number, default: 0 })
  itemsTotal!: number;

  @Prop({ type: Number, default: 0 })
  tax!: number;

  @Prop({ type: Number, default: 0 })
  shippingFee!: number;

  @Prop({ type: Number, default: 0 })
  discount!: number;

  @Prop({ type: Number, default: 0 })
  grandTotal!: number;

  @Prop()
  notes?: string;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);

// Auto-generate poNumber before saving
PurchaseOrderSchema.pre('save', async function() {
  if (!this.poNumber) {
    const count = await (this.constructor as any).countDocuments();
    this.poNumber = `PO-${String(count + 1).padStart(4, '0')}`;
  }
});

// Indexes
PurchaseOrderSchema.index({ supplierId: 1, createdAt: -1 });
PurchaseOrderSchema.index({ status: 1, createdAt: -1 });
PurchaseOrderSchema.index({ poNumber: 1 });
PurchaseOrderSchema.index({ receivedDate: -1 });
PurchaseOrderSchema.index({ supplierId: 1, receivedDate: -1 });
