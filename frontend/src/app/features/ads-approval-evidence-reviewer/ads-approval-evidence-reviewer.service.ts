import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AdsApprovalEvidenceFixtureOption =
  | 'linked'
  | 'linked_budget_update_evidence'
  | 'empty'
  | 'empty_approval_evidence';

export type AdsApprovalEvidenceSourceSyncGateStatus =
  | 'not_available'
  | 'ready'
  | 'blocked';

export interface AdsApprovalEvidenceSourceSyncDecisionEvidence {
  sourceKey?: string;
  reportDate?: string;
  provider?: string;
  sourceKind?: string;
  status?: string;
  freshnessStatus?: string;
  blockingReasons?: string[];
  [key: string]: unknown;
}

export interface AdsApprovalEvidenceReviewerDocsSafety {
  read_only: boolean;
  dry_run: boolean;
  local_only: boolean;
  in_memory_only: boolean;
  persistence_used: boolean;
  durable_storage_used: boolean;
  erp_local_persistence_used: boolean;
  provider_persistence_used: boolean;
  provider_api_called: boolean;
  google_ads_api_called: boolean;
  validateOnly_called: boolean;
  live_ads_execution_used: boolean;
  erp_mutation_used: boolean;
  payment_mutation_used: boolean;
  production_ready: boolean;
  approval_required_for_all_records: boolean;
  future_live_execution_allowed: boolean;
  execution_allowed_now: boolean;
  live_path_implemented: boolean;
  provider_mutation_used: boolean;
  direct_google_ads_api_call: boolean;
  reviewer_export_readback: boolean;
  reviewer_export_persistence_performed: boolean;
  reviewer_docs_readback: boolean;
  reviewer_docs_persistence_performed: boolean;
  demo_fixture_used: boolean;
  demo_fixture_persistence_performed: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsSummary {
  docs_status: 'empty' | 'ready_for_review';
  docs_mode: string;
  source_export_mode: string;
  export_status: string;
  total_evidence_records_rendered: number;
  validateOnly_evidence_records_rendered: number;
  policy_decision_records_rendered: number;
  execution_preflight_records_rendered: number;
  pending_approval_record_rendered: boolean;
  source_sync_decision_evidence_records_rendered: number;
  source_sync_decision_blocked_sources_rendered: number;
  source_sync_gate_status: AdsApprovalEvidenceSourceSyncGateStatus;
  source_sync_can_generate_action_draft: boolean | null;
  source_sync_can_use_google_ads_data_claim: boolean | null;
  source_sync_blocking_reasons_rendered: string[];
  linked_validateOnly_evidence_records: number;
  linked_policy_decision_records: number;
  route_examples_rendered: number;
  sections_rendered: number;
  approval_required: boolean;
  future_live_execution_allowed: boolean;
  execution_allowed_now: boolean;
  live_path_implemented: boolean;
  reviewer_docs_persistence_performed: boolean;
  reviewer_export_persistence_performed: boolean;
  provider_api_called: boolean;
  google_ads_api_called: boolean;
  validateOnly_called: boolean;
  live_ads_execution_used: boolean;
  erp_mutation_used: boolean;
  payment_mutation_used: boolean;
  next_required_action: string;
}

export interface AdsApprovalEvidenceReviewerDocsRouteExample {
  label: string;
  method: 'GET';
  path: string;
  query: string | null;
  purpose: string;
  provider_api_called: boolean;
  erp_mutation_used: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsSection {
  section_id: string;
  title: string;
  status: 'empty' | 'ready_for_review' | 'passed' | 'attention';
  lines: string[];
  evidence_record_ids: string[];
}

export interface AdsApprovalEvidenceReviewerDocsLinks {
  execution_record_ids: string[];
  validateOnly_validation_ids_from_preflight: string[];
  validateOnly_validation_ids_with_evidence: string[];
  validateOnly_validation_ids_missing_evidence: string[];
  policy_decision_ids_from_preflight: string[];
  policy_decision_ids_with_evidence: string[];
  policy_decision_ids_missing_evidence: string[];
}

export interface AdsApprovalEvidenceReviewerDocsResponse {
  schemaVersion: 'ads_automation_approval_evidence_reviewer_docs.v1';
  generatedAt: string;
  docsMode: 'local_readback_docs' | 'local_demo_fixture_docs';
  query: {
    approval_id: string;
    fixture?: string;
  };
  safety: AdsApprovalEvidenceReviewerDocsSafety;
  summary: AdsApprovalEvidenceReviewerDocsSummary;
  routeExamples: AdsApprovalEvidenceReviewerDocsRouteExample[];
  renderedSections: AdsApprovalEvidenceReviewerDocsSection[];
  markdownPreview: string;
  reviewerExport: {
    schemaVersion: string;
    exportMode: string;
    fixture: {
      fixture_id: string;
      scenario: string;
      source: string;
      description: string;
      persisted_to_db: boolean;
      provider_api_called: boolean;
      google_ads_api_called: boolean;
      validateOnly_called: boolean;
      live_ads_execution_used: boolean;
    } | null;
    evidenceIndex: {
      links: AdsApprovalEvidenceReviewerDocsLinks;
      sourceSyncDecisionEvidence?: AdsApprovalEvidenceSourceSyncDecisionEvidence[];
      sourceSyncDecisionGates?: Record<string, unknown> | null;
    };
  };
}

export type AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey =
  | 'future_live_execution_allowed'
  | 'execution_allowed_now'
  | 'live_path_implemented'
  | 'provider_api_called'
  | 'google_ads_api_called'
  | 'validateOnly_called'
  | 'live_ads_execution_used'
  | 'erp_mutation_used'
  | 'payment_mutation_used'
  | 'production_ready'
  | 'reviewer_docs_persistence_performed'
  | 'reviewer_export_persistence_performed';

export type AdsApprovalEvidenceReviewerDocsLocalSnapshotSafety =
  Pick<AdsApprovalEvidenceReviewerDocsSafety, AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey>;

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync {
  pending_approval_record_rendered: boolean;
  gate_status: AdsApprovalEvidenceSourceSyncGateStatus;
  decision_evidence_records_rendered: number;
  blocked_sources_rendered: number;
  can_generate_action_draft: boolean | null;
  can_use_google_ads_data_claim: boolean | null;
  blocking_reasons: string[];
  source_keys: string[];
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshot {
  schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot.v1';
  snapshotMode: 'local_browser_download';
  createdFromEndpoint: string;
  createdFromDocsGeneratedAt: string;
  comparisonKey: string;
  docsSchemaVersion: AdsApprovalEvidenceReviewerDocsResponse['schemaVersion'];
  docsMode: AdsApprovalEvidenceReviewerDocsResponse['docsMode'];
  query: AdsApprovalEvidenceReviewerDocsResponse['query'];
  safety: AdsApprovalEvidenceReviewerDocsLocalSnapshotSafety;
  summary: AdsApprovalEvidenceReviewerDocsSummary;
  routeExamples: AdsApprovalEvidenceReviewerDocsRouteExample[];
  renderedSections: AdsApprovalEvidenceReviewerDocsSection[];
  markdownPreview: string;
  source_sync: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync;
  reviewerExportDigest: {
    schemaVersion: string;
    exportMode: string;
    fixture: AdsApprovalEvidenceReviewerDocsResponse['reviewerExport']['fixture'];
    evidence_links: AdsApprovalEvidenceReviewerDocsLinks;
    source_sync: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync;
  };
  omittedPayloads: ['providerRawPayload', 'liveExecutionPayload'];
  provider_api_called: boolean;
  google_ads_api_called: boolean;
  validateOnly_called: boolean;
  execution_allowed_now: boolean;
  production_ready: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotParseResult {
  snapshot: AdsApprovalEvidenceReviewerDocsLocalSnapshot | null;
  error: string | null;
}

export type AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricKey =
  | 'total_evidence_records_rendered'
  | 'validateOnly_evidence_records_rendered'
  | 'policy_decision_records_rendered'
  | 'execution_preflight_records_rendered'
  | 'source_sync_decision_evidence_records_rendered'
  | 'source_sync_decision_blocked_sources_rendered'
  | 'linked_validateOnly_evidence_records'
  | 'linked_policy_decision_records';

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricDelta {
  key: AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricKey;
  label: string;
  leftValue: number;
  rightValue: number;
  delta: number;
  changed: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyDelta {
  key: AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey;
  leftValue: boolean;
  rightValue: boolean;
  changed: boolean;
  rightGateClosed: boolean;
  rightGateOpen: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncStatusDelta {
  leftValue: AdsApprovalEvidenceSourceSyncGateStatus;
  rightValue: AdsApprovalEvidenceSourceSyncGateStatus;
  changed: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncCountDelta {
  leftValue: number;
  rightValue: number;
  delta: number;
  changed: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta {
  leftValues: string[];
  rightValues: string[];
  added: string[];
  removed: string[];
  changed: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncDelta {
  gateStatus: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncStatusDelta;
  blockedSources: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncCountDelta;
  blockingReasons: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta;
  sourceKeys: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta;
  changed: boolean;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareResult {
  schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1';
  leftComparisonKey: string;
  rightComparisonKey: string;
  sameComparisonKey: boolean;
  metricDeltas: AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricDelta[];
  safetyDeltas: AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyDelta[];
  sourceSyncDelta: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncDelta;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditExport {
  schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1';
  exportMode: 'browser_local_compare_audit_handoff';
  generatedAt: string;
  compareSchemaVersion: AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareResult['schemaVersion'];
  leftComparisonKey: string;
  rightComparisonKey: string;
  sameComparisonKey: boolean;
  metricDeltas: AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricDelta[];
  safetyDeltas: AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyDelta[];
  sourceSyncDelta: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncDelta;
  omittedPayloads: ['leftSnapshot', 'rightSnapshot', 'providerRawPayload', 'liveExecutionPayload'];
  local_only: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditParseResult {
  audit: AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditExport | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdsApprovalEvidenceReviewerService {
  private readonly baseUrl = `${environment.apiUrl}/ai/ads-automation/decision-draft-approvals`;

  constructor(private readonly http: HttpClient) {}

  getReviewerDocs(
    approvalId: string,
    fixture?: AdsApprovalEvidenceFixtureOption | '',
  ): Observable<AdsApprovalEvidenceReviewerDocsResponse> {
    const normalizedApprovalId = approvalId.trim();
    let params = new HttpParams();

    if (fixture) {
      params = params.set('fixture', fixture);
    }

    return this.http.get<AdsApprovalEvidenceReviewerDocsResponse>(
      `${this.baseUrl}/${encodeURIComponent(normalizedApprovalId)}/evidence-index/reviewer-docs`,
      { params },
    );
  }

  buildLocalSnapshot(
    docs: AdsApprovalEvidenceReviewerDocsResponse,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshot {
    const safety = this.snapshotSafety(docs.safety);
    const sourceSync = this.sourceSyncSnapshot(docs);

    return {
      schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot.v1',
      snapshotMode: 'local_browser_download',
      createdFromEndpoint: this.reviewerDocsEndpoint(docs.query.approval_id),
      createdFromDocsGeneratedAt: docs.generatedAt,
      comparisonKey: this.comparisonKey(docs),
      docsSchemaVersion: docs.schemaVersion,
      docsMode: docs.docsMode,
      query: { ...docs.query },
      safety,
      summary: { ...docs.summary },
      routeExamples: docs.routeExamples.map((example) => ({ ...example })),
      renderedSections: docs.renderedSections.map((section) => ({
        ...section,
        lines: [...section.lines],
        evidence_record_ids: [...section.evidence_record_ids],
      })),
      markdownPreview: docs.markdownPreview,
      source_sync: this.cloneSourceSyncSnapshot(sourceSync),
      reviewerExportDigest: {
        schemaVersion: docs.reviewerExport.schemaVersion,
        exportMode: docs.reviewerExport.exportMode,
        fixture: docs.reviewerExport.fixture ? { ...docs.reviewerExport.fixture } : null,
        evidence_links: {
          execution_record_ids: [...docs.reviewerExport.evidenceIndex.links.execution_record_ids],
          validateOnly_validation_ids_from_preflight: [
            ...docs.reviewerExport.evidenceIndex.links.validateOnly_validation_ids_from_preflight,
          ],
          validateOnly_validation_ids_with_evidence: [
            ...docs.reviewerExport.evidenceIndex.links.validateOnly_validation_ids_with_evidence,
          ],
          validateOnly_validation_ids_missing_evidence: [
            ...docs.reviewerExport.evidenceIndex.links.validateOnly_validation_ids_missing_evidence,
          ],
          policy_decision_ids_from_preflight: [
            ...docs.reviewerExport.evidenceIndex.links.policy_decision_ids_from_preflight,
          ],
          policy_decision_ids_with_evidence: [
            ...docs.reviewerExport.evidenceIndex.links.policy_decision_ids_with_evidence,
          ],
          policy_decision_ids_missing_evidence: [
            ...docs.reviewerExport.evidenceIndex.links.policy_decision_ids_missing_evidence,
          ],
        },
        source_sync: this.cloneSourceSyncSnapshot(sourceSync),
      },
      omittedPayloads: ['providerRawPayload', 'liveExecutionPayload'],
      provider_api_called: safety.provider_api_called,
      google_ads_api_called: safety.google_ads_api_called,
      validateOnly_called: safety.validateOnly_called,
      execution_allowed_now: safety.execution_allowed_now,
      production_ready: safety.production_ready,
    };
  }

  parseLocalSnapshotJson(
    value: string,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotParseResult {
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

    if (parsed['schemaVersion'] !== 'ads_approval_evidence_reviewer_docs_local_snapshot.v1') {
      return {
        snapshot: null,
        error: 'Snapshot schemaVersion must be ads_approval_evidence_reviewer_docs_local_snapshot.v1',
      };
    }

    if (parsed['snapshotMode'] !== 'local_browser_download') {
      return {
        snapshot: null,
        error: 'Snapshot mode must be local_browser_download',
      };
    }

    if (
      !this.isRecord(parsed['safety'])
      || !this.isRecord(parsed['summary'])
      || !Array.isArray(parsed['routeExamples'])
      || !Array.isArray(parsed['renderedSections'])
      || !this.isRecord(parsed['source_sync'])
      || !this.isRecord(parsed['reviewerExportDigest'])
      || !Array.isArray(parsed['omittedPayloads'])
    ) {
      return {
        snapshot: null,
        error: 'Snapshot is missing approval evidence reviewer compare fields',
      };
    }

    return {
      snapshot: parsed as unknown as AdsApprovalEvidenceReviewerDocsLocalSnapshot,
      error: null,
    };
  }

  compareLocalSnapshots(
    left: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
    right: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareResult {
    return {
      schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1',
      leftComparisonKey: left.comparisonKey,
      rightComparisonKey: right.comparisonKey,
      sameComparisonKey: left.comparisonKey === right.comparisonKey,
      metricDeltas: this.metricDeltas(left, right),
      safetyDeltas: this.snapshotSafetyKeys().map((key) => {
        const leftValue = this.snapshotSafetyValue(left, key);
        const rightValue = this.snapshotSafetyValue(right, key);
        return {
          key,
          leftValue,
          rightValue,
          changed: leftValue !== rightValue,
          rightGateClosed: rightValue === false,
          rightGateOpen: rightValue === true,
        };
      }),
      sourceSyncDelta: this.sourceSyncDelta(left, right),
    };
  }

  buildLocalSnapshotCompareAuditExport(
    compare: AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareResult,
    generatedAt = new Date().toISOString(),
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditExport {
    return {
      schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
      exportMode: 'browser_local_compare_audit_handoff',
      generatedAt,
      compareSchemaVersion: compare.schemaVersion,
      leftComparisonKey: compare.leftComparisonKey,
      rightComparisonKey: compare.rightComparisonKey,
      sameComparisonKey: compare.sameComparisonKey,
      metricDeltas: compare.metricDeltas.map((delta) => ({ ...delta })),
      safetyDeltas: compare.safetyDeltas.map((delta) => ({ ...delta })),
      sourceSyncDelta: {
        gateStatus: { ...compare.sourceSyncDelta.gateStatus },
        blockedSources: { ...compare.sourceSyncDelta.blockedSources },
        blockingReasons: this.cloneSourceSyncListDelta(compare.sourceSyncDelta.blockingReasons),
        sourceKeys: this.cloneSourceSyncListDelta(compare.sourceSyncDelta.sourceKeys),
        changed: compare.sourceSyncDelta.changed,
      },
      omittedPayloads: ['leftSnapshot', 'rightSnapshot', 'providerRawPayload', 'liveExecutionPayload'],
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
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditParseResult {
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

    const forbiddenPayloadKey = this.findForbiddenCompareAuditPayloadKey(parsed);
    if (forbiddenPayloadKey) {
      return {
        audit: null,
        error: `Compare audit JSON contains forbidden payload field: ${forbiddenPayloadKey}`,
      };
    }

    if (
      parsed['schemaVersion']
      !== 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1'
    ) {
      return {
        audit: null,
        error:
          'Compare audit schemaVersion must be ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
      };
    }

    if (parsed['exportMode'] !== 'browser_local_compare_audit_handoff') {
      return {
        audit: null,
        error: 'Compare audit exportMode must be browser_local_compare_audit_handoff',
      };
    }

    if (parsed['compareSchemaVersion'] !== 'ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1') {
      return {
        audit: null,
        error:
          'Compare audit compareSchemaVersion must be ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1',
      };
    }

    if (
      typeof parsed['generatedAt'] !== 'string'
      || typeof parsed['leftComparisonKey'] !== 'string'
      || typeof parsed['rightComparisonKey'] !== 'string'
      || typeof parsed['sameComparisonKey'] !== 'boolean'
    ) {
      return {
        audit: null,
        error: 'Compare audit is missing comparison readback fields',
      };
    }

    if (!this.isMetricDeltaArray(parsed['metricDeltas'])) {
      return { audit: null, error: 'Compare audit metricDeltas are invalid' };
    }

    if (!this.isSafetyDeltaArray(parsed['safetyDeltas'])) {
      return { audit: null, error: 'Compare audit safetyDeltas are invalid' };
    }

    if (!this.isSourceSyncDelta(parsed['sourceSyncDelta'])) {
      return { audit: null, error: 'Compare audit sourceSyncDelta is invalid' };
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
          'Compare audit omittedPayloads must list leftSnapshot, rightSnapshot, providerRawPayload, and liveExecutionPayload',
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
      audit: parsed as unknown as AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditExport,
      error: null,
    };
  }

  private reviewerDocsEndpoint(approvalId: string): string {
    return `${this.baseUrl}/${encodeURIComponent(approvalId.trim())}/evidence-index/reviewer-docs`;
  }

  private snapshotSafety(
    safety: AdsApprovalEvidenceReviewerDocsSafety,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotSafety {
    return {
      future_live_execution_allowed: safety.future_live_execution_allowed,
      execution_allowed_now: safety.execution_allowed_now,
      live_path_implemented: safety.live_path_implemented,
      provider_api_called: safety.provider_api_called,
      google_ads_api_called: safety.google_ads_api_called,
      validateOnly_called: safety.validateOnly_called,
      live_ads_execution_used: safety.live_ads_execution_used,
      erp_mutation_used: safety.erp_mutation_used,
      payment_mutation_used: safety.payment_mutation_used,
      production_ready: safety.production_ready,
      reviewer_docs_persistence_performed: safety.reviewer_docs_persistence_performed,
      reviewer_export_persistence_performed: safety.reviewer_export_persistence_performed,
    };
  }

  private comparisonKey(docs: AdsApprovalEvidenceReviewerDocsResponse): string {
    const sourceSync = this.sourceSyncSnapshot(docs);

    return [
      docs.schemaVersion,
      docs.docsMode,
      docs.generatedAt,
      docs.summary.docs_status,
      docs.query.approval_id,
      docs.query.fixture || 'none',
      `evidence=${docs.summary.total_evidence_records_rendered}`,
      `source_sync_gate=${sourceSync.gate_status}`,
      `source_sync_evidence=${sourceSync.decision_evidence_records_rendered}`,
      `source_sync_blocked=${sourceSync.blocked_sources_rendered}`,
      `source_sync_blockers=${sourceSync.blocking_reasons.join(',') || 'none'}`,
      `source_sync_source_keys=${sourceSync.source_keys.join(',') || 'none'}`,
      `provider_api_called=${docs.safety.provider_api_called}`,
      `google_ads_api_called=${docs.safety.google_ads_api_called}`,
      `validateOnly_called=${docs.safety.validateOnly_called}`,
      `execution_allowed_now=${docs.safety.execution_allowed_now}`,
    ].join('|');
  }

  private metricDeltas(
    left: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
    right: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricDelta[] {
    const specs: Array<{
      key: AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricKey;
      label: string;
    }> = [
      { key: 'total_evidence_records_rendered', label: 'Evidence records' },
      { key: 'validateOnly_evidence_records_rendered', label: 'Validate-only records' },
      { key: 'policy_decision_records_rendered', label: 'Policy decisions' },
      { key: 'execution_preflight_records_rendered', label: 'Preflight records' },
      { key: 'source_sync_decision_evidence_records_rendered', label: 'Source-sync records' },
      { key: 'source_sync_decision_blocked_sources_rendered', label: 'Blocked source-sync' },
      { key: 'linked_validateOnly_evidence_records', label: 'Linked validate-only' },
      { key: 'linked_policy_decision_records', label: 'Linked policy decisions' },
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

  private sourceSyncDelta(
    left: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
    right: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncDelta {
    const leftSourceSync = this.snapshotSourceSync(left);
    const rightSourceSync = this.snapshotSourceSync(right);
    const gateStatus = {
      leftValue: leftSourceSync.gate_status,
      rightValue: rightSourceSync.gate_status,
      changed: leftSourceSync.gate_status !== rightSourceSync.gate_status,
    };
    const blockedSources = {
      leftValue: leftSourceSync.blocked_sources_rendered,
      rightValue: rightSourceSync.blocked_sources_rendered,
      delta: rightSourceSync.blocked_sources_rendered - leftSourceSync.blocked_sources_rendered,
      changed: leftSourceSync.blocked_sources_rendered !== rightSourceSync.blocked_sources_rendered,
    };
    const blockingReasons = this.stringListDelta(
      leftSourceSync.blocking_reasons,
      rightSourceSync.blocking_reasons,
    );
    const sourceKeys = this.stringListDelta(leftSourceSync.source_keys, rightSourceSync.source_keys);

    return {
      gateStatus,
      blockedSources,
      blockingReasons,
      sourceKeys,
      changed: gateStatus.changed
        || blockedSources.changed
        || blockingReasons.changed
        || sourceKeys.changed,
    };
  }

  private snapshotSafetyKeys(): AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey[] {
    return [
      'future_live_execution_allowed',
      'execution_allowed_now',
      'live_path_implemented',
      'provider_api_called',
      'google_ads_api_called',
      'validateOnly_called',
      'live_ads_execution_used',
      'erp_mutation_used',
      'payment_mutation_used',
      'production_ready',
      'reviewer_docs_persistence_performed',
      'reviewer_export_persistence_performed',
    ];
  }

  private snapshotMetricKeys(): AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricKey[] {
    return [
      'total_evidence_records_rendered',
      'validateOnly_evidence_records_rendered',
      'policy_decision_records_rendered',
      'execution_preflight_records_rendered',
      'source_sync_decision_evidence_records_rendered',
      'source_sync_decision_blocked_sources_rendered',
      'linked_validateOnly_evidence_records',
      'linked_policy_decision_records',
    ];
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

  private findForbiddenCompareAuditPayloadKey(value: unknown): string | null {
    const forbiddenKeys = new Set([
      'leftSnapshot',
      'rightSnapshot',
      'providerRawPayload',
      'liveExecutionPayload',
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

  private isMetricDeltaArray(
    value: unknown,
  ): value is AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricDelta[] {
    return Array.isArray(value) && value.every((item) => (
      this.isRecord(item)
      && this.isMetricKey(item['key'])
      && typeof item['label'] === 'string'
      && this.isFiniteNumber(item['leftValue'])
      && this.isFiniteNumber(item['rightValue'])
      && this.isFiniteNumber(item['delta'])
      && typeof item['changed'] === 'boolean'
    ));
  }

  private isSafetyDeltaArray(
    value: unknown,
  ): value is AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyDelta[] {
    return Array.isArray(value) && value.every((item) => (
      this.isRecord(item)
      && this.isSafetyKey(item['key'])
      && typeof item['leftValue'] === 'boolean'
      && typeof item['rightValue'] === 'boolean'
      && typeof item['changed'] === 'boolean'
      && typeof item['rightGateClosed'] === 'boolean'
      && typeof item['rightGateOpen'] === 'boolean'
    ));
  }

  private isSourceSyncDelta(
    value: unknown,
  ): value is AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncDelta {
    return this.isRecord(value)
      && this.isSourceSyncStatusDelta(value['gateStatus'])
      && this.isSourceSyncCountDelta(value['blockedSources'])
      && this.isSourceSyncListDelta(value['blockingReasons'])
      && this.isSourceSyncListDelta(value['sourceKeys'])
      && typeof value['changed'] === 'boolean';
  }

  private isSourceSyncStatusDelta(
    value: unknown,
  ): value is AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncStatusDelta {
    return this.isRecord(value)
      && this.isSourceSyncGateStatus(value['leftValue'])
      && this.isSourceSyncGateStatus(value['rightValue'])
      && typeof value['changed'] === 'boolean';
  }

  private isSourceSyncCountDelta(
    value: unknown,
  ): value is AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncCountDelta {
    return this.isRecord(value)
      && this.isFiniteNumber(value['leftValue'])
      && this.isFiniteNumber(value['rightValue'])
      && this.isFiniteNumber(value['delta'])
      && typeof value['changed'] === 'boolean';
  }

  private isSourceSyncListDelta(
    value: unknown,
  ): value is AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta {
    return this.isRecord(value)
      && this.isStringArray(value['leftValues'])
      && this.isStringArray(value['rightValues'])
      && this.isStringArray(value['added'])
      && this.isStringArray(value['removed'])
      && typeof value['changed'] === 'boolean';
  }

  private isSourceSyncGateStatus(value: unknown): value is AdsApprovalEvidenceSourceSyncGateStatus {
    return value === 'not_available' || value === 'ready' || value === 'blocked';
  }

  private isMetricKey(value: unknown): value is AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricKey {
    return this.snapshotMetricKeys().includes(
      value as AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricKey,
    );
  }

  private isSafetyKey(value: unknown): value is AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey {
    return this.snapshotSafetyKeys().includes(
      value as AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey,
    );
  }

  private isExactStringList(value: unknown, expected: string[]): boolean {
    return this.isStringArray(value)
      && value.length === expected.length
      && expected.every((item, index) => value[index] === item);
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private snapshotSafetyValue(
    snapshot: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
    key: AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey,
  ): boolean {
    const topLevel = snapshot as unknown as Record<string, unknown>;
    return snapshot.safety[key] === true || topLevel[key] === true;
  }

  private sourceSyncSnapshot(
    docs: AdsApprovalEvidenceReviewerDocsResponse,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync {
    const summary = docs.summary;
    const records = docs.reviewerExport.evidenceIndex.sourceSyncDecisionEvidence || [];

    return {
      pending_approval_record_rendered: summary.pending_approval_record_rendered === true,
      gate_status: summary.source_sync_gate_status || 'not_available',
      decision_evidence_records_rendered: this.numberValue(
        summary.source_sync_decision_evidence_records_rendered,
      ),
      blocked_sources_rendered: this.numberValue(
        summary.source_sync_decision_blocked_sources_rendered,
      ),
      can_generate_action_draft: this.booleanOrNull(summary.source_sync_can_generate_action_draft),
      can_use_google_ads_data_claim: this.booleanOrNull(
        summary.source_sync_can_use_google_ads_data_claim,
      ),
      blocking_reasons: Array.isArray(summary.source_sync_blocking_reasons_rendered)
        ? [...summary.source_sync_blocking_reasons_rendered]
        : [],
      source_keys: records
        .map((record) => this.text(record.sourceKey))
        .filter((value) => value.length > 0),
    };
  }

  private snapshotSourceSync(
    snapshot: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync {
    const sourceSync = snapshot.source_sync || snapshot.reviewerExportDigest.source_sync;

    return {
      pending_approval_record_rendered: sourceSync.pending_approval_record_rendered === true,
      gate_status: this.normalizeSourceSyncGateStatus(sourceSync.gate_status),
      decision_evidence_records_rendered: this.numberValue(
        sourceSync.decision_evidence_records_rendered,
      ),
      blocked_sources_rendered: this.numberValue(sourceSync.blocked_sources_rendered),
      can_generate_action_draft: this.booleanOrNull(sourceSync.can_generate_action_draft),
      can_use_google_ads_data_claim: this.booleanOrNull(
        sourceSync.can_use_google_ads_data_claim,
      ),
      blocking_reasons: Array.isArray(sourceSync.blocking_reasons)
        ? this.uniqueStrings(sourceSync.blocking_reasons)
        : [],
      source_keys: Array.isArray(sourceSync.source_keys)
        ? this.uniqueStrings(sourceSync.source_keys)
        : [],
    };
  }

  private cloneSourceSyncSnapshot(
    sourceSync: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync {
    return {
      ...sourceSync,
      blocking_reasons: [...sourceSync.blocking_reasons],
      source_keys: [...sourceSync.source_keys],
    };
  }

  private cloneSourceSyncListDelta(
    delta: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta,
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta {
    return {
      leftValues: [...delta.leftValues],
      rightValues: [...delta.rightValues],
      added: [...delta.added],
      removed: [...delta.removed],
      changed: delta.changed,
    };
  }

  private booleanOrNull(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private normalizeSourceSyncGateStatus(
    value: unknown,
  ): AdsApprovalEvidenceSourceSyncGateStatus {
    return value === 'ready' || value === 'blocked' ? value : 'not_available';
  }

  private numberValue(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private stringListDelta(
    leftValues: unknown[],
    rightValues: unknown[],
  ): AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta {
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

  private uniqueStrings(values: unknown[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    values.forEach((value) => {
      const normalized = this.text(value);
      if (!normalized || seen.has(normalized)) return;

      seen.add(normalized);
      result.push(normalized);
    });

    return result;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private text(value: unknown): string {
    return String(value ?? '').trim();
  }
}
