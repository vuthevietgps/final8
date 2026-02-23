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

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes: string;
}

export const OwnerFundAccountSchema = SchemaFactory.createForClass(OwnerFundAccount);
