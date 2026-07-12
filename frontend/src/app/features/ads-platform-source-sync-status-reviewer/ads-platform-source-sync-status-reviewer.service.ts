import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdsApprovalSourceSyncHandoffPrefillBundle,
  parseAdsApprovalSourceSyncHandoffPrefillBundleJson,
} from './ads-approval-source-sync-handoff-prefill.util';

export type AdsPlatformSourceSyncStatusSourceKey =
  | 'google_ads'
  | 'advertising_costs'
  | 'product_mapping';

export type AdsPlatformSourceStatus =
  | 'ready'
  | 'stale'
  | 'missing_config'
  | 'missing_coverage'
  | 'not_synced'
  | 'not_configured'
  | 'unsupported'
  | 'unknown';

export interface AdsPlatformSourceSyncStatusQuery {
  reportDate?: string;
  now?: string;
  sourceKeys?: AdsPlatformSourceSyncStatusSourceKey[];
}

export interface AdsPlatformSourceRequiredConfigStatus {
  key: string;
  required: boolean;
  present: boolean;
  acceptable: boolean;
  secret: boolean;
  value_exposed: false;
}

export interface AdsPlatformSourceSyncStatusSafety {
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

export interface AdsPlatformSourceSyncCoverageStatus {
  reportDate: string;
  coverageStatus: string;
  reportDateRecordCount: number | null;
  expectedRecordCount: number | null;
}

export interface AdsPlatformSourceSyncFreshnessStatus {
  freshnessStatus: string;
  maxStalenessMinutes: number | null;
  freshnessMinutes: number | null;
  staleByMinutes: number | null;
  lastSuccessfulSyncAt: string | null;
  latestRecordUpdatedAt: string | null;
  latestRecordDate: string | null;
  latestSuccessfulSyncOrReadModelWatermark: string | null;
}

export interface AdsPlatformSourceSyncStatusItem {
  sourceKey: AdsPlatformSourceSyncStatusSourceKey;
  provider: 'google_ads' | 'erp_local';
  platform: 'google_ads' | 'erp_advertising_costs' | 'erp_product_mapping';
  domain: string;
  businessImportance: string;
  status: AdsPlatformSourceStatus;
  requiredConfigPresence: AdsPlatformSourceRequiredConfigStatus[];
  missingCredentialOrConfigBlockers: string[];
  reportDateCoverage: AdsPlatformSourceSyncCoverageStatus;
  freshness: AdsPlatformSourceSyncFreshnessStatus;
  sourceSyncBlockers: string[];
  warnings: string[];
  canUseForAdsAutomationDecision: boolean;
  usableForAdsAutomationDecisions: boolean;
}

export interface AdsPlatformSourceSyncStatusSummary {
  status: 'ready' | 'blocked';
  source_count: number;
  ready_source_count: number;
  blocked_source_count: number;
  blocked_sources: AdsPlatformSourceSyncStatusSourceKey[];
  missing_config_sources: AdsPlatformSourceSyncStatusSourceKey[];
  stale_sources: AdsPlatformSourceSyncStatusSourceKey[];
  missing_coverage_sources: AdsPlatformSourceSyncStatusSourceKey[];
  not_synced_sources: AdsPlatformSourceSyncStatusSourceKey[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | 'ready_for_ads_automation_decision_review'
    | 'resolve_source_sync_blockers';
}

export interface AdsPlatformSourceSyncStatusDecisionGates {
  canUseGoogleAdsDataClaim: boolean;
  canGenerateActionDraft: boolean;
  canRecommendAdsScale: boolean;
  canImportActionFile: false;
  canDryRun: false;
  canExecuteLive: false;
}

export interface AdsPlatformSourceSyncStatusResponse {
  schemaVersion: 'ads_automation_platform_source_sync_status.v1';
  generatedAt: string;
  reportDate: string;
  safety: AdsPlatformSourceSyncStatusSafety;
  summary: AdsPlatformSourceSyncStatusSummary;
  decisionGates: AdsPlatformSourceSyncStatusDecisionGates;
  sources: AdsPlatformSourceSyncStatusItem[];
}

export type AdsPlatformSourceSyncStatusSnapshotSafety = Pick<
  AdsPlatformSourceSyncStatusSafety,
  | 'provider_api_called'
  | 'google_ads_api_called'
  | 'validateOnly_called'
  | 'live_ads_execution_used'
  | 'execution_allowed_now'
  | 'production_ready'
  | 'erp_mutation_used'
  | 'payment_mutation_used'
  | 'order_mutation_used'
  | 'inventory_mutation_used'
  | 'google_ads_production_enabled'
>;

export interface AdsPlatformSourceSyncStatusSourceDigest {
  sourceKey: AdsPlatformSourceSyncStatusSourceKey;
  provider: AdsPlatformSourceSyncStatusItem['provider'];
  platform: AdsPlatformSourceSyncStatusItem['platform'];
  status: AdsPlatformSourceStatus;
  requiredConfigPresence: AdsPlatformSourceRequiredConfigStatus[];
  missingCredentialOrConfigBlockers: string[];
  reportDateCoverage: AdsPlatformSourceSyncCoverageStatus;
  freshness: AdsPlatformSourceSyncFreshnessStatus;
  sourceSyncBlockers: string[];
  warnings: string[];
  canUseForAdsAutomationDecision: boolean;
  usableForAdsAutomationDecisions: boolean;
}

export interface AdsPlatformSourceSyncStatusLocalSnapshot {
  schemaVersion: 'ads_platform_source_sync_status_local_snapshot.v1';
  snapshotMode: 'local_browser_download';
  createdFromEndpoint: string;
  createdFromGeneratedAt: string;
  comparisonKey: string;
  statusSchemaVersion: AdsPlatformSourceSyncStatusResponse['schemaVersion'];
  reportDate: string;
  safety: AdsPlatformSourceSyncStatusSnapshotSafety;
  summary: AdsPlatformSourceSyncStatusSummary;
  decisionGates: AdsPlatformSourceSyncStatusDecisionGates;
  sourceDigests: AdsPlatformSourceSyncStatusSourceDigest[];
  omittedPayloads: ['plaintextSecretValues', 'providerRawPayload', 'liveExecutionPayload'];
  secret_values_omitted: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsPlatformSourceSyncStatusLocalSnapshotParseResult {
  snapshot: AdsPlatformSourceSyncStatusLocalSnapshot | null;
  error: string | null;
}

export type AdsPlatformSourceSyncStatusSnapshotMetricKey =
  | 'source_count'
  | 'ready_source_count'
  | 'blocked_source_count';

export interface AdsPlatformSourceSyncStatusSnapshotMetricDelta {
  key: AdsPlatformSourceSyncStatusSnapshotMetricKey;
  label: string;
  leftValue: number;
  rightValue: number;
  delta: number;
  changed: boolean;
}

export type AdsPlatformSourceSyncStatusSnapshotSafetyKey =
  keyof AdsPlatformSourceSyncStatusSnapshotSafety;

export interface AdsPlatformSourceSyncStatusSnapshotSafetyDelta {
  key: AdsPlatformSourceSyncStatusSnapshotSafetyKey;
  leftValue: boolean;
  rightValue: boolean;
  changed: boolean;
  expected: false;
  rightGateClosed: boolean;
  rightGateOpen: boolean;
}

export type AdsPlatformSourceSyncStatusDecisionGateKey =
  keyof AdsPlatformSourceSyncStatusDecisionGates;

export interface AdsPlatformSourceSyncStatusDecisionGateDelta {
  key: AdsPlatformSourceSyncStatusDecisionGateKey;
  label: string;
  leftValue: boolean;
  rightValue: boolean;
  changed: boolean;
}

export type AdsPlatformSourceSyncStatusCompareReadiness =
  | AdsPlatformSourceStatus
  | 'missing';

export interface AdsPlatformSourceSyncStatusSourceReadinessDelta {
  sourceKey: AdsPlatformSourceSyncStatusSourceKey;
  leftStatus: AdsPlatformSourceSyncStatusCompareReadiness;
  rightStatus: AdsPlatformSourceSyncStatusCompareReadiness;
  leftCanUseForAdsAutomationDecision: boolean;
  rightCanUseForAdsAutomationDecision: boolean;
  leftCoverageStatus: string;
  rightCoverageStatus: string;
  leftFreshnessStatus: string;
  rightFreshnessStatus: string;
  statusChanged: boolean;
  canUseChanged: boolean;
  coverageStatusChanged: boolean;
  freshnessStatusChanged: boolean;
  changed: boolean;
}

export interface AdsPlatformSourceSyncStatusStringListDelta {
  leftValues: string[];
  rightValues: string[];
  added: string[];
  removed: string[];
  changed: boolean;
}

export interface AdsPlatformSourceSyncStatusSourceBlockerDelta {
  sourceKey: AdsPlatformSourceSyncStatusSourceKey;
  sourceSyncBlockers: AdsPlatformSourceSyncStatusStringListDelta;
  missingConfigBlockers: AdsPlatformSourceSyncStatusStringListDelta;
  warnings: AdsPlatformSourceSyncStatusStringListDelta;
  changed: boolean;
}

export interface AdsPlatformSourceSyncStatusSourceKeyDelta
  extends AdsPlatformSourceSyncStatusStringListDelta {}

export interface AdsPlatformSourceSyncStatusLocalSnapshotCompareResult {
  schemaVersion: 'ads_platform_source_sync_status_local_snapshot_compare.v1';
  leftComparisonKey: string;
  rightComparisonKey: string;
  sameComparisonKey: boolean;
  leftReportDate: string;
  rightReportDate: string;
  metricDeltas: AdsPlatformSourceSyncStatusSnapshotMetricDelta[];
  sourceKeyDelta: AdsPlatformSourceSyncStatusSourceKeyDelta;
  readinessDeltas: AdsPlatformSourceSyncStatusSourceReadinessDelta[];
  blockerDeltas: AdsPlatformSourceSyncStatusSourceBlockerDelta[];
  decisionGateDeltas: AdsPlatformSourceSyncStatusDecisionGateDelta[];
  safetyDeltas: AdsPlatformSourceSyncStatusSnapshotSafetyDelta[];
  safetyGatesClosedOnRight: boolean;
  changedSourceCount: number;
}

export interface AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditExport {
  schemaVersion: 'ads_platform_source_sync_status_local_snapshot_compare_audit_export.v1';
  exportMode: 'browser_local_compare_audit_handoff';
  generatedAt: string;
  compareSchemaVersion: AdsPlatformSourceSyncStatusLocalSnapshotCompareResult['schemaVersion'];
  leftComparisonKey: string;
  rightComparisonKey: string;
  sameComparisonKey: boolean;
  leftReportDate: string;
  rightReportDate: string;
  metricDeltas: AdsPlatformSourceSyncStatusSnapshotMetricDelta[];
  sourceKeyDelta: AdsPlatformSourceSyncStatusSourceKeyDelta;
  readinessDeltas: AdsPlatformSourceSyncStatusSourceReadinessDelta[];
  blockerDeltas: AdsPlatformSourceSyncStatusSourceBlockerDelta[];
  decisionGateDeltas: AdsPlatformSourceSyncStatusDecisionGateDelta[];
  safetyDeltas: AdsPlatformSourceSyncStatusSnapshotSafetyDelta[];
  safetyGatesClosedOnRight: boolean;
  changedSourceCount: number;
  omittedPayloads: [
    'leftSnapshot',
    'rightSnapshot',
    'plaintextSecretValues',
    'providerRawPayload',
    'liveExecutionPayload',
  ];
  local_only: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditParseResult {
  audit: AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditExport | null;
  error: string | null;
}

export type AdsPlatformSourceSyncApprovalEvidenceGateStatus =
  | 'not_available'
  | 'ready'
  | 'blocked';

export interface AdsPlatformSourceSyncApprovalEvidenceStatusDelta {
  leftValue: AdsPlatformSourceSyncApprovalEvidenceGateStatus;
  rightValue: AdsPlatformSourceSyncApprovalEvidenceGateStatus;
  changed: boolean;
}

export interface AdsPlatformSourceSyncApprovalEvidenceCountDelta {
  leftValue: number;
  rightValue: number;
  delta: number;
  changed: boolean;
}

export interface AdsPlatformSourceSyncApprovalEvidenceSourceSyncDelta {
  gateStatus: AdsPlatformSourceSyncApprovalEvidenceStatusDelta;
  blockedSources: AdsPlatformSourceSyncApprovalEvidenceCountDelta;
  blockingReasons: AdsPlatformSourceSyncStatusStringListDelta;
  sourceKeys: AdsPlatformSourceSyncStatusStringListDelta;
  changed: boolean;
}

export interface AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport {
  schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1';
  exportMode: 'browser_local_compare_audit_handoff';
  generatedAt: string;
  compareSchemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1';
  leftComparisonKey: string;
  rightComparisonKey: string;
  sameComparisonKey: boolean;
  metricDeltas: unknown[];
  safetyDeltas: unknown[];
  sourceSyncDelta: AdsPlatformSourceSyncApprovalEvidenceSourceSyncDelta;
  omittedPayloads: ['leftSnapshot', 'rightSnapshot', 'providerRawPayload', 'liveExecutionPayload'];
  local_only: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsPlatformSourceSyncApprovalEvidenceCompareAuditParseResult {
  audit: AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport | null;
  error: string | null;
}

export interface AdsPlatformSourceSyncApprovalEvidenceHandoffPrefillParseResult {
  bundle: AdsApprovalSourceSyncHandoffPrefillBundle | null;
  audit: AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport | null;
  error: string | null;
}

export interface AdsPlatformSourceSyncApprovalEvidenceHandoffPrefillStatus {
  bundleGeneratedAt: string;
  approvalCompareAuditGeneratedAt: string;
  ageMinutes: number | null;
  ageLabel: string;
  staleAfterMinutes: number;
  stale: boolean;
}

export interface AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditExport {
  schemaVersion: 'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1';
  exportMode: 'browser_local_stale_handoff_import_override_audit';
  generatedAt: string;
  browserHandoffStagedAt: string;
  approvalCompareAuditSchemaVersion: AdsApprovalSourceSyncHandoffPrefillBundle['approvalCompareAuditSchemaVersion'];
  approvalCompareAuditGeneratedAt: string;
  staleAfterMinutes: number;
  handoffAgeMinutesAtImport: number | null;
  handoffAgeLabelAtImport: string;
  handoffWasStale: boolean;
  reviewerImportTimestamp: string;
  importState: 'explicit_stale_import';
  safetyGatesClosed: true;
  omittedPayloads: [
    'approvalCompareAuditJson',
    'approvalLeftSnapshot',
    'approvalRightSnapshot',
    'sourceSyncLeftSnapshot',
    'sourceSyncRightSnapshot',
    'plaintextSecretValues',
    'providerRawPayload',
    'liveExecutionPayload',
  ];
  secret_values_omitted: true;
  local_only: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  google_ads_production_enabled: false;
}

export interface AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditParseResult {
  audit: AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditExport | null;
  error: string | null;
}

export interface AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation {
  sourceKey: AdsPlatformSourceSyncStatusSourceKey;
  matchedBy: Array<
    | 'approval_source_key'
    | 'approval_blocking_reason'
    | 'status_snapshot_source'
    | 'blocker_text'
  >;
  approvalGateStatus: AdsPlatformSourceSyncApprovalEvidenceStatusDelta;
  approvalBlockedSources: AdsPlatformSourceSyncApprovalEvidenceCountDelta;
  approvalSourceKeys: AdsPlatformSourceSyncStatusStringListDelta;
  approvalBlockingReasons: AdsPlatformSourceSyncStatusStringListDelta;
  statusReadinessDelta: AdsPlatformSourceSyncStatusSourceReadinessDelta | null;
  statusBlockerDelta: AdsPlatformSourceSyncStatusSourceBlockerDelta | null;
  blockerOverlap: {
    added: string[];
    removed: string[];
    changed: boolean;
  };
  statusRightReady: boolean;
  statusRightBlockers: string[];
  correlationSummary:
    | 'resolved_in_status_snapshot'
    | 'still_blocked_in_status_snapshot'
    | 'status_snapshot_missing_source';
}

export interface AdsPlatformSourceSyncApprovalEvidenceCompareHandoffResult {
  schemaVersion: 'ads_platform_source_sync_status_approval_compare_handoff.v1';
  generatedAt: string;
  approvalCompareAuditSchemaVersion: AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport['schemaVersion'];
  approvalCompareAuditGeneratedAt: string;
  approvalCompareSchemaVersion: AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport['compareSchemaVersion'];
  approvalLeftComparisonKey: string;
  approvalRightComparisonKey: string;
  sourceSyncCompareSchemaVersion: AdsPlatformSourceSyncStatusLocalSnapshotCompareResult['schemaVersion'];
  sourceSyncLeftComparisonKey: string;
  sourceSyncRightComparisonKey: string;
  sourceCorrelations: AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation[];
  unmatchedApprovalSourceKeys: string[];
  unmatchedApprovalBlockingReasons: string[];
  approvalSourceSyncGateChanged: boolean;
  approvalSourceSyncRightGateStatus: AdsPlatformSourceSyncApprovalEvidenceGateStatus;
  approvalBlockedSourcesDelta: number;
  safetyGatesClosed: boolean;
  omittedPayloads: [
    'approvalLeftSnapshot',
    'approvalRightSnapshot',
    'sourceSyncLeftSnapshot',
    'sourceSyncRightSnapshot',
    'plaintextSecretValues',
    'providerRawPayload',
    'liveExecutionPayload',
  ];
  local_only: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

export const ADS_PLATFORM_SOURCE_SYNC_STATUS_DEMO_QUERY: Required<
  AdsPlatformSourceSyncStatusQuery
> = {
  reportDate: '2026-07-04',
  now: '2026-07-04T05:00:00.000Z',
  sourceKeys: ['google_ads', 'advertising_costs', 'product_mapping'],
};

export const ADS_PLATFORM_SOURCE_SYNC_APPROVAL_HANDOFF_STALE_AFTER_MINUTES = 24 * 60;

@Injectable({ providedIn: 'root' })
export class AdsPlatformSourceSyncStatusReviewerService {
  private readonly endpointPath = '/ai/ads-automation/platform-source-sync-status';
  private readonly endpoint = `${environment.apiUrl}${this.endpointPath}`;

