import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router, RouterOutlet } from '@angular/router';
import { routes } from '../../app.routes';
import { AuthGuard } from '../../core/guards/auth.guard';
import { User, UserRole } from '../../core/models/auth.interface';
import {
  ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE,
  ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE,
} from './ads-platform-source-sync-status-reviewer.local-fixture';
import {
  ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
  buildAdsApprovalSourceSyncHandoffPrefillBundle,
} from './ads-approval-source-sync-handoff-prefill.util';
import { AdsPlatformSourceSyncStatusReviewerService } from './ads-platform-source-sync-status-reviewer.service';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
class BrowserSmokeHostComponent {}

@Component({
  standalone: true,
  template: '<p>RBAC blocked</p>',
})
class BrowserSmokeBlockedComponent {}

describe('AdsPlatformSourceSyncStatusReviewer browser smoke', () => {
  const sourceSyncStatusRoute = requiredRoute('ai/ads-platform-source-sync-status-reviewer');
  const smokeRoutes: Route[] = [
    sourceSyncStatusRoute,
    { path: 'login', component: BrowserSmokeBlockedComponent },
    { path: 'unauthorized', component: BrowserSmokeBlockedComponent },
    { path: 'upgrade-plan', component: BrowserSmokeBlockedComponent },
  ];
  const renderedFileTextByName = new Map<string, string>();

  let fixture: ComponentFixture<BrowserSmokeHostComponent>;
  let router: Router;
  let http: HttpTestingController | null = null;
  let service: AdsPlatformSourceSyncStatusReviewerService;
  let originalFileReader: typeof FileReader | null = null;

  afterEach(() => {
    if (originalFileReader) {
      Object.defineProperty(window, 'FileReader', {
        configurable: true,
        writable: true,
        value: originalFileReader,
      });
      originalFileReader = null;
    }

    http?.verify();
    http = null;
    renderedFileTextByName.clear();
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY);
  });

  it('routes through marketer-read RBAC and compares exported source-sync snapshots locally', async () => {
    const manager = userForRole(UserRole.MANAGER);
    await setup(manager);
    installImmediateRenderedFileReader();

    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();
    const auditReadbackSpy = spyOn(
      service,
      'parseLocalSnapshotCompareAuditJson',
    ).and.callThrough();
    const approvalAuditReadbackSpy = spyOn(
      service,
      'parseApprovalEvidenceCompareAuditJson',
    ).and.callThrough();
    const approvalHandoffSpy = spyOn(
      service,
      'buildApprovalEvidenceCompareHandoff',
    ).and.callThrough();
    const handoffImportAuditReadbackSpy = spyOn(
      service,
      'parseApprovalEvidenceHandoffOverrideAuditJson',
    ).and.callThrough();
    const approvalCompareAuditText = JSON.stringify(approvalCompareAudit(), null, 2);
    const approvalHandoffPrefill = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalCompareAudit() as Record<string, unknown>,
      approvalCompareAuditText,
      '2000-01-01T00:00:00.000Z',
    );
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake(
      (value: Blob | MediaSource) => {
        exportedBlobs.push(value as Blob);
        return `blob:source-sync-status-compare-${exportedBlobs.length}`;
      },
    );
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    expect(sourceSyncStatusRoute.canActivate).toContain(AuthGuard);
    expect(sourceSyncStatusRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(sourceSyncStatusRoute.data?.['featureModule']).toBe('ai-marketing');
    expect(approvalHandoffPrefill.bundle).toBeTruthy();
    localStorage.setItem(
      ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
      JSON.stringify(approvalHandoffPrefill.bundle),
    );

    const routed = await navigateWithValidatedToken(
      '/ai/ads-platform-source-sync-status-reviewer?reportDate=2026-07-04&sourceKeys=google_ads,advertising_costs',
      manager,
    );
    expect(routed).toBeTrue();
    expect(pageText()).toContain('Platform source-sync status');
    expect(pageText()).toContain('Snapshot A/B readback');
    expect(pageText()).toContain('Stale browser handoff staged from 2026-07-05T10:30:00.000Z');
    expect(pageText()).toContain('Browser handoff staged');
    expect(pageText()).toContain('2000-01-01T00:00:00.000Z');
    expect(pageText()).toContain('Approval audit generated');
    expect(pageText()).toContain('manual_import_required');
    expect(pageText()).toContain('blocked_until_import');
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(reportDateInput().value).toBe('2026-07-04');
    expectNoSourceSyncStatusReadback();

    const leftSnapshotText = JSON.stringify(
      service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE),
      null,
      2,
    );
    const rightSnapshotText = JSON.stringify(
      service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE),
      null,
      2,
    );

    await loadRenderedSnapshotFileText(
      leftSnapshotText,
      'ads-platform-source-sync-status-blocked.json',
      'Load A',
      'leftSnapshotText',
    );
    await loadRenderedSnapshotFileText(
      rightSnapshotText,
      'ads-platform-source-sync-status-ready.json',
      'Load B',
      'rightSnapshotText',
    );

    expect(textareaValue('leftSnapshotText')).toBe(leftSnapshotText);
    expect(textareaValue('rightSnapshotText')).toBe(rightSnapshotText);
    expect(compareSpy).not.toHaveBeenCalled();

    await clickButtonAndSettle('Compare');

    const compareText = pageText();
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(compareText).toContain('Compare schema');
    expect(compareText).toContain('ads_platform_source_sync_status_local_snapshot_compare.v1');
    expect(compareText).toContain('Source readiness changed');
    expect(compareText).toContain('missing_config -> ready');
    expect(compareText).toContain('freshness_stale');
    expect(compareText).toContain('Right safety gates closed');
    expect(compareText).toContain('No safety delta');
    expect(compareText).toContain('Approval evidence handoff');
    expect(compareText).not.toContain('ads_platform_source_sync_status_approval_compare_handoff.v1');
    expect(compareText).not.toContain('resolved_in_status_snapshot');
    expect(approvalHandoffSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();

    await clickButtonAndSettle('Import Browser Handoff');

    const importedHandoffText = pageText();
    expect(approvalHandoffSpy).toHaveBeenCalledTimes(1);
    expect(textareaValue('approvalCompareAuditText')).toBe(approvalCompareAuditText);
    expect(importedHandoffText).toContain(
      'Stale browser handoff manually imported from 2026-07-05T10:30:00.000Z',
    );
    expect(importedHandoffText).toContain('eligible');
    expect(importedHandoffText).toContain(
      'ads_platform_source_sync_status_approval_compare_handoff.v1',
    );
    expect(importedHandoffText).toContain('resolved_in_status_snapshot');
    expect(importedHandoffText).toContain('Override audit');
    expect(importedHandoffText).toContain('Reviewer import');
    expect(importedHandoffText).toContain('Staged time');
    expect(importedHandoffText).toContain('Safety gates closed');
    expectNoSourceSyncStatusReadback();

    await clickButtonAndSettle('Export Import Audit');

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:source-sync-status-compare-1');
    expect(pageText()).toContain('ads-approval-source-sync-handoff-import-audit-');
    const importAuditText = await exportedBlobs[0].text();
    const importAudit = JSON.parse(importAuditText);
    expect(importAudit.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(importAudit.exportMode).toBe('browser_local_stale_handoff_import_override_audit');
    expect(importAudit.browserHandoffStagedAt).toBe('2000-01-01T00:00:00.000Z');
    expect(importAudit.approvalCompareAuditGeneratedAt).toBe('2026-07-05T10:30:00.000Z');
    expect(importAudit.staleAfterMinutes).toBe(1440);
    expect(importAudit.importState).toBe('explicit_stale_import');
    expect(importAudit.safetyGatesClosed).toBeTrue();
    expect(importAudit.provider_api_called).toBeFalse();
    expect(importAudit.google_ads_api_called).toBeFalse();
    expect(importAudit.validateOnly_called).toBeFalse();
    expect(importAudit.live_ads_execution_used).toBeFalse();
    expect(importAudit.execution_allowed_now).toBeFalse();
    expect(importAudit.approvalCompareAuditJson).toBeUndefined();
    expect(importAuditText).not.toContain('sourceSyncDelta');
    expect(importAuditText).not.toContain('HTX-BG-BUDGET-002');
    expectNoSourceSyncStatusReadback();
    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(1);

    await loadRenderedImportAuditFileText(
      importAuditText,
      'ads-approval-source-sync-handoff-import-audit-browser-smoke.json',
    );

    const importedAuditReadbackText = pageText();
    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(2);
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(importAuditText);
    expect(importedAuditReadbackText).toContain('Import audit readback');
    expect(importedAuditReadbackText).toContain(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(importedAuditReadbackText).toContain('Reviewer import');
    expect(importedAuditReadbackText).toContain(importAudit.reviewerImportTimestamp);
    expect(importedAuditReadbackText).toContain('Staged time');
    expect(importedAuditReadbackText).toContain('2000-01-01T00:00:00.000Z');
    expect(importedAuditReadbackText).toContain('Approval audit generated');
    expect(importedAuditReadbackText).toContain('2026-07-05T10:30:00.000Z');
    expect(importedAuditReadbackText).toContain('Readback safety gates closed');
    expect(importedAuditReadbackText).toContain('Provider API');
    expect(importedAuditReadbackText).toContain('Google Ads API');
    expect(importedAuditReadbackText).toContain('Validate-only');
    expect(importedAuditReadbackText).toContain('Live ads execution');
    expect(importedAuditReadbackText).toContain('Execution now');
    expect(importedAuditReadbackText).toContain('Secret values omitted');
    expect(importedAuditReadbackText).toContain('Google Ads production');
    expect(importedAuditReadbackText).toContain('Omitted payloads');
    expect(importedAuditReadbackDetails()).not.toBeNull();
    expectNoSourceSyncStatusReadback();

    const embeddedApprovalAuditImportText = JSON.stringify({
      ...importAudit,
      approvalCompareAuditJson: JSON.stringify(approvalCompareAudit()),
    });
    await loadRenderedImportAuditFileText(
      embeddedApprovalAuditImportText,
      'ads-approval-source-sync-handoff-import-audit-embedded-approval.json',
    );

    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(3);
    expect(pageText()).toContain(
      'Import audit JSON contains forbidden payload field: approvalCompareAuditJson',
    );
    expect(importedAuditReadbackDetails()).toBeNull();
    expectNoSourceSyncStatusReadback();

    const embeddedSourceSyncPayloadImportText = JSON.stringify({
      ...importAudit,
      sourceSyncDelta: (approvalCompareAudit() as Record<string, unknown>)['sourceSyncDelta'],
    });
    await loadRenderedImportAuditFileText(
      embeddedSourceSyncPayloadImportText,
      'ads-approval-source-sync-handoff-import-audit-source-sync-payload.json',
    );

    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(4);
    expect(pageText()).toContain(
      'Import audit JSON contains forbidden payload field: sourceSyncDelta',
    );
    expect(importedAuditReadbackDetails()).toBeNull();
    expectNoSourceSyncStatusReadback();

    await clickButtonAndSettle('Clear Browser Handoff');

    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe('');
    expect(pageText()).toContain('Browser handoff cleared');
    expect(pageText()).not.toContain(
      'Import audit JSON contains forbidden payload field: sourceSyncDelta',
    );
    expect(pageText()).not.toContain('Import audit readback');
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(4);
    expectNoSourceSyncStatusReadback();

    await loadRenderedImportAuditFileText(
      importAuditText,
      'ads-approval-source-sync-handoff-import-audit-reload-after-clear.json',
    );

    const reloadedAuditReadbackText = pageText();
    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(5);
    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(importAuditText);
    expect(reloadedAuditReadbackText).toContain('Browser handoff cleared');
    expect(reloadedAuditReadbackText).toContain('Import audit readback');
    expect(reloadedAuditReadbackText).toContain(importAudit.reviewerImportTimestamp);
    expect(reloadedAuditReadbackText).toContain('Readback safety gates closed');
    expect(reloadedAuditReadbackText).toContain('Provider API');
    expect(reloadedAuditReadbackText).toContain('Google Ads API');
    expect(reloadedAuditReadbackText).toContain('Validate-only');
    expect(reloadedAuditReadbackText).toContain('Execution now');
    expect(importedAuditReadbackDetails()).not.toBeNull();
    expectNoSourceSyncStatusReadback();

    await clickButtonAndSettle('Export Compare JSON');

    const expectedCompareFilename = 'ads-platform-source-sync-status-compare-2026-07-04.json';
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:source-sync-status-compare-2');
    expect(pageText()).toContain(expectedCompareFilename);

    const compareAuditText = await exportedBlobs[1].text();
    const compareAudit = JSON.parse(compareAuditText);
    expect(compareAudit.schemaVersion).toBe(
      'ads_platform_source_sync_status_local_snapshot_compare_audit_export.v1',
    );
    expect(compareAudit.exportMode).toBe('browser_local_compare_audit_handoff');
    expect(compareAudit.omittedPayloads).toEqual([
      'leftSnapshot',
      'rightSnapshot',
      'plaintextSecretValues',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(compareAudit.provider_api_called).toBeFalse();
    expect(compareAudit.google_ads_api_called).toBeFalse();
    expect(compareAudit.validateOnly_called).toBeFalse();
    expect(compareAudit.live_ads_execution_used).toBeFalse();
    expect(compareAudit.execution_allowed_now).toBeFalse();

    await loadRenderedCompareAuditFileText(compareAuditText, expectedCompareFilename);

    expect(auditReadbackSpy).toHaveBeenCalled();
    expect(textareaValue('compareAuditText')).toBe(compareAuditText);
    const readbackText = pageText();
    expect(readbackText).toContain('Compare audit readback');
    expect(readbackText).toContain('Saved JSON import');
    expect(readbackText).toContain('Audit schema');
    expect(readbackText).toContain('Omitted payloads');
    expect(readbackText).toContain('Provider API');
    expect(readbackText).toContain('Google Ads API');
    expect(readbackText).toContain('Validate-only');
    expect(readbackText).toContain('Live ads execution');
    expect(readbackText).toContain('Execution now');
    expect(readbackText).toContain('Readback source-sync');
    expect(readbackText).toContain('Readback safety deltas');
    expect(readbackText).toContain('No safety delta');

    await loadRenderedApprovalCompareAuditFileText(
      approvalCompareAuditText,
      'ads-approval-evidence-reviewer-compare-ADSAPPROVAL-review-fixture.json',
    );

    expect(approvalAuditReadbackSpy).toHaveBeenCalled();
    expect(approvalHandoffSpy).toHaveBeenCalled();
    expect(textareaValue('approvalCompareAuditText')).toBe(approvalCompareAuditText);

    const handoffText = pageText();
    expect(handoffText).toContain('Approval evidence handoff');
    expect(handoffText).toContain('Compare audit correlation');
    expect(handoffText).toContain('Handoff schema');
    expect(handoffText).toContain('ads_platform_source_sync_status_approval_compare_handoff.v1');
    expect(handoffText).toContain('Correlated sources');
    expect(handoffText).toContain('resolved_in_status_snapshot');
    expect(handoffText).toContain('missing_config:GOOGLE_ADS_CLIENT_SECRET');
    expect(handoffText).toContain('google_ads:campaignBudgetId:HTX-BG-BUDGET-002');
    expect(handoffText).toContain('erp:ads_decision_read_model:daily');
    expectNoSourceSyncStatusReadback();

    const maliciousAuditText = JSON.stringify({
      ...compareAudit,
      providerRawPayload: { customer_id: 'not-local-browser-smoke' },
    });
    await loadRenderedCompareAuditFileText(
      maliciousAuditText,
      'ads-platform-source-sync-status-compare-provider-payload.json',
    );

    expect(pageText()).toContain(
      'Compare audit JSON contains forbidden payload field: providerRawPayload',
    );
    expectNoSourceSyncStatusReadback();
  });

  it('rejects malformed or open-gate import-audit files after clearing browser handoff', async () => {
    const manager = userForRole(UserRole.MANAGER);
    await setup(manager);
    installImmediateRenderedFileReader();

    const loadStatusSpy = spyOn(service, 'loadStatus').and.callThrough();
    const handoffImportAuditReadbackSpy = spyOn(
      service,
      'parseApprovalEvidenceHandoffOverrideAuditJson',
    ).and.callThrough();
    const approvalCompareAuditText = JSON.stringify(approvalCompareAudit(), null, 2);
    const approvalHandoffPrefill = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalCompareAudit() as Record<string, unknown>,
      approvalCompareAuditText,
      '2000-01-01T00:00:00.000Z',
    );
    const handoffDetails = service.describeApprovalEvidenceHandoffPrefill(
      approvalHandoffPrefill.bundle!,
      new Date('2026-07-05T11:00:00.000Z'),
    );
    const safeImportAudit = service.buildApprovalEvidenceHandoffOverrideAuditExport(
      approvalHandoffPrefill.bundle!,
      handoffDetails,
      '2026-07-05T11:00:30.000Z',
    );

    localStorage.setItem(
      ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
      JSON.stringify(approvalHandoffPrefill.bundle),
    );

    const routed = await navigateWithValidatedToken(
      '/ai/ads-platform-source-sync-status-reviewer?reportDate=2026-07-04&sourceKeys=google_ads,advertising_costs',
      manager,
    );
    expect(routed).toBeTrue();
    expect(pageText()).toContain('Stale browser handoff staged from 2026-07-05T10:30:00.000Z');
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expectNoSourceSyncStatusReadback();

    await clickButtonAndSettle('Clear Browser Handoff');

    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe('');
    expect(pageText()).toContain('Browser handoff cleared');
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();

    const malformedImportAuditText =
      '{ "schemaVersion": "ads_platform_source_sync_status_approval_handoff_override_audit_export.v1",';
    await loadRenderedImportAuditFileText(
      malformedImportAuditText,
      'ads-approval-source-sync-handoff-import-audit-malformed-after-clear.json',
    );

    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(1);
    expect(pageText()).toContain('Import audit JSON is not valid JSON');
    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(
      malformedImportAuditText,
    );
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();

    const openSafetyGateImportAuditText = JSON.stringify({
      ...safeImportAudit,
      safetyGatesClosed: false,
    }, null, 2);
    await loadRenderedImportAuditFileText(
      openSafetyGateImportAuditText,
      'ads-approval-source-sync-handoff-import-audit-open-safety-after-clear.json',
    );

    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(2);
    expect(pageText()).toContain('Import audit safetyGatesClosed must be true');
    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(
      openSafetyGateImportAuditText,
    );
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();
  });

  it('rejects manually pasted malformed or open-gate import-audit JSON after clearing browser handoff', async () => {
    const manager = userForRole(UserRole.MANAGER);
    await setup(manager);

    const loadStatusSpy = spyOn(service, 'loadStatus').and.callThrough();
    const handoffImportAuditReadbackSpy = spyOn(
      service,
      'parseApprovalEvidenceHandoffOverrideAuditJson',
    ).and.callThrough();
    const approvalCompareAuditText = JSON.stringify(approvalCompareAudit(), null, 2);
    const approvalHandoffPrefill = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalCompareAudit() as Record<string, unknown>,
      approvalCompareAuditText,
      '2000-01-01T00:00:00.000Z',
    );
    const handoffDetails = service.describeApprovalEvidenceHandoffPrefill(
      approvalHandoffPrefill.bundle!,
      new Date('2026-07-05T11:00:00.000Z'),
    );
    const safeImportAudit = service.buildApprovalEvidenceHandoffOverrideAuditExport(
      approvalHandoffPrefill.bundle!,
      handoffDetails,
      '2026-07-05T11:00:30.000Z',
    );

    localStorage.setItem(
      ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
      JSON.stringify(approvalHandoffPrefill.bundle),
    );

    const routed = await navigateWithValidatedToken(
      '/ai/ads-platform-source-sync-status-reviewer?reportDate=2026-07-04&sourceKeys=google_ads,advertising_costs',
      manager,
    );
    expect(routed).toBeTrue();
    expect(pageText()).toContain('Stale browser handoff staged from 2026-07-05T10:30:00.000Z');
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expectNoSourceSyncStatusReadback();

    await clickButtonAndSettle('Clear Browser Handoff');

    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe('');
    expect(pageText()).toContain('Browser handoff cleared');
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();

    const malformedImportAuditText =
      '{ "schemaVersion": "ads_platform_source_sync_status_approval_handoff_override_audit_export.v1",';
    await pasteImportAuditJsonAndRead(malformedImportAuditText);

    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(1);
    expect(pageText()).toContain('Import audit JSON is not valid JSON');
    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(
      malformedImportAuditText,
    );
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();

    const openSafetyGateImportAuditText = JSON.stringify({
      ...safeImportAudit,
      safetyGatesClosed: false,
    }, null, 2);
    await pasteImportAuditJsonAndRead(openSafetyGateImportAuditText);

    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(2);
    expect(pageText()).toContain('Import audit safetyGatesClosed must be true');
    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(
      openSafetyGateImportAuditText,
    );
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();
  });

  it('reads manually pasted sanitized import-audit JSON after clearing browser handoff', async () => {
    const manager = userForRole(UserRole.MANAGER);
    await setup(manager);

    const loadStatusSpy = spyOn(service, 'loadStatus').and.callThrough();
    const handoffImportAuditReadbackSpy = spyOn(
      service,
      'parseApprovalEvidenceHandoffOverrideAuditJson',
    ).and.callThrough();
    const approvalCompareAuditText = JSON.stringify(approvalCompareAudit(), null, 2);
    const approvalHandoffPrefill = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalCompareAudit() as Record<string, unknown>,
      approvalCompareAuditText,
      '2000-01-01T00:00:00.000Z',
    );
    const handoffDetails = service.describeApprovalEvidenceHandoffPrefill(
      approvalHandoffPrefill.bundle!,
      new Date('2026-07-05T11:00:00.000Z'),
    );
    const safeImportAudit = service.buildApprovalEvidenceHandoffOverrideAuditExport(
      approvalHandoffPrefill.bundle!,
      handoffDetails,
      '2026-07-05T11:00:30.000Z',
    );
    const safeImportAuditText = JSON.stringify(safeImportAudit, null, 2);

    expect(safeImportAudit.safetyGatesClosed).toBeTrue();
    expect(safeImportAudit.provider_api_called).toBeFalse();
    expect(safeImportAudit.google_ads_api_called).toBeFalse();
    expect(safeImportAudit.validateOnly_called).toBeFalse();
    expect(safeImportAudit.live_ads_execution_used).toBeFalse();
    expect(safeImportAudit.execution_allowed_now).toBeFalse();
    expect((safeImportAudit as unknown as Record<string, unknown>)['approvalCompareAuditJson'])
      .toBeUndefined();
    expect(safeImportAuditText).not.toContain('sourceSyncDelta');
    expect(safeImportAuditText).not.toContain('HTX-BG-BUDGET-002');

    localStorage.setItem(
      ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
      JSON.stringify(approvalHandoffPrefill.bundle),
    );

    const routed = await navigateWithValidatedToken(
      '/ai/ads-platform-source-sync-status-reviewer?reportDate=2026-07-04&sourceKeys=google_ads,advertising_costs',
      manager,
    );
    expect(routed).toBeTrue();
    expect(pageText()).toContain('Stale browser handoff staged from 2026-07-05T10:30:00.000Z');
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expectNoSourceSyncStatusReadback();

    await clickButtonAndSettle('Clear Browser Handoff');

    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe('');
    expect(pageText()).toContain('Browser handoff cleared');
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();

    await pasteImportAuditJsonAndRead(safeImportAuditText);

    const readbackText = pageText();
    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(
      safeImportAuditText,
    );
    expect(readbackText).toContain('Browser handoff cleared');
    expect(readbackText).toContain('Import audit readback');
    expect(readbackText).toContain(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(readbackText).toContain('Reviewer import');
    expect(readbackText).toContain('2026-07-05T11:00:30.000Z');
    expect(readbackText).toContain('Staged time');
    expect(readbackText).toContain('2000-01-01T00:00:00.000Z');
    expect(readbackText).toContain('Approval audit generated');
    expect(readbackText).toContain('2026-07-05T10:30:00.000Z');
    expect(readbackText).toContain('Readback safety gates closed');
    expect(readbackText).toContain('Provider API');
    expect(readbackText).toContain('Google Ads API');
    expect(readbackText).toContain('Validate-only');
    expect(readbackText).toContain('Live ads execution');
    expect(readbackText).toContain('Execution now');
    expect(readbackText).toContain('Secret values omitted');
    expect(readbackText).toContain('Google Ads production');
    expect(readbackText).toContain('Omitted payloads');
    expect(readbackText).not.toContain('Import audit JSON contains forbidden payload field');
    expect(importedAuditReadbackDetails()).not.toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();
  });

  it('rejects manually pasted import-audit JSON with tampered execution safety after clearing browser handoff', async () => {
    const manager = userForRole(UserRole.MANAGER);
    await setup(manager);

    const loadStatusSpy = spyOn(service, 'loadStatus').and.callThrough();
    const handoffImportAuditReadbackSpy = spyOn(
      service,
      'parseApprovalEvidenceHandoffOverrideAuditJson',
    ).and.callThrough();
    const approvalCompareAuditText = JSON.stringify(approvalCompareAudit(), null, 2);
    const approvalHandoffPrefill = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalCompareAudit() as Record<string, unknown>,
      approvalCompareAuditText,
      '2000-01-01T00:00:00.000Z',
    );
    const handoffDetails = service.describeApprovalEvidenceHandoffPrefill(
      approvalHandoffPrefill.bundle!,
      new Date('2026-07-05T11:00:00.000Z'),
    );
    const safeImportAudit = service.buildApprovalEvidenceHandoffOverrideAuditExport(
      approvalHandoffPrefill.bundle!,
      handoffDetails,
      '2026-07-05T11:00:30.000Z',
    );
    const tamperedImportAuditText = JSON.stringify({
      ...safeImportAudit,
      execution_allowed_now: true,
    }, null, 2);

    expect(safeImportAudit.safetyGatesClosed).toBeTrue();
    expect(safeImportAudit.execution_allowed_now).toBeFalse();
    expect(tamperedImportAuditText).toContain('"execution_allowed_now": true');

    localStorage.setItem(
      ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
      JSON.stringify(approvalHandoffPrefill.bundle),
    );

    const routed = await navigateWithValidatedToken(
      '/ai/ads-platform-source-sync-status-reviewer?reportDate=2026-07-04&sourceKeys=google_ads,advertising_costs',
      manager,
    );
    expect(routed).toBeTrue();
    expect(pageText()).toContain('Stale browser handoff staged from 2026-07-05T10:30:00.000Z');
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expectNoSourceSyncStatusReadback();

    await clickButtonAndSettle('Clear Browser Handoff');

    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe('');
    expect(pageText()).toContain('Browser handoff cleared');
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();

    await pasteImportAuditJsonAndRead(tamperedImportAuditText);

    const rejectedReadbackText = pageText();
    expect(handoffImportAuditReadbackSpy).toHaveBeenCalledTimes(1);
    expect(rejectedReadbackText).toContain(
      'Import audit safety field execution_allowed_now must be false',
    );
    expect(rejectedReadbackText).not.toContain('Import audit readback');
    expect(rejectedReadbackText).not.toContain('Readback safety gates closed');
    for (const rejectedReadbackLabel of [
      'Reviewer import',
      'Staged time',
      'Approval audit generated',
      'Provider API',
      'Google Ads API',
      'Validate-only',
      'Live ads execution',
      'Execution now',
      'Secret values omitted',
      'Google Ads production',
      'Omitted payloads',
    ]) {
      expect(rejectedReadbackText).not.toContain(rejectedReadbackLabel);
    }
    expect(localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY)).toBeNull();
    expect(textareaValue('approvalCompareAuditText')).toBe('');
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(
      tamperedImportAuditText,
    );
    expect(importedAuditReadbackDetails()).toBeNull();
    expect(loadStatusSpy).not.toHaveBeenCalled();
    expectNoSourceSyncStatusReadback();
  });

  async function setup(user: User): Promise<void> {
    localStorage.setItem('access_token', `source-sync-status-smoke-${user.role}`);
    localStorage.setItem('current_user', JSON.stringify(user));

    await TestBed.configureTestingModule({
      imports: [BrowserSmokeHostComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(smokeRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrowserSmokeHostComponent);
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AdsPlatformSourceSyncStatusReviewerService);
    fixture.detectChanges();
  }

  async function navigateWithValidatedToken(url: string, user: User): Promise<boolean> {
    const navigation = router.navigateByUrl(url);
    await flushNextTokenValidation(user);
    const routed = await navigation;
    await settle();
    return routed;
  }

  async function flushNextTokenValidation(user: User): Promise<void> {
    const validateRequest = await waitForHttpRequest((request) => (
      request.method === 'POST' && request.url === '/api/auth/validate-token'
    ));
    expect(validateRequest.request.body).toEqual({});
    validateRequest.flush({ valid: true, user });
  }

  async function waitForHttpRequest(
    predicate: Parameters<HttpTestingController['match']>[0],
  ): Promise<TestRequest> {
    const deadline = Date.now() + 1000;

    while (Date.now() <= deadline) {
      const matches = http!.match(predicate);
      if (matches.length) {
        return matches[0];
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      fixture.detectChanges();
    }

    throw new Error('Timed out waiting for expected HTTP request');
  }

  async function loadRenderedSnapshotFileText(
    contents: string,
    filename: string,
    labelText: 'Load A' | 'Load B',
    textareaName: 'leftSnapshotText' | 'rightSnapshotText',
  ): Promise<void> {
    const input = fileInputByLabel(labelText);
    const file = new File([contents], filename, { type: 'application/json' });

    renderedFileTextByName.set(filename, contents);
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForTextareaValue(textareaName, contents);
    fixture.detectChanges();
  }

  async function loadRenderedCompareAuditFileText(
    contents: string,
    filename: string,
  ): Promise<void> {
    const input = fileInputByLabel('Load Audit');
    const file = new File([contents], filename, { type: 'application/json' });

    renderedFileTextByName.set(filename, contents);
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForTextareaValue('compareAuditText', contents);
    fixture.detectChanges();
  }

  async function loadRenderedApprovalCompareAuditFileText(
    contents: string,
    filename: string,
  ): Promise<void> {
    const input = fileInputByLabel('Load Approval Audit');
    const file = new File([contents], filename, { type: 'application/json' });

    renderedFileTextByName.set(filename, contents);
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForTextareaValue('approvalCompareAuditText', contents);
    fixture.detectChanges();
  }

  async function loadRenderedImportAuditFileText(
    contents: string,
    filename: string,
  ): Promise<void> {
    const input = fileInputByLabel('Load Import Audit');
    const file = new File([contents], filename, { type: 'application/json' });

    renderedFileTextByName.set(filename, contents);
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForTextareaValue('browserApprovalHandoffImportAuditReadbackText', contents);
    fixture.detectChanges();
  }

  function fileInputByLabel(
    labelText:
      | 'Load A'
      | 'Load B'
      | 'Load Audit'
      | 'Load Approval Audit'
      | 'Load Import Audit',
  ): HTMLInputElement {
    const label = (Array.from(
      fixture.nativeElement.querySelectorAll('label.file-button'),
    ) as HTMLLabelElement[]).find((candidate) => candidate.textContent?.trim() === labelText);
    const input = label?.querySelector('input[type="file"]') as HTMLInputElement | null;

    if (!input) {
      throw new Error(`Missing rendered file input: ${labelText}`);
    }

    return input;
  }

  async function waitForTextareaValue(name: string, expectedValue: string): Promise<void> {
    const deadline = Date.now() + 1000;

    while (textareaValue(name) !== expectedValue) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for textarea ${name}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      fixture.detectChanges();
    }
  }

  function textareaValue(name: string): string {
    return textareaElement(name).value;
  }

  function textareaElement(name: string): HTMLTextAreaElement {
    const textarea = fixture.nativeElement.querySelector(
      `textarea[name="${name}"]`,
    ) as HTMLTextAreaElement | null;

    if (!textarea) {
      throw new Error(`Missing rendered textarea: ${name}`);
    }

    return textarea;
  }

  async function pasteImportAuditJsonAndRead(contents: string): Promise<void> {
    const textarea = textareaElement('browserApprovalHandoffImportAuditReadbackText');
    textarea.value = contents;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(textareaValue('browserApprovalHandoffImportAuditReadbackText')).toBe(contents);
    await clickButtonAndSettle('Read Import Audit');
  }

  async function clickButtonAndSettle(label: string): Promise<void> {
    const button = (Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[]).find((candidate) => candidate.textContent?.trim() === label);

    if (!button) {
      throw new Error(`Missing rendered button: ${label}`);
    }

    expect(button.disabled).toBeFalse();
    button.click();
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function pageText(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent || '';
  }

  function reportDateInput(): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(
      'input[name="reportDate"]',
    ) as HTMLInputElement | null;

    if (!input) {
      throw new Error('Missing source-sync report date input');
    }

    return input;
  }

  function importedAuditReadbackDetails(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.browser-handoff-readback-details');
  }

  function expectNoSourceSyncStatusReadback(): void {
    http!.expectNone((request) => request.url.includes('/platform-source-sync-status'));
  }

  function installImmediateRenderedFileReader(): void {
    originalFileReader = window.FileReader;

    function ImmediateFileReader(this: FileReader): void {
      const reader = this as unknown as {
        result: string;
        onload: ((event: ProgressEvent<FileReader>) => void) | null;
        onerror: ((event: ProgressEvent<FileReader>) => void) | null;
      };

      reader.result = '';
      reader.onload = null;
      reader.onerror = null;
    }

    ImmediateFileReader.prototype.readAsText = function readAsText(file: File): void {
      const reader = this as unknown as {
        result: string;
        onload: ((event: ProgressEvent<FileReader>) => void) | null;
      };

      reader.result = renderedFileTextByName.get(file.name) || '';
      reader.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
    };

    Object.defineProperty(window, 'FileReader', {
      configurable: true,
      writable: true,
      value: ImmediateFileReader as unknown as typeof FileReader,
    });
  }

  function userForRole(role: UserRole): User {
    return {
      id: `source-sync-status-smoke-${role}`,
      email: `${role}@example.local`,
      fullName: `Source Sync Status Smoke ${role}`,
      role,
      isActive: true,
    };
  }

  function requiredRoute(path: string): Route {
    const route = routes.find((item) => item.path === path);

    if (!route) {
      throw new Error(`Missing app route: ${path}`);
    }

    return route;
  }
});

function approvalCompareAudit(): object {
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
