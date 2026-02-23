/**
 * Schema: ApiTokenAudit
 * Ghi lại các hành động quan trọng đối với token: create, validate, rotate, setPrimary, fallback, autoRotate
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ApiTokenAuditDocument = ApiTokenAudit & Document;

@Schema({ timestamps: true })
export class ApiTokenAudit {
  @Prop({ type: Types.ObjectId, ref: 'ApiToken', index: true }) tokenId: Types.ObjectId;
  @Prop({ trim: true }) action: string; // create|validate|rotate|setPrimary|fallback|autoRotate|syncImport
  @Prop({ type: Types.ObjectId, ref: 'User', required: false }) actorUserId?: Types.ObjectId;
  @Prop({ type: Object }) prev?: any; // snapshot trước (mask nếu chứa token)
  @Prop({ type: Object }) next?: any; // snapshot sau
  @Prop({ type: Object }) meta?: any; // thông tin thêm (reason, provider response,...)
}

export const ApiTokenAuditSchema = SchemaFactory.createForClass(ApiTokenAudit);
ApiTokenAuditSchema.index({ action: 1, createdAt: -1 });
