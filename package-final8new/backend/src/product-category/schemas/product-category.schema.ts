/**
 * File: schemas/product-category.schema.ts
 * Mục đích: Định nghĩa schema cho Nhóm Sản phẩm.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductCategoryDocument = ProductCategory & Document;

@Schema({ timestamps: true })
export class ProductCategory {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ default: '#3498db' })
  color: string;

  @Prop({ default: '📦' })
  icon: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 1 })
  order: number;

  @Prop({ trim: true })
  code: string; // Mã nhóm sản phẩm (VD: SP001, CAT001)

  @Prop({ default: 0 })
  productCount: number; // Số lượng sản phẩm trong nhóm

  @Prop({ trim: true })
  notes: string; // Ghi chú thêm về nhóm sản phẩm
}

export const ProductCategorySchema = SchemaFactory.createForClass(ProductCategory);

// Tạo index cho tìm kiếm nhanh
ProductCategorySchema.index({ isActive: 1 });
ProductCategorySchema.index({ order: 1 });
