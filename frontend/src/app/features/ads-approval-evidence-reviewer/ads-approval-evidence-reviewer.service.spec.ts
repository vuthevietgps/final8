import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AdsApprovalEvidenceReviewerDocsLocalSnapshot,
  AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync,
  AdsApprovalEvidenceReviewerService,
} from './ads-approval-evidence-reviewer.service';

describe('AdsApprovalEvidenceReviewerService', () => {
  let service: AdsApprovalEvidenceReviewerService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdsApprovalEvidenceReviewerService,
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AdsApprovalEvidenceReviewerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads reviewer docs through the read-only ai-data-pack approval route', () => {
    service.getReviewerDocs(' ADSAPPROVAL-review-fixture ', 'linked').subscribe();

    const request = http.expectOne((req) => (
      req.method === 'GET'
      && req.url === '/api/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs'
    ));

    expect(request.request.params.get('fixture')).toBe('linked');
    expect(request.request.body).toBeNull();
    request.flush({ schemaVersion: 'ads_automation_approval_evidence_reviewer_docs.v1' });
  });

  it('omits fixture query params for repository readback mode', () => {
    service.getReviewerDocs('ADSAPPROVAL/with space 1').subscribe();

    const request = http.expectOne((req) => (
      req.method === 'GET'
      && req.url === '/api/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL%2Fwith%20space%201/evidence-index/reviewer-docs'
    ));

    expect(request.request.params.has('fixture')).toBeFalse();
    request.flush({ schemaVersion: 'ads_automation_approval_evidence_reviewer_docs.v1' });
  });

  it('compares source-sync gate status, blocked count, blockers, and source keys locally', () => {
    const left = localSnapshot({
      gate_status: 'blocked',
      blocked_sources_rendered: 1,
      blocking_reasons: [
        'google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001',
      ],
      source_keys: [
        'google_ads:campaign_budget:HTX-BG-BUDGET-001',
        'erp:ads_decision_read_model:daily',
      ],
    });
    const right = localSnapshot({
      gate_status: 'ready',
      blocked_sources_rendered: 0,
      blocking_reasons: [],
      source_keys: [
        'google_ads:campaign_budget:HTX-BG-BUDGET-002',
        'erp:ads_decision_read_model:daily',
      ],
    });

    const compare = service.compareLocalSnapshots(left, right);

    expect(compare.sourceSyncDelta.changed).toBeTrue();
    expect(compare.sourceSyncDelta.gateStatus).toEqual({
      leftValue: 'blocked',
      rightValue: 'ready',
      changed: true,
    });
    expect(compare.sourceSyncDelta.blockedSources).toEqual({
      leftValue: 1,
      rightValue: 0,
      delta: -1,
      changed: true,
    });
    expect(compare.sourceSyncDelta.blockingReasons.removed).toEqual([
      'google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001',
    ]);
    expect(compare.sourceSyncDelta.blockingReasons.added).toEqual([]);
    expect(compare.sourceSyncDelta.sourceKeys.removed).toEqual([
      'google_ads:campaign_budget:HTX-BG-BUDGET-001',
    ]);
    expect(compare.sourceSyncDelta.sourceKeys.added).toEqual([
      'google_ads:campaign_budget:HTX-BG-BUDGET-002',
    ]);
  });

  it('builds a local-only compare audit export with source-sync, safety, metric deltas, and comparison keys', () => {
    const left = localSnapshot({
      gate_status: 'blocked',
      blocked_sources_rendered: 1,
      blocking_reasons: [
        'google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001',
      ],
      source_keys: [
        'google_ads:campaign_budget:HTX-BG-BUDGET-001',
        'erp:ads_decision_read_model:daily',
      ],
    });
    const right = localSnapshot({
      gate_status: 'ready',
      blocked_sources_rendered: 0,
      blocking_reasons: [],
      source_keys: [
        'google_ads:campaign_budget:HTX-BG-BUDGET-002',
        'erp:ads_decision_read_model:daily',
      ],
    });
    const compare = service.compareLocalSnapshots(left, right);

    const auditExport = service.buildLocalSnapshotCompareAuditExport(
      compare,
      '2026-07-05T08:30:00.000Z',
    );

    expect(auditExport.schemaVersion).toBe(
      'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    );
    expect(auditExport.exportMode).toBe('browser_local_compare_audit_handoff');
    expect(auditExport.generatedAt).toBe('2026-07-05T08:30:00.000Z');
    expect(auditExport.compareSchemaVersion).toBe(compare.schemaVersion);
    expect(auditExport.leftComparisonKey).toBe(compare.leftComparisonKey);
    expect(auditExport.rightComparisonKey).toBe(compare.rightComparisonKey);
    expect(auditExport.sameComparisonKey).toBeFalse();
    expect(auditExport.metricDeltas).toEqual(compare.metricDeltas);
    expect(auditExport.safetyDeltas).toEqual(compare.safetyDeltas);
    expect(auditExport.sourceSyncDelta).toEqual(compare.sourceSyncDelta);
    expect(auditExport.sourceSyncDelta.sourceKeys.added).toEqual([
      'google_ads:campaign_budget:HTX-BG-BUDGET-002',
    ]);
    expect(auditExport.omittedPayloads).toEqual([
      'leftSnapshot',
      'rightSnapshot',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(auditExport.local_only).toBeTrue();
    expect(auditExport.provider_api_called).toBeFalse();
    expect(auditExport.google_ads_api_called).toBeFalse();
    expect(auditExport.validateOnly_called).toBeFalse();
    expect(auditExport.live_ads_execution_used).toBeFalse();
    expect(auditExport.execution_allowed_now).toBeFalse();
    expect(auditExport.production_ready).toBeFalse();
  });

  it('parses a local-only compare audit export for readback without needing original snapshots', () => {
    const left = localSnapshot({
      gate_status: 'blocked',
      blocked_sources_rendered: 1,
      blocking_reasons: [
        'google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001',
      ],
      source_keys: [
        'google_ads:campaign_budget:HTX-BG-BUDGET-001',
        'erp:ads_decision_read_model:daily',
      ],
    });
    const right = localSnapshot({
      gate_status: 'ready',
      blocked_sources_rendered: 0,
      blocking_reasons: [],
      source_keys: [
        'google_ads:campaign_budget:HTX-BG-BUDGET-002',
        'erp:ads_decision_read_model:daily',
      ],
    });
    const compare = service.compareLocalSnapshots(left, right);
    const auditExport = service.buildLocalSnapshotCompareAuditExport(
      compare,
      '2026-07-05T09:00:00.000Z',
    );

    const parsed = service.parseLocalSnapshotCompareAuditJson(JSON.stringify(auditExport));

    expect(parsed.error).toBeNull();
    expect(parsed.audit).toEqual(auditExport);
    expect(parsed.audit?.sourceSyncDelta.gateStatus).toEqual({
      leftValue: 'blocked',
      rightValue: 'ready',
      changed: true,
    });
    expect(parsed.audit?.sourceSyncDelta.sourceKeys.added).toEqual([
      'google_ads:campaign_budget:HTX-BG-BUDGET-002',
    ]);
    expect(Object.prototype.hasOwnProperty.call(parsed.audit!, 'leftSnapshot')).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(parsed.audit!, 'rightSnapshot')).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(parsed.audit!, 'providerRawPayload')).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(parsed.audit!, 'liveExecutionPayload')).toBeFalse();
    expect(parsed.audit?.provider_api_called).toBeFalse();
    expect(parsed.audit?.google_ads_api_called).toBeFalse();
    expect(parsed.audit?.live_ads_execution_used).toBeFalse();
    expect(parsed.audit?.execution_allowed_now).toBeFalse();
  });

  it('rejects compare audit readback JSON that embeds snapshots or provider/live payloads', () => {
    const compare = service.compareLocalSnapshots(
      localSnapshot({ gate_status: 'blocked' }),
      localSnapshot({ gate_status: 'ready' }),
    );
    const auditExport = service.buildLocalSnapshotCompareAuditExport(compare);

    expect(
      service.parseLocalSnapshotCompareAuditJson(JSON.stringify({
        ...auditExport,
        leftSnapshot: localSnapshot({ gate_status: 'blocked' }),
      })).error,
    ).toBe('Compare audit JSON contains forbidden payload field: leftSnapshot');

    expect(
      service.parseLocalSnapshotCompareAuditJson(JSON.stringify({
        ...auditExport,
        metricDeltas: [
          {
            ...auditExport.metricDeltas[0],
            providerRawPayload: { api_response: 'not allowed' },
          },
        ],
      })).error,
    ).toBe('Compare audit JSON contains forbidden payload field: providerRawPayload');

    expect(
      service.parseLocalSnapshotCompareAuditJson(JSON.stringify({
        ...auditExport,
        liveExecutionPayload: { operation: 'mutate_campaign_budget' },
      })).error,
    ).toBe('Compare audit JSON contains forbidden payload field: liveExecutionPayload');
  });

  it('rejects compare audit readback JSON with provider or live execution safety gates open', () => {
    const compare = service.compareLocalSnapshots(
      localSnapshot({ gate_status: 'blocked' }),
      localSnapshot({ gate_status: 'ready' }),
    );
    const auditExport = service.buildLocalSnapshotCompareAuditExport(compare);

    expect(
      service.parseLocalSnapshotCompareAuditJson(JSON.stringify({
        ...auditExport,
        provider_api_called: true,
      })).error,
    ).toBe('Compare audit safety field provider_api_called must be false');

    expect(
      service.parseLocalSnapshotCompareAuditJson(JSON.stringify({
        ...auditExport,
        execution_allowed_now: true,
      })).error,
    ).toBe('Compare audit safety field execution_allowed_now must be false');
  });
});

