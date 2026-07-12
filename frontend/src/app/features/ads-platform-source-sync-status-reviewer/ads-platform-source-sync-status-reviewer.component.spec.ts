import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap } from '@angular/router';
import { ReplaySubject } from 'rxjs';
import {
  ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE,
  ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE,
} from './ads-platform-source-sync-status-reviewer.local-fixture';
import {
  ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
  buildAdsApprovalSourceSyncHandoffPrefillBundle,
} from './ads-approval-source-sync-handoff-prefill.util';
import { AdsPlatformSourceSyncStatusReviewerComponent } from './ads-platform-source-sync-status-reviewer.component';
import {
  AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport,
  AdsPlatformSourceSyncStatusReviewerService,
} from './ads-platform-source-sync-status-reviewer.service';

describe('AdsPlatformSourceSyncStatusReviewerComponent', () => {
  let fixture: ComponentFixture<AdsPlatformSourceSyncStatusReviewerComponent>;
  let component: AdsPlatformSourceSyncStatusReviewerComponent;
  let http: HttpTestingController;
  let queryParamMap: ReplaySubject<ParamMap>;
  let service: AdsPlatformSourceSyncStatusReviewerService;

  beforeEach(async () => {
    queryParamMap = new ReplaySubject<ParamMap>(1);

    await TestBed.configureTestingModule({
      imports: [AdsPlatformSourceSyncStatusReviewerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamMap.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdsPlatformSourceSyncStatusReviewerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AdsPlatformSourceSyncStatusReviewerService);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY);
  });

  it('renders the initial local demo query without calling the backend', () => {
    fixture.detectChanges();

    expect(component.status()).toBeNull();
    expect(component.reportDate).toBe('2026-07-04');
    expect(component.googleAdsSelected).toBeTrue();
    expect(component.advertisingCostsSelected).toBeTrue();
    expect(component.productMappingSelected).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('No source-sync status loaded');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('prefills report date, now, and source keys from query params without fetching', () => {
    queryParamMap.next(convertToParamMap({
      reportDate: '2026-07-05',
      now: '2026-07-05T05:00:00.000Z',
      sourceKeys: 'google_ads,product_mapping',
    }));
    fixture.detectChanges();

    expect(component.reportDate).toBe('2026-07-05');
    expect(component.now).toBe('2026-07-05T05:00:00.000Z');
    expect(component.googleAdsSelected).toBeTrue();
    expect(component.advertisingCostsSelected).toBeFalse();
    expect(component.productMappingSelected).toBeTrue();
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('loads demo status and renders source readiness, blockers, watermarks, and closed safety gates', () => {
    fixture.detectChanges();

    component.loadDemoStatus();

    const request = http.expectOne((req) => (
      req.method === 'POST'
      && req.url === '/api/ai/ads-automation/platform-source-sync-status'
    ));
    expect(request.request.body).toEqual({
      reportDate: '2026-07-04',
      now: '2026-07-04T05:00:00.000Z',
      sourceKeys: ['google_ads', 'advertising_costs', 'product_mapping'],
    });
    request.flush(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.status()?.schemaVersion).toBe('ads_automation_platform_source_sync_status.v1');
    expect(component.safetyGates().every((gate) => gate.pass)).toBeTrue();
    expect(component.localSnapshot()?.secret_values_omitted).toBeTrue();
    expect(component.localSnapshot()?.provider_api_called).toBeFalse();
    expect(component.localSnapshot()?.google_ads_api_called).toBeFalse();
    expect(component.localSnapshot()?.validateOnly_called).toBeFalse();
    expect(component.localSnapshot()?.live_ads_execution_used).toBeFalse();
    expect(component.localSnapshot()?.execution_allowed_now).toBeFalse();
    expect(text).toContain('blocked');
    expect(text).toContain('google_ads / google_ads');
    expect(text).toContain('erp_local / erp_advertising_costs');
    expect(text).toContain('erp_local / erp_product_mapping');
    expect(text).toContain('missing_config:GOOGLE_ADS_CLIENT_SECRET');
    expect(text).toContain('freshness_stale');
    expect(text).toContain('2026-07-04T04:30:00.000Z');
    expect(text).toContain('2026-07-04T01:00:00.000Z');
    expect(text).toContain('Value exposed');
    expect(text).toContain('false');
    expect(text).toContain('Provider API');
    expect(text).toContain('Google Ads API');
    expect(text).toContain('Validate-only call');
    expect(text).toContain('Live ads execution');
    expect(text).toContain('Execution now');
    expect(text).not.toMatch(/FORBIDDEN_PROVIDER_VALUE|FORBIDDEN_CLIENT_VALUE/i);
  });

  it('posts only selected sources from the form', () => {
    fixture.detectChanges();
    component.reportDate = '2026-07-05';
    component.now = '';
    component.googleAdsSelected = false;
    component.advertisingCostsSelected = true;
    component.productMappingSelected = false;

    component.load();

    const request = http.expectOne('/api/ai/ads-automation/platform-source-sync-status');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      reportDate: '2026-07-05',
      sourceKeys: ['advertising_costs'],
    });
    request.flush({
      ...ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE,
      reportDate: '2026-07-05',
      sources: [ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE.sources[1]],
    });
  });

  it('blocks empty source selections before making a backend request', () => {
    fixture.detectChanges();
    component.googleAdsSelected = false;
    component.advertisingCostsSelected = false;
    component.productMappingSelected = false;

    component.load();
    fixture.detectChanges();

    expect(component.error()).toBe('Select at least one source');
    expect(fixture.nativeElement.textContent).toContain('Select at least one source');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('compares two exported local snapshots and renders changed readiness, blockers, and closed safety gates', () => {
    const left = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const right = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE);
    fixture.detectChanges();

    component.leftSnapshotText = JSON.stringify(left, null, 2);
    component.rightSnapshotText = JSON.stringify(right, null, 2);
    component.compareSnapshots();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.compareError()).toBeNull();
    expect(component.compareResult()?.schemaVersion)
      .toBe('ads_platform_source_sync_status_local_snapshot_compare.v1');
    expect(component.changedReadinessDeltas().map((delta) => delta.sourceKey)).toContain('google_ads');
    expect(component.changedBlockerDeltas().map((delta) => delta.sourceKey)).toContain('advertising_costs');
    expect(component.changedSafetyDeltas()).toEqual([]);
    expect(text).toContain('Compare schema');
    expect(text).toContain('Right safety gates closed');
    expect(text).toContain('true');
    expect(text).toContain('Source readiness changed');
    expect(text).toContain('Google Ads');
    expect(text).toContain('missing_config -> ready');
    expect(text).toContain('freshness_stale');
    expect(text).toContain('No safety delta');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('exports and reads back compare audit JSON without posting source-sync status', () => {
    const left = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const right = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE);
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake(
      (value: Blob | MediaSource) => {
        exportedBlobs.push(value as Blob);
        return `blob:source-sync-compare-${exportedBlobs.length}`;
      },
    );
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
    fixture.detectChanges();

    component.leftSnapshotText = JSON.stringify(left, null, 2);
    component.rightSnapshotText = JSON.stringify(right, null, 2);
    component.compareSnapshots();
    component.downloadCompareAudit();
    fixture.detectChanges();

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(exportedBlobs.length).toBe(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:source-sync-compare-1');
    expect(component.compareAuditError()).toBeNull();
    expect(component.compareAudit()?.schemaVersion)
      .toBe('ads_platform_source_sync_status_local_snapshot_compare_audit_export.v1');
    expect(component.compareAuditText).toContain('browser_local_compare_audit_handoff');
    expect(component.compareAuditText).not.toContain('requiredConfigPresence');
    expect(fixture.nativeElement.textContent).toContain('Compare audit readback');
    expect(fixture.nativeElement.textContent).toContain('Saved JSON import');
    expect(fixture.nativeElement.textContent).toContain('Readback source-sync');
    expect(fixture.nativeElement.textContent).toContain('Readback safety deltas');
    expect(fixture.nativeElement.textContent).toContain('No safety delta');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('correlates approval evidence compare audit handoff against current source-sync compare', () => {
    const left = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const right = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE);
    fixture.detectChanges();

    component.leftSnapshotText = JSON.stringify(left, null, 2);
    component.rightSnapshotText = JSON.stringify(right, null, 2);
    component.compareSnapshots();
    component.approvalCompareAuditText = JSON.stringify(approvalCompareAudit(), null, 2);
    component.correlateApprovalCompareAudit();
    fixture.detectChanges();

    const handoff = component.approvalHandoff();
    const googleAdsCorrelation = handoff?.sourceCorrelations.find((correlation) => (
      correlation.sourceKey === 'google_ads'
    ));
    const text = fixture.nativeElement.textContent;

    expect(component.approvalHandoffError()).toBeNull();
    expect(handoff?.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_compare_handoff.v1',
    );
    expect(handoff?.safetyGatesClosed).toBeTrue();
    expect(googleAdsCorrelation?.correlationSummary).toBe('resolved_in_status_snapshot');
    expect(googleAdsCorrelation?.blockerOverlap.removed).toEqual([
      'missing_config:GOOGLE_ADS_CLIENT_SECRET',
    ]);
    expect(text).toContain('Approval evidence handoff');
    expect(text).toContain('Compare audit correlation');
    expect(text).toContain('resolved_in_status_snapshot');
    expect(text).toContain('missing_config:GOOGLE_ADS_CLIENT_SECRET');
    expect(text).toContain('google_ads:campaignBudgetId:HTX-BG-BUDGET-002');
    expect(text).toContain('erp:ads_decision_read_model:daily');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('prefills approval handoff from browser storage and correlates after source-sync compare', () => {
    const approvalAudit = approvalCompareAudit();
    const approvalAuditJson = JSON.stringify(approvalAudit, null, 2);
    const freshGeneratedAt = new Date().toISOString();
    const built = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalAudit as unknown as Record<string, unknown>,
      approvalAuditJson,
      freshGeneratedAt,
    );
    expect(built.bundle).toBeTruthy();
    localStorage.setItem(
      ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
      JSON.stringify(built.bundle),
    );

    fixture.detectChanges();

    expect(component.approvalCompareAuditText).toBe(approvalAuditJson);
    expect(component.browserApprovalHandoffError()).toBeNull();
    expect(component.browserApprovalHandoffStatus()).toBe(
      'Browser handoff loaded from 2026-07-05T10:30:00.000Z',
    );
    expect(component.browserApprovalHandoffPrefillDetails()?.bundleGeneratedAt).toBe(
      freshGeneratedAt,
    );
    expect(component.browserApprovalHandoffPrefillDetails()?.approvalCompareAuditGeneratedAt).toBe(
      '2026-07-05T10:30:00.000Z',
    );
    expect(component.browserApprovalHandoffManualImportRequired()).toBeFalse();
    expect(component.browserApprovalHandoffImported()).toBeTrue();
    expect(component.approvalHandoff()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Browser handoff loaded from');
    expect(fixture.nativeElement.textContent).toContain('Browser handoff staged');
    expect(fixture.nativeElement.textContent).toContain('Approval audit generated');

    const left = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const right = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE);
    component.leftSnapshotText = JSON.stringify(left, null, 2);
    component.rightSnapshotText = JSON.stringify(right, null, 2);
    component.compareSnapshots();
    fixture.detectChanges();

    const handoff = component.approvalHandoff();
    const text = fixture.nativeElement.textContent;

    expect(component.approvalHandoffError()).toBeNull();
    expect(handoff?.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_compare_handoff.v1',
    );
    expect(handoff?.sourceCorrelations.some((correlation) => (
      correlation.sourceKey === 'google_ads'
      && correlation.correlationSummary === 'resolved_in_status_snapshot'
    ))).toBeTrue();
    expect(text).toContain('ads_platform_source_sync_status_approval_compare_handoff.v1');
    expect(text).toContain('resolved_in_status_snapshot');
    expect(text).toContain('missing_config:GOOGLE_ADS_CLIENT_SECRET');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('requires manual import before correlating a stale staged browser handoff and exports an override audit', async () => {
    const approvalAudit = approvalCompareAudit();
    const approvalAuditJson = JSON.stringify(approvalAudit, null, 2);
    const built = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalAudit as unknown as Record<string, unknown>,
      approvalAuditJson,
      '2000-01-01T00:00:00.000Z',
    );
    expect(built.bundle).toBeTruthy();
    localStorage.setItem(
      ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
      JSON.stringify(built.bundle),
    );
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake(
      (value: Blob | MediaSource) => {
        exportedBlobs.push(value as Blob);
        return `blob:source-sync-handoff-import-audit-${exportedBlobs.length}`;
      },
    );
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    fixture.detectChanges();

    expect(component.browserApprovalHandoffPrefillDetails()?.stale).toBeTrue();
    expect(component.browserApprovalHandoffManualImportRequired()).toBeTrue();
    expect(component.browserApprovalHandoffImported()).toBeFalse();
    expect(component.approvalCompareAuditText).toBe('');
    expect(component.lastApprovalHandoffFileName()).toBeNull();
    expect(component.browserApprovalHandoffImportAudit()).toBeNull();
    expect(component.browserApprovalHandoffStatus()).toBe(
      'Stale browser handoff staged from 2026-07-05T10:30:00.000Z',
    );
    expect(fixture.nativeElement.textContent).toContain('2000-01-01T00:00:00.000Z');
    expect(fixture.nativeElement.textContent).toContain('Stale after minutes');
    expect(fixture.nativeElement.textContent).toContain('1440');
    expect(fixture.nativeElement.textContent).toContain('manual_import_required');
    expect(fixture.nativeElement.textContent).toContain('blocked_until_import');

    const left = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const right = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE);
    component.leftSnapshotText = JSON.stringify(left, null, 2);
    component.rightSnapshotText = JSON.stringify(right, null, 2);
    component.compareSnapshots();
    fixture.detectChanges();

    expect(component.approvalHandoff()).toBeNull();
    expect(component.approvalCompareAuditText).toBe('');

    component.importBrowserApprovalHandoff();
    fixture.detectChanges();

    expect(component.browserApprovalHandoffManualImportRequired()).toBeFalse();
    expect(component.browserApprovalHandoffImported()).toBeTrue();
    expect(component.approvalCompareAuditText).toBe(approvalAuditJson);
    expect(component.lastApprovalHandoffFileName()).toBe('browser-local approval handoff');
    expect(component.browserApprovalHandoffStatus()).toBe(
      'Stale browser handoff manually imported from 2026-07-05T10:30:00.000Z',
    );
    expect(component.browserApprovalHandoffImportAudit()?.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(component.browserApprovalHandoffImportAudit()?.browserHandoffStagedAt).toBe(
      '2000-01-01T00:00:00.000Z',
    );
    expect(component.browserApprovalHandoffImportAudit()?.approvalCompareAuditGeneratedAt).toBe(
      '2026-07-05T10:30:00.000Z',
    );
    expect(component.browserApprovalHandoffImportAudit()?.staleAfterMinutes).toBe(1440);
    expect(component.browserApprovalHandoffImportAudit()?.safetyGatesClosed).toBeTrue();
    expect(component.approvalHandoff()?.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_compare_handoff.v1',
    );
    expect(fixture.nativeElement.textContent).toContain('eligible');
    expect(fixture.nativeElement.textContent).toContain('Override audit');
    expect(fixture.nativeElement.textContent).toContain('Safety gates closed');

    component.downloadBrowserApprovalHandoffImportAudit();
    fixture.detectChanges();

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:source-sync-handoff-import-audit-1');
    expect(component.lastBrowserApprovalHandoffImportAuditFileName())
      .toContain('ads-approval-source-sync-handoff-import-audit-');
    const importAudit = JSON.parse(await exportedBlobs[0].text());
    expect(importAudit.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(importAudit.importState).toBe('explicit_stale_import');
    expect(importAudit.browserHandoffStagedAt).toBe('2000-01-01T00:00:00.000Z');
    expect(importAudit.approvalCompareAuditGeneratedAt).toBe('2026-07-05T10:30:00.000Z');
    expect(importAudit.staleAfterMinutes).toBe(1440);
    expect(importAudit.safetyGatesClosed).toBeTrue();
    expect(importAudit.provider_api_called).toBeFalse();
    expect(importAudit.google_ads_api_called).toBeFalse();
    expect(importAudit.validateOnly_called).toBeFalse();
    expect(importAudit.execution_allowed_now).toBeFalse();
    expect(importAudit.approvalCompareAuditJson).toBeUndefined();
    expect(JSON.stringify(importAudit)).not.toContain('sourceSyncDelta');
    expect(JSON.stringify(importAudit)).not.toContain('HTX-BG-BUDGET-002');
    expect(component.browserApprovalHandoffImportAuditReadbackText).toContain(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(component.browserApprovalHandoffImportAuditReadbackError()).toBeNull();
    expect(component.browserApprovalHandoffImportAuditReadback()?.reviewerImportTimestamp)
      .toBe(importAudit.reviewerImportTimestamp);
    expect(component.browserApprovalHandoffImportAuditReadback()?.safetyGatesClosed).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Import audit readback');
    expect(fixture.nativeElement.textContent).toContain('Readback safety gates closed');
    expect(fixture.nativeElement.textContent).toContain('Provider API');
    expect(fixture.nativeElement.textContent).toContain('Validate-only');

    component.browserApprovalHandoffImportAuditReadbackText = JSON.stringify({
      ...importAudit,
      sourceSyncDelta: approvalAudit.sourceSyncDelta,
    });
    component.readBrowserApprovalHandoffImportAudit();
    fixture.detectChanges();

    expect(component.browserApprovalHandoffImportAuditReadback()).toBeNull();
    expect(component.browserApprovalHandoffImportAuditReadbackError()).toBe(
      'Import audit JSON contains forbidden payload field: sourceSyncDelta',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Import audit JSON contains forbidden payload field: sourceSyncDelta',
    );

    component.browserApprovalHandoffImportAuditReadbackText = JSON.stringify({
      ...importAudit,
      execution_allowed_now: true,
    });
    component.readBrowserApprovalHandoffImportAudit();
    fixture.detectChanges();

    expect(component.browserApprovalHandoffImportAuditReadback()).toBeNull();
    expect(component.browserApprovalHandoffImportAuditReadbackError()).toBe(
      'Import audit safety field execution_allowed_now must be false',
    );

    component.clearBrowserApprovalHandoff();
    fixture.detectChanges();

    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(component.browserApprovalHandoffStatus()).toBe('Browser handoff cleared');
    expect(component.browserApprovalHandoffError()).toBeNull();
    expect(component.browserApprovalHandoffPrefillDetails()).toBeNull();
    expect(component.browserApprovalHandoffManualImportRequired()).toBeFalse();
    expect(component.browserApprovalHandoffImported()).toBeFalse();
    expect(component.browserApprovalHandoffImportAudit()).toBeNull();
    expect(component.lastBrowserApprovalHandoffImportAuditFileName()).toBeNull();
    expect(component.browserApprovalHandoffImportAuditReadbackText).toBe('');
    expect(component.browserApprovalHandoffImportAuditReadback()).toBeNull();
    expect(component.browserApprovalHandoffImportAuditReadbackError()).toBeNull();
    expect(component.approvalCompareAuditText).toBe('');
    expect(component.lastApprovalHandoffFileName()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Browser handoff cleared');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Import audit JSON contains forbidden payload field: sourceSyncDelta',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Import audit readback');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });
});

function approvalCompareAudit(): AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport {
  return {
    schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    exportMode: 'browser_local_compare_audit_handoff',
    generatedAt: '2026-07-05T10:30:00.000Z',
    compareSchemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1',
    leftComparisonKey: 'approval|source_sync_gate=blocked|campaignBudgetId=HTX-BG-BUDGET-001',
    rightComparisonKey: 'approval|source_sync_gate=ready|campaignBudgetId=HTX-BG-BUDGET-002',
    sameComparisonKey: false,
    metricDeltas: [],
    safetyDeltas: [],
    sourceSyncDelta: {
      gateStatus: {
        leftValue: 'blocked',
        rightValue: 'ready',
        changed: true,
      },
      blockedSources: {
        leftValue: 1,
        rightValue: 0,
        delta: -1,
        changed: true,
      },
      blockingReasons: {
        leftValues: ['missing_config:GOOGLE_ADS_CLIENT_SECRET'],
        rightValues: [],
        added: [],
        removed: ['missing_config:GOOGLE_ADS_CLIENT_SECRET'],
        changed: true,
      },
      sourceKeys: {
        leftValues: [
          'google_ads:campaign_budget:HTX-BG-BUDGET-001',
          'erp:ads_decision_read_model:daily',
        ],
        rightValues: [
          'google_ads:campaignBudgetId:HTX-BG-BUDGET-002',
          'erp:ads_decision_read_model:daily',
        ],
        added: ['google_ads:campaignBudgetId:HTX-BG-BUDGET-002'],
        removed: ['google_ads:campaign_budget:HTX-BG-BUDGET-001'],
        changed: true,
      },
      changed: true,
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
