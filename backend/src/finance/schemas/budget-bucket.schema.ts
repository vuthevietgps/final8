import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { FundingSource } from './funding-source.schema';

export type BudgetBucketDocument = BudgetBucket & Document;

@Schema({ timestamps: true })
export class BudgetBucket {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 40, uppercase: true })
  code?: string;

  // Product.categoryId values. Empty means this is a global bucket.
  @Prop({ type: [String], default: [] })
  productGroupIds?: string[];

  // Zero means no cap for that period; positive caps use the strictest
  // applicable global/category bucket in ads decision evidence.
  @Prop({ type: Number, default: 0, min: 0 })
  dailyCap?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  weeklyCap?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  monthlyCap?: number;

  @Prop({
    type: [
      {
        sourceId: { type: Types.ObjectId, ref: FundingSource.name },
        allocated: { type: Number, default: 0, min: 0 },
        restricted: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  linkedSources?: Array<{ sourceId: Types.ObjectId; allocated?: number; restricted?: boolean }>;

  @Prop({ default: true })
  active?: boolean;

  @Prop({ trim: true, maxlength: 300 })
  notes?: string;
}

export const BudgetBucketSchema = SchemaFactory.createForClass(BudgetBucket);
BudgetBucketSchema.index({ active: 1, productGroupIds: 1 });
