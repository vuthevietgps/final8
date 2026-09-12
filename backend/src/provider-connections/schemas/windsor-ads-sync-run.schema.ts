import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WindsorAdsSyncRunDocument = HydratedDocument<WindsorAdsSyncRun>;

@Schema({ collection: 'windsor_ads_sync_runs', timestamps: true })
export class WindsorAdsSyncRun {
  @Prop({ required: true, unique: true, index: true, trim: true }) runId: string;
  @Prop({ type: Types.ObjectId, ref: 'ProviderConnection', required: true, index: true })
  connectionId: Types.ObjectId;
  @Prop({ required: true, enum: ['google_ads'] }) connector: 'google_ads';
  @Prop({ required: true, enum: ['running', 'success', 'partial', 'failed'], index: true })
  status: 'running' | 'success' | 'partial' | 'failed';
  @Prop({ type: Date, required: true, index: true }) startedAt: Date;
  @Prop({ type: Date }) completedAt?: Date;
  @Prop({ required: true, trim: true }) dateFrom: string;
  @Prop({ required: true, trim: true }) dateTo: string;
  @Prop({ type: [String], default: [] }) accountIds: string[];
  @Prop({ type: Number, required: true, default: 1 }) fieldContractVersion: number;
  @Prop({ required: true, default: true }) includeInactive: boolean;
  @Prop({ type: Object, default: {} }) counts: Record<string, number>;
  @Prop({ type: [Object], default: [] })
  syncErrors: Array<{ accountId?: string; date?: string; code: string }>;
}

export const WindsorAdsSyncRunSchema = SchemaFactory.createForClass(WindsorAdsSyncRun);
WindsorAdsSyncRunSchema.index(
  { connectionId: 1, startedAt: -1 },
  { name: 'idx_windsor_ads_sync_run_connection_started' },
);
