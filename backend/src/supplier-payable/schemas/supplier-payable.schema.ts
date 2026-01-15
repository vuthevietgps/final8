import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupplierPayableDocument = SupplierPayable & Document;

@Schema({ _id: false, timestamps: false })
export class SupplierPayableItem {
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  @Prop()
  productNameSnap?: string;

  @Prop({ type: Number, default: 0 })
  quantity?: number;

  @Prop({ type: Number, default: 0 })
  unitPrice?: number;

  @Prop({ type: Number, default: 0 })
  amount?: number;
}

export const SupplierPayableItemSchema = SchemaFactory.createForClass(SupplierPayableItem);

@Schema({ _id: false, timestamps: false })
export class SupplierPayment {
  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: Date, required: true })
  paidAt!: Date;

  @Prop()
  method?: string; // chuyển khoản / tiền mặt

  @Prop()
  reference?: string; // mã giao dịch / phiếu chi

  @Prop()
  notes?: string;
}

export const SupplierPaymentSchema = SchemaFactory.createForClass(SupplierPayment);

@Schema({ timestamps: true })
export class SupplierPayable {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  supplierId!: Types.ObjectId;

  @Prop()
  supplierNameSnap?: string;

  @Prop({ type: Types.ObjectId, ref: 'PurchaseOrder', index: true })
  purchaseOrderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TestOrder2', index: true })
  orderId?: Types.ObjectId;

  @Prop({ type: String, enum: ['draft', 'unpaid', 'partial', 'paid'], default: 'unpaid', index: true })
  status!: string;

  @Prop({ type: [SupplierPayableItemSchema], default: [] })
  items!: SupplierPayableItem[];

  @Prop({ type: Number, default: 0 })
  totalAmount!: number;

  @Prop({ type: Number, default: 0 })
  amountPaid!: number;

  @Prop({ type: Number, default: 0 })
  balance!: number;

  @Prop({ type: String, default: 'VND' })
  currency!: string;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop()
  notes?: string;

  @Prop({ type: [SupplierPaymentSchema], default: [] })
  payments!: SupplierPayment[];
}

export const SupplierPayableSchema = SchemaFactory.createForClass(SupplierPayable);
SupplierPayableSchema.index({ supplierId: 1, dueDate: -1 });
