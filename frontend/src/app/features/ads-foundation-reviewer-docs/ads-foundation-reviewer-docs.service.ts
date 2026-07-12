import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AdsFoundationSourceKey =
  | 'ads_performance'
  | 'campaign_budgets'
  | 'product_performance'
  | 'supplier_safety'
  | 'pause_review'
  | 'cashflow_policy';

export interface AdsFoundationReviewerDocsQuery {
  snapshotDate?: string;
  evidenceWindow?: {
    from?: string;
    to?: string;
    days?: number;
  };
  customerIds?: string[];
  accountIds?: string[];
  productIds?: string[];
  maxAgeHours?: Partial<Record<AdsFoundationSourceKey, number>>;
  now?: string;
}

export interface AdsFoundationReviewerDocsSafety {
  read_only: boolean;
  dry_run: boolean;
  local_only: boolean;
  repository_read_only: boolean;
  read_model_query_used: boolean;
  foundation_snapshot_reused: boolean;
  source_review_export_reused: boolean;
  reviewer_export_readback: boolean;
  reviewer_docs_readback: boolean;
  reviewer_docs_persistence_performed: boolean;
  reviewer_export_persistence_performed: boolean;
  full_foundation_snapshot_payload_included: boolean;
  campaignBudgetId_fallback_used: boolean;
  provider_api_called: boolean;
  google_ads_api_called: boolean;
  validateOnly_called: boolean;
  live_ads_execution_used: boolean;
  erp_mutation_used: boolean;
  payment_mutation_used: boolean;
  order_mutation_used: boolean;
  inventory_mutation_used: boolean;
  execution_allowed_now: boolean;
  production_ready: boolean;
  provider_mutation_used: boolean;
  direct_google_ads_api_call: boolean;
  future_live_execution_allowed: boolean;
  live_path_implemented: boolean;
}

export type AdsFoundationReviewerDocsStatus = 'ready_for_review' | 'needs_attention' | 'empty';
export type AdsFoundationReviewerSectionStatus =
  | 'empty'
  | 'ready_for_review'
  | 'passed'
  | 'attention';

export interface AdsFoundationReviewerDocsSummary {
  docs_status: AdsFoundationReviewerDocsStatus;
  docs_mode: 'local_readback_docs';
  source_export_mode: 'local_readback';
  source_export_schema_version: string;
  source_foundation_snapshot_schema_version: string;
  read_model_source: string;
  rendered_sections: number;
  attention_sections: number;
  attention_section_ids: string[];
  source_evidence_records_rendered: number;
  stale_source_evidence_records: number;
  missing_source_evidence_records: number;
  missing_field_evidence_records: number;
  query_evidence_records_rendered: number;
  missing_query_evidence_records: number;
  campaignBudgetId_required: boolean;
  campaignBudgetId_fallback_used: boolean;
  full_foundation_snapshot_payload_included: boolean;
  source_review_export_reused: boolean;
  reviewer_docs_persistence_performed: boolean;
  reviewer_export_persistence_performed: boolean;
  provider_api_called: boolean;
  google_ads_api_called: boolean;
  validateOnly_called: boolean;
  live_ads_execution_used: boolean;
  erp_mutation_used: boolean;
  payment_mutation_used: boolean;
  order_mutation_used: boolean;
  inventory_mutation_used: boolean;
  execution_allowed_now: boolean;
  production_ready: boolean;
  next_required_action: string;
}

export interface AdsFoundationReviewerDocsRouteExample {
  label: string;
  method: 'POST';
  path: string;
  purpose: string;
  provider_api_called: boolean;
  erp_mutation_used: boolean;
}

export interface AdsFoundationReviewerDocsSection {
  section_id: string;
  title: string;
  status: AdsFoundationReviewerSectionStatus;
  lines: string[];
  evidence_record_ids: string[];
}

