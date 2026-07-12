export type AdsAutomationPlatform = 'google_ads' | 'meta_ads' | 'tiktok_ads' | 'unknown';

export type AdsAutomationReadinessStatus =
  | 'scale_ready'
  | 'hold'
  | 'monitor_only'
  | 'blocked'
  | 'needs_mapping';

export type AdsAutomationExecutionReadinessStatus =
  | 'execution_ready'
  | 'execution_blocked';

export type AdsAutomationRecommendedActionFamily =
  | 'scale'
  | 'reduce_review'
  | 'pause_review'
  | 'supplier_sourcing'
  | 'offer_fix'
  | 'stop_import_review'
  | 'monitor_only';

export type AdsAutomationBlockerSeverity = 'error' | 'warning' | 'info';

export type AdsAutomationMappingStatus = 'mapped' | 'partial' | 'missing' | 'conflict';

export type AdsAutomationMappingConfidence = 'high' | 'medium' | 'low';

export type AdsAutomationFreshnessStatus = 'fresh' | 'stale' | 'missing' | 'unknown';

export type AdsAutomationStockRisk = 'ok' | 'low' | 'out_of_stock' | 'unknown';

export type AdsAutomationSupplierRisk = 'ok' | 'review' | 'blocked' | 'unknown';

export type AdsAutomationFinanceGateStatus = 'allow_scale' | 'cap_only' | 'hold' | 'block' | 'unknown';

export interface AdsAutomationBlocker {
  code: string;
  severity: AdsAutomationBlockerSeverity;
  message: string;
  source?: string;
  evidencePath?: string;
}

export interface AdsAutomationDataFreshness {
  source: string;
  status: AdsAutomationFreshnessStatus;
  observedAt?: string;
  maxAgeDays?: number;
}

export interface AdsAutomationEvidenceRef {
  source: string;
  entityType: string;
  entityId?: string;
  observedAt?: string;
  freshnessStatus: AdsAutomationFreshnessStatus;
}

export interface AdsAutomationMappingHealth {
  status: AdsAutomationMappingStatus;
  confidence: AdsAutomationMappingConfidence;
  productIds: string[];
  missingLinks: string[];
  dataFreshness: AdsAutomationDataFreshness[];
}

export interface AdsAutomationCommerceEvidence {
  orders: number;
  revenue: number;
  cancellations: number;
  returns: number;
  grossProfit: number;
  netProfitAfterAds: number;
  marginPercent: number;
  latestOrderAt?: string;
  dataFreshness: AdsAutomationFreshnessStatus;
}

export interface AdsAutomationInventoryEvidence {
  productIds: string[];
  stockOnHand?: number;
  minStock?: number;
  stockRisk: AdsAutomationStockRisk;
  fulfillmentRisk: 'ok' | 'review' | 'blocked' | 'unknown';
  updatedAt?: string;
  dataFreshness: AdsAutomationFreshnessStatus;
}

export interface AdsAutomationSupplierEvidence {
  supplierIds: string[];
  quoteCount: number;
  openPayableBalance: number;
  quoteStatus: 'available' | 'missing' | 'stale' | 'unknown';
  payableStatus: 'clear' | 'open' | 'overdue' | 'unknown';
  supplierRisk: AdsAutomationSupplierRisk;
  updatedAt?: string;
  dataFreshness: AdsAutomationFreshnessStatus;
}

export interface AdsAutomationFinanceGate {
  status: AdsAutomationFinanceGateStatus;
  availableCash?: number;
  dailyCap?: number;
  monthlyCap?: number;
  currentDailySpend: number;
  currentMonthlySpend: number;
  lossLimit?: number;
  realizedLoss: number;
  cappedBudgetIncrease?: number;
  blockers: AdsAutomationBlocker[];
  dataFreshness: AdsAutomationFreshnessStatus;
}

export interface AdsAutomationGateEvidence {
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
  blockers: AdsAutomationBlocker[];
}

export interface AdsAutomationAdGroupEvidence {
  platform: AdsAutomationPlatform;
  managerAccountId?: string;
  childAccountId?: string;
  campaignId?: string;
  campaignBudgetId?: string;
  adGroupId: string;
  erpAdGroupId?: string;
  name?: string;
  status?: string;
  productIds: string[];
  decisionReadiness: AdsAutomationReadinessStatus;
  executionReadiness: AdsAutomationExecutionReadinessStatus;
  // Backward-compatible alias of decisionReadiness.
  readinessStatus: AdsAutomationReadinessStatus;
  recommendedActionFamily: AdsAutomationRecommendedActionFamily;
  mappingHealth: AdsAutomationMappingHealth;
  commerceEvidence: AdsAutomationCommerceEvidence;
  inventoryEvidence: AdsAutomationInventoryEvidence;
  supplierEvidence: AdsAutomationSupplierEvidence;
  financeGate: AdsAutomationFinanceGate;
  adsGate: AdsAutomationGateEvidence;
  decisionBlockers: AdsAutomationBlocker[];
  executionBlockers: AdsAutomationBlocker[];
  // Backward-compatible union of decisionBlockers and executionBlockers.
  blockers: AdsAutomationBlocker[];
  evidenceRefs: AdsAutomationEvidenceRef[];
}

export interface AdsAutomationEvidenceSnapshot {
  schemaVersion: 'ads_automation_evidence_snapshot.v1';
  snapshotId: string;
  generatedAt: string;
  environment: 'local' | 'demo' | 'staging' | 'production';
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
    executionReady: number;
    executionBlocked: number;
  };
  adGroups: AdsAutomationAdGroupEvidence[];
  globalBlockers: AdsAutomationBlocker[];
  safety: {
    localOnly: boolean;
    providerApiCalled: false;
    googleAdsApiCalled: false;
    liveExecutionUsed: false;
    secretsRedacted: true;
    campaignBudgetIdNoFallback: true;
  };
}

export interface AdsAutomationSnapshotQuery {
  limit?: number;
  lookbackDays?: number;
}

export interface AdsAutomationEvaluationInput {
  platform?: AdsAutomationPlatform;
  managerAccountId?: string;
  childAccountId?: string;
  campaignId?: string;
  campaignBudgetId?: string;
  adGroupId: string;
  erpAdGroupId?: string;
  name?: string;
  status?: string;
  productIds?: string[];
  mappingStatus?: AdsAutomationMappingStatus;
  mappingConfidence?: AdsAutomationMappingConfidence;
  commerce?: Partial<AdsAutomationCommerceEvidence>;
  inventory?: Partial<AdsAutomationInventoryEvidence>;
  supplier?: Partial<AdsAutomationSupplierEvidence>;
  finance?: Partial<AdsAutomationFinanceGate>;
  adsGate?: Partial<AdsAutomationGateEvidence>;
  evidenceRefs?: AdsAutomationEvidenceRef[];
  now?: Date;
  minimumOrdersForScale?: number;
}
