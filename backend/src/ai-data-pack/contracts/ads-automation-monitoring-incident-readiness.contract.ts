import type {
  AdsAutomationMonitoringTelemetryDecisionBinding,
  AdsAutomationMonitoringTelemetryReadModelResponse,
} from './ads-automation-monitoring-telemetry-read-model.contract';

export type AdsAutomationMonitoringPlatform =
  | 'google_ads'
  | 'facebook_ads'
  | 'tiktok_ads';

export type AdsAutomationMonitoringSeverity =
  | 'info'
  | 'warning'
  | 'minor'
  | 'major'
  | 'critical';

export type AdsAutomationMonitoringReadinessStatus =
  | 'ready_for_future_executor_local_only'
  | 'blocked';

export type AdsAutomationMonitoringItemStatus =
  | 'safe'
  | 'pressure'
  | 'blocked';

export type AdsAutomationMonitoringAlertStatus =
  | 'open'
  | 'acknowledged'
  | 'resolved';

export type AdsAutomationMonitoringIncidentStatus =
  | 'open'
  | 'investigating'
  | 'mitigating'
  | 'resolved';

export type AdsAutomationMonitoringSafetyAction =
  | 'pause_campaign'
  | 'pause_ad_group'
  | 'reduce_campaign_budget'
  | 'monitor_only';

export interface AdsAutomationProviderRateLimitBudgetInput {
  provider: AdsAutomationMonitoringPlatform;
  accountId?: string | null;
  customerId?: string | null;
  windowStartedAt: string;
  windowEndsAt: string;
  requestsUsed: number;
  requestsLimit: number;
  minRemainingRequests: number;
  throttlingActive?: boolean;
  cooldownEndsAt?: string | null;
  source?: 'fixture' | 'erp_local_counter' | 'mock_adapter';
}

export interface AdsAutomationSpendRateMonitorInput {
  scope: 'account' | 'campaign' | 'ad_group';
  accountId?: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  campaignBudgetId?: string | null;
  spendLastHourVnd: number;
  spendTodayVnd: number;
  spendMonthVnd: number;
  hourlySpendCapVnd: number;
  dailyBudgetVnd: number;
  monthlyBudgetVnd: number;
  dailyBurnAlertPercent: number;
  monthlyBurnAlertPercent: number;
}

export interface AdsAutomationProviderErrorRateMonitorInput {
  provider: AdsAutomationMonitoringPlatform;
  accountId?: string | null;
  customerId?: string | null;
  windowMinutes: number;
  requestCount: number;
  errorCount: number;
  timeoutCount: number;
  rateLimitErrorCount: number;
  maxErrorRatePercent: number;
  maxTimeoutRatePercent: number;
}

export interface AdsAutomationStaleImportAlertInput {
  alertId: string;
  sourceKey: string;
  accountId?: string | null;
  severity: AdsAutomationMonitoringSeverity;
  status: AdsAutomationMonitoringAlertStatus;
  freshnessStatus: 'fresh' | 'stale' | 'missing';
  lastSuccessfulSyncAt?: string | null;
  maxAgeMinutes: number;
  ageMinutes?: number | null;
  blocking?: boolean;
}

export interface AdsAutomationValidateOnlyPreflightAlertInput {
  alertId: string;
  kind: 'validateOnly' | 'preflight';
  approvalId?: string | null;
  validationId?: string | null;
  executionRecordId?: string | null;
  severity: AdsAutomationMonitoringSeverity;
  status: AdsAutomationMonitoringAlertStatus;
  failedAt: string;
  blockers?: string[];
  provider_api_called?: false;
  google_ads_api_called?: false;
  validateOnly_called?: false;
  live_ads_execution_used?: false;
  execution_allowed_now?: false;
}

export interface AdsAutomationIncidentEvidenceInput {
  incidentId: string;
  severity: AdsAutomationMonitoringSeverity;
  status: AdsAutomationMonitoringIncidentStatus;
  startedAt: string;
  resolvedAt?: string | null;
  affectedScope: string;
  summary: string;
  blockingScaleUp?: boolean;
  linkedAlertIds?: string[];
}