export interface AdsFoundationReviewerDocsSourceExportDigest {
  schemaVersion: string;
  generatedAt: string;
  exportMode: 'local_readback';
  review_export_route: string;
  foundation_snapshot_schema_version: string;
  read_model_source: string;
  summary: Record<string, unknown>;
  rendered_section_ids: string[];
  evidence_record_ids: string[];
  omitted_payloads: ['foundationSnapshot'];
  full_foundation_snapshot_payload_included: boolean;
}

export interface AdsFoundationReviewerDocsResponse {
  schemaVersion: 'ads_automation_decision_foundation_read_model_reviewer_docs.v1';
  generatedAt: string;
  docsMode: 'local_readback_docs';
  query: AdsFoundationReviewerDocsQuery;
  safety: AdsFoundationReviewerDocsSafety;
  summary: AdsFoundationReviewerDocsSummary;
  routeExamples: AdsFoundationReviewerDocsRouteExample[];
  renderedSections: AdsFoundationReviewerDocsSection[];
  markdownPreview: string;
  sourceExportDigest: AdsFoundationReviewerDocsSourceExportDigest;
}

export interface AdsFoundationReviewerDocsLocalSnapshotSafety {
  provider_api_called: boolean;
  google_ads_api_called: boolean;
  validateOnly_called: boolean;
  execution_allowed_now: boolean;
  production_ready: boolean;
  live_ads_execution_used: boolean;
  erp_mutation_used: boolean;
  payment_mutation_used: boolean;
  order_mutation_used: boolean;
  inventory_mutation_used: boolean;
  campaignBudgetId_fallback_used: boolean;
  full_foundation_snapshot_payload_included: boolean;
  reviewer_docs_persistence_performed: boolean;
  reviewer_export_persistence_performed: boolean;
}

export type AdsFoundationReviewerDocsLocalSnapshotSafetyKey =
  keyof AdsFoundationReviewerDocsLocalSnapshotSafety;

export interface AdsFoundationReviewerDocsLocalSnapshot {
  schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot.v1';
  snapshotMode: 'local_browser_download';
  createdFromEndpoint: string;
  createdFromDocsGeneratedAt: string;
  comparisonKey: string;
  docsSchemaVersion: AdsFoundationReviewerDocsResponse['schemaVersion'];
  docsMode: AdsFoundationReviewerDocsResponse['docsMode'];
  query: AdsFoundationReviewerDocsQuery;
  safety: AdsFoundationReviewerDocsLocalSnapshotSafety;
  summary: AdsFoundationReviewerDocsSummary;
  routeExamples: AdsFoundationReviewerDocsRouteExample[];
  renderedSections: AdsFoundationReviewerDocsSection[];
  markdownPreview: string;
  sourceExportDigest: AdsFoundationReviewerDocsSourceExportDigest;
  omittedPayloads: ['foundationSnapshot'];
  provider_api_called: boolean;
  google_ads_api_called: boolean;
  validateOnly_called: boolean;
  execution_allowed_now: boolean;
  production_ready: boolean;
  campaignBudgetId_fallback_used: boolean;
  full_foundation_snapshot_payload_included: boolean;
}

export interface AdsFoundationReviewerDocsLocalSnapshotParseResult {
  snapshot: AdsFoundationReviewerDocsLocalSnapshot | null;
  error: string | null;
}

export type AdsFoundationReviewerDocsLocalSnapshotMetricKey =
  | 'attention_sections'
  | 'stale_source_evidence_records'
  | 'missing_source_evidence_records'
  | 'missing_field_evidence_records'
  | 'missing_query_evidence_records';

export interface AdsFoundationReviewerDocsLocalSnapshotMetricDelta {
  key: AdsFoundationReviewerDocsLocalSnapshotMetricKey;
  label: string;
  leftValue: number;
  rightValue: number;
  delta: number;
  changed: boolean;
}

export interface AdsFoundationReviewerDocsLocalSnapshotSafetyDelta {
  key: AdsFoundationReviewerDocsLocalSnapshotSafetyKey;
  leftValue: boolean;
  rightValue: boolean;
  changed: boolean;
  rightGateClosed: boolean;
  rightGateOpen: boolean;
}

