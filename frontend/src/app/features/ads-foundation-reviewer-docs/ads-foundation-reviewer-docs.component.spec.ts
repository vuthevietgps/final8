import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap } from '@angular/router';
import { ReplaySubject } from 'rxjs';
import { AdsFoundationReviewerDocsComponent } from './ads-foundation-reviewer-docs.component';
import {
  ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_EMPTY_SNAPSHOT_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_MALFORMED_SNAPSHOT_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_MISSING_COMPARE_FIELDS_SNAPSHOT_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_COMPARE_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_SNAPSHOT_FILE_FIXTURE,
  ADS_FOUNDATION_REVIEWER_DOCS_WRONG_SCHEMA_SNAPSHOT_FILE_FIXTURE,
} from './ads-foundation-reviewer-docs.local-fixture';
import { AdsFoundationReviewerDocsService } from './ads-foundation-reviewer-docs.service';

describe('AdsFoundationReviewerDocsComponent', () => {
  let fixture: ComponentFixture<AdsFoundationReviewerDocsComponent>;
  let component: AdsFoundationReviewerDocsComponent;
  let http: HttpTestingController;
  let queryParamMap: ReplaySubject<ParamMap>;
  let originalFileReader: typeof FileReader | null;
  const renderedFileTextByName = new Map<string, string>();

  beforeEach(async () => {
    queryParamMap = new ReplaySubject<ParamMap>(1);
    originalFileReader = null;
    renderedFileTextByName.clear();

    await TestBed.configureTestingModule({
      imports: [AdsFoundationReviewerDocsComponent],
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

    fixture = TestBed.createComponent(AdsFoundationReviewerDocsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    if (originalFileReader) {
      Object.defineProperty(window, 'FileReader', {
        configurable: true,
        writable: true,
        value: originalFileReader,
      });
    }

    http.verify();
  });

  function compareJsonWithFoundationOmissionDelta(): string {
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const right = service.buildLocalSnapshot(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    const left = {
      ...right,
      comparisonKey: 'baseline-import-with-full-foundation-payload',
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

    return JSON.stringify(service.compareLocalSnapshots(left, right));
  }

  async function loadCompareFile(payload: unknown, filename: string): Promise<void> {
    await loadCompareFileText(JSON.stringify(payload, null, 2), filename);
  }

  async function loadCompareFileText(contents: string, filename: string): Promise<void> {
    const input = document.createElement('input');
    const file = new File([contents], filename, {
      type: 'application/json',
    });
    Object.defineProperty(input, 'files', { value: [file] });

    component.loadCompareResultFile({ target: input } as unknown as Event);
    await new Promise((resolve) => setTimeout(resolve, 100));
    fixture.detectChanges();
  }

  async function loadSnapshotFile(
    payload: unknown,
    filename: string,
    side: 'left' | 'right',
  ): Promise<void> {
    await loadSnapshotFileText(JSON.stringify(payload, null, 2), filename, side);
  }

  async function loadSnapshotFileText(
    contents: string,
    filename: string,
    side: 'left' | 'right',
  ): Promise<void> {
    const input = document.createElement('input');
    const file = new File([contents], filename, {
      type: 'application/json',
    });
    Object.defineProperty(input, 'files', { value: [file] });

    component.loadSnapshotFile({ target: input } as unknown as Event, side);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  async function loadRenderedSnapshotFileText(
    contents: string,
    filename: string,
    side: 'left' | 'right',
  ): Promise<void> {
    fixture.detectChanges();
    const labelText = side === 'left' ? 'Load A' : 'Load B';
    const label = (Array.from(
      fixture.nativeElement.querySelectorAll('label.file-button'),
    ) as HTMLLabelElement[]).find((candidate) => candidate.textContent?.trim() === labelText);
    const input = label?.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File([contents], filename, {
      type: 'application/json',
    });

    expect(label).toBeTruthy();
    expect(input).toBeTruthy();
    if (!input) return;

    renderedFileTextByName.set(filename, contents);
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForSnapshotText(side, contents);
    fixture.detectChanges();
  }

  async function waitForSnapshotText(side: 'left' | 'right', contents: string): Promise<void> {
    const snapshotText = () => (
      side === 'left' ? component.leftSnapshotText : component.rightSnapshotText
    );
    const deadline = Date.now() + 1000;

    while (snapshotText() !== contents) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for rendered ${side} snapshot file input`);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
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

  function textareaValue(name: string): string {
    const textarea = fixture.nativeElement.querySelector(
      `textarea[name="${name}"]`,
    ) as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    return textarea?.value || '';
  }

  async function setTextareaValue(name: string, value: string): Promise<void> {
    const textarea = fixture.nativeElement.querySelector(
      `textarea[name="${name}"]`,
    ) as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    if (!textarea) return;

    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function clickButton(label: string): Promise<void> {
    const button = (Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[]).find((candidate) => candidate.textContent?.trim() === label);
    expect(button).toBeTruthy();
    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function seedStaleLocalCompareResult(): Promise<void> {
    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-a-stale.json',
      'left',
    );
    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-b-stale.json',
      'right',
    );
    component.compareSnapshots();
    fixture.detectChanges();

    expect(component.compareError()).toBeNull();
    expect(component.compareResult()?.schemaVersion).toBe(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
  }

  async function expectValidSnapshotRecoveryAfterInvalidFile(options: {
    side: 'left' | 'right';
    expectedError: string;
    loadInvalidFile: () => Promise<void>;
    validPayload: unknown;
    validFilename: string;
  }): Promise<void> {
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();

    await seedStaleLocalCompareResult();
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.calls.reset();

    await options.loadInvalidFile();
    fixture.detectChanges();

    expect(component.compareResult()).toBeNull();
    expect(component.compareError()).toBe(options.expectedError);
    expect(fixture.nativeElement.textContent).toContain(options.expectedError);
    expect(compareSpy).not.toHaveBeenCalled();

    await loadSnapshotFile(options.validPayload, options.validFilename, options.side);
    fixture.detectChanges();

    expect(component.compareResult()).toBeNull();
    expect(component.compareError()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(options.expectedError);
    expect(compareSpy).not.toHaveBeenCalled();

    component.compareSnapshots();
    fixture.detectChanges();

    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(component.compareError()).toBeNull();
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(component.compareResult()?.schemaVersion).toBe(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(component.compareResult()?.leftComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE.comparisonKey,
    );
    expect(component.compareResult()?.rightComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE.comparisonKey,
    );
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  }

  function seedStaleCompareImportExportState(): void {
    component.compareResult.set(ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE);
    component.lastCompareImportName.set(
      'Compare import accepted: stale-compare-before-recovery.json',
    );
    component.lastCompareExportName.set(
      'ads-foundation-reviewer-docs-compare-stale-before-recovery.json',
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.compareResult()).toEqual(ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE);
    expect(text).toContain('Compare import accepted: stale-compare-before-recovery.json');
    expect(text).toContain('ads-foundation-reviewer-docs-compare-stale-before-recovery.json');
  }

  async function seedClearResetCompareState(): Promise<void> {
    await loadCompareFile(
      ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-compare-stale-import-before-clear-reset.json',
    );

    component.docs.set(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    fixture.detectChanges();
    await setTextareaValue(
      'leftSnapshotText',
      JSON.stringify(
        ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
        null,
        2,
      ),
    );
    await setTextareaValue(
      'rightSnapshotText',
      JSON.stringify(
        ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
        null,
        2,
      ),
    );
    await setTextareaValue(
      'compareImportText',
      compareJsonWithFoundationOmissionDelta(),
    );
    component.compareError.set('Compare import: stale visible compare error');
    component.lastExportName.set('ads-foundation-reviewer-docs-stale-local-snapshot.json');
    component.lastCompareExportName.set(
      'ads-foundation-reviewer-docs-compare-stale-before-clear-reset.json',
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.docs()).toEqual(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    expect(component.compareResult()).toEqual(ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE);
    expect(component.lastCompareImportName()).toBe(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-stale-import-before-clear-reset.json',
    );
    expect(component.lastCompareExportName()).toBe(
      'ads-foundation-reviewer-docs-compare-stale-before-clear-reset.json',
    );
    expect(textareaValue('leftSnapshotText')).toContain(
      'ads_foundation_reviewer_docs_local_snapshot.v1',
    );
    expect(textareaValue('rightSnapshotText')).toContain(
      'ads_foundation_reviewer_docs_local_snapshot.v1',
    );
    expect(textareaValue('compareImportText')).toContain(
      'baseline-import-with-full-foundation-payload',
    );
    expect(text).toContain('Compare import: stale visible compare error');
    expect(text).toContain(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-stale-import-before-clear-reset.json',
    );
    expect(text).toContain('ads-foundation-reviewer-docs-compare-stale-before-clear-reset.json');
    expect(text).toContain('Compare schema');
    expect(text).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('false -> true');
  }

  async function loadValidCompareImport(
    mode: 'file' | 'paste',
    label: string,
  ): Promise<string> {
    const validJson = JSON.stringify(ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE, null, 2);

    if (mode === 'file') {
      await loadCompareFileText(validJson, label);
      return `Compare import accepted: ${label}`;
    }

    component.compareImportText = validJson;
    component.validateCompareImport();
    fixture.detectChanges();
    return 'Compare import accepted: pasted compare JSON';
  }

  async function expectValidCompareRecoveryAfterInvalidImport(options: {
    expectedError: string;
    loadInvalidImport: () => Promise<void> | void;
    recoverWith: 'file' | 'paste';
    validLabel: string;
  }): Promise<void> {
    seedStaleCompareImportExportState();

    await options.loadInvalidImport();
    fixture.detectChanges();

    expect(component.compareResult()).toBeNull();
    expect(component.compareError()).toBe(options.expectedError);
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(options.expectedError);
    expect(fixture.nativeElement.textContent).not.toContain(
      'Compare import accepted: stale-compare-before-recovery.json',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'ads-foundation-reviewer-docs-compare-stale-before-recovery.json',
    );
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');

    const acceptedLabel = await loadValidCompareImport(options.recoverWith, options.validLabel);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.compareError()).toBeNull();
    expect(component.compareResult()).toEqual(ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE);
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBe(acceptedLabel);
    expect(component.compareImportText).toContain(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(text).toContain(acceptedLabel);
    expect(text).not.toContain(options.expectedError);
    expect(text).not.toContain('stale-compare-before-recovery');
    expect(text).toContain('Compare schema');
    expect(text).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('false -> true');
    expect(text).toContain('Provider API');
    expect(text).toContain('Full snapshot payload');
    expect(text).toContain('closed');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  }

  it('renders an initial local demo query without fetching docs', () => {
    fixture.detectChanges();

    expect(component.docs()).toBeNull();
    expect(component.snapshotDate).toBe('2026-07-04');
    expect(fixture.nativeElement.textContent).toContain('No foundation reviewer docs loaded');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('prefills read-model filters from route query params without fetching docs', () => {
    queryParamMap.next(convertToParamMap({
      snapshotDate: '2026-07-05',
      from: '2026-06-22',
      to: '2026-07-05',
      days: '14',
      customerIds: '1234567890, 2234567890',
      productIds: 'P_SCALE',
      now: '2026-07-05T05:00:00.000Z',
    }));
    fixture.detectChanges();

    expect(component.snapshotDate).toBe('2026-07-05');
    expect(component.customerIds).toBe('1234567890, 2234567890');
    expect(component.productIds).toBe('P_SCALE');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('loads the local demo payload and renders safety, stale evidence, missing budget evidence, and markdown', () => {
    fixture.detectChanges();

    component.loadDemoPayload();

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
    request.flush(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.docs()?.docsMode).toBe('local_readback_docs');
    expect(component.safetyGates().every((gate) => gate.pass)).toBeTrue();
    expect(component.campaignBudgetSection()?.status).toBe('attention');
    expect(component.attentionSections().map((section) => section.section_id)).toEqual([
      'source_evidence',
      'query_evidence',
      'campaign_budget_join',
      'review_checklist',
    ]);
    expect(text).toContain('Missing campaignBudgetId_or_campaignBudgetResourceName for ad groups: 2001');
    expect(text).toContain('campaignId/adGroupId are not fallback budget IDs');
    expect(text).toContain('campaignBudgetId_fallback_used=false');
    expect(text).toContain('campaign_budgets: stale');
    expect(text).toContain('campaign_budgets/ad_group/2001: missing');
    expect(text).toContain('Full foundationSnapshot payload included: false');
    expect(text).toContain('foundationSnapshot');
    expect(text).toContain('Local snapshot');
    expect(text).toContain('Provider API');
    expect(text).toContain('Google Ads API');
    expect(text).toContain('Validate-only');
    expect(text).toContain('Execution now');
    expect(text).toContain('Full snapshot payload');
  });

  it('builds a local reviewer-docs snapshot that keeps safety gates closed and omits the full foundation payload', () => {
    fixture.detectChanges();

    component.loadDemoPayload();
    const request = http.expectOne('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
    request.flush(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    fixture.detectChanges();

    const snapshot = JSON.parse(component.snapshotJson());

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
    expect(snapshot.omittedPayloads).toEqual(['foundationSnapshot']);
    expect(snapshot.sourceExportDigest.omitted_payloads).toEqual(['foundationSnapshot']);
    expect(snapshot.foundationSnapshot).toBeUndefined();
    expect(snapshot.comparisonKey).toContain('validateOnly_called=false');
    expect(snapshot.comparisonKey).toContain('execution_allowed_now=false');
  });

  it('downloads the local reviewer-docs snapshot as JSON without making another API request', () => {
    fixture.detectChanges();
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:ads-foundation-snapshot');
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    component.loadDemoPayload();
    const request = http.expectOne('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
    request.flush(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    fixture.detectChanges();
    component.downloadLocalSnapshot();

    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
    expect(createObjectUrlSpy).toHaveBeenCalledWith(jasmine.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:ads-foundation-snapshot');
    expect(component.lastExportName()).toBe('ads-foundation-reviewer-docs-2026-07-04.json');
  });

  it('round-trips exported local snapshot JSON through Reset and rendered Load A/B file inputs without a backend request', async () => {
    fixture.detectChanges();
    installImmediateRenderedFileReader();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake((value: Blob | MediaSource) => {
      exportedBlobs.push(value as Blob);
      return `blob:ads-foundation-snapshot-round-trip-${exportedBlobs.length}`;
    });
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    component.docs.set(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    component.leftSnapshotText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      null,
      2,
    );
    component.rightSnapshotText = JSON.stringify(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
      null,
      2,
    );
    component.compareImportText = '{"schemaVersion":"stale-before-snapshot-round-trip-reset"}';
    component.compareError.set('Snapshot import: stale before round-trip reset');
    component.compareResult.set(ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE);
    component.lastCompareImportName.set(
      'Compare import accepted: stale-before-snapshot-round-trip-reset.json',
    );
    component.lastCompareExportName.set(
      'ads-foundation-reviewer-docs-compare-stale-before-snapshot-round-trip-reset.json',
    );
    fixture.detectChanges();

    await clickButton('Export JSON');

    const expectedFilename = 'ads-foundation-reviewer-docs-2026-07-04.json';
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:ads-foundation-snapshot-round-trip-1');
    expect(exportedBlobs.length).toBe(1);
    expect(component.lastExportName()).toBe(expectedFilename);

    const exportedText = await exportedBlobs[0].text();
    const exportedSnapshot = JSON.parse(exportedText);
    expect(service.parseLocalSnapshotJson(exportedText).snapshot).toEqual(exportedSnapshot);
    expect(exportedSnapshot.schemaVersion).toBe('ads_foundation_reviewer_docs_local_snapshot.v1');
    expect(exportedSnapshot.snapshotMode).toBe('local_browser_download');
    expect(exportedSnapshot.omittedPayloads).toEqual(['foundationSnapshot']);
    expect(exportedSnapshot.foundationSnapshot).toBeUndefined();
    expect(exportedSnapshot.provider_api_called).toBeFalse();
    expect(exportedSnapshot.google_ads_api_called).toBeFalse();
    expect(exportedSnapshot.validateOnly_called).toBeFalse();
    expect(exportedSnapshot.execution_allowed_now).toBeFalse();

    let text = fixture.nativeElement.textContent;
    expect(text).toContain(expectedFilename);
    expect(text).toContain('Snapshot import: stale before round-trip reset');
    expect(text).toContain('Compare import accepted: stale-before-snapshot-round-trip-reset.json');
    expect(text).toContain(
      'ads-foundation-reviewer-docs-compare-stale-before-snapshot-round-trip-reset.json',
    );
    expect(text).toContain('Compare schema');

    await clickButton('Reset');

    text = fixture.nativeElement.textContent;
    expect(component.docs()).toBeNull();
    expect(component.lastExportName()).toBeNull();
    expect(component.leftSnapshotText).toBe('');
    expect(component.rightSnapshotText).toBe('');
    expect(component.compareImportText).toBe('');
    expect(component.compareError()).toBeNull();
    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    expect(textareaValue('compareImportText')).toBe('');
    expect(text).not.toContain(expectedFilename);
    expect(text).not.toContain('Snapshot import: stale before round-trip reset');
    expect(text).not.toContain('stale-before-snapshot-round-trip-reset');
    expect(text).not.toContain('Compare schema');
    compareSpy.calls.reset();

    await loadRenderedSnapshotFileText(exportedText, expectedFilename, 'left');
    await loadRenderedSnapshotFileText(exportedText, expectedFilename, 'right');

    expect(component.leftSnapshotText).toBe(exportedText);
    expect(component.rightSnapshotText).toBe(exportedText);
    expect(component.compareError()).toBeNull();
    expect(component.compareResult()).toBeNull();
    expect(component.lastExportName()).toBeNull();
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(textareaValue('leftSnapshotText')).toBe(exportedText);
    expect(textareaValue('rightSnapshotText')).toBe(exportedText);
    expect(compareSpy).not.toHaveBeenCalled();

    await clickButton('Compare');

    text = fixture.nativeElement.textContent;
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(component.compareError()).toBeNull();
    expect(component.compareResult()?.schemaVersion).toBe(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(component.compareResult()?.sameComparisonKey).toBeTrue();
    expect(component.compareResult()?.leftComparisonKey).toBe(exportedSnapshot.comparisonKey);
    expect(component.compareResult()?.rightComparisonKey).toBe(exportedSnapshot.comparisonKey);
    expect(component.compareResult()?.foundationSnapshotOmissionDelta).toEqual({
      leftOmitted: true,
      rightOmitted: true,
      changed: false,
    });
    expect(component.compareResult()?.metricDeltas.every((delta) => !delta.changed)).toBeTrue();
    expect(component.changedSafetyDeltas()).toEqual([]);
    expect(component.changedAttentionSectionDeltas()).toEqual([]);
    expect(text).toContain('Compare schema');
    expect(text).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('Same key');
    expect(text).toContain('true');
    expect(text).toContain('Attention sections');
    expect(text).toContain('4 -> 4');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('true -> true');
    expect(text).toContain('No safety delta');
    expect(text).toContain('No attention delta');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects compare-result export when no local compare result exists', async () => {
    fixture.detectChanges();
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:empty-compare');
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
    component.lastCompareExportName.set('ads-foundation-reviewer-docs-compare-stale-invalid-export.json');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'ads-foundation-reviewer-docs-compare-stale-invalid-export.json',
    );

    await clickButton('Export Compare JSON');

    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.compareError()).toBe('Run a local compare before exporting compare JSON');
    expect(fixture.nativeElement.textContent).toContain('Run a local compare before exporting compare JSON');
    expect(fixture.nativeElement.textContent).not.toContain(
      'ads-foundation-reviewer-docs-compare-stale-invalid-export.json',
    );
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('keeps compare-result export filenames deterministic after local compare without a backend request', async () => {
    fixture.detectChanges();
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake((value: Blob | MediaSource) => {
      exportedBlobs.push(value as Blob);
      return `blob:ads-foundation-compare-${exportedBlobs.length}`;
    });
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    await setTextareaValue(
      'leftSnapshotText',
      JSON.stringify(ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE, null, 2),
    );
    await setTextareaValue(
      'rightSnapshotText',
      JSON.stringify(ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE, null, 2),
    );
    await clickButton('Compare');

    expect(component.compareError()).toBeNull();
    expect(component.compareResult()?.leftComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE.comparisonKey,
    );
    expect(component.compareResult()?.rightComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE.comparisonKey,
    );

    await setTextareaValue(
      'leftSnapshotText',
      JSON.stringify(ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE, null, 2),
    );
    await setTextareaValue(
      'rightSnapshotText',
      JSON.stringify(ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE, null, 2),
    );
    await clickButton('Export Compare JSON');

    const expectedFilename = 'ads-foundation-reviewer-docs-compare-2026-07-04T05-01-00.000Z.json';
    expect(component.lastCompareExportName()).toBe(expectedFilename);
    expect(component.compareError()).toBeNull();
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:ads-foundation-compare-1');
    expect(exportedBlobs.length).toBe(1);

    const exported = JSON.parse(await exportedBlobs[0].text());
    expect(exported.leftComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE.comparisonKey,
    );
    expect(exported.rightComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE.comparisonKey,
    );
    expect(exported.foundationSnapshot).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain(expectedFilename);
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('round-trips exported compare JSON after Reset and re-renders evidence without a backend request', async () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake((value: Blob | MediaSource) => {
      exportedBlobs.push(value as Blob);
      return `blob:ads-foundation-compare-round-trip-${exportedBlobs.length}`;
    });
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    await setTextareaValue(
      'leftSnapshotText',
      JSON.stringify(ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE, null, 2),
    );
    await setTextareaValue(
      'rightSnapshotText',
      JSON.stringify(ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE, null, 2),
    );
    await clickButton('Compare');
    await clickButton('Export Compare JSON');

    const expectedFilename = 'ads-foundation-reviewer-docs-compare-2026-07-04T05-01-00.000Z.json';
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:ads-foundation-compare-round-trip-1');
    expect(exportedBlobs.length).toBe(1);
    expect(component.lastCompareExportName()).toBe(expectedFilename);

    const exportedText = await exportedBlobs[0].text();
    const exportedCompare = JSON.parse(exportedText);
    expect(service.parseLocalSnapshotCompareJson(exportedText).compare).toEqual(exportedCompare);
    expect(exportedCompare.leftComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE.comparisonKey,
    );
    expect(exportedCompare.rightComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE.comparisonKey,
    );
    expect(exportedCompare.foundationSnapshot).toBeUndefined();

    component.compareImportText = '{"schemaVersion":"stale-before-round-trip-reset"}';
    component.compareError.set('Compare import: stale before round-trip reset');
    component.lastCompareImportName.set('Compare import accepted: stale-before-round-trip-reset.json');
    fixture.detectChanges();

    let text = fixture.nativeElement.textContent;
    expect(text).toContain('Compare import: stale before round-trip reset');
    expect(text).toContain('Compare import accepted: stale-before-round-trip-reset.json');

    await clickButton('Reset');

    text = fixture.nativeElement.textContent;
    expect(component.compareImportText).toBe('');
    expect(component.compareError()).toBeNull();
    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    expect(textareaValue('compareImportText')).toBe('');
    expect(text).not.toContain('Compare import: stale before round-trip reset');
    expect(text).not.toContain('Compare import accepted: stale-before-round-trip-reset.json');
    expect(text).not.toContain(expectedFilename);
    expect(text).not.toContain('Compare schema');
    expect(text).not.toContain('Provider Safety');

    await loadCompareFileText(exportedText, expectedFilename);

    text = fixture.nativeElement.textContent;
    expect(component.compareError()).toBeNull();
    expect(component.lastCompareImportName()).toBe(`Compare import accepted: ${expectedFilename}`);
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.compareImportText).toBe(exportedText);
    expect(component.compareResult()).toEqual(exportedCompare);
    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    expect(text).toContain(`Compare import accepted: ${expectedFilename}`);
    expect(text).toContain('Compare schema');
    expect(text).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('Attention sections');
    expect(text).toContain('5 -> 4');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('true -> true');
    expect(text).toContain('Provider Safety');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('exports the current in-memory compare result as JSON without making a backend request', async () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const right = service.buildLocalSnapshot(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    const left = {
      ...right,
      comparisonKey: 'baseline-provider-open-with-full-foundation-payload',
      safety: {
        ...right.safety,
        provider_api_called: true,
        full_foundation_snapshot_payload_included: true,
      },
      sourceExportDigest: {
        ...right.sourceExportDigest,
        omitted_payloads: [] as unknown as ['foundationSnapshot'],
        full_foundation_snapshot_payload_included: true,
      },
      omittedPayloads: [] as unknown as ['foundationSnapshot'],
      provider_api_called: true,
      full_foundation_snapshot_payload_included: true,
      foundationSnapshot: { redacted: false },
    };
    const compare = service.compareLocalSnapshots(left, right);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();
    const exportedBlobs: Blob[] = [];
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake((value: Blob | MediaSource) => {
      exportedBlobs.push(value as Blob);
      return 'blob:ads-foundation-compare';
    });
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    component.compareResult.set(compare);
    compareSpy.calls.reset();
    component.leftSnapshotText = JSON.stringify(right);
    component.rightSnapshotText = JSON.stringify(right);
    component.downloadCompareResult();
    fixture.detectChanges();

    expect(compareSpy).not.toHaveBeenCalled();
    expect(createObjectUrlSpy).toHaveBeenCalledWith(jasmine.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:ads-foundation-compare');
    expect(component.lastCompareExportName()).toBe(
      'ads-foundation-reviewer-docs-compare-2026-07-04T05-01-00.000Z.json',
    );
    expect(component.compareError()).toBeNull();
    expect(exportedBlobs.length).toBe(1);

    const exported = JSON.parse(await exportedBlobs[0].text());
    expect(exported.schemaVersion).toBe('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(exported.leftComparisonKey).toBe('baseline-provider-open-with-full-foundation-payload');
    expect(exported.rightComparisonKey).toBe(right.comparisonKey);
    expect(exported.foundationSnapshotOmissionDelta).toEqual({
      leftOmitted: false,
      rightOmitted: true,
      changed: true,
    });
    expect(exported.foundationSnapshot).toBeUndefined();
    expect(JSON.stringify(exported)).toContain('foundationSnapshotOmissionDelta');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('clears stale compare export filenames when compare results are imported locally', async () => {
    fixture.detectChanges();

    component.compareResult.set(ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE);
    component.lastCompareExportName.set(
      'ads-foundation-reviewer-docs-compare-stale-before-paste-import.json',
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'ads-foundation-reviewer-docs-compare-stale-before-paste-import.json',
    );

    component.compareImportText = compareJsonWithFoundationOmissionDelta();
    component.validateCompareImport();
    fixture.detectChanges();

    expect(component.compareError()).toBeNull();
    expect(component.lastCompareImportName()).toBe('Compare import accepted: pasted compare JSON');
    expect(component.lastCompareExportName()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Compare import accepted: pasted compare JSON');
    expect(fixture.nativeElement.textContent).not.toContain(
      'ads-foundation-reviewer-docs-compare-stale-before-paste-import.json',
    );

    component.lastCompareExportName.set(
      'ads-foundation-reviewer-docs-compare-stale-before-file-import.json',
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'ads-foundation-reviewer-docs-compare-stale-before-file-import.json',
    );

    await loadCompareFile(
      ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-compare-valid-after-stale-export.json',
    );

    expect(component.compareError()).toBeNull();
    expect(component.lastCompareImportName()).toBe(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-valid-after-stale-export.json',
    );
    expect(component.lastCompareExportName()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-valid-after-stale-export.json',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'ads-foundation-reviewer-docs-compare-stale-before-file-import.json',
    );
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('accepts pasted compare-result export JSON and renders omission delta without a backend request', () => {
    fixture.detectChanges();

    component.compareImportText = compareJsonWithFoundationOmissionDelta();
    component.validateCompareImport();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.compareError()).toBeNull();
    expect(component.lastCompareImportName()).toBe('Compare import accepted: pasted compare JSON');
    expect(component.compareResult()?.schemaVersion).toBe(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(component.compareResult()?.foundationSnapshotOmissionDelta).toEqual({
      leftOmitted: false,
      rightOmitted: true,
      changed: true,
    });
    expect(text).toContain('Compare import accepted: pasted compare JSON');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('false -> true');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('accepts a non-empty exported compare-result file through Load Compare without a backend request', async () => {
    fixture.detectChanges();

    await loadCompareFile(
      ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-compare-valid.json',
    );

    const text = fixture.nativeElement.textContent;
    expect(component.compareError()).toBeNull();
    expect(component.lastCompareImportName()).toBe(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-valid.json',
    );
    expect(component.compareImportText).toContain(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(component.compareResult()).toEqual(ADS_FOUNDATION_REVIEWER_DOCS_COMPARE_FILE_FIXTURE);
    expect(component.compareResult()?.foundationSnapshotOmissionDelta).toEqual({
      leftOmitted: false,
      rightOmitted: true,
      changed: true,
    });
    expect(text).toContain('Compare import accepted: ads-foundation-reviewer-docs-compare-valid.json');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('false -> true');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('clears imported compare JSON, pasted text, local snapshot text, errors, status, and evidence without a backend request', async () => {
    fixture.detectChanges();

    await seedClearResetCompareState();

    await clickButton('Clear');

    const text = fixture.nativeElement.textContent;
    expect(component.docs()).toEqual(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    expect(component.leftSnapshotText).toBe('');
    expect(component.rightSnapshotText).toBe('');
    expect(component.compareImportText).toBe('');
    expect(component.compareError()).toBeNull();
    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    expect(textareaValue('compareImportText')).toBe('');
    expect(text).not.toContain('Compare import: stale visible compare error');
    expect(text).not.toContain(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-stale-import-before-clear-reset.json',
    );
    expect(text).not.toContain('ads-foundation-reviewer-docs-compare-stale-before-clear-reset.json');
    expect(text).not.toContain('baseline-import-with-full-foundation-payload');
    expect(text).not.toContain('Compare schema');
    expect(text).not.toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).not.toContain('foundationSnapshot omitted');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('resets imported compare JSON, pasted text, local snapshot text, errors, status, docs, and evidence without a backend request', async () => {
    fixture.detectChanges();

    await seedClearResetCompareState();
    component.error.set('stale docs load error before reset');
    fixture.detectChanges();

    await clickButton('Reset');

    const text = fixture.nativeElement.textContent;
    expect(component.docs()).toBeNull();
    expect(component.error()).toBeNull();
    expect(component.lastExportName()).toBeNull();
    expect(component.leftSnapshotText).toBe('');
    expect(component.rightSnapshotText).toBe('');
    expect(component.compareImportText).toBe('');
    expect(component.compareError()).toBeNull();
    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(component.snapshotDate).toBe('2026-07-04');
    expect(textareaValue('leftSnapshotText')).toBe('');
    expect(textareaValue('rightSnapshotText')).toBe('');
    expect(textareaValue('compareImportText')).toBe('');
    expect(text).toContain('No foundation reviewer docs loaded');
    expect(text).not.toContain('stale docs load error before reset');
    expect(text).not.toContain('ads-foundation-reviewer-docs-stale-local-snapshot.json');
    expect(text).not.toContain('Compare import: stale visible compare error');
    expect(text).not.toContain(
      'Compare import accepted: ads-foundation-reviewer-docs-compare-stale-import-before-clear-reset.json',
    );
    expect(text).not.toContain('ads-foundation-reviewer-docs-compare-stale-before-clear-reset.json');
    expect(text).not.toContain('baseline-import-with-full-foundation-payload');
    expect(text).not.toContain('Compare schema');
    expect(text).not.toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).not.toContain('foundationSnapshot omitted');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects invalid compare-result schema imports without a backend request', () => {
    fixture.detectChanges();

    component.compareImportText = JSON.stringify({
      schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot.v1',
    });
    component.validateCompareImport();
    fixture.detectChanges();

    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(component.compareError()).toContain(
      'Compare import: Compare schemaVersion must be ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Compare import: Compare schemaVersion must be ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects empty compare-result files without a backend request', () => {
    fixture.detectChanges();
    const input = document.createElement('input');
    const file = new File([''], 'empty-compare.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });

    component.loadCompareResultFile({ target: input } as unknown as Event);
    fixture.detectChanges();

    expect(component.compareImportText).toBe('');
    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(component.compareError()).toBe('Compare import: Compare JSON is required');
    expect(fixture.nativeElement.textContent).toContain('Compare import: Compare JSON is required');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects unsafe compare-result files that include a foundationSnapshot payload', async () => {
    fixture.detectChanges();

    await loadCompareFile(
      ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_COMPARE_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-compare-unsafe.json',
    );

    expect(component.compareImportText).toContain('foundationSnapshot');
    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(component.compareError()).toBe(
      'Compare import: Compare JSON must not include foundationSnapshot payload',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Compare import: Compare JSON must not include foundationSnapshot payload',
    );
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('recovers pasted compare JSON after an empty compare-result file without a backend request', async () => {
    fixture.detectChanges();

    await expectValidCompareRecoveryAfterInvalidImport({
      expectedError: 'Compare import: Compare JSON is required',
      loadInvalidImport: () => loadCompareFileText(
        '',
        'ads-foundation-reviewer-docs-compare-empty.json',
      ),
      recoverWith: 'paste',
      validLabel: 'unused-for-pasted-compare-json',
    });
  });

  it('recovers a compare-result file after malformed pasted compare JSON without a backend request', async () => {
    fixture.detectChanges();

    await expectValidCompareRecoveryAfterInvalidImport({
      expectedError: 'Compare import: Compare JSON is not valid JSON',
      loadInvalidImport: () => {
        component.compareImportText = [
          '{',
          '"schemaVersion":"ads_foundation_reviewer_docs_local_snapshot_compare.v1",',
          '"leftComparisonKey":"baseline"',
        ].join('');
        component.validateCompareImport();
      },
      recoverWith: 'file',
      validLabel: 'ads-foundation-reviewer-docs-compare-valid-after-malformed.json',
    });
  });

  it('recovers pasted compare JSON after a wrong-schema compare-result file without a backend request', async () => {
    fixture.detectChanges();

    await expectValidCompareRecoveryAfterInvalidImport({
      expectedError: 'Compare import: Compare schemaVersion must be ads_foundation_reviewer_docs_local_snapshot_compare.v1',
      loadInvalidImport: () => loadCompareFile(
        { schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot.v1' },
        'ads-foundation-reviewer-docs-compare-wrong-schema.json',
      ),
      recoverWith: 'paste',
      validLabel: 'unused-for-pasted-compare-json',
    });
  });

  it('recovers a compare-result file after pasted compare JSON missing fields without a backend request', async () => {
    fixture.detectChanges();

    await expectValidCompareRecoveryAfterInvalidImport({
      expectedError: 'Compare import: Compare JSON is missing reviewer-docs compare fields',
      loadInvalidImport: () => {
        component.compareImportText = JSON.stringify({
          schemaVersion: 'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
        });
        component.validateCompareImport();
      },
      recoverWith: 'file',
      validLabel: 'ads-foundation-reviewer-docs-compare-valid-after-missing-fields.json',
    });
  });

  it('recovers pasted compare JSON after an unsafe compare-result file without a backend request', async () => {
    fixture.detectChanges();

    await expectValidCompareRecoveryAfterInvalidImport({
      expectedError: 'Compare import: Compare JSON must not include foundationSnapshot payload',
      loadInvalidImport: () => loadCompareFile(
        ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_COMPARE_FILE_FIXTURE,
        'ads-foundation-reviewer-docs-compare-unsafe-before-recovery.json',
      ),
      recoverWith: 'paste',
      validLabel: 'unused-for-pasted-compare-json',
    });
  });

  it('accepts non-empty local snapshot files through Load A and Load B and compares locally', async () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();

    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-a-valid.json',
      'left',
    );
    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-b-valid.json',
      'right',
    );

    expect(component.leftSnapshotText).toContain('ads_foundation_reviewer_docs_local_snapshot.v1');
    expect(component.leftSnapshotText).toContain('provider_safety');
    expect(component.rightSnapshotText).toContain('ads_foundation_reviewer_docs_local_snapshot.v1');
    expect(component.compareResult()).toBeNull();

    component.compareSnapshots();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(component.compareError()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(component.compareResult()?.schemaVersion).toBe(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(component.compareResult()?.leftComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE.comparisonKey,
    );
    expect(component.compareResult()?.rightComparisonKey).toBe(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE.comparisonKey,
    );
    expect(component.compareResult()?.foundationSnapshotOmissionDelta).toEqual({
      leftOmitted: true,
      rightOmitted: true,
      changed: false,
    });
    expect(component.compareResult()?.metricDeltas.some((delta) => delta.changed)).toBeTrue();
    expect(text).toContain('Compare schema');
    expect(text).toContain('ads_foundation_reviewer_docs_local_snapshot_compare.v1');
    expect(text).toContain('foundationSnapshot omitted');
    expect(text).toContain('true -> true');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects unsafe snapshot files with full foundationSnapshot evidence without a backend request', async () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();

    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_UNSAFE_SNAPSHOT_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-a-unsafe.json',
      'left',
    );
    fixture.detectChanges();

    expect(component.leftSnapshotText).toContain('foundationSnapshot');
    expect(component.leftSnapshotText).toContain('full_foundation_snapshot_payload_included');
    expect(component.compareResult()).toBeNull();
    expect(component.compareError()).toBe(
      'Snapshot A: Snapshot JSON must not include foundationSnapshot payload',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Snapshot A: Snapshot JSON must not include foundationSnapshot payload',
    );
    expect(compareSpy).not.toHaveBeenCalled();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects empty Snapshot A files during local file load without a backend request', async () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();

    await loadSnapshotFileText(
      ADS_FOUNDATION_REVIEWER_DOCS_EMPTY_SNAPSHOT_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-a-empty.json',
      'left',
    );
    fixture.detectChanges();

    expect(component.leftSnapshotText).toBe('');
    expect(component.compareResult()).toBeNull();
    expect(component.lastCompareExportName()).toBeNull();
    expect(component.lastCompareImportName()).toBeNull();
    expect(component.compareError()).toBe('Snapshot A: Snapshot JSON is required');
    expect(fixture.nativeElement.textContent).toContain('Snapshot A: Snapshot JSON is required');
    expect(compareSpy).not.toHaveBeenCalled();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects malformed Snapshot B files during local file load without a backend request', async () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();

    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-a-valid.json',
      'left',
    );
    await loadSnapshotFileText(
      ADS_FOUNDATION_REVIEWER_DOCS_MALFORMED_SNAPSHOT_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-b-malformed.json',
      'right',
    );
    fixture.detectChanges();

    expect(component.leftSnapshotText).toContain('ads_foundation_reviewer_docs_local_snapshot.v1');
    expect(component.rightSnapshotText).toBe(ADS_FOUNDATION_REVIEWER_DOCS_MALFORMED_SNAPSHOT_FILE_FIXTURE);
    expect(component.compareResult()).toBeNull();
    expect(component.compareError()).toBe('Snapshot B: Snapshot JSON is not valid JSON');
    expect(fixture.nativeElement.textContent).toContain('Snapshot B: Snapshot JSON is not valid JSON');
    expect(compareSpy).not.toHaveBeenCalled();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects wrong-schema Snapshot A files during local file load without a backend request', async () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();

    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_WRONG_SCHEMA_SNAPSHOT_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-a-wrong-schema.json',
      'left',
    );
    fixture.detectChanges();

    expect(component.leftSnapshotText).toContain(
      'ads_automation_decision_foundation_read_model_reviewer_docs.v1',
    );
    expect(component.compareResult()).toBeNull();
    expect(component.compareError()).toBe(
      'Snapshot A: Snapshot schemaVersion must be ads_foundation_reviewer_docs_local_snapshot.v1',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Snapshot A: Snapshot schemaVersion must be ads_foundation_reviewer_docs_local_snapshot.v1',
    );
    expect(compareSpy).not.toHaveBeenCalled();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('rejects Snapshot B files missing reviewer-docs compare fields without a backend request', async () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const compareSpy = spyOn(service, 'compareLocalSnapshots').and.callThrough();

    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-a-valid.json',
      'left',
    );
    await loadSnapshotFile(
      ADS_FOUNDATION_REVIEWER_DOCS_MISSING_COMPARE_FIELDS_SNAPSHOT_FILE_FIXTURE,
      'ads-foundation-reviewer-docs-snapshot-b-missing-fields.json',
      'right',
    );
    fixture.detectChanges();

    expect(component.rightSnapshotText).toContain(
      'local-invalid-missing-reviewer-docs-compare-fields',
    );
    expect(component.compareResult()).toBeNull();
    expect(component.compareError()).toBe(
      'Snapshot B: Snapshot is missing reviewer-docs compare fields',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Snapshot B: Snapshot is missing reviewer-docs compare fields',
    );
    expect(compareSpy).not.toHaveBeenCalled();
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('recovers Snapshot A after an empty local file and compares locally without a backend request', async () => {
    fixture.detectChanges();

    await expectValidSnapshotRecoveryAfterInvalidFile({
      side: 'left',
      expectedError: 'Snapshot A: Snapshot JSON is required',
      loadInvalidFile: () => loadSnapshotFileText(
        ADS_FOUNDATION_REVIEWER_DOCS_EMPTY_SNAPSHOT_FILE_FIXTURE,
        'ads-foundation-reviewer-docs-snapshot-a-empty.json',
        'left',
      ),
      validPayload: ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      validFilename: 'ads-foundation-reviewer-docs-snapshot-a-valid-after-empty.json',
    });
  });

  it('recovers Snapshot B after a malformed local file and compares locally without a backend request', async () => {
    fixture.detectChanges();

    await expectValidSnapshotRecoveryAfterInvalidFile({
      side: 'right',
      expectedError: 'Snapshot B: Snapshot JSON is not valid JSON',
      loadInvalidFile: () => loadSnapshotFileText(
        ADS_FOUNDATION_REVIEWER_DOCS_MALFORMED_SNAPSHOT_FILE_FIXTURE,
        'ads-foundation-reviewer-docs-snapshot-b-malformed.json',
        'right',
      ),
      validPayload: ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
      validFilename: 'ads-foundation-reviewer-docs-snapshot-b-valid-after-malformed.json',
    });
  });

  it('recovers Snapshot A after a wrong-schema local file and compares locally without a backend request', async () => {
    fixture.detectChanges();

    await expectValidSnapshotRecoveryAfterInvalidFile({
      side: 'left',
      expectedError: 'Snapshot A: Snapshot schemaVersion must be ads_foundation_reviewer_docs_local_snapshot.v1',
      loadInvalidFile: () => loadSnapshotFile(
        ADS_FOUNDATION_REVIEWER_DOCS_WRONG_SCHEMA_SNAPSHOT_FILE_FIXTURE,
        'ads-foundation-reviewer-docs-snapshot-a-wrong-schema.json',
        'left',
      ),
      validPayload: ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_A_FILE_FIXTURE,
      validFilename: 'ads-foundation-reviewer-docs-snapshot-a-valid-after-wrong-schema.json',
    });
  });

  it('recovers Snapshot B after a missing-fields local file and compares locally without a backend request', async () => {
    fixture.detectChanges();

    await expectValidSnapshotRecoveryAfterInvalidFile({
      side: 'right',
      expectedError: 'Snapshot B: Snapshot is missing reviewer-docs compare fields',
      loadInvalidFile: () => loadSnapshotFile(
        ADS_FOUNDATION_REVIEWER_DOCS_MISSING_COMPARE_FIELDS_SNAPSHOT_FILE_FIXTURE,
        'ads-foundation-reviewer-docs-snapshot-b-missing-fields.json',
        'right',
      ),
      validPayload: ADS_FOUNDATION_REVIEWER_DOCS_SNAPSHOT_B_FILE_FIXTURE,
      validFilename: 'ads-foundation-reviewer-docs-snapshot-b-valid-after-missing-fields.json',
    });
  });

  it('shows invalid local snapshot errors without making an API request', () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const snapshot = service.buildLocalSnapshot(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);

    component.leftSnapshotText = JSON.stringify({
      schemaVersion: 'ads_automation_decision_foundation_read_model_reviewer_docs.v1',
      snapshotMode: 'local_browser_download',
    });
    component.rightSnapshotText = JSON.stringify(snapshot);
    component.compareSnapshots();
    fixture.detectChanges();

    expect(component.compareResult()).toBeNull();
    expect(component.compareError()).toContain(
      'Snapshot A: Snapshot schemaVersion must be ads_foundation_reviewer_docs_local_snapshot.v1',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Snapshot A: Snapshot schemaVersion must be ads_foundation_reviewer_docs_local_snapshot.v1',
    );
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });

  it('renders closed safety-gate deltas from an in-memory local compare result', () => {
    fixture.detectChanges();
    const service = TestBed.inject(AdsFoundationReviewerDocsService);
    const right = service.buildLocalSnapshot(ADS_FOUNDATION_REVIEWER_DOCS_LOCAL_FIXTURE);
    const left = {
      ...right,
      comparisonKey: 'baseline-provider-open',
      safety: {
        ...right.safety,
        provider_api_called: true,
      },
      provider_api_called: true,
    };

    component.compareResult.set(service.compareLocalSnapshots(left, right));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(component.compareResult()?.schemaVersion).toBe(
      'ads_foundation_reviewer_docs_local_snapshot_compare.v1',
    );
    expect(component.changedSafetyDeltas().map((delta) => delta.key)).toContain('provider_api_called');
    expect(text).toContain('Provider API');
    expect(text).toContain('true -> false');
    expect(text).toContain('closed');
    expect(text).toContain('Missing query evidence');
    expect(text).toContain('foundationSnapshot omitted');
    http.expectNone('/api/ai/ads-automation/decision-foundation-read-model-reviewer-docs');
  });
});
