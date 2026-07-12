import type { ConfidenceLevel, DataQualityStatus } from '../contracts/metadata.contract';
import type { OperationalRiskFindingKey } from '../threshold-registry/threshold-source.contract';
import type {
  FreshnessDowngradeInput,
  FreshnessDowngradeResult,
  MergeSourceMetadataOptions,
  SourceFreshnessMetadata,
  SourceFreshnessStatus,
  SourceLineageDefinition,
  SourceMetadataPart,
  SourceTimestampWindow,
} from './source-freshness.contract';

const LINEAGE_BY_FINDING: Record<OperationalRiskFindingKey, SourceLineageDefinition> = {
  low_inventory_best_seller: {
    findingKey: 'low_inventory_best_seller',
    modules: ['OperationsCapacityQuery', 'threshold-registry'],
    collections: ['inventorysummaries', 'products', 'ordertest2', 'purchaseorders', 'deliverystatuses'],
    fields: [
      'inventorysummaries.productId',
      'inventorysummaries.onHand',
      'inventorysummaries.updatedAt',
      'products._id',
      'products.minStock',
      'products.estimatedDeliveryDays',
      'products.updatedAt',
      'ordertest2.productId',
      'ordertest2.quantity',
      'ordertest2.orderStatus',
      'ordertest2.orderDate',
      'ordertest2.updatedAt',
      'ordertest2.createdAt',
      'purchaseorders.status',
      'purchaseorders.expectedDeliveryDate',
      'purchaseorders.receivedDate',
      'purchaseorders.items.productId',
      'purchaseorders.items.quantity',
      'purchaseorders.items.quantityReceived',
      'purchaseorders.createdAt',
      'purchaseorders.updatedAt',
      'deliverystatuses.isFinal',
      'deliverystatuses.isPaymentTrigger',
      'deliverystatuses.isReturnStatus',
      'deliverystatuses.updatedAt',
    ],
    method: 'latest_record_date_with_derived_inventory_candidate',
    isDerivedCandidate: true,
    derivationNotes: [
      'sales velocity, reserved quantity, incoming stock, available quantity, and projected cover are derived candidates',
      'inventory evidence remains advisory until reserved and incoming semantics are confirmed',
    ],
  },
  supplier_cost_up: {
    findingKey: 'supplier_cost_up',
    modules: ['OperationsCapacityQuery', 'threshold-registry'],
    collections: ['supplierquotes', 'quotes', 'products'],
    fields: [
      'supplierquotes.productId',
      'supplierquotes.supplierId',
      'supplierquotes.price',
      'supplierquotes.currency',
      'supplierquotes.effectiveAt',
      'supplierquotes.createdAt',
      'supplierquotes.updatedAt',
      'quotes.productId',
      'quotes.unitPrice',
      'quotes.status',
      'quotes.validFrom',
      'quotes.createdAt',
      'quotes.updatedAt',
      'products.importPrice',
      'products.totalCost',
      'products.suppliers.appliedPrice',
      'products.suppliers.appliedAt',
      'products.updatedAt',
    ],
    method: 'latest_supplier_and_dealer_price_timestamp',
    isDerivedCandidate: true,
    derivationNotes: [
      'cost increase, dealer price lag, and cost source selection are derived candidates',
      'margin impact and accepted price workflow are not proven by this metadata',
    ],
  },
  overdue_dealer_receivables: {
    findingKey: 'overdue_dealer_receivables',
    modules: ['OperationsCapacityQuery', 'threshold-registry'],
    collections: ['ordertest2', 'agentstatements', 'users'],
    fields: [
      'ordertest2.agentId',
      'ordertest2.agentPaymentStatus',
      'ordertest2.agentPaymentDueDate',
      'ordertest2.agentPaidAt',
      'ordertest2.agentPaidAmount',
      'ordertest2.agentCommissionAmount',
      'ordertest2.agentCommissionFinal',
      'ordertest2.agentQuote',
      'ordertest2.agentAppliedPrice',
      'ordertest2.orderDate',
      'ordertest2.createdAt',
      'ordertest2.updatedAt',
      'agentstatements.agentId',
      'agentstatements.periodFrom',
      'agentstatements.periodTo',
      'agentstatements.status',
      'agentstatements.closingBalance',
      'agentstatements.periodReceivables',
      'agentstatements.periodCollected',
      'agentstatements.payments.paidAt',
      'agentstatements.createdAt',
      'agentstatements.updatedAt',
      'users.managerId',
      'users.isActive',
      'users.updatedAt',
    ],
    method: 'latest_due_statement_payment_or_owner_timestamp',
    isDerivedCandidate: true,
    derivationNotes: [
      'outstanding balance, aging, and collection owner are derived from settlement fields',
      'receivable terminology remains advisory until finance semantics are approved',
    ],
  },
  labor_overtime_high: {
    findingKey: 'labor_overtime_high',
    modules: ['OperationsCapacityQuery', 'threshold-registry'],
    collections: ['laborcost1', 'laborstatements', 'ordertest2', 'users'],
    fields: [
      'laborcost1.userId',
      'laborcost1.date',
      'laborcost1.workHours',
      'laborcost1.sessionCount',
      'laborcost1.hourlyRate',
      'laborcost1.cost',
      'laborcost1.paymentStatus',
      'laborcost1.paidAt',
      'laborcost1.createdAt',
      'laborcost1.updatedAt',
      'laborstatements.employeeId',
      'laborstatements.periodFrom',
      'laborstatements.periodTo',
      'laborstatements.status',
      'laborstatements.periodCost',
      'laborstatements.totalWorkHours',
      'laborstatements.sessionCount',
      'laborstatements.dueDate',
      'laborstatements.kpiUpdatedAt',
      'laborstatements.createdAt',
      'laborstatements.updatedAt',
      'ordertest2.orderDate',
      'ordertest2.quantity',
      'ordertest2.depositAmount',
      'ordertest2.codAmount',
      'ordertest2.manualPayment',
      'ordertest2.productionStatus',
      'ordertest2.orderStatus',
      'users.role',
      'users.managerId',
      'users.isActive',
      'users.updatedAt',
    ],
    method: 'comparison_window_latest_labor_and_workload_timestamp',
    isDerivedCandidate: true,
    derivationNotes: [
      'overtime is derived from work hours over an 8 hour candidate threshold',
      'SLA pressure, staffing capacity, and approved overtime policy are not proven by this metadata',
    ],
  },
  slow_supplier_good_cost: {
    findingKey: 'slow_supplier_good_cost',
    modules: ['OperationsCapacityQuery', 'threshold-registry'],
    collections: ['supplierquotes', 'purchaseorders', 'products', 'inventorysummaries', 'users'],
    fields: [
      'supplierquotes.productId',
      'supplierquotes.supplierId',
      'supplierquotes.price',
      'supplierquotes.currency',
      'supplierquotes.effectiveAt',
      'supplierquotes.createdAt',
      'supplierquotes.updatedAt',
      'purchaseorders.supplierId',
      'purchaseorders.supplierNameSnap',
      'purchaseorders.status',
      'purchaseorders.expectedDeliveryDate',
      'purchaseorders.receivedDate',
      'purchaseorders.items.productId',
      'purchaseorders.items.quantity',
      'purchaseorders.items.quantityReceived',
      'purchaseorders.items.unitPrice',
      'purchaseorders.createdAt',
      'purchaseorders.updatedAt',
      'products.estimatedDeliveryDays',
      'products.importPrice',
      'products.totalCost',
      'products.suppliers',
      'products.updatedAt',
      'inventorysummaries.avgCost',
      'inventorysummaries.updatedAt',
      'users.role',
      'users.isActive',
      'users.updatedAt',
    ],
    method: 'latest_quote_purchase_order_product_inventory_timestamp',
    isDerivedCandidate: true,
    derivationNotes: [
      'peer median, cost advantage, delivery delay, and lead-time signals are derived candidates',
      'supplier reliability score, delivery quality notes, and margin impact are not proven by this metadata',
    ],
  },
};

