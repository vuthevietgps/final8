import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export type FundTransactionDocument = FundTransaction & Document;

export enum FundTransactionType {
  IN = 'in',     // Tiền vào quỹ (lợi nhuận phân bổ, góp vốn)
  OUT = 'out',   // Tiền ra quỹ (rút tiền, chi phí)
}

export enum FundTransactionCategory {
  // Loại tiền VÀO
  PROFIT_SHARE = 'profit_share',         // Phân bổ lợi nhuận
  CAPITAL_CONTRIBUTION = 'capital_contribution', // Góp vốn
  REFUND = 'refund',                     // Hoàn tiền
  BANK_TRANSFER_IN = 'bank_transfer_in', // Chuyển từ Bank Balance vào Quỹ Owner
  OTHER_IN = 'other_in',                 // Khác (vào)

  // Loại tiền RA
  WITHDRAWAL_PROFIT = 'withdrawal_profit',     // Rút lợi nhuận
  WITHDRAWAL_EMERGENCY = 'withdrawal_emergency', // Rút khẩn cấp
  WITHDRAWAL_ADVANCE = 'withdrawal_advance',   // Tạm ứng
  BANK_TRANSFER_OUT = 'bank_transfer_out', // Chuyển từ Quỹ Owner về Bank Balance
  PERSONAL_WITHDRAWAL = 'personal_withdrawal', // Rút về cá nhân
  TAX = 'tax',                           // Thuế
  OTHER_OUT = 'other_out',               // Khác (ra)
}

/**
 * Schema cho Giao Dịch Quỹ Owner
 * Ghi nhận tất cả tiền vào/ra quỹ của Owner
 */
@Schema({ timestamps: true, collection: 'fund_transactions' })
export class FundTransaction {
  @Prop({ trim: true })
  idempotencyKey?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Owner', required: false })
  ownerId?: Types.ObjectId;

  @Prop({ type: String, enum: FundTransactionType, required: true })
  type: FundTransactionType;

  @Prop({ type: String, enum: FundTransactionCategory, required: true })
  category: FundTransactionCategory;

  @Prop({ required: true })
  amount: number;

  @Prop()
  date: Date;

  @Prop()
  description: string;

  @Prop()
  notes: string;

  @Prop()
  referenceId: string; // ID liên kết (withdrawalId, profitReportId, ...)

  @Prop()
  reference: string; // Mã tham chiếu giao dịch

  @Prop()
  referenceType: string; // 'withdrawal', 'profit_report', 'manual'

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ default: 0 })
  balanceAfter: number; // Số dư sau giao dịch

  @Prop()
  bankAccount?: string; // Tài khoản ngân hàng (cho rút tiền cá nhân)

  @Prop()
  bankName?: string; // Tên ngân hàng
}

export const FundTransactionSchema = SchemaFactory.createForClass(FundTransaction);

// Indexes
FundTransactionSchema.index({ ownerId: 1, date: -1 });
FundTransactionSchema.index({ type: 1, date: -1 });
FundTransactionSchema.index({ category: 1 });
FundTransactionSchema.index({ date: -1 });
FundTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