  constructor(private readonly http: HttpClient) {}

  loadStatus(
    query: AdsPlatformSourceSyncStatusQuery,
  ): Observable<AdsPlatformSourceSyncStatusResponse> {
    return this.http.post<AdsPlatformSourceSyncStatusResponse>(
      this.endpoint,
      this.cleanQuery(query),
    );
  }

  buildLocalSnapshot(
    status: AdsPlatformSourceSyncStatusResponse,
  ): AdsPlatformSourceSyncStatusLocalSnapshot {
    const safety = this.snapshotSafety(status.safety);

    return {
      schemaVersion: 'ads_platform_source_sync_status_local_snapshot.v1',
      snapshotMode: 'local_browser_download',
      createdFromEndpoint: this.endpoint,
      createdFromGeneratedAt: status.generatedAt,
      comparisonKey: this.comparisonKey(status),
      statusSchemaVersion: status.schemaVersion,
      reportDate: status.reportDate,
      safety,
      summary: {
        ...status.summary,
        blocked_sources: [...status.summary.blocked_sources],
        missing_config_sources: [...status.summary.missing_config_sources],
        stale_sources: [...status.summary.stale_sources],
        missing_coverage_sources: [...status.summary.missing_coverage_sources],
        not_synced_sources: [...status.summary.not_synced_sources],
      },
      decisionGates: { ...status.decisionGates },
      sourceDigests: status.sources.map((source) => this.sourceDigest(source)),
      omittedPayloads: ['plaintextSecretValues', 'providerRawPayload', 'liveExecutionPayload'],
      secret_values_omitted: true,
      provider_api_called: safety.provider_api_called,
      google_ads_api_called: safety.google_ads_api_called,
      validateOnly_called: safety.validateOnly_called,
      live_ads_execution_used: safety.live_ads_execution_used,
      execution_allowed_now: safety.execution_allowed_now,
      production_ready: safety.production_ready,
    };
  }