export interface AdsFoundationReviewerDocsLocalSnapshotAttentionSectionDelta {
  section_id: string;
  title: string;
  leftPresent: boolean;
  rightPresent: boolean;
  leftStatus: AdsFoundationReviewerSectionStatus | 'missing';
  rightStatus: AdsFoundationReviewerSectionStatus | 'missing';
  changed: boolean;
}

export interface AdsFoundationReviewerDocsLocalSnapshotOmissionDelta {
  leftOmitted: boolean;
  rightOmitted: boolean;
  changed: boolean;
}

export interface AdsFoundationReviewerDocsLocalSnapshotCompareResult {
  schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot_compare.v1';
  leftComparisonKey: string;
  rightComparisonKey: string;
  sameComparisonKey: boolean;
  metricDeltas: AdsFoundationReviewerDocsLocalSnapshotMetricDelta[];
  safetyDeltas: AdsFoundationReviewerDocsLocalSnapshotSafetyDelta[];
  attentionSectionDeltas: AdsFoundationReviewerDocsLocalSnapshotAttentionSectionDelta[];
  campaignBudgetIdFallbackDelta: AdsFoundationReviewerDocsLocalSnapshotSafetyDelta;
  foundationSnapshotOmissionDelta: AdsFoundationReviewerDocsLocalSnapshotOmissionDelta;
}

export interface AdsFoundationReviewerDocsLocalSnapshotCompareParseResult {
  compare: AdsFoundationReviewerDocsLocalSnapshotCompareResult | null;
  error: string | null;
}

export const ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY: AdsFoundationReviewerDocsQuery = {
  snapshotDate: '2026-07-04',
  evidenceWindow: { from: '2026-06-21', to: '2026-07-04', days: 14 },
  customerIds: ['1234567890'],
  productIds: ['P_SCALE'],
  maxAgeHours: { campaign_budgets: 24, product_performance: 24 },
  now: '2026-07-04T05:00:00.000Z',
};

@Injectable({ providedIn: 'root' })
export class AdsFoundationReviewerDocsService {
  private readonly endpointPath = '/ai/ads-automation/decision-foundation-read-model-reviewer-docs';
  private readonly endpoint = `${environment.apiUrl}${this.endpointPath}`;

  constructor(private readonly http: HttpClient) {}

  loadReviewerDocs(
    query: AdsFoundationReviewerDocsQuery,
  ): Observable<AdsFoundationReviewerDocsResponse> {
    return this.http.post<AdsFoundationReviewerDocsResponse>(
      this.endpoint,
      this.cleanQuery(query),
    );
  }

  buildLocalSnapshot(
    docs: AdsFoundationReviewerDocsResponse,
  ): AdsFoundationReviewerDocsLocalSnapshot {
    const safety = this.snapshotSafety(docs.safety);

    return {
      schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot.v1',
      snapshotMode: 'local_browser_download',
      createdFromEndpoint: this.endpoint,
      createdFromDocsGeneratedAt: docs.generatedAt,
      comparisonKey: this.comparisonKey(docs),
      docsSchemaVersion: docs.schemaVersion,
      docsMode: docs.docsMode,
      query: this.cloneQuery(docs.query),
      safety,
      summary: {
        ...docs.summary,
        attention_section_ids: [...docs.summary.attention_section_ids],
      },
      routeExamples: docs.routeExamples.map((example) => ({ ...example })),
      renderedSections: docs.renderedSections.map((section) => ({
        ...section,
        lines: [...section.lines],
        evidence_record_ids: [...section.evidence_record_ids],
      })),
      markdownPreview: docs.markdownPreview,
      sourceExportDigest: {
        ...docs.sourceExportDigest,
        summary: { ...docs.sourceExportDigest.summary },
        rendered_section_ids: [...docs.sourceExportDigest.rendered_section_ids],
        evidence_record_ids: [...docs.sourceExportDigest.evidence_record_ids],
        omitted_payloads: ['foundationSnapshot'],
      },
      omittedPayloads: ['foundationSnapshot'],
      provider_api_called: safety.provider_api_called,
      google_ads_api_called: safety.google_ads_api_called,
      validateOnly_called: safety.validateOnly_called,
      execution_allowed_now: safety.execution_allowed_now,
      production_ready: safety.production_ready,
      campaignBudgetId_fallback_used: safety.campaignBudgetId_fallback_used,
      full_foundation_snapshot_payload_included: safety.full_foundation_snapshot_payload_included,
    };
  }

