import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'ordertest2', timestamps: true })
export class TestOrder2 {
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  @Prop({ type: String })
  customerName?: string;

  @Prop({ type: Number, default: 1 })
  quantity?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  @Prop({ type: String, index: true })
  adGroupId?: string;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;

  @Prop({ type: String, default: 'Chưa làm' })
  productionStatus?: string;

  @Prop({ type: String, default: 'Chưa có mã vận đơn' })
  orderStatus?: string;

  @Prop({ type: String })
  serviceDetails?: string;

  @Prop({ type: String })
  submitLink?: string;

  @Prop({ type: String })
  trackingNumber?: string;

  @Prop({ type: Number, default: 0 })
  depositAmount?: number;

  @Prop({ type: Number, default: 0 })
  codAmount?: number;

  @Prop({ type: Number, default: 0 })
  manualPayment?: number;

  @Prop({ type: String })
  receiverName?: string;

  @Prop({ type: String })
  receiverPhone?: string;

  @Prop({ type: String })
  receiverAddress?: string;

  @Prop({ type: Date })
  orderDate?: Date;

  // timestamps (added for proper TypeScript typing)
  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export type TestOrder2Document = HydratedDocument<TestOrder2>;
export const TestOrder2Schema = SchemaFactory.createForClass(TestOrder2);

TestOrder2Schema.index({ trackingNumber: 1 });
TestOrder2Schema.index({ adGroupId: 1, orderDate: 1 });
