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
  ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
} from '../ads-platform-source-sync-status-reviewer/ads-approval-source-sync-handoff-prefill.util';
import {
  AdsApprovalEvidenceReviewerDocsLocalSnapshot,
  AdsApprovalEvidenceReviewerDocsResponse,
  AdsApprovalEvidenceReviewerService,
} from './ads-approval-evidence-reviewer.service';

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

describe('AdsApprovalEvidenceReviewer browser smoke', () => {
  const approvalId = 'ADSAPPROVAL-review-fixture';
  const reviewerEndpoint = `/api/ai/ads-automation/decision-draft-approvals/${approvalId}/evidence-index/reviewer-docs`;
  const reviewerRoute = requiredReviewerRoute();
  const sourceSyncStatusRoute = requiredRoute('ai/ads-platform-source-sync-status-reviewer');
  const smokeRoutes: Route[] = [
    reviewerRoute,
    sourceSyncStatusRoute,
    { path: 'login', component: BrowserSmokeBlockedComponent },
    { path: 'unauthorized', component: BrowserSmokeBlockedComponent },
    { path: 'upgrade-plan', component: BrowserSmokeBlockedComponent },
  ];
  const renderedFileTextByName = new Map<string, string>();

  let fixture: ComponentFixture<BrowserSmokeHostComponent>;
  let router: Router;
  let http: HttpTestingController | null = null;
  let service: AdsApprovalEvidenceReviewerService;
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

  it('routes through marketer-read RBAC and round-trips rendered export, reset, Load A/B, and compare locally', async () => {
    const marketer = userForRole(UserRole.MANAGER);
    await setup(marketer);
    installImmediateRenderedFileReader();

    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();
    const compareAuditReadbackSpy = spyOn(
      service,
      'parseLocalSnapshotCompareAuditJson',
    ).and.callThrough();
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake(
      (value: Blob | MediaSource) => {
        exportedBlobs.push(value as Blob);
        return `blob:browser-approval-evidence-snapshot-${exportedBlobs.length}`;
      },
    );
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    expect(reviewerRoute.canActivate).toContain(AuthGuard);
    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(reviewerRoute.data?.['featureModule']).toBe('ai-marketing');

    const routed = await navigateToReviewer(marketer);
    expect(routed).toBeTrue();
    expect(router.url).toBe('/ai/ads-approval-evidence-reviewer');
    expect(pageText()).toContain('Approval evidence reviewer');
    expect(pageText()).toContain('No reviewer docs loaded');

    clickButton('Linked demo');
    const readbackRequest = http!.expectOne((req) => (
      req.method === 'GET' && req.url === reviewerEndpoint
    ));
    expect(readbackRequest.request.params.get('fixture')).toBe('linked');
    readbackRequest.flush(reviewerDocsFixture());
    await settle();

    expect(pageText()).toContain('Local snapshot');
    expect(pageText()).toContain('ADSEXEC-DRYRUN-review-fixture-REQ-PREFLIGHT');
    expect(pageText()).toContain('Provider API');
    expect(pageText()).toContain('Execution now');
    expect(pageText()).toContain('Source-sync gate');
    expect(pageText()).toContain('google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001');

    await clickButtonAndSettle('Export JSON');

    const expectedFilename = 'ads-approval-evidence-reviewer-ADSAPPROVAL-review-fixture.json';
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:browser-approval-evidence-snapshot-1');
    expect(pageText()).toContain(expectedFilename);

    const exportedText = await exportedBlobs[0].text();
    const parsed = service.parseLocalSnapshotJson(exportedText);
    expect(parsed.error).toBeNull();
    expect(parsed.snapshot).toBeTruthy();
    const exportedSnapshot = parsed.snapshot!;
    expect(exportedSnapshot.schemaVersion).toBe('ads_approval_evidence_reviewer_docs_local_snapshot.v1');
    expect(exportedSnapshot.snapshotMode).toBe('local_browser_download');
    expect(exportedSnapshot.omittedPayloads).toEqual(['providerRawPayload', 'liveExecutionPayload']);
    expect(exportedSnapshot.provider_api_called).toBeFalse();
    expect(exportedSnapshot.google_ads_api_called).toBeFalse();
    expect(exportedSnapshot.validateOnly_called).toBeFalse();
    expect(exportedSnapshot.execution_allowed_now).toBeFalse();
    expect(exportedSnapshot.source_sync.gate_status).toBe('blocked');
    expect(exportedSnapshot.source_sync.blocking_reasons).toEqual([
      'google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001',
    ]);
    expect(exportedSnapshot.source_sync.source_keys).toEqual([
      'google_ads:campaign_budget:HTX-BG-BUDGET-001',
      'erp:ads_decision_read_model:daily',
    ]);
    expect(exportedSnapshot.reviewerExportDigest.evidence_links.execution_record_ids).toEqual([
      'ADSEXEC-DRYRUN-review-fixture-REQ-PREFLIGHT',
    ]);

    await clickButtonAndSettle('Reset');

    expect(pageText()).toContain('No reviewer docs loaded');
    expect(pageText()).not.toContain(expectedFilename);
    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    compareSpy.calls.reset();

    await loadRenderedSnapshotFileText(exportedText, expectedFilename, 'Load A', 'leftSnapshotText');
    await loadRenderedSnapshotFileText(exportedText, expectedFilename, 'Load B', 'rightSnapshotText');

    expect(textareaValue('leftSnapshotText')).toBe(exportedText);
    expect(textareaValue('rightSnapshotText')).toBe(exportedText);
    expect(compareSpy).not.toHaveBeenCalled();

    await clickButtonAndSettle('Compare');

    const text = pageText();
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(text).toContain('Compare schema');
    expect(text).toContain('ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('Same key');
    expect(text).toContain('true');
    expect(text).toContain('No safety delta');
    expect(text).toContain('No evidence count delta');
    expect(text).toContain('No source-sync delta');

    const readySnapshotText = sourceSyncReadySnapshotText(exportedSnapshot);
    await clickButtonAndSettle('Clear');
    compareSpy.calls.reset();

    await loadRenderedSnapshotFileText(exportedText, expectedFilename, 'Load A', 'leftSnapshotText');
    await loadRenderedSnapshotFileText(
      readySnapshotText,
      'ads-approval-evidence-reviewer-ready-budget-source.json',
      'Load B',
      'rightSnapshotText',
    );
    await clickButtonAndSettle('Compare');

    const deltaText = pageText();
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(deltaText).toContain('Source-sync deltas');
    expect(deltaText).toContain('Gate status');
    expect(deltaText).toContain('Blocked source count');
    expect(deltaText).toContain('Blocker text');
    expect(deltaText).toContain('Source keys');
    expect(deltaText).toContain('Removed');
    expect(deltaText).toContain('Added');
    expect(deltaText).toContain('google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001');
    expect(deltaText).toContain('google_ads:campaign_budget:HTX-BG-BUDGET-002');

    await clickButtonAndSettle('Export Compare JSON');

    const expectedCompareAuditFilename = 'ads-approval-evidence-reviewer-compare-ADSAPPROVAL-review-fixture.json';
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:browser-approval-evidence-snapshot-2');
    expect(pageText()).toContain(expectedCompareAuditFilename);

    const compareAuditText = await exportedBlobs[1].text();
    const compareAudit = JSON.parse(compareAuditText);
    expect(compareAudit.schemaVersion).toBe(
      'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    );
    expect(compareAudit.exportMode).toBe('browser_local_compare_audit_handoff');
    expect(compareAudit.omittedPayloads).toEqual([
      'leftSnapshot',
      'rightSnapshot',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(compareAudit.provider_api_called).toBeFalse();
    expect(compareAudit.google_ads_api_called).toBeFalse();
    expect(compareAudit.live_ads_execution_used).toBeFalse();
    expect(compareAudit.execution_allowed_now).toBeFalse();

    await loadRenderedCompareAuditFileText(compareAuditText, expectedCompareAuditFilename);

    expect(compareAuditReadbackSpy).toHaveBeenCalledTimes(1);
    expect(compareAuditReadbackSpy.calls.argsFor(0)[0]).toBe(compareAuditText);
    expect(textareaValue('compareAuditText')).toBe(compareAuditText);

    const readbackText = pageText();
    expect(readbackText).toContain('Compare audit readback');
    expect(readbackText).toContain('Saved JSON import');
    expect(readbackText).toContain('Audit schema');
    expect(readbackText).toContain(
      'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    );
    expect(readbackText).toContain('Omitted payloads');
    expect(readbackText).toContain('providerRawPayload');
    expect(readbackText).toContain('Provider API');
    expect(readbackText).toContain('Google Ads API');
    expect(readbackText).toContain('Live ads execution');
    expect(readbackText).toContain('Execution now');
    expect(readbackText).toContain('Readback safety deltas');
    expect(readbackText).toContain('No safety delta');
    expect(readbackText).toContain('Readback evidence deltas');
    expect(readbackText).toContain('Blocked source-sync');
    expect(readbackText).toContain('Readback source-sync');
    expect(readbackText).toContain('Gate status');
    expect(readbackText).toContain('Blocked source count');
    expect(readbackText).toContain('Blocker text');
    expect(readbackText).toContain('Source keys');
    expect(readbackText).toContain('google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001');
    expect(readbackText).toContain('google_ads:campaign_budget:HTX-BG-BUDGET-002');

    await clickButtonAndSettle('Stage Source-Sync Handoff');

    const stagedHandoff = localStorage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY);
    expect(stagedHandoff).toBeTruthy();
    const stagedBundle = JSON.parse(stagedHandoff || '{}');
    expect(stagedBundle.schemaVersion).toBe('ads_approval_to_source_sync_status_handoff_prefill.v1');
    expect(stagedBundle.local_only).toBeTrue();
    expect(stagedBundle.provider_api_called).toBeFalse();
    expect(stagedBundle.google_ads_api_called).toBeFalse();
    expect(stagedBundle.validateOnly_called).toBeFalse();
    expect(stagedBundle.execution_allowed_now).toBeFalse();
    expect(pageText()).toContain('Source-sync handoff staged from');

    const maliciousCompareAuditText = JSON.stringify({
      ...compareAudit,
      providerRawPayload: { customer_id: 'not-local-browser-smoke' },
    }, null, 2);
    await loadRenderedCompareAuditFileText(
      maliciousCompareAuditText,
      'ads-approval-evidence-reviewer-compare-provider-raw-payload.json',
    );

    expect(compareAuditReadbackSpy).toHaveBeenCalledTimes(3);
    expect(compareAuditReadbackSpy.calls.argsFor(2)[0]).toBe(maliciousCompareAuditText);
    expect(textareaValue('compareAuditText')).toBe(maliciousCompareAuditText);
    expect(pageText()).toContain(
      'Compare audit JSON contains forbidden payload field: providerRawPayload',
    );
    http!.expectNone(reviewerEndpoint);
  });

  it('blocks token-valid users without ai-data-pack marketer-read permission before rendering reviewer docs', async () => {
    const employee = userForRole(UserRole.EMPLOYEE);
    await setup(employee);

    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);

    const routed = await navigateToReviewer(employee);
    expect(routed).toBeFalse();
    await waitForRouterUrl('/unauthorized');

    const text = pageText();
    expect(router.url).toBe('/unauthorized');
    expect(text).toContain('RBAC blocked');
    expect(text).not.toContain('Approval evidence reviewer');
    http!.expectNone(reviewerEndpoint);
  });

  it('clicks approval evidence source-sync status link with report date and source keys', async () => {
    const marketer = userForRole(UserRole.MANAGER);
    await setup(marketer);

    expect(sourceSyncStatusRoute.canActivate).toContain(AuthGuard);
    expect(sourceSyncStatusRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(sourceSyncStatusRoute.data?.['featureModule']).toBe('ai-marketing');

    const routed = await navigateToReviewer(marketer);
    expect(routed).toBeTrue();

    clickButton('Linked demo');
    const readbackRequest = http!.expectOne((req) => (
      req.method === 'GET' && req.url === reviewerEndpoint
    ));
    readbackRequest.flush(reviewerDocsFixture());
    await settle();

    const sourceSyncLink = requiredLinkByText('Review source status');
    expectSourceSyncHref(sourceSyncLink.getAttribute('href'), {
      reportDate: '2026-07-04',
      sourceKeys: 'google_ads',
      now: '2026-07-04T06:20:00.000Z',
    });

    sourceSyncLink.click();
    fixture.detectChanges();
    await flushNextTokenValidation(marketer);
    await waitForRouterPath('/ai/ads-platform-source-sync-status-reviewer');

    expect(routerQueryParam('reportDate')).toBe('2026-07-04');
    expect(routerQueryParam('sourceKeys')).toBe('google_ads');
    expect(routerQueryParam('now')).toBe('2026-07-04T06:20:00.000Z');
    expect(pageText()).toContain('Platform source-sync status');
    expect(sourceSyncReportDateInput().value).toBe('2026-07-04');
    expect(sourceCheckbox('google_ads').checked).toBeTrue();
    expect(sourceCheckbox('advertising_costs').checked).toBeFalse();
    expect(sourceCheckbox('product_mapping').checked).toBeFalse();
    http!.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  async function setup(user: User): Promise<void> {
    localStorage.setItem('access_token', `browser-smoke-token-${user.role}`);
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
    service = TestBed.inject(AdsApprovalEvidenceReviewerService);
    fixture.detectChanges();
  }

  async function navigateToReviewer(user: User): Promise<boolean> {
    const navigation = router.navigateByUrl('/ai/ads-approval-evidence-reviewer');
    await flushNextTokenValidation(user);
    const routed = await navigation;
    await settle();
    return routed;
  }

  async function flushNextTokenValidation(user: User): Promise<void> {
    const validateRequest = await waitForHttpRequest((req) => (
      req.method === 'POST' && req.url === '/api/auth/validate-token'
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

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function clickButton(label: string): void {
    const button = buttonByText(label);
    expect(button.disabled).toBeFalse();
    button.click();
    fixture.detectChanges();
  }

  async function clickButtonAndSettle(label: string): Promise<void> {
    clickButton(label);
    await settle();
  }

  function buttonByText(label: string): HTMLButtonElement {
    const button = (Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[]).find((candidate) => candidate.textContent?.trim() === label);

    if (!button) {
      throw new Error(`Missing rendered button: ${label}`);
    }

    return button;
  }

  function requiredLinkByText(text: string): HTMLAnchorElement {
    const link = (Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    ) as HTMLAnchorElement[]).find((candidate) => candidate.textContent?.trim() === text) || null;

    if (!link) {
      throw new Error(`Missing rendered link: ${text}`);
    }

    return link;
  }

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

  function routerQueryParam(name: string): string | null {
    return new URL(router.url, 'http://localhost').searchParams.get(name);
  }

  function sourceSyncReportDateInput(): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(
      'input[name="reportDate"]',
    ) as HTMLInputElement | null;

    if (!input) {
      throw new Error('Missing source-sync reportDate input');
    }

    return input;
  }

  function sourceCheckbox(sourceKey: string): HTMLInputElement {
    const label = (Array.from(
      fixture.nativeElement.querySelectorAll('.source-picker label'),
    ) as HTMLLabelElement[]).find((candidate) => (
      candidate.textContent?.trim() === sourceLabel(sourceKey)
    )) || null;
    const input = label?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

    if (!input) {
      throw new Error(`Missing source checkbox: ${sourceKey}`);
    }

    return input;
  }

  function sourceLabel(sourceKey: string): string {
    if (sourceKey === 'google_ads') return 'Google Ads';
    if (sourceKey === 'advertising_costs') return 'Advertising costs';
    if (sourceKey === 'product_mapping') return 'Product mapping';
    return sourceKey;
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

  function fileInputByLabel(labelText: 'Load A' | 'Load B' | 'Load Audit'): HTMLInputElement {
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
    const textarea = fixture.nativeElement.querySelector(
      `textarea[name="${name}"]`,
    ) as HTMLTextAreaElement | null;

    if (!textarea) {
      throw new Error(`Missing rendered textarea: ${name}`);
    }

    return textarea.value;
  }

  function pageText(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent || '';
  }

  async function waitForRouterUrl(expectedUrl: string): Promise<void> {
    const deadline = Date.now() + 1000;

    while (router.url !== expectedUrl) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for router URL ${expectedUrl}; current URL ${router.url}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    }
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
      id: `browser-smoke-${role}`,
      email: `${role}@example.local`,
      fullName: `Browser Smoke ${role}`,
      role,
      isActive: true,
    };
  }

  async function waitForRouterPath(expectedPath: string): Promise<void> {
    const deadline = Date.now() + 1000;

    while (!router.url.startsWith(`${expectedPath}?`) && router.url !== expectedPath) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for router path ${expectedPath}; current URL ${router.url}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    }
  }

  function requiredReviewerRoute(): Route {
    return requiredRoute('ai/ads-approval-evidence-reviewer');
  }

  function requiredRoute(path: string): Route {
    const route = routes.find((item) => item.path === path);

    if (!route) {
      throw new Error(`Missing ${path} route`);
    }

    return route;
  }
});

function sourceSyncReadySnapshotText(
  snapshot: AdsApprovalEvidenceReviewerDocsLocalSnapshot,
): string {
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

  return JSON.stringify(next, null, 2);
}

function reviewerDocsFixture(): AdsApprovalEvidenceReviewerDocsResponse {
  const executionId = 'ADSEXEC-DRYRUN-review-fixture-REQ-PREFLIGHT';
  const validationId = 'ADSPROVIDERVALIDATE-review-fixture';
  const policyId = 'ADSPOLICY-review-fixture-REQ-POLICY';
  const sourceSyncSourceKey = 'google_ads:campaign_budget:HTX-BG-BUDGET-001';
  const sourceSyncBlocker = 'google_ads_source_stale:campaign_budget:HTX-BG-BUDGET-001';
  const fixtureScenario = 'linked_budget_update_evidence';

  return {
    schemaVersion: 'ads_automation_approval_evidence_reviewer_docs.v1',
    generatedAt: '2026-07-04T06:20:00.000Z',
    docsMode: 'local_demo_fixture_docs',
    query: {
      approval_id: 'ADSAPPROVAL-review-fixture',
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
      docs_status: 'ready_for_review',
      docs_mode: 'local_demo_fixture_docs',
      source_export_mode: 'local_demo_fixture',
      export_status: 'ready_for_review',
      total_evidence_records_rendered: 5,
      validateOnly_evidence_records_rendered: 1,
      policy_decision_records_rendered: 1,
      execution_preflight_records_rendered: 1,
      pending_approval_record_rendered: true,
      source_sync_decision_evidence_records_rendered: 2,
      source_sync_decision_blocked_sources_rendered: 1,
      source_sync_gate_status: 'blocked',
      source_sync_can_generate_action_draft: false,
      source_sync_can_use_google_ads_data_claim: false,
      source_sync_blocking_reasons_rendered: [sourceSyncBlocker],
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
    routeExamples: [
      {
        label: 'Reviewer docs',
        method: 'GET',
        path: '/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-docs',
        query: `fixture=${fixtureScenario}`,
        purpose: 'Render operator-facing approval evidence sections for one approval id.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
      {
        label: 'Reviewer export JSON',
        method: 'GET',
        path: '/ai/ads-automation/decision-draft-approvals/ADSAPPROVAL-review-fixture/evidence-index/reviewer-export',
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
        status: 'ready_for_review',
        lines: [
          'Approval ID: ADSAPPROVAL-review-fixture',
          'Export mode: local_demo_fixture',
          'Evidence records: 5',
          'Next action: inspect_reviewer_export',
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
        status: 'ready_for_review',
        lines: [
          `Execution records: ${executionId}`,
          `Linked validate-only evidence: ${validationId}`,
          'Missing validate-only evidence: none',
          `Linked policy decisions: ${policyId}`,
          'Missing policy decisions: none',
        ],
        evidence_record_ids: [executionId, validationId, policyId],
      },
      {
        section_id: 'source_sync_evidence',
        title: 'Source Sync Evidence',
        status: 'attention',
        lines: [
          'Pending approval source-sync record: found',
          'Source-sync gate status: blocked',
          'Source-sync evidence records: 2',
          'Source-sync blocked sources: 1',
          `Source-sync blocking reasons: ${sourceSyncBlocker}`,
          `Source-sync source keys: ${sourceSyncSourceKey}, erp:ads_decision_read_model:daily`,
        ],
        evidence_record_ids: [sourceSyncSourceKey, 'erp:ads_decision_read_model:daily'],
      },
      {
        section_id: 'review_checklist',
        title: 'Review Checklist',
        status: 'attention',
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
      'Approval ID: ADSAPPROVAL-review-fixture',
      'Export status: ready_for_review',
      'Evidence records: 5',
      `Execution records: ${executionId}`,
      `Linked validate-only evidence: ${validationId}`,
      `Linked policy decisions: ${policyId}`,
      'Source-sync gate status: blocked',
      `Source-sync blockers: ${sourceSyncBlocker}`,
      'Safety gates: execution_allowed_now=false, provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false',
    ].join('\n'),
    reviewerExport: {
      schemaVersion: 'ads_automation_approval_evidence_review_export.v1',
      exportMode: 'local_demo_fixture',
      fixture: {
        fixture_id: `ADS_APPROVAL_EVIDENCE_REVIEW_FIXTURE:ADSAPPROVAL-review-fixture:${fixtureScenario}`,
        scenario: fixtureScenario,
        source: 'erp_local_demo_fixture',
        description: 'Local reviewer fixture for one approved Google campaign budget update with linked validate-only, policy, and preflight evidence.',
        persisted_to_db: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      },
      evidenceIndex: {
        links: {
          execution_record_ids: [executionId],
          validateOnly_validation_ids_from_preflight: [validationId],
          validateOnly_validation_ids_with_evidence: [validationId],
          validateOnly_validation_ids_missing_evidence: [],
          policy_decision_ids_from_preflight: [policyId],
          policy_decision_ids_with_evidence: [policyId],
          policy_decision_ids_missing_evidence: [],
        },
        sourceSyncDecisionEvidence: [
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
        ],
        sourceSyncDecisionGates: {
          canGenerateActionDraft: false,
          canUseGoogleAdsDataClaim: false,
          blockingReasons: [sourceSyncBlocker],
        },
      },
    },
  };
}
