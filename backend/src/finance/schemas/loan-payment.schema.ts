import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LoanPaymentDocument = LoanPayment & Document;

/**
 * Loại thanh toán khoản vay
 */
export enum LoanPaymentType {
  PRINCIPAL = 'principal',     // Trả gốc (giảm dư nợ)
  INTEREST = 'interest',       // Trả lãi
  SCHEDULED = 'scheduled',     // Trả theo kỳ hạn (gốc + lãi theo schedule)
  PAYOFF = 'payoff',          // Tất toán (trả hết)
}

/**
 * Nguồn tiền thanh toán
 */
export enum PaymentSource {
  BANK_BALANCE = 'bank_balance',   // Từ Bank Balance (Financial Control)
  OWNER_FUND = 'owner_fund',       // Từ Quỹ Owner
}

/**
 * Schema ghi nhận các lần thanh toán khoản vay
 * Audit trail đầy đủ cho mọi giao dịch trả nợ
 */
@Schema({ timestamps: true, collection: 'loan_payments' })
export class LoanPayment {
  @Prop({ type: Types.ObjectId, ref: 'LoanContract', required: true })
  loanId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: LoanPaymentType, required: true })
  paymentType: LoanPaymentType;

  @Prop({ default: 0 })
  amountToPrincipal: number;

  @Prop({ default: 0 })
  amountToInterest: number;

  @Prop({ type: String, enum: PaymentSource, required: true })
  source: PaymentSource;

  @Prop()
  sourceAccountId?: string; // ID của Owner Fund Account nếu source = owner_fund

  @Prop({ required: true, default: () => new Date() })
  paymentDate: Date;

  @Prop()
  referenceId?: string; // Mã giao dịch ngân hàng

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'LoanRepayment' })
  repaymentId?: Types.ObjectId; // Nếu thanh toán theo kỳ hạn cụ thể

  // Snapshot trước khi thanh toán (để audit)
  @Prop({ default: 0 })
  principalBeforePayment: number;

  @Prop({ default: 0 })
  principalAfterPayment: number;

  // Người tạo
  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const LoanPaymentSchema = SchemaFactory.createForClass(LoanPayment);

// Indexes
LoanPaymentSchema.index({ loanId: 1, paymentDate: -1 });
LoanPaymentSchema.index({ source: 1, paymentDate: -1 });
LoanPaymentSchema.index({ paymentType: 1 });
LoanPaymentSchema.index({ paymentDate: -1 });
