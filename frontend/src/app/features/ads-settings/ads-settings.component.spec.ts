import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdsSettingsComponent } from './ads-settings.component';

describe('AdsSettingsComponent', () => {
  let fixture: ComponentFixture<AdsSettingsComponent>;
  let component: AdsSettingsComponent;
  let http: HttpTestingController;

  const settings = {
    facebook: { configured: true, tokenCount: 2 },
    google: {
      configured: true,
      clientId: 'local-redacted-client',
      hasRefreshToken: true,
      developerToken: 'redacted',
      loginCustomerId: '1234567890',
      apiVersion: 'v24',
      configSource: 'database',
      refreshTokenSource: 'database',
    },
    tiktok: {
      configured: false,
      hasAccessToken: false,
      hasRefreshToken: false,
      configSource: 'none',
      advertiserIds: [],
      grantedAdvertiserIds: [],
      scopes: [],
    },
  };

  const managerRegistrySummary = {
    schema_version: 'ads_manager_account_registry_readiness.v1',
    total: 3,
    childAccountCount: 4,
    managers: [
      {
        id: 'manager-google',
        name: 'Google MCC chính',
        provider: 'google',
        managerAccountType: 'google_ads_mcc',
        managerAccountId: '1234567890',
        managerAccountName: 'Google MCC chính',
        vaultProvider: 'erp_secret_store',
        secretReferenceHandle: 'vault://ads/google-mcc/primary',
        credentialStatus: 'ready_for_import',
        missingScopes: [],
        childAccountIds: ['1111111111', '2222222222'],
        discoveredChildAccountCount: 2,
        readinessStatus: 'needs_mapping',
        blockers: ['product_mapping_pending'],
        warnings: [],
        capabilities: {
          canImportReadOnly: true,
          canUseForFutureValidateOnly: true,
          canUseForFutureExecution: false,
        },
      },
      {
        id: 'manager-meta',
        name: 'Meta BM chính',
        provider: 'facebook',
        managerAccountType: 'meta_business_manager',
        managerAccountId: 'BM-001',
        vaultProvider: 'erp_secret_store',
        secretReferenceHandle: 'vault://ads/meta/primary',
        credentialStatus: 'ready_for_import',
        missingScopes: [],
        childAccountIds: ['act_001'],
        discoveredChildAccountCount: 1,
        readinessStatus: 'ready_for_import',
        blockers: [],
        warnings: [],
        capabilities: {
          canImportReadOnly: true,
          canUseForFutureValidateOnly: false,
          canUseForFutureExecution: false,
        },
      },
      {
        id: 'manager-tiktok',
        name: 'TikTok BC chính',
        provider: 'tiktok',
        managerAccountType: 'tiktok_business_center',
        managerAccountId: 'BC-001',
        vaultProvider: 'pending',
        secretReferenceHandle: 'pending_secret_store_onboarding',
        credentialStatus: 'missing',
        missingScopes: ['advertiser.read'],
        childAccountIds: ['tt_001'],
        discoveredChildAccountCount: 1,
        readinessStatus: 'not_configured',
        blockers: ['credential_status_missing'],
        warnings: [],
        capabilities: {
          canImportReadOnly: false,
          canUseForFutureValidateOnly: false,
          canUseForFutureExecution: false,
        },
      },
    ],
  };

  const evidenceSnapshot = {
    schemaVersion: 'ads_automation_evidence_snapshot.v1',
    snapshotId: 'ADS-EVIDENCE-LOCAL-001',
    generatedAt: '2026-07-08T00:15:00.000Z',
    environment: 'local',
    productionEnabled: false,
    providerExecutionEnabled: false,
    dryRun: true,
    killSwitchActive: false,
    summary: {
      totalAdGroups: 3,
      scaleReady: 0,
      hold: 1,
      monitorOnly: 1,
      blocked: 1,
      needsMapping: 1,
    },
    globalBlockers: [
      {
        code: 'finance_cashflow_missing',
        severity: 'error',
        message: 'Cashflow snapshot is missing for scale decision.',
        source: 'finance',
      },
    ],
    adGroups: [
      {
        platform: 'google_ads',
        adGroupId: 'provider-ad-group-001',
        erpAdGroupId: 'erp-ad-group-001',
        name: 'Google hero SKU',
        readinessStatus: 'hold',
        mappingHealth: {
          status: 'mapped',
          confidence: 'high',
          productIds: ['product-001'],
          missingLinks: [],
        },
        financeGate: {
          status: 'hold',
          currentDailySpend: 250000,
          currentMonthlySpend: 4200000,
          realizedLoss: 0,
          blockers: [
            {
              code: 'cash_conversion_review',
              severity: 'warning',
              message: 'Cash conversion evidence requires manager review.',
              source: 'finance',
            },
          ],
          dataFreshness: 'fresh',
        },
        adsGate: {
          executable: false,
          productionEnabled: false,
          providerExecutionEnabled: false,
          dryRun: true,
          killSwitchActive: false,
          providerValidateOnlyPassed: false,
          approved: false,
          idempotencyReady: false,
          beforeStateSnapshotReady: true,
          auditReady: true,
          blockers: [
            {
              code: 'validate_only_missing',
              severity: 'error',
              message: 'Provider validateOnly evidence is missing.',
              source: 'ads_gate',
            },
          ],
        },
        blockers: [],
      },
      {
        platform: 'google_ads',
        adGroupId: 'provider-ad-group-002',
        erpAdGroupId: 'erp-ad-group-002',
        name: 'Google SKU without campaign budget',
        readinessStatus: 'needs_mapping',
        mappingHealth: {
          status: 'missing',
          confidence: 'low',
          productIds: [],
          missingLinks: ['campaignBudgetId', 'product'],
        },
        financeGate: {
          status: 'block',
          currentDailySpend: 120000,
          currentMonthlySpend: 900000,
          realizedLoss: 180000,
          blockers: [
            {
              code: 'loss_limit_hit',
              severity: 'error',
              message: 'Daily loss limit is already hit.',
              source: 'finance',
            },
          ],
          dataFreshness: 'stale',
        },
        adsGate: {
          executable: false,
          productionEnabled: false,
          providerExecutionEnabled: false,
          dryRun: true,
          killSwitchActive: false,
          providerValidateOnlyPassed: false,
          approved: false,
          idempotencyReady: false,
          beforeStateSnapshotReady: false,
          auditReady: false,
          blockers: [
            {
              code: 'campaign_budget_id_missing',
              severity: 'error',
              message: 'Missing campaignBudgetId blocks budget change.',
              source: 'ads_gate',
            },
          ],
        },
        blockers: [
          {
            code: 'product_mapping_missing',
            severity: 'error',
            message: 'Ad group has no mapped ERP product.',
            source: 'mapping',
          },
        ],
      },
      {
        platform: 'meta_ads',
        adGroupId: 'provider-ad-group-003',
        erpAdGroupId: 'erp-ad-group-003',
        name: 'Meta monitor only SKU',
        readinessStatus: 'monitor_only',
        mappingHealth: {
          status: 'mapped',
          confidence: 'medium',
          productIds: ['product-002'],
          missingLinks: [],
        },
        financeGate: {
          status: 'cap_only',
          currentDailySpend: 80000,
          currentMonthlySpend: 700000,
          realizedLoss: 0,
          blockers: [],
          dataFreshness: 'fresh',
        },
        adsGate: {
          executable: false,
          productionEnabled: false,
          providerExecutionEnabled: false,
          dryRun: true,
          killSwitchActive: false,
          providerValidateOnlyPassed: false,
          approved: false,
          idempotencyReady: true,
          beforeStateSnapshotReady: true,
          auditReady: true,
          blockers: [],
        },
        blockers: [],
      },
    ],
    safety: {
      localOnly: true,
      providerApiCalled: false,
      googleAdsApiCalled: false,
      liveExecutionUsed: false,
      secretsRedacted: true,
      campaignBudgetIdNoFallback: true,
    },
  };

  const immutableLatestSnapshot = {
    _id: 'immutable-snapshot-001',
    dateKey: '2026-07-10',
    environment: 'local',
    schemaVersion: 'ads_automation_evidence_snapshot.v1',
    payload: evidenceSnapshot,
    hash: 'a'.repeat(64),
    capturedAt: '2026-07-10T00:05:00.000Z',
  };

  const immutableSnapshotHistory = [
    immutableLatestSnapshot,
    {
      ...immutableLatestSnapshot,
      _id: 'immutable-snapshot-000',
      dateKey: '2026-07-09',
      hash: 'b'.repeat(64),
      capturedAt: '2026-07-09T00:05:00.000Z',
    },
  ];

  const googleAdsLatestSyncRun = {
    _id: 'sync-run-record-001',
    runId: 'google-sync-run-001',
    status: 'partial',
    startedAt: '2026-07-10T00:15:00.000Z',
    completedAt: '2026-07-10T00:18:00.000Z',
    dateFrom: '2026-07-09',
    dateTo: '2026-07-10',
    customerIds: ['1234567890', '9988776655'],
    counts: { campaigns: 4, adGroups: 12, metrics: 48 },
    syncErrors: [
      { customerId: '9988776655', step: 'keywords', message: 'permission denied' },
    ],
  };

  const sourceReadinessReview = {
    schemaVersion: 'ads_automation_source_readiness_review_export.v1',
    generatedAt: '2026-07-08T00:20:00.000Z',
    exportMode: 'erp_source_import_readiness',
    query: {
      reportDate: '2026-07-08',
    },
    safety: {
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      execution_allowed_now: false,
      production_ready: false,
    },
    summary: {
      export_status: 'needs_attention',
      reportDate: '2026-07-08',
      required_source_count: 6,
      required_source_ready_count: 4,
      required_source_blocked_count: 1,
      required_source_report_date_blocked_count: 1,
      missing_required_source_evidence: ['cashflow_policy'],
      source_coverage_blocking_reasons: ['inventory_profit_latest_record_date_not_report_date'],
      latest_successful_sync_at: '2026-07-08T00:10:00.000Z',
      latest_record_date: '2026-07-08',
      platform_metric_row_count: 12,
      platform_metric_ready_row_count: 10,
      platform_mapped_ad_group_count: 3,
      platform_unmapped_ad_group_count: 1,
      platform_mapped_product_count: 3,
      platform_blocked_product_count: 1,
      platform_blocked_supplier_count: 1,
      product_allocation_blocker_count: 1,
      supplier_safety_blocker_count: 1,
      cashflow_first_scale_mode: 'monitor_only',
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      next_required_action: 'resolve_source_readiness_blockers',
    },
    sourceCoverage: [
      {
        sourceKey: 'google_ads',
        coverageBucket: 'fresh',
        freshnessStatus: 'fresh',
        coverageStatus: 'covered',
        lastSuccessfulSyncAt: '2026-07-08T00:10:00.000Z',
        latestRecordDate: '2026-07-08',
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: 'inventory_profit',
        coverageBucket: 'stale',
        freshnessStatus: 'fresh',
        coverageStatus: 'no_records_for_report_date',
        lastSuccessfulSyncAt: '2026-07-07T23:50:00.000Z',
        latestRecordDate: '2026-07-07',
        blockingReasons: ['inventory_profit_latest_record_date_not_report_date'],
        canUseForAdsAutomationDecision: false,
      },
    ],
    blockerReview: {
      sourceBlockers: ['source_readiness.required_sources_blocked'],
      readonlyImportBlockers: [],
      readModelBlockers: ['read_model.cashflow_policy_missing'],
      productAllocationBlockers: ['product_allocation.net_profit_not_positive'],
      supplierSafetyBlockers: ['supplier_safety.margin_after_cost_below_minimum'],
      cashflowFirstBlockers: ['cash_conversion_or_working_capital_health_missing'],
      globalBlockers: [],
    },
  };

  const scenarioProducts = [
    {
      _id: 'product-001',
      name: 'Bo loc nuoc A',
      sku: 'BG001',
      importPrice: 300000,
      shippingCost: 20000,
      packagingCost: 10000,
      totalCost: 330000,
      assumedReturnRatePercent: 7,
      fanpageVariations: [
        { customPrice: 590000, isActive: true, priority: 2 },
      ],
      suppliers: [],
    },
  ];

  const inventorySummary = {
    data: [
      {
        productId: 'product-001',
        productName: 'Bo loc nuoc A',
        onHand: 120,
        avgCost: 335000,
        updatedAt: '2026-07-08T00:00:00.000Z',
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdsSettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdsSettingsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function flushInitialSettings(
    payload = settings,
    includeEvidence = true,
    includeScenarioSources = true,
    includeManagerRegistry = true,
  ): void {
    const request = http.expectOne('/api/api-tokens/settings');
    expect(request.request.method).toBe('GET');
    request.flush(payload);

    if (includeManagerRegistry) {
      const managerRequest = http.expectOne('/api/ads-manager-accounts/readiness/summary');
      expect(managerRequest.request.method).toBe('GET');
      managerRequest.flush(managerRegistrySummary);
    }

    if (includeEvidence) {
      const evidenceRequest = http.expectOne('/api/ads-automation/evidence/snapshot?limit=6&lookbackDays=30');
      expect(evidenceRequest.request.method).toBe('GET');
      evidenceRequest.flush(evidenceSnapshot);
    }

    if (includeScenarioSources) {
      const productsRequest = http.expectOne('/api/products');
      expect(productsRequest.request.method).toBe('GET');
      productsRequest.flush(scenarioProducts);

      const inventoryRequest = http.expectOne('/api/inventory/summary?limit=100');
      expect(inventoryRequest.request.method).toBe('GET');
      inventoryRequest.flush(inventorySummary);
    }

    fixture.detectChanges();
  }

  it('renders the local control-center shell with closed safety flags and no automatic provider calls', () => {
    fixture.detectChanges();
    flushInitialSettings();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Trung tâm điều khiển tự động Ads');
    expect(text).toContain('Google MCC');
    expect(text).toContain('Meta Business Manager');
    expect(text).toContain('TikTok');
    expect(text).toContain('Được phép chạy lúc này');
    expect(text).toContain('Có dùng API nhà cung cấp');
    expect(text).toContain('Có gọi API nhà cung cấp');
    expect(text).toContain('Có dùng Google Ads API');
    expect(text).toContain('Cờ GOOGLE_ADS_PRODUCTION_ENABLED');
    expect(component.safetyFlags.every((flag) => flag.value === false || flag.value === 'false_or_absent')).toBeTrue();
    expect(component.managerAccounts().length).toBe(3);
    expect(component.managerAccounts().filter((manager) => manager.managerType === 'MCC').length).toBe(1);
    expect(component.managerAccounts()[0].managerId).toBe('1234567890');
    expect(component.managerRegistrySummary()?.schema_version)
      .toBe('ads_manager_account_registry_readiness.v1');
    expect(component.childAccounts().some((account) => account.managementMode === 'mcc')).toBeTrue();
    expect(component.childAccounts().some((account) => account.managementMode === 'bm')).toBeTrue();
    expect(component.childAccounts().some((account) => account.managementMode === 'bc')).toBeTrue();
    http.expectNone((req) => req.url.includes('/api-tokens/test/google'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/tiktok'));
    http.expectNone((req) => req.url.includes('/advertising-cost/fetch'));
  });

  it('verifies a Google manager through the read-only registry endpoint and refreshes readiness', () => {
    fixture.detectChanges();
    flushInitialSettings();

    component.verifyManagerReadOnly(component.managerAccounts()[0]);
    expect(component.verifyingManagerId()).toBe('manager-google');

    const verifyRequest = http.expectOne('/api/ads-manager-accounts/manager-google/verify-readonly');
    expect(verifyRequest.request.method).toBe('POST');
    expect(verifyRequest.request.body).toEqual({});
    verifyRequest.flush({ readinessStatus: 'ready_for_import' });

    const refreshRequest = http.expectOne('/api/ads-manager-accounts/readiness/summary');
    expect(refreshRequest.request.method).toBe('GET');
    refreshRequest.flush(managerRegistrySummary);

    expect(component.verifyingManagerId()).toBe('');
    expect(component.message()).toContain('chỉ đọc');
  });

  it('renders the read-only ERP evidence snapshot with gates, blockers, and drilldown links', () => {
    fixture.detectChanges();
    flushInitialSettings();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('ERP evidence snapshot');
    expect(text).toContain('2/3 mapped');
    expect(text).toContain('0/3 executable');
    expect(text).toContain('production=off');
    expect(text).toContain('Cashflow snapshot is missing for scale decision.');
    expect(text).toContain('Missing campaignBudgetId blocks budget change.');
    expect(text).toContain('Financial control');
    expect(text).toContain('Supplier quotes');
    expect(component.evidenceSnapshot()?.snapshotId).toBe('ADS-EVIDENCE-LOCAL-001');
    expect(component.topEvidenceBlockers().length).toBe(5);
    http.expectNone((req) => req.url.includes('/api-tokens/test/google'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/tiktok'));
    http.expectNone((req) => req.url.includes('/advertising-cost/fetch'));
  });

  it('shows credential metadata and execution gates without plaintext credential values', () => {
    fixture.detectChanges();
    flushInitialSettings();

    component.activeTab.set('credentials');
    fixture.detectChanges();
    let text = fixture.nativeElement.textContent;
    expect(text).toContain('Thông tin xác thực / Token API');
    expect(text).toContain('vault://ads/google-mcc/system-settings-redacted');
    expect(text).toContain('Mở trang token kỹ thuật');
    expect(text).not.toContain('temporary-client-secret');

    component.activeTab.set('executionGates');
    fixture.detectChanges();
    text = fixture.nativeElement.textContent;
    expect(text).toContain('ValidateOnly của nhà cung cấp');
    expect(text).toContain('Sẵn sàng chạy thật');
    expect(text).toContain('Không thêm đường xoá, Performance Max, Shopping, Display, YouTube');
  });

  it('loads immutable evidence latest/history only when Audit is opened and never captures', () => {
    fixture.detectChanges();
    flushInitialSettings();

    http.expectNone('/api/ads-automation/evidence/snapshots/latest');
    http.expectNone('/api/ads-automation/evidence/snapshots/history?limit=7');
    http.expectNone('/api/ads-automation/evidence/snapshots/capture');

    component.selectTab('audit');

    const latestRequest = http.expectOne('/api/ads-automation/evidence/snapshots/latest');
    expect(latestRequest.request.method).toBe('GET');
    latestRequest.flush(immutableLatestSnapshot);
    const historyRequest = http.expectOne('/api/ads-automation/evidence/snapshots/history?limit=7');
    expect(historyRequest.request.method).toBe('GET');
    historyRequest.flush(immutableSnapshotHistory);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('2026-07-10');
    expect(text).toContain('ads_automation_evidence_snapshot.v1');
    expect(text).toContain('a'.repeat(64));
    expect(text).toContain('b'.repeat(64));
    expect(component.immutableLatestSnapshot()?.hash).toBe('a'.repeat(64));
    expect(component.immutableSnapshotHistory()).toHaveSize(2);
    http.expectNone('/api/ads-automation/evidence/snapshots/capture');
    http.expectNone((req) => req.url.includes('/advertising-cost/fetch'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/google'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/tiktok'));
  });

  it('lazy-loads the canonical Google sync-run and marks Meta/TikTok without fake run data', () => {
    fixture.detectChanges();
    flushInitialSettings();

    http.expectNone('/api/google-ads/sync/runs/latest');
    component.selectTab('importSchedule');

    const runRequest = http.expectOne('/api/google-ads/sync/runs/latest');
    expect(runRequest.request.method).toBe('GET');
    runRequest.flush(googleAdsLatestSyncRun);
    fixture.detectChanges();

    const rows = component.importSchedules();
    const google = rows.find((row) => row.id === 'google-import');
    const meta = rows.find((row) => row.id === 'meta-import');
    const tiktok = rows.find((row) => row.id === 'tiktok-import');
    expect(rows).toHaveSize(3);
    expect(google).toEqual(jasmine.objectContaining({
      status: 'needs_mapping',
      runId: 'google-sync-run-001',
      customerIds: '1234567890, 9988776655',
    }));
    expect(google?.rowCount).toContain('campaigns: 4');
    expect(google?.rowCount).toContain('metrics: 48');
    expect(google?.blockers).toContain('9988776655 / keywords: permission denied');
    expect(meta).toEqual(jasmine.objectContaining({
      status: 'monitor_only',
      lastRun: 'không có nguồn sync-run ERP',
      rowCount: 'không khả dụng',
    }));
    expect(tiktok).toEqual(jasmine.objectContaining({
      status: 'not_configured',
      lastRun: 'không có nguồn sync-run ERP',
      rowCount: 'không khả dụng',
    }));

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('google-sync-run-001');
    expect(text).toContain('9988776655');
    expect(text).toContain('permission denied');
    http.expectNone('/api/google-ads/sync/readonly');
    http.expectNone((req) => req.url.includes('/advertising-cost/fetch'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/google'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/tiktok'));
  });

  it('runs general data sync through the ERP read-only source-readiness route', () => {
    fixture.detectChanges();
    flushInitialSettings();

    component.runManualDataSync();

    const syncRequest = http.expectOne('/api/ai/ads-automation/erp-source-import-readiness-review-export');
    expect(syncRequest.request.method).toBe('POST');
    expect(syncRequest.request.body.query.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(syncRequest.request.body.query.now).toMatch(/T/);
    expect(syncRequest.request.body.query.evidenceWindow).toEqual({ days: 30 });
    syncRequest.flush(sourceReadinessReview);

    const refreshedEvidenceRequest = http.expectOne('/api/ads-automation/evidence/snapshot?limit=6&lookbackDays=30');
    expect(refreshedEvidenceRequest.request.method).toBe('GET');
    refreshedEvidenceRequest.flush(evidenceSnapshot);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Đồng bộ dữ liệu tổng quát');
    expect(text).toContain('4/6');
    expect(text).toContain('không gọi provider API');
    expect(text).toContain('không chạy ads thật');
    expect(text).toContain('inventory_profit_latest_record_date_not_report_date');
    expect(component.manualDataSyncResult()?.exportMode).toBe('erp_source_import_readiness');
    expect(component.manualDataSyncCards()[0].value).toBe('4/6');
    expect(component.manualDataSyncBlockers()).toContain('cashflow_policy');
    expect(component.manualDataSyncBlockers()).toContain('source_readiness.required_sources_blocked');
    http.expectNone((req) => req.url.includes('/advertising-cost/fetch'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/google'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/tiktok'));
  });

  it('updates the browser-local business scenario without provider calls or ERP mutation', () => {
    fixture.detectChanges();
    flushInitialSettings();

    const initialProfit = component.businessScenarioResult().netProfitAfterAdsVnd;
    component.updateBusinessScenario('sellingPriceVnd', 650000);
    component.updateBusinessScenario('purchasePriceVnd', 300000);
    component.updateBusinessScenario('expectedOrdersPerDay', 25);
    component.updateBusinessScenario('dailyAdsBudgetVnd', 2000000);
    fixture.detectChanges();

    const result = component.businessScenarioResult();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Kịch bản thử phương án kinh doanh');
    expect(text).toContain('Lợi nhuận sau ads/ngày');
    expect(result.netProfitAfterAdsVnd).toBeGreaterThan(initialProfit);
    expect(result.decision).toBe('can_test_scale');
    expect(result.provider_api_called).toBeFalse();
    expect(result.live_ads_execution_used).toBeFalse();
    expect(result.erp_mutation_used).toBeFalse();
    http.expectNone((req) => req.url.includes('/advertising-cost/fetch'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/google'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/tiktok'));
    http.expectNone((req) => req.url.includes('/ai/ads-automation/erp-source-import-readiness-review-export'));
  });

  it('applies ERP product and inventory data into the browser-local business scenario', () => {
    fixture.detectChanges();
    flushInitialSettings();

    component.selectBusinessScenarioProduct('product-001');
    fixture.detectChanges();

    const scenario = component.businessScenario();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sản phẩm ERP');
    expect(text).toContain('BG001 - Bo loc nuoc A');
    expect(component.selectedScenarioProductId()).toBe('product-001');
    expect(scenario.purchasePriceVnd).toBe(330000);
    expect(scenario.sellingPriceVnd).toBe(590000);
    expect(scenario.returnRatePercent).toBe(7);
    expect(scenario.inventoryUnits).toBe(120);
    expect(component.businessScenarioResult().provider_api_called).toBeFalse();
    expect(component.businessScenarioResult().live_ads_execution_used).toBeFalse();
    expect(component.businessScenarioResult().erp_mutation_used).toBeFalse();
    http.expectNone((req) => req.url.includes('/advertising-cost/fetch'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/google'));
    http.expectNone((req) => req.url.includes('/api-tokens/test/tiktok'));
    http.expectNone((req) => req.url.includes('/ai/ads-automation/erp-source-import-readiness-review-export'));
  });

  it('clears Google secret fields after saving settings while preserving non-secret metadata', () => {
    fixture.detectChanges();
    flushInitialSettings();

    component.googleForm.developerToken = 'temporary developer token';
    component.googleForm.clientId = 'local-client-id';
    component.googleForm.clientSecret = 'temporary client secret';
    component.googleForm.refreshToken = 'temporary refresh token';
    component.googleForm.loginCustomerId = '1234567890';
    component.googleForm.apiVersion = 'v24';

    component.saveGoogle();

    const saveRequest = http.expectOne('/api/api-tokens/settings/google');
    expect(saveRequest.request.method).toBe('POST');
    expect(saveRequest.request.body).toEqual(jasmine.objectContaining({
      clientId: 'local-client-id',
      loginCustomerId: '1234567890',
      apiVersion: 'v24',
    }));
    saveRequest.flush({ ok: true, message: 'saved' });
    flushInitialSettings(settings, false, false, false);

    expect(component.googleForm.developerToken).toBe('');
    expect(component.googleForm.clientSecret).toBe('');
    expect(component.googleForm.refreshToken).toBe('');
    expect(component.googleForm.clientId).toBe('local-client-id');
    expect(component.googleForm.loginCustomerId).toBe('1234567890');
  });

  it('uses the non-secret TikTok accessTokenStored marker after OAuth exchange', () => {
    fixture.detectChanges();
    flushInitialSettings();

    component.tiktokForm.appId = 'app-id';
    component.tiktokForm.appSecret = 'temporary-app-secret';
    component.tiktokForm.authCode = 'temporary-auth-code';
    component.exchangeTikTokAuthCode();

    const exchangeRequest = http.expectOne('/api/api-tokens/tiktok/oauth/exchange');
    expect(exchangeRequest.request.method).toBe('POST');
    exchangeRequest.flush({
      ok: true,
      message: 'saved',
      accessTokenStored: true,
      hasRefreshToken: true,
      scopes: ['ad_data_read'],
      authorizedAdvertisers: [],
      advertiserIds: [],
    });
    const refreshRequest = http.expectOne('/api/api-tokens/settings');
    refreshRequest.flush(settings);

    expect(component.tiktokTestResult()?.accessToken).toContain('ERP');
    expect(component.tiktokTestResult()?.accessTokenStored).toBeTrue();
    expect(component.tiktokForm.appSecret).toBe('');
    expect(component.tiktokForm.authCode).toBe('');
  });
});
