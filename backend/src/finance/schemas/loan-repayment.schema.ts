import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LoanContract } from './loan-contract.schema';

export type LoanRepaymentDocument = LoanRepayment & Document;

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

  @Prop()
  referenceId?: string;

  @Prop()
  notes?: string;
}

export const LoanRepaymentSchema = SchemaFactory.createForClass(LoanRepayment);
