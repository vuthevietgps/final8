import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AdsAutomationEvidenceSnapshotRecordDocument = AdsAutomationEvidenceSnapshotRecord & Document;

@Schema({
  collection: 'ads_automation_evidence_snapshots',
  versionKey: false,
})
export class AdsAutomationEvidenceSnapshotRecord {
  @Prop({ required: true, trim: true, immutable: true, index: true })
  dateKey: string;

  @Prop({ required: true, enum: ['local', 'demo', 'staging', 'production'], immutable: true, index: true })
  environment: 'local' | 'demo' | 'staging' | 'production';

  @Prop({ required: true, trim: true, immutable: true, index: true })
  schemaVersion: string;

  @Prop({ required: true, type: MongooseSchema.Types.Mixed, immutable: true })
  payload: Record<string, unknown>;

  @Prop({ required: true, trim: true, immutable: true })
  hash: string;

  @Prop({ required: true, type: Date, immutable: true, index: true })
  capturedAt: Date;
}

export const AdsAutomationEvidenceSnapshotRecordSchema = SchemaFactory.createForClass(
  AdsAutomationEvidenceSnapshotRecord,
);

AdsAutomationEvidenceSnapshotRecordSchema.index(
  { dateKey: 1, environment: 1, schemaVersion: 1 },
  { unique: true, name: 'uq_ads_evidence_daily_environment_schema' },
);
AdsAutomationEvidenceSnapshotRecordSchema.index(
  { environment: 1, capturedAt: -1 },
  { name: 'idx_ads_evidence_environment_captured_at' },
);

const rejectMutation = function (this: any, next: (error?: Error) => void) {
  next(new Error('AdsAutomationEvidenceSnapshot records are immutable'));
};

for (const hook of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  AdsAutomationEvidenceSnapshotRecordSchema.pre(hook as any, rejectMutation);
}
