import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import {
  AI_DATA_PACK_EXPORT_FORMATS,
  AI_DATA_PACK_EXPORT_JOB_STATUSES,
  AI_DATA_PACK_EXPORT_MODES,
  AI_DATA_PACK_EXPORT_SYNC_POLICIES,
  AI_DATA_PACK_REDACTION_PROFILES,
  AiDataPackExportFormat,
  AiDataPackExportMode,
  AiDataPackExportJobStatus,
  CACHED_EXPORT_PACK_TYPES,
  AiDataPackExportSyncPolicy,
  AiDataPackArtifactClass,
  AiDataPackArtifactRendering,
  AiDataPackRedactionProfile,
  AiDataPackRedactionRuntime,
  CachedExportPackType,
  InternalExportArtifactManifest,
} from "./export-job.types";

export type AiDataPackExportJobDocument = HydratedDocument<AiDataPackExportJob>;

@Schema({ _id: false, timestamps: false })
export class AiDataPackExportArtifact {
  @Prop({ required: true, trim: true })
  artifactId!: string;

  @Prop({ required: true, enum: CACHED_EXPORT_PACK_TYPES })
  packType!: CachedExportPackType;

  @Prop({ required: true, enum: AI_DATA_PACK_EXPORT_FORMATS })
  format!: AiDataPackExportFormat;

  @Prop({ required: true, trim: true })
  fileName!: string;

  @Prop({ required: true, trim: true })
  storageKey!: string;

  @Prop({ required: true, trim: true })
  artifactChecksum!: string;

  @Prop({ trim: true })
  dataContentChecksum?: string;

  @Prop({ required: true, min: 0 })
  fileSizeBytes!: number;

  @Prop({ required: true, type: Date })
  createdAt!: Date;

  @Prop({ required: true, type: Boolean, default: true })
  cachedExport!: boolean;

  @Prop({ trim: true, enum: AI_DATA_PACK_EXPORT_MODES })
  exportMode?: AiDataPackExportMode;

  @Prop({ trim: true, enum: AI_DATA_PACK_REDACTION_PROFILES })
  redactionProfile?: AiDataPackRedactionProfile;

  @Prop({ trim: true })
  sectionAccessProfile?: string;

  @Prop({ trim: true })
  artifactClass?: AiDataPackArtifactClass;

  @Prop({ trim: true })
  redactionRuntime?: AiDataPackRedactionRuntime;

  @Prop({ trim: true })
  artifactRendering?: AiDataPackArtifactRendering;

  @Prop({ type: Boolean })
  downloadReady?: boolean;

  @Prop({ trim: true })
  checksumAlgorithm?: "sha256";
}

export const AiDataPackExportArtifactSchema = SchemaFactory.createForClass(
  AiDataPackExportArtifact,
);

@Schema({ collection: "ai_data_pack_export_jobs", timestamps: true })
export class AiDataPackExportJob {
  @Prop({ required: true, trim: true, unique: true, index: true })
  jobId!: string;

  @Prop({
    required: true,
    type: String,
    enum: AI_DATA_PACK_EXPORT_MODES,
  })
  exportMode!: AiDataPackExportMode;

  @Prop({
    required: true,
    type: String,
    enum: AI_DATA_PACK_EXPORT_SYNC_POLICIES,
  })
  syncPolicy!: AiDataPackExportSyncPolicy;

  @Prop({ required: true, type: Boolean, default: true })
  cachedExport!: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  providerSyncAttempted!: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  freshnessGateEvaluated!: boolean;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  liveExecution!: false;

  @Prop({ required: true, enum: AI_DATA_PACK_EXPORT_JOB_STATUSES, index: true })
  status!: AiDataPackExportJobStatus;

  @Prop({ required: true, trim: true, index: true })
  reportDate!: string;

  @Prop({ required: true, type: [String], enum: CACHED_EXPORT_PACK_TYPES })
  packTypes!: CachedExportPackType[];

  @Prop({ required: true, type: [String], enum: AI_DATA_PACK_EXPORT_FORMATS })
  formats!: AiDataPackExportFormat[];

  @Prop({ required: true, trim: true, index: true })
  requestedByUserId!: string;

  @Prop({ trim: true })
  requestedByRole?: string;

  @Prop({ trim: true })
  requestedByDisplay?: string;

  @Prop({ required: true, type: Date })
  requestedAt!: Date;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  failedAt?: Date;

  @Prop({ required: true, trim: true })
  policyVersion!: string;

  @Prop({ required: true, trim: true, index: true })
  idempotencyKey!: string;

  @Prop({ trim: true })
  activeIdempotencyKey?: string;

  @Prop({ type: [AiDataPackExportArtifactSchema], default: [] })
  artifacts!: AiDataPackExportArtifact[];

  @Prop({ trim: true, enum: AI_DATA_PACK_REDACTION_PROFILES })
  redactionProfile?: AiDataPackRedactionProfile;

  @Prop({ trim: true })
  sectionAccessProfile?: string;

  @Prop({ type: Object })
  sourceSyncPreparation?: Record<string, unknown>;

  @Prop({ type: Object })
  manifest?: InternalExportArtifactManifest;

  @Prop({ type: [String], default: [] })
  warnings?: string[];

  @Prop({ type: [String], default: [] })
  blockingReasons?: string[];

  @Prop({ type: Object })
  decisionGates?: Record<string, unknown>;

  @Prop({ trim: true })
  redactionRuntime?: string;

  @Prop({ trim: true })
  artifactRendering?: string;

  @Prop({ trim: true })
  downgradedFromExportMode?: string;

  @Prop({ type: [Object], default: [] })
  auditEvents?: Record<string, unknown>[];

  @Prop({ trim: true })
  errorCategory?: string;

  @Prop({ trim: true })
  sanitizedErrorMessage?: string;
}

export const AiDataPackExportJobSchema =
  SchemaFactory.createForClass(AiDataPackExportJob);

AiDataPackExportJobSchema.index(
  { activeIdempotencyKey: 1 },
  {
    unique: true,
    name: "idx_ai_data_pack_export_job_active_idempotency",
    partialFilterExpression: { activeIdempotencyKey: { $type: "string" } },
  },
);
AiDataPackExportJobSchema.index(
  { requestedByUserId: 1, requestedAt: -1 },
  { name: "idx_ai_data_pack_export_job_requester_requested_at" },
);
