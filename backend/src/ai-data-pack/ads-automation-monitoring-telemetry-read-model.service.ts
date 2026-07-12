import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdsAutomationMonitoringTelemetryDecisionBinding,
  AdsAutomationMonitoringTelemetryReadModelInput,
  AdsAutomationMonitoringTelemetryReadModelResponse,
  AdsAutomationMonitoringTelemetryRecordInput,
  AdsAutomationMonitoringTelemetryRecordReadiness,
  AdsAutomationMonitoringTelemetryRecordType,
  AdsAutomationMonitoringTelemetrySource,
} from './contracts/ads-automation-monitoring-telemetry-read-model.contract';
import type {
  AdsAutomationMonitoringIncidentStatus,
  AdsAutomationMonitoringPlatform,
  AdsAutomationMonitoringSeverity,
} from './contracts/ads-automation-monitoring-incident-readiness.contract';
import { AdsAutomationMonitoringTelemetryReadModelRepository } from './ads-automation-monitoring-telemetry-read-model.repository';

const REQUIRED_RECORD_TYPES: AdsAutomationMonitoringTelemetryRecordType[] = [
  'platform_account',
  'campaign_ad_group_identity',
  'import_freshness_window',
  'spend_rate_snapshot',
  'provider_rate_limit_window',
  'provider_error_rate_window',
  'incident',
  'escalation_status',
];

const REQUIRED_LINKAGE_FIELDS: Array<keyof Required<AdsAutomationMonitoringTelemetryDecisionBinding>> = [
  'approvalId',
  'policyDecisionId',
  'validateOnlyValidationId',
  'executionRecordId',
  'idempotencyKey',
  'rollbackPlanId',
  'lossLimitPolicyReportDate',
  'customerId',
  'campaignId',
  'adGroupId',
  'campaignBudgetId',
];

