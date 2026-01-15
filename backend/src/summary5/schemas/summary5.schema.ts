import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'summary5', timestamps: true })
export class Summary5 {
  // Tham chiếu 1:1 với Summary4 để đảm bảo đủ số dòng
  @Prop({ type: String, unique: true, sparse: true })
  summary4Id?: string;

  @Prop({ type: Date })
  orderDate?: Date;

  @Prop({ type: String, index: true })
  adGroupId?: string;

  // Cho phép báo cáo theo sản phẩm nếu cần
  @Prop({ type: String, index: true })
  productId?: string;

  @Prop({ type: Number, default: 0 })
  profit?: number;

  @Prop({ type: Number, default: 0 })
  revenue?: number;

  // Thu tiền
  @Prop({ type: String, enum: ['collected', 'receivable', 'partial'], default: 'receivable' })
  collectionStatus?: string;

  @Prop({ type: Number, default: 0 })
  collectedAmount?: number;

  @Prop({ type: Number, default: 0 })
  receivableAmount?: number;

  @Prop({ type: Number, default: 0 })
  adCost?: number;
}

export type Summary5Document = HydratedDocument<Summary5>;
export const Summary5Schema = SchemaFactory.createForClass(Summary5);

Summary5Schema.index({ orderDate: 1 });
Summary5Schema.index({ adGroupId: 1, orderDate: 1 });
Summary5Schema.index({ productId: 1, orderDate: 1 });
