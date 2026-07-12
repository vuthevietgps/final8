import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupplierQuoteDocument = HydratedDocument<SupplierQuote>;
export const SUPPLIER_QUOTE_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type SupplierQuoteApprovalStatus = (typeof SUPPLIER_QUOTE_APPROVAL_STATUSES)[number];
export const SUPPLIER_QUOTE_AUDIT_DECISIONS = [
  'created',
  'provenance_claimed',
  'approved',
  'rejected',
  'reset_to_pending',
] as const;
export type SupplierQuoteAuditDecision = (typeof SUPPLIER_QUOTE_AUDIT_DECISIONS)[number];

@Schema({ _id: false })
export class SupplierQuoteApprovalHistoryEntry {
  @Prop({ required: true, enum: SUPPLIER_QUOTE_AUDIT_DECISIONS })
  decision!: SupplierQuoteAuditDecision;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId!: Types.ObjectId;

  @Prop({ type: String, trim: true, maxlength: 200 })
  actorLabel?: string;

  @Prop({ type: Date, required: true })
  at!: Date;

  @Prop({ type: String, trim: true, maxlength: 500 })
  reason?: string;

  @Prop({ type: Number, required: true })
  priceSnapshot!: number;
}

export const SupplierQuoteApprovalHistoryEntrySchema = SchemaFactory.createForClass(
  SupplierQuoteApprovalHistoryEntry,
);

@Schema({ timestamps: true, optimisticConcurrency: true })
export class SupplierQuote {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  supplierId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  price!: number;

  // Cho phép override chính sách hoàn hàng theo từng NCC
  @Prop({ type: Boolean })
  isReturnableOverride?: boolean;

  // Phí giao và phí hoàn do NCC báo giá (đơn vị: cùng currency)
  @Prop({ type: Number, default: 0 })
  shippingFee?: number;

  @Prop({ type: Number, default: 0 })
  returnFee?: number;

  @Prop({ type: String, default: 'VND' })
  currency!: string;

  @Prop({ type: Date })
  effectiveAt?: Date;

  @Prop({ type: String })
  note?: string;

  /**
   * Server-authenticated provenance used by the separation-of-duties gate.
   * Optional at schema level only so legacy rows can be loaded and repaired;
   * approval/rejection fails closed while either field is absent.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  lastCommercialEditedBy?: Types.ObjectId;

  @Prop({
    type: String,
    enum: SUPPLIER_QUOTE_APPROVAL_STATUSES,
    default: 'pending',
    index: true,
  })
  approvalStatus!: SupplierQuoteApprovalStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  rejectedBy?: Types.ObjectId;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ type: String, trim: true, maxlength: 500 })
  rejectionReason?: string;

  @Prop({ type: [SupplierQuoteApprovalHistoryEntrySchema], default: [] })
  approvalHistory!: SupplierQuoteApprovalHistoryEntry[];
}

export const SupplierQuoteSchema = SchemaFactory.createForClass(SupplierQuote);
SupplierQuoteSchema.index({ productId: 1, supplierId: 1, effectiveAt: -1, createdAt: -1 });
SupplierQuoteSchema.index({ approvalStatus: 1, effectiveAt: -1, createdAt: -1 });
SupplierQuoteSchema.index({ createdBy: 1, lastCommercialEditedBy: 1, approvalStatus: 1 });
