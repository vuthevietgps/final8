import type { ProviderReadOnlySourceKey } from "../provider-adapters/provider-readonly-adapter.types";
import type {
  SourceSyncDecisionEvidence,
} from "../source-sync/source-sync-result.types";
import type {
  BusinessImportance,
  CoverageStatus,
  FreshnessStatus,
  SourceDomain,
} from "../source-registry/source-registry.types";

export type AdsAutomationPlatformSourceSyncStatusSourceKey =
  | ProviderReadOnlySourceKey
  | "advertising_costs"
  | "product_mapping"
  | "inventory_profit"
  | "supplier_safety";

export type AdsAutomationPlatformSourceStatus =
  | "ready"
  | "stale"
  | "missing_config"
  | "missing_coverage"
  | "not_synced"
  | "not_configured"
  | "unsupported"
  | "unknown";

export interface AdsAutomationPlatformSourceSyncStatusInput {
  reportDate: string;
  now?: string | Date;
  sourceKeys?: AdsAutomationPlatformSourceSyncStatusSourceKey[];
}

export interface AdsAutomationPlatformSourceRequiredConfigStatus {
  key: string;
  required: boolean;
  present: boolean;
  acceptable: boolean;
  secret: boolean;
  value_exposed: false;
}

export interface AdsAutomationPlatformSourceSyncStatusSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  source_registry_reused: true;
  freshness_gate_reused: true;
  adapter_boundary_only: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  production_ready: false;
  execution_allowed_now: false;
  google_ads_production_enabled: false;
}

export interface AdsAutomationPlatformSourceSyncCoverageStatus {
  reportDate: string;
  coverageStatus: CoverageStatus;
  reportDateRecordCount: number | null;
  expectedRecordCount: number | null;
}

export interface AdsAutomationPlatformSourceSyncFreshnessStatus {
  freshnessStatus: FreshnessStatus;
  maxStalenessMinutes: number | null;
  freshnessMinutes: number | null;
  staleByMinutes: number | null;
  lastSuccessfulSyncAt: string | null;
  latestRecordUpdatedAt: string | null;
  latestRecordDate: string | null;
  latestSuccessfulSyncOrReadModelWatermark: string | null;
}

export interface AdsAutomationPlatformSourceSyncStatusItem {
  sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey;
  provider: "google_ads" | "erp_local";
  platform:
    | "google_ads"
    | "erp_advertising_costs"
    | "erp_product_mapping"
    | "erp_inventory_profit"
    | "erp_supplier_safety";
  domain: SourceDomain;
  businessImportance: BusinessImportance;
  status: AdsAutomationPlatformSourceStatus;
  requiredConfigPresence: AdsAutomationPlatformSourceRequiredConfigStatus[];
  missingCredentialOrConfigBlockers: string[];
  reportDateCoverage: AdsAutomationPlatformSourceSyncCoverageStatus;
  freshness: AdsAutomationPlatformSourceSyncFreshnessStatus;
  sourceSyncBlockers: string[];
  warnings: string[];
  canUseForAdsAutomationDecision: boolean;
  usableForAdsAutomationDecisions: boolean;
}

export interface AdsAutomationPlatformSourceSyncStatusSummary {
  status: "ready" | "blocked";
  source_count: number;
  ready_source_count: number;
  blocked_source_count: number;
  blocked_sources: AdsAutomationPlatformSourceSyncStatusSourceKey[];
  missing_config_sources: AdsAutomationPlatformSourceSyncStatusSourceKey[];
  stale_sources: AdsAutomationPlatformSourceSyncStatusSourceKey[];
  missing_coverage_sources: AdsAutomationPlatformSourceSyncStatusSourceKey[];
  not_synced_sources: AdsAutomationPlatformSourceSyncStatusSourceKey[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | "ready_for_ads_automation_decision_review"
    | "resolve_source_sync_blockers";
}

export interface AdsAutomationPlatformSourceSyncStatusDecisionGates {
  canUseGoogleAdsDataClaim: boolean;
  canGenerateActionDraft: boolean;
  canRecommendAdsScale: boolean;
  canImportActionFile: false;
  canDryRun: false;
  canExecuteLive: false;
}

export interface AdsAutomationPlatformSourceSyncStatusResponse {
  schemaVersion: "ads_automation_platform_source_sync_status.v1";
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationPlatformSourceSyncStatusSafety;
  summary: AdsAutomationPlatformSourceSyncStatusSummary;
  decisionGates: AdsAutomationPlatformSourceSyncStatusDecisionGates;
  decisionEvidence: SourceSyncDecisionEvidence[];
  sources: AdsAutomationPlatformSourceSyncStatusItem[];
}