export function latestTimestamp(rows: readonly unknown[], fields: readonly string[]): string | null {
  const stats = timestampStats(rows, fields);
  return stats.latest === null ? null : new Date(stats.latest).toISOString();
}

export function windowFromRows(rows: readonly unknown[], fields: readonly string[]): SourceTimestampWindow {
  const stats = timestampStats(rows, fields);
  return {
    source_window_from: stats.earliest === null ? null : new Date(stats.earliest).toISOString(),
    source_window_to: stats.latest === null ? null : new Date(stats.latest).toISOString(),
  };
}

export function countRows<T>(rows: readonly T[], predicate?: (row: T) => boolean): number {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!predicate) {
    return safeRows.length;
  }

  return safeRows.reduce((total, row) => total + (predicate(row) ? 1 : 0), 0);
}

export function freshnessFromTimestamp(
  lastObservedAt: Date | string | number | null | undefined,
  asOfDate: Date | string | number,
  maxAgeMinutes: number | null | undefined,
): SourceFreshnessStatus {
  if (lastObservedAt === null || lastObservedAt === undefined || lastObservedAt === '') {
    return 'missing';
  }

  const lastObservedMillis = timestampMillis(lastObservedAt);
  const asOfMillis = timestampMillis(asOfDate);
  if (lastObservedMillis === null || asOfMillis === null) {
    return 'unknown';
  }

  if (typeof maxAgeMinutes !== 'number' || !Number.isFinite(maxAgeMinutes) || maxAgeMinutes < 0) {
    return 'unknown';
  }

  const ageMinutes = Math.max(0, (asOfMillis - lastObservedMillis) / 60_000);
  return ageMinutes <= maxAgeMinutes ? 'fresh' : 'stale';
}

