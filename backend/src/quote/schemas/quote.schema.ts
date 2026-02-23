/**
 * File: schemas/quote.schema.ts
 * Mục đích: Định nghĩa Mongoose Schema/Document cho Báo giá (fields, enum status, timestamps),
 *   liên kết tới sản phẩm (productId) và đại lý (agentId).
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { QUOTE_STATUS_VALUES, QuoteStatus } from '../quote.enum';

export type QuoteDocument = Quote & Document;

@Schema({ timestamps: true })
export class Quote {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  agentId: Types.ObjectId;

  @Prop({ required: true })
  product: string; // Tên sản phẩm từ bảng Product

  @Prop({ required: true })
  agentName: string; // Tên đại lý từ bảng User

  @Prop({ required: true, min: 0 })
  unitPrice: number; // Đổi từ price sang unitPrice

  @Prop({ 
    required: true, 
    enum: QUOTE_STATUS_VALUES,
    default: QuoteStatus.PENDING
  })
  status: string;

  @Prop({ type: Date, required: true })
  validFrom: Date; // Ngày bắt đầu hiệu lực

  @Prop({ type: Date, required: true })
  validUntil: Date; // Ngày kết thúc hiệu lực

  @Prop({ maxlength: 500 })
  notes?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);

// Add indexes for better performance
QuoteSchema.index({ agentId: 1, status: 1 });
QuoteSchema.index({ productId: 1 });
QuoteSchema.index({ validUntil: 1 }); // Thay expiryDate bằng validUntil
QuoteSchema.index({ agentName: 1, product: 1 }); // Index cho matching nhanh
QuoteSchema.index({ product: 1 });
QuoteSchema.index({ agentName: 1 });