  parseLocalSnapshotJson(
    value: string,
  ): AdsPlatformSourceSyncStatusLocalSnapshotParseResult {
    const raw = this.text(value);
    if (!raw) {
      return { snapshot: null, error: 'Snapshot JSON is required' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { snapshot: null, error: 'Snapshot JSON is not valid JSON' };
    }

    if (!this.isRecord(parsed)) {
      return { snapshot: null, error: 'Snapshot JSON must be an object' };
    }

    const forbiddenPayloadKey = this.findForbiddenPayloadKey(parsed);
    if (forbiddenPayloadKey) {
      return {
        snapshot: null,
        error: `Snapshot JSON contains forbidden payload field: ${forbiddenPayloadKey}`,
      };
    }

    if (parsed['schemaVersion'] !== 'ads_platform_source_sync_status_local_snapshot.v1') {
      return {
        snapshot: null,
        error: 'Snapshot schemaVersion must be ads_platform_source_sync_status_local_snapshot.v1',
      };
    }

    if (parsed['snapshotMode'] !== 'local_browser_download') {
      return {
        snapshot: null,
        error: 'Snapshot mode must be local_browser_download',
      };
    }

    if (
      typeof parsed['comparisonKey'] !== 'string'
      || typeof parsed['reportDate'] !== 'string'
      || !this.isRecord(parsed['safety'])
      || !this.isRecord(parsed['summary'])
      || !this.isRecord(parsed['decisionGates'])
      || !Array.isArray(parsed['sourceDigests'])
      || !Array.isArray(parsed['omittedPayloads'])
    ) {
      return {
        snapshot: null,
        error: 'Snapshot is missing source-sync compare fields',
      };
    }

    if (
      parsed['secret_values_omitted'] !== true
      || !this.isExactStringList(parsed['omittedPayloads'], [
        'plaintextSecretValues',
        'providerRawPayload',
        'liveExecutionPayload',
      ])
    ) {
      return {
        snapshot: null,
        error:
          'Snapshot must omit plaintextSecretValues, providerRawPayload, and liveExecutionPayload',
      };
    }

    const openSafetyField = this.compareAuditFalseSafetyKeys()
      .find((key) => parsed[key] !== false);
    if (openSafetyField) {
      return {
        snapshot: null,
        error: `Snapshot safety field ${openSafetyField} must be false`,
      };
    }

    return {
      snapshot: parsed as unknown as AdsPlatformSourceSyncStatusLocalSnapshot,
      error: null,
    };
  }

  compareLocalSnapshots(
    left: AdsPlatformSourceSyncStatusLocalSnapshot,
    right: AdsPlatformSourceSyncStatusLocalSnapshot,
  ): AdsPlatformSourceSyncStatusLocalSnapshotCompareResult {
    const readinessDeltas = this.readinessDeltas(left, right);
    const blockerDeltas = this.blockerDeltas(left, right);
    const safetyDeltas = this.snapshotSafetyKeys().map((key) => {
      const leftValue = this.snapshotSafetyValue(left, key);
      const rightValue = this.snapshotSafetyValue(right, key);
      return {
        key,
        leftValue,
        rightValue,
        changed: leftValue !== rightValue,
        expected: false as const,
        rightGateClosed: rightValue === false,
        rightGateOpen: rightValue === true,
      };
    });

    return {
      schemaVersion: 'ads_platform_source_sync_status_local_snapshot_compare.v1',
      leftComparisonKey: left.comparisonKey,
      rightComparisonKey: right.comparisonKey,
      sameComparisonKey: left.comparisonKey === right.comparisonKey,
      leftReportDate: left.reportDate,
      rightReportDate: right.reportDate,
      metricDeltas: this.metricDeltas(left, right),
      sourceKeyDelta: this.stringListDelta(
        left.sourceDigests.map((source) => source.sourceKey),
        right.sourceDigests.map((source) => source.sourceKey),
      ),
      readinessDeltas,
      blockerDeltas,
      decisionGateDeltas: this.decisionGateDeltas(left, right),
      safetyDeltas,
      safetyGatesClosedOnRight: safetyDeltas.every((delta) => delta.rightGateClosed),
      changedSourceCount: readinessDeltas.filter((delta) => delta.changed).length
        + blockerDeltas.filter((delta) => delta.changed).length,
    };
  }

  buildLocalSnapshotCompareAuditExport(
    compare: AdsPlatformSourceSyncStatusLocalSnapshotCompareResult,
    generatedAt = new Date().toISOString(),
  ): AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditExport {
    return {
      schemaVersion: 'ads_platform_source_sync_status_local_snapshot_compare_audit_export.v1',
      exportMode: 'browser_local_compare_audit_handoff',
      generatedAt,
      compareSchemaVersion: compare.schemaVersion,
      leftComparisonKey: compare.leftComparisonKey,
      rightComparisonKey: compare.rightComparisonKey,
      sameComparisonKey: compare.sameComparisonKey,
      leftReportDate: compare.leftReportDate,
      rightReportDate: compare.rightReportDate,
      metricDeltas: compare.metricDeltas.map((delta) => ({ ...delta })),
      sourceKeyDelta: this.cloneStringListDelta(compare.sourceKeyDelta),
      readinessDeltas: compare.readinessDeltas.map((delta) => ({ ...delta })),
      blockerDeltas: compare.blockerDeltas.map((delta) => ({
        sourceKey: delta.sourceKey,
        sourceSyncBlockers: this.cloneStringListDelta(delta.sourceSyncBlockers),
        missingConfigBlockers: this.cloneStringListDelta(delta.missingConfigBlockers),
        warnings: this.cloneStringListDelta(delta.warnings),
        changed: delta.changed,
      })),
      decisionGateDeltas: compare.decisionGateDeltas.map((delta) => ({ ...delta })),
      safetyDeltas: compare.safetyDeltas.map((delta) => ({ ...delta })),
      safetyGatesClosedOnRight: compare.safetyGatesClosedOnRight,
      changedSourceCount: compare.changedSourceCount,
      omittedPayloads: [
        'leftSnapshot',
        'rightSnapshot',
        'plaintextSecretValues',
        'providerRawPayload',
        'liveExecutionPayload',
      ],
      local_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    };
  }

  parseLocalSnapshotCompareAuditJson(
    value: string,
  ): AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditParseResult {
    const raw = this.text(value);
    if (!raw) {
      return { audit: null, error: 'Compare audit JSON is required' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { audit: null, error: 'Compare audit JSON is not valid JSON' };
    }

    if (!this.isRecord(parsed)) {
      return { audit: null, error: 'Compare audit JSON must be an object' };
    }

    const forbiddenPayloadKey = this.findForbiddenPayloadKey(parsed);
    if (forbiddenPayloadKey) {
      return {
        audit: null,
        error: `Compare audit JSON contains forbidden payload field: ${forbiddenPayloadKey}`,
      };
    }

    if (
      parsed['schemaVersion']
      !== 'ads_platform_source_sync_status_local_snapshot_compare_audit_export.v1'
    ) {
      return {
        audit: null,
        error:
          'Compare audit schemaVersion must be ads_platform_source_sync_status_local_snapshot_compare_audit_export.v1',
      };
    }

    if (parsed['exportMode'] !== 'browser_local_compare_audit_handoff') {
      return {
        audit: null,
        error: 'Compare audit exportMode must be browser_local_compare_audit_handoff',
      };
    }

    if (parsed['compareSchemaVersion'] !== 'ads_platform_source_sync_status_local_snapshot_compare.v1') {
      return {
        audit: null,
        error:
          'Compare audit compareSchemaVersion must be ads_platform_source_sync_status_local_snapshot_compare.v1',
      };
    }

    if (
      typeof parsed['generatedAt'] !== 'string'
      || typeof parsed['leftComparisonKey'] !== 'string'
      || typeof parsed['rightComparisonKey'] !== 'string'
      || typeof parsed['sameComparisonKey'] !== 'boolean'
      || typeof parsed['leftReportDate'] !== 'string'
      || typeof parsed['rightReportDate'] !== 'string'
      || !Array.isArray(parsed['metricDeltas'])
      || !this.isStringListDelta(parsed['sourceKeyDelta'])
      || !Array.isArray(parsed['readinessDeltas'])
      || !Array.isArray(parsed['blockerDeltas'])
      || !Array.isArray(parsed['decisionGateDeltas'])
      || !Array.isArray(parsed['safetyDeltas'])
      || typeof parsed['safetyGatesClosedOnRight'] !== 'boolean'
      || !this.isFiniteNumber(parsed['changedSourceCount'])
    ) {
      return {
        audit: null,
        error: 'Compare audit is missing source-sync readback fields',
      };
    }

    if (
      !this.isExactStringList(parsed['omittedPayloads'], [
        'leftSnapshot',
        'rightSnapshot',
        'plaintextSecretValues',
        'providerRawPayload',
        'liveExecutionPayload',
      ])
    ) {
      return {
        audit: null,
        error:
          'Compare audit omittedPayloads must list leftSnapshot, rightSnapshot, plaintextSecretValues, providerRawPayload, and liveExecutionPayload',
      };
    }

    if (parsed['local_only'] !== true) {
      return { audit: null, error: 'Compare audit local_only must be true' };
    }

    const openSafetyField = this.compareAuditFalseSafetyKeys()
      .find((key) => parsed[key] !== false);
    if (openSafetyField) {
      return {
        audit: null,
        error: `Compare audit safety field ${openSafetyField} must be false`,
      };
    }

    return {
      audit: parsed as unknown as AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditExport,
      error: null,
    };
  }

  parseApprovalEvidenceCompareAuditJson(
    value: string,
  ): AdsPlatformSourceSyncApprovalEvidenceCompareAuditParseResult {
    const raw = this.text(value);
    if (!raw) {
      return { audit: null, error: 'Approval compare audit JSON is required' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { audit: null, error: 'Approval compare audit JSON is not valid JSON' };
    }

    if (!this.isRecord(parsed)) {
      return { audit: null, error: 'Approval compare audit JSON must be an object' };
    }

    const forbiddenPayloadKey = this.findForbiddenPayloadKey(parsed);
    if (forbiddenPayloadKey) {
      return {
        audit: null,
        error: `Approval compare audit JSON contains forbidden payload field: ${forbiddenPayloadKey}`,
      };
    }

    if (
      parsed['schemaVersion']
      !== 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1'
    ) {
      return {
        audit: null,
        error:
          'Approval compare audit schemaVersion must be ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
      };
    }

    if (parsed['exportMode'] !== 'browser_local_compare_audit_handoff') {
      return {
        audit: null,
        error: 'Approval compare audit exportMode must be browser_local_compare_audit_handoff',
      };
    }

    if (
      parsed['compareSchemaVersion']
      !== 'ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1'
    ) {
      return {
        audit: null,
        error:
          'Approval compare audit compareSchemaVersion must be ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1',
      };
    }

    if (
      typeof parsed['generatedAt'] !== 'string'
      || typeof parsed['leftComparisonKey'] !== 'string'
      || typeof parsed['rightComparisonKey'] !== 'string'
      || typeof parsed['sameComparisonKey'] !== 'boolean'
      || !Array.isArray(parsed['metricDeltas'])
      || !Array.isArray(parsed['safetyDeltas'])
      || !this.isApprovalSourceSyncDelta(parsed['sourceSyncDelta'])
    ) {
      return {
        audit: null,
        error: 'Approval compare audit is missing source-sync handoff fields',
      };
    }

    if (
      !this.isExactStringList(parsed['omittedPayloads'], [
        'leftSnapshot',
        'rightSnapshot',
        'providerRawPayload',
        'liveExecutionPayload',
      ])
    ) {
      return {
        audit: null,
        error:
          'Approval compare audit omittedPayloads must list leftSnapshot, rightSnapshot, providerRawPayload, and liveExecutionPayload',
      };
    }

    if (parsed['local_only'] !== true) {
      return { audit: null, error: 'Approval compare audit local_only must be true' };
    }

    const openSafetyField = this.compareAuditFalseSafetyKeys()
      .find((key) => parsed[key] !== false);
    if (openSafetyField) {
      return {
        audit: null,
        error: `Approval compare audit safety field ${openSafetyField} must be false`,
      };
    }

    return {
      audit: parsed as unknown as AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport,
      error: null,
    };
  }

  parseApprovalEvidenceHandoffPrefillJson(
    value: string,
  ): AdsPlatformSourceSyncApprovalEvidenceHandoffPrefillParseResult {
    const parsedBundle = parseAdsApprovalSourceSyncHandoffPrefillBundleJson(value);
    if (!parsedBundle.bundle) {
      return {
        bundle: null,
        audit: null,
        error: parsedBundle.error,
      };
    }

    const parsedAudit = this.parseApprovalEvidenceCompareAuditJson(
      parsedBundle.bundle.approvalCompareAuditJson,
    );
    if (!parsedAudit.audit) {
      return {
        bundle: parsedBundle.bundle,
        audit: null,
        error: parsedAudit.error,
      };
    }

    if (
      parsedAudit.audit.generatedAt !== parsedBundle.bundle.approvalCompareAuditGeneratedAt
      || parsedAudit.audit.leftComparisonKey !== parsedBundle.bundle.approvalLeftComparisonKey
      || parsedAudit.audit.rightComparisonKey !== parsedBundle.bundle.approvalRightComparisonKey
    ) {
      return {
        bundle: parsedBundle.bundle,
        audit: null,
        error: 'Browser handoff prefill audit metadata does not match the embedded approval audit',
      };
    }

    return {
      bundle: parsedBundle.bundle,
      audit: parsedAudit.audit,
      error: null,
    };
  }

  describeApprovalEvidenceHandoffPrefill(
    bundle: AdsApprovalSourceSyncHandoffPrefillBundle,
    now = new Date(),
  ): AdsPlatformSourceSyncApprovalEvidenceHandoffPrefillStatus {
    const ageMinutes = this.minutesSince(bundle.generatedAt, now);

    return {
      bundleGeneratedAt: bundle.generatedAt,
      approvalCompareAuditGeneratedAt: bundle.approvalCompareAuditGeneratedAt,
      ageMinutes,
      ageLabel: this.ageLabel(ageMinutes),
      staleAfterMinutes: ADS_PLATFORM_SOURCE_SYNC_APPROVAL_HANDOFF_STALE_AFTER_MINUTES,
      stale: ageMinutes !== null
        && ageMinutes >= ADS_PLATFORM_SOURCE_SYNC_APPROVAL_HANDOFF_STALE_AFTER_MINUTES,
    };
  }

  buildApprovalEvidenceHandoffOverrideAuditExport(
    bundle: AdsApprovalSourceSyncHandoffPrefillBundle,
    status: AdsPlatformSourceSyncApprovalEvidenceHandoffPrefillStatus,
    reviewerImportTimestamp = new Date().toISOString(),
  ): AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditExport {
    return {
      schemaVersion: 'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
      exportMode: 'browser_local_stale_handoff_import_override_audit',
      generatedAt: reviewerImportTimestamp,
      browserHandoffStagedAt: status.bundleGeneratedAt || bundle.generatedAt,
      approvalCompareAuditSchemaVersion: bundle.approvalCompareAuditSchemaVersion,
      approvalCompareAuditGeneratedAt:
        status.approvalCompareAuditGeneratedAt || bundle.approvalCompareAuditGeneratedAt,
      staleAfterMinutes: status.staleAfterMinutes,
      handoffAgeMinutesAtImport: status.ageMinutes,
      handoffAgeLabelAtImport: status.ageLabel,
      handoffWasStale: status.stale,
      reviewerImportTimestamp,
      importState: 'explicit_stale_import',
      safetyGatesClosed: true,
      omittedPayloads: [
        'approvalCompareAuditJson',
        'approvalLeftSnapshot',
        'approvalRightSnapshot',
        'sourceSyncLeftSnapshot',
        'sourceSyncRightSnapshot',
        'plaintextSecretValues',
        'providerRawPayload',
        'liveExecutionPayload',
      ],
      secret_values_omitted: true,
      local_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      google_ads_production_enabled: false,
    };
  }

  parseApprovalEvidenceHandoffOverrideAuditJson(
    value: string,
  ): AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditParseResult {
    const raw = this.text(value);
    if (!raw) {
      return { audit: null, error: 'Import audit JSON is required' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { audit: null, error: 'Import audit JSON is not valid JSON' };
    }

    if (!this.isRecord(parsed)) {
      return { audit: null, error: 'Import audit JSON must be an object' };
    }

    const forbiddenPayloadKey = this.findForbiddenPayloadKey(
      parsed,
      this.handoffOverrideAuditForbiddenPayloadKeys(),
    );
    if (forbiddenPayloadKey) {
      return {
        audit: null,
        error: `Import audit JSON contains forbidden payload field: ${forbiddenPayloadKey}`,
      };
    }

    if (
      parsed['schemaVersion']
      !== 'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1'
    ) {
      return {
        audit: null,
        error:
          'Import audit schemaVersion must be ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
      };
    }

    if (parsed['exportMode'] !== 'browser_local_stale_handoff_import_override_audit') {
      return {
        audit: null,
        error:
          'Import audit exportMode must be browser_local_stale_handoff_import_override_audit',
      };
    }

    if (
      parsed['approvalCompareAuditSchemaVersion']
      !== 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1'
    ) {
      return {
        audit: null,
        error:
          'Import audit approvalCompareAuditSchemaVersion must be ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
      };
    }

    if (
      typeof parsed['generatedAt'] !== 'string'
      || typeof parsed['browserHandoffStagedAt'] !== 'string'
      || typeof parsed['approvalCompareAuditGeneratedAt'] !== 'string'
      || !this.isFiniteNumber(parsed['staleAfterMinutes'])
      || !this.isNullableFiniteNumber(parsed['handoffAgeMinutesAtImport'])
      || typeof parsed['handoffAgeLabelAtImport'] !== 'string'
      || typeof parsed['handoffWasStale'] !== 'boolean'
      || typeof parsed['reviewerImportTimestamp'] !== 'string'
      || parsed['importState'] !== 'explicit_stale_import'
    ) {
      return {
        audit: null,
        error: 'Import audit is missing stale handoff override readback fields',
      };
    }

    if (parsed['safetyGatesClosed'] !== true) {
      return { audit: null, error: 'Import audit safetyGatesClosed must be true' };
    }

    if (
      parsed['secret_values_omitted'] !== true
      || !this.isExactStringList(parsed['omittedPayloads'], [
        'approvalCompareAuditJson',
        'approvalLeftSnapshot',
        'approvalRightSnapshot',
        'sourceSyncLeftSnapshot',
        'sourceSyncRightSnapshot',
        'plaintextSecretValues',
        'providerRawPayload',
        'liveExecutionPayload',
      ])
    ) {
      return {
        audit: null,
        error:
          'Import audit must omit approval audit JSON, snapshots, plaintextSecretValues, providerRawPayload, and liveExecutionPayload',
      };
    }

    if (parsed['local_only'] !== true) {
      return { audit: null, error: 'Import audit local_only must be true' };
    }

    const openSafetyField = this.handoffOverrideAuditFalseSafetyKeys()
      .find((key) => parsed[key] !== false);
    if (openSafetyField) {
      return {
        audit: null,
        error: `Import audit safety field ${openSafetyField} must be false`,
      };
    }

    return {
      audit: parsed as unknown as AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditExport,
      error: null,
    };
  }

  buildApprovalEvidenceCompareHandoff(
    sourceSyncCompare:
      | AdsPlatformSourceSyncStatusLocalSnapshotCompareResult
      | AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditExport,
    approvalAudit: AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport,
    generatedAt = new Date().toISOString(),
  ): AdsPlatformSourceSyncApprovalEvidenceCompareHandoffResult {
    const normalizedSourceSyncCompare = this.normalizeSourceSyncCompareInput(sourceSyncCompare);
    const sourceCorrelations = this.approvalSourceCorrelations(
      normalizedSourceSyncCompare,
      approvalAudit,
    );

    return {
      schemaVersion: 'ads_platform_source_sync_status_approval_compare_handoff.v1',
      generatedAt,
      approvalCompareAuditSchemaVersion: approvalAudit.schemaVersion,
      approvalCompareAuditGeneratedAt: approvalAudit.generatedAt,
      approvalCompareSchemaVersion: approvalAudit.compareSchemaVersion,
      approvalLeftComparisonKey: approvalAudit.leftComparisonKey,
      approvalRightComparisonKey: approvalAudit.rightComparisonKey,
      sourceSyncCompareSchemaVersion: normalizedSourceSyncCompare.schemaVersion,
      sourceSyncLeftComparisonKey: normalizedSourceSyncCompare.leftComparisonKey,
      sourceSyncRightComparisonKey: normalizedSourceSyncCompare.rightComparisonKey,
      sourceCorrelations,
      unmatchedApprovalSourceKeys: this.unmatchedApprovalValues(
        this.approvalSourceKeyValues(approvalAudit),
      ),
      unmatchedApprovalBlockingReasons: this.unmatchedApprovalValues(
        this.approvalBlockingReasonValues(approvalAudit),
      ),
      approvalSourceSyncGateChanged: approvalAudit.sourceSyncDelta.gateStatus.changed,
      approvalSourceSyncRightGateStatus: approvalAudit.sourceSyncDelta.gateStatus.rightValue,
      approvalBlockedSourcesDelta: approvalAudit.sourceSyncDelta.blockedSources.delta,
      safetyGatesClosed: this.compareAuditFalseSafetyKeys()
        .every((key) => approvalAudit[key] === false)
        && normalizedSourceSyncCompare.safetyGatesClosedOnRight,
      omittedPayloads: [
        'approvalLeftSnapshot',
        'approvalRightSnapshot',
        'sourceSyncLeftSnapshot',
        'sourceSyncRightSnapshot',
        'plaintextSecretValues',
        'providerRawPayload',
        'liveExecutionPayload',
      ],
      local_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    };
  }

  private cleanQuery(
    query: AdsPlatformSourceSyncStatusQuery,
  ): AdsPlatformSourceSyncStatusQuery {
    const cleaned: AdsPlatformSourceSyncStatusQuery = {};
    const reportDate = this.text(query.reportDate);
    const now = this.text(query.now);
    const sourceKeys = this.cleanSourceKeys(query.sourceKeys);

    if (reportDate) cleaned.reportDate = reportDate;
    if (now) cleaned.now = now;
    if (sourceKeys.length) cleaned.sourceKeys = sourceKeys;

    return cleaned;
  }

  private cleanSourceKeys(
    values: AdsPlatformSourceSyncStatusSourceKey[] | undefined,
  ): AdsPlatformSourceSyncStatusSourceKey[] {
    const seen = new Set<AdsPlatformSourceSyncStatusSourceKey>();
    const cleaned: AdsPlatformSourceSyncStatusSourceKey[] = [];

    for (const value of values || []) {
      const sourceKey = this.sourceKeyFromText(value);
      if (!sourceKey || seen.has(sourceKey)) continue;
      seen.add(sourceKey);
      cleaned.push(sourceKey);
    }

    return cleaned;
  }

  private sourceKeyFromText(value: unknown): AdsPlatformSourceSyncStatusSourceKey | null {
    const normalized = this.text(value);
    if (
      normalized === 'google_ads'
      || normalized === 'advertising_costs'
      || normalized === 'product_mapping'
    ) {
      return normalized;
    }

    return null;
  }

  private snapshotSafety(
    safety: AdsPlatformSourceSyncStatusSafety,
  ): AdsPlatformSourceSyncStatusSnapshotSafety {
    return {
      provider_api_called: safety.provider_api_called,
      google_ads_api_called: safety.google_ads_api_called,
      validateOnly_called: safety.validateOnly_called,
      live_ads_execution_used: safety.live_ads_execution_used,
      execution_allowed_now: safety.execution_allowed_now,
      production_ready: safety.production_ready,
      erp_mutation_used: safety.erp_mutation_used,
      payment_mutation_used: safety.payment_mutation_used,
      order_mutation_used: safety.order_mutation_used,
      inventory_mutation_used: safety.inventory_mutation_used,
      google_ads_production_enabled: safety.google_ads_production_enabled,
    };
  }

  private sourceDigest(
    source: AdsPlatformSourceSyncStatusItem,
  ): AdsPlatformSourceSyncStatusSourceDigest {
    return {
      sourceKey: source.sourceKey,
      provider: source.provider,
      platform: source.platform,
      status: source.status,
      requiredConfigPresence: source.requiredConfigPresence.map((item) => ({
        ...item,
        value_exposed: false,
      })),
      missingCredentialOrConfigBlockers: [...source.missingCredentialOrConfigBlockers],
      reportDateCoverage: { ...source.reportDateCoverage },
      freshness: { ...source.freshness },
      sourceSyncBlockers: [...source.sourceSyncBlockers],
      warnings: [...source.warnings],
      canUseForAdsAutomationDecision: source.canUseForAdsAutomationDecision,
      usableForAdsAutomationDecisions: source.usableForAdsAutomationDecisions,
    };
  }

  private comparisonKey(status: AdsPlatformSourceSyncStatusResponse): string {
    return [
      status.schemaVersion,
      status.generatedAt,
      status.reportDate,
      status.summary.status,
      `blocked=${status.summary.blocked_sources.join(',') || 'none'}`,
      `missing_config=${status.summary.missing_config_sources.join(',') || 'none'}`,
      `stale=${status.summary.stale_sources.join(',') || 'none'}`,
      `source_status=${status.sources.map((source) => `${source.sourceKey}:${source.status}`).join(',')}`,
      `provider_api_called=${status.safety.provider_api_called}`,
      `google_ads_api_called=${status.safety.google_ads_api_called}`,
      `validateOnly_called=${status.safety.validateOnly_called}`,
      `live_ads_execution_used=${status.safety.live_ads_execution_used}`,
      `execution_allowed_now=${status.safety.execution_allowed_now}`,
    ].join('|');
  }

  private metricDeltas(
    left: AdsPlatformSourceSyncStatusLocalSnapshot,
    right: AdsPlatformSourceSyncStatusLocalSnapshot,
  ): AdsPlatformSourceSyncStatusSnapshotMetricDelta[] {
    const specs: Array<{
      key: AdsPlatformSourceSyncStatusSnapshotMetricKey;
      label: string;
    }> = [
      { key: 'source_count', label: 'Sources' },
      { key: 'ready_source_count', label: 'Ready sources' },
      { key: 'blocked_source_count', label: 'Blocked sources' },
    ];

    return specs.map((spec) => {
      const leftValue = this.numberValue(left.summary[spec.key]);
      const rightValue = this.numberValue(right.summary[spec.key]);
      return {
        key: spec.key,
        label: spec.label,
        leftValue,
        rightValue,
        delta: rightValue - leftValue,
        changed: leftValue !== rightValue,
      };
    });
  }

  private readinessDeltas(
    left: AdsPlatformSourceSyncStatusLocalSnapshot,
    right: AdsPlatformSourceSyncStatusLocalSnapshot,
  ): AdsPlatformSourceSyncStatusSourceReadinessDelta[] {
    const leftMap = this.sourceDigestMap(left);
    const rightMap = this.sourceDigestMap(right);

    return this.allSourceKeys(left, right).map((sourceKey) => {
      const leftSource = leftMap.get(sourceKey) || null;
      const rightSource = rightMap.get(sourceKey) || null;
      const leftStatus = leftSource?.status || 'missing';
      const rightStatus = rightSource?.status || 'missing';
      const leftCanUseForAdsAutomationDecision =
        leftSource?.canUseForAdsAutomationDecision || false;
      const rightCanUseForAdsAutomationDecision =
        rightSource?.canUseForAdsAutomationDecision || false;
      const leftCoverageStatus = leftSource?.reportDateCoverage.coverageStatus || 'missing';
      const rightCoverageStatus = rightSource?.reportDateCoverage.coverageStatus || 'missing';
      const leftFreshnessStatus = leftSource?.freshness.freshnessStatus || 'missing';
      const rightFreshnessStatus = rightSource?.freshness.freshnessStatus || 'missing';
      const statusChanged = leftStatus !== rightStatus;
      const canUseChanged =
        leftCanUseForAdsAutomationDecision !== rightCanUseForAdsAutomationDecision;
      const coverageStatusChanged = leftCoverageStatus !== rightCoverageStatus;
      const freshnessStatusChanged = leftFreshnessStatus !== rightFreshnessStatus;

      return {
        sourceKey,
        leftStatus,
        rightStatus,
        leftCanUseForAdsAutomationDecision,
        rightCanUseForAdsAutomationDecision,
        leftCoverageStatus,
        rightCoverageStatus,
        leftFreshnessStatus,
        rightFreshnessStatus,
        statusChanged,
        canUseChanged,
        coverageStatusChanged,
        freshnessStatusChanged,
        changed: statusChanged
          || canUseChanged
          || coverageStatusChanged
          || freshnessStatusChanged,
      };
    });
  }

  private blockerDeltas(
    left: AdsPlatformSourceSyncStatusLocalSnapshot,
    right: AdsPlatformSourceSyncStatusLocalSnapshot,
  ): AdsPlatformSourceSyncStatusSourceBlockerDelta[] {
    const leftMap = this.sourceDigestMap(left);
    const rightMap = this.sourceDigestMap(right);

    return this.allSourceKeys(left, right).map((sourceKey) => {
      const leftSource = leftMap.get(sourceKey) || null;
      const rightSource = rightMap.get(sourceKey) || null;
      const sourceSyncBlockers = this.stringListDelta(
        leftSource?.sourceSyncBlockers || [],
        rightSource?.sourceSyncBlockers || [],
      );
      const missingConfigBlockers = this.stringListDelta(
        leftSource?.missingCredentialOrConfigBlockers || [],
        rightSource?.missingCredentialOrConfigBlockers || [],
      );
      const warnings = this.stringListDelta(
        leftSource?.warnings || [],
        rightSource?.warnings || [],
      );

      return {
        sourceKey,
        sourceSyncBlockers,
        missingConfigBlockers,
        warnings,
        changed: sourceSyncBlockers.changed
          || missingConfigBlockers.changed
          || warnings.changed,
      };
    });
  }

  private decisionGateDeltas(
    left: AdsPlatformSourceSyncStatusLocalSnapshot,
    right: AdsPlatformSourceSyncStatusLocalSnapshot,
  ): AdsPlatformSourceSyncStatusDecisionGateDelta[] {
    const specs: Array<{
      key: AdsPlatformSourceSyncStatusDecisionGateKey;
      label: string;
    }> = [
      { key: 'canUseGoogleAdsDataClaim', label: 'Google Ads data claim' },
      { key: 'canGenerateActionDraft', label: 'Generate action draft' },
      { key: 'canRecommendAdsScale', label: 'Recommend ads scale' },
      { key: 'canImportActionFile', label: 'Import action file' },
      { key: 'canDryRun', label: 'Dry run' },
      { key: 'canExecuteLive', label: 'Execute live' },
    ];

    return specs.map((spec) => {
      const leftValue = left.decisionGates[spec.key];
      const rightValue = right.decisionGates[spec.key];
      return {
        key: spec.key,
        label: spec.label,
        leftValue,
        rightValue,
        changed: leftValue !== rightValue,
      };
    });
  }

  private allSourceKeys(
    left: AdsPlatformSourceSyncStatusLocalSnapshot,
    right: AdsPlatformSourceSyncStatusLocalSnapshot,
  ): AdsPlatformSourceSyncStatusSourceKey[] {
    const keys = new Set<AdsPlatformSourceSyncStatusSourceKey>();
    left.sourceDigests.forEach((source) => keys.add(source.sourceKey));
    right.sourceDigests.forEach((source) => keys.add(source.sourceKey));
    const sourceOrder: AdsPlatformSourceSyncStatusSourceKey[] = [
      'google_ads',
      'advertising_costs',
      'product_mapping',
    ];

    return sourceOrder
      .filter((sourceKey) => keys.has(sourceKey));
  }

  private sourceDigestMap(
    snapshot: AdsPlatformSourceSyncStatusLocalSnapshot,
  ): Map<AdsPlatformSourceSyncStatusSourceKey, AdsPlatformSourceSyncStatusSourceDigest> {
    return new Map(snapshot.sourceDigests.map((
      source,
    ): [AdsPlatformSourceSyncStatusSourceKey, AdsPlatformSourceSyncStatusSourceDigest] => [
      source.sourceKey,
      source,
    ]));
  }

  private stringListDelta(
    leftValues: string[],
    rightValues: string[],
  ): AdsPlatformSourceSyncStatusStringListDelta {
    const left = this.uniqueStrings(leftValues);
    const right = this.uniqueStrings(rightValues);
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    const added = right.filter((value) => !leftSet.has(value));
    const removed = left.filter((value) => !rightSet.has(value));

    return {
      leftValues: left,
      rightValues: right,
      added,
      removed,
      changed: added.length > 0 || removed.length > 0,
    };
  }

  private cloneStringListDelta(
    delta: AdsPlatformSourceSyncStatusStringListDelta,
  ): AdsPlatformSourceSyncStatusStringListDelta {
    return {
      leftValues: [...delta.leftValues],
      rightValues: [...delta.rightValues],
      added: [...delta.added],
      removed: [...delta.removed],
      changed: delta.changed,
    };
  }

  private uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values || []) {
      const normalized = this.text(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }

    return result;
  }

  private snapshotSafetyKeys(): AdsPlatformSourceSyncStatusSnapshotSafetyKey[] {
    return [
      'provider_api_called',
      'google_ads_api_called',
      'validateOnly_called',
      'live_ads_execution_used',
      'execution_allowed_now',
      'production_ready',
      'erp_mutation_used',
      'payment_mutation_used',
      'order_mutation_used',
      'inventory_mutation_used',
      'google_ads_production_enabled',
    ];
  }

  private snapshotSafetyValue(
    snapshot: AdsPlatformSourceSyncStatusLocalSnapshot,
    key: AdsPlatformSourceSyncStatusSnapshotSafetyKey,
  ): boolean {
    return snapshot.safety[key];
  }

  private compareAuditFalseSafetyKeys(): Array<
    | 'provider_api_called'
    | 'google_ads_api_called'
    | 'validateOnly_called'
    | 'live_ads_execution_used'
    | 'execution_allowed_now'
    | 'production_ready'
  > {
    return [
      'provider_api_called',
      'google_ads_api_called',
      'validateOnly_called',
      'live_ads_execution_used',
      'execution_allowed_now',
      'production_ready',
    ];
  }

  private handoffOverrideAuditFalseSafetyKeys(): Array<
    | 'provider_api_called'
    | 'google_ads_api_called'
    | 'validateOnly_called'
    | 'live_ads_execution_used'
    | 'execution_allowed_now'
    | 'production_ready'
    | 'erp_mutation_used'
    | 'payment_mutation_used'
    | 'order_mutation_used'
    | 'inventory_mutation_used'
    | 'google_ads_production_enabled'
  > {
    return [
      'provider_api_called',
      'google_ads_api_called',
      'validateOnly_called',
      'live_ads_execution_used',
      'execution_allowed_now',
      'production_ready',
      'erp_mutation_used',
      'payment_mutation_used',
      'order_mutation_used',
      'inventory_mutation_used',
      'google_ads_production_enabled',
    ];
  }

  private handoffOverrideAuditForbiddenPayloadKeys(): string[] {
    return [
      'approvalCompareAuditJson',
      'approvalLeftSnapshot',
      'approvalRightSnapshot',
      'sourceSyncLeftSnapshot',
      'sourceSyncRightSnapshot',
      'sourceSyncDelta',
      'rawSnapshot',
      'rawSnapshots',
      'plaintextSecrets',
      'secretValues',
      'providerPayload',
      'validateOnly',
    ];
  }

  private normalizeSourceSyncCompareInput(
    compare:
      | AdsPlatformSourceSyncStatusLocalSnapshotCompareResult
      | AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditExport,
  ): AdsPlatformSourceSyncStatusLocalSnapshotCompareResult {
    if (compare.schemaVersion === 'ads_platform_source_sync_status_local_snapshot_compare.v1') {
      return compare;
    }

    return {
      schemaVersion: compare.compareSchemaVersion,
      leftComparisonKey: compare.leftComparisonKey,
      rightComparisonKey: compare.rightComparisonKey,
      sameComparisonKey: compare.sameComparisonKey,
      leftReportDate: compare.leftReportDate,
      rightReportDate: compare.rightReportDate,
      metricDeltas: compare.metricDeltas,
      sourceKeyDelta: this.cloneStringListDelta(compare.sourceKeyDelta),
      readinessDeltas: compare.readinessDeltas.map((delta) => ({ ...delta })),
      blockerDeltas: compare.blockerDeltas.map((delta) => ({
        sourceKey: delta.sourceKey,
        sourceSyncBlockers: this.cloneStringListDelta(delta.sourceSyncBlockers),
        missingConfigBlockers: this.cloneStringListDelta(delta.missingConfigBlockers),
        warnings: this.cloneStringListDelta(delta.warnings),
        changed: delta.changed,
      })),
      decisionGateDeltas: compare.decisionGateDeltas.map((delta) => ({ ...delta })),
      safetyDeltas: compare.safetyDeltas.map((delta) => ({ ...delta })),
      safetyGatesClosedOnRight: compare.safetyGatesClosedOnRight,
      changedSourceCount: compare.changedSourceCount,
    };
  }

  private approvalSourceCorrelations(
    sourceSyncCompare: AdsPlatformSourceSyncStatusLocalSnapshotCompareResult,
    approvalAudit: AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport,
  ): AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation[] {
    const approvalSourceKeysBySource = this.approvalValuesBySource(
      this.approvalSourceKeyValues(approvalAudit),
    );
    const approvalBlockingReasonsBySource = this.approvalValuesBySource(
      this.approvalBlockingReasonValues(approvalAudit),
    );
    const sourceKeys = this.orderedSourceKeys([
      ...Array.from(approvalSourceKeysBySource.keys()),
      ...Array.from(approvalBlockingReasonsBySource.keys()),
    ]);

    return sourceKeys.map((sourceKey) => {
      const approvalSourceKeys = this.approvalStringListDeltaForSource(
        approvalAudit.sourceSyncDelta.sourceKeys,
        sourceKey,
      );
      const approvalBlockingReasons = this.approvalStringListDeltaForSource(
        approvalAudit.sourceSyncDelta.blockingReasons,
        sourceKey,
      );
      const statusReadinessDelta = sourceSyncCompare.readinessDeltas
        .find((delta) => delta.sourceKey === sourceKey) || null;
      const statusBlockerDelta = sourceSyncCompare.blockerDeltas
        .find((delta) => delta.sourceKey === sourceKey) || null;
      const statusRightBlockers = this.statusRightBlockers(statusBlockerDelta);
      const blockerOverlap = this.blockerOverlap(approvalBlockingReasons, statusBlockerDelta);
      const matchedBy = this.correlationMatchReasons(
        approvalSourceKeys,
        approvalBlockingReasons,
        statusReadinessDelta,
        statusBlockerDelta,
        blockerOverlap,
      );
      const statusRightReady =
        statusReadinessDelta?.rightStatus === 'ready'
        && statusReadinessDelta.rightCanUseForAdsAutomationDecision === true;

      return {
        sourceKey,
        matchedBy,
        approvalGateStatus: { ...approvalAudit.sourceSyncDelta.gateStatus },
        approvalBlockedSources: { ...approvalAudit.sourceSyncDelta.blockedSources },
        approvalSourceKeys,
        approvalBlockingReasons,
        statusReadinessDelta,
        statusBlockerDelta,
        blockerOverlap,
        statusRightReady,
        statusRightBlockers,
        correlationSummary: this.correlationSummary(
          statusReadinessDelta,
          statusBlockerDelta,
          statusRightReady,
          statusRightBlockers,
        ),
      };
    });
  }

  private approvalStringListDeltaForSource(
    delta: AdsPlatformSourceSyncStatusStringListDelta,
    sourceKey: AdsPlatformSourceSyncStatusSourceKey,
  ): AdsPlatformSourceSyncStatusStringListDelta {
    const added = this.valuesForApprovalSource(delta.added, sourceKey);
    const removed = this.valuesForApprovalSource(delta.removed, sourceKey);

    return {
      leftValues: this.valuesForApprovalSource(delta.leftValues, sourceKey),
      rightValues: this.valuesForApprovalSource(delta.rightValues, sourceKey),
      added,
      removed,
      changed: added.length > 0 || removed.length > 0,
    };
  }

  private approvalValuesBySource(
    values: string[],
  ): Map<AdsPlatformSourceSyncStatusSourceKey, string[]> {
    const result = new Map<AdsPlatformSourceSyncStatusSourceKey, string[]>();

    values.forEach((value) => {
      const sourceKey = this.sourceKeyFromApprovalText(value);
      if (!sourceKey) return;

      const current = result.get(sourceKey) || [];
      if (!current.includes(value)) current.push(value);
      result.set(sourceKey, current);
    });

    return result;
  }

  private approvalSourceKeyValues(
    approvalAudit: AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport,
  ): string[] {
    return this.uniqueStrings([
      ...approvalAudit.sourceSyncDelta.sourceKeys.leftValues,
      ...approvalAudit.sourceSyncDelta.sourceKeys.rightValues,
      ...approvalAudit.sourceSyncDelta.sourceKeys.added,
      ...approvalAudit.sourceSyncDelta.sourceKeys.removed,
    ]);
  }

  private approvalBlockingReasonValues(
    approvalAudit: AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport,
  ): string[] {
    return this.uniqueStrings([
      ...approvalAudit.sourceSyncDelta.blockingReasons.leftValues,
      ...approvalAudit.sourceSyncDelta.blockingReasons.rightValues,
      ...approvalAudit.sourceSyncDelta.blockingReasons.added,
      ...approvalAudit.sourceSyncDelta.blockingReasons.removed,
    ]);
  }

  private unmatchedApprovalValues(values: string[]): string[] {
    return values.filter((value) => !this.sourceKeyFromApprovalText(value));
  }

  private orderedSourceKeys(
    values: AdsPlatformSourceSyncStatusSourceKey[],
  ): AdsPlatformSourceSyncStatusSourceKey[] {
    const seen = new Set<AdsPlatformSourceSyncStatusSourceKey>();
    const sourceOrder: AdsPlatformSourceSyncStatusSourceKey[] = [
      'google_ads',
      'advertising_costs',
      'product_mapping',
    ];

    values.forEach((value) => seen.add(value));
    return sourceOrder.filter((sourceKey) => seen.has(sourceKey));
  }

  private valuesForApprovalSource(
    values: string[],
    sourceKey: AdsPlatformSourceSyncStatusSourceKey,
  ): string[] {
    return this.uniqueStrings(values)
      .filter((value) => this.sourceKeyFromApprovalText(value) === sourceKey);
  }

  private sourceKeyFromApprovalText(value: unknown): AdsPlatformSourceSyncStatusSourceKey | null {
    const normalized = this.text(value).toLowerCase();
    if (!normalized) return null;

    if (
      normalized === 'google'
      || normalized === 'google_ads'
      || normalized.startsWith('google_ads:')
      || normalized.includes('google_ads')
      || normalized.includes('campaign_budget')
      || normalized.includes('campaignbudgetid')
      || normalized.includes('campaign_budget_id')
      || normalized.includes('campaign')
      || normalized.includes('ad_group')
    ) {
      return 'google_ads';
    }

    if (
      normalized === 'advertising_costs'
      || normalized.includes('advertising_cost')
      || normalized.includes('ad_cost')
    ) {
      return 'advertising_costs';
    }

    if (
      normalized === 'product_mapping'
      || normalized.includes('product_mapping')
      || normalized === 'product'
    ) {
      return 'product_mapping';
    }

    return null;
  }

  private statusRightBlockers(
    blockerDelta: AdsPlatformSourceSyncStatusSourceBlockerDelta | null,
  ): string[] {
    if (!blockerDelta) return [];

    return this.uniqueStrings([
      ...blockerDelta.sourceSyncBlockers.rightValues,
      ...blockerDelta.missingConfigBlockers.rightValues,
    ]);
  }

  private blockerOverlap(
    approvalBlockingReasons: AdsPlatformSourceSyncStatusStringListDelta,
    statusBlockerDelta: AdsPlatformSourceSyncStatusSourceBlockerDelta | null,
  ): { added: string[]; removed: string[]; changed: boolean } {
    if (!statusBlockerDelta) {
      return { added: [], removed: [], changed: false };
    }

    const statusAdded = this.uniqueStrings([
      ...statusBlockerDelta.sourceSyncBlockers.added,
      ...statusBlockerDelta.missingConfigBlockers.added,
      ...statusBlockerDelta.warnings.added,
    ]);
    const statusRemoved = this.uniqueStrings([
      ...statusBlockerDelta.sourceSyncBlockers.removed,
      ...statusBlockerDelta.missingConfigBlockers.removed,
      ...statusBlockerDelta.warnings.removed,
    ]);
    const added = approvalBlockingReasons.added
      .filter((reason) => statusAdded.some((statusReason) => (
        this.blockerTextMatches(reason, statusReason)
      )));
    const removed = approvalBlockingReasons.removed
      .filter((reason) => statusRemoved.some((statusReason) => (
        this.blockerTextMatches(reason, statusReason)
      )));

    return {
      added,
      removed,
      changed: added.length > 0 || removed.length > 0,
    };
  }

  private blockerTextMatches(left: string, right: string): boolean {
    const leftText = this.text(left).toLowerCase();
    const rightText = this.text(right).toLowerCase();
    if (!leftText || !rightText) return false;
    if (leftText === rightText) return true;

    const categoryTokens = [
      'missing_config',
      'freshness_stale',
      'stale',
      'missing_coverage',
      'not_synced',
      'unsupported',
    ];
    return categoryTokens.some((token) => leftText.includes(token) && rightText.includes(token));
  }

  private correlationMatchReasons(
    approvalSourceKeys: AdsPlatformSourceSyncStatusStringListDelta,
    approvalBlockingReasons: AdsPlatformSourceSyncStatusStringListDelta,
    statusReadinessDelta: AdsPlatformSourceSyncStatusSourceReadinessDelta | null,
    statusBlockerDelta: AdsPlatformSourceSyncStatusSourceBlockerDelta | null,
    blockerOverlap: { added: string[]; removed: string[]; changed: boolean },
  ): AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation['matchedBy'] {
    const matchedBy: AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation['matchedBy'] = [];

    if (
      approvalSourceKeys.leftValues.length
      || approvalSourceKeys.rightValues.length
      || approvalSourceKeys.added.length
      || approvalSourceKeys.removed.length
    ) {
      matchedBy.push('approval_source_key');
    }

    if (
      approvalBlockingReasons.leftValues.length
      || approvalBlockingReasons.rightValues.length
      || approvalBlockingReasons.added.length
      || approvalBlockingReasons.removed.length
    ) {
      matchedBy.push('approval_blocking_reason');
    }

    if (statusReadinessDelta || statusBlockerDelta) {
      matchedBy.push('status_snapshot_source');
    }

    if (blockerOverlap.changed) {
      matchedBy.push('blocker_text');
    }

    return matchedBy;
  }

  private correlationSummary(
    readinessDelta: AdsPlatformSourceSyncStatusSourceReadinessDelta | null,
    blockerDelta: AdsPlatformSourceSyncStatusSourceBlockerDelta | null,
    statusRightReady: boolean,
    statusRightBlockers: string[],
  ): AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation['correlationSummary'] {
    if (!readinessDelta && !blockerDelta) {
      return 'status_snapshot_missing_source';
    }

    if (statusRightReady && statusRightBlockers.length === 0) {
      return 'resolved_in_status_snapshot';
    }

    return 'still_blocked_in_status_snapshot';
  }

  private isApprovalSourceSyncDelta(
    value: unknown,
  ): value is AdsPlatformSourceSyncApprovalEvidenceSourceSyncDelta {
    return this.isRecord(value)
      && this.isApprovalStatusDelta(value['gateStatus'])
      && this.isApprovalCountDelta(value['blockedSources'])
      && this.isStringListDelta(value['blockingReasons'])
      && this.isStringListDelta(value['sourceKeys'])
      && typeof value['changed'] === 'boolean';
  }

  private isApprovalStatusDelta(
    value: unknown,
  ): value is AdsPlatformSourceSyncApprovalEvidenceStatusDelta {
    return this.isRecord(value)
      && this.isApprovalGateStatus(value['leftValue'])
      && this.isApprovalGateStatus(value['rightValue'])
      && typeof value['changed'] === 'boolean';
  }

  private isApprovalCountDelta(
    value: unknown,
  ): value is AdsPlatformSourceSyncApprovalEvidenceCountDelta {
    return this.isRecord(value)
      && this.isFiniteNumber(value['leftValue'])
      && this.isFiniteNumber(value['rightValue'])
      && this.isFiniteNumber(value['delta'])
      && typeof value['changed'] === 'boolean';
  }

  private isApprovalGateStatus(
    value: unknown,
  ): value is AdsPlatformSourceSyncApprovalEvidenceGateStatus {
    return value === 'not_available' || value === 'ready' || value === 'blocked';
  }

  private findForbiddenPayloadKey(value: unknown, extraForbiddenKeys: string[] = []): string | null {
    const forbiddenKeys = new Set([
      'leftSnapshot',
      'rightSnapshot',
      'plaintextSecretValues',
      'providerRawPayload',
      'liveExecutionPayload',
      ...extraForbiddenKeys,
    ]);
    const stack: unknown[] = [value];

    while (stack.length > 0) {
      const current = stack.pop();

      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }

      if (!this.isRecord(current)) continue;

      for (const [key, nestedValue] of Object.entries(current)) {
        if (forbiddenKeys.has(key)) {
          return key;
        }

        stack.push(nestedValue);
      }
    }

    return null;
  }

  private isStringListDelta(value: unknown): value is AdsPlatformSourceSyncStatusStringListDelta {
    return this.isRecord(value)
      && this.isStringArray(value['leftValues'])
      && this.isStringArray(value['rightValues'])
      && this.isStringArray(value['added'])
      && this.isStringArray(value['removed'])
      && typeof value['changed'] === 'boolean';
  }

  private isExactStringList(value: unknown, expected: string[]): boolean {
    return this.isStringArray(value)
      && value.length === expected.length
      && expected.every((item, index) => value[index] === item);
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private isNullableFiniteNumber(value: unknown): value is number | null {
    return value === null || this.isFiniteNumber(value);
  }

  private minutesSince(value: string, now: Date): number | null {
    const generatedAtMs = Date.parse(value);
    const nowMs = now.getTime();

    if (!Number.isFinite(generatedAtMs) || !Number.isFinite(nowMs)) {
      return null;
    }

    return Math.max(0, Math.floor((nowMs - generatedAtMs) / 60000));
  }

  private ageLabel(ageMinutes: number | null): string {
    if (ageMinutes === null) return 'age unavailable';
    if (ageMinutes < 60) return `${ageMinutes}m old`;

    const hours = Math.floor(ageMinutes / 60);
    const minutes = ageMinutes % 60;
    if (hours < 24) return `${hours}h ${minutes}m old`;

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h ${minutes}m old`;
  }

  private numberValue(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private text(value: unknown): string {
    return String(value ?? '').trim();
  }
}