  parseLocalSnapshotJson(value: string): AdsFoundationReviewerDocsLocalSnapshotParseResult {
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

    if (parsed['schemaVersion'] !== 'ads_foundation_reviewer_docs_local_snapshot.v1') {
      return {
        snapshot: null,
        error: 'Snapshot schemaVersion must be ads_foundation_reviewer_docs_local_snapshot.v1',
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
      || !Array.isArray(parsed['renderedSections'])
      || !this.isRecord(parsed['sourceExportDigest'])
      || !Array.isArray(parsed['omittedPayloads'])
    ) {
      return {
        snapshot: null,
        error: 'Snapshot is missing reviewer-docs compare fields',
      };
    }

    const unsafeError = this.unsafeSnapshotImportError(parsed);
    if (unsafeError) {
      return { snapshot: null, error: unsafeError };
    }

    return { snapshot: parsed as unknown as AdsFoundationReviewerDocsLocalSnapshot, error: null };
  }

  parseLocalSnapshotCompareJson(
    value: string,
  ): AdsFoundationReviewerDocsLocalSnapshotCompareParseResult {
    const raw = this.text(value);
    if (!raw) {
      return { compare: null, error: 'Compare JSON is required' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { compare: null, error: 'Compare JSON is not valid JSON' };
    }

    if (!this.isRecord(parsed)) {
      return { compare: null, error: 'Compare JSON must be an object' };
    }

    if (parsed['schemaVersion'] !== 'ads_foundation_reviewer_docs_local_snapshot_compare.v1') {
      return {
        compare: null,
        error: 'Compare schemaVersion must be ads_foundation_reviewer_docs_local_snapshot_compare.v1',
      };
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'foundationSnapshot')) {
      return {
        compare: null,
        error: 'Compare JSON must not include foundationSnapshot payload',
      };
    }

    if (
      typeof parsed['leftComparisonKey'] !== 'string'
      || typeof parsed['rightComparisonKey'] !== 'string'
      || !this.isBoolean(parsed['sameComparisonKey'])
      || !Array.isArray(parsed['metricDeltas'])
      || !Array.isArray(parsed['safetyDeltas'])
      || !Array.isArray(parsed['attentionSectionDeltas'])
      || !this.isRecord(parsed['campaignBudgetIdFallbackDelta'])
    ) {
      return {
        compare: null,
        error: 'Compare JSON is missing reviewer-docs compare fields',
      };
    }

    const omissionDelta = parsed['foundationSnapshotOmissionDelta'];
    if (
      !this.isRecord(omissionDelta)
      || !this.isBoolean(omissionDelta['leftOmitted'])
      || !this.isBoolean(omissionDelta['rightOmitted'])
      || !this.isBoolean(omissionDelta['changed'])
    ) {
      return {
        compare: null,
        error: 'Compare JSON is missing foundationSnapshotOmissionDelta',
      };
    }

    return {
      compare: parsed as unknown as AdsFoundationReviewerDocsLocalSnapshotCompareResult,
      error: null,
    };
  }

  compareLocalSnapshots(
    left: AdsFoundationReviewerDocsLocalSnapshot,
    right: AdsFoundationReviewerDocsLocalSnapshot,
  ): AdsFoundationReviewerDocsLocalSnapshotCompareResult {
    const safetyDeltas = this.snapshotSafetyKeys().map((key) => {
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
    });
    const campaignBudgetIdFallbackDelta = safetyDeltas.find((delta) => (
      delta.key === 'campaignBudgetId_fallback_used'
    ))!;
    const leftOmitted = this.foundationSnapshotOmitted(left);
    const rightOmitted = this.foundationSnapshotOmitted(right);

    return {
      schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
      leftComparisonKey: left.comparisonKey,
      rightComparisonKey: right.comparisonKey,
      sameComparisonKey: left.comparisonKey === right.comparisonKey,
      metricDeltas: this.metricDeltas(left, right),
      safetyDeltas,
      attentionSectionDeltas: this.attentionSectionDeltas(left, right),
      campaignBudgetIdFallbackDelta,
      foundationSnapshotOmissionDelta: {
        leftOmitted,
        rightOmitted,
        changed: leftOmitted !== rightOmitted,
      },
    };
  }

  private cleanQuery(query: AdsFoundationReviewerDocsQuery): AdsFoundationReviewerDocsQuery {
    const cleaned: AdsFoundationReviewerDocsQuery = {};
    const snapshotDate = this.text(query.snapshotDate);
    const now = this.text(query.now);
    const evidenceWindow = this.cleanEvidenceWindow(query.evidenceWindow);
    const maxAgeHours = this.cleanMaxAgeHours(query.maxAgeHours);

    if (snapshotDate) cleaned.snapshotDate = snapshotDate;
    if (evidenceWindow) cleaned.evidenceWindow = evidenceWindow;
    if (this.cleanList(query.customerIds).length) cleaned.customerIds = this.cleanList(query.customerIds);
    if (this.cleanList(query.accountIds).length) cleaned.accountIds = this.cleanList(query.accountIds);
    if (this.cleanList(query.productIds).length) cleaned.productIds = this.cleanList(query.productIds);
    if (maxAgeHours) cleaned.maxAgeHours = maxAgeHours;
    if (now) cleaned.now = now;

    return cleaned;
  }

  private cleanEvidenceWindow(
    value: AdsFoundationReviewerDocsQuery['evidenceWindow'],
  ): AdsFoundationReviewerDocsQuery['evidenceWindow'] | undefined {
    if (!value) return undefined;

    const cleaned: NonNullable<AdsFoundationReviewerDocsQuery['evidenceWindow']> = {};
    const from = this.text(value.from);
    const to = this.text(value.to);
    const days = Number(value.days);

    if (from) cleaned.from = from;
    if (to) cleaned.to = to;
    if (Number.isFinite(days) && days > 0) cleaned.days = days;

    return Object.keys(cleaned).length ? cleaned : undefined;
  }

  private cleanMaxAgeHours(
    value: AdsFoundationReviewerDocsQuery['maxAgeHours'],
  ): AdsFoundationReviewerDocsQuery['maxAgeHours'] | undefined {
    if (!value) return undefined;

    const cleaned: Partial<Record<AdsFoundationSourceKey, number>> = {};
    const sourceKeys: AdsFoundationSourceKey[] = [
      'ads_performance',
      'campaign_budgets',
      'product_performance',
      'supplier_safety',
      'pause_review',
      'cashflow_policy',
    ];

    for (const key of sourceKeys) {
      const hours = Number(value[key]);
      if (Number.isFinite(hours) && hours > 0) {
        cleaned[key] = hours;
      }
    }

    return Object.keys(cleaned).length ? cleaned : undefined;
  }

  private cleanList(values: string[] | undefined): string[] {
    return (values || []).map((value) => this.text(value)).filter(Boolean);
  }

  private text(value: unknown): string {
    return String(value ?? '').trim();
  }

  private unsafeSnapshotImportError(snapshot: Record<string, unknown>): string | null {
    const sourceExportDigest = snapshot['sourceExportDigest'];

    if (Object.prototype.hasOwnProperty.call(snapshot, 'foundationSnapshot')) {
      return 'Snapshot JSON must not include foundationSnapshot payload';
    }

    if (
      this.booleanFlag(snapshot, 'full_foundation_snapshot_payload_included')
      || this.booleanFlag(snapshot['safety'], 'full_foundation_snapshot_payload_included')
      || this.booleanFlag(sourceExportDigest, 'full_foundation_snapshot_payload_included')
      || !this.stringList(snapshot['omittedPayloads']).includes('foundationSnapshot')
      || (
        this.isRecord(sourceExportDigest)
        && !this.stringList(sourceExportDigest['omitted_payloads']).includes('foundationSnapshot')
      )
    ) {
      return 'Snapshot JSON must omit foundationSnapshot payload';
    }

    const unsafeGateKeys = [
      'provider_api_called',
      'google_ads_api_called',
      'validateOnly_called',
      'execution_allowed_now',
      'production_ready',
      'live_ads_execution_used',
      'erp_mutation_used',
      'payment_mutation_used',
      'order_mutation_used',
      'inventory_mutation_used',
      'reviewer_docs_persistence_performed',
      'reviewer_export_persistence_performed',
      'provider_mutation_used',
      'direct_google_ads_api_call',
      'future_live_execution_allowed',
      'live_path_implemented',
    ];
    const summary = snapshot['summary'];
    const safety = snapshot['safety'];

    if (
      unsafeGateKeys.some((key) => (
        this.booleanFlag(snapshot, key)
        || this.booleanFlag(safety, key)
        || this.booleanFlag(summary, key)
      ))
    ) {
      return 'Snapshot safety gates must be closed before compare import';
    }

    return null;
  }

  private booleanFlag(source: unknown, key: string): boolean {
    return this.isRecord(source) && source[key] === true;
  }

  private snapshotSafety(
    safety: AdsFoundationReviewerDocsSafety,
  ): AdsFoundationReviewerDocsLocalSnapshotSafety {
    return {
      provider_api_called: safety.provider_api_called,
      google_ads_api_called: safety.google_ads_api_called,
      validateOnly_called: safety.validateOnly_called,
      execution_allowed_now: safety.execution_allowed_now,
      production_ready: safety.production_ready,
      live_ads_execution_used: safety.live_ads_execution_used,
      erp_mutation_used: safety.erp_mutation_used,
      payment_mutation_used: safety.payment_mutation_used,
      order_mutation_used: safety.order_mutation_used,
      inventory_mutation_used: safety.inventory_mutation_used,
      campaignBudgetId_fallback_used: safety.campaignBudgetId_fallback_used,
      full_foundation_snapshot_payload_included: safety.full_foundation_snapshot_payload_included,
      reviewer_docs_persistence_performed: safety.reviewer_docs_persistence_performed,
      reviewer_export_persistence_performed: safety.reviewer_export_persistence_performed,
    };
  }

  private cloneQuery(query: AdsFoundationReviewerDocsQuery): AdsFoundationReviewerDocsQuery {
    return {
      ...query,
      evidenceWindow: query.evidenceWindow ? { ...query.evidenceWindow } : undefined,
      customerIds: query.customerIds ? [...query.customerIds] : undefined,
      accountIds: query.accountIds ? [...query.accountIds] : undefined,
      productIds: query.productIds ? [...query.productIds] : undefined,
      maxAgeHours: query.maxAgeHours ? { ...query.maxAgeHours } : undefined,
    };
  }

  private comparisonKey(docs: AdsFoundationReviewerDocsResponse): string {
    return [
      docs.schemaVersion,
      docs.docsMode,
      docs.generatedAt,
      docs.summary.docs_status,
      docs.summary.rendered_sections,
      docs.summary.attention_section_ids.join(','),
      `provider_api_called=${docs.safety.provider_api_called}`,
      `google_ads_api_called=${docs.safety.google_ads_api_called}`,
      `validateOnly_called=${docs.safety.validateOnly_called}`,
      `execution_allowed_now=${docs.safety.execution_allowed_now}`,
      `campaignBudgetId_fallback_used=${docs.safety.campaignBudgetId_fallback_used}`,
      `full_foundation_snapshot_payload_included=${docs.safety.full_foundation_snapshot_payload_included}`,
    ].join('|');
  }

  private snapshotSafetyKeys(): AdsFoundationReviewerDocsLocalSnapshotSafetyKey[] {
    return [
      'provider_api_called',
      'google_ads_api_called',
      'validateOnly_called',
      'execution_allowed_now',
      'production_ready',
      'live_ads_execution_used',
      'erp_mutation_used',
      'payment_mutation_used',
      'order_mutation_used',
      'inventory_mutation_used',
      'campaignBudgetId_fallback_used',
      'full_foundation_snapshot_payload_included',
      'reviewer_docs_persistence_performed',
      'reviewer_export_persistence_performed',
    ];
  }

  private metricDeltas(
    left: AdsFoundationReviewerDocsLocalSnapshot,
    right: AdsFoundationReviewerDocsLocalSnapshot,
  ): AdsFoundationReviewerDocsLocalSnapshotMetricDelta[] {
    const specs: Array<{
      key: AdsFoundationReviewerDocsLocalSnapshotMetricKey;
      label: string;
    }> = [
      { key: 'attention_sections', label: 'Attention sections' },
      { key: 'stale_source_evidence_records', label: 'Stale source evidence' },
      { key: 'missing_source_evidence_records', label: 'Missing source evidence' },
      { key: 'missing_field_evidence_records', label: 'Missing field evidence' },
      { key: 'missing_query_evidence_records', label: 'Missing query evidence' },
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

  private attentionSectionDeltas(
    left: AdsFoundationReviewerDocsLocalSnapshot,
    right: AdsFoundationReviewerDocsLocalSnapshot,
  ): AdsFoundationReviewerDocsLocalSnapshotAttentionSectionDelta[] {
    const leftIds = this.stringList(left.summary.attention_section_ids);
    const rightIds = this.stringList(right.summary.attention_section_ids);

    return this.orderedUnique([...leftIds, ...rightIds]).map((sectionId) => {
      const leftSection = this.sectionById(left, sectionId);
      const rightSection = this.sectionById(right, sectionId);
      const leftPresent = leftIds.includes(sectionId);
      const rightPresent = rightIds.includes(sectionId);
      const leftStatus = leftPresent ? leftSection?.status || 'attention' : 'missing';
      const rightStatus = rightPresent ? rightSection?.status || 'attention' : 'missing';
      const title = rightSection?.title || leftSection?.title || sectionId;

      return {
        section_id: sectionId,
        title,
        leftPresent,
        rightPresent,
        leftStatus,
        rightStatus,
        changed: leftPresent !== rightPresent || leftStatus !== rightStatus,
      };
    });
  }

  private sectionById(
    snapshot: AdsFoundationReviewerDocsLocalSnapshot,
    sectionId: string,
  ): AdsFoundationReviewerDocsSection | undefined {
    return snapshot.renderedSections.find((section) => section.section_id === sectionId);
  }

  private foundationSnapshotOmitted(snapshot: AdsFoundationReviewerDocsLocalSnapshot): boolean {
    const fullPayloadIncluded = (
      snapshot.full_foundation_snapshot_payload_included
      || snapshot.safety.full_foundation_snapshot_payload_included
      || snapshot.sourceExportDigest.full_foundation_snapshot_payload_included
      || Object.prototype.hasOwnProperty.call(snapshot, 'foundationSnapshot')
    );

    return (
      snapshot.omittedPayloads.includes('foundationSnapshot')
      && snapshot.sourceExportDigest.omitted_payloads.includes('foundationSnapshot')
      && !fullPayloadIncluded
    );
  }

  private snapshotSafetyValue(
    snapshot: AdsFoundationReviewerDocsLocalSnapshot,
    key: AdsFoundationReviewerDocsLocalSnapshotSafetyKey,
  ): boolean {
    const topLevel = snapshot as unknown as Record<string, unknown>;
    return snapshot.safety[key] === true || topLevel[key] === true;
  }

  private numberValue(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private stringList(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => this.text(item)).filter(Boolean)
      : [];
  }

  private orderedUnique(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      if (seen.has(value)) continue;
      seen.add(value);
      result.push(value);
    }

    return result;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }
}