export function mergeSourceMetadata(
  parts: readonly SourceMetadataPart[],
  options: MergeSourceMetadataOptions,
): SourceFreshnessMetadata {
  const safeParts = Array.isArray(parts) ? parts : [];
  const allRows = safeParts.flatMap((part) => safeRows(part.rows));
  const timestampFields = uniqueStrings(safeParts.flatMap((part) => safeStrings(part.timestampFields)));
  const sourceRecordCount = safeParts.reduce(
    (total, part) => total + numericCount(part.recordCount, countRows(safeRows(part.rows))),
    0,
  );
  const sourceSampleSize = safeParts.reduce(
    (total, part) => total + numericCount(part.sampleSize, countRows(safeRows(part.rows))),
    0,
  );
  const lastObservedAt = latestTimestamp(allRows, timestampFields);
  const window = windowFromRows(allRows, timestampFields);
  const lineage = lineageForFinding(options.findingKey);
  const status = statusFromParts(sourceRecordCount, lastObservedAt, options);
  const coverageValues = safeParts
    .map((part) => typeof part.coveragePercent === 'number' && Number.isFinite(part.coveragePercent) ? part.coveragePercent : null)
    .filter((value): value is number => value !== null);
  const missingReason = missingReasonForStatus(status, sourceRecordCount, safeParts, options);
  const stalenessReason = status === 'stale'
    ? options.stalenessReason || firstPresent(safeParts.map((part) => part.stalenessReason)) || 'latest_source_timestamp_exceeds_max_age_minutes'
    : null;

  return {
    source_freshness_status: status,
    source_last_observed_at: lastObservedAt,
    source_window_from: window.source_window_from,
    source_window_to: window.source_window_to,
    source_record_count: sourceRecordCount,
    source_sample_size: sourceSampleSize,
    source_missing_reason: missingReason,
    source_staleness_reason: stalenessReason,
    source_coverage_percent: coverageValues.length ? roundMetric(coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length, 2) : null,
    source_lineage_modules: [...lineage.modules],
    source_lineage_collections: [...lineage.collections],
    source_lineage_fields: [...lineage.fields],
    source_lineage_method: options.sourceLineageMethod || lineage.method,
    source_is_derived_candidate: lineage.isDerivedCandidate,
    source_derivation_notes: [...lineage.derivationNotes],
    source_confidence_reason: options.sourceConfidenceReason || confidenceReasonForStatus(status, lineage.isDerivedCandidate),
  };
}

export function lineageForFinding(findingKey: OperationalRiskFindingKey): SourceLineageDefinition {
  const lineage = LINEAGE_BY_FINDING[findingKey];
  return {
    ...lineage,
    modules: [...lineage.modules],
    collections: [...lineage.collections],
    fields: [...lineage.fields],
    derivationNotes: [...lineage.derivationNotes],
  };
}

