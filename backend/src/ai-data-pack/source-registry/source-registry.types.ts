export type SourceDomain =
  | "ads"
  | "crm"
  | "orders"
  | "finance"
  | "operations"
  | "mapping"
  | "decision_history"
  | "external"
  | "system";

export type BusinessImportance =
  | "critical"
  | "important"
  | "optional"
  | "unsupported";

export type PackRelevance =
  | "director"
  | "marketer"
  | "data_quality"
  | "mapping"
  | "decision_history";

export type FreshnessMethod =
  | "sync_run"
  | "max_updated_at"
  | "latest_record_date"
  | "static_config"
  | "unsupported"
  | "not_configured";

export type CoverageMethod =
  | "report_date_count"
  | "date_range_count"
  | "not_applicable"
  | "unsupported";

export type FreshnessStatus =
  | "fresh"
  | "stale"
  | "missing"
  | "not_configured"
  | "unsupported"
  | "unknown";

export type CoverageStatus =
  | "covered"
  | "no_records_for_report_date"
  | "missing"
  | "not_applicable"
  | "unsupported"
  | "unknown";

export interface SourceEvidence {
  method: string;
  collectionOrModel?: string;
  field?: string;
  value?: string | number | null;
  note?: string;
}

export interface DbWatermarkField {
  field: string;
  kind: "last_successful_sync" | "record_updated" | "record_date";
  valueType: "date" | "date_string";
}

export interface DbWatermarkTarget {
  collectionName: string;
  filter?: Record<string, unknown>;
  fields: DbWatermarkField[];
}

export interface DbCoverageTarget {
  collectionName: string;
  filter?: Record<string, unknown>;
  mode: "report_date" | "date_range";
  field?: string;
  startField?: string;
  endField?: string;
  valueType: "date" | "date_string";
}

export interface SourceRegistryEntry {
  sourceKey: string;
  domain: SourceDomain;
  businessImportance: BusinessImportance;
  packRelevance: PackRelevance[];
  defaultMaxStalenessMinutes: number | null;
  freshnessMethod: FreshnessMethod;
  coverageMethod: CoverageMethod;
  readOnlyDbOnly: true;
  providerSyncAllowedInThisPr: false;
  mutationAllowed: false;
  notes?: string;
  availability: "supported" | "not_configured" | "unsupported";
  watermarkTargets?: DbWatermarkTarget[];
  coverageTargets?: DbCoverageTarget[];
}

export interface DbWatermarkResult {
  freshnessStatus: FreshnessStatus;
  lastSuccessfulSyncAt: string | null;
  latestRecordUpdatedAt: string | null;
  latestRecordDate: string | null;
  maxStalenessMinutes: number | null;
  freshnessMinutes: number | null;
  staleByMinutes: number | null;
  hasAnyRecords: boolean;
  evidence: SourceEvidence[];
  warnings: string[];
  blockingReasons: string[];
}

export interface CoverageResult {
  coverageStatus: CoverageStatus;
  reportDateRecordCount: number | null;
  expectedRecordCount: number | null;
  evidence: SourceEvidence[];
  warnings: string[];
  blockingReasons: string[];
}

export interface SourceAssessment {
  sourceKey: string;
  status: FreshnessStatus;
  freshnessStatus: FreshnessStatus;
  coverageStatus: CoverageStatus;
  lastSuccessfulSyncAt?: string | null;
  latestRecordUpdatedAt?: string | null;
  latestRecordDate?: string | null;
  reportDateRecordCount?: number | null;
  expectedRecordCount?: number | null;
  maxStalenessMinutes?: number | null;
  freshnessMinutes?: number | null;
  staleByMinutes?: number | null;
  evidence: SourceEvidence[];
  warnings: string[];
  blockingReasons: string[];
  canUseForDecision: "yes" | "cautious" | "no";
}

export interface FreshnessDecisionGate {
  canRecommendAdsScale: boolean;
  canConcludeProfitStrongly: boolean;
  canEvaluateSalesToday: boolean;
  canEvaluateFinanceStrongly: boolean;
  canUseLtvStrongly: boolean;
  canGenerateActionDraft: boolean;
  canImportActionFile: false;
  canDryRun: false;
  canExecuteLive: false;
}

export interface FreshnessGateResult {
  reportDate: string;
  evaluatedAt: string;
  dbOnly: true;
  providerSyncAttempted: false;
  mutationAttempted: false;
  assessments: SourceAssessment[];
  decisionGate: FreshnessDecisionGate;
}
