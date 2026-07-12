import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE,
  ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE,
} from './ads-platform-source-sync-status-reviewer.local-fixture';
import {
  AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport,
  AdsPlatformSourceSyncStatusReviewerService,
} from './ads-platform-source-sync-status-reviewer.service';
import {
  buildAdsApprovalSourceSyncHandoffPrefillBundle,
} from './ads-approval-source-sync-handoff-prefill.util';

describe('AdsPlatformSourceSyncStatusReviewerService', () => {
  let service: AdsPlatformSourceSyncStatusReviewerService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdsPlatformSourceSyncStatusReviewerService,
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AdsPlatformSourceSyncStatusReviewerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('posts only the local source-sync status query to the protected endpoint', () => {
    service.loadStatus({
      reportDate: ' 2026-07-04 ',
      now: ' 2026-07-04T05:00:00.000Z ',
      sourceKeys: ['google_ads', 'advertising_costs', 'google_ads'],
    }).subscribe();

    const request = http.expectOne((req) => (
      req.method === 'POST'
      && req.url === '/api/ai/ads-automation/platform-source-sync-status'
    ));

    expect(request.request.body).toEqual({
      reportDate: '2026-07-04',
      now: '2026-07-04T05:00:00.000Z',
      sourceKeys: ['google_ads', 'advertising_costs'],
    });
    expect(JSON.stringify(request.request.body)).not.toContain('validateOnly');
    expect(JSON.stringify(request.request.body)).not.toContain('execute');
    request.flush(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
  });

  it('omits empty optional query fields from the POST body', () => {
    service.loadStatus({
      reportDate: '2026-07-04',
      now: '',
      sourceKeys: [],
    }).subscribe();

    const request = http.expectOne('/api/ai/ads-automation/platform-source-sync-status');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reportDate: '2026-07-04' });
    request.flush(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
  });

  it('builds a local snapshot digest with closed safety gates and no plaintext secret values', () => {
    const snapshot = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const rendered = JSON.stringify(snapshot);

    expect(snapshot.schemaVersion).toBe('ads_platform_source_sync_status_local_snapshot.v1');
    expect(snapshot.snapshotMode).toBe('local_browser_download');
    expect(snapshot.createdFromEndpoint).toBe(
      '/api/ai/ads-automation/platform-source-sync-status',
    );
    expect(snapshot.provider_api_called).toBeFalse();
    expect(snapshot.google_ads_api_called).toBeFalse();
    expect(snapshot.validateOnly_called).toBeFalse();
    expect(snapshot.live_ads_execution_used).toBeFalse();
    expect(snapshot.execution_allowed_now).toBeFalse();
    expect(snapshot.production_ready).toBeFalse();
    expect(snapshot.secret_values_omitted).toBeTrue();
    expect(snapshot.omittedPayloads).toEqual([
      'plaintextSecretValues',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(snapshot.sourceDigests[0].requiredConfigPresence[0].value_exposed).toBeFalse();
    expect(snapshot.sourceDigests[0].missingCredentialOrConfigBlockers).toContain(
      'missing_config:GOOGLE_ADS_CLIENT_SECRET',
    );
    expect(snapshot.sourceDigests[1].freshness.latestSuccessfulSyncOrReadModelWatermark).toBe(
      '2026-07-04T01:00:00.000Z',
    );
    expect(snapshot.comparisonKey).toContain('provider_api_called=false');
    expect(snapshot.comparisonKey).toContain('execution_allowed_now=false');
    expect(rendered).not.toMatch(/FORBIDDEN_PROVIDER_VALUE|FORBIDDEN_CLIENT_VALUE/i);
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('clones source arrays so local snapshot edits do not mutate the API response fixture', () => {
    const snapshot = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);

    snapshot.summary.blocked_sources.push('product_mapping');
    snapshot.sourceDigests[0].sourceSyncBlockers.push('local_mutation_probe');
    snapshot.sourceDigests[0].requiredConfigPresence[0].present = false;

    expect(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE.summary.blocked_sources).toEqual([
      'google_ads',
      'advertising_costs',
    ]);
    expect(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE.sources[0].sourceSyncBlockers).not.toContain(
      'local_mutation_probe',
    );
    expect(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE.sources[0].requiredConfigPresence[0].present)
      .toBeTrue();
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('parses and compares two exported source-sync status snapshots locally', () => {
    const left = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const right = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE);
    const parsedLeft = service.parseLocalSnapshotJson(JSON.stringify(left));
    const parsedRight = service.parseLocalSnapshotJson(JSON.stringify(right));

    expect(parsedLeft.error).toBeNull();
    expect(parsedRight.error).toBeNull();

    const compare = service.compareLocalSnapshots(parsedLeft.snapshot!, parsedRight.snapshot!);
    const googleAdsReadiness = compare.readinessDeltas.find((delta) => delta.sourceKey === 'google_ads');
    const advertisingCostsReadiness = compare.readinessDeltas.find((delta) => (
      delta.sourceKey === 'advertising_costs'
    ));
    const googleAdsBlockers = compare.blockerDeltas.find((delta) => delta.sourceKey === 'google_ads');
    const adsCostBlockers = compare.blockerDeltas.find((delta) => (
      delta.sourceKey === 'advertising_costs'
    ));

    expect(compare.schemaVersion).toBe('ads_platform_source_sync_status_local_snapshot_compare.v1');
    expect(compare.sameComparisonKey).toBeFalse();
    expect(compare.safetyGatesClosedOnRight).toBeTrue();
    expect(compare.metricDeltas.find((delta) => delta.key === 'ready_source_count')?.delta)
      .toBe(2);
    expect(compare.metricDeltas.find((delta) => delta.key === 'blocked_source_count')?.delta)
      .toBe(-2);
    expect(googleAdsReadiness?.leftStatus).toBe('missing_config');
    expect(googleAdsReadiness?.rightStatus).toBe('ready');
    expect(googleAdsReadiness?.rightCanUseForAdsAutomationDecision).toBeTrue();
    expect(advertisingCostsReadiness?.leftFreshnessStatus).toBe('stale');
    expect(advertisingCostsReadiness?.rightFreshnessStatus).toBe('fresh');
    expect(googleAdsBlockers?.missingConfigBlockers.removed).toContain(
      'missing_config:GOOGLE_ADS_CLIENT_SECRET',
    );
    expect(adsCostBlockers?.sourceSyncBlockers.removed).toContain('freshness_stale');
    expect(compare.decisionGateDeltas.find((delta) => delta.key === 'canGenerateActionDraft')?.changed)
      .toBeTrue();
    expect(compare.safetyDeltas.every((delta) => !delta.rightGateOpen)).toBeTrue();
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('exports and reads back a sanitized browser-local compare audit', () => {
    const left = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const right = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE);
    const compare = service.compareLocalSnapshots(left, right);
    const audit = service.buildLocalSnapshotCompareAuditExport(
      compare,
      '2026-07-05T10:00:00.000Z',
    );
    const parsedAudit = service.parseLocalSnapshotCompareAuditJson(JSON.stringify(audit));

    expect(audit.schemaVersion).toBe(
      'ads_platform_source_sync_status_local_snapshot_compare_audit_export.v1',
    );
    expect(audit.exportMode).toBe('browser_local_compare_audit_handoff');
    expect(audit.omittedPayloads).toEqual([
      'leftSnapshot',
      'rightSnapshot',
      'plaintextSecretValues',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(audit.provider_api_called).toBeFalse();
    expect(audit.google_ads_api_called).toBeFalse();
    expect(audit.validateOnly_called).toBeFalse();
    expect(audit.live_ads_execution_used).toBeFalse();
    expect(audit.execution_allowed_now).toBeFalse();
    expect(audit.production_ready).toBeFalse();
    expect(JSON.stringify(audit)).not.toContain('requiredConfigPresence');
    expect(parsedAudit.error).toBeNull();
    expect(parsedAudit.audit?.generatedAt).toBe('2026-07-05T10:00:00.000Z');
    expect(parsedAudit.audit?.readinessDeltas.some((delta) => delta.changed)).toBeTrue();
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('rejects snapshot and compare audit JSON that contains forbidden payload fields', () => {
    const snapshot = service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE);
    const snapshotParse = service.parseLocalSnapshotJson(JSON.stringify({
      ...snapshot,
      providerRawPayload: { customer_id: 'not-local' },
    }));
    const audit = service.buildLocalSnapshotCompareAuditExport(
      service.compareLocalSnapshots(
        snapshot,
        service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE),
      ),
      '2026-07-05T10:00:00.000Z',
    );
    const auditParse = service.parseLocalSnapshotCompareAuditJson(JSON.stringify({
      ...audit,
      leftSnapshot: snapshot,
    }));

    expect(snapshotParse.snapshot).toBeNull();
    expect(snapshotParse.error).toContain('providerRawPayload');
    expect(auditParse.audit).toBeNull();
    expect(auditParse.error).toContain('leftSnapshot');
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('parses approval compare audit handoff JSON and correlates blockers with source-sync snapshot compare', () => {
    const sourceSyncCompare = service.compareLocalSnapshots(
      service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_LOCAL_FIXTURE),
      service.buildLocalSnapshot(ADS_PLATFORM_SOURCE_SYNC_STATUS_READY_LOCAL_FIXTURE),
    );
    const approvalAudit = approvalCompareAudit();
    const parsedApprovalAudit = service.parseApprovalEvidenceCompareAuditJson(
      JSON.stringify(approvalAudit),
    );

    expect(parsedApprovalAudit.error).toBeNull();

    const handoff = service.buildApprovalEvidenceCompareHandoff(
      sourceSyncCompare,
      parsedApprovalAudit.audit!,
      '2026-07-05T11:00:00.000Z',
    );
    const googleAdsCorrelation = handoff.sourceCorrelations.find((correlation) => (
      correlation.sourceKey === 'google_ads'
    ));

    expect(handoff.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_compare_handoff.v1',
    );
    expect(handoff.generatedAt).toBe('2026-07-05T11:00:00.000Z');
    expect(handoff.approvalSourceSyncGateChanged).toBeTrue();
    expect(handoff.approvalSourceSyncRightGateStatus).toBe('ready');
    expect(handoff.approvalBlockedSourcesDelta).toBe(-1);
    expect(handoff.safetyGatesClosed).toBeTrue();
    expect(handoff.provider_api_called).toBeFalse();
    expect(handoff.google_ads_api_called).toBeFalse();
    expect(handoff.validateOnly_called).toBeFalse();
    expect(handoff.execution_allowed_now).toBeFalse();
    expect(handoff.omittedPayloads).toEqual([
      'approvalLeftSnapshot',
      'approvalRightSnapshot',
      'sourceSyncLeftSnapshot',
      'sourceSyncRightSnapshot',
      'plaintextSecretValues',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(googleAdsCorrelation).toBeTruthy();
    expect(googleAdsCorrelation?.matchedBy).toEqual([
      'approval_source_key',
      'approval_blocking_reason',
      'status_snapshot_source',
      'blocker_text',
    ]);
    expect(googleAdsCorrelation?.statusReadinessDelta?.leftStatus).toBe('missing_config');
    expect(googleAdsCorrelation?.statusReadinessDelta?.rightStatus).toBe('ready');
    expect(googleAdsCorrelation?.approvalSourceKeys.removed).toContain(
      'google_ads:campaign_budget:HTX-BG-BUDGET-001',
    );
    expect(googleAdsCorrelation?.approvalSourceKeys.added).toContain(
      'google_ads:campaignBudgetId:HTX-BG-BUDGET-002',
    );
    expect(googleAdsCorrelation?.approvalBlockingReasons.removed).toContain(
      'missing_config:GOOGLE_ADS_CLIENT_SECRET',
    );
    expect(googleAdsCorrelation?.statusBlockerDelta?.missingConfigBlockers.removed).toContain(
      'missing_config:GOOGLE_ADS_CLIENT_SECRET',
    );
    expect(googleAdsCorrelation?.blockerOverlap.removed).toEqual([
      'missing_config:GOOGLE_ADS_CLIENT_SECRET',
    ]);
    expect(googleAdsCorrelation?.correlationSummary).toBe('resolved_in_status_snapshot');
    expect(handoff.unmatchedApprovalSourceKeys).toEqual(['erp:ads_decision_read_model:daily']);
    expect(handoff.unmatchedApprovalBlockingReasons).toEqual([]);
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('parses browser-local approval handoff prefill bundles before correlation', () => {
    const approvalAudit = approvalCompareAudit();
    const approvalAuditJson = JSON.stringify(approvalAudit, null, 2);
    const built = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalAudit as unknown as Record<string, unknown>,
      approvalAuditJson,
      '2026-07-05T11:10:00.000Z',
    );

    expect(built.error).toBeNull();
    expect(built.bundle?.schemaVersion).toBe(
      'ads_approval_to_source_sync_status_handoff_prefill.v1',
    );
    expect(built.bundle?.local_only).toBeTrue();
    expect(built.bundle?.provider_api_called).toBeFalse();
    expect(built.bundle?.google_ads_api_called).toBeFalse();
    expect(built.bundle?.validateOnly_called).toBeFalse();
    expect(built.bundle?.live_ads_execution_used).toBeFalse();
    expect(built.bundle?.execution_allowed_now).toBeFalse();

    const parsed = service.parseApprovalEvidenceHandoffPrefillJson(
      JSON.stringify(built.bundle),
    );

    expect(parsed.error).toBeNull();
    expect(parsed.bundle?.generatedAt).toBe('2026-07-05T11:10:00.000Z');
    expect(parsed.audit).toEqual(approvalAudit);
    expect(parsed.audit?.sourceSyncDelta.sourceKeys.added).toEqual([
      'google_ads:campaignBudgetId:HTX-BG-BUDGET-002',
    ]);

    const freshStatus = service.describeApprovalEvidenceHandoffPrefill(
      parsed.bundle!,
      new Date('2026-07-05T11:40:00.000Z'),
    );
    const staleStatus = service.describeApprovalEvidenceHandoffPrefill(
      parsed.bundle!,
      new Date('2026-07-06T12:15:00.000Z'),
    );
    const thresholdStatus = service.describeApprovalEvidenceHandoffPrefill(
      parsed.bundle!,
      new Date('2026-07-06T11:10:00.000Z'),
    );

    expect(freshStatus).toEqual({
      bundleGeneratedAt: '2026-07-05T11:10:00.000Z',
      approvalCompareAuditGeneratedAt: '2026-07-05T10:30:00.000Z',
      ageMinutes: 30,
      ageLabel: '30m old',
      staleAfterMinutes: 1440,
      stale: false,
    });
    expect(staleStatus.ageMinutes).toBe(1505);
    expect(staleStatus.ageLabel).toBe('1d 1h 5m old');
    expect(staleStatus.stale).toBeTrue();
    expect(thresholdStatus.ageMinutes).toBe(1440);
    expect(thresholdStatus.ageLabel).toBe('1d 0h 0m old');
    expect(thresholdStatus.stale).toBeTrue();

    const openSafety = service.parseApprovalEvidenceHandoffPrefillJson(JSON.stringify({
      ...built.bundle,
      execution_allowed_now: true,
    }));
    const rawPayload = service.parseApprovalEvidenceHandoffPrefillJson(JSON.stringify({
      ...built.bundle,
      providerRawPayload: { customer_id: 'not-local' },
    }));

    expect(openSafety.audit).toBeNull();
    expect(openSafety.error).toBe(
      'Browser handoff prefill safety field execution_allowed_now must be false',
    );
    expect(rawPayload.audit).toBeNull();
    expect(rawPayload.error).toBe(
      'Browser handoff prefill contains forbidden payload field: providerRawPayload',
    );
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('builds a sanitized stale handoff override audit without embedded snapshots or provider payloads', () => {
    const approvalAudit = approvalCompareAudit();
    const approvalAuditJson = JSON.stringify(approvalAudit, null, 2);
    const built = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalAudit as unknown as Record<string, unknown>,
      approvalAuditJson,
      '2026-07-04T08:00:00.000Z',
    );
    expect(built.bundle).toBeTruthy();

    const status = service.describeApprovalEvidenceHandoffPrefill(
      built.bundle!,
      new Date('2026-07-05T09:05:00.000Z'),
    );
    const audit = service.buildApprovalEvidenceHandoffOverrideAuditExport(
      built.bundle!,
      status,
      '2026-07-05T09:05:30.000Z',
    );
    const parsedAudit = service.parseApprovalEvidenceHandoffOverrideAuditJson(
      JSON.stringify(audit),
    );
    const rendered = JSON.stringify(audit);

    expect(audit.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(audit.exportMode).toBe('browser_local_stale_handoff_import_override_audit');
    expect(audit.browserHandoffStagedAt).toBe('2026-07-04T08:00:00.000Z');
    expect(audit.approvalCompareAuditGeneratedAt).toBe('2026-07-05T10:30:00.000Z');
    expect(audit.staleAfterMinutes).toBe(1440);
    expect(audit.handoffAgeMinutesAtImport).toBe(1505);
    expect(audit.handoffWasStale).toBeTrue();
    expect(audit.reviewerImportTimestamp).toBe('2026-07-05T09:05:30.000Z');
    expect(audit.importState).toBe('explicit_stale_import');
    expect(audit.safetyGatesClosed).toBeTrue();
    expect(audit.secret_values_omitted).toBeTrue();
    expect(audit.provider_api_called).toBeFalse();
    expect(audit.google_ads_api_called).toBeFalse();
    expect(audit.validateOnly_called).toBeFalse();
    expect(audit.live_ads_execution_used).toBeFalse();
    expect(audit.execution_allowed_now).toBeFalse();
    expect(audit.google_ads_production_enabled).toBeFalse();
    expect(audit.omittedPayloads).toEqual([
      'approvalCompareAuditJson',
      'approvalLeftSnapshot',
      'approvalRightSnapshot',
      'sourceSyncLeftSnapshot',
      'sourceSyncRightSnapshot',
      'plaintextSecretValues',
      'providerRawPayload',
      'liveExecutionPayload',
    ]);
    expect(Object.prototype.hasOwnProperty.call(audit, 'approvalCompareAuditJson')).toBeFalse();
    expect(rendered).not.toContain('sourceSyncDelta');
    expect(rendered).not.toContain('HTX-BG-BUDGET-002');
    expect(rendered).not.toContain('missing_config:GOOGLE_ADS_CLIENT_SECRET');
    expect(parsedAudit.error).toBeNull();
    expect(parsedAudit.audit?.schemaVersion).toBe(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(parsedAudit.audit?.reviewerImportTimestamp).toBe('2026-07-05T09:05:30.000Z');
    expect(parsedAudit.audit?.safetyGatesClosed).toBeTrue();
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('rejects stale handoff override audit readback with embedded audit JSON, raw snapshots, provider payloads, or open safety gates', () => {
    const approvalAudit = approvalCompareAudit();
    const built = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      approvalAudit as unknown as Record<string, unknown>,
      JSON.stringify(approvalAudit, null, 2),
      '2026-07-04T08:00:00.000Z',
    );
    const status = service.describeApprovalEvidenceHandoffPrefill(
      built.bundle!,
      new Date('2026-07-05T09:05:00.000Z'),
    );
    const audit = service.buildApprovalEvidenceHandoffOverrideAuditExport(
      built.bundle!,
      status,
      '2026-07-05T09:05:30.000Z',
    );

    const wrongSchema = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    }));
    const embeddedApprovalJson = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      approvalCompareAuditJson: JSON.stringify(approvalAudit),
    }));
    const embeddedApprovalAuditFields = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      sourceSyncDelta: approvalAudit.sourceSyncDelta,
    }));
    const rawSnapshot = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      sourceSyncLeftSnapshot: { reportDate: '2026-07-04' },
    }));
    const providerPayload = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      providerRawPayload: { customer_id: 'not-local' },
    }));
    const plaintextSecret = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      plaintextSecretValues: { GOOGLE_ADS_CLIENT_SECRET: 'not-local-secret' },
    }));
    const openExecutionGate = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      execution_allowed_now: true,
    }));
    const openSafetyGate = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      safetyGatesClosed: false,
    }));
    const providerCall = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      provider_api_called: true,
    }));
    const googleAdsCall = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      google_ads_api_called: true,
    }));
    const validateOnlyCall = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      validateOnly_called: true,
    }));
    const liveExecution = service.parseApprovalEvidenceHandoffOverrideAuditJson(JSON.stringify({
      ...audit,
      live_ads_execution_used: true,
    }));

    expect(wrongSchema.audit).toBeNull();
    expect(wrongSchema.error).toContain(
      'ads_platform_source_sync_status_approval_handoff_override_audit_export.v1',
    );
    expect(embeddedApprovalJson.audit).toBeNull();
    expect(embeddedApprovalJson.error).toContain('approvalCompareAuditJson');
    expect(embeddedApprovalAuditFields.audit).toBeNull();
    expect(embeddedApprovalAuditFields.error).toContain('sourceSyncDelta');
    expect(rawSnapshot.audit).toBeNull();
    expect(rawSnapshot.error).toContain('sourceSyncLeftSnapshot');
    expect(providerPayload.audit).toBeNull();
    expect(providerPayload.error).toContain('providerRawPayload');
    expect(plaintextSecret.audit).toBeNull();
    expect(plaintextSecret.error).toContain('plaintextSecretValues');
    expect(openExecutionGate.audit).toBeNull();
    expect(openExecutionGate.error).toBe(
      'Import audit safety field execution_allowed_now must be false',
    );
    expect(openSafetyGate.audit).toBeNull();
    expect(openSafetyGate.error).toBe('Import audit safetyGatesClosed must be true');
    expect(providerCall.audit).toBeNull();
    expect(providerCall.error).toBe('Import audit safety field provider_api_called must be false');
    expect(googleAdsCall.audit).toBeNull();
    expect(googleAdsCall.error).toBe(
      'Import audit safety field google_ads_api_called must be false',
    );
    expect(validateOnlyCall.audit).toBeNull();
    expect(validateOnlyCall.error).toBe(
      'Import audit safety field validateOnly_called must be false',
    );
    expect(liveExecution.audit).toBeNull();
    expect(liveExecution.error).toBe(
      'Import audit safety field live_ads_execution_used must be false',
    );
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });

  it('rejects approval compare audit handoff JSON with raw payloads or open safety gates', () => {
    const audit = approvalCompareAudit();

    const forbiddenPayloadParse = service.parseApprovalEvidenceCompareAuditJson(JSON.stringify({
      ...audit,
      providerRawPayload: { customer_id: 'not-local' },
    }));
    const openSafetyParse = service.parseApprovalEvidenceCompareAuditJson(JSON.stringify({
      ...audit,
      execution_allowed_now: true,
    }));

    expect(forbiddenPayloadParse.audit).toBeNull();
    expect(forbiddenPayloadParse.error).toBe(
      'Approval compare audit JSON contains forbidden payload field: providerRawPayload',
    );
    expect(openSafetyParse.audit).toBeNull();
    expect(openSafetyParse.error).toBe(
      'Approval compare audit safety field execution_allowed_now must be false',
    );
    http.expectNone('/api/ai/ads-automation/platform-source-sync-status');
  });
});

function approvalCompareAudit(): AdsPlatformSourceSyncApprovalEvidenceCompareAuditExport {
  return {
    schemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    exportMode: 'browser_local_compare_audit_handoff',
    generatedAt: '2026-07-05T10:30:00.000Z',
    compareSchemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare.v1',
    leftComparisonKey: [
      'ads_automation_approval_evidence_reviewer_docs.v1',
      'local_demo_fixture_docs',
      'source_sync_gate=blocked',
      'campaignBudgetId=HTX-BG-BUDGET-001',
    ].join('|'),
    rightComparisonKey: [
      'ads_automation_approval_evidence_reviewer_docs.v1',
      'local_demo_fixture_docs',
      'source_sync_gate=ready',
      'campaignBudgetId=HTX-BG-BUDGET-002',
    ].join('|'),
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
