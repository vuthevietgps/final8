import type {
  FreshnessDecisionGate,
  FreshnessGateResult,
  SourceAssessment,
} from "../source-registry/source-registry.types";
import type { GoogleAdsReadonlyInternalRequester } from "../provider-adapters/google-ads-readonly/google-ads-readonly-adapter.types";

export type AiDataPackSourceSyncPolicy =
  | "export_cached"
  | "sync_if_stale"
  | "sync_required";

export type SourceSyncAdapterDecision =
  | "db_only"
  | "unsupported_source"
  | "skipped_export_cached"
  | "skipped_fresh_covered"
  | "called_adapter"
  | "adapter_unavailable"
  | "adapter_scope_denied"
  | "adapter_failed";

export type SourceSyncImpactStatus =
  | "fresh_covered"
  | "no_records_for_report_date"
  | "not_synced"
  | "not_configured"
  | "unsupported"
  | "stale"
  | "sync_failed";

export interface SourceSyncPreparationInput {
  exportJobId: string;
  correlationId?: string;
  policyVersion?: string;
  reportDate: string;
  dateFrom?: string;
  dateTo?: string;
  packTypes?: string[];
  sourceKeys?: string[];
  syncPolicy: AiDataPackSourceSyncPolicy;
  customerIds?: string[];
  internalRequester?: GoogleAdsReadonlyInternalRequester;
  absoluteDeadlineAt?: string;
  now?: Date;
}

export interface SourceSyncAdapterResultSummary {
  status: string;
  providerSyncAttempted: boolean;
  mutationAttempted: false;
  syncRunId?: string;
  attemptCount?: number;
  localWriteTargets: readonly string[];
  writeTelemetrySummary?: {
    operationCount: number;
    recordCount: number;
    targets: readonly string[];
    operations: Record<string, number>;
  };
  requestedCustomerCount?: number;
  selectedCustomerCount?: number;
  errorCategories: string[];
  warningCount: number;
  canImportActionFile: false;
  canDryRun: false;
  canExecuteLive: false;
}

export interface SourceSyncImpact {
  sourceKey: string;
  reportDate?: string;
  status: SourceSyncImpactStatus;
  canUseForDecision: SourceAssessment["canUseForDecision"];
  canUseForAdsAutomationDecision?: boolean;
  freshnessStatus?: SourceAssessment["freshnessStatus"];
  coverageStatus?: SourceAssessment["coverageStatus"];
  reportDateRecordCount?: number | null;
  lastSuccessfulSyncAt?: string | null;
  latestRecordUpdatedAt?: string | null;
  latestRecordDate?: string | null;
  blockingReason?: string | null;
  blockingReasons?: string[];
}

export interface SourceSyncDecisionEvidence {
  sourceKey: string;
  reportDate: string;
  freshnessStatus?: SourceAssessment["freshnessStatus"];
  coverageStatus?: SourceAssessment["coverageStatus"];
  lastSuccessfulSyncAt?: string | null;
  latestRecordDate?: string | null;
  blockingReason: string | null;
  blockingReasons: string[];
  canUseForAdsAutomationDecision: boolean;
}

export interface SourceSyncSourceResult {
  sourceKey: string;
  preAssessment?: SourceAssessment;
  adapterDecision: SourceSyncAdapterDecision;
  adapterResultSummary?: SourceSyncAdapterResultSummary;
  postAssessment?: SourceAssessment;
  sourceImpact: SourceSyncImpact;
  decisionEvidence: SourceSyncDecisionEvidence;
  warnings: string[];
  blockingReasons: string[];
}

export interface SourceSyncDecisionGates extends FreshnessDecisionGate {
  canUseGoogleAdsDataClaim: boolean;
}

export interface SourceSyncPreparationResult {
  exportJobId: string;
  correlationId: string;
  policyVersion: string;
  reportDate: string;
  dateFrom: string;
  dateTo: string;
  packTypes: string[];
  syncPolicy: AiDataPackSourceSyncPolicy;
  preAssessment: FreshnessGateResult;
  postAssessment: FreshnessGateResult;
  sourceDecisions: SourceSyncSourceResult[];
  sourceImpact: Record<string, SourceSyncImpact>;
  decisionEvidence: SourceSyncDecisionEvidence[];
  warnings: string[];
  blockingReasons: string[];
  decisionGates: SourceSyncDecisionGates;
  providerSyncAttempted: boolean;
  mutationAttempted: false;
  canImportActionFile: false;
  canDryRun: false;
  canExecuteLive: false;
}
