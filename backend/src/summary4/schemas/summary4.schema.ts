import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type Summary4Document = Summary4 & Document;

@Schema({ 
  collection: 'summary4',
  timestamps: true 
})
export class Summary4 {
  @Prop({ type: Types.ObjectId, ref: 'TestOrder2', required: true })
  testOrder2Id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  agentId: Types.ObjectId;

  // Product reference (present in Docker v10.0 Summary4 for populate in Google Sync)
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  // Unit cost applied for this order (can come from supplier/FIFO), and total cost = unit × quantity
  @Prop({ type: Number })
  productCost?: number;

  @Prop({ type: Number })
  productCostTotal?: number;

  @Prop({ type: Types.ObjectId, ref: 'Supplier' })
  supplierId?: Types.ObjectId;

  @Prop({ type: String })
  costSource?: string; // product|supplier|inventory

  @Prop({ type: Number })
  approvedQuotePrice: number;

  @Prop({ type: Number })
  mustPayAmount: number;

  @Prop({ type: Number })
  paidToCompanyAmount: number;

  @Prop({ type: Number })
  manualPaymentAmount: number;

  @Prop({ type: Number })
  needToPayAmount: number;

  // Thu tiền: doanh thu đã thu vs còn phải thu
  @Prop({ type: String, enum: ['collected', 'receivable', 'partial'], default: 'receivable' })
  collectionStatus?: string;

  @Prop({ type: Number, default: 0 })
  collectedAmount?: number; // số đã thu được

  @Prop({ type: Number, default: 0 })
  receivableAmount?: number; // số còn phải thu (công nợ)

  // Order related fields
  @Prop()
  orderDate: Date;

  @Prop()
  customerName: string;

  @Prop({ type: Number })
  quantity: number;

  @Prop()
  trackingNumber: string;

  @Prop()
  productionStatus: string;

  @Prop()
  orderStatus: string;

  @Prop({ type: Number })
  codAmount: number;

  @Prop({ type: Number })
  depositAmount: number;

  @Prop({ type: String })
  paymentStatus: string;

  @Prop({ type: Date })
  paymentDate: Date;

  @Prop({ type: String })
  notes: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop({ type: String })
  adGroupId: string;

  @Prop({ type: String })
  submitLink: string;
}

export const Summary4Schema = SchemaFactory.createForClass(Summary4);