export interface AdsSettings {
  facebook: { configured: boolean; tokenCount: number };
  google: {
    configured: boolean;
    clientId?: string;
    hasRefreshToken: boolean;
    developerToken?: string;
    loginCustomerId?: string;
    apiVersion?: string;
    configSource?: string;
    refreshTokenSource?: string;
  };
  tiktok: {
    configured: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    configSource?: string;
    appId?: string;
    businessCenterId?: string;
    businessCenterName?: string;
    testAdvertiserId?: string;
    advertiserIds?: string[];
    grantedAdvertiserIds?: string[];
    scopes?: string[];
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
    lastAuthAt?: string;
  };
}

export type ActiveTab =
  | 'overview'
  | 'managerAccounts'
  | 'credentials'
  | 'childAccounts'
  | 'importSchedule'
  | 'mappingHealth'
  | 'executionGates'
  | 'audit'
  | 'googleSettings'
  | 'googleGuide'
  | 'tiktokSettings';

export type ProviderKey = 'google' | 'meta' | 'tiktok';

export type ReadinessState =
  | 'ready_for_import'
  | 'needs_mapping'
  | 'not_configured'
  | 'blocked'
  | 'monitor_only';

export interface ManagerAccountReadiness {
  id: string;
  provider: ProviderKey;
  providerLabel: string;
  managerType: string;
  managerName: string;
  managerId: string;
  credentialSource: string;
  secretReference: string;
  credentialSummary: string;
  childAccountCount: number;
  readiness: ReadinessState;
  importScope: string;
  executionScope: string;
  blockers: string[];
}

export interface AdsManagerRegistryManager {
  id: string;
  name: string;
  provider: 'google' | 'facebook' | 'tiktok';
  managerAccountType: 'google_ads_mcc' | 'meta_business_manager' | 'tiktok_business_center';
  managerAccountId: string;
  managerAccountName?: string;
  vaultProvider: string;
  secretReferenceHandle: string;
  credentialStatus: string;
  missingScopes: string[];
  childAccountIds: string[];
  discoveredChildAccountCount: number;
  readinessStatus: Exclude<ReadinessState, 'monitor_only'>;
  blockers: string[];
  warnings: string[];
  capabilities: {
    canImportReadOnly: boolean;
    canUseForFutureValidateOnly: boolean;
    canUseForFutureExecution: boolean;
  };
}

export interface AdsManagerRegistrySummary {
  schema_version: 'ads_manager_account_registry_readiness.v1';
  total: number;
  childAccountCount: number;
  managers: AdsManagerRegistryManager[];
}

export interface CredentialReadiness {
  id: string;
  providerLabel: string;
  tokenType: string;
  status: ReadinessState;
  metadata: string;
  secretReference: string;
  allowedByDefault: string;
}

export interface ChildAccountReadiness {
  id: string;
  providerLabel: string;
  managerId: string;
  accountName: string;
  accountId: string;
  managementMode: 'mcc' | 'bm' | 'bc';
  importState: ReadinessState;
  mappingState: ReadinessState;
  executionMode: 'read_only_import' | 'monitor_only';
  ownerSurface: string;
}

export interface ImportScheduleReadiness {
  id: string;
  source: string;
  cadence: string;
  lastRun: string;
  nextRun: string;
  destination: string;
  status: ReadinessState;
  rowCount: string;
  completedAt: string;
  customerIds: string;
  runId: string;
  blockers: string[];
}

export interface GoogleAdsSyncRun {
  _id?: string;
  runId: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  startedAt: string;
  completedAt?: string;
  dateFrom?: string;
  dateTo?: string;
  customerIds: string[];
  counts: Record<string, number>;
  syncErrors: Array<{ customerId?: string; step?: string; message: string }>;
}

export interface MappingHealthReadiness {
  id: string;
  layer: string;
  mapped: number;
  total: number;
  status: ReadinessState;
  evidence: string;
  blocker: string;
}

export interface SafetyGateReadiness {
  key: string;
  label: string;
  state: ReadinessState;
  value: string;
  evidence: string;
}

export interface AuditEvidence {
  id: string;
  event: string;
  result: string;
  evidence: string;
  rollback: string;
}

export interface SafetyFlag {
  key: string;
  value: boolean | 'false_or_absent';
  evidence: string;
}

export type AdsEvidenceSeverity = 'error' | 'warning' | 'info';

export interface AdsEvidenceBlocker {
  code: string;
  severity: AdsEvidenceSeverity;
  message: string;
  source?: string;
  evidencePath?: string;
}

export interface AdsEvidenceAdGroup {
  platform: string;
  adGroupId: string;
  erpAdGroupId?: string;
  name?: string;
  readinessStatus: string;
  mappingHealth: {
    status: string;
    confidence: string;
    productIds: string[];
    missingLinks: string[];
  };
  financeGate: {
    status: string;
    availableCash?: number;
    dailyCap?: number;
    monthlyCap?: number;
    lossLimit?: number;
    realizedLoss: number;
    blockers: AdsEvidenceBlocker[];
    dataFreshness: string;
  };
  adsGate: {
    executable: boolean;
    productionEnabled: boolean;
    providerExecutionEnabled: boolean;
    dryRun: boolean;
    killSwitchActive: boolean;
    providerValidateOnlyPassed: boolean;
    approved: boolean;
    idempotencyReady: boolean;
    beforeStateSnapshotReady: boolean;
    auditReady: boolean;
    blockers: AdsEvidenceBlocker[];
  };
  blockers: AdsEvidenceBlocker[];
}

