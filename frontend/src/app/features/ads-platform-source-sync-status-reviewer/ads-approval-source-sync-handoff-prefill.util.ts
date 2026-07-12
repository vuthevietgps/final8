export const ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY =
  'htx.ads.approval-source-sync-handoff-prefill.v1';

export interface AdsApprovalSourceSyncHandoffPrefillBundle {
  schemaVersion: 'ads_approval_to_source_sync_status_handoff_prefill.v1';
  source: 'ads_approval_evidence_reviewer';
  generatedAt: string;
  approvalCompareAuditSchemaVersion: 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1';
  approvalCompareAuditGeneratedAt: string;
  approvalLeftComparisonKey: string;
  approvalRightComparisonKey: string;
  approvalCompareAuditJson: string;
  omittedPayloads: [
    'leftSnapshot',
    'rightSnapshot',
    'plaintextSecretValues',
    'providerRawPayload',
    'liveExecutionPayload',
  ];
  local_only: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsApprovalSourceSyncHandoffPrefillBuildResult {
  bundle: AdsApprovalSourceSyncHandoffPrefillBundle | null;
  error: string | null;
}

export interface AdsApprovalSourceSyncHandoffPrefillParseResult {
  bundle: AdsApprovalSourceSyncHandoffPrefillBundle | null;
  error: string | null;
}

type FalseSafetyKey =
  | 'provider_api_called'
  | 'google_ads_api_called'
  | 'validateOnly_called'
  | 'live_ads_execution_used'
  | 'execution_allowed_now'
  | 'production_ready';

const falseSafetyKeys: FalseSafetyKey[] = [
  'provider_api_called',
  'google_ads_api_called',
  'validateOnly_called',
  'live_ads_execution_used',
  'execution_allowed_now',
  'production_ready',
];

const forbiddenPayloadKeys = [
  'leftSnapshot',
  'rightSnapshot',
  'plaintextSecretValues',
  'providerRawPayload',
  'liveExecutionPayload',
];

export function buildAdsApprovalSourceSyncHandoffPrefillBundle(
  audit: Record<string, unknown>,
  approvalCompareAuditJson: string,
  generatedAt = new Date().toISOString(),
): AdsApprovalSourceSyncHandoffPrefillBuildResult {
  const safetyError = validateAuditEnvelope(audit);
  if (safetyError) {
    return { bundle: null, error: safetyError };
  }

  if (typeof audit['generatedAt'] !== 'string') {
    return { bundle: null, error: 'Approval compare audit generatedAt is required' };
  }

  if (
    typeof audit['leftComparisonKey'] !== 'string'
    || typeof audit['rightComparisonKey'] !== 'string'
  ) {
    return { bundle: null, error: 'Approval compare audit comparison keys are required' };
  }

  if (!approvalCompareAuditJson.trim()) {
    return { bundle: null, error: 'Approval compare audit JSON is required' };
  }

  return {
    bundle: {
      schemaVersion: 'ads_approval_to_source_sync_status_handoff_prefill.v1',
      source: 'ads_approval_evidence_reviewer',
      generatedAt,
      approvalCompareAuditSchemaVersion:
        'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
      approvalCompareAuditGeneratedAt: audit['generatedAt'],
      approvalLeftComparisonKey: audit['leftComparisonKey'],
      approvalRightComparisonKey: audit['rightComparisonKey'],
      approvalCompareAuditJson,
      omittedPayloads: [
        'leftSnapshot',
        'rightSnapshot',
        'plaintextSecretValues',
        'providerRawPayload',
        'liveExecutionPayload',
      ],
      local_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    },
    error: null,
  };
}

export function parseAdsApprovalSourceSyncHandoffPrefillBundleJson(
  value: string,
): AdsApprovalSourceSyncHandoffPrefillParseResult {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { bundle: null, error: 'Browser handoff prefill JSON is required' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { bundle: null, error: 'Browser handoff prefill JSON is not valid JSON' };
  }

  if (!isRecord(parsed)) {
    return { bundle: null, error: 'Browser handoff prefill JSON must be an object' };
  }

  const forbiddenPayloadKey = findForbiddenPayloadKey(parsed);
  if (forbiddenPayloadKey) {
    return {
      bundle: null,
      error: `Browser handoff prefill contains forbidden payload field: ${forbiddenPayloadKey}`,
    };
  }

  if (parsed['schemaVersion'] !== 'ads_approval_to_source_sync_status_handoff_prefill.v1') {
    return {
      bundle: null,
      error:
        'Browser handoff prefill schemaVersion must be ads_approval_to_source_sync_status_handoff_prefill.v1',
    };
  }

  if (parsed['source'] !== 'ads_approval_evidence_reviewer') {
    return {
      bundle: null,
      error: 'Browser handoff prefill source must be ads_approval_evidence_reviewer',
    };
  }

  if (
    parsed['approvalCompareAuditSchemaVersion']
    !== 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1'
  ) {
    return {
      bundle: null,
      error:
        'Browser handoff prefill approvalCompareAuditSchemaVersion must be ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1',
    };
  }

  if (
    typeof parsed['generatedAt'] !== 'string'
    || typeof parsed['approvalCompareAuditGeneratedAt'] !== 'string'
    || typeof parsed['approvalLeftComparisonKey'] !== 'string'
    || typeof parsed['approvalRightComparisonKey'] !== 'string'
    || typeof parsed['approvalCompareAuditJson'] !== 'string'
  ) {
    return { bundle: null, error: 'Browser handoff prefill is missing audit fields' };
  }

  if (
    !isExactStringList(parsed['omittedPayloads'], [
      'leftSnapshot',
      'rightSnapshot',
      'plaintextSecretValues',
      'providerRawPayload',
      'liveExecutionPayload',
    ])
  ) {
    return {
      bundle: null,
      error:
        'Browser handoff prefill omittedPayloads must list snapshots, plaintextSecretValues, providerRawPayload, and liveExecutionPayload',
    };
  }

  if (parsed['local_only'] !== true) {
    return { bundle: null, error: 'Browser handoff prefill local_only must be true' };
  }

  const openSafetyField = falseSafetyKeys.find((key) => parsed[key] !== false);
  if (openSafetyField) {
    return {
      bundle: null,
      error: `Browser handoff prefill safety field ${openSafetyField} must be false`,
    };
  }

  return {
    bundle: parsed as unknown as AdsApprovalSourceSyncHandoffPrefillBundle,
    error: null,
  };
}

function validateAuditEnvelope(audit: Record<string, unknown>): string | null {
  const forbiddenPayloadKey = findForbiddenPayloadKey(audit);
  if (forbiddenPayloadKey) {
    return `Approval compare audit contains forbidden payload field: ${forbiddenPayloadKey}`;
  }

  if (
    audit['schemaVersion']
    !== 'ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1'
  ) {
    return 'Approval compare audit schemaVersion must be ads_approval_evidence_reviewer_docs_local_snapshot_compare_audit_export.v1';
  }

  if (audit['exportMode'] !== 'browser_local_compare_audit_handoff') {
    return 'Approval compare audit exportMode must be browser_local_compare_audit_handoff';
  }

  if (audit['local_only'] !== true) {
    return 'Approval compare audit local_only must be true';
  }

  const openSafetyField = falseSafetyKeys.find((key) => audit[key] !== false);
  if (openSafetyField) {
    return `Approval compare audit safety field ${openSafetyField} must be false`;
  }

  return null;
}

function findForbiddenPayloadKey(value: unknown): string | null {
  if (!isRecord(value)) return null;

  for (const key of Object.keys(value)) {
    if (forbiddenPayloadKeys.includes(key)) {
      return key;
    }

    const nested = value[key];
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const nestedKey = findForbiddenPayloadKey(item);
        if (nestedKey) return nestedKey;
      }
      continue;
    }

    if (isRecord(nested)) {
      const nestedKey = findForbiddenPayloadKey(nested);
      if (nestedKey) return nestedKey;
    }
  }

  return null;
}

function isExactStringList(value: unknown, expected: string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && expected.every((item, index) => value[index] === item);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
