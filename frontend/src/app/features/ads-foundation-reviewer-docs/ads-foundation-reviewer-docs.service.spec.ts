import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdsFoundationReviewerDocsService } from './ads-foundation-reviewer-docs.service';
import {
  ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_SNAPSHOT_FILE_FIXTURE,
} from './ads-foundation-reviewer-docs.local-fixture';

describe('AdsFoundationReviewerDocsService', () => {
  let service: AdsFoundationReviewerDocsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdsFoundationReviewerDocsService,
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AdsFoundationReviewerDocsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('posts the local read-model query to the protected foundation reviewer docs endpoint', () => {
    service.loadReviewerDocs({
      snapshotDate: ' 2026-07-04 ',
      evidenceWindow: { from: ' 2026-06-21 ', to: ' 2026-07-04 ', days: 14 },
      customerIds: [' 1234567890 ', ''],
      productIds: [' P_SCALE '],
      maxAgeHours: { campaign_budgets: 24, product_performance: 24 },
      now: ' 2026-07-04T05:00:00.000Z ',
    }).subscribe();

    const request = http.expectOne((req) => (
      req.method === 'POST'
      && req.url === '/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs'
    ));

    expect(request.request.body).toEqual({
      snapshotDate: '2026-07-04',
      evidenceWindow: { from: '2026-06-21', to: '2026-07-04', days: 14 },
      customerIds: ['1234567890'],
      productIds: ['P_SCALE'],
      maxAgeHours: { campaign_budgets: 24, product_performance: 24 },
      now: '2026-07-04T05:00:00.000Z',
    });
    expect(JSON.stringify(request.request.body)).not.toContain('validateOnly');
    request.flush({ schemaVersion: 'ads_automation_decision_foundation_read_model_reviewer_docs.v1' });
  });

  it('omits empty lists and non-positive max-age values from the POST body', () => {
    service.loadReviewerDocs({
      snapshotDate: '',
      customerIds: ['', '1234567890'],
      accountIds: [],
      productIds: [''],
      maxAgeHours: { campaign_budgets: 0, product_performance: 12 },
    }).subscribe();

    const request = http.expectOne('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      customerIds: ['1234567890'],
      maxAgeHours: { product_performance: 12 },
    });
    request.flush({ schemaVersion: 'ads_automation_decision_foundation_read_model_reviewer_docs.v1' });
  });

  it('builds a local snapshot export with closed safety gates and no full foundationSnapshot payload', () => {
    const snapshot = service.buildLocalSnapshot(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);

    expect(snapshot.schemaVersion).toBe('ads_foundation_reviewer_docs_local_snapshot.v1');
    expect(snapshot.snapshotMode).toBe('local_browser_download');
    expect(snapshot.createdFromEndpoint).toBe('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
    expect(snapshot.provider_api_called).toBeFalse();
    expect(snapshot.google_ads_api_called).toBeFalse();
    expect(snapshot.validateOnly_called).toBeFalse();
    expect(snapshot.execution_allowed_now).toBeFalse();
    expect(snapshot.production_ready).toBeFalse();
    expect(snapshot.campaignBudgetId_fallback_used).toBeFalse();
    expect(snapshot.full_foundation_snapshot_payload_included).toBeFalse();
    expect(snapshot.safety.reviewer_docs_persistence_performed).toBeFalse();
    expect(snapshot.safety.reviewer_export_persistence_performed).toBeFalse();
    expect(snapshot.query).not.toBe(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE.query);
    expect(snapshot.renderedSections[0].lines).not.toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE.renderedSections[0].lines,
    );
    expect(snapshot.omittedPayloads).toEqual(['foundationSnapshot']);
    expect(snapshot.sourceExportDigest.omitted_payloads).toEqual(['foundationSnapshot']);
    expect((snapshot as unknown as { foundationSnapshot?: unknown }).foundationSnapshot).toBeUndefined();
    expect(snapshot.comparisonKey).toContain('provider_api_called=false');
    expect(snapshot.comparisonKey).toContain('full_foundation_snapshot_payload_included=false');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('parses only local reviewer-docs snapshot JSON payloads', () => {
    const snapshot = service.buildLocalSnapshot(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    const parsed = service.parseLocalSnapshotJson(JSON.stringify(snapshot));

    expect(parsed.error).toBeNull();
    expect(parsed.snapshot?.schemaVersion).toBe('ads_foundation_reviewer_docs_local_snapshot.v1');
    expect(parsed.snapshot?.snapshotMode).toBe('local_browser_download');
    expect(parsed.snapshot?.omittedPayloads).toEqual(['foundationSnapshot']);
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects invalid snapshot JSON before compare', () => {
    const malformed = service.parseLocalSnapshotJson('{not-json');
    const wrongSchema = service.parseLocalSnapshotJson(JSON.stringify({
      schemaVersion: 'ads_automation_decision_foundation_read_model_reviewer_docs.v1',
      snapshotMode: 'local_browser_download',
    }));
    const unsafePayload = service.parseLocalSnapshotJson(JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_SNAPSHOT_FILE_FIXTURE,
    ));

    expect(malformed.snapshot).toBeNull();
    expect(malformed.error).toBe('Snapshot JSON is not valid JSON');
    expect(wrongSchema.snapshot).toBeNull();
    expect(wrongSchema.error).toBe(
      'Snapshot schemaVersion must be ads_foundation_reviewer_docs_local_snapshot.v1',
    );
    expect(unsafePayload.snapshot).toBeNull();
    expect(unsafePayload.error).toBe('Snapshot JSON must not include foundationSnapshot payload');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('parses only local compare-result export JSON payloads', () => {
    const right = service.buildLocalSnapshot(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    const left = {
      ...right,
      comparisonKey: 'baseline-with-full-foundation-payload',
      safety: {
        ...right.safety,
        full_foundation_snapshot_payload_included: true,
      },
      sourceExportDigest: {
        ...right.sourceExportDigest,
        omitted_payloads: [] as unknown as ['foundationSnapshot'],
        full_foundation_snapshot_payload_included: true,
      },
      omittedPayloads: [] as unknown as ['foundationSnapshot'],
      full_foundation_snapshot_payload_included: true,
      foundationSnapshot: { redacted: false },
    };
    const compare = service.compareLocalSnapshots(left, right);
    const parsed = service.parseLocalSnapshotCompareJson(JSON.stringify(compare));

    expect(parsed.error).toBeNull();
    expect(parsed.compare?.schemaVersion).toBe('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(parsed.compare?.foundationSnapshotOmissionDelta).toEqual({
      leftOmitted: false,
      rightOmitted: true,
      changed: true,
    });
    expect((parsed.compare as unknown as { foundationSnapshot?: unknown })?.foundationSnapshot).toBeUndefined();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects empty, malformed, wrong-schema, and unsafe compare-result JSON before readback', () => {
    const empty = service.parseLocalSnapshotCompareJson('');
    const malformed = service.parseLocalSnapshotCompareJson('{not-json');
    const wrongSchema = service.parseLocalSnapshotCompareJson(JSON.stringify({
      schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot.v1',
    }));
    const missingOmissionDelta = service.parseLocalSnapshotCompareJson(JSON.stringify({
      schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
      leftComparisonKey: 'left',
      rightComparisonKey: 'right',
      sameComparisonKey: false,
      metricDeltas: [],
      safetyDeltas: [],
      attentionSectionDeltas: [],
      campaignBudgetIdFallbackDelta: {},
    }));
    const unsafePayload = service.parseLocalSnapshotCompareJson(JSON.stringify({
      schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
      leftComparisonKey: 'left',
      rightComparisonKey: 'right',
      sameComparisonKey: false,
      metricDeltas: [],
      safetyDeltas: [],
      attentionSectionDeltas: [],
      campaignBudgetIdFallbackDelta: {},
      foundationSnapshotOmissionDelta: { leftOmitted: true, rightOmitted: true, changed: false },
      foundationSnapshot: { redacted: false },
    }));

    expect(empty.error).toBe('Compare JSON is required');
    expect(malformed.error).toBe('Compare JSON is not valid JSON');
    expect(wrongSchema.error).toBe(
      'Compare schemaVersion must be ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(missingOmissionDelta.error).toBe('Compare JSON is missing foundationSnapshotOmissionDelta');
    expect(unsafePayload.error).toBe('Compare JSON must not include foundationSnapshot payload');
    expect(empty.compare).toBeNull();
    expect(malformed.compare).toBeNull();
    expect(wrongSchema.compare).toBeNull();
    expect(missingOmissionDelta.compare).toBeNull();
    expect(unsafePayload.compare).toBeNull();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('compares safety, attention, missing evidence, campaign budget fallback, and omission deltas locally', () => {
    const right = service.buildLocalSnapshot(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    const left = {
      ...right,
      comparisonKey: 'baseline-with-open-provider-and-full-foundation-payload',
      safety: {
        ...right.safety,
        provider_api_called: true,
        full_foundation_snapshot_payload_included: true,
      },
      summary: {
        ...right.summary,
        attention_sections: 5,
        attention_section_ids: [
          ...right.summary.attention_section_ids,
          'provider_safety',
        ],
        stale_source_evidence_records: 2,
        missing_query_evidence_records: 2,
        campaignBudgetId_fallback_used: true,
        full_foundation_snapshot_payload_included: true,
      },
      renderedSections: [
        ...right.renderedSections,
        {
          section_id: 'provider_safety',
          title: 'Provider Safety',
          status: 'attention' as const,
          lines: ['provider_api_called=true'],
          evidence_record_ids: [],
        },
      ],
      sourceExportDigest: {
        ...right.sourceExportDigest,
        omitted_payloads: [] as unknown as ['foundationSnapshot'],
        full_foundation_snapshot_payload_included: true,
      },
      omittedPayloads: [] as unknown as ['foundationSnapshot'],
      provider_api_called: true,
      campaignBudgetId_fallback_used: true,
      full_foundation_snapshot_payload_included: true,
      foundationSnapshot: { redacted: false },
    };

    const compare = service.compareLocalSnapshots(left, right);
    const providerDelta = compare.safetyDeltas.find((delta) => (
      delta.key === 'provider_api_called'
    ));
    const missingQueryDelta = compare.metricDeltas.find((delta) => (
      delta.key === 'missing_query_evidence_records'
    ));

    expect(compare.sameComparisonKey).toBeFalse();
    expect(providerDelta?.leftValue).toBeTrue();
    expect(providerDelta?.rightValue).toBeFalse();
    expect(providerDelta?.rightGateClosed).toBeTrue();
    expect(missingQueryDelta?.delta).toBe(-1);
    expect(compare.campaignBudgetIdFallbackDelta.leftValue).toBeTrue();
    expect(compare.campaignBudgetIdFallbackDelta.rightValue).toBeFalse();
    expect(compare.attentionSectionDeltas.find((delta) => (
      delta.section_id === 'provider_safety'
    ))?.rightStatus).toBe('missing');
    expect(compare.foundationSnapshotOmissionDelta.leftOmitted).toBeFalse();
    expect(compare.foundationSnapshotOmissionDelta.rightOmitted).toBeTrue();
    expect(compare.foundationSnapshotOmissionDelta.changed).toBeTrue();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });
});
