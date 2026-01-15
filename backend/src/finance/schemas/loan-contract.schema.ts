import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LoanContractDocument = LoanContract & Document;

@Schema({ timestamps: true })
export class LoanContract {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  lenderName: string;

  @Prop({ required: true, default: 0 })
  principal: number;

  @Prop({ default: 0 })
  principalRemaining: number;

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
}

export const LoanContractSchema = SchemaFactory.createForClass(LoanContract);
