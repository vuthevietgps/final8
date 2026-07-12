import type {
  AdsAutomationMonitoringIncidentStatus,
  AdsAutomationMonitoringPlatform,
  AdsAutomationMonitoringSeverity,
} from './ads-automation-monitoring-incident-readiness.contract';

export type AdsAutomationMonitoringTelemetryRecordType =
  | 'platform_account'
  | 'campaign_ad_group_identity'
  | 'import_freshness_window'
  | 'spend_rate_snapshot'
  | 'provider_rate_limit_window'
  | 'provider_error_rate_window'
  | 'incident'
  | 'escalation_status'
  | 'operator_acknowledgement';

export type AdsAutomationMonitoringTelemetrySource =
  | 'erp_local_read_model'
  | 'fixture'
  | 'mock_adapter';

export interface AdsAutomationMonitoringTelemetryDecisionBinding {
  approvalId?: string | null;
  policyDecisionId?: string | null;
  validateOnlyValidationId?: string | null;
  executionRecordId?: string | null;
  idempotencyKey?: string | null;
  rollbackPlanId?: string | null;
  lossLimitPolicyReportDate?: string | null;
  customerId?: string | null;
  accountId?: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  campaignBudgetId?: string | null;
}

export interface AdsAutomationMonitoringTelemetryRecordInput {
  telemetryRecordId: string;
  recordType: AdsAutomationMonitoringTelemetryRecordType;
  provider: AdsAutomationMonitoringPlatform;
  accountId?: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  campaignBudgetId?: string | null;
  source: AdsAutomationMonitoringTelemetrySource;
  observedAt: string;
  collectedAt: string;
  staleAfterMinutes: number;
  trusted: boolean;
  decisionBinding?: AdsAutomationMonitoringTelemetryDecisionBinding | null;
  severity?: AdsAutomationMonitoringSeverity | null;
  incidentStatus?: AdsAutomationMonitoringIncidentStatus | null;
  activeIncident?: boolean;
  acknowledgementTargetId?: string | null;
  escalationStatus?: 'none' | 'watching' | 'escalated' | 'resolved';
  evidence: string[];
  blockers?: string[];
  provider_api_called?: false;
  google_ads_api_called?: false;
  validateOnly_called?: false;
  live_ads_execution_used?: false;
  execution_allowed_now?: false;
}

export interface AdsAutomationMonitoringTelemetryReadModelInput {
  reportDate: string;
  now?: string | Date;
  fixtureMode?: 'htx_ads_monitoring_telemetry_demo' | 'custom_local_payload';
  records: AdsAutomationMonitoringTelemetryRecordInput[];
}

export interface AdsAutomationMonitoringTelemetrySafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  in_memory_only: true;
  erp_owned_read_model_contract: true;
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
}

export interface AdsAutomationMonitoringTelemetryRecordReadiness {
  telemetryRecordId: string;
  recordType: AdsAutomationMonitoringTelemetryRecordType;
  provider: AdsAutomationMonitoringPlatform;
  accountId: string | null;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  source: AdsAutomationMonitoringTelemetrySource;
  observedAt: string;
  collectedAt: string;
  staleAfterMinutes: number;
  ageMinutes: number;
  fresh: boolean;
  trusted: boolean;
  decisionBinding: Required<AdsAutomationMonitoringTelemetryDecisionBinding>;
  severity: AdsAutomationMonitoringSeverity | null;
  incidentStatus: AdsAutomationMonitoringIncidentStatus | null;
  activeIncident: boolean;
  acknowledgementTargetId: string | null;
  escalationStatus: 'none' | 'watching' | 'escalated' | 'resolved' | null;
  evidence: string[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  blockers: string[];
}

export interface AdsAutomationMonitoringTelemetryReadModelSummary {
  status: 'ready_for_policy_linkage_local_only' | 'blocked';
  reportDate: string;
  fixture_mode: 'htx_ads_monitoring_telemetry_demo' | 'custom_local_payload';
  telemetry_record_count: number;
  required_record_types_present: boolean;
  telemetry_fresh: boolean;
  telemetry_complete: boolean;
  telemetry_trusted: boolean;
  policy_decision_linkage_present: boolean;
  operator_acknowledgement_records: number;
  active_incident_records: number;
  missing_record_types: AdsAutomationMonitoringTelemetryRecordType[];
  stale_record_ids: string[];
  untrusted_record_ids: string[];
  linkage_blockers: string[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  future_live_execution_allowed: false;
  production_ready: false;
  next_required_action:
    | 'review_local_telemetry_read_model'
    | 'resolve_telemetry_read_model_blockers';
}

export interface AdsAutomationMonitoringTelemetryReadModelResponse {
  schemaVersion: 'ads_automation_monitoring_telemetry_read_model.v1';
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationMonitoringTelemetrySafety;
  summary: AdsAutomationMonitoringTelemetryReadModelSummary;
  records: AdsAutomationMonitoringTelemetryRecordReadiness[];
  decisionBinding: Required<AdsAutomationMonitoringTelemetryDecisionBinding>;
  blockers: string[];
  markdownPreview: string;
}
