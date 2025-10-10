/**
 * Schema: ApiToken
 * Mô tả: Lưu thông tin Access Token / API Token dùng cho chatbot & tích hợp.
 * Các nhóm field chính:
 *  - Thông tin cơ bản: name, token(raw), provider, status, fanpageId, notes
 *  - Quản lý vòng đời: isPrimary, expireAt
 *  - Kiểm tra: lastCheckedAt, lastCheckStatus, lastCheckMessage, scopes
 *  - Rotate tracking: rotatedFrom, rotatedTo
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ApiTokenDocument = ApiToken & Document;

@Schema({ timestamps: true })
export class ApiToken {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, trim: true }) token: string; // raw bearer token (encrypt later)
  @Prop({ trim: true, required: false }) tokenEnc?: string; // token mã hóa (AES-GCM)
  @Prop({ trim: true, index: true }) tokenHash?: string; // SHA-256 hash để phát hiện thay đổi
  @Prop({ enum: ['facebook','zalo','other'], default: 'facebook', index: true }) provider: 'facebook' | 'zalo' | 'other';
  @Prop({ enum: ['active','inactive'], default: 'active' }) status: 'active' | 'inactive';
  @Prop({ type: Types.ObjectId, ref: 'Fanpage' }) fanpageId?: Types.ObjectId;
  @Prop({ trim: true }) notes?: string;
  // New fields
  @Prop({ default: false, index: true }) isPrimary: boolean; // token chính cho fanpage
  @Prop() expireAt?: Date; // ngày hết hạn (nếu provider có)
  @Prop() lastCheckedAt?: Date; // lần kiểm tra gần nhất
  @Prop({ enum: ['valid','invalid','expired'], required: false }) lastCheckStatus?: 'valid' | 'invalid' | 'expired';
  @Prop({ trim: true }) lastCheckMessage?: string; // ghi chú kết quả kiểm tra
  @Prop({ default: 0 }) consecutiveFail?: number; // số lần validate/gửi lỗi liên tiếp
  @Prop({ default: false }) degraded?: boolean; // đã fallback khỏi primary
  @Prop({ type: Types.ObjectId, ref: 'ApiToken' }) rotatedFrom?: Types.ObjectId; // tham chiếu token cũ
  @Prop({ type: Types.ObjectId, ref: 'ApiToken' }) rotatedTo?: Types.ObjectId; // tham chiếu token mới
  @Prop([String]) scopes?: string[]; // quyền lấy được từ provider
  @Prop() nextCheckAt?: Date; // thời điểm kế tiếp sẽ tự động kiểm tra (random 25-30 phút sau mỗi lần kiểm tra)
}
export const ApiTokenSchema = SchemaFactory.createForClass(ApiToken);
ApiTokenSchema.index({ provider: 1, status: 1 });
ApiTokenSchema.index({ fanpageId: 1, isPrimary: 1 });
ApiTokenSchema.index({ nextCheckAt: 1 });