export interface AdsAutomationOperatorAcknowledgementInput {
  acknowledgementId: string;
  targetType: 'incident' | 'alert';
  targetId: string;
  acknowledgedAt: string;
  operatorUserId: string;
  operatorRole: string;
  reason: string;
}

export interface AdsAutomationMonitoringIncidentReadinessInput {
  reportDate: string;
  now?: string | Date;
  fixtureMode?: 'htx_ads_monitoring_incident_demo' | 'custom_local_payload';
  telemetryReadModel?: AdsAutomationMonitoringTelemetryReadModelResponse | null;
  providerRateLimits: AdsAutomationProviderRateLimitBudgetInput[];
  spendRateMonitors: AdsAutomationSpendRateMonitorInput[];
  providerErrorRateMonitors: AdsAutomationProviderErrorRateMonitorInput[];
  staleImportAlerts: AdsAutomationStaleImportAlertInput[];
  validateOnlyPreflightAlerts: AdsAutomationValidateOnlyPreflightAlertInput[];
  incidents: AdsAutomationIncidentEvidenceInput[];
  operatorAcknowledgements: AdsAutomationOperatorAcknowledgementInput[];
}

export interface AdsAutomationMonitoringIncidentReadinessSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
  persistence_used: false;
  durable_storage_used: false;
  erp_local_persistence_used: false;
  provider_persistence_used: false;
  provider_api_called: false;
  provider_api_used: false;
  google_ads_api_called: false;
  google_ads_api_used: false;
  validateOnly_called: false;
  validate_only_provider_call_used: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  direct_google_ads_api_call: false;
  provider_mutation_used: false;
  raw_provider_request_included: false;
  operation_builder_called: false;
  live_path_implemented: false;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  production_ready: false;
  approval_required_for_all_actions: true;
  monitoring_health_required_before_increase: true;
  rate_limit_budget_required_before_increase: true;
  active_incident_blocks_increase: true;
  operator_acknowledgement_required_for_blocking_alerts: true;
  durable_telemetry_read_model_required_before_increase: true;
}

export interface AdsAutomationProviderRateLimitBudgetReadiness {
  provider: AdsAutomationMonitoringPlatform;
  accountId: string | null;
  customerId: string | null;
  status: AdsAutomationMonitoringItemStatus;
  windowStartedAt: string;
  windowEndsAt: string;
  requestsUsed: number;
  requestsLimit: number;
  minRemainingRequests: number;
  remainingRequests: number;
  remainingPercent: number;
  throttlingActive: boolean;
  cooldownEndsAt: string | null;
  source: 'fixture' | 'erp_local_counter' | 'mock_adapter';
  blockers: string[];
  warnings: string[];
}

export interface AdsAutomationSpendRateMonitorReadiness {
  scope: 'account' | 'campaign' | 'ad_group';
  accountId: string | null;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  status: AdsAutomationMonitoringItemStatus;
  spendLastHourVnd: number;
  spendTodayVnd: number;
  spendMonthVnd: number;
  hourlySpendCapVnd: number;
  dailyBudgetVnd: number;
  monthlyBudgetVnd: number;
  dailyBurnPercent: number;
  monthlyBurnPercent: number;
  blockers: string[];
  warnings: string[];
}

export interface AdsAutomationProviderErrorRateMonitorReadiness {
  provider: AdsAutomationMonitoringPlatform;
  accountId: string | null;
  customerId: string | null;
  status: AdsAutomationMonitoringItemStatus;
  windowMinutes: number;
  requestCount: number;
  errorCount: number;
  timeoutCount: number;
  rateLimitErrorCount: number;
  errorRatePercent: number;
  timeoutRatePercent: number;
  maxErrorRatePercent: number;
  maxTimeoutRatePercent: number;
  blockers: string[];
  warnings: string[];
}

