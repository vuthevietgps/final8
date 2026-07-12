import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router, RouterOutlet } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';
import { User, UserRole } from '../../core/models/auth.interface';
import { routes } from '../../app.routes';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import {
  ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_MALFORMED_SNAPSHOT_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_COMPARE_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_SNAPSHOT_FILE_FIXTURE,
} from './ads-foundation-reviewer-docs.local-fixture';
import { AdsFoundationReviewerDocsService } from './ads-foundation-reviewer-docs.service';

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

describe('AdsFoundationReviewerDocs browser smoke', () => {
  const reviewerEndpoint = '/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs';
  const sidebarFoundationRoute = '/ai/ads-foundation-reviewer-docs';
  const reviewerRoute = requiredReviewerRoute();
  const smokeRoutes: Route[] = [
    reviewerRoute,
    { path: 'login', component: BrowserSmokeBlockedComponent },
    { path: 'unauthorized', component: BrowserSmokeBlockedComponent },
    { path: 'upgrade-plan', component: BrowserSmokeBlockedComponent },
  ];
  const renderedFileTextByName = new Map<string, string>();

  let fixture: ComponentFixture<BrowserSmokeHostComponent>;
  let router: Router;
  let http: HttpTestingController | null = null;
  let service: AdsFoundationReviewerDocsService;
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
  });

  it('routes through marketer-read RBAC and round-trips rendered export, reset, Load A/B, and compare locally', async () => {
    const marketer = userForRole(UserRole.MANAGER);
    await setup(marketer);
    installImmediateRenderedFileReader();

    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake(
      (value: Blob | MediaSource) => {
        exportedBlobs.push(value as Blob);
        return `blob:browser-foundation-snapshot-${exportedBlobs.length}`;
      },
    );
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    expect(reviewerRoute.canActivate).toContain(AuthGuard);
    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(reviewerRoute.data?.['featureModule']).toBe('ai-marketing');

    const routed = await navigateToReviewerDocs(marketer);
    expect(routed).toBeTrue();
    expect(router.url).toBe('/ai/ads-foundation-reviewer-docs');
    expect(pageText()).toContain('Foundation reviewer docs');
    expect(pageText()).toContain('No foundation reviewer docs loaded');

    clickButton('Demo payload');
    const readbackRequest = http!.expectOne((req) => (
      req.method === 'POST' && req.url === reviewerEndpoint
    ));
    expect(readbackRequest.request.body).toEqual({
      snapshotDate: '2026-07-04',
      evidenceWindow: { from: '2026-06-21', to: '2026-07-04', days: 14 },
      customerIds: ['1234567890'],
      productIds: ['P_SCALE'],
      maxAgeHours: { campaign_budgets: 24, product_performance: 24 },
      now: '2026-07-04T05:00:00.000Z',
    });
    readbackRequest.flush(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    await settle();

    expect(pageText()).toContain('Local snapshot');
    expect(pageText()).toContain('Provider API');
    expect(pageText()).toContain('Execution now');

    await clickButtonAndSettle('Export JSON');

    const expectedFilename = 'ads-foundation-reviewer-docs-2026-07-04.json';
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:browser-foundation-snapshot-1');
    expect(pageText()).toContain(expectedFilename);

    const exportedText = await exportedBlobs[0].text();
    const parsed = service.parseLocalSnapshotJson(exportedText);
    expect(parsed.error).toBeNull();
    expect(parsed.snapshot).toBeTruthy();
    const exportedSnapshot = parsed.snapshot!;
    expect(exportedSnapshot.schemaVersion).toBe('ads_foundation_reviewer_docs_local_snapshot.v1');
    expect(exportedSnapshot.snapshotMode).toBe('local_browser_download');
    expect(exportedSnapshot.omittedPayloads).toEqual(['foundationSnapshot']);
    expect(
      (exportedSnapshot as unknown as { foundationSnapshot?: unknown }).foundationSnapshot,
    ).toBeUndefined();
    expect(exportedSnapshot.provider_api_called).toBeFalse();
    expect(exportedSnapshot.google_ads_api_called).toBeFalse();
    expect(exportedSnapshot.validateOnly_called).toBeFalse();
    expect(exportedSnapshot.execution_allowed_now).toBeFalse();

    await clickButtonAndSettle('Reset');

    expect(pageText()).toContain('No foundation reviewer docs loaded');
    expect(pageText()).not.toContain(expectedFilename);
    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    expect(textareaValue('compareImportText')).toBe('');
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
    expect(text).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('Same key');
    expect(text).toContain('true');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('true -> true');
    expect(text).toContain('No safety delta');
    expect(text).toContain('No attention delta');
    http!.expectNone(reviewerEndpoint);
  });

  it('recovers from unsafe and malformed local snapshot imports before comparing valid local files', async () => {
    const marketer = userForRole(UserRole.MANAGER);
    await setup(marketer);
    installImmediateRenderedFileReader();

    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();
    const routed = await navigateToReviewerDocs(marketer);

    expect(routed).toBeTrue();
    expect(router.url).toBe('/ai/ads-foundation-reviewer-docs');
    expect(pageText()).toContain('No foundation reviewer docs loaded');
    http!.expectNone(reviewerEndpoint);

    const unsafeSnapshotText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_SNAPSHOT_FILE_FIXTURE,
      null,
      2,
    );
    await loadRenderedSnapshotFileText(
      unsafeSnapshotText,
      'ads-foundation-reviewer-docs-snapshot-a-unsafe-browser.json',
      'Load A',
      'leftSnapshotText',
    );

    expect(textareaValue('leftSnapshotText')).toContain('foundationSnapshot');
    expect(compareSpy).not.toHaveBeenCalled();
    expect(pageText()).toContain(
      'Snapshot A: Snapshot JSON must not include foundationSnapshot payload',
    );
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    await loadRenderedSnapshotFileText(
      ADS_FOUNDATION_REVIEWER_DOCS_MALFORMED_SNAPSHOT_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-b-malformed-browser.json',
      'Load B',
      'rightSnapshotText',
    );

    expect(textareaValue('rightSnapshotText')).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_MALFORMED_SNAPSHOT_FILE_FIXTURE,
    );
    expect(compareSpy).not.toHaveBeenCalled();
    expect(pageText()).toContain('Snapshot B: Snapshot JSON is not valid JSON');
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    const validSnapshotAText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      null,
      2,
    );
    const validSnapshotBText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
      null,
      2,
    );
    await loadRenderedSnapshotFileText(
      validSnapshotAText,
      'ads-foundation-reviewer-docs-snapshot-a-valid-after-unsafe-browser.json',
      'Load A',
      'leftSnapshotText',
    );
    await loadRenderedSnapshotFileText(
      validSnapshotBText,
      'ads-foundation-reviewer-docs-snapshot-b-valid-after-malformed-browser.json',
      'Load B',
      'rightSnapshotText',
    );

    expect(textareaValue('leftSnapshotText')).toBe(validSnapshotAText);
    expect(textareaValue('rightSnapshotText')).toBe(validSnapshotBText);
    expect(pageText()).not.toContain('Snapshot JSON must not include foundationSnapshot payload');
    expect(pageText()).not.toContain('Snapshot JSON is not valid JSON');
    expect(compareSpy).not.toHaveBeenCalled();

    await clickButtonAndSettle('Compare');

    const text = pageText();
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(text).toContain('Compare schema');
    expect(text).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('true -> true');
    expect(text).toContain('Provider Safety');
    expect(text).toContain('attention -> missing');
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));
  });

  it('recovers from malformed, wrong-schema, and unsafe Load Compare imports before accepting a valid compare-result export', async () => {
    const marketer = userForRole(UserRole.MANAGER);
    await setup(marketer);
    installImmediateRenderedFileReader();

    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();
    const routed = await navigateToReviewerDocs(marketer);

    expect(routed).toBeTrue();
    expect(router.url).toBe('/ai/ads-foundation-reviewer-docs');
    expect(pageText()).toContain('No foundation reviewer docs loaded');
    http!.expectNone(reviewerEndpoint);

    const malformedCompareText = [
      '{',
      '"schemaVersion":"ads_foundation_reviewer_docs_local_snapshot_compare.v1",',
      '"leftComparisonKey":"baseline"',
    ].join('');
    await loadRenderedCompareFileText(
      malformedCompareText,
      'ads-foundation-reviewer-docs-compare-malformed-browser.json',
    );

    expect(textareaValue('compareImportText')).toBe(malformedCompareText);
    expect(compareSpy).not.toHaveBeenCalled();
    expect(pageText()).toContain('Compare import: Compare JSON is not valid JSON');
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    const wrongSchemaCompareText = JSON.stringify(
      { schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot.v1' },
      null,
      2,
    );
    await loadRenderedCompareFileText(
      wrongSchemaCompareText,
      'ads-foundation-reviewer-docs-compare-wrong-schema-browser.json',
    );

    expect(textareaValue('compareImportText')).toBe(wrongSchemaCompareText);
    expect(compareSpy).not.toHaveBeenCalled();
    expect(pageText()).toContain(
      'Compare import: Compare schemaVersion must be ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    const unsafeCompareText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_COMPARE_FILE_FIXTURE,
      null,
      2,
    );
    await loadRenderedCompareFileText(
      unsafeCompareText,
      'ads-foundation-reviewer-docs-compare-unsafe-browser.json',
    );

    expect(textareaValue('compareImportText')).toContain('foundationSnapshot');
    expect(compareSpy).not.toHaveBeenCalled();
    expect(pageText()).toContain(
      'Compare import: Compare JSON must not include foundationSnapshot payload',
    );
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    const validCompareText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE,
      null,
      2,
    );
    await loadRenderedCompareFileText(
      validCompareText,
      'ads-foundation-reviewer-docs-compare-valid-after-recovery-browser.json',
    );

    const text = pageText();
    expect(textareaValue('compareImportText')).toBe(validCompareText);
    expect(compareSpy).not.toHaveBeenCalled();
    expect(text).toContain(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-valid-after-recovery-browser.json',
    );
    expect(text).toContain('Compare schema');
    expect(text).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('false -> true');
    expect(text).not.toContain('Compare JSON is not valid JSON');
    expect(text).not.toContain(
      'Compare schemaVersion must be ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(text).not.toContain('Compare JSON must not include foundationSnapshot payload');
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));
  });

  it('round-trips a sanitized Export Compare JSON blob after Clear and Reset through rendered Load Compare', async () => {
    const marketer = userForRole(UserRole.MANAGER);
    await setup(marketer);
    installImmediateRenderedFileReader();

    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake(
      (value: Blob | MediaSource) => {
        exportedBlobs.push(value as Blob);
        return `blob:browser-foundation-compare-${exportedBlobs.length}`;
      },
    );
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
    const routed = await navigateToReviewerDocs(marketer);

    expect(routed).toBeTrue();
    expect(router.url).toBe('/ai/ads-foundation-reviewer-docs');
    expect(pageText()).toContain('No foundation reviewer docs loaded');
    http!.expectNone(reviewerEndpoint);

    const validSnapshotAText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      null,
      2,
    );
    const validSnapshotBText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
      null,
      2,
    );
    await loadRenderedSnapshotFileText(
      validSnapshotAText,
      'ads-foundation-reviewer-docs-snapshot-a-compare-export-browser.json',
      'Load A',
      'leftSnapshotText',
    );
    await loadRenderedSnapshotFileText(
      validSnapshotBText,
      'ads-foundation-reviewer-docs-snapshot-b-compare-export-browser.json',
      'Load B',
      'rightSnapshotText',
    );

    await clickButtonAndSettle('Compare');

    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(pageText()).toContain('Provider Safety');
    expect(pageText()).toContain('foundationSnapshot omitted');
    expect(pageText()).toContain('true -> true');
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    await clickButtonAndSettle('Export Compare JSON');

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:browser-foundation-compare-1');
    expect(pageText()).toContain('ads-foundation-reviewer-docs-compare-2026-07-04T05-01-00.000Z.json');

    const exportedCompareText = await exportedBlobs[0].text();
    const exportedCompareJson = JSON.parse(exportedCompareText) as Record<string, unknown>;
    const parsedExport = service.parseLocalSnapshotCompareJson(exportedCompareText);
    expect(parsedExport.error).toBeNull();
    expect(parsedExport.compare?.schemaVersion).toBe(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(hasNestedProperty(exportedCompareJson, 'foundationSnapshot')).toBeFalse();
    expect(exportedCompareText).not.toContain('"foundationSnapshot":');
    expect(parsedExport.compare?.foundationSnapshotOmissionDelta).toEqual({
      leftOmitted: true,
      rightOmitted: true,
      changed: false,
    });
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    await clickButtonAndSettle('Clear');

    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    expect(textareaValue('compareImportText')).toBe('');
    expect(pageText()).not.toContain('ads-foundation-reviewer-docs-compare-2026-07-04T05-01-00.000Z.json');
    expect(pageText()).not.toContain('Compare schema');
    expect(compareSpy).toHaveBeenCalledTimes(1);
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    await loadRenderedCompareFileText(
      exportedCompareText,
      'ads-foundation-reviewer-docs-compare-export-after-clear-browser.json',
    );

    expect(textareaValue('compareImportText')).toBe(exportedCompareText);
    expect(pageText()).toContain(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-export-after-clear-browser.json',
    );
    expect(pageText()).toContain('Compare schema');
    expect(compareSpy).toHaveBeenCalledTimes(1);
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    await clickButtonAndSettle('Reset');

    expect(pageText()).toContain('No foundation reviewer docs loaded');
    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    expect(textareaValue('compareImportText')).toBe('');
    expect(pageText()).not.toContain(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-export-after-clear-browser.json',
    );
    expect(pageText()).not.toContain('Compare schema');
    expect(compareSpy).toHaveBeenCalledTimes(1);
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));

    await loadRenderedCompareFileText(
      exportedCompareText,
      'ads-foundation-reviewer-docs-compare-export-after-reset-browser.json',
    );

    const finalText = pageText();
    expect(textareaValue('compareImportText')).toBe(exportedCompareText);
    expect(finalText).toContain(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-export-after-reset-browser.json',
    );
    expect(finalText).toContain('Compare schema');
    expect(finalText).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(finalText).toContain('foundationSnapshot omitted');
    expect(finalText).toContain('true -> true');
    expect(finalText).not.toContain('Compare JSON must not include foundationSnapshot payload');
    expect(compareSpy).toHaveBeenCalledTimes(1);
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));
  });

  it('routes from the sidebar entry for marketer-read users without automatic provider or docs calls', async () => {
    const marketer = userForRole(UserRole.MANAGER);
    await setup(marketer);

    expect(reviewerRoute.canActivate).toContain(AuthGuard);
    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(reviewerRoute.data?.['featureModule']).toBe('ai-marketing');

    const sidebarFixture = renderExpandedSidebar();
    const foundationItem = requiredSidebarMenuItem(
      sidebarFixture.componentInstance,
      sidebarFoundationRoute,
    );
    const foundationLink = requiredFoundationSidebarLink(sidebarFixture);

    expect(foundationItem.label).toBe('Ads Foundation Docs');
    expect(sidebarFixture.componentInstance.canShow(foundationItem)).toBeTrue();
    expect(foundationLink.getAttribute('href')).toBe(sidebarFoundationRoute);
    expect(foundationLink.textContent).toContain('Ads Foundation Docs');

    foundationLink.click();
    sidebarFixture.detectChanges();
    fixture.detectChanges();
    await flushNextTokenValidation(marketer);
    await waitForRouterUrl(sidebarFoundationRoute);

    expect(pageText()).toContain('Foundation reviewer docs');
    expect(pageText()).toContain('No foundation reviewer docs loaded');
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));
    sidebarFixture.destroy();
  });

  it('blocks token-valid users without ai-data-pack marketer-read permission before rendering reviewer docs', async () => {
    const employee = userForRole(UserRole.EMPLOYEE);
    await setup(employee);

    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);

    const routed = await navigateToReviewerDocs(employee);
    expect(routed).toBeFalse();
    await waitForRouterUrl('/unauthorized');

    const text = pageText();
    expect(router.url).toBe('/unauthorized');
    expect(text).toContain('RBAC blocked');
    expect(text).not.toContain('Foundation reviewer docs');
    http!.expectNone(reviewerEndpoint);
  });

  it('hides the sidebar foundation docs entry for token-valid users without marketer-read permission', async () => {
    const employee = userForRole(UserRole.EMPLOYEE);
    await setup(employee);

    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);

    const sidebarFixture = renderExpandedSidebar();
    const foundationItem = requiredSidebarMenuItem(
      sidebarFixture.componentInstance,
      sidebarFoundationRoute,
    );

    expect(sidebarFixture.componentInstance.canShow(foundationItem)).toBeFalse();
    expect(foundationSidebarLink(sidebarFixture)).toBeNull();
    http!.expectNone(reviewerEndpoint);
    http!.expectNone((req) => isUnsafeAdsOrMutationRequest(req.url, req.method));
    sidebarFixture.destroy();
  });

  async function setup(user: User): Promise<void> {
    localStorage.setItem('access_token', `browser-smoke-token-${user.role}`);
    localStorage.setItem('current_user', JSON.stringify(user));

    await TestBed.configureTestingModule({
      imports: [BrowserSmokeHostComponent, SidebarComponent],
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
    service = TestBed.inject(AdsFoundationReviewerDocsService);
    fixture.detectChanges();
  }

  async function navigateToReviewerDocs(user: User): Promise<boolean> {
    const navigation = router.navigateByUrl('/ai/ads-foundation-reviewer-docs');
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
    await settle();
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

  async function loadRenderedCompareFileText(contents: string, filename: string): Promise<void> {
    const input = fileInputByLabel('Load Compare');
    const file = new File([contents], filename, { type: 'application/json' });

    renderedFileTextByName.set(filename, contents);
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForTextareaValue('compareImportText', contents);
    fixture.detectChanges();
  }

  function fileInputByLabel(labelText: 'Load A' | 'Load B' | 'Load Compare'): HTMLInputElement {
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

  function hasNestedProperty(value: unknown, propertyName: string): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(value, propertyName)) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.some((item) => hasNestedProperty(item, propertyName));
    }

    return Object.values(value as Record<string, unknown>).some((item) => (
      hasNestedProperty(item, propertyName)
    ));
  }

  function renderExpandedSidebar(): ComponentFixture<SidebarComponent> {
    const sidebarFixture = TestBed.createComponent(SidebarComponent);

    spyOn(sidebarFixture.componentInstance, 'canShowAlerts').and.returnValue(false);
    sidebarFixture.componentInstance.expandedItems.add('/ai');
    sidebarFixture.detectChanges();
    flushPlanInfo();
    sidebarFixture.detectChanges();

    return sidebarFixture;
  }

  function flushPlanInfo(): void {
    const planRequest = http!.expectOne((req) => (
      req.method === 'GET' && req.url === '/api/plan/info'
    ));
    planRequest.flush({
      plan: 'enterprise',
      maxUsers: 'unlimited',
      currentUsers: 1,
      modules: ['*'],
    });
  }

  function foundationSidebarLink(
    sidebarFixture: ComponentFixture<SidebarComponent>,
  ): HTMLAnchorElement | null {
    return sidebarFixture.nativeElement.querySelector(
      `a[href="${sidebarFoundationRoute}"]`,
    ) as HTMLAnchorElement | null;
  }

  function requiredFoundationSidebarLink(
    sidebarFixture: ComponentFixture<SidebarComponent>,
  ): HTMLAnchorElement {
    const link = foundationSidebarLink(sidebarFixture);

    if (!link) {
      throw new Error('Missing Ads Foundation Docs sidebar link');
    }

    return link;
  }

  function requiredSidebarMenuItem(
    sidebar: SidebarComponent,
    route: string,
  ): SidebarSmokeMenuItem {
    const pending: SidebarSmokeMenuItem[] = [...sidebar.menuItems];

    while (pending.length) {
      const item = pending.shift()!;
      if (item.route === route) {
        return item;
      }
      pending.push(...(item.children || []));
    }

    throw new Error(`Missing sidebar menu item: ${route}`);
  }

  function isUnsafeAdsOrMutationRequest(url: string, method: string): boolean {
    const normalizedUrl = url.toLowerCase();
    const normalizedMethod = method.toUpperCase();

    return (
      normalizedUrl.includes('google-ads')
      || normalizedUrl.includes('provider-api')
      || normalizedUrl.includes('validateonly')
      || normalizedUrl.includes('live-execution')
      || normalizedUrl.includes('/execute')
      || (
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(normalizedMethod)
        && ![
          '/api/auth/validate-token',
          reviewerEndpoint,
        ].includes(url)
      )
    );
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

  function requiredReviewerRoute(): Route {
    const route = routes.find((item) => item.path === 'ai/ads-foundation-reviewer-docs');

    if (!route) {
      throw new Error('Missing ai/ads-foundation-reviewer-docs route');
    }

    return route;
  }
});

interface SidebarSmokeMenuItem {
  icon: string;
  label: string;
  route: string;
  children?: SidebarSmokeMenuItem[];
}
