import { AdsAutomationMonitoringTelemetryReadModelRepository } from './ads-automation-monitoring-telemetry-read-model.repository';
import { AdsAutomationMonitoringTelemetryReadModelService } from './ads-automation-monitoring-telemetry-read-model.service';
import {
  ADS_AUTOMATION_MONITORING_TELEMETRY_READ_MODEL_FIXTURE,
  ADS_AUTOMATION_MONITORING_TELEMETRY_RECORDS_FIXTURE,
} from './ads-automation-monitoring-telemetry-read-model.fixture';
import type {
  AdsAutomationMonitoringTelemetryReadModelInput,
} from './contracts/ads-automation-monitoring-telemetry-read-model.contract';

describe('AdsAutomationMonitoringTelemetryReadModelService', () => {
  let service: AdsAutomationMonitoringTelemetryReadModelService;

  beforeEach(() => {
    service = new AdsAutomationMonitoringTelemetryReadModelService();
  });

  it('builds a fresh complete trusted ERP-owned telemetry read model without provider or live calls', () => {
    const response = service.build(fixture());

    expect(response.schemaVersion).toBe('ads_automation_monitoring_telemetry_read_model.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
      in_memory_only: true,
      erp_owned_read_model_contract: true,
      persistence_used: false,
      durable_storage_used: false,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      validate_only_provider_call_used: false,
      live_ads_execution_used: false,
      operation_builder_called: false,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      production_ready: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      status: 'ready_for_policy_linkage_local_only',
      telemetry_record_count: 9,
      required_record_types_present: true,
      telemetry_fresh: true,
      telemetry_complete: true,
      telemetry_trusted: true,
      policy_decision_linkage_present: true,
      operator_acknowledgement_records: 1,
      active_incident_records: 0,
      missing_record_types: [],
      stale_record_ids: [],
      untrusted_record_ids: [],
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.decisionBinding).toEqual(expect.objectContaining({
      approvalId: 'ADSAPPROVAL-ads_policy_linkage_demo_budget',
      policyDecisionId: 'ADSPOLICY-ads_policy_linkage_demo_budget',
      validateOnlyValidationId: 'ADSPROVIDERVALIDATE-ads_policy_linkage_demo_budget',
      executionRecordId: 'ADSEXEC-DRYRUN-ads_policy_linkage_demo_budget-REQ-DEMO',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
    }));
    expect(response.blockers).toEqual([]);
  });

  it('blocks missing record types, stale records, untrusted records, and campaignBudgetId fallback attempts', () => {
    const input = fixture();
    input.records = input.records
      .filter((record) => record.recordType !== 'provider_error_rate_window')
      .map((record) => ({ ...record }));
    input.records[0].observedAt = '2026-07-04T02:00:00.000Z';
    input.records[1].trusted = false;
    input.records[1].campaignBudgetId = '1001';
    input.records[1].decisionBinding = {
      ...input.records[1].decisionBinding,
      campaignBudgetId: '1001',
    };

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      required_record_types_present: false,
      telemetry_fresh: false,
      telemetry_complete: false,
      telemetry_trusted: false,
      policy_decision_linkage_present: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.blockers).toEqual(expect.arrayContaining([
      'telemetry_record_type_missing.provider_error_rate_window',
      'telemetry.ADSTELEMETRY-platform-account-20260704.stale',
      'telemetry.ADSTELEMETRY-campaign-adgroup-identity-20260704.untrusted',
      'telemetry_linkage.campaignBudgetId_mismatch',
      'telemetry_linkage.campaignBudgetId_no_fallback_violation',
    ]));
  });

  it('requires operator acknowledgement records for active incident telemetry', () => {
    const input = fixture();
    input.records = input.records
      .filter((record) => record.recordType !== 'operator_acknowledgement')
      .map((record) => ({ ...record }));
    const incident = input.records.find((record) => record.recordType === 'incident')!;
    incident.severity = 'critical';
    incident.incidentStatus = 'investigating';
    incident.activeIncident = true;
    incident.acknowledgementTargetId = 'ADSINC-google-ads-rate-limit-20260704';

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      active_incident_records: 1,
      operator_acknowledgement_records: 0,
      execution_allowed_now: false,
    }));
    expect(response.blockers).toEqual(expect.arrayContaining([
      'operator_acknowledgement_missing.telemetry.ADSINC-google-ads-rate-limit-20260704',
    ]));
  });

  it('can build from the in-memory repository without provider or production storage use', () => {
    const repository = new AdsAutomationMonitoringTelemetryReadModelRepository();
    repository.replaceAll(ADS_AUTOMATION_MONITORING_TELEMETRY_RECORDS_FIXTURE);

    const response = service.buildFromRepository(repository, {
      reportDate: '2026-07-04',
      now: '2026-07-04T06:45:00.000Z',
      fixtureMode: 'htx_ads_monitoring_telemetry_demo',
    });

    expect(response.summary.status).toBe('ready_for_policy_linkage_local_only');
    expect(response.summary.telemetry_record_count).toBe(9);
    expect(response.safety).toEqual(expect.objectContaining({
      in_memory_only: true,
      persistence_used: false,
      durable_storage_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
  });

  it('rejects telemetry records that claim provider, validateOnly, live, or execution use', () => {
    const input = fixture();
    input.records[0].google_ads_api_called = true as false;

    expect(() => service.build(input)).toThrow(
      'telemetry records must preserve local-only safety flags',
    );
  });

  function fixture(): AdsAutomationMonitoringTelemetryReadModelInput {
    return JSON.parse(JSON.stringify(ADS_AUTOMATION_MONITORING_TELEMETRY_READ_MODEL_FIXTURE));
  }
});
