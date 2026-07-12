import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AiDataPackSourceSyncAuditDocument =
  HydratedDocument<AiDataPackSourceSyncAudit>;

@Schema({
  collection: "ai_data_pack_source_sync_audits",
  timestamps: true,
})
export class AiDataPackSourceSyncAudit {
  @Prop({ required: true, trim: true })
  auditId: string;

  @Prop({ required: true, trim: true, index: true })
  exportJobId: string;

  @Prop({ required: true, trim: true, index: true })
  correlationId: string;

  @Prop({ required: true, enum: ["google_ads"], index: true })
  sourceKey: "google_ads";

  @Prop({ required: true, trim: true })
  policyVersion: string;

  @Prop({ required: true, trim: true, index: true })
  scopeHash: string;

  @Prop({ type: [String], default: [] })
  customerIds: string[];

  @Prop({ required: true, trim: true })
  dateFrom: string;

  @Prop({ required: true, trim: true })
  dateTo: string;

  @Prop({ required: true, trim: true })
  lockKey: string;

  @Prop({ required: true, trim: true })
  lockOwner: string;

  @Prop({ required: true })
  lockAcquired: boolean;

  @Prop({ required: true, min: 0 })
  attempts: number;

  @Prop({ type: [String], default: [] })
  retryClassifications: string[];

  @Prop({ type: Object })
  writeTelemetrySummary?: {
    operationCount: number;
    recordCount: number;
    targets: string[];
    operations: Record<string, number>;
  };

  @Prop({ required: true })
  providerSyncAttempted: boolean;

  @Prop({ required: true, default: false })
  mutationAttempted: false;

  @Prop({ required: true, trim: true, index: true })
  status: string;

  @Prop({ type: [Object], default: [] })
  perAccountStatus: Array<{ customerId: string; status: string }>;

  @Prop({ trim: true })
  preAssessmentRef?: string;

  @Prop({ trim: true })
  postAssessmentRef?: string;

  @Prop({ type: [Object], default: [] })
  sanitizedErrors: Array<{
    category: string;
    message: string;
    retryable: boolean;
    customerId?: string;
    step?: string;
  }>;

  @Prop({ required: true, type: Date })
  startedAt: Date;

  @Prop({ required: true, type: Date, index: true })
  completedAt: Date;

  @Prop({ required: true, default: false })
  canImportActionFile: false;

  @Prop({ required: true, default: false })
  canDryRun: false;

  @Prop({ required: true, default: false })
  canExecuteLive: false;
}

export const AiDataPackSourceSyncAuditSchema = SchemaFactory.createForClass(
  AiDataPackSourceSyncAudit,
);

AiDataPackSourceSyncAuditSchema.index(
  { auditId: 1 },
  { unique: true, name: "uq_ai_data_pack_source_sync_audit_id" },
);
AiDataPackSourceSyncAuditSchema.index(
  { exportJobId: 1, completedAt: -1 },
  { name: "idx_ai_data_pack_source_sync_audit_job_completed" },
);
AiDataPackSourceSyncAuditSchema.index(
  { sourceKey: 1, scopeHash: 1, completedAt: -1 },
  { name: "idx_ai_data_pack_source_sync_audit_scope_completed" },
);
