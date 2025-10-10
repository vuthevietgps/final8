import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type Summary4Document = Summary4 & Document;

@Schema({ collection: 'summary4', timestamps: true })
export class Summary4 {
  @Prop({ type: Types.ObjectId, ref: 'TestOrder2', required: true })
  testOrder2Id: Types.ObjectId;

  @Prop({ type: Date, required: true })
  orderDate: Date;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  product: string;

  @Prop({ type: Number, required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  agentName: string;

  @Prop({ required: true, default: '0' })
  adGroupId: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop()
  serviceDetails?: string;

  @Prop({ required: true })
  productionStatus: string;

  @Prop({ required: true })
  orderStatus: string;

  @Prop()
  submitLink?: string;

  @Prop()
  trackingNumber?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  depositAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  codAmount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  agentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Number, default: 0, min: 0 })
  approvedQuotePrice: number;

  @Prop({ type: Number, default: 0, min: 0 })
  mustPayToCompany: number;

  @Prop({ type: Number, default: 0, min: 0 })
  paidToCompany: number;

  @Prop({ type: Number, default: 0 })
  manualPayment: number;

  @Prop({ type: Number, default: 0 })
  needToPay: number;
}

export const Summary4Schema = SchemaFactory.createForClass(Summary4);

Summary4Schema.index({ agentId: 1 });
Summary4Schema.index({ productId: 1 });
Summary4Schema.index({ orderDate: -1 });
Summary4Schema.index({ productionStatus: 1 });
Summary4Schema.index({ orderStatus: 1 });
Summary4Schema.index({ testOrder2Id: 1 }, { unique: true });