export function applyFreshnessDowngrade(
  rowQuality: FreshnessDowngradeInput,
  sourceMetadata: SourceFreshnessMetadata,
): FreshnessDowngradeResult {
  const missingOrWeakFields = new Set(rowQuality.missing_or_weak_fields || []);
  let dataQualityStatus: DataQualityStatus = rowQuality.data_quality_status;
  let confidence: ConfidenceLevel = rowQuality.confidence;
  let reason = rowQuality.confidence_reason || sourceMetadata.source_confidence_reason;
  let dataQualityReason = rowQuality.data_quality_reason || sourceMetadata.source_confidence_reason;

  if (sourceMetadata.source_freshness_status === 'missing') {
    dataQualityStatus = 'missing';
    confidence = 'low';
    missingOrWeakFields.add('source_freshness_missing');
    reason = sourceMetadata.source_missing_reason || reason;
    dataQualityReason = sourceMetadata.source_missing_reason || dataQualityReason;
  } else if (sourceMetadata.source_freshness_status === 'stale') {
    dataQualityStatus = 'stale';
    confidence = 'low';
    missingOrWeakFields.add('source_freshness_stale');
    reason = sourceMetadata.source_staleness_reason || reason;
    dataQualityReason = sourceMetadata.source_staleness_reason || dataQualityReason;
  } else if (
    sourceMetadata.source_freshness_status === 'unknown' ||
    sourceMetadata.source_freshness_status === 'not_configured' ||
    sourceMetadata.source_freshness_status === 'unsupported'
  ) {
    dataQualityStatus = dataQualityStatus === 'missing' ? 'missing' : 'weak';
    confidence = 'low';
    missingOrWeakFields.add(`source_freshness_${sourceMetadata.source_freshness_status}`);
  } else if (sourceMetadata.source_is_derived_candidate) {
    dataQualityStatus = dataQualityStatus === 'ok' ? 'partial' : dataQualityStatus;
    confidence = capConfidence(confidence, 'medium');
    missingOrWeakFields.add('source_derived_candidate');
  }

  return {
    data_quality_status: dataQualityStatus,
    confidence,
    confidence_reason: reason,
    data_quality_reason: dataQualityReason,
    missing_or_weak_fields: Array.from(missingOrWeakFields),
  };
}

function statusFromParts(
  sourceRecordCount: number,
  lastObservedAt: string | null,
  options: MergeSourceMetadataOptions,
): SourceFreshnessStatus {
  if (sourceRecordCount <= 0) {
    return 'missing';
  }
  if (!lastObservedAt) {
    return 'unknown';
  }
  return freshnessFromTimestamp(lastObservedAt, options.asOfDate, options.maxAgeMinutes);
}

function missingReasonForStatus(
  status: SourceFreshnessStatus,
  sourceRecordCount: number,
  parts: readonly SourceMetadataPart[],
  options: MergeSourceMetadataOptions,
): string | null {
  if (status !== 'missing' && status !== 'unknown') {
    return null;
  }

  return options.missingReason
    || firstPresent(parts.map((part) => part.missingReason))
    || (sourceRecordCount <= 0 ? 'no_source_rows_available' : 'source_rows_have_no_valid_timestamp');
}

function confidenceReasonForStatus(status: SourceFreshnessStatus, isDerivedCandidate: boolean): string {
  if (status === 'fresh' && isDerivedCandidate) {
    return 'source timestamps are fresh, but row evidence remains advisory because derived candidate formulas are used';
  }
  if (status === 'fresh') {
    return 'source timestamps are fresh for the inspected evidence rows';
  }
  if (status === 'stale') {
    return 'source timestamps are older than the configured source freshness window';
  }
  if (status === 'missing') {
    return 'required source rows are missing for this evidence row';
  }
  return `source freshness is ${status} for this evidence row`;
}

function timestampStats(rows: readonly unknown[], fields: readonly string[]) {
  let earliest: number | null = null;
  let latest: number | null = null;
  for (const row of safeRows(rows)) {
    for (const field of safeStrings(fields)) {
      for (const value of valuesAtPath(row, field.split('.'))) {
        const timestamp = timestampMillis(value);
        if (timestamp === null) {
          continue;
        }
        earliest = earliest === null ? timestamp : Math.min(earliest, timestamp);
        latest = latest === null ? timestamp : Math.max(latest, timestamp);
      }
    }
  }

  return { earliest, latest };
}

function valuesAtPath(value: unknown, pathParts: readonly string[]): unknown[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!pathParts.length) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => valuesAtPath(item, pathParts));
  }
  if (typeof value !== 'object') {
    return [];
  }

  const [head, ...tail] = pathParts;
  return valuesAtPath((value as Record<string, unknown>)[head], tail);
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  return null;
}

function safeRows(rows: readonly unknown[] | undefined): unknown[] {
  return Array.isArray(rows) ? [...rows] : [];
}

function safeStrings(values: readonly string[] | undefined): string[] {
  return Array.isArray(values) ? values.filter((value) => typeof value === 'string' && value.trim().length > 0) : [];
}

function numericCount(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function firstPresent(values: readonly (string | null | undefined)[]): string | null {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0) || null;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
}

function roundMetric(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function capConfidence(value: ConfidenceLevel, cap: ConfidenceLevel): ConfidenceLevel {
  const rank: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };
  return rank[value] <= rank[cap] ? value : cap;
}