function localSnapshot(
  sourceSyncPatch: Partial<AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync>,
): AdsApprovalEvidenceReviewerDocsLocalSnapshot {
  const sourceSync: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSync = {
    pending_approval_record_rendered: true,
    gate_status: 'not_available',
    decision_evidence_records_rendered: 2,
    blocked_sources_rendered: 0,
    can_generate_action_draft: null,
    can_use_google_ads_data_claim: null,
    blocking_reasons: [],
    source_keys: [],
    ...sourceSyncPatch,
  };

  return {
    schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot.v1',
    snapshotMode: 'local_browser_download',
    createdFromEndpoint: '/api/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs',
    createdFromDocsGeneratedAt: '2026-07-04T06:20:00.000Z',
    comparisonKey: [
      'ads_automation_approval_evidence_reviewer_docs.v1',
      'local_demo_fixture_docs',
      sourceSync.gate_status,
      sourceSync.blocked_sources_rendered,
      sourceSync.blocking_reasons.join(',') || 'none',
      sourceSync.source_keys.join(',') || 'none',
    ].join('|'),
    docsSchemaVersion: 'ads_automation_approval_evidence_reviewer_docs.v1',
    docsMode: 'local_demo_fixture_docs',
    query: {
      approval_id: 'ADSAPPROVAL-review-fixture',
      fixture: 'linked_budget_update_evidence',
    },
    safety: {
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      live_path_implemented: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      reviewer_docs_persistence_performed: false,
      reviewer_export_persistence_performed: false,
    },
    summary: {
      docs_status: 'ready_for_review',
      docs_mode: 'local_demo_fixture_docs',
      source_export_mode: 'local_demo_fixture',
      export_status: 'ready_for_review',
      total_evidence_records_rendered: 5,
      validateOnly_evidence_records_rendered: 1,
      policy_decision_records_rendered: 1,
      execution_preflight_records_rendered: 1,
      pending_approval_record_rendered: true,
      source_sync_decision_evidence_records_rendered: sourceSync.decision_evidence_records_rendered,
      source_sync_decision_blocked_sources_rendered: sourceSync.blocked_sources_rendered,
      source_sync_gate_status: sourceSync.gate_status,
      source_sync_can_generate_action_draft: sourceSync.can_generate_action_draft,
      source_sync_can_use_google_ads_data_claim: sourceSync.can_use_google_ads_data_claim,
      source_sync_blocking_reasons_rendered: [...sourceSync.blocking_reasons],
      linked_validateOnly_evidence_records: 1,
      linked_policy_decision_records: 1,
      route_examples_rendered: 2,
      sections_rendered: 5,
      approval_required: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      live_path_implemented: false,
      reviewer_docs_persistence_performed: false,
      reviewer_export_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      next_required_action: 'inspect_reviewer_docs',
    },
    routeExamples: [],
    renderedSections: [],
    markdownPreview: '',
    source_sync: { ...sourceSync },
    reviewerExportDigest: {
      schemaVersion: 'ads_automation_approval_evidence_review_export.v1',
      exportMode: 'local_demo_fixture',
      fixture: null,
      evidence_links: {
        execution_record_ids: ['ADSEXEC-DRYRUN-review-fixture-REQ-PREFLIGHT'],
        validateOnly_validation_ids_from_preflight: ['ADSPROVIDERVALIDATE-review-fixture'],
        validateOnly_validation_ids_with_evidence: ['ADSPROVIDERVALIDATE-review-fixture'],
        validateOnly_validation_ids_missing_evidence: [],
        policy_decision_ids_from_preflight: ['ADSPOLICY-review-fixture-REQ-POLICY'],
        policy_decision_ids_with_evidence: ['ADSPOLICY-review-fixture-REQ-POLICY'],
        policy_decision_ids_missing_evidence: [],
      },
      source_sync: { ...sourceSync },
    },
    omittedPayloads: ['providerRawPayload', 'liveExecutionPayload'],
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    execution_allowed_now: false,
    production_ready: false,
  };
}
