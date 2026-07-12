import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsSyncRunDocument = HydratedDocument<GoogleAdsSyncRun>;

@Schema({ collection: 'google_ads_sync_runs', timestamps: true })
export class GoogleAdsSyncRun {
  @Prop({ required: true, trim: true, unique: true, index: true })
  runId: string;

  @Prop({ required: true, enum: ['running', 'success', 'partial', 'failed'], index: true })
  status: 'running' | 'success' | 'partial' | 'failed';

  @Prop({ type: Date, required: true, index: true })
  startedAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ trim: true })
  dateFrom?: string;

  @Prop({ trim: true })
  dateTo?: string;

  @Prop({ type: [String], default: [] })
  customerIds: string[];

  @Prop({ type: Object, default: {} })
  counts: Record<string, number>;

  @Prop({ type: [Object], default: [] })
  syncErrors: Array<{ customerId?: string; step?: string; message: string }>;
}

export const GoogleAdsSyncRunSchema = SchemaFactory.createForClass(GoogleAdsSyncRun);

GoogleAdsSyncRunSchema.index({ startedAt: -1 }, { name: 'idx_google_ads_sync_run_started_at' });
GoogleAdsSyncRunSchema.index(
  { customerIds: 1, startedAt: -1 },
  { name: 'idx_google_ads_sync_run_customer_started_at' },
);
