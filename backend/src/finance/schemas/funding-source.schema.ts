import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FundingSourceDocument = FundingSource & Document;

@Schema({ timestamps: true })
export class FundingSource {
  @Prop({ required: true })
  name: string;

  @Prop({ enum: ['loan', 'equity', 'internal'], required: true })
  type: 'loan' | 'equity' | 'internal';

  @Prop()
  lenderOrInvestor?: string;

  @Prop({ default: 0 })
  principal?: number;

  @Prop({ default: 0 })
  availableBalance?: number;

  @Prop({ default: 0 })
  interestRate?: number;

  @Prop()
  repaymentCycle?: string;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop({ type: [String], default: [] })
  targetProductGroups?: string[];

  @Prop({ default: false })
  restricted?: boolean;

  @Prop({ enum: ['active', 'draft', 'closed'], default: 'active' })
  status?: 'active' | 'draft' | 'closed';

  @Prop()
  notes?: string;
}

export const FundingSourceSchema = SchemaFactory.createForClass(FundingSource);
