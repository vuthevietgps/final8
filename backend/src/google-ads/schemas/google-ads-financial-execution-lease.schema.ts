import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsFinancialExecutionLeaseDocument = HydratedDocument<GoogleAdsFinancialExecutionLease>;

@Schema({ collection: 'google_ads_financial_execution_leases', timestamps: true })
export class GoogleAdsFinancialExecutionLease {
  @Prop({ required: true, trim: true, unique: true, index: true })
  scope: string;

  @Prop({ required: true, enum: ['held', 'released'], index: true })
  status: 'held' | 'released';

  @Prop({ trim: true, index: true })
  ownerToken?: string;

  @Prop({ type: Date, index: true })
  acquiredAt?: Date;

  @Prop({ type: Date, index: true })
  leaseExpiresAt?: Date;

  @Prop({ type: Date })
  releasedAt?: Date;
}

export const GoogleAdsFinancialExecutionLeaseSchema = SchemaFactory.createForClass(
  GoogleAdsFinancialExecutionLease,
);

GoogleAdsFinancialExecutionLeaseSchema.index(
  { scope: 1, status: 1, leaseExpiresAt: 1 },
  { name: 'idx_google_ads_financial_execution_lease' },
);
