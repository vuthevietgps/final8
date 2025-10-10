/**
 * File: user.schema.ts
 * Mục đích: Định nghĩa Mongoose Schema cho Người dùng (thông tin, vai trò, kích hoạt...).
 */
/**
 * User Schema - Định nghĩa cấu trúc dữ liệu User trong MongoDB
 * 
 * Chức năng:
 * - Định nghĩa các fields và kiểu dữ liệu
 * - Thiết lập validation rules
 * - Tự động thêm timestamps (createdAt, updatedAt)
 * - Tạo unique index cho email
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from './user.enum';
import * as bcrypt from 'bcryptjs';

// Type cho User document khi query từ MongoDB
export type UserDocument = User & Document;

@Schema({ timestamps: true }) // Tự động thêm createdAt và updatedAt
export class User {
  // Bắt buộc nhập họ tên
  @Prop({ required: true })
  fullName: string;

  // Email bắt buộc và không được trùng
  @Prop({ required: true, unique: true })
  email: string;

  // Mật khẩu bắt buộc
  @Prop({ required: true })
  password: string;

  // Số điện thoại bắt buộc
  @Prop()
  phone: string;

  // Vai trò bắt buộc, phải thuộc UserRole enum
  @Prop({ required: true, enum: UserRole })
  role: UserRole;

  // Địa chỉ không bắt buộc
  @Prop()
  address: string;

  // Trạng thái hoạt động, mặc định là true
  @Prop({ default: true })
  isActive: boolean;

  // ID phòng ban (không bắt buộc)
  @Prop()
  departmentId: string;

  // ID quản lý trực tiếp (không bắt buộc)
  @Prop()
  managerId: string;

  // Ghi chú (không bắt buộc)
  @Prop()
  notes: string;

  // Link Google Drive của user (không bắt buộc)
  @Prop()
  googleDriveLink?: string;

  // Danh sách IP được phép đăng nhập (áp dụng cho Manager và Employee)
  @Prop({ type: [String], default: [] })
  allowedLoginIps?: string[];

  // Timestamps sẽ được Mongoose tự động thêm do timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

// Tạo Mongoose schema từ class User
export const UserSchema = SchemaFactory.createForClass(User);

// Utility to detect bcrypt hashed password to avoid double-hashing
function isBcryptHash(value: any): boolean {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

// Hash password before saving if it has been modified
UserSchema.pre('save', async function (next) {
  const doc = this as any;
  if (!doc.isModified('password')) return next();
  try {
    if (isBcryptHash(doc.password)) return next();
    doc.password = await bcrypt.hash(doc.password, 12);
    next();
  } catch (err) {
    next(err as any);
  }
});

// Helper to hash password in update queries
async function hashPasswordInUpdate(this: any) {
  const update = this.getUpdate();
  if (!update) return;

  // Support both direct field set and $set operator
  const pwd = update.password ?? (update.$set && update.$set.password);
  if (!pwd) return;

  if (isBcryptHash(pwd)) return; // Skip if already hashed

  const hashed = await bcrypt.hash(pwd, 12);
  if (update.password) update.password = hashed;
  if (update.$set && update.$set.password) update.$set.password = hashed;

  this.setUpdate(update);
}

// Hash password on findOneAndUpdate
UserSchema.pre('findOneAndUpdate', async function (next) {
  try {
    await hashPasswordInUpdate.call(this);
    next();
  } catch (err) {
    next(err as any);
  }
});

// Hash password on updateOne
UserSchema.pre('updateOne', async function (next) {
  try {
    await hashPasswordInUpdate.call(this);
    next();
  } catch (err) {
    next(err as any);
  }
});
