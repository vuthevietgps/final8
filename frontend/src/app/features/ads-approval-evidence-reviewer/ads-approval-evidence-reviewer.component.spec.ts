import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { ReplaySubject } from 'rxjs';
import { AdsApprovalEvidenceReviewerComponent } from './ads-approval-evidence-reviewer.component';
import {
  ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
} from '../ads-platform-source-sync-status-reviewer/ads-approval-source-sync-handoff-prefill.util';
import {
  AdsApprovalEvidenceReviewerDocsLocalSnapshot,
  AdsApprovalEvidenceReviewerDocsResponse,
} from './ads-approval-evidence-reviewer.service';

describe('AdsApprovalEvidenceReviewerComponent', () => {
  let fixture: ComponentFixture<AdsApprovalEvidenceReviewerComponent>;
  let component: AdsApprovalEvidenceReviewerComponent;
  let http: HttpTestingController;
  let queryParamMap: ReplaySubject<ParamMap>;

  beforeEach(async () => {
    queryParamMap = new ReplaySubject<ParamMap>(1);

    await TestBed.configureTestingModule({
      imports: [AdsApprovalEvidenceReviewerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamMap.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdsApprovalEvidenceReviewerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY);
  });

  it('renders an initial empty state before loading reviewer docs', () => {
    fixture.detectChanges();

    expect(component.docs()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No reviewer docs loaded');
    expect(fixture.nativeElement.textContent).toContain('ADSAPPROVAL-review-fixture');
  });

  it('prefills approval id and fixture from reviewer route query params without fetching docs', () => {
    queryParamMap.next(convertToParamMap({
      approval_id: ' ADSAPPROVAL-from-queue-001 ',
      fixture: 'linked',
    }));
    fixture.detectChanges();

    expect(component.approvalId).toBe('ADSAPPROVAL-from-queue-001');
    expect(component.fixture).toBe('linked');
    http.expectNone((request) => request.url.includes('/evidence-index/reviewer-docs'));
  });

  it('loads the linked local fixture and renders summary, gates, ids, checklist, and markdown', () => {
    fixture.detectChanges();

    component.loadLinkedFixture();

    const request = http.expectOne((req) => (
      req.method === 'GET'
      && req.url === '/api/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs'
    ));
    expect(request.request.params.get('fixture')).toBe('linked');
    request.flush(reviewerDocsFixture('ready_for_review'));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.docs()?.docsMode).toBe('local_demo_fixture_docs');
    expect(component.safetyGates().every((gate) => gate.pass)).toBeTrue();
    expect(text).toContain('ready_for_review');
    expect(text).toContain('ADSEXEC-DRYRUN-review-fixture-REQ-PREFLIGHT');
    expect(text).toContain('ADSPROVIDERVALIDATE-review-fixture');
    expect(text).toContain('ADSPOLICY-review-fixture-REQ-POLICY');
    expect(text).toContain('Confirm query.approval_id matches the approval under review.');
    expect(text).toContain('Safety gates: execution_allowed_now=false');
    expect(text).toContain('Source-sync gate');
    expect(text).toContain('blocked');
    expect(text).toContain('google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001');
    expect(text).toContain('google_ads:campaign_budget:HTX-BG-BUDGET-001');
  });

  it('renders a source-sync status deeplink from loaded approval evidence docs without fetching status', () => {
    fixture.detectChanges();

    component.loadLinkedFixture();

    const request = http.expectOne((req) => (
      req.method === 'GET'
      && req.url === '/api/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs'
    ));
    request.flush(reviewerDocsFixture('ready_for_review'));
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.source-sync-status-link') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.textContent?.trim()).toBe('Review source status');
    expectSourceSyncHref(link?.getAttribute('href') || null, {
      reportDate: '2026-07-04',
      sourceKeys: 'google_ads',
      now: '2026-07-04T06:20:00.000Z',
    });
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('loads the empty local fixture and renders no-linked-evidence state', () => {
    fixture.detectChanges();

    component.loadEmptyFixture();

    const request = http.expectOne((req) => (
      req.method === 'GET'
      && req.url === '/api/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs'
    ));
    expect(request.request.params.get('fixture')).toBe('empty');
    request.flush(reviewerDocsFixture('empty'));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.docs()?.summary.total_evidence_records_rendered).toBe(0);
    expect(component.summaryCards().find((card) => card.label === 'Evidence records')?.value).toBe('0');
    expect(component.linkedEvidenceIds()).toEqual([]);
    expect(text).toContain('No linked evidence ids');
    expect(text).toContain('No source-sync blockers');
    expect(text).toContain('verify_approval_id_or_generate_preflight_evidence');
  });

  it('renders local source-sync compare deltas for gate, blockers, and source keys', () => {
    fixture.detectChanges();

    component.docs.set(reviewerDocsFixture('ready_for_review'));
    fixture.detectChanges();

    const blockedSnapshot = component.localSnapshot();
    expect(blockedSnapshot).toBeTruthy();

    const readySnapshot = sourceSyncReadySnapshot(blockedSnapshot!);
    component.leftSnapshotText = JSON.stringify(blockedSnapshot, null, 2);
    component.rightSnapshotText = JSON.stringify(readySnapshot, null, 2);

    component.compareSnapshots();
    fixture.detectChanges();

    const compare = component.compareResult();
    expect(compare?.sourceSyncDelta.gateStatus).toEqual({
      leftValue: 'blocked',
      rightValue: 'ready',
      changed: true,
    });
    expect(compare?.sourceSyncDelta.blockingReasons.removed).toEqual([
      'google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001',
    ]);
    expect(compare?.sourceSyncDelta.sourceKeys.added).toEqual([
      'google_ads:campaign_budget:HTX-BG-BUDGET-002',
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Source-sync deltas');
    expect(text).toContain('Gate status');
    expect(text).toContain('Blocked source count');
    expect(text).toContain('Blocker text');
    expect(text).toContain('Source keys');
    expect(text).toContain('Removed');
    expect(text).toContain('Added');
    expect(text).toContain('google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001');
    expect(text).toContain('google_ads:campaign_budget:HTX-BG-BUDGET-002');
  });

  it('exports and copies local compare audit JSON for reviewer handoff', async () => {
    fixture.detectChanges();

    component.docs.set(reviewerDocsFixture('ready_for_review'));
    fixture.detectChanges();

    const blockedSnapshot = component.localSnapshot();
    expect(blockedSnapshot).toBeTruthy();

    const readySnapshot = sourceSyncReadySnapshot(blockedSnapshot!);
    component.leftSnapshotText = JSON.stringify(blockedSnapshot, null, 2);
    component.rightSnapshotText = JSON.stringify(readySnapshot, null, 2);
    component.compareSnapshots();
    fixture.detectChanges();

    const compare = component.compareResult();
    expect(compare).toBeTruthy();

    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake(
      (value: Blob | MediaSource) => {
        exportedBlobs.push(value as Blob);
        return 'blob:ads-approval-evidence-compare-audit';
      },
    );
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    component.downloadCompareAuditJson();
    fixture.detectChanges();

    const expectedFilename = 'ads-approval-evidence-reviewer-compare-ADSAPPROVAL-review-fixture.json';
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:ads-approval-evidence-compare-audit');
    expect(component.lastCompareExportName()).toBe(expectedFilename);
    expect(fixture.nativeElement.textContent).toContain(expectedFilename);

    const exported = JSON.parse(await exportedBlobs[0].text());
    expect(exported.schemaVersion).toBe(
      'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    );
    expect(exported.exportMode).toBe('browser_local_compare_audit_handoff');
    expect(exported.compareSchemaVersion).toBe(compare!.schemaVersion);
    expect(exported.leftComparisonKey).toBe(compare!.leftComparisonKey);
    expect(exported.rightComparisonKey).toBe(compare!.rightComparisonKey);
    expect(exported.metricDeltas).toEqual(compare!.metricDeltas);
    expect(exported.safetyDeltas).toEqual(compare!.safetyDeltas);
    expect(exported.sourceSyncDelta).toEqual(compare!.sourceSyncDelta);
    expect(exported.omittedPayloads).toEqual([
      'leftSnapshot',
      'rightSnapshot',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(exported.provider_api_called).toBeFalse();
    expect(exported.google_ads_api_called).toBeFalse();
    expect(exported.validateOnly_called).toBeFalse();
    expect(exported.live_ads_execution_used).toBeFalse();
    expect(exported.execution_allowed_now).toBeFalse();
    expect(exported.production_ready).toBeFalse();
    expect(JSON.stringify(exported)).toContain('google_ads:campaign_budget:HTX-BG-BUDGET-002');

    const originalClipboard = navigator.clipboard;
    const clipboard = {
      writeText: jasmine.createSpy('writeText').and.returnValue(Promise.resolve()),
    };

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });

    try {
      component.copyCompareAuditJson();
      await fixture.whenStable();
      await Promise.resolve();
      fixture.detectChanges();

      expect(clipboard.writeText).toHaveBeenCalledTimes(1);
      const copied = JSON.parse(clipboard.writeText.calls.mostRecent().args[0] as string);
      expect(copied.schemaVersion).toBe(exported.schemaVersion);
      expect(copied.leftComparisonKey).toBe(compare!.leftComparisonKey);
      expect(copied.sourceSyncDelta).toEqual(compare!.sourceSyncDelta);
      expect(component.lastCompareCopyStatus()).toBe('Compare audit JSON copied');
      expect(fixture.nativeElement.textContent).toContain('Compare audit JSON copied');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('stages a sanitized browser-local source-sync handoff prefill from compare audit readback', () => {
    fixture.detectChanges();

    component.docs.set(reviewerDocsFixture('ready_for_review'));
    fixture.detectChanges();

    const blockedSnapshot = component.localSnapshot();
    expect(blockedSnapshot).toBeTruthy();

    const readySnapshot = sourceSyncReadySnapshot(blockedSnapshot!);
    component.leftSnapshotText = JSON.stringify(blockedSnapshot, null, 2);
    component.rightSnapshotText = JSON.stringify(readySnapshot, null, 2);
    component.compareSnapshots();
    component.useCurrentCompareAuditForReadback();
    component.compareResult.set(null);
    fixture.detectChanges();

    component.stageSourceSyncHandoffPrefill();
    fixture.detectChanges();

    const raw = localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const bundle = JSON.parse(raw || '{}');
    const approvalAudit = JSON.parse(bundle.approvalCompareAuditJson);
    const text = fixture.nativeElement.textContent;

    expect(component.sourceSyncHandoffError()).toBeNull();
    expect(component.sourceSyncHandoffStatus()).toContain('Source-sync handoff staged from');
    expect(text).toContain('Source-sync handoff staged from');
    expect(bundle.schemaVersion).toBe('ads_approval_to_source_sync_status_handoff_prefill.v1');
    expect(bundle.source).toBe('ads_approval_evidence_reviewer');
    expect(bundle.local_only).toBeTrue();
    expect(bundle.provider_api_called).toBeFalse();
    expect(bundle.google_ads_api_called).toBeFalse();
    expect(bundle.validateOnly_called).toBeFalse();
    expect(bundle.live_ads_execution_used).toBeFalse();
    expect(bundle.execution_allowed_now).toBeFalse();
    expect(bundle.production_ready).toBeFalse();
    expect(bundle.omittedPayloads).toEqual([
      'leftSnapshot',
      'rightSnapshot',
      'plaintextSecretValues',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(approvalAudit.schemaVersion).toBe(
      'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    );
    expect(approvalAudit.sourceSyncDelta.sourceKeys.added).toEqual([
      'google_ads:campaign_budget:HTX-BG-BUDGET-002',
    ]);
    expect(raw).not.toContain('"providerRawPayload":');
    expect(raw).not.toContain('"liveExecutionPayload":');
    expect(raw).not.toContain('FORBIDDEN_PROVIDER_VALUE');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('imports local compare audit JSON and renders readback deltas while rejecting provider payloads', () => {
    fixture.detectChanges();

    component.docs.set(reviewerDocsFixture('ready_for_review'));
    fixture.detectChanges();

    const blockedSnapshot = component.localSnapshot();
    expect(blockedSnapshot).toBeTruthy();

    const readySnapshot = sourceSyncReadySnapshot(blockedSnapshot!);
    component.leftSnapshotText = JSON.stringify(blockedSnapshot, null, 2);
    component.rightSnapshotText = JSON.stringify(readySnapshot, null, 2);
    component.compareSnapshots();
    fixture.detectChanges();

    component.useCurrentCompareAuditForReadback();
    fixture.detectChanges();

    const audit = component.compareAuditReadback();
    expect(audit).toBeTruthy();
    expect(component.compareAuditReadbackError()).toBeNull();
    expect(component.compareAuditText).toContain(
      'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    );
    expect(audit?.sourceSyncDelta.gateStatus.rightValue).toBe('ready');
    expect(audit?.sourceSyncDelta.sourceKeys.added).toEqual([
      'google_ads:campaign_budget:HTX-BG-BUDGET-002',
    ]);
    expect(audit?.provider_api_called).toBeFalse();
    expect(audit?.google_ads_api_called).toBeFalse();
    expect(audit?.live_ads_execution_used).toBeFalse();
    expect(audit?.execution_allowed_now).toBeFalse();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Compare audit readback');
    expect(text).toContain('Saved JSON import');
    expect(text).toContain('Readback source-sync');
    expect(text).toContain('ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1');
    expect(text).toContain('google_ads:campaign_budget:HTX-BG-BUDGET-002');

    component.compareAuditText = JSON.stringify({
      ...audit,
      providerRawPayload: { customer_id: 'not-local' },
    });
    component.readCompareAuditJson();
    fixture.detectChanges();

    expect(component.compareAuditReadback()).toBeNull();
    expect(component.compareAuditReadbackError()).toBe(
      'Compare audit JSON contains forbidden payload field: providerRawPayload',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Compare audit JSON contains forbidden payload field: providerRawPayload',
    );
  });
});

function expectSourceSyncHref(
  href: string | null,
  expected: { reportDate: string; sourceKeys: string; now: string },
): void {
  expect(href).toContain('/ai/ads-platform-source-sync-status-reviewer?');
  const url = new URL(href || '', 'http://localhost');
  expect(url.pathname).toBe('/ai/ads-platform-source-sync-status-reviewer');
  expect(url.searchParams.get('reportDate')).toBe(expected.reportDate);
  expect(url.searchParams.get('sourceKeys')).toBe(expected.sourceKeys);
  expect(url.searchParams.get('now')).toBe(expected.now);
}

function sourceSyncReadySnapshot(
  snapshot: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
): AdsApprovalEvidenceReviewerDocsLocalSnapshot {
  const next = JSON.parse(JSON.stringify(snapshot)) as AdsApprovalEvidenceReviewerDocsLocalSnapshot;
  const sourceSync = {
    ...next.source_sync,
    gate_status: 'ready' as const,
    blocked_sources_rendered: 0,
    can_generate_action_draft: true,
    can_use_google_ads_data_claim: true,
    blocking_reasons: [],
    source_keys: [
      'google_ads:campaign_budget:HTX-BG-BUDGET-002',
      'erp:ads_decision_read_model:daily',
    ],
  };

  next.comparisonKey = [
    next.comparisonKey,
    'source_sync_gate=ready',
    'source_sync_blocked=0',
    'source_sync_source_keys=google_ads:campaign_budget:HTX-BG-BUDGET-002,erp:ads_decision_read_model:daily',
  ].join('|');
  next.summary = {
    ...next.summary,
    source_sync_gate_status: 'ready',
    source_sync_decision_blocked_sources_rendered: 0,
    source_sync_can_generate_action_draft: true,
    source_sync_can_use_google_ads_data_claim: true,
    source_sync_blocking_reasons_rendered: [],
  };
  next.source_sync = sourceSync;
  next.reviewerExportDigest = {
    ...next.reviewerExportDigest,
    source_sync: { ...sourceSync },
  };

  return next;
}

function reviewerDocsFixture(
  docsStatus: 'empty' | 'ready_for_review',
): AdsApprovalEvidenceReviewerDocsResponse {
  const hasEvidence = docsStatus === 'ready_for_review';
  const approvalId = 'ADSAPPROVAL-review-fixture';
  const executionId = 'ADSEXEC-DRYRUN-review-fixture-REQ-PREFLIGHT';
  const validationId = 'ADSPROVIDERVALIDATE-review-fixture';
  const policyId = 'ADSPOLICY-review-fixture-REQ-POLICY';
  const sourceSyncSourceKey = 'google_ads:campaign_budget:HTX-BG-BUDGET-001';
  const sourceSyncBlocker = 'google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001';
  const fixtureScenario = hasEvidence ? 'linked_budget_update_evidence' : 'empty_approval_evidence';

  return {
    schemaVersion: 'ads_automation_approval_evidence_reviewer_docs.v1',
    generatedAt: '2026-07-04T06:20:00.000Z',
    docsMode: 'local_demo_fixture_docs',
    query: {
      approval_id: approvalId,
      fixture: fixtureScenario,
    },
    safety: {
      read_only: true,
      dry_run: true,
      local_only: true,
      in_memory_only: true,
      persistence_used: false,
      durable_storage_used: false,
      erp_local_persistence_used: false,
      provider_persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_records: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      live_path_implemented: false,
      provider_mutation_used: false,
      direct_google_ads_api_call: false,
      reviewer_export_readback: true,
      reviewer_export_persistence_performed: false,
      reviewer_docs_readback: true,
      reviewer_docs_persistence_performed: false,
      demo_fixture_used: true,
      demo_fixture_persistence_performed: false,
    },
    summary: {
      docs_status: docsStatus,
      docs_mode: 'local_demo_fixture_docs',
      source_export_mode: 'local_demo_fixture',
      export_status: docsStatus,
      total_evidence_records_rendered: hasEvidence ? 5 : 0,
      validateOnly_evidence_records_rendered: hasEvidence ? 1 : 0,
      policy_decision_records_rendered: hasEvidence ? 1 : 0,
      execution_preflight_records_rendered: hasEvidence ? 1 : 0,
      pending_approval_record_rendered: hasEvidence,
      source_sync_decision_evidence_records_rendered: hasEvidence ? 2 : 0,
      source_sync_decision_blocked_sources_rendered: hasEvidence ? 1 : 0,
      source_sync_gate_status: hasEvidence ? 'blocked' : 'not_available',
      source_sync_can_generate_action_draft: hasEvidence ? false : null,
      source_sync_can_use_google_ads_data_claim: hasEvidence ? false : null,
      source_sync_blocking_reasons_rendered: hasEvidence ? [sourceSyncBlocker] : [],
      linked_validateOnly_evidence_records: hasEvidence ? 1 : 0,
      linked_policy_decision_records: hasEvidence ? 1 : 0,
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
      next_required_action: hasEvidence
        ? 'inspect_reviewer_docs'
        : 'verify_approval_id_or_generate_preflight_evidence',
    },
    routeExamples: [
      {
        label: 'Reviewer docs',
        method: 'GET',
        path: `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-docs`,
        query: `fixture=${fixtureScenario}`,
        purpose: 'Render operator-facing approval evidence sections for one approval id.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
      {
        label: 'Reviewer export JSON',
        method: 'GET',
        path: `/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-export`,
        query: `fixture=${fixtureScenario}`,
        purpose: 'Inspect the complete machine-readable evidence export behind the docs view.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
    ],
    renderedSections: [
      {
        section_id: 'operator_summary',
        title: 'Operator Summary',
        status: docsStatus,
        lines: [
          `Approval ID: ${approvalId}`,
          'Export mode: local_demo_fixture',
          `Evidence records: ${hasEvidence ? 5 : 0}`,
          `Next action: ${hasEvidence ? 'inspect_reviewer_export' : 'verify_approval_id_or_generate_preflight_evidence'}`,
        ],
        evidence_record_ids: [],
      },
      {
        section_id: 'safety_gates',
        title: 'Safety Gates',
        status: 'passed',
        lines: [
          'future_live_execution_allowed=false',
          'execution_allowed_now=false',
          'live_path_implemented=false',
          'provider_api_called=false',
          'google_ads_api_called=false',
          'validateOnly_called=false',
          'live_ads_execution_used=false',
          'erp_mutation_used=false',
        ],
        evidence_record_ids: [],
      },
      {
        section_id: 'linked_evidence',
        title: 'Linked Evidence',
        status: docsStatus,
        lines: [
          `Execution records: ${hasEvidence ? executionId : 'none'}`,
          `Linked validate-only evidence: ${hasEvidence ? validationId : 'none'}`,
          'Missing validate-only evidence: none',
          `Linked policy decisions: ${hasEvidence ? policyId : 'none'}`,
          'Missing policy decisions: none',
        ],
        evidence_record_ids: hasEvidence ? [executionId, validationId, policyId] : [],
      },
      {
        section_id: 'source_sync_evidence',
        title: 'Source Sync Evidence',
        status: hasEvidence ? 'attention' : 'empty',
        lines: hasEvidence
          ? [
              'Pending approval source-sync record: found',
              'Source-sync gate status: blocked',
              'Source-sync evidence records: 2',
              'Source-sync blocked sources: 1',
              `Source-sync blocking reasons: ${sourceSyncBlocker}`,
              `Source-sync source keys: ${sourceSyncSourceKey}, erp:ads_decision_read_model:daily`,
            ]
          : [
              'Pending approval source-sync record: missing',
              'Source-sync gate status: not_available',
              'Source-sync evidence records: 0',
              'Source-sync blocked sources: 0',
              'Source-sync blocking reasons: none',
            ],
        evidence_record_ids: hasEvidence ? [sourceSyncSourceKey, 'erp:ads_decision_read_model:daily'] : [],
      },
      {
        section_id: 'review_checklist',
        title: 'Review Checklist',
        status: hasEvidence ? 'attention' : 'empty',
        lines: [
          'Confirm query.approval_id matches the approval under review.',
          'Inspect summary counts and link arrays before any future approval decision.',
          'Verify execution_allowed_now, provider_api_called, google_ads_api_called, validateOnly_called, and live_ads_execution_used remain false.',
          'Use the fixture query only for local reviewer demos.',
        ],
        evidence_record_ids: [],
      },
    ],
    markdownPreview: [
      '# Ads Approval Evidence Review',
      `Approval ID: ${approvalId}`,
      `Export status: ${docsStatus}`,
      `Evidence records: ${hasEvidence ? 5 : 0}`,
      `Execution records: ${hasEvidence ? executionId : 'none'}`,
      `Linked validate-only evidence: ${hasEvidence ? validationId : 'none'}`,
      `Linked policy decisions: ${hasEvidence ? policyId : 'none'}`,
      `Source-sync gate status: ${hasEvidence ? 'blocked' : 'not_available'}`,
      `Source-sync blockers: ${hasEvidence ? sourceSyncBlocker : 'none'}`,
      'Safety gates: execution_allowed_now=false, provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false',
    ].join('\n'),
    reviewerExport: {
      schemaVersion: 'ads_automation_approval_evidence_review_export.v1',
      exportMode: 'local_demo_fixture',
      fixture: {
        fixture_id: `ADS_APPROVAL_EVIDENCE_REVIEW_FIXTURE:${approvalId}:${fixtureScenario}`,
        scenario: fixtureScenario,
        source: 'erp_local_demo_fixture',
        description: hasEvidence
          ? 'Local reviewer fixture for one approved Google campaign budget update with linked validate-only, policy, and preflight evidence.'
          : 'Local reviewer fixture for an approval id with no persisted evidence records.',
        persisted_to_db: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      },
      evidenceIndex: {
        links: {
          execution_record_ids: hasEvidence ? [executionId] : [],
          validateOnly_validation_ids_from_preflight: hasEvidence ? [validationId] : [],
          validateOnly_validation_ids_with_evidence: hasEvidence ? [validationId] : [],
          validateOnly_validation_ids_missing_evidence: [],
          policy_decision_ids_from_preflight: hasEvidence ? [policyId] : [],
          policy_decision_ids_with_evidence: hasEvidence ? [policyId] : [],
          policy_decision_ids_missing_evidence: [],
        },
        sourceSyncDecisionEvidence: hasEvidence
          ? [
              {
                sourceKey: sourceSyncSourceKey,
                reportDate: '2026-07-04',
                provider: 'google_ads',
                sourceKind: 'campaign_budget',
                status: 'blocked',
                freshnessStatus: 'stale',
                blockingReasons: [sourceSyncBlocker],
              },
              {
                sourceKey: 'erp:ads_decision_read_model:daily',
                reportDate: '2026-07-04',
                provider: 'erp',
                sourceKind: 'decision_read_model',
                status: 'ready',
                freshnessStatus: 'fresh',
                blockingReasons: [],
              },
            ]
          : [],
        sourceSyncDecisionGates: hasEvidence
          ? {
              canGenerateActionDraft: false,
              canUseGoogleAdsDataClaim: false,
              blockingReasons: [sourceSyncBlocker],
            }
          : null,
      },
    },
  };
}
