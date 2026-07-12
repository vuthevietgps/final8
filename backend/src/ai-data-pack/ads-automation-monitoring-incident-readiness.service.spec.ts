import { AdsAutomationMonitoringIncidentReadinessService } from './ads-automation-monitoring-incident-readiness.service';
import { ADS_AUTOMATION_MONITORING_INCIDENT_READINESS_FIXTURE } from './ads-automation-monitoring-incident-readiness.fixture';
import type {
  AdsAutomationMonitoringIncidentReadinessInput,
} from './contracts/ads-automation-monitoring-incident-readiness.contract';

describe('AdsAutomationMonitoringIncidentReadinessService', () => {
  let service: AdsAutomationMonitoringIncidentReadinessService;

  beforeEach(() => {
    service = new AdsAutomationMonitoringIncidentReadinessService();
  });

  it('returns healthy local monitoring, rate-limit, spend, error-rate, and incident evidence without provider or live calls', () => {
    const response = service.build(fixture());

    expect(response.schemaVersion).toBe('ads_automation_monitoring_incident_readiness.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
      fixture_or_payload_only: true,
      persistence_used: false,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      validate_only_provider_call_used: false,
      live_ads_execution_used: false,
      direct_google_ads_api_call: false,
      provider_mutation_used: false,
      operation_builder_called: false,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      production_ready: false,
      monitoring_health_required_before_increase: true,
      rate_limit_budget_required_before_increase: true,
      active_incident_blocks_increase: true,
      operator_acknowledgement_required_for_blocking_alerts: true,
      durable_telemetry_read_model_required_before_increase: true,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      status: 'ready_for_future_executor_local_only',
      durable_telemetry_read_model_used: true,
      durable_telemetry_fresh: true,
      durable_telemetry_complete: true,
      durable_telemetry_trusted: true,
      durable_telemetry_tied_to_policy_decision: true,
      telemetry_record_count: 9,
      telemetry_blocker_count: 0,
      monitoring_healthy: true,
      rate_limit_budget_safe: true,
      spend_rate_safe: true,
      provider_error_rate_safe: true,
      import_freshness_safe: true,
      validateOnly_preflight_alerts_clear: true,
      active_incident_blocking_count: 0,
      open_stale_import_alerts: 0,
      failed_validateOnly_alerts: 0,
      failed_preflight_alerts: 0,
      scale_up_execution_mode: 'pending_validation',
      safe_actions_available: ['monitor_only'],
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      future_live_execution_allowed: false,
      production_ready: false,
    }));
    expect(response.blockers).toEqual([]);
    expect(response.providerRateLimits[0]).toEqual(expect.objectContaining({
      provider: 'google_ads',
      status: 'safe',
      remainingRequests: 680,
      blockers: [],
    }));
    expect(response.telemetryEvidence).toEqual(expect.objectContaining({
      schemaVersion: 'ads_automation_monitoring_telemetry_read_model.v1',
      durable_telemetry_read_model_used: true,
      telemetry_fresh: true,
      telemetry_complete: true,
      telemetry_trusted: true,
      policy_decision_linkage_present: true,
      telemetry_record_count: 9,
      blockers: [],
    }));
    expect(response.spendRateMonitors[1]).toEqual(expect.objectContaining({
      scope: 'ad_group',
      campaignBudgetId: '3001',
      status: 'safe',
      blockers: [],
    }));
    expect(response.markdownPreview).toContain('Monitoring healthy: yes');
  });

  it('blocks scale-up when durable ERP telemetry read-model evidence is missing', () => {
    const input = fixture();
    input.telemetryReadModel = null;

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      durable_telemetry_read_model_used: false,
      durable_telemetry_fresh: false,
      durable_telemetry_complete: false,
      durable_telemetry_trusted: false,
      durable_telemetry_tied_to_policy_decision: false,
      telemetry_record_count: 0,
      telemetry_blocker_count: 1,
      monitoring_healthy: false,
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.summary.safe_actions_available).toEqual(expect.arrayContaining([
      'pause_campaign',
      'pause_ad_group',
      'reduce_campaign_budget',
      'monitor_only',
    ]));
    expect(response.telemetryEvidence.blockers).toEqual(['telemetry_read_model_missing']);
    expect(response.blockers).toEqual(expect.arrayContaining([
      'durable_telemetry.telemetry_read_model_missing',
    ]));
  });

  it('blocks scale-up and preserves monitor/pause/reduce safety actions under rate-limit pressure and spend burn alerts', () => {
    const input = fixture();
    input.providerRateLimits[0].requestsUsed = 930;
    input.providerRateLimits[0].minRemainingRequests = 100;
    input.providerRateLimits[0].throttlingActive = true;
    input.providerRateLimits[0].cooldownEndsAt = '2026-07-04T07:10:00.000Z';
    input.spendRateMonitors[1].spendLastHourVnd = 300000;
    input.spendRateMonitors[1].spendTodayVnd = 1150000;

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      monitoring_healthy: false,
      rate_limit_budget_safe: false,
      spend_rate_safe: false,
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.summary.safe_actions_available).toEqual(expect.arrayContaining([
      'pause_campaign',
      'pause_ad_group',
      'reduce_campaign_budget',
      'monitor_only',
    ]));
    expect(response.blockers).toEqual(expect.arrayContaining([
      'google_ads.rate_limit_remaining_below_threshold',
      'google_ads.rate_limit_throttling_active',
      'google_ads.rate_limit_cooldown_active',
      'ad_group.HTX-GADS-PRIMARY.1001.2001.hourly_spend_cap_exceeded',
      'ad_group.HTX-GADS-PRIMARY.1001.2001.daily_budget_burn_alert',
    ]));
  });

  it('surfaces stale import, failed validateOnly, failed preflight, and provider error-rate blockers without live/provider calls', () => {
    const input = fixture();
    input.providerErrorRateMonitors[0].errorCount = 25;
    input.providerErrorRateMonitors[0].timeoutCount = 12;
    input.providerErrorRateMonitors[0].rateLimitErrorCount = 2;
    input.staleImportAlerts = [{
      alertId: 'ADSALERT-import-google-ads-stale',
      sourceKey: 'google_ads',
      accountId: 'HTX-GADS-PRIMARY',
      severity: 'major',
      status: 'acknowledged',
      freshnessStatus: 'stale',
      lastSuccessfulSyncAt: '2026-07-04T02:00:00.000Z',
      maxAgeMinutes: 120,
      ageMinutes: 285,
      blocking: true,
    }];
    input.validateOnlyPreflightAlerts = [
      {
        alertId: 'ADSALERT-validateOnly-failed',
        kind: 'validateOnly',
        approvalId: 'ADSAPPROVAL-1',
        validationId: 'ADSPROVIDERVALIDATE-1',
        severity: 'major',
        status: 'acknowledged',
        failedAt: '2026-07-04T06:20:00.000Z',
        blockers: ['provider_validation_error'],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      },
      {
        alertId: 'ADSALERT-preflight-failed',
        kind: 'preflight',
        approvalId: 'ADSAPPROVAL-1',
        executionRecordId: 'ADSEXEC-1',
        severity: 'major',
        status: 'acknowledged',
        failedAt: '2026-07-04T06:25:00.000Z',
        blockers: ['policy_allowed'],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      },
    ];
    input.operatorAcknowledgements = [
      acknowledgement('alert', 'ADSALERT-import-google-ads-stale'),
      acknowledgement('alert', 'ADSALERT-validateOnly-failed'),
      acknowledgement('alert', 'ADSALERT-preflight-failed'),
    ];

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      monitoring_healthy: false,
      provider_error_rate_safe: false,
      import_freshness_safe: false,
      validateOnly_preflight_alerts_clear: false,
      open_stale_import_alerts: 1,
      failed_validateOnly_alerts: 1,
      failed_preflight_alerts: 1,
      unacknowledged_blocking_alerts: 0,
      operator_acknowledgement_records: 3,
      scale_up_execution_mode: 'monitor_only',
    }));
    expect(response.blockers).toEqual(expect.arrayContaining([
      'google_ads.provider_error_rate_high',
      'google_ads.provider_timeout_rate_high',
      'google_ads.provider_rate_limit_errors_present',
      'stale_import.google_ads.stale',
      'validateOnly_alert.ADSALERT-validateOnly-failed',
      'validateOnly.provider_validation_error',
      'preflight_alert.ADSALERT-preflight-failed',
      'preflight.policy_allowed',
    ]));
    expect(response.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        alertId: 'ADSALERT-validateOnly-failed',
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    ]));
  });

  it('requires operator acknowledgement evidence for blocking incidents while active incidents still block increase-budget execution', () => {
    const input = fixture();
    input.incidents = [{
      incidentId: 'ADSINC-google-ads-rate-limit-20260704',
      severity: 'critical',
      status: 'investigating',
      startedAt: '2026-07-04T06:30:00.000Z',
      affectedScope: 'google_ads:HTX-GADS-PRIMARY',
      summary: 'Rate-limit pressure is under operator review.',
      blockingScaleUp: true,
      linkedAlertIds: ['ADSALERT-rate-limit-pressure'],
    }];

    const unacknowledged = service.build(input);

    expect(unacknowledged.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      active_incident_blocking_count: 1,
      unacknowledged_blocking_alerts: 1,
      operator_acknowledgement_records: 0,
      scale_up_execution_mode: 'monitor_only',
    }));
    expect(unacknowledged.blockers).toEqual(expect.arrayContaining([
      'active_incident.ADSINC-google-ads-rate-limit-20260704',
      'operator_acknowledgement_missing.incident.ADSINC-google-ads-rate-limit-20260704',
    ]));

    input.operatorAcknowledgements = [
      acknowledgement('incident', 'ADSINC-google-ads-rate-limit-20260704'),
    ];
    const acknowledged = service.build(input);

    expect(acknowledged.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      active_incident_blocking_count: 1,
      unacknowledged_blocking_alerts: 0,
      operator_acknowledgement_records: 1,
      scale_up_execution_mode: 'monitor_only',
    }));
    expect(acknowledged.blockers).toEqual(expect.arrayContaining([
      'active_incident.ADSINC-google-ads-rate-limit-20260704',
    ]));
    expect(acknowledged.blockers).not.toContain(
      'operator_acknowledgement_missing.incident.ADSINC-google-ads-rate-limit-20260704',
    );
  });

  it('rejects validateOnly/preflight alert payloads that claim provider or live execution was used', () => {
    const input = fixture();
    input.validateOnlyPreflightAlerts = [{
      alertId: 'ADSALERT-unsafe-validateOnly',
      kind: 'validateOnly',
      severity: 'major',
      status: 'open',
      failedAt: '2026-07-04T06:30:00.000Z',
      blockers: ['provider_validation_error'],
      provider_api_called: true as false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }];

    expect(() => service.build(input)).toThrow(
      'validateOnlyPreflightAlerts must preserve local-only safety flags',
    );
  });

  function fixture(): AdsAutomationMonitoringIncidentReadinessInput {
    return JSON.parse(JSON.stringify(ADS_AUTOMATION_MONITORING_INCIDENT_READINESS_FIXTURE));
  }

  function acknowledgement(targetType: 'incident' | 'alert', targetId: string) {
    return {
      acknowledgementId: `ADSACK-${targetId}`,
      targetType,
      targetId,
      acknowledgedAt: '2026-07-04T06:35:00.000Z',
      operatorUserId: 'ops-manager-1',
      operatorRole: 'manager',
      reason: 'Operator acknowledged local monitoring evidence before future review.',
    };
  }
});
