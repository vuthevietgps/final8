import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OwnerFundAccountDocument = OwnerFundAccount & Document;

/**
 * Schema cho Quỹ Owner - Tài khoản ngân hàng riêng của Owner
 * Đây là quỹ riêng biệt với Bank Balance của công ty
 */
@Schema({ timestamps: true, collection: 'owner_fund_accounts' })
export class OwnerFundAccount {
  @Prop({ required: true })
  name: string; // Tên quỹ, ví dụ: "Quỹ Owner chính"

  @Prop({ default: 0 })
  balance: number; // Số dư hiện tại trong quỹ

  @Prop({ default: 0 })
  totalDeposited: number; // Tổng tiền đã nạp vào quỹ (từ Bank Balance)

  @Prop({ default: 0 })
  totalWithdrawn: number; // Tổng tiền đã rút ra khỏi quỹ (Owner rút)

  @Prop({ default: 0 })
  totalReturnedToCompany: number; // Tổng tiền đã nạp lại về công ty

  @Prop()
  bankAccount: string; // Số tài khoản ngân hàng của quỹ Owner

  @Prop()
  bankName: string; // Tên ngân hàng

  @Prop()
  bankAccountName: string; // Tên chủ tài khoản

  // Monotonic write token used to serialize bank -> Owner Fund transfers.
  @Prop({ default: 0, select: false })
  transferVersion: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes: string;
}

export const OwnerFundAccountSchema = SchemaFactory.createForClass(OwnerFundAccount);

// The ERP has one canonical active Owner Fund account. Historical inactive
// accounts may remain, but concurrent bootstraps must never create two active
// balances that different transactions could select independently.
OwnerFundAccountSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'uniq_owner_fund_active_account',
  },
);
