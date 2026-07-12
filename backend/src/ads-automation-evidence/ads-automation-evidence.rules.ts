import {
  AdsAutomationAdGroupEvidence,
  AdsAutomationBlocker,
  AdsAutomationCommerceEvidence,
  AdsAutomationEvaluationInput,
  AdsAutomationFinanceGate,
  AdsAutomationFreshnessStatus,
  AdsAutomationGateEvidence,
  AdsAutomationInventoryEvidence,
  AdsAutomationMappingConfidence,
  AdsAutomationMappingHealth,
  AdsAutomationMappingStatus,
  AdsAutomationRecommendedActionFamily,
  AdsAutomationReadinessStatus,
  AdsAutomationSupplierEvidence,
} from './dto/ads-automation-evidence.dto';

const DEFAULT_MINIMUM_ORDERS_FOR_SCALE = 3;

export function evaluateAdGroupEvidence(input: AdsAutomationEvaluationInput): AdsAutomationAdGroupEvidence {
  const productIds = unique(input.productIds || []);
  const decisionBlockers: AdsAutomationBlocker[] = [];
  const mappingMissingLinks: string[] = [];
  const financeBlockers: AdsAutomationBlocker[] = [];
  const adsGateBlockers: AdsAutomationBlocker[] = [];

  const mappingStatus = input.mappingStatus || (productIds.length ? 'mapped' : 'missing');
  const mappingConfidence = input.mappingConfidence || (mappingStatus === 'mapped' ? 'high' : 'low');
  const commerce = commerceEvidence(input.commerce);
  const inventory = inventoryEvidence(productIds, input.inventory);
  const supplier = supplierEvidence(input.supplier);
  const finance = financeGate(input.finance, financeBlockers);
  const adsGate = gateEvidence(input.adsGate, adsGateBlockers);

  if (productIds.length === 0 || mappingStatus === 'missing') {
    mappingMissingLinks.push('product');
    decisionBlockers.push(error(
      'MAPPING_PRODUCT_MISSING',
      'Ad group is not mapped to any ERP product.',
      'ad-group',
      'mapping.productIds',
    ));
  }

  if (mappingStatus === 'conflict') {
    decisionBlockers.push(error(
      'MAPPING_PRODUCT_CONFLICT',
      'Ad group product mapping is conflicting and must be reviewed.',
      'ad-group',
      'mapping.status',
    ));
  }

  if (mappingStatus === 'partial' || mappingConfidence === 'low') {
    decisionBlockers.push(warning(
      'MAPPING_CONFIDENCE_LOW',
      'Ad group mapping confidence is not high enough for scale.',
      'ad-group',
      'mapping.confidence',
    ));
  }

  if (!text(input.campaignBudgetId)) {
    decisionBlockers.push(error(
      'BUDGET_CAMPAIGN_BUDGET_ID_MISSING',
      'Budget scale is blocked because campaignBudgetId is missing. campaignId/adGroupId are not fallbacks.',
      'google-ads',
      'campaignBudgetId',
    ));
  }

  const minOrders = input.minimumOrdersForScale || DEFAULT_MINIMUM_ORDERS_FOR_SCALE;
  if (commerce.orders < minOrders) {
    decisionBlockers.push(warning(
      'COMMERCE_SAMPLE_TOO_SMALL',
      `At least ${minOrders} orders are required before scale; current orders=${commerce.orders}.`,
      'ordertest2',
      'commerce.orders',
    ));
  }

  if (commerce.dataFreshness !== 'fresh') {
    decisionBlockers.push(warning(
      'COMMERCE_DATA_NOT_FRESH',
      'Order/profit evidence is missing or stale.',
      'ordertest2',
      'commerce.dataFreshness',
    ));
  }

  if (commerce.netProfitAfterAds < 0) {
    decisionBlockers.push(error(
      'COMMERCE_NET_PROFIT_AFTER_ADS_NEGATIVE',
      'Net profit after ads is negative.',
      'ordertest2',
      'commerce.netProfitAfterAds',
    ));
  }

  if (productIds.length > 0 && inventory.dataFreshness !== 'fresh') {
    decisionBlockers.push(warning(
      'INVENTORY_DATA_NOT_FRESH',
      'Inventory evidence is missing or stale.',
      'inventory',
      'inventory.dataFreshness',
    ));
  }

  if (inventory.stockRisk === 'out_of_stock') {
    decisionBlockers.push(error(
      'INVENTORY_OUT_OF_STOCK',
      'Product stock is zero or below zero.',
      'inventory',
      'inventory.stockOnHand',
    ));
  } else if (inventory.stockRisk === 'low') {
    decisionBlockers.push(warning(
      'INVENTORY_STOCK_LOW',
      'Product stock is below the configured minimum stock.',
      'inventory',
      'inventory.stockOnHand',
    ));
  }

  if (productIds.length > 0 && supplier.supplierIds.length === 0) {
    decisionBlockers.push(warning(
      'SUPPLIER_MAPPING_MISSING',
      'No supplier evidence is linked to the mapped product.',
      'supplier',
      'supplier.supplierIds',
    ));
  }

  if (supplier.supplierRisk === 'blocked') {
    decisionBlockers.push(error(
      'SUPPLIER_BLOCKED',
      'Supplier evidence is blocking product scale.',
      'supplier',
      'supplier.supplierRisk',
    ));
  } else if (supplier.supplierRisk !== 'ok') {
    decisionBlockers.push(warning(
      'SUPPLIER_NEEDS_REVIEW',
      'Supplier evidence needs review before scale.',
      'supplier',
      'supplier.supplierRisk',
    ));
  }

  decisionBlockers.push(...financeBlockers);

  const mappingHealth: AdsAutomationMappingHealth = {
    status: mappingStatus,
    confidence: mappingConfidence,
    productIds,
    missingLinks: mappingMissingLinks,
    dataFreshness: [
      { source: 'ordertest2', status: commerce.dataFreshness },
      { source: 'inventory', status: inventory.dataFreshness },
      { source: 'supplier', status: supplier.dataFreshness },
      { source: 'finance', status: finance.dataFreshness },
    ],
  };

  const uniqueDecisionBlockers = uniqueBlockers(decisionBlockers);
  const executionBlockers = uniqueBlockers(adsGateBlockers);
  const decisionReadiness = readiness(mappingStatus, uniqueDecisionBlockers, commerce);
  const executionReadiness = adsGate.executable ? 'execution_ready' : 'execution_blocked';
  const recommendedActionFamily = recommendation(decisionReadiness, uniqueDecisionBlockers, supplier, commerce);

  return {
    platform: input.platform || 'unknown',
    managerAccountId: text(input.managerAccountId),
    childAccountId: text(input.childAccountId),
    campaignId: text(input.campaignId),
    campaignBudgetId: text(input.campaignBudgetId),
    adGroupId: input.adGroupId,
    erpAdGroupId: text(input.erpAdGroupId),
    name: text(input.name),
    status: text(input.status),
    productIds,
    decisionReadiness,
    executionReadiness,
    readinessStatus: decisionReadiness,
    recommendedActionFamily,
    mappingHealth,
    commerceEvidence: commerce,
    inventoryEvidence: inventory,
    supplierEvidence: supplier,
    financeGate: finance,
    adsGate,
    decisionBlockers: uniqueDecisionBlockers,
    executionBlockers,
    blockers: uniqueBlockers([...uniqueDecisionBlockers, ...executionBlockers]),
    evidenceRefs: input.evidenceRefs || [],
  };
}

