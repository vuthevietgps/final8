import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'summary5', timestamps: true })
export class Summary5 {
  @Prop({ type: Date })
  orderDate?: Date;

  @Prop({ type: String, index: true })
  adGroupId?: string;

  @Prop({ type: Number, default: 0 })
  profit?: number;

  @Prop({ type: Number, default: 0 })
  revenue?: number;

  @Prop({ type: Number, default: 0 })
  adCost?: number;
}

export type Summary5Document = HydratedDocument<Summary5>;
export const Summary5Schema = SchemaFactory.createForClass(Summary5);

Summary5Schema.index({ orderDate: 1 });
Summary5Schema.index({ adGroupId: 1, orderDate: 1 });
