import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WithdrawalDocument = Withdrawal & Document;

export enum WithdrawalStatus {
  PENDING = 'pending',       // Chờ duyệt
  APPROVED = 'approved',     // Đã duyệt
  REJECTED = 'rejected',     // Từ chối
  COMPLETED = 'completed',   // Đã chuyển tiền
  CANCELLED = 'cancelled',   // Đã hủy
}

export enum WithdrawalType {
  PROFIT_SHARE = 'profit_share',    // Rút lợi nhuận định kỳ
  EMERGENCY = 'emergency',          // Rút khẩn cấp
  ADVANCE = 'advance',              // Tạm ứng
}

/**
 * Schema cho Phiếu Rút Tiền Owner
 */
@Schema({ timestamps: true, collection: 'withdrawals' })
export class Withdrawal {
  @Prop({ type: Types.ObjectId, ref: 'Owner', required: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: WithdrawalType, default: WithdrawalType.PROFIT_SHARE })
  type: WithdrawalType;

  @Prop({ type: String, enum: WithdrawalStatus, default: WithdrawalStatus.PENDING })
  status: WithdrawalStatus;

  @Prop()
  requestDate: Date;

  @Prop()
  approvedDate: Date;

  @Prop()
  completedDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy: Types.ObjectId;

  @Prop()
  approvalNotes: string;

  @Prop()
  reason: string; // Lý do rút tiền

  @Prop()
  notes: string;

  @Prop()
  bankAccount: string;

  @Prop()
  bankName: string;

  @Prop()
  bankAccountName: string;

  @Prop()
  transactionReference: string; // Mã giao dịch ngân hàng

  @Prop({ default: false })
  isUrgent: boolean;
}

export const WithdrawalSchema = SchemaFactory.createForClass(Withdrawal);

// Indexes
WithdrawalSchema.index({ ownerId: 1, status: 1 });
WithdrawalSchema.index({ requestDate: -1 });
WithdrawalSchema.index({ status: 1, requestDate: -1 });
