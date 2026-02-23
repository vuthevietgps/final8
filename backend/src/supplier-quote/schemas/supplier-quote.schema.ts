import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupplierQuoteDocument = HydratedDocument<SupplierQuote>;

@Schema({ timestamps: true })
export class SupplierQuote {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  supplierId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  price!: number;

  // Cho phép override chính sách hoàn hàng theo từng NCC
  @Prop({ type: Boolean })
  isReturnableOverride?: boolean;

  // Phí giao và phí hoàn do NCC báo giá (đơn vị: cùng currency)
  @Prop({ type: Number, default: 0 })
  shippingFee?: number;

  @Prop({ type: Number, default: 0 })
  returnFee?: number;

  @Prop({ type: String, default: 'VND' })
  currency!: string;

  @Prop({ type: Date })
  effectiveAt?: Date;

  @Prop({ type: String })
  note?: string;
}

export const SupplierQuoteSchema = SchemaFactory.createForClass(SupplierQuote);
SupplierQuoteSchema.index({ productId: 1, supplierId: 1, effectiveAt: -1, createdAt: -1 });