function commerceEvidence(input: Partial<AdsAutomationCommerceEvidence> = {}): AdsAutomationCommerceEvidence {
  const revenue = number(input.revenue);
  const netProfitAfterAds = number(input.netProfitAfterAds);
  return {
    orders: number(input.orders),
    revenue,
    cancellations: number(input.cancellations),
    returns: number(input.returns),
    grossProfit: number(input.grossProfit),
    netProfitAfterAds,
    marginPercent: input.marginPercent ?? (revenue > 0 ? (netProfitAfterAds / revenue) * 100 : 0),
    latestOrderAt: input.latestOrderAt,
    dataFreshness: input.dataFreshness || 'missing',
  };
}

function inventoryEvidence(
  productIds: string[],
  input: Partial<AdsAutomationInventoryEvidence> = {},
): AdsAutomationInventoryEvidence {
  const stockOnHand = optionalNumber(input.stockOnHand);
  const minStock = optionalNumber(input.minStock);
  const stockRisk = input.stockRisk || stockRiskFrom(stockOnHand, minStock);
  return {
    productIds,
    stockOnHand,
    minStock,
    stockRisk,
    fulfillmentRisk: input.fulfillmentRisk || (stockRisk === 'ok' ? 'ok' : stockRisk === 'unknown' ? 'unknown' : 'review'),
    updatedAt: input.updatedAt,
    dataFreshness: input.dataFreshness || (stockOnHand === undefined ? 'missing' : 'unknown'),
  };
}

