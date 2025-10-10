/**
 * File: schemas/production-status.schema.ts
 * Mục đích: Định nghĩa schema cho trạng thái sản xuất.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Schema cho trạng thái sản xuất
 * Định nghĩa cấu trúc dữ liệu cho trạng thái sản xuất trong MongoDB
 */
export type ProductionStatusDocument = ProductionStatus & Document;

@Schema({ timestamps: true })
export class ProductionStatus {
  /**
   * Tên trạng thái sản xuất
   * VD: "Chờ sản xuất", "Đang sản xuất", "Hoàn thành", "Tạm dừng"
   */
  @Prop({ required: true, trim: true })
  name: string;

  /**
   * Màu sắc đại diện cho trạng thái (hex color)
   * VD: "#FF5733", "#33FF57", "#3357FF"
   */
  @Prop({ required: true, match: /^#[0-9A-F]{6}$/i })
  color: string;

  /**
   * Mô tả chi tiết về trạng thái
   */
  @Prop({ trim: true })
  description?: string;

  /**
   * Thứ tự hiển thị của trạng thái
   */
  @Prop({ default: 0 })
  order: number;

  /**
   * Trạng thái có đang hoạt động không
   */
  @Prop({ default: true })
  isActive: boolean;
}

export const ProductionStatusSchema = SchemaFactory.createForClass(ProductionStatus);
