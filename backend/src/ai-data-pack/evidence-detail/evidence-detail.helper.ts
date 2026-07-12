import type {
  BuildEvidenceDetailInput,
  EvidenceCalculationStep,
  EvidenceDetailResult,
  EvidenceDrilldownRef,
  EvidenceEntity,
  EvidenceRow,
  EvidenceScalar,
  EvidenceSerializable,
  EvidenceThresholdComparison,
  EvidenceTimeWindow,
} from './evidence-detail.contract';

const DEFAULT_EVIDENCE_SAMPLE_LIMIT = 10;

const DEFAULT_TIMESTAMP_FIELDS = [
  'updatedAt',
  'createdAt',
  'orderDate',
  'effectiveAt',
  'validFrom',
  'receivedDate',
  'expectedDeliveryDate',
  'date',
  'periodTo',
  'paidAt',
];

const DEFAULT_ENTITY_NAME_FIELDS = [
  'name',
  'fullName',
  'sku',
  'poNumber',
  'supplierNameSnap',
  'agentName',
  'status',
];

export function buildEvidenceDetail(input: BuildEvidenceDetailInput): EvidenceDetailResult {
  const sampleLimit = normalizeSampleLimit(input.evidence_sample_limit);
  const sourceRows = input.source_rows || [];
  const totalCount = sourceRows.reduce((sum, group) => sum + group.rows.length, 0);
  const timeWindow = normalizeTimeWindow(input.evidence_time_window, input.row);
  const thresholdComparison = normalizeThresholdComparison(input.evidence_threshold_comparison, input.row);
  const calculationSteps = normalizeCalculationSteps(input.evidence_calculation_steps || []);
  const directFields = uniqueStrings(input.evidence_direct_fields || []);
  const derivedFields = uniqueStrings(input.evidence_derived_fields || []);
  const missingFields = normalizeMissingFields(input.evidence_missing_fields || []);
  const verificationFields = uniqueStrings(input.evidence_verification_fields || directFields);
  const emittedReason = input.reason_row_was_emitted || `Finding ${input.finding_key} emitted because the advisory metric crossed the documented threshold.`;
  const blockedReason = input.reason_action_is_blocked || String(input.row.blocking_reason_if_any || input.row.not_allowed_actions || 'Advisory evidence only; manual review required before any operational change.');
  const cappedReason = input.reason_confidence_was_capped || confidenceCapReason(input.row, missingFields);

  const allEvidenceRows = buildRows({
    sourceRows,
    sampleLimit: Number.MAX_SAFE_INTEGER,
    timeWindow,
    thresholdComparison,
    calculationSteps,
    emittedReason,
    cappedReason,
    blockedReason,
  });
  const evidenceRows = allEvidenceRows.slice(0, sampleLimit);
  const drilldownRefs = allEvidenceRows.map((row) => ({
    source_collection: row.source_collection,
    source_row_id: row.source_row_id,
    drilldown_ref: row.drilldown_ref,
    read_only: true as const,
  }));
  const entities = normalizeEntities(input.evidence_entities, input.row, evidenceRows);
  const manualOwner = input.recommended_manual_owner || 'BA/Operations reviewer';
  const manualQuestion = input.manual_review_question || `Can the reviewer confirm the source rows, threshold, and missing fields before using ${input.finding_key} for a decision?`;
  const topEntities = entities
    .map((entity) => [entity.entity_type, entity.entity_name_or_alias || entity.entity_id].filter(Boolean).join(':'))
    .filter(Boolean)
    .slice(0, 5)
    .join('; ');
  const drilldownSummary = drilldownRefs.map((ref) => ref.drilldown_ref).slice(0, 10).join('; ');

  return {
    evidence_summary: buildSummary(input.finding_key, totalCount, sampleLimit, entities, thresholdComparison, missingFields),
    evidence_rows: evidenceRows,
    evidence_row_count: totalCount,
    evidence_sample_limit: sampleLimit,
    evidence_entities: entities,
    evidence_time_window: timeWindow,
    evidence_direct_fields: directFields,
    evidence_derived_fields: derivedFields,
    evidence_calculation_steps: calculationSteps,
    evidence_threshold_comparison: thresholdComparison,
    evidence_source_freshness: input.evidence_source_freshness || {},
    evidence_missing_fields: missingFields,
    evidence_verification_fields: verificationFields,
    evidence_drilldown_refs: drilldownRefs,
    recommended_manual_owner: manualOwner,
    manual_review_question: manualQuestion,
    blocked_actions_summary: buildBlockedSummary(input.row.not_allowed_actions, blockedReason),
    top_evidence_entities: topEntities || 'not_available',
    evidence_missing_fields_summary: missingFields.join('; '),
    evidence_drilldown_refs_summary: drilldownSummary || 'no_source_rows_available',
  };
}

function buildRows(input: {
  sourceRows: readonly BuildEvidenceDetailInput['source_rows'][number][];
  sampleLimit: number;
  timeWindow: EvidenceTimeWindow;
  thresholdComparison: EvidenceThresholdComparison;
  calculationSteps: EvidenceCalculationStep[];
  emittedReason: string;
  cappedReason: string | null;
  blockedReason: string;
}): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  for (const group of input.sourceRows) {
    group.rows.forEach((sourceRow, index) => {
      if (rows.length >= input.sampleLimit) {
        return;
      }
      const rowRecord = isRecord(sourceRow) ? sourceRow : {};
      const sourceRowId = entityId(rowRecord) || `${group.source_collection}:${index + 1}`;
      const fieldNames = uniqueStrings(group.source_field_names || []);
      const rawValues = valuesForFields(rowRecord, fieldNames);
      const timestamp = firstTimestamp(rowRecord, [...(group.timestamp_fields || []), ...DEFAULT_TIMESTAMP_FIELDS]);
      const entityName = firstString(rowRecord, [...(group.entity_name_fields || []), ...DEFAULT_ENTITY_NAME_FIELDS]);
      const drilldownRef = `${group.source_collection}:${sourceRowId}`;
      rows.push({
        entity_id: entityId(rowRecord),
        entity_name_or_alias: entityName,
        entity_type: group.entity_type,
        source_module: group.source_module,
        source_collection: group.source_collection,
        source_row_id: sourceRowId,
        source_field_names: fieldNames,
        raw_values_used: rawValues,
        normalized_values_used: rawValues,
        timestamp,
        comparison_window_from: input.timeWindow.comparison_window_from,
        comparison_window_to: input.timeWindow.comparison_window_to,
        threshold_used: input.thresholdComparison.threshold_value,
        threshold_source_key: input.thresholdComparison.threshold_source_key,
        calculation_result: input.thresholdComparison.metric_value,
        calculation_step_ref: input.calculationSteps.map((step) => step.step_key).join('|') || null,
        reason_row_was_emitted: input.emittedReason,
        reason_confidence_was_capped: input.cappedReason,
        reason_action_is_blocked: input.blockedReason,
        drilldown_ref: drilldownRef,
      });
    });
  }
  return rows;
}

function normalizeSampleLimit(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return DEFAULT_EVIDENCE_SAMPLE_LIMIT;
  }
  return Math.max(1, Math.min(50, Math.floor(value)));
}

function normalizeTimeWindow(input: EvidenceTimeWindow | undefined, row: Record<string, unknown>): EvidenceTimeWindow {
  if (input) {
    return {
      label: input.label || null,
      comparison_window_from: isoOrNull(input.comparison_window_from),
      comparison_window_to: isoOrNull(input.comparison_window_to),
    };
  }

  return {
    label: typeof row.time_window === 'string' ? row.time_window : null,
    comparison_window_from: null,
    comparison_window_to: null,
  };
}

function normalizeThresholdComparison(input: EvidenceThresholdComparison | undefined, row: Record<string, unknown>): EvidenceThresholdComparison {
  return {
    metric_name: input?.metric_name || stringOrNull(row.metric_name),
    metric_value: normalizeValue(input?.metric_value ?? row.metric_value),
    threshold_value: normalizeValue(input?.threshold_value ?? row.threshold_value),
    threshold_source_key: input?.threshold_source_key || stringOrNull(row.threshold_source_key),
    threshold_unit: input?.threshold_unit || stringOrNull(row.threshold_unit),
    comparison_operator: input?.comparison_operator || null,
    comparison_result: input?.comparison_result || null,
  };
}

function normalizeCalculationSteps(steps: readonly EvidenceCalculationStep[]): EvidenceCalculationStep[] {
  return steps
    .filter((step) => step && typeof step.step_key === 'string' && step.step_key.trim().length > 0)
    .map((step) => ({
      step_key: step.step_key,
      description: step.description || step.step_key,
      input_fields: uniqueStrings(step.input_fields || []),
      output_field: step.output_field || null,
      output_value: normalizeValue(step.output_value),
    }));
}

function normalizeEntities(
  entities: readonly EvidenceEntity[] | undefined,
  row: Record<string, unknown>,
  evidenceRows: readonly EvidenceRow[],
): EvidenceEntity[] {
  const explicit = (entities || [])
    .filter((entity) => entity && entity.entity_type)
    .map((entity) => ({
      entity_id: entity.entity_id === null || entity.entity_id === undefined ? null : String(entity.entity_id),
      entity_name_or_alias: entity.entity_name_or_alias === null || entity.entity_name_or_alias === undefined ? null : String(entity.entity_name_or_alias),
      entity_type: entity.entity_type,
    }));
  if (explicit.length) {
    return uniqueEntities(explicit);
  }

  const fallback: EvidenceEntity[] = [{
    entity_id: stringOrNull(row.affected_entity_id),
    entity_name_or_alias: stringOrNull(row.affected_entity_name_or_alias),
    entity_type: stringOrNull(row.affected_entity_type) || 'affected_entity',
  }];
  for (const evidenceRow of evidenceRows.slice(0, 5)) {
    fallback.push({
      entity_id: evidenceRow.entity_id,
      entity_name_or_alias: evidenceRow.entity_name_or_alias,
      entity_type: evidenceRow.entity_type,
    });
  }
  return uniqueEntities(fallback);
}

function normalizeMissingFields(fields: readonly string[]): string[] {
  const normalized = uniqueStrings(fields);
  return normalized.length ? normalized : ['none_known'];
}

function uniqueEntities(entities: EvidenceEntity[]): EvidenceEntity[] {
  const seen = new Set<string>();
  const output: EvidenceEntity[] = [];
  for (const entity of entities) {
    const key = `${entity.entity_type}:${entity.entity_id || ''}:${entity.entity_name_or_alias || ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(entity);
  }
  return output;
}

function valuesForFields(row: Record<string, unknown>, fields: readonly string[]): Record<string, EvidenceSerializable> {
  const values: Record<string, EvidenceSerializable> = {};
  for (const field of fields) {
    values[field] = normalizeValue(valueAtPath(row, field));
  }
  return values;
}

function valueAtPath(value: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  const values = collectPathValues(value, parts).filter((item) => item !== undefined);
  if (values.length === 0) {
    return null;
  }
  return values.length === 1 ? values[0] : values;
}

function collectPathValues(value: unknown, parts: string[]): unknown[] {
  if (!parts.length) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPathValues(item, parts));
  }
  if (!isRecord(value)) {
    return [];
  }
  const [head, ...tail] = parts;
  return collectPathValues(value[head], tail);
}

function normalizeValue(value: unknown): EvidenceSerializable {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => normalizeScalar(item));
  }
  if (isObjectIdLike(value)) {
    return String(value);
  }
  if (isRecord(value)) {
    const output: Record<string, EvidenceScalar | EvidenceScalar[]> = {};
    for (const [key, nested] of Object.entries(value).slice(0, 20)) {
      output[key] = normalizeScalar(nested);
    }
    return output;
  }
  return normalizeScalar(value);
}

function normalizeScalar(value: unknown): EvidenceScalar {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (isObjectIdLike(value)) {
    return String(value);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeScalar(item)).filter((item) => item !== null).join(', ');
  }
  if (isRecord(value)) {
    const id = entityId(value);
    return id || JSON.stringify(Object.fromEntries(Object.entries(value).slice(0, 6).map(([key, nested]) => [key, normalizeScalar(nested)])));
  }
  return String(value);
}

function firstTimestamp(row: Record<string, unknown>, fields: readonly string[]): string | null {
  for (const field of uniqueStrings(fields)) {
    const value = valueAtPath(row, field);
    const timestamp = isoOrNull(value);
    if (timestamp) {
      return timestamp;
    }
  }
  return null;
}

function firstString(row: Record<string, unknown>, fields: readonly string[]): string | null {
  for (const field of uniqueStrings(fields)) {
    const value = valueAtPath(row, field);
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function entityId(row: Record<string, unknown>): string | null {
  for (const field of ['_id', 'id', 'productId', 'supplierId', 'agentId', 'employeeId', 'userId', 'poNumber']) {
    const value = row[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    if (isObjectIdLike(value)) {
      return String(value);
    }
  }
  return null;
}

function isoOrNull(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isObjectIdLike(value: unknown): boolean {
  return !!value && typeof value === 'object' && typeof (value as { toHexString?: unknown }).toHexString === 'function';
}

function confidenceCapReason(row: Record<string, unknown>, missingFields: readonly string[]): string | null {
  if (typeof row.confidence_reason === 'string' && row.confidence_reason.trim().length > 0) {
    return row.confidence_reason;
  }
  if (missingFields.length && !(missingFields.length === 1 && missingFields[0] === 'none_known')) {
    return `Confidence capped because missing or weak fields remain: ${missingFields.join(', ')}`;
  }
  if (row.confidence === 'low') {
    return 'Confidence capped by low source confidence.';
  }
  return null;
}

function buildBlockedSummary(notAllowedActions: unknown, blockedReason: string): string {
  const parts = typeof notAllowedActions === 'string'
    ? notAllowedActions.split(';').map((part) => part.trim()).filter(Boolean)
    : [];
  if (!parts.length) {
    return blockedReason;
  }
  return `${parts.length} blocked advisory follow-ups: ${parts.slice(0, 8).join('; ')}. Reason: ${blockedReason}`;
}

function buildSummary(
  findingKey: string,
  rowCount: number,
  sampleLimit: number,
  entities: readonly EvidenceEntity[],
  thresholdComparison: EvidenceThresholdComparison,
  missingFields: readonly string[],
): string {
  const topEntity = entities[0]
    ? [entities[0].entity_type, entities[0].entity_name_or_alias || entities[0].entity_id].filter(Boolean).join(':')
    : 'not_available';
  return [
    `${findingKey} has ${rowCount} source evidence row(s), sampled to ${sampleLimit}.`,
    `Top entity: ${topEntity}.`,
    `Metric ${thresholdComparison.metric_name || 'not_available'}=${formatForSummary(thresholdComparison.metric_value)} versus threshold ${formatForSummary(thresholdComparison.threshold_value)}.`,
    `Missing/weak fields: ${missingFields.join(', ')}.`,
  ].join(' ');
}

function formatForSummary(value: EvidenceSerializable): string {
  if (value === null) {
    return 'not_available';
  }
  if (Array.isArray(value)) {
    return value.join(',');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