export interface AdsAutomationMonitoringAlertReadiness {
  alertId: string;
  kind: 'stale_import' | 'validateOnly' | 'preflight';
  severity: AdsAutomationMonitoringSeverity;
  status: AdsAutomationMonitoringAlertStatus;
  sourceKey?: string | null;
  approvalId?: string | null;
  validationId?: string | null;
  executionRecordId?: string | null;
  blocking: boolean;
  acknowledged: boolean;
  blockers: string[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
}

export interface AdsAutomationIncidentReadiness {
  incidentId: string;
  severity: AdsAutomationMonitoringSeverity;
  status: AdsAutomationMonitoringIncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  affectedScope: string;
  summary: string;
  active: boolean;
  blockingScaleUp: boolean;
  acknowledged: boolean;
  linkedAlertIds: string[];
  blockers: string[];
}

export interface AdsAutomationOperatorAcknowledgementEvidence {
  acknowledgementId: string;
  targetType: 'incident' | 'alert';
  targetId: string;
  acknowledgedAt: string;
  operatorUserId: string;
  operatorRole: string;
  reason: string;
  valid: boolean;
  blockers: string[];
}

export interface AdsAutomationMonitoringIncidentReadinessSummary {
  status: AdsAutomationMonitoringReadinessStatus;
  reportDate: string;
  fixture_mode: 'htx_ads_monitoring_incident_demo' | 'custom_local_payload';
  durable_telemetry_read_model_used: boolean;
  durable_telemetry_fresh: boolean;
  durable_telemetry_complete: boolean;
  durable_telemetry_trusted: boolean;
  durable_telemetry_tied_to_policy_decision: boolean;
  telemetry_record_count: number;
  telemetry_blocker_count: number;
  monitoring_healthy: boolean;
  rate_limit_budget_safe: boolean;
  spend_rate_safe: boolean;
  provider_error_rate_safe: boolean;
  import_freshness_safe: boolean;
  validateOnly_preflight_alerts_clear: boolean;
  active_incident_blocking_count: number;
  open_stale_import_alerts: number;
  failed_validateOnly_alerts: number;
  failed_preflight_alerts: number;
  unacknowledged_blocking_alerts: number;
  operator_acknowledgement_records: number;
  scale_up_execution_mode: 'monitor_only' | 'pending_validation';
  safe_actions_available: AdsAutomationMonitoringSafetyAction[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  future_live_execution_allowed: false;
  production_ready: false;
  next_required_action:
    | 'resolve_monitoring_rate_limit_or_incident_blockers'
    | 'review_local_monitoring_incident_evidence';
}

export interface AdsAutomationMonitoringTelemetryEvidenceSnapshot {
  schemaVersion: AdsAutomationMonitoringTelemetryReadModelResponse['schemaVersion'] | null;
  durable_telemetry_read_model_used: boolean;
  telemetry_fresh: boolean;
  telemetry_complete: boolean;
  telemetry_trusted: boolean;
  policy_decision_linkage_present: boolean;
  telemetry_record_count: number;
  telemetry_evidence_record_ids: string[];
  decisionBinding: Required<AdsAutomationMonitoringTelemetryDecisionBinding>;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  blockers: string[];
}

export interface AdsAutomationMonitoringIncidentReadinessResponse {
  schemaVersion: 'ads_automation_monitoring_incident_readiness.v1';
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationMonitoringIncidentReadinessSafety;
  summary: AdsAutomationMonitoringIncidentReadinessSummary;
  telemetryEvidence: AdsAutomationMonitoringTelemetryEvidenceSnapshot;
  providerRateLimits: AdsAutomationProviderRateLimitBudgetReadiness[];
  spendRateMonitors: AdsAutomationSpendRateMonitorReadiness[];
  providerErrorRateMonitors: AdsAutomationProviderErrorRateMonitorReadiness[];
  alerts: AdsAutomationMonitoringAlertReadiness[];
  incidents: AdsAutomationIncidentReadiness[];
  operatorAcknowledgements: AdsAutomationOperatorAcknowledgementEvidence[];
  blockers: string[];
  warnings: string[];
  markdownPreview: string;
}
