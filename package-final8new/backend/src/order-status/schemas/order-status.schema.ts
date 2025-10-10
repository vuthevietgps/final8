/**
 * File: schemas/order-status.schema.ts
 * Mục đích: Định nghĩa schema cho trạng thái đơn hàng.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Schema cho trạng thái đơn hàng
 * Định nghĩa cấu trúc dữ liệu cho trạng thái đơn hàng trong MongoDB
 */
export type OrderStatusDocument = OrderStatus & Document;

@Schema({ timestamps: true })
export class OrderStatus {
  /**
   * Tên trạng thái đơn hàng
   * VD: "Chờ xác nhận", "Đã xác nhận", "Đang xử lý", "Đang giao hàng", "Hoàn thành", "Đã hủy"
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
   * Mô tả chi tiết về trạng thái đơn hàng
   */
  @Prop({ trim: true })
  description?: string;

  /**
   * Thứ tự hiển thị của trạng thái
   * Số nhỏ hơn sẽ hiển thị trước
   */
  @Prop({ default: 0 })
  order: number;

  /**
   * Trạng thái có đang hoạt động không
   */
  @Prop({ default: true })
  isActive: boolean;

  /**
   * Có phải trạng thái cuối (completed/cancelled) không
   * Dùng để phân biệt trạng thái đang xử lý và trạng thái kết thúc
   */
  @Prop({ default: false })
  isFinal: boolean;

  /**
   * Icon đại diện cho trạng thái (emoji hoặc icon class)
   */
  @Prop({ default: '📦' })
  icon: string;
}

export const OrderStatusSchema = SchemaFactory.createForClass(OrderStatus);
