import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongoSchema } from 'mongoose';

@Schema({ timestamps: false })
export class OrderShipment {
  _id?: Types.ObjectId;
  @Prop({ type: String, required: true }) requestKey!: string;
  @Prop({ type: String, required: true }) requestHash!: string;
  @Prop({ type: String, required: true }) trackingNumber!: string;
  @Prop({ type: String, enum: ['preparing', 'dispatched', 'delivered', 'returning', 'returned', 'partial'], required: true }) status!: string;
  @Prop({ type: String, required: true }) senderKind!: string;
  @Prop({ type: String }) senderId?: string;
  @Prop({ type: String }) senderAddress?: string;
  @Prop({ type: String, required: true }) returnHolderKind!: string;
  @Prop({ type: String }) returnHolderId?: string;
  @Prop({ type: String }) returnAddress?: string;
  @Prop({ type: Types.ObjectId }) inventoryBatchId?: Types.ObjectId;
  @Prop({ type: String }) stockSource?: string;
  @Prop({ type: Number }) stockUnitCost?: number;
  @Prop({ type: Number, required: true }) quantity!: number;
  @Prop({ type: Number, default: 0 }) deliveredQuantity?: number;
  @Prop({ type: Number, required: true }) shippingCost!: number;
  @Prop({ type: Number, default: 0 }) returnCost!: number;
  @Prop({ type: Number, default: 0 }) returnCostQuote!: number;
  @Prop({ type: Number, required: true }) dealerShippingCharge!: number;
  @Prop({ type: Number, default: 0 }) dealerReturnCharge!: number;
  @Prop({ type: Number, default: 0 }) dealerReturnChargeQuote!: number;
  @Prop({ type: String, enum: ['supplier', 'other'], required: true }) feePayeeKind!: string;
  @Prop({ type: String }) feePayeeName?: string;
  @Prop({ type: Boolean, default: false }) feesConfirmed?: boolean;
  @Prop({ type: [MongoSchema.Types.Mixed], default: [] }) feeRevisions?: any[];
  @Prop({ type: Date, required: true }) createdAt!: Date;
  @Prop({ type: Date }) completedAt?: Date;
  @Prop({ type: String }) createdBy?: string;
}
export const OrderShipmentSchema = SchemaFactory.createForClass(OrderShipment);
