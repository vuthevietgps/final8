import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LoanContract } from './loan-contract.schema';

export type LoanRepaymentDocument = LoanRepayment & Document;

export enum LoanRepaymentFundingSource {
  BANK = 'bank',
  OWNER_FUND = 'owner_fund',
}

@Schema({ timestamps: true })
export class LoanRepayment {
  @Prop({ type: Types.ObjectId, ref: LoanContract.name, required: true })
  loanId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  amountPrincipal: number;

  @Prop({ default: 0 })
  amountInterest?: number;

  @Prop({ default: () => new Date() })
  dueDate?: Date;

  @Prop({ default: false })
  paid?: boolean;

  @Prop()
  paidDate?: Date;

  @Prop({ enum: ['bank', 'owner_fund'], default: 'bank' })
  fundingSource?: 'bank' | 'owner_fund';

  @Prop()
  referenceId?: string;

  @Prop()
  notes?: string;
}

export const LoanRepaymentSchema = SchemaFactory.createForClass(LoanRepayment);