export interface AdsEvidenceSnapshot {
  schemaVersion: string;
  snapshotId: string;
  generatedAt: string;
  environment: string;
  productionEnabled: boolean;
  providerExecutionEnabled: boolean;
  dryRun: boolean;
  killSwitchActive: boolean;
  summary: {
    totalAdGroups: number;
    scaleReady: number;
    hold: number;
    monitorOnly: number;
    blocked: number;
    needsMapping: number;
  };
  adGroups: AdsEvidenceAdGroup[];
  globalBlockers: AdsEvidenceBlocker[];
  safety: {
    localOnly: true;
    providerApiCalled: false;
    googleAdsApiCalled: false;
    liveExecutionUsed: false;
    secretsRedacted: true;
    campaignBudgetIdNoFallback: true;
  };
}

export interface PersistedAdsEvidenceSnapshot {
  _id?: string;
  dateKey: string;
  environment: string;
  schemaVersion: string;
  payload: AdsEvidenceSnapshot;
  hash: string;
  capturedAt: string;
}

export interface EvidenceSummaryCard {
  title: string;
  value: string;
  detail: string;
  state: string;
}

export interface EvidenceDrilldownLink {
  label: string;
  route: string;
  detail: string;
}

export interface AdsSourceReadinessSafety {
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called?: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsSourceReadinessSummary {
  export_status: string;
  reportDate: string;
  required_source_count: number;
  required_source_ready_count: number;
  required_source_blocked_count: number;
  required_source_report_date_blocked_count: number;
  missing_required_source_evidence: string[];
  source_coverage_blocking_reasons: string[];
  latest_successful_sync_at: string | null;
  latest_record_date: string | null;
  platform_metric_row_count: number;
  platform_metric_ready_row_count: number;
  platform_mapped_ad_group_count: number;
  platform_unmapped_ad_group_count: number;
  platform_mapped_product_count: number;
  platform_blocked_product_count: number;
  platform_blocked_supplier_count: number;
  product_allocation_blocker_count: number;
  supplier_safety_blocker_count: number;
  cashflow_first_scale_mode: 'monitor_only' | 'pending_validation';
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action: string;
}

export interface AdsSourceReadinessCoverage {
  sourceKey: string;
  coverageBucket: string;
  freshnessStatus: string;
  coverageStatus: string;
  lastSuccessfulSyncAt: string | null;
  latestRecordDate: string | null;
  blockingReasons: string[];
  canUseForAdsAutomationDecision: boolean;
}

export interface AdsSourceReadinessBlockerReview {
  sourceBlockers: string[];
  readonlyImportBlockers: string[];
  readModelBlockers: string[];
  productAllocationBlockers: string[];
  supplierSafetyBlockers: string[];
  cashflowFirstBlockers: string[];
  globalBlockers: string[];
}

export interface AdsSourceReadinessReviewExport {
  schemaVersion: 'ads_automation_source_readiness_review_export.v1';
  generatedAt: string;
  exportMode: 'local_payload' | 'local_demo_fixture' | 'erp_source_import_readiness';
  query: {
    reportDate: string;
  };
  safety: AdsSourceReadinessSafety;
  summary: AdsSourceReadinessSummary;
  sourceCoverage: AdsSourceReadinessCoverage[];
  blockerReview: AdsSourceReadinessBlockerReview;
}

export interface AdsBusinessScenarioInput {
  additionalLoanVnd: number;
  annualInterestRatePercent: number;
  loanTermMonths: number;
  purchasePriceVnd: number;
  sellingPriceVnd: number;
  fulfillmentCostPerOrderVnd: number;
  expectedOrdersPerDay: number;
  returnRatePercent: number;
  dailyAdsBudgetVnd: number;
  inventoryUnits: number;
}

export type AdsBusinessScenarioDecision =
  | 'can_test_scale'
  | 'monitor_only'
  | 'hold'
  | 'do_not_scale'
  | 'needs_data';

export interface AdsBusinessScenarioResult {
  decision: AdsBusinessScenarioDecision;
  grossRevenueVnd: number;
  grossProfitBeforeAdsVnd: number;
  netProfitAfterAdsVnd: number;
  breakEvenDailyAdsBudgetVnd: number;
  recommendedTestAdsBudgetVnd: number;
  maxCpaVnd: number;
  dailyDebtServiceVnd: number;
  daysOfCover: number | null;
  blockers: string[];
  provider_api_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
}

export interface AdsBusinessScenarioProductVariation {
  customPrice?: number;
  isActive?: boolean;
  priority?: number;
}

export interface AdsBusinessScenarioProductSupplier {
  appliedPrice?: number;
  price1?: number;
  price2?: number;
  price3?: number;
  priority?: number;
  isDefault?: boolean;
}

export interface AdsBusinessScenarioProduct {
  _id: string;
  name: string;
  sku?: string;
  importPrice?: number;
  shippingCost?: number;
  packagingCost?: number;
  totalCost?: number;
  assumedReturnRatePercent?: number;
  fanpageVariations?: AdsBusinessScenarioProductVariation[];
  suppliers?: AdsBusinessScenarioProductSupplier[];
}

export interface AdsBusinessScenarioInventoryRow {
  productId: string;
  productName?: string;
  onHand?: number;
  avgCost?: number;
  updatedAt?: string;
}

export interface AdsBusinessScenarioInventorySummary {
  data: AdsBusinessScenarioInventoryRow[];
}
