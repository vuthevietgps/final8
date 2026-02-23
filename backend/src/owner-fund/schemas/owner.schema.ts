import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OwnerDocument = Owner & Document;

/**
 * Schema cho thông tin Owner (Chủ doanh nghiệp)
 */
@Schema({ timestamps: true, collection: 'owners' })
export class Owner {
  @Prop({ required: true })
  name: string;

  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop({ default: 20 }) // 20% lợi nhuận thuần
  profitSharePercentage: number;

  @Prop({ default: 0 })
  totalWithdrawn: number; // Tổng số tiền đã rút

  @Prop({ default: 0 })
  availableBalance: number; // Số dư khả dụng để rút

  @Prop()
  bankAccount: string;

  @Prop()
  bankName: string;

  @Prop()
  bankAccountName: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes: string;
}

export const OwnerSchema = SchemaFactory.createForClass(Owner);
