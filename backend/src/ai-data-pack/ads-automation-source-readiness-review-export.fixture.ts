import type {
  AdsAutomationSourceReadinessReviewExportInput,
} from './contracts/ads-automation-source-readiness-review-export.contract';
import type {
  AdsAutomationPlatformSourceStatus,
  AdsAutomationPlatformSourceSyncStatusItem,
  AdsAutomationPlatformSourceSyncStatusResponse,
  AdsAutomationPlatformSourceSyncStatusSourceKey,
} from './contracts/ads-automation-platform-source-sync-status.contract';
import type {
  BusinessImportance,
  CoverageStatus,
  FreshnessStatus,
  SourceDomain,
} from './source-registry/source-registry.types';
import { ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE } from './ads-automation-readonly-platform-import-readiness.fixture';

type SourceFixture = {
  sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey;
  provider: AdsAutomationPlatformSourceSyncStatusItem['provider'];
  platform: AdsAutomationPlatformSourceSyncStatusItem['platform'];
  domain: SourceDomain;
  businessImportance: BusinessImportance;
  status: AdsAutomationPlatformSourceStatus;
  freshnessStatus: FreshnessStatus;
  coverageStatus: CoverageStatus;
  reportDateRecordCount: number | null;
  expectedRecordCount: number | null;
  lastSuccessfulSyncAt: string | null;
  latestRecordUpdatedAt: string | null;
  latestRecordDate: string | null;
  blockingReasons: string[];
  canUseForAdsAutomationDecision: boolean;
};

const REPORT_DATE = '2026-07-04';
const GENERATED_AT = '2026-07-04T05:00:00.000Z';

const SOURCES: SourceFixture[] = [
  {
    sourceKey: 'google_ads',
    provider: 'google_ads',
    platform: 'google_ads',
    domain: 'ads',
    businessImportance: 'critical',
    status: 'ready',
    freshnessStatus: 'fresh',
    coverageStatus: 'covered',
    reportDateRecordCount: 7,
    expectedRecordCount: null,
    lastSuccessfulSyncAt: '2026-07-04T04:30:00.000Z',
    latestRecordUpdatedAt: '2026-07-04T04:45:00.000Z',
    latestRecordDate: REPORT_DATE,
    blockingReasons: [],
    canUseForAdsAutomationDecision: true,
  },
  {
    sourceKey: 'advertising_costs',
    provider: 'erp_local',
    platform: 'erp_advertising_costs',
    domain: 'finance',
    businessImportance: 'critical',
    status: 'stale',
    freshnessStatus: 'stale',
    coverageStatus: 'covered',
    reportDateRecordCount: 2,
    expectedRecordCount: null,
    lastSuccessfulSyncAt: null,
    latestRecordUpdatedAt: '2026-07-02T04:45:00.000Z',
    latestRecordDate: REPORT_DATE,
    blockingReasons: [
      'advertising_costs_not_ready_for_ads_automation_decision',
      'freshness_stale',
    ],
    canUseForAdsAutomationDecision: false,
  },
  {
    sourceKey: 'product_mapping',
    provider: 'erp_local',
    platform: 'erp_product_mapping',
    domain: 'mapping',
    businessImportance: 'critical',
    status: 'ready',
    freshnessStatus: 'fresh',
    coverageStatus: 'not_applicable',
    reportDateRecordCount: null,
    expectedRecordCount: null,
    lastSuccessfulSyncAt: null,
    latestRecordUpdatedAt: '2026-07-04T04:40:00.000Z',
    latestRecordDate: null,
    blockingReasons: [],
    canUseForAdsAutomationDecision: true,
  },
  {
    sourceKey: 'inventory_profit',
    provider: 'erp_local',
    platform: 'erp_inventory_profit',
    domain: 'finance',
    businessImportance: 'critical',
    status: 'stale',
    freshnessStatus: 'stale',
    coverageStatus: 'covered',
    reportDateRecordCount: 2,
    expectedRecordCount: null,
    lastSuccessfulSyncAt: null,
    latestRecordUpdatedAt: '2026-07-02T04:45:00.000Z',
    latestRecordDate: REPORT_DATE,
    blockingReasons: [
      'inventory_profit_not_ready_for_ads_automation_decision',
      'freshness_stale',
    ],
    canUseForAdsAutomationDecision: false,
  },
  {
    sourceKey: 'supplier_safety',
    provider: 'erp_local',
    platform: 'erp_supplier_safety',
    domain: 'operations',
    businessImportance: 'critical',
    status: 'not_synced',
    freshnessStatus: 'missing',
    coverageStatus: 'missing',
    reportDateRecordCount: 0,
    expectedRecordCount: null,
    lastSuccessfulSyncAt: null,
    latestRecordUpdatedAt: null,
    latestRecordDate: null,
    blockingReasons: [
      'supplier_safety_not_ready_for_ads_automation_decision',
      'freshness_missing',
      'coverage_missing',
    ],
    canUseForAdsAutomationDecision: false,
  },
];

export const ADS_AUTOMATION_SOURCE_READINESS_REVIEW_EXPORT_FIXTURE = {
  reportDate: REPORT_DATE,
  now: GENERATED_AT,
  fixtureName: 'htx_ads_source_readiness_review_demo',
  sourceSyncStatus: buildAdsAutomationSourceReadinessReviewSourceSyncStatus(),
  readonlyImportReadinessInput: {
    ...ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE,
    sourceSyncStatus: buildAdsAutomationSourceReadinessReviewSourceSyncStatus(),
  },
};

