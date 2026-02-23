import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { FundingSource } from './funding-source.schema';

export type BudgetBucketDocument = BudgetBucket & Document;

@Schema({ timestamps: true })
export class BudgetBucket {
  @Prop({ required: true })
  name: string;

  @Prop()
  code?: string;

  @Prop({ type: [String], default: [] })
  productGroupIds?: string[];

  @Prop({ default: 0 })
  dailyCap?: number;

  @Prop({ default: 0 })
  weeklyCap?: number;

  @Prop({ default: 0 })
  monthlyCap?: number;

  @Prop({
    type: [
      {
        sourceId: { type: Types.ObjectId, ref: FundingSource.name },
        allocated: { type: Number, default: 0 },
        restricted: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  linkedSources?: Array<{ sourceId: Types.ObjectId; allocated?: number; restricted?: boolean }>;

  @Prop({ default: true })
  active?: boolean;

  @Prop()
  notes?: string;
}

export const BudgetBucketSchema = SchemaFactory.createForClass(BudgetBucket);
