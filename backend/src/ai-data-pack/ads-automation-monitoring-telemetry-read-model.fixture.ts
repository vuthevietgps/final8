import type {
  AdsAutomationMonitoringTelemetryDecisionBinding,
  AdsAutomationMonitoringTelemetryReadModelInput,
  AdsAutomationMonitoringTelemetryRecordInput,
} from './contracts/ads-automation-monitoring-telemetry-read-model.contract';

export const ADS_AUTOMATION_MONITORING_TELEMETRY_DECISION_BINDING_FIXTURE:
  Required<AdsAutomationMonitoringTelemetryDecisionBinding> = {
    approvalId: 'ADSAPPROVAL-ads_policy_linkage_demo_budget',
    policyDecisionId: 'ADSPOLICY-ads_policy_linkage_demo_budget',
    validateOnlyValidationId: 'ADSPROVIDERVALIDATE-ads_policy_linkage_demo_budget',
    executionRecordId: 'ADSEXEC-DRYRUN-ads_policy_linkage_demo_budget-REQ-DEMO',
    idempotencyKey: 'ads-execution-preflight:demo:budget:REQ-DEMO',
    rollbackPlanId: 'ADSROLLBACK-ADSAPPROVAL-ads_policy_linkage_demo_budget-ADSEXEC-DRYRUN-ads_policy_linkage_demo_budget-REQ-DEMO',
    lossLimitPolicyReportDate: '2026-07-04',
    customerId: '1234567890',
    accountId: '1234567890',
    campaignId: '1001',
    adGroupId: '2001',
    campaignBudgetId: '3001',
  };

export const ADS_AUTOMATION_MONITORING_TELEMETRY_RECORDS_FIXTURE:
  AdsAutomationMonitoringTelemetryRecordInput[] = [
    record('ADSTELEMETRY-platform-account-20260704', 'platform_account', [
      'ERP local platform account telemetry exists for the Google Ads customer.',
    ]),
    record('ADSTELEMETRY-campaign-adgroup-identity-20260704', 'campaign_ad_group_identity', [
      'Campaign, ad group, and campaignBudgetId identifiers are present with no fallback.',
    ]),
    record('ADSTELEMETRY-import-freshness-20260704', 'import_freshness_window', [
      'Import watermark is inside the local freshness window.',
    ]),
    record('ADSTELEMETRY-spend-rate-20260704', 'spend_rate_snapshot', [
      'Spend-rate snapshot is local ERP evidence, not a provider call.',
    ]),
    record('ADSTELEMETRY-rate-limit-window-20260704', 'provider_rate_limit_window', [
      'Provider rate-limit window is an ERP-owned counter snapshot.',
    ]),
    record('ADSTELEMETRY-provider-error-window-20260704', 'provider_error_rate_window', [
      'Provider error-rate window is a local aggregate snapshot.',
    ]),
    record('ADSTELEMETRY-incident-green-20260704', 'incident', [
      'Resolved local incident record proves incident evidence shape.',
    ], {
      severity: 'info',
      incidentStatus: 'resolved',
      activeIncident: false,
      acknowledgementTargetId: 'ADSINC-monitoring-green-20260704',
    }),
    record('ADSTELEMETRY-escalation-resolved-20260704', 'escalation_status', [
      'Escalation status is resolved and does not allow execution.',
    ], {
      escalationStatus: 'resolved',
    }),
    record('ADSTELEMETRY-operator-ack-20260704', 'operator_acknowledgement', [
      'Operator acknowledgement record is available for reviewer readback.',
    ], {
      acknowledgementTargetId: 'ADSINC-monitoring-green-20260704',
    }),
  ];

export const ADS_AUTOMATION_MONITORING_TELEMETRY_READ_MODEL_FIXTURE:
  AdsAutomationMonitoringTelemetryReadModelInput = {
    reportDate: '2026-07-04',
    now: '2026-07-04T06:45:00.000Z',
    fixtureMode: 'htx_ads_monitoring_telemetry_demo',
    records: ADS_AUTOMATION_MONITORING_TELEMETRY_RECORDS_FIXTURE,
  };

function record(
  telemetryRecordId: string,
  recordType: AdsAutomationMonitoringTelemetryRecordInput['recordType'],
  evidence: string[],
  overrides: Partial<AdsAutomationMonitoringTelemetryRecordInput> = {},
): AdsAutomationMonitoringTelemetryRecordInput {
  return {
    telemetryRecordId,
    recordType,
    provider: 'google_ads',
    accountId: '1234567890',
    customerId: '1234567890',
    campaignId: '1001',
    adGroupId: '2001',
    campaignBudgetId: '3001',
    source: 'erp_local_read_model',
    observedAt: '2026-07-04T06:35:00.000Z',
    collectedAt: '2026-07-04T06:36:00.000Z',
    staleAfterMinutes: 120,
    trusted: true,
    decisionBinding: ADS_AUTOMATION_MONITORING_TELEMETRY_DECISION_BINDING_FIXTURE,
    evidence,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    execution_allowed_now: false,
    ...overrides,
  };
}
