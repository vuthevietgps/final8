import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BudgetBucket } from './budget-bucket.schema';
import { FundingSource } from './funding-source.schema';

export type CashflowEntryDocument = CashflowEntry & Document;

@Schema({ timestamps: true })
export class CashflowEntry {
  @Prop({ trim: true })
  idempotencyKey?: string;

  @Prop({ enum: ['in', 'out'], required: true })
  direction: 'in' | 'out';

  @Prop({ enum: ['cod', 'deposit', 'loan', 'equity', 'other', 'owner_fund'], required: true })
  sourceType: 'cod' | 'deposit' | 'loan' | 'equity' | 'other' | 'owner_fund';

  @Prop({ required: true })
  amount: number;

  @Prop({ default: () => new Date() })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: BudgetBucket.name })
  bucketId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: FundingSource.name })
  fundingSourceId?: Types.ObjectId;

  @Prop()
  category?: string;

  @Prop()
  referenceId?: string;

  @Prop()
  description?: string;
}

export const CashflowEntrySchema = SchemaFactory.createForClass(CashflowEntry);
CashflowEntrySchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
