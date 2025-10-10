/**
 * File: facebook-token/schemas/facebook-token.schema.ts
 * Mục đích: Định nghĩa schema Mongoose cho Facebook Access Tokens
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FacebookTokenDocument = FacebookToken & Document;

@Schema({ timestamps: true })
export class FacebookToken {
  // Tên hiển thị cho token này
  @Prop({ type: String, required: true, trim: true })
  name: string;

  // Facebook Access Token (encrypted)
  @Prop({ type: String, required: true })
  accessToken: string;

  // Token type (user, page, app)
  @Prop({ type: String, enum: ['user', 'page', 'app'], default: 'user' })
  tokenType: string;

  // App ID liên quan
  @Prop({ type: String, required: false })
  appId?: string;

  // User ID của người tạo token
  @Prop({ type: String, required: false })
  userId?: string;

  // Ngày hết hạn token
  @Prop({ type: Date, required: false })
  expiresAt?: Date;

  // Permissions của token
  @Prop({ type: [String], default: [] })
  permissions: string[];

  // Token có active không
  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  // Token được sử dụng làm default không
  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  // Lần cuối sử dụng
  @Prop({ type: Date, required: false })
  lastUsedAt?: Date;

  // Số lần sử dụng
  @Prop({ type: Number, default: 0 })
  usageCount: number;

  // Ghi chú
  @Prop({ type: String, required: false })
  notes?: string;
}

export const FacebookTokenSchema = SchemaFactory.createForClass(FacebookToken);

FacebookTokenSchema.index({ isActive: 1, isDefault: 1 });
FacebookTokenSchema.index({ createdAt: -1 });
FacebookTokenSchema.index({ lastUsedAt: -1 });