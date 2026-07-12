import {
  APPROVED_OPERATIONAL_RISK_FINDINGS,
  THRESHOLD_APPROVAL_STATUSES,
  THRESHOLD_FALLBACK_BEHAVIORS,
  ThresholdSourceRecord,
} from './threshold-source.contract';

const FORBIDDEN_REGISTRY_PAYLOAD_KEYS = new Set([
  'action_id',
  'action_payload',
  'action_draft',
  'action_draft_schema',
  'action_import',
  'approval_transition',
  'approval_workflow',
  'provider',
  'provider_operation',
  'provider_request',
  'provider_response',
  'validateonly',
  'validate_only',
  'dry_run',
  'execute_live',
  'live_execution',
  'mutate',
  'mutation',
  'ads_execution_plan',
  'purchase_order_action',
  'supplier_order_action',
  'inventory_action',
  'stock_action',
  'price_action',
  'cogs_action',
  'cashflow_action',
  'payroll_action',
  'timesheet_action',
  'staffing_action',
  'schedule_action',
]);

export function validateThresholdSourceRecords(records: readonly ThresholdSourceRecord[]): void {
  const errors: string[] = [];
  const seenKeys = new Set<string>();

  for (const [index, record] of records.entries()) {
    const label = record?.threshold_key || `record_${index}`;
    if (!APPROVED_OPERATIONAL_RISK_FINDINGS.includes(record?.finding_key as any)) {
      errors.push(`${label}: unknown finding_key`);
    }
    if (!record?.threshold_key || typeof record.threshold_key !== 'string') {
      errors.push(`${label}: missing threshold_key`);
    } else if (seenKeys.has(record.threshold_key)) {
      errors.push(`${label}: duplicate threshold_key`);
    } else {
      seenKeys.add(record.threshold_key);
    }
    if (!THRESHOLD_FALLBACK_BEHAVIORS.includes(record?.fallback_behavior as any)) {
      errors.push(`${label}: invalid fallback_behavior`);
    }
    if (!THRESHOLD_APPROVAL_STATUSES.includes(record?.approval_status as any)) {
      errors.push(`${label}: invalid approval_status`);
    }
    if (record?.approval_status === 'approved' && !record.effective_from) {
      errors.push(`${label}: approved records require effective_from`);
    }
    if (!record?.not_allowed_actions || !String(record.not_allowed_actions).includes('do_not_')) {
      errors.push(`${label}: not_allowed_actions must contain do_not_ safety text`);
    }
    for (const forbiddenPath of collectForbiddenRegistryPayloadKeys(record)) {
      errors.push(`${label}: forbidden registry payload key ${forbiddenPath}`);
    }
  }

  if (errors.length) {
    throw new Error(`Invalid threshold source registry: ${errors.join('; ')}`);
  }
}

export function collectForbiddenRegistryPayloadKeys(value: unknown, path: string[] = []): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenRegistryPayloadKeys(item, [...path, String(index)]));
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const normalizedKey = key.toLowerCase();
    const currentPath = [...path, key];
    const match = FORBIDDEN_REGISTRY_PAYLOAD_KEYS.has(normalizedKey)
      ? [currentPath.join('.')]
      : [];
    return [
      ...match,
      ...collectForbiddenRegistryPayloadKeys(nested, currentPath),
    ];
  });
}

