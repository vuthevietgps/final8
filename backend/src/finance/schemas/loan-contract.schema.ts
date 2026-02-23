import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LoanContractDocument = LoanContract & Document;

/**
 * Trạng thái giải ngân khoản vay
 * - pending: Chưa giải ngân (đã ký hợp đồng nhưng chưa nhận tiền)
 * - partial: Giải ngân một phần
 * - fully: Đã giải ngân toàn bộ
 */
export enum DisbursementStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  FULLY = 'fully',
}

@Schema({ timestamps: true })
export class LoanContract {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  lenderName: string;

  @Prop({ required: true, default: 0 })
  principal: number; // Tổng tiền vay theo hợp đồng

  @Prop({ default: 0 })
  principalRemaining: number; // Dư nợ gốc còn lại (chưa trả)

  @Prop({ default: 0 })
  interestRate?: number;

  @Prop()
  repaymentCycle?: string;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop({ default: false })
  restricted?: boolean;

  @Prop({ enum: ['active', 'draft', 'closed'], default: 'active' })
  status?: 'active' | 'draft' | 'closed';

  @Prop()
  notes?: string;

  // ═══════════════════════════════════════════════════════════
  // GIẢI NGÂN (DISBURSEMENT) - Tiền VÀO Bank Balance
  // ═══════════════════════════════════════════════════════════

  /** Trạng thái giải ngân */
  @Prop({ enum: ['pending', 'partial', 'fully'], default: 'pending' })
  disbursementStatus?: 'pending' | 'partial' | 'fully';

  /** Số tiền đã giải ngân (tiền thực nhận vào tài khoản) */
  @Prop({ default: 0 })
  disbursedAmount: number;

  /** Ngày giải ngân (lần đầu hoặc lần cuối) */
  @Prop()
  disbursedDate?: Date;

  // ═══════════════════════════════════════════════════════════
  // TRẢ NỢ - Tổng hợp (tính từ LoanRepayment)
  // ═══════════════════════════════════════════════════════════

  /** Tổng tiền gốc đã trả (computed từ repayments) */
  @Prop({ default: 0 })
  totalPrincipalPaid: number;

  /** Tổng tiền lãi đã trả */
  @Prop({ default: 0 })
  totalInterestPaid: number;
}

export const LoanContractSchema = SchemaFactory.createForClass(LoanContract);
