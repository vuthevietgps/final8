export const CACHED_EXPORT_MODE = "cached_export" as const;
export const OFFICIAL_EXPORT_MODE = "official_export" as const;
export const PARTIAL_EXPORT_MODE = "partial_export" as const;
export const CACHED_EXPORT_SYNC_POLICY = "export_cached" as const;
export const OFFICIAL_EXPORT_SYNC_POLICY = "sync_required" as const;
export const PARTIAL_EXPORT_SYNC_POLICY = "sync_if_stale" as const;
export const CACHED_EXPORT_POLICY_VERSION = "cached-export-v1" as const;
export const OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION =
  "official-partial-export-lifecycle-v1" as const;

export const AI_DATA_PACK_EXPORT_MODES = [
  CACHED_EXPORT_MODE,
  OFFICIAL_EXPORT_MODE,
  PARTIAL_EXPORT_MODE,
] as const;

export const AI_DATA_PACK_EXPORT_SYNC_POLICIES = [
  CACHED_EXPORT_SYNC_POLICY,
  OFFICIAL_EXPORT_SYNC_POLICY,
  PARTIAL_EXPORT_SYNC_POLICY,
] as const;

export const CACHED_EXPORT_PACK_TYPES = [
  "director_data_pack",
  "marketer_data_pack",
  "data_quality_report",
  "mapping_report",
] as const;

export const AI_DATA_PACK_EXPORT_FORMATS = ["json", "xlsx"] as const;
export const AI_DATA_PACK_EXPORT_JOB_STATUSES = [
  "pending",
  "requested",
  "pre_assessing",
  "syncing_sources",
  "post_assessing",
  "snapshotting",
  "exporting",
  "completed",
  "completed_with_warnings",
  "blocked",
  "failed",
  "expired",
] as const;
export const ACTIVE_EXPORT_JOB_STATUSES = [
  "pending",
  "requested",
  "pre_assessing",
  "syncing_sources",
  "post_assessing",
  "snapshotting",
  "exporting",
] as const;

export const AI_DATA_PACK_REDACTION_PROFILES = [
  "director_full",
  "director_redacted",
  "manager_marketer",
  "finance_operator",
  "reviewer_partial",
  "investor_redacted",
  "external_consultant_redacted",
  "system_internal_worker",
] as const;

export const AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION =
  "ai-data-pack.export.official.create" as const;
export const AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION =
  "ai-data-pack.export.partial.create" as const;
export const AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION =
  "ai-data-pack.export.cached.create" as const;
export const AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION =
  "ai-data-pack.export.status.read" as const;
export const AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION =
  "ai-data-pack.export.sync-detail.read" as const;
export const AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION =
  "ai-data-pack.export.audit.read" as const;
export const AI_DATA_PACK_EXPORT_DOWNLOAD_PERMISSION =
  "ai-data-pack.export.download" as const;
export const AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION =
  "ai-data-pack.export.artifact.download" as const;
export const AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_CACHED_PERMISSION =
  "ai-data-pack.export.artifact.download.cached" as const;
export const AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_OFFICIAL_PERMISSION =
  "ai-data-pack.export.artifact.download.official" as const;
export const AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PARTIAL_PERMISSION =
  "ai-data-pack.export.artifact.download.partial" as const;
export const AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_AUDIT_READ_PERMISSION =
  "ai-data-pack.export.artifact.download.audit.read" as const;

export type CachedExportPackType = (typeof CACHED_EXPORT_PACK_TYPES)[number];
export type AiDataPackExportFormat =
  (typeof AI_DATA_PACK_EXPORT_FORMATS)[number];
export type AiDataPackExportJobStatus =
  (typeof AI_DATA_PACK_EXPORT_JOB_STATUSES)[number];
export type AiDataPackExportMode = (typeof AI_DATA_PACK_EXPORT_MODES)[number];
export type AiDataPackExportSyncPolicy =
  (typeof AI_DATA_PACK_EXPORT_SYNC_POLICIES)[number];
export type OfficialPartialExportMode =
  | typeof OFFICIAL_EXPORT_MODE
  | typeof PARTIAL_EXPORT_MODE;
export type AiDataPackRedactionProfile =
  (typeof AI_DATA_PACK_REDACTION_PROFILES)[number];
export type AiDataPackRedactionRuntime =
  | "manifest_only"
  | "implemented"
  | "pre_rendered";