export function buildAdsAutomationSourceReadinessReviewSourceSyncStatus():
  AdsAutomationPlatformSourceSyncStatusResponse {
  const items = SOURCES.map((source) => sourceStatusItem(source));
  const blockedSources = items
    .filter((source) => !source.canUseForAdsAutomationDecision)
    .map((source) => source.sourceKey);

  return {
    schemaVersion: 'ads_automation_platform_source_sync_status.v1',
    generatedAt: GENERATED_AT,
    reportDate: REPORT_DATE,
    safety: {
      read_only: true,
      dry_run: true,
      local_only: true,
      source_registry_reused: true,
      freshness_gate_reused: true,
      adapter_boundary_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      production_ready: false,
      execution_allowed_now: false,
      google_ads_production_enabled: false,
    },
    summary: {
      status: blockedSources.length ? 'blocked' : 'ready',
      source_count: items.length,
      ready_source_count: items.length - blockedSources.length,
      blocked_source_count: blockedSources.length,
      blocked_sources: blockedSources,
      missing_config_sources: [],
      stale_sources: ['advertising_costs', 'inventory_profit'],
      missing_coverage_sources: ['supplier_safety'],
      not_synced_sources: ['supplier_safety'],
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      next_required_action: blockedSources.length
        ? 'resolve_source_sync_blockers'
        : 'ready_for_ads_automation_decision_review',
    },
    decisionGates: {
      canUseGoogleAdsDataClaim: true,
      canGenerateActionDraft: false,
      canRecommendAdsScale: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
    decisionEvidence: items.map((source) => ({
      sourceKey: source.sourceKey,
      reportDate: REPORT_DATE,
      freshnessStatus: source.freshness.freshnessStatus,
      coverageStatus: source.reportDateCoverage.coverageStatus,
      lastSuccessfulSyncAt: source.freshness.lastSuccessfulSyncAt,
      latestRecordDate: source.freshness.latestRecordDate,
      blockingReason: source.sourceSyncBlockers[0] || null,
      blockingReasons: [...source.sourceSyncBlockers],
      canUseForAdsAutomationDecision: source.canUseForAdsAutomationDecision,
    })),
    sources: items,
  };
}

export function buildAdsAutomationSourceReadinessReviewFixtureInput(
  readonlyImportReadiness: AdsAutomationSourceReadinessReviewExportInput['readonlyImportReadiness'],
): AdsAutomationSourceReadinessReviewExportInput {
  return {
    reportDate: REPORT_DATE,
    now: GENERATED_AT,
    exportMode: 'local_demo_fixture',
    fixtureName: 'htx_ads_source_readiness_review_demo',
    sourceSyncStatus: buildAdsAutomationSourceReadinessReviewSourceSyncStatus(),
    readonlyImportReadiness,
  };
}

function sourceStatusItem(
  source: SourceFixture,
): AdsAutomationPlatformSourceSyncStatusItem {
  const latestSuccessfulSyncOrReadModelWatermark =
    source.lastSuccessfulSyncAt ||
    source.latestRecordUpdatedAt ||
    source.latestRecordDate ||
    null;

  return {
    sourceKey: source.sourceKey,
    provider: source.provider,
    platform: source.platform,
    domain: source.domain,
    businessImportance: source.businessImportance,
    status: source.status,
    requiredConfigPresence: source.sourceKey === 'google_ads'
      ? [
          'GOOGLE_ADS_DEVELOPER_TOKEN',
          'GOOGLE_ADS_CLIENT_ID',
          'GOOGLE_ADS_CLIENT_SECRET',
          'GOOGLE_ADS_REFRESH_TOKEN',
          'GOOGLE_ADS_CUSTOMER_ID',
        ].map((key) => ({
          key,
          required: true,
          present: true,
          acceptable: true,
          secret: key !== 'GOOGLE_ADS_CUSTOMER_ID',
          value_exposed: false as const,
        }))
      : [],
    missingCredentialOrConfigBlockers: [],
    reportDateCoverage: {
      reportDate: REPORT_DATE,
      coverageStatus: source.coverageStatus,
      reportDateRecordCount: source.reportDateRecordCount,
      expectedRecordCount: source.expectedRecordCount,
    },
    freshness: {
      freshnessStatus: source.freshnessStatus,
      maxStalenessMinutes: 60,
      freshnessMinutes: source.freshnessStatus === 'stale' ? 2940 : source.freshnessStatus === 'fresh' ? 30 : null,
      staleByMinutes: source.freshnessStatus === 'stale' ? 2880 : null,
      lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
      latestRecordUpdatedAt: source.latestRecordUpdatedAt,
      latestRecordDate: source.latestRecordDate,
      latestSuccessfulSyncOrReadModelWatermark,
    },
    sourceSyncBlockers: [...source.blockingReasons],
    warnings: [],
    canUseForAdsAutomationDecision: source.canUseForAdsAutomationDecision,
    usableForAdsAutomationDecisions: source.canUseForAdsAutomationDecision,
  };
}
