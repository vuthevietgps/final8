import { SourceAssessment } from "../../source-registry/source-registry.types";
import {
  GoogleAdsReadonlyWriteTelemetry,
  GoogleAdsReadonlyWriteTelemetrySummary,
} from "./google-ads-readonly-write-telemetry";

export type GoogleAdsReadonlySyncPolicy = "sync_required" | "sync_if_stale";

export type GoogleAdsReadonlySyncStatus =
  | "success"
  | "partial"
  | "failed"
  | "skipped_fresh_enough"
  | "skipped_locked"
  | "not_configured";

export type GoogleAdsReadonlyErrorCategory =
  | "policy_denied"
  | "invalid_scope"
  | "not_configured"
  | "auth_failed"
  | "permission_denied"
  | "rate_limited"
  | "provider_timeout"
  | "provider_transient"
  | "provider_query_invalid"
  | "provider_version_unsupported"
  | "local_persistence_failed"
  | "lock_unavailable"
  | "unexpected";

export interface GoogleAdsReadonlyInternalRequester {
  id: string;
  type: "internal_job" | "service";
  permissions: string[];
}

export interface GoogleAdsReadOnlySyncInput {
  exportJobId: string;
  correlationId: string;
  sourceKey: "google_ads";
  reportDate: string;
  dateFrom?: string;
  dateTo?: string;
  customerIds: string[];
  syncPolicy: GoogleAdsReadonlySyncPolicy;
  policyVersion: string;
  internalRequester: GoogleAdsReadonlyInternalRequester;
  absoluteDeadlineAt: string;
}

export interface GoogleAdsReadonlyCustomerScope {
  customerId: string;
  loginCustomerId?: string;
}

export interface NormalizedGoogleAdsReadOnlySyncInput extends Omit<
  GoogleAdsReadOnlySyncInput,
  "dateFrom" | "dateTo"
> {
  dateFrom: string;
  dateTo: string;
  customerIds: string[];
  customerScopes: GoogleAdsReadonlyCustomerScope[];
  effectiveDeadlineAt: string;
}

export interface GoogleAdsReadonlyError {
  category: GoogleAdsReadonlyErrorCategory;
  retryable: boolean;
  message: string;
  attempt?: number;
  customerId?: string;
  step?: string;
  providerRequestId?: string;
}

export interface GoogleAdsReadonlySyncPortResult {
  runId: string;
  status: "success" | "partial" | "failed";
  startedAt: Date;
  completedAt: Date;
  dateFrom: string;
  dateTo: string;
  customerIds: string[];
  counts: Record<string, number>;
  errors: Array<{ customerId?: string; step?: string; message: string }>;
  writeTelemetry?: readonly GoogleAdsReadonlyWriteTelemetry[];
}

export interface GoogleAdsReadonlySyncPort {
  sync(input: {
    customerIds: string[];
    dateFrom: string;
    dateTo: string;
    absoluteDeadlineAt: string;
  }): Promise<GoogleAdsReadonlySyncPortResult>;
}

export interface GoogleAdsReadonlyAssessmentPort {
  assess(input: {
    reportDate: string;
    sourceKeys: ["google_ads"];
    now?: Date;
  }): Promise<{ assessments: SourceAssessment[] }>;
}

export interface GoogleAdsReadonlyLockDescriptor {
  key: string;
  owner: string;
  ttlMs: number;
  scopeHash: string;
  exportJobId: string;
  dateFrom: string;
  dateTo: string;
}

export interface GoogleAdsReadonlyLockLease {
  acquired: boolean;
  ownerToken?: string;
  reusedSyncRunId?: string;
}

export interface GoogleAdsReadonlyDistributedLockPort {
  readonly runtime: "implemented_mongo";
  acquire(
    descriptor: GoogleAdsReadonlyLockDescriptor,
  ): Promise<GoogleAdsReadonlyLockLease>;
  release(input: {
    key: string;
    owner: string;
    ownerToken: string;
  }): Promise<void>;
}

export interface GoogleAdsReadonlyAuditInput {
  result: ProviderReadOnlySyncResult;
  preAssessmentRef?: string;
  postAssessmentRef?: string;
}

export interface GoogleAdsReadonlyAuditPort {
  persist(input: GoogleAdsReadonlyAuditInput): Promise<{ auditId: string }>;
}

export interface GoogleAdsReadonlyAdapterPolicyConfig {
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  totalDeadlineMs: number;
  maxRetriesAfterFirstAttempt: number;
  maxRangeDays: number;
  maxConcurrentCustomers: number;
  retryBaseDelayMs: number;
  lockTtlMs: number;
}

export interface ProviderReadOnlySyncResult {
  sourceKey: "google_ads";
  mode: "read_only";
  exportJobId: string;
  correlationId: string;
  policyVersion: string;
  status: GoogleAdsReadonlySyncStatus;
  providerSyncAttempted: boolean;
  mutationAttempted: false;
  syncRunId?: string;
  requestedCustomerIds: string[];
  selectedCustomerIds: string[];
  dateFrom: string;
  dateTo: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  attemptCount: number;
  retryClassifications: string[];
  counts: Record<string, number>;
  localWriteTargets: readonly string[];
  writeTelemetrySummary?: GoogleAdsReadonlyWriteTelemetrySummary;
  lock: {
    distributedLockRuntime: "implemented_mongo";
    key: string;
    owner: string;
    scopeHash: string;
    acquired: boolean;
    reusedSyncRunId?: string;
  };
  errors: GoogleAdsReadonlyError[];
  warnings: string[];
  postSyncAssessment?: SourceAssessment;
  canImportActionFile: false;
  canDryRun: false;
  canExecuteLive: false;
}