export type AiDataPackArtifactRendering = "deferred" | "rendered" | "failed";
export type AiDataPackArtifactClass =
  | "raw_internal_artifact"
  | "manifest_only_artifact"
  | "downloadable_redacted_artifact";

export interface CreateCachedExportJobRequest {
  reportDate: string;
  packTypes: CachedExportPackType[];
  formats: AiDataPackExportFormat[];
  requestedBy: unknown;
  policyVersion?: string;
  idempotencyKey?: string;
  redactionProfile?: AiDataPackRedactionProfile;
  sectionAccessProfile?: string;
}

export interface ExportJobArtifactRecord {
  artifactId: string;
  packType: CachedExportPackType;
  format: AiDataPackExportFormat;
  fileName: string;
  storageKey: string;
  artifactChecksum: string;
  dataContentChecksum?: string;
  fileSizeBytes: number;
  createdAt: Date;
  cachedExport: boolean;
  exportMode?: AiDataPackExportMode;
  redactionProfile?: AiDataPackRedactionProfile;
  sectionAccessProfile?: string;
  artifactClass?: AiDataPackArtifactClass;
  redactionRuntime?: AiDataPackRedactionRuntime;
  artifactRendering?: AiDataPackArtifactRendering;
  downloadReady?: boolean;
  checksumAlgorithm?: "sha256";
}

export interface CachedExportMetadata {
  export_job_id: string;
  export_mode: typeof CACHED_EXPORT_MODE;
  cached_export: true;
  sync_policy: typeof CACHED_EXPORT_SYNC_POLICY;
  provider_sync_attempted: false;
  freshness_gate_evaluated: false;
  live_execution: false;
}

export interface AiDataPackExportRequester {
  id?: unknown;
  _id?: unknown;
  sub?: unknown;
  role?: unknown;
  fullName?: unknown;
  name?: unknown;
  display?: unknown;
  permissions?: unknown;
  redactionProfile?: unknown;
  sectionAccessProfile?: unknown;
}

export interface CreateOfficialPartialExportInternalRequest {
  mode: OfficialPartialExportMode;
  reportDate: string;
  dateFrom?: string;
  dateTo?: string;
  packTypes: CachedExportPackType[];
  formats: AiDataPackExportFormat[];
  requester?: AiDataPackExportRequester | string;
  requestedBy?: unknown;
  redactionProfile?: AiDataPackRedactionProfile;
  sectionAccessProfile?: string;
  policyVersion?: string;
  idempotencyKey?: string;
  sourceScope?: {
    sourceKeys?: string[];
    googleAdsCustomerIds?: string[];
  };
  googleAdsCustomerIds?: string[];
  allowDowngradeToPartial?: boolean;
}

export interface AiDataPackExportAuditEvent {
  event: string;
  at: Date;
  status?: AiDataPackExportJobStatus;
  actorId?: string | null;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface InternalExportArtifactManifest {
  artifactId: string;
  exportJobId: string;
  exportMode: OfficialPartialExportMode;
  syncPolicy: AiDataPackExportSyncPolicy;
  policyVersion: string;
  redactionProfile: AiDataPackRedactionProfile;
  sectionAccessProfile: string;
  packTypes: CachedExportPackType[];
  formats: AiDataPackExportFormat[];
  rowCounts: Record<string, number>;
  sourceFreshnessMetadata: Record<string, unknown>;
  sourceCoverageMetadata: Record<string, unknown>;
  decisionGates: Record<string, unknown>;
  warnings: string[];
  blockingReasons: string[];
  containsPii: boolean;
  containsFinancialSensitive: boolean;
  containsEmployeeSensitive: boolean;
  containsSupplierSensitive: boolean;
  dataContentChecksum: string;
  runtimeExportChecksum: string;
  artifactChecksum: string;
  createdAt: string;
  expiresAt: string;
  retentionUntil: string;
  storageLocation: string;
  downloadPolicy: string;
  redactionRuntime: AiDataPackRedactionRuntime;
  artifactRendering: AiDataPackArtifactRendering;
  artifactClass?: AiDataPackArtifactClass;
  downloadReady?: boolean;
  checksumAlgorithm?: "sha256";
  fileSizeBytes?: number;
  contentType?: string;
  downloadableArtifactIds?: string[];
  renderedArtifactCount?: number;
  unsupportedFormats?: AiDataPackExportFormat[];
}