@Injectable()
export class AdsAutomationMonitoringTelemetryReadModelService {
  build(
    input: AdsAutomationMonitoringTelemetryReadModelInput,
  ): AdsAutomationMonitoringTelemetryReadModelResponse {
    const reportDate = this.isoDate(input.reportDate, 'reportDate');
    const generatedAt = (input.now ? this.dateTime(input.now, 'now') : new Date()).toISOString();
    const records = this.records(input.records || [], generatedAt);
    const decisionBinding = this.decisionBinding(records);
    const missingRecordTypes = REQUIRED_RECORD_TYPES.filter((recordType) => (
      !records.some((record) => record.recordType === recordType)
    ));
    const staleRecordIds = records
      .filter((record) => !record.fresh)
      .map((record) => record.telemetryRecordId);
    const untrustedRecordIds = records
      .filter((record) => !record.trusted)
      .map((record) => record.telemetryRecordId);
    const activeIncidentRecords = records.filter((record) => (
      record.recordType === 'incident'
      && record.activeIncident
      && record.incidentStatus !== 'resolved'
    ));
    const acknowledgementTargetIds = new Set(
      records
        .filter((record) => record.recordType === 'operator_acknowledgement')
        .map((record) => record.acknowledgementTargetId || record.decisionBinding.executionRecordId)
        .filter((value): value is string => Boolean(value)),
    );
    const missingAcknowledgementBlockers = activeIncidentRecords
      .filter((record) => !acknowledgementTargetIds.has(record.acknowledgementTargetId || record.telemetryRecordId))
      .map((record) => `operator_acknowledgement_missing.telemetry.${record.acknowledgementTargetId || record.telemetryRecordId}`);
    const linkageBlockers = this.linkageBlockers(decisionBinding, records);
    const blockers = this.unique([
      ...records.flatMap((record) => record.blockers),
      ...missingRecordTypes.map((recordType) => `telemetry_record_type_missing.${recordType}`),
      ...missingAcknowledgementBlockers,
      ...linkageBlockers,
    ]);
    const requiredRecordTypesPresent = missingRecordTypes.length === 0;
    const telemetryFresh = staleRecordIds.length === 0 && records.length > 0;
    const telemetryTrusted = untrustedRecordIds.length === 0 && records.length > 0;
    const policyDecisionLinkagePresent = linkageBlockers.length === 0;
    const telemetryComplete = requiredRecordTypesPresent
      && policyDecisionLinkagePresent
      && records.length >= REQUIRED_RECORD_TYPES.length;
    const ready = blockers.length === 0;

    return {
      schemaVersion: 'ads_automation_monitoring_telemetry_read_model.v1',
      generatedAt,
      reportDate,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        in_memory_only: true,
        erp_owned_read_model_contract: true,
        fixture_or_payload_only: true,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        provider_persistence_used: false,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        direct_google_ads_api_call: false,
        provider_mutation_used: false,
        raw_provider_request_included: false,
        operation_builder_called: false,
        live_path_implemented: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      },
      summary: {
        status: ready ? 'ready_for_policy_linkage_local_only' : 'blocked',
        reportDate,
        fixture_mode: input.fixtureMode || 'custom_local_payload',
        telemetry_record_count: records.length,
        required_record_types_present: requiredRecordTypesPresent,
        telemetry_fresh: telemetryFresh,
        telemetry_complete: telemetryComplete,
        telemetry_trusted: telemetryTrusted,
        policy_decision_linkage_present: policyDecisionLinkagePresent,
        operator_acknowledgement_records: records
          .filter((record) => record.recordType === 'operator_acknowledgement').length,
        active_incident_records: activeIncidentRecords.length,
        missing_record_types: missingRecordTypes,
        stale_record_ids: staleRecordIds,
        untrusted_record_ids: untrustedRecordIds,
        linkage_blockers: linkageBlockers,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        future_live_execution_allowed: false,
        production_ready: false,
        next_required_action: ready
          ? 'review_local_telemetry_read_model'
          : 'resolve_telemetry_read_model_blockers',
      },
      records,
      decisionBinding,
      blockers,
      markdownPreview: this.markdownPreview({
        reportDate,
        ready,
        records: records.length,
        missingRecordTypes,
        staleRecordIds,
        untrustedRecordIds,
        blockers,
      }),
    };
  }

  buildFromRepository(
    repository: AdsAutomationMonitoringTelemetryReadModelRepository,
    input: Omit<AdsAutomationMonitoringTelemetryReadModelInput, 'records'>,
  ): AdsAutomationMonitoringTelemetryReadModelResponse {
    return this.build({
      ...input,
      records: repository.list(),
    });
  }

  private records(
    values: AdsAutomationMonitoringTelemetryRecordInput[],
    generatedAt: string,
  ): AdsAutomationMonitoringTelemetryRecordReadiness[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException('records must be an array');
    }
    return values.map((value) => {
      const telemetryRecordId = this.requiredText(value.telemetryRecordId, 'records.telemetryRecordId');
      const recordType = this.recordType(value.recordType, 'records.recordType');
      const provider = this.provider(value.provider, 'records.provider');
      const source = this.source(value.source, 'records.source');
      const observedAt = this.dateTime(value.observedAt, 'records.observedAt').toISOString();
      const collectedAt = this.dateTime(value.collectedAt, 'records.collectedAt').toISOString();
      const staleAfterMinutes = this.positiveNumber(value.staleAfterMinutes, 'records.staleAfterMinutes');
      const ageMinutes = Math.max(
        0,
        Math.ceil((new Date(generatedAt).getTime() - new Date(observedAt).getTime()) / 60000),
      );
      const fresh = ageMinutes <= staleAfterMinutes;
      const trusted = value.trusted === true;
      const severity = value.severity ? this.severity(value.severity, 'records.severity') : null;
      const incidentStatus = value.incidentStatus
        ? this.incidentStatus(value.incidentStatus, 'records.incidentStatus')
        : null;
      const decisionBinding = this.normalizedBinding(value.decisionBinding || {});
      const blockers: string[] = [];
      const raw = value as unknown as Record<string, unknown>;

      if (
        raw.provider_api_called === true
        || raw.google_ads_api_called === true
        || raw.validateOnly_called === true
        || raw.live_ads_execution_used === true
        || raw.execution_allowed_now === true
      ) {
        throw new BadRequestException('telemetry records must preserve local-only safety flags');
      }
      if (!fresh) blockers.push(`telemetry.${telemetryRecordId}.stale`);
      if (!trusted) blockers.push(`telemetry.${telemetryRecordId}.untrusted`);
      if (recordType === 'campaign_ad_group_identity') {
        if (!this.text(value.campaignId)) blockers.push(`telemetry.${telemetryRecordId}.campaignId_missing`);
        if (!this.text(value.adGroupId)) blockers.push(`telemetry.${telemetryRecordId}.adGroupId_missing`);
        if (!this.text(value.campaignBudgetId)) {
          blockers.push(`telemetry.${telemetryRecordId}.campaignBudgetId_missing_no_fallback`);
        }
      }
      blockers.push(...this.arrayText(value.blockers).map((blocker) => `telemetry.${telemetryRecordId}.${blocker}`));

      return {
        telemetryRecordId,
        recordType,
        provider,
        accountId: this.text(value.accountId),
        customerId: this.text(value.customerId),
        campaignId: this.text(value.campaignId),
        adGroupId: this.text(value.adGroupId),
        campaignBudgetId: this.text(value.campaignBudgetId),
        source,
        observedAt,
        collectedAt,
        staleAfterMinutes,
        ageMinutes,
        fresh,
        trusted,
        decisionBinding,
        severity,
        incidentStatus,
        activeIncident: value.activeIncident === true,
        acknowledgementTargetId: this.text(value.acknowledgementTargetId),
        escalationStatus: value.escalationStatus || null,
        evidence: this.arrayText(value.evidence),
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        blockers,
      };
    });
  }

  private decisionBinding(
    records: AdsAutomationMonitoringTelemetryRecordReadiness[],
  ): Required<AdsAutomationMonitoringTelemetryDecisionBinding> {
    const binding = this.normalizedBinding({});
    for (const field of Object.keys(binding) as Array<keyof Required<AdsAutomationMonitoringTelemetryDecisionBinding>>) {
      const value = records
        .map((record) => record.decisionBinding[field])
        .find((candidate) => this.text(candidate));
      binding[field] = this.text(value);
    }
    return binding;
  }

  private linkageBlockers(
    binding: Required<AdsAutomationMonitoringTelemetryDecisionBinding>,
    records: AdsAutomationMonitoringTelemetryRecordReadiness[],
  ): string[] {
    const blockers: string[] = [];
    for (const field of REQUIRED_LINKAGE_FIELDS) {
      if (!this.text(binding[field])) {
        blockers.push(`telemetry_linkage.${field}_missing`);
      }
      const distinct = this.unique(records
        .map((record) => this.text(record.decisionBinding[field]))
        .filter((value): value is string => Boolean(value)));
      if (distinct.length > 1) {
        blockers.push(`telemetry_linkage.${field}_mismatch`);
      }
    }
    if (binding.campaignBudgetId && (
      binding.campaignBudgetId === binding.campaignId
      || binding.campaignBudgetId === binding.adGroupId
    )) {
      blockers.push('telemetry_linkage.campaignBudgetId_no_fallback_violation');
    }
    const campaignBudgetIds = this.unique(records
      .map((record) => this.text(record.decisionBinding.campaignBudgetId))
      .filter((value): value is string => Boolean(value)));
    const campaignIds = new Set(records
      .map((record) => this.text(record.decisionBinding.campaignId))
      .filter((value): value is string => Boolean(value)));
    const adGroupIds = new Set(records
      .map((record) => this.text(record.decisionBinding.adGroupId))
      .filter((value): value is string => Boolean(value)));
    if (campaignBudgetIds.some((campaignBudgetId) => (
      campaignIds.has(campaignBudgetId) || adGroupIds.has(campaignBudgetId)
    ))) {
      blockers.push('telemetry_linkage.campaignBudgetId_no_fallback_violation');
    }
    return this.unique(blockers);
  }

  private normalizedBinding(
    value: AdsAutomationMonitoringTelemetryDecisionBinding,
  ): Required<AdsAutomationMonitoringTelemetryDecisionBinding> {
    return {
      approvalId: this.text(value.approvalId),
      policyDecisionId: this.text(value.policyDecisionId),
      validateOnlyValidationId: this.text(value.validateOnlyValidationId),
      executionRecordId: this.text(value.executionRecordId),
      idempotencyKey: this.text(value.idempotencyKey),
      rollbackPlanId: this.text(value.rollbackPlanId),
      lossLimitPolicyReportDate: this.text(value.lossLimitPolicyReportDate),
      customerId: this.text(value.customerId),
      accountId: this.text(value.accountId),
      campaignId: this.text(value.campaignId),
      adGroupId: this.text(value.adGroupId),
      campaignBudgetId: this.text(value.campaignBudgetId),
    };
  }

  private markdownPreview(input: {
    reportDate: string;
    ready: boolean;
    records: number;
    missingRecordTypes: AdsAutomationMonitoringTelemetryRecordType[];
    staleRecordIds: string[];
    untrustedRecordIds: string[];
    blockers: string[];
  }): string {
    return [
      '# Ads Automation Monitoring Telemetry Read Model',
      `Report date: ${input.reportDate}`,
      `Ready for policy linkage: ${input.ready ? 'yes' : 'no'}`,
      `Telemetry records: ${input.records}`,
      `Missing record types: ${this.joinOrNone(input.missingRecordTypes)}`,
      `Stale records: ${this.joinOrNone(input.staleRecordIds)}`,
      `Untrusted records: ${this.joinOrNone(input.untrustedRecordIds)}`,
      `Blockers: ${this.joinOrNone(input.blockers)}`,
      'Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false',
    ].join('\n');
  }

  private recordType(value: unknown, field: string): AdsAutomationMonitoringTelemetryRecordType {
    if (!REQUIRED_RECORD_TYPES.concat(['operator_acknowledgement']).includes(String(value || '') as any)) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as AdsAutomationMonitoringTelemetryRecordType;
  }

  private provider(value: unknown, field: string): AdsAutomationMonitoringPlatform {
    if (!['google_ads', 'facebook_ads', 'tiktok_ads'].includes(String(value || ''))) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as AdsAutomationMonitoringPlatform;
  }

  private source(value: unknown, field: string): AdsAutomationMonitoringTelemetrySource {
    if (!['erp_local_read_model', 'fixture', 'mock_adapter'].includes(String(value || ''))) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as AdsAutomationMonitoringTelemetrySource;
  }

  private severity(value: unknown, field: string): AdsAutomationMonitoringSeverity {
    if (!['info', 'warning', 'minor', 'major', 'critical'].includes(String(value || ''))) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as AdsAutomationMonitoringSeverity;
  }

  private incidentStatus(value: unknown, field: string): AdsAutomationMonitoringIncidentStatus {
    if (!['open', 'investigating', 'mitigating', 'resolved'].includes(String(value || ''))) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as AdsAutomationMonitoringIncidentStatus;
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return text;
  }

  private dateTime(value: unknown, field: string): Date {
    const parsed = new Date(value as string | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return parsed;
  }

  private positiveNumber(value: unknown, field: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new BadRequestException(`${field} must be a positive number`);
    }
    return number;
  }

  private requiredText(value: unknown, field: string): string {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private arrayText(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values.map((value) => String(value || '').trim()).filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
  }
}