function supplierEvidence(input: Partial<AdsAutomationSupplierEvidence> = {}): AdsAutomationSupplierEvidence {
  const supplierIds = unique(input.supplierIds || []);
  const quoteCount = number(input.quoteCount);
  const openPayableBalance = number(input.openPayableBalance);
  const quoteStatus = input.quoteStatus || (quoteCount > 0 ? 'available' : 'missing');
  const payableStatus = input.payableStatus || (openPayableBalance > 0 ? 'open' : supplierIds.length ? 'clear' : 'unknown');
  const supplierRisk = input.supplierRisk || supplierRiskFrom(supplierIds, quoteStatus, payableStatus, input.dataFreshness);

  return {
    supplierIds,
    quoteCount,
    openPayableBalance,
    quoteStatus,
    payableStatus,
    supplierRisk,
    updatedAt: input.updatedAt,
    dataFreshness: input.dataFreshness || (supplierIds.length ? 'unknown' : 'missing'),
  };
}

function financeGate(
  input: Partial<AdsAutomationFinanceGate> = {},
  blockers: AdsAutomationBlocker[],
): AdsAutomationFinanceGate {
  const currentDailySpend = number(input.currentDailySpend);
  const currentMonthlySpend = number(input.currentMonthlySpend);
  const availableCash = optionalNumber(input.availableCash);
  const dailyCap = optionalNumber(input.dailyCap);
  const monthlyCap = optionalNumber(input.monthlyCap);
  const lossLimit = optionalNumber(input.lossLimit);
  const realizedLoss = number(input.realizedLoss);
  const dataFreshness = input.dataFreshness || (availableCash === undefined ? 'missing' : 'unknown');
  const cappedBudgetIncrease = input.cappedBudgetIncrease ?? budgetIncreaseHeadroom({
    availableCash,
    dailyCap,
    monthlyCap,
    currentDailySpend,
    currentMonthlySpend,
  });

  let status = input.status || 'hold';
  if (availableCash === undefined) {
    blockers.push(error('FINANCE_AVAILABLE_CASH_MISSING', 'Available cashflow evidence is missing.', 'finance', 'finance.availableCash'));
    status = 'unknown';
  } else if (availableCash <= 0) {
    blockers.push(error('FINANCE_AVAILABLE_CASH_EMPTY', 'Available cashflow is zero or negative.', 'finance', 'finance.availableCash'));
    status = 'block';
  }

  if (lossLimit !== undefined && realizedLoss >= lossLimit) {
    blockers.push(error('FINANCE_LOSS_LIMIT_HIT', 'Configured loss limit has been reached or exceeded.', 'finance', 'finance.lossLimit'));
    status = 'block';
  }

  if (dailyCap !== undefined && dailyCap > 0 && currentDailySpend >= dailyCap) {
    blockers.push(error('FINANCE_DAILY_CAP_REACHED', 'Daily ads budget cap has been reached.', 'finance', 'finance.dailyCap'));
    status = 'block';
  }

  if (monthlyCap !== undefined && monthlyCap > 0 && currentMonthlySpend >= monthlyCap) {
    blockers.push(error('FINANCE_MONTHLY_CAP_REACHED', 'Monthly ads budget cap has been reached.', 'finance', 'finance.monthlyCap'));
    status = 'block';
  }

  if (dataFreshness !== 'fresh') {
    blockers.push(warning(
      'FINANCE_DATA_NOT_FRESH',
      'Cashflow and budget evidence is missing, stale, or unknown; scaling must remain on hold.',
      'finance',
      'finance.dataFreshness',
    ));
    if (status !== 'block' && status !== 'unknown') status = 'hold';
  }

  if (status === 'hold' && availableCash !== undefined && availableCash > 0) {
    status = dataFreshness === 'fresh' ? 'allow_scale' : 'hold';
  }

  return {
    status,
    availableCash,
    dailyCap,
    monthlyCap,
    currentDailySpend,
    currentMonthlySpend,
    lossLimit,
    realizedLoss,
    cappedBudgetIncrease,
    blockers,
    dataFreshness,
  };
}

function gateEvidence(
  input: Partial<AdsAutomationGateEvidence> = {},
  blockers: AdsAutomationBlocker[],
): AdsAutomationGateEvidence {
  const productionEnabled = input.productionEnabled === true;
  const providerExecutionEnabled = input.providerExecutionEnabled === true;
  const dryRun = input.dryRun !== false;
  const killSwitchActive = input.killSwitchActive === true;
  const providerValidateOnlyPassed = input.providerValidateOnlyPassed === true;
  const approved = input.approved === true;
  const idempotencyReady = input.idempotencyReady === true;
  const beforeStateSnapshotReady = input.beforeStateSnapshotReady === true;
  const auditReady = input.auditReady === true;

  if (killSwitchActive) {
    blockers.push(error('ADS_KILL_SWITCH_ACTIVE', 'Kill switch is active.', 'ads-gate', 'adsGate.killSwitchActive'));
  }
  if (!productionEnabled) {
    blockers.push(error('ADS_PRODUCTION_DISABLED', 'GOOGLE_ADS_PRODUCTION_ENABLED is false or absent.', 'ads-gate', 'adsGate.productionEnabled'));
  }
  if (!providerExecutionEnabled) {
    blockers.push(error('ADS_PROVIDER_EXECUTION_DISABLED', 'Provider execution is disabled.', 'ads-gate', 'adsGate.providerExecutionEnabled'));
  }
  if (dryRun) {
    blockers.push(error('ADS_DRY_RUN_ENABLED', 'Dry-run mode is enabled; live execution is blocked.', 'ads-gate', 'adsGate.dryRun'));
  }
  if (!providerValidateOnlyPassed) {
    blockers.push(error('ADS_VALIDATE_ONLY_MISSING', 'Provider validateOnly has not passed.', 'ads-gate', 'adsGate.providerValidateOnlyPassed'));
  }
  if (!approved) {
    blockers.push(error('ADS_APPROVAL_MISSING', 'Human approval is missing.', 'ads-gate', 'adsGate.approved'));
  }
  if (!idempotencyReady) {
    blockers.push(error('ADS_IDEMPOTENCY_MISSING', 'Idempotency evidence is missing.', 'ads-gate', 'adsGate.idempotencyReady'));
  }
  if (!beforeStateSnapshotReady) {
    blockers.push(warning('ADS_BEFORE_STATE_SNAPSHOT_MISSING', 'Before-state snapshot evidence is missing.', 'ads-gate', 'adsGate.beforeStateSnapshotReady'));
  }
  if (!auditReady) {
    blockers.push(error('ADS_AUDIT_NOT_READY', 'Audit evidence is not ready.', 'ads-gate', 'adsGate.auditReady'));
  }

  const executable = blockers.every((item) => item.severity !== 'error');

  return {
    executable,
    productionEnabled,
    providerExecutionEnabled,
    dryRun,
    killSwitchActive,
    providerValidateOnlyPassed,
    approved,
    idempotencyReady,
    beforeStateSnapshotReady,
    auditReady,
    blockers,
  };
}

function readiness(
  mappingStatus: AdsAutomationMappingStatus,
  blockers: AdsAutomationBlocker[],
  commerce: AdsAutomationCommerceEvidence,
): AdsAutomationReadinessStatus {
  if (mappingStatus === 'missing' || blockers.some((item) => item.code === 'MAPPING_PRODUCT_MISSING')) {
    return 'needs_mapping';
  }
  if (blockers.some((item) => item.severity === 'error')) {
    return 'blocked';
  }
  if (blockers.some((item) => item.severity === 'warning')) {
    return 'hold';
  }
  if (commerce.orders > 0 && commerce.netProfitAfterAds > 0) {
    return 'scale_ready';
  }
  return 'monitor_only';
}

function recommendation(
  readinessStatus: AdsAutomationReadinessStatus,
  blockers: AdsAutomationBlocker[],
  supplier: AdsAutomationSupplierEvidence,
  commerce: AdsAutomationCommerceEvidence,
): AdsAutomationRecommendedActionFamily {
  if (readinessStatus === 'needs_mapping') return 'monitor_only';
  if (commerce.netProfitAfterAds < 0 || blockers.some((item) => item.code === 'FINANCE_LOSS_LIMIT_HIT')) {
    return blockers.some((item) => item.code === 'COMMERCE_NET_PROFIT_AFTER_ADS_NEGATIVE') ? 'pause_review' : 'reduce_review';
  }
  if (supplier.supplierRisk !== 'ok' && supplier.supplierIds.length === 0) return 'supplier_sourcing';
  if (readinessStatus === 'scale_ready') return 'scale';
  return 'monitor_only';
}

export function summarizeReadiness(adGroups: AdsAutomationAdGroupEvidence[]) {
  return {
    totalAdGroups: adGroups.length,
    scaleReady: adGroups.filter((item) => item.decisionReadiness === 'scale_ready').length,
    hold: adGroups.filter((item) => item.decisionReadiness === 'hold').length,
    monitorOnly: adGroups.filter((item) => item.decisionReadiness === 'monitor_only').length,
    blocked: adGroups.filter((item) => item.decisionReadiness === 'blocked').length,
    needsMapping: adGroups.filter((item) => item.decisionReadiness === 'needs_mapping').length,
    executionReady: adGroups.filter((item) => item.executionReadiness === 'execution_ready').length,
    executionBlocked: adGroups.filter((item) => item.executionReadiness === 'execution_blocked').length,
  };
}

export function freshnessFromDate(value: Date | string | undefined, now: Date, maxAgeDays: number): AdsAutomationFreshnessStatus {
  if (!value) return 'missing';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const ageMs = now.getTime() - date.getTime();
  if (ageMs < 0) return 'fresh';
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000 ? 'fresh' : 'stale';
}

function stockRiskFrom(stockOnHand?: number, minStock?: number) {
  if (stockOnHand === undefined) return 'unknown';
  if (stockOnHand <= 0) return 'out_of_stock';
  if (minStock !== undefined && stockOnHand < minStock) return 'low';
  return 'ok';
}

function supplierRiskFrom(
  supplierIds: string[],
  quoteStatus: string,
  payableStatus: string,
  dataFreshness?: string,
) {
  if (!supplierIds.length || quoteStatus === 'missing') return 'unknown';
  if (payableStatus === 'overdue') return 'blocked';
  if (payableStatus === 'open' || quoteStatus === 'stale' || dataFreshness === 'stale') return 'review';
  return 'ok';
}

function error(code: string, message: string, source?: string, evidencePath?: string): AdsAutomationBlocker {
  return { code, severity: 'error', message, source, evidencePath };
}

function warning(code: string, message: string, source?: string, evidencePath?: string): AdsAutomationBlocker {
  return { code, severity: 'warning', message, source, evidencePath };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => text(value)).filter(Boolean) as string[]));
}

function uniqueBlockers(values: AdsAutomationBlocker[]): AdsAutomationBlocker[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.code}:${item.evidencePath || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function text(value: unknown): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function budgetIncreaseHeadroom(input: {
  availableCash?: number;
  dailyCap?: number;
  monthlyCap?: number;
  currentDailySpend: number;
  currentMonthlySpend: number;
}): number | undefined {
  const constraints: number[] = [];
  if (input.availableCash !== undefined) constraints.push(Math.max(0, input.availableCash));
  if (input.dailyCap !== undefined && input.dailyCap > 0) {
    constraints.push(Math.max(0, input.dailyCap - input.currentDailySpend));
  }
  if (input.monthlyCap !== undefined && input.monthlyCap > 0) {
    constraints.push(Math.max(0, input.monthlyCap - input.currentMonthlySpend));
  }
  return constraints.length ? Math.min(...constraints) : undefined;
}
