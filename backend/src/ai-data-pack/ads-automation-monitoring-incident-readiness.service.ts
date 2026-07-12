import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdsAutomationIncidentEvidenceInput,
  AdsAutomationIncidentReadiness,
  AdsAutomationMonitoringAlertReadiness,
  AdsAutomationMonitoringIncidentReadinessInput,
  AdsAutomationMonitoringIncidentReadinessResponse,
  AdsAutomationMonitoringSafetyAction,
  AdsAutomationMonitoringTelemetryEvidenceSnapshot,
  AdsAutomationOperatorAcknowledgementEvidence,
  AdsAutomationOperatorAcknowledgementInput,
  AdsAutomationProviderErrorRateMonitorInput,
  AdsAutomationProviderErrorRateMonitorReadiness,
  AdsAutomationProviderRateLimitBudgetInput,
  AdsAutomationProviderRateLimitBudgetReadiness,
  AdsAutomationSpendRateMonitorInput,
  AdsAutomationSpendRateMonitorReadiness,
  AdsAutomationStaleImportAlertInput,
  AdsAutomationValidateOnlyPreflightAlertInput,
} from './contracts/ads-automation-monitoring-incident-readiness.contract';

const BLOCKING_SEVERITIES = new Set(['major', 'critical']);

@Injectable()
export class AdsAutomationMonitoringIncidentReadinessService {
  build(
    input: AdsAutomationMonitoringIncidentReadinessInput,
  ): AdsAutomationMonitoringIncidentReadinessResponse {
    const reportDate = this.isoDate(input.reportDate, 'reportDate');
    const generatedAt = (input.now ? this.dateTime(input.now, 'now') : new Date()).toISOString();
    const telemetryEvidence = this.telemetryEvidence(input.telemetryReadModel || null);
    const acknowledgements = this.operatorAcknowledgements(input.operatorAcknowledgements || []);
    const acknowledgementTargetIds = new Set(
      acknowledgements
        .filter((acknowledgement) => acknowledgement.valid)
        .map((acknowledgement) => `${acknowledgement.targetType}:${acknowledgement.targetId}`),
    );
    const providerRateLimits = this.providerRateLimits(input.providerRateLimits || [], generatedAt);
    const spendRateMonitors = this.spendRateMonitors(input.spendRateMonitors || []);
    const providerErrorRateMonitors = this.providerErrorRateMonitors(input.providerErrorRateMonitors || []);
    const staleImportAlerts = this.staleImportAlerts(
      input.staleImportAlerts || [],
      acknowledgementTargetIds,
    );
    const validateOnlyPreflightAlerts = this.validateOnlyPreflightAlerts(
      input.validateOnlyPreflightAlerts || [],
      acknowledgementTargetIds,
    );
    const alerts = [...staleImportAlerts, ...validateOnlyPreflightAlerts];
    const incidents = this.incidents(input.incidents || [], acknowledgementTargetIds);
    const missingEvidenceBlockers = this.missingEvidenceBlockers(input);
    const rateLimitBlockers = providerRateLimits.flatMap((item) => item.blockers);
    const spendRateBlockers = spendRateMonitors.flatMap((item) => item.blockers);
    const providerErrorBlockers = providerErrorRateMonitors.flatMap((item) => item.blockers);
    const alertBlockers = alerts.flatMap((alert) => alert.blockers);
    const incidentBlockers = incidents.flatMap((incident) => incident.blockers);
    const telemetryBlockers = telemetryEvidence.blockers;
    const acknowledgementBlockers = acknowledgements
      .flatMap((acknowledgement) => acknowledgement.blockers.map((blocker) => (
        `operator_acknowledgement.${acknowledgement.targetId || 'unknown'}.${blocker}`
      )));
    const blockers = this.unique([
      ...missingEvidenceBlockers,
      ...rateLimitBlockers,
      ...spendRateBlockers,
      ...providerErrorBlockers,
      ...alertBlockers,
      ...incidentBlockers,
      ...telemetryBlockers.map((blocker) => `durable_telemetry.${blocker}`),
      ...acknowledgementBlockers,
    ]);
    const rateLimitBudgetSafe = rateLimitBlockers.length === 0 && providerRateLimits.length > 0;
    const spendRateSafe = spendRateBlockers.length === 0 && spendRateMonitors.length > 0;
    const providerErrorRateSafe = providerErrorBlockers.length === 0 && providerErrorRateMonitors.length > 0;
    const importFreshnessSafe = staleImportAlerts.every((alert) => !alert.blocking);
    const validateOnlyPreflightAlertsClear = validateOnlyPreflightAlerts.every((alert) => !alert.blocking);
    const activeIncidentBlockingCount = incidents.filter((incident) => (
      incident.active && incident.blockingScaleUp
    )).length;
    const monitoringHealthy = blockers.length === 0;
    const safeActionsAvailable = this.safeActionsAvailable(monitoringHealthy);

    return {
      schemaVersion: 'ads_automation_monitoring_incident_readiness.v1',
      generatedAt,
      reportDate,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
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
        approval_required_for_all_actions: true,
        monitoring_health_required_before_increase: true,
        rate_limit_budget_required_before_increase: true,
        active_incident_blocks_increase: true,
        operator_acknowledgement_required_for_blocking_alerts: true,
        durable_telemetry_read_model_required_before_increase: true,
      },
      summary: {
        status: monitoringHealthy ? 'ready_for_future_executor_local_only' : 'blocked',
        reportDate,
        fixture_mode: input.fixtureMode || 'custom_local_payload',
        durable_telemetry_read_model_used: telemetryEvidence.durable_telemetry_read_model_used,
        durable_telemetry_fresh: telemetryEvidence.telemetry_fresh,
        durable_telemetry_complete: telemetryEvidence.telemetry_complete,
        durable_telemetry_trusted: telemetryEvidence.telemetry_trusted,
        durable_telemetry_tied_to_policy_decision: telemetryEvidence.policy_decision_linkage_present,
        telemetry_record_count: telemetryEvidence.telemetry_record_count,
        telemetry_blocker_count: telemetryEvidence.blockers.length,
        monitoring_healthy: monitoringHealthy,
        rate_limit_budget_safe: rateLimitBudgetSafe,
        spend_rate_safe: spendRateSafe,
        provider_error_rate_safe: providerErrorRateSafe,
        import_freshness_safe: importFreshnessSafe,
        validateOnly_preflight_alerts_clear: validateOnlyPreflightAlertsClear,
        active_incident_blocking_count: activeIncidentBlockingCount,
        open_stale_import_alerts: staleImportAlerts.filter((alert) => alert.blocking).length,
        failed_validateOnly_alerts: validateOnlyPreflightAlerts.filter((alert) => (
          alert.kind === 'validateOnly' && alert.blocking
        )).length,
        failed_preflight_alerts: validateOnlyPreflightAlerts.filter((alert) => (
          alert.kind === 'preflight' && alert.blocking
        )).length,
        unacknowledged_blocking_alerts: [
          ...alerts.filter((alert) => alert.blocking && !alert.acknowledged),
          ...incidents.filter((incident) => incident.active && incident.blockingScaleUp && !incident.acknowledged),
        ].length,
        operator_acknowledgement_records: acknowledgements.filter((acknowledgement) => acknowledgement.valid).length,
        scale_up_execution_mode: monitoringHealthy ? 'pending_validation' : 'monitor_only',
        safe_actions_available: safeActionsAvailable,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        future_live_execution_allowed: false,
        production_ready: false,
        next_required_action: monitoringHealthy
          ? 'review_local_monitoring_incident_evidence'
          : 'resolve_monitoring_rate_limit_or_incident_blockers',
      },
      telemetryEvidence,
      providerRateLimits,
      spendRateMonitors,
      providerErrorRateMonitors,
      alerts,
      incidents,
      operatorAcknowledgements: acknowledgements,
      blockers,
      warnings: this.unique([
        ...providerRateLimits.flatMap((item) => item.warnings),
        ...spendRateMonitors.flatMap((item) => item.warnings),
        ...providerErrorRateMonitors.flatMap((item) => item.warnings),
      ]),
      markdownPreview: this.markdownPreview({
        reportDate,
        monitoringHealthy,
        blockers,
        safeActionsAvailable,
        activeIncidentBlockingCount,
        staleImportAlerts: staleImportAlerts.filter((alert) => alert.blocking).length,
        validateOnlyPreflightAlerts: validateOnlyPreflightAlerts.filter((alert) => alert.blocking).length,
        telemetryRecordCount: telemetryEvidence.telemetry_record_count,
      }),
    };
  }

  private telemetryEvidence(
    value: AdsAutomationMonitoringIncidentReadinessInput['telemetryReadModel'],
  ): AdsAutomationMonitoringTelemetryEvidenceSnapshot {
    const emptyBinding = {
      approvalId: null,
      policyDecisionId: null,
      validateOnlyValidationId: null,
      executionRecordId: null,
      idempotencyKey: null,
      rollbackPlanId: null,
      lossLimitPolicyReportDate: null,
      customerId: null,
      accountId: null,
      campaignId: null,
      adGroupId: null,
      campaignBudgetId: null,
    };

    if (!value) {
      return {
        schemaVersion: null,
        durable_telemetry_read_model_used: false,
        telemetry_fresh: false,
        telemetry_complete: false,
        telemetry_trusted: false,
        policy_decision_linkage_present: false,
        telemetry_record_count: 0,
        telemetry_evidence_record_ids: [],
        decisionBinding: emptyBinding,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        blockers: ['telemetry_read_model_missing'],
      };
    }
    if (value.schemaVersion !== 'ads_automation_monitoring_telemetry_read_model.v1') {
      throw new BadRequestException('telemetryReadModel must use ads_automation_monitoring_telemetry_read_model.v1');
    }
    if (
      value.safety?.provider_api_called !== false
      || value.safety?.google_ads_api_called !== false
      || value.safety?.validateOnly_called !== false
      || value.safety?.live_ads_execution_used !== false
      || value.safety?.execution_allowed_now !== false
      || value.summary?.provider_api_called !== false
      || value.summary?.google_ads_api_called !== false
      || value.summary?.validateOnly_called !== false
      || value.summary?.live_ads_execution_used !== false
      || value.summary?.execution_allowed_now !== false
    ) {
      throw new BadRequestException('telemetryReadModel must preserve no-provider/no-live safety flags');
    }

    const summary = value.summary;
    const blockers = this.unique([
      ...(summary.telemetry_fresh ? [] : ['telemetry_not_fresh']),
      ...(summary.telemetry_complete ? [] : ['telemetry_not_complete']),
      ...(summary.telemetry_trusted ? [] : ['telemetry_not_trusted']),
      ...(summary.policy_decision_linkage_present ? [] : ['telemetry_policy_decision_linkage_missing']),
      ...this.arrayText(value.blockers),
    ]);

    return {
      schemaVersion: value.schemaVersion,
      durable_telemetry_read_model_used: true,
      telemetry_fresh: summary.telemetry_fresh,
      telemetry_complete: summary.telemetry_complete,
      telemetry_trusted: summary.telemetry_trusted,
      policy_decision_linkage_present: summary.policy_decision_linkage_present,
      telemetry_record_count: summary.telemetry_record_count,
      telemetry_evidence_record_ids: value.records.map((record) => record.telemetryRecordId),
      decisionBinding: value.decisionBinding || emptyBinding,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      blockers,
    };
  }

  private providerRateLimits(
    values: AdsAutomationProviderRateLimitBudgetInput[],
    generatedAt: string,
  ): AdsAutomationProviderRateLimitBudgetReadiness[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException('providerRateLimits must be an array');
    }
    return values.map((value) => {
      const provider = this.provider(value.provider, 'providerRateLimits.provider');
      const requestsUsed = this.nonNegativeNumber(value.requestsUsed, 'providerRateLimits.requestsUsed');
      const requestsLimit = this.positiveNumber(value.requestsLimit, 'providerRateLimits.requestsLimit');
      const minRemainingRequests = this.nonNegativeNumber(value.minRemainingRequests, 'providerRateLimits.minRemainingRequests');
      const remainingRequests = Math.max(0, requestsLimit - requestsUsed);
      const remainingPercent = this.percent(remainingRequests, requestsLimit);
      const windowStartedAt = this.dateTime(value.windowStartedAt, 'providerRateLimits.windowStartedAt').toISOString();
      const windowEndsAt = this.dateTime(value.windowEndsAt, 'providerRateLimits.windowEndsAt').toISOString();
      const cooldownEndsAt = value.cooldownEndsAt
        ? this.dateTime(value.cooldownEndsAt, 'providerRateLimits.cooldownEndsAt').toISOString()
        : null;
      const cooldownActive = cooldownEndsAt
        ? new Date(cooldownEndsAt).getTime() > new Date(generatedAt).getTime()
        : false;
      const blockers: string[] = [];
      const warnings: string[] = [];

      if (requestsUsed > requestsLimit) blockers.push(`${provider}.rate_limit_budget_exceeded`);
      if (remainingRequests < minRemainingRequests) blockers.push(`${provider}.rate_limit_remaining_below_threshold`);
      if (value.throttlingActive === true) blockers.push(`${provider}.rate_limit_throttling_active`);
      if (cooldownActive) blockers.push(`${provider}.rate_limit_cooldown_active`);
      if (remainingPercent < 20 && !blockers.length) warnings.push(`${provider}.rate_limit_budget_low`);

      return {
        provider,
        accountId: this.text(value.accountId),
        customerId: this.text(value.customerId),
        status: blockers.length ? 'blocked' : warnings.length ? 'pressure' : 'safe',
        windowStartedAt,
        windowEndsAt,
        requestsUsed,
        requestsLimit,
        minRemainingRequests,
        remainingRequests,
        remainingPercent,
        throttlingActive: value.throttlingActive === true,
        cooldownEndsAt,
        source: value.source || 'fixture',
        blockers,
        warnings,
      };
    });
  }

  private spendRateMonitors(
    values: AdsAutomationSpendRateMonitorInput[],
  ): AdsAutomationSpendRateMonitorReadiness[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException('spendRateMonitors must be an array');
    }
    return values.map((value) => {
      if (!['account', 'campaign', 'ad_group'].includes(value.scope)) {
        throw new BadRequestException('spendRateMonitors.scope is unsupported');
      }
      const spendLastHourVnd = this.nonNegativeNumber(value.spendLastHourVnd, 'spendRateMonitors.spendLastHourVnd');
      const spendTodayVnd = this.nonNegativeNumber(value.spendTodayVnd, 'spendRateMonitors.spendTodayVnd');
      const spendMonthVnd = this.nonNegativeNumber(value.spendMonthVnd, 'spendRateMonitors.spendMonthVnd');
      const hourlySpendCapVnd = this.positiveNumber(value.hourlySpendCapVnd, 'spendRateMonitors.hourlySpendCapVnd');
      const dailyBudgetVnd = this.positiveNumber(value.dailyBudgetVnd, 'spendRateMonitors.dailyBudgetVnd');
      const monthlyBudgetVnd = this.positiveNumber(value.monthlyBudgetVnd, 'spendRateMonitors.monthlyBudgetVnd');
      const dailyBurnAlertPercent = this.positiveNumber(value.dailyBurnAlertPercent, 'spendRateMonitors.dailyBurnAlertPercent');
      const monthlyBurnAlertPercent = this.positiveNumber(value.monthlyBurnAlertPercent, 'spendRateMonitors.monthlyBurnAlertPercent');
      const dailyBurnPercent = this.percent(spendTodayVnd, dailyBudgetVnd);
      const monthlyBurnPercent = this.percent(spendMonthVnd, monthlyBudgetVnd);
      const blockers: string[] = [];
      const warnings: string[] = [];
      const scopeKey = this.scopeKey(value);

      if (value.scope === 'ad_group' && !this.text(value.adGroupId)) blockers.push(`${scopeKey}.adGroupId_missing`);
      if ((value.scope === 'campaign' || value.scope === 'ad_group') && !this.text(value.campaignId)) {
        blockers.push(`${scopeKey}.campaignId_missing`);
      }
      if (spendLastHourVnd > hourlySpendCapVnd) blockers.push(`${scopeKey}.hourly_spend_cap_exceeded`);
      if (dailyBurnPercent >= dailyBurnAlertPercent) blockers.push(`${scopeKey}.daily_budget_burn_alert`);
      if (monthlyBurnPercent >= monthlyBurnAlertPercent) blockers.push(`${scopeKey}.monthly_budget_burn_alert`);
      if (!this.text(value.campaignBudgetId) && value.scope !== 'account') {
        blockers.push(`${scopeKey}.campaignBudgetId_missing_no_fallback`);
      }
      if (!blockers.length && (dailyBurnPercent >= 75 || monthlyBurnPercent >= 75)) {
        warnings.push(`${scopeKey}.budget_burn_watch`);
      }

      return {
        scope: value.scope,
        accountId: this.text(value.accountId),
        customerId: this.text(value.customerId),
        campaignId: this.text(value.campaignId),
        adGroupId: this.text(value.adGroupId),
        campaignBudgetId: this.text(value.campaignBudgetId),
        status: blockers.length ? 'blocked' : warnings.length ? 'pressure' : 'safe',
        spendLastHourVnd,
        spendTodayVnd,
        spendMonthVnd,
        hourlySpendCapVnd,
        dailyBudgetVnd,
        monthlyBudgetVnd,
        dailyBurnPercent,
        monthlyBurnPercent,
        blockers,
        warnings,
      };
    });
  }

  private providerErrorRateMonitors(
    values: AdsAutomationProviderErrorRateMonitorInput[],
  ): AdsAutomationProviderErrorRateMonitorReadiness[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException('providerErrorRateMonitors must be an array');
    }
    return values.map((value) => {
      const provider = this.provider(value.provider, 'providerErrorRateMonitors.provider');
      const requestCount = this.nonNegativeNumber(value.requestCount, 'providerErrorRateMonitors.requestCount');
      const errorCount = this.nonNegativeNumber(value.errorCount, 'providerErrorRateMonitors.errorCount');
      const timeoutCount = this.nonNegativeNumber(value.timeoutCount, 'providerErrorRateMonitors.timeoutCount');
      const rateLimitErrorCount = this.nonNegativeNumber(value.rateLimitErrorCount, 'providerErrorRateMonitors.rateLimitErrorCount');
      const maxErrorRatePercent = this.nonNegativeNumber(value.maxErrorRatePercent, 'providerErrorRateMonitors.maxErrorRatePercent');
      const maxTimeoutRatePercent = this.nonNegativeNumber(value.maxTimeoutRatePercent, 'providerErrorRateMonitors.maxTimeoutRatePercent');
      const errorRatePercent = requestCount ? this.percent(errorCount, requestCount) : 0;
      const timeoutRatePercent = requestCount ? this.percent(timeoutCount, requestCount) : 0;
      const blockers: string[] = [];
      const warnings: string[] = [];

      if (requestCount === 0) blockers.push(`${provider}.provider_error_rate_window_empty`);
      if (errorRatePercent > maxErrorRatePercent) blockers.push(`${provider}.provider_error_rate_high`);
      if (timeoutRatePercent > maxTimeoutRatePercent) blockers.push(`${provider}.provider_timeout_rate_high`);
      if (rateLimitErrorCount > 0) blockers.push(`${provider}.provider_rate_limit_errors_present`);
      if (!blockers.length && errorRatePercent > maxErrorRatePercent / 2) {
        warnings.push(`${provider}.provider_error_rate_watch`);
      }

      return {
        provider,
        accountId: this.text(value.accountId),
        customerId: this.text(value.customerId),
        status: blockers.length ? 'blocked' : warnings.length ? 'pressure' : 'safe',
        windowMinutes: this.positiveNumber(value.windowMinutes, 'providerErrorRateMonitors.windowMinutes'),
        requestCount,
        errorCount,
        timeoutCount,
        rateLimitErrorCount,
        errorRatePercent,
        timeoutRatePercent,
        maxErrorRatePercent,
        maxTimeoutRatePercent,
        blockers,
        warnings,
      };
    });
  }

  private staleImportAlerts(
    values: AdsAutomationStaleImportAlertInput[],
    acknowledgementTargetIds: Set<string>,
  ): AdsAutomationMonitoringAlertReadiness[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException('staleImportAlerts must be an array');
    }
    return values.map((value) => {
      const alertId = this.requiredText(value.alertId, 'staleImportAlerts.alertId');
      const sourceKey = this.requiredText(value.sourceKey, 'staleImportAlerts.sourceKey');
      const status = this.alertStatus(value.status, 'staleImportAlerts.status');
      const severity = this.severity(value.severity, 'staleImportAlerts.severity');
      const blocking = value.blocking === true
        || (status !== 'resolved' && value.freshnessStatus !== 'fresh');
      const acknowledged = acknowledgementTargetIds.has(`alert:${alertId}`);
      const blockers: string[] = [];

      if (!['fresh', 'stale', 'missing'].includes(value.freshnessStatus)) {
        throw new BadRequestException('staleImportAlerts.freshnessStatus is unsupported');
      }
      this.nonNegativeNumber(value.maxAgeMinutes, 'staleImportAlerts.maxAgeMinutes');
      if (value.lastSuccessfulSyncAt) {
        this.dateTime(value.lastSuccessfulSyncAt, 'staleImportAlerts.lastSuccessfulSyncAt');
      }
      if (value.ageMinutes !== undefined && value.ageMinutes !== null) {
        this.nonNegativeNumber(value.ageMinutes, 'staleImportAlerts.ageMinutes');
      }
      if (blocking) blockers.push(`stale_import.${sourceKey}.${value.freshnessStatus}`);
      if (blocking && !acknowledged && BLOCKING_SEVERITIES.has(severity)) {
        blockers.push(`operator_acknowledgement_missing.alert.${alertId}`);
      }

      return {
        alertId,
        kind: 'stale_import',
        severity,
        status,
        sourceKey,
        blocking,
        acknowledged,
        blockers,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      };
    });
  }

  private validateOnlyPreflightAlerts(
    values: AdsAutomationValidateOnlyPreflightAlertInput[],
    acknowledgementTargetIds: Set<string>,
  ): AdsAutomationMonitoringAlertReadiness[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException('validateOnlyPreflightAlerts must be an array');
    }
    return values.map((value) => {
      const alertId = this.requiredText(value.alertId, 'validateOnlyPreflightAlerts.alertId');
      if (!['validateOnly', 'preflight'].includes(value.kind)) {
        throw new BadRequestException('validateOnlyPreflightAlerts.kind is unsupported');
      }
      const status = this.alertStatus(value.status, 'validateOnlyPreflightAlerts.status');
      const severity = this.severity(value.severity, 'validateOnlyPreflightAlerts.severity');
      const acknowledged = acknowledgementTargetIds.has(`alert:${alertId}`);
      const blocking = status !== 'resolved';
      const blockers = blocking
        ? [
            `${value.kind}_alert.${alertId}`,
            ...this.arrayText(value.blockers).map((blocker) => `${value.kind}.${blocker}`),
            ...(acknowledged || !BLOCKING_SEVERITIES.has(severity)
              ? []
              : [`operator_acknowledgement_missing.alert.${alertId}`]),
          ]
        : [];

      this.dateTime(value.failedAt, 'validateOnlyPreflightAlerts.failedAt');
      const rawValue = value as unknown as Record<string, unknown>;
      if (
        rawValue.provider_api_called === true
        || rawValue.google_ads_api_called === true
        || rawValue.validateOnly_called === true
        || rawValue.live_ads_execution_used === true
        || rawValue.execution_allowed_now === true
      ) {
        throw new BadRequestException('validateOnlyPreflightAlerts must preserve local-only safety flags');
      }

      return {
        alertId,
        kind: value.kind,
        severity,
        status,
        approvalId: this.text(value.approvalId),
        validationId: this.text(value.validationId),
        executionRecordId: this.text(value.executionRecordId),
        blocking,
        acknowledged,
        blockers,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      };
    });
  }

  private incidents(
    values: AdsAutomationIncidentEvidenceInput[],
    acknowledgementTargetIds: Set<string>,
  ): AdsAutomationIncidentReadiness[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException('incidents must be an array');
    }
    return values.map((value) => {
      const incidentId = this.requiredText(value.incidentId, 'incidents.incidentId');
      const severity = this.severity(value.severity, 'incidents.severity');
      const status = this.incidentStatus(value.status, 'incidents.status');
      const active = status !== 'resolved';
      const blockingScaleUp = active && (value.blockingScaleUp === true || BLOCKING_SEVERITIES.has(severity));
      const acknowledged = acknowledgementTargetIds.has(`incident:${incidentId}`);
      const blockers: string[] = [];

      this.dateTime(value.startedAt, 'incidents.startedAt');
      if (value.resolvedAt) this.dateTime(value.resolvedAt, 'incidents.resolvedAt');
      if (!this.text(value.affectedScope)) blockers.push(`incident.${incidentId}.affected_scope_missing`);
      if (!this.text(value.summary)) blockers.push(`incident.${incidentId}.summary_missing`);
      if (blockingScaleUp) blockers.push(`active_incident.${incidentId}`);
      if (blockingScaleUp && !acknowledged) {
        blockers.push(`operator_acknowledgement_missing.incident.${incidentId}`);
      }

      return {
        incidentId,
        severity,
        status,
        startedAt: this.dateTime(value.startedAt, 'incidents.startedAt').toISOString(),
        resolvedAt: value.resolvedAt
          ? this.dateTime(value.resolvedAt, 'incidents.resolvedAt').toISOString()
          : null,
        affectedScope: this.text(value.affectedScope),
        summary: this.text(value.summary),
        active,
        blockingScaleUp,
        acknowledged,
        linkedAlertIds: this.arrayText(value.linkedAlertIds),
        blockers,
      };
    });
  }

  private operatorAcknowledgements(
    values: AdsAutomationOperatorAcknowledgementInput[],
  ): AdsAutomationOperatorAcknowledgementEvidence[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException('operatorAcknowledgements must be an array');
    }
    return values.map((value) => {
      if (!['incident', 'alert'].includes(value.targetType)) {
        throw new BadRequestException('operatorAcknowledgements.targetType is unsupported');
      }
      const blockers: string[] = [];
      const acknowledgementId = this.text(value.acknowledgementId);
      const targetId = this.text(value.targetId);
      const operatorUserId = this.text(value.operatorUserId);
      const operatorRole = this.text(value.operatorRole);
      const reason = this.text(value.reason);

      if (!acknowledgementId) blockers.push('acknowledgementId_missing');
      if (!targetId) blockers.push('targetId_missing');
      if (!operatorUserId) blockers.push('operatorUserId_missing');
      if (!operatorRole) blockers.push('operatorRole_missing');
      if (!reason) blockers.push('reason_missing');
      this.dateTime(value.acknowledgedAt, 'operatorAcknowledgements.acknowledgedAt');

      return {
        acknowledgementId,
        targetType: value.targetType,
        targetId,
        acknowledgedAt: this.dateTime(value.acknowledgedAt, 'operatorAcknowledgements.acknowledgedAt').toISOString(),
        operatorUserId,
        operatorRole,
        reason,
        valid: blockers.length === 0,
        blockers,
      };
    });
  }

  private missingEvidenceBlockers(input: AdsAutomationMonitoringIncidentReadinessInput): string[] {
    const blockers: string[] = [];
    if (!Array.isArray(input.providerRateLimits) || !input.providerRateLimits.length) {
      blockers.push('provider_rate_limit_budget_evidence_missing');
    }
    if (!Array.isArray(input.spendRateMonitors) || !input.spendRateMonitors.length) {
      blockers.push('spend_rate_monitoring_evidence_missing');
    }
    if (!Array.isArray(input.providerErrorRateMonitors) || !input.providerErrorRateMonitors.length) {
      blockers.push('provider_error_rate_monitoring_evidence_missing');
    }
    return blockers;
  }

  private safeActionsAvailable(monitoringHealthy: boolean): AdsAutomationMonitoringSafetyAction[] {
    if (monitoringHealthy) return ['monitor_only'];
    return ['pause_campaign', 'pause_ad_group', 'reduce_campaign_budget', 'monitor_only'];
  }

  private markdownPreview(input: {
    reportDate: string;
    monitoringHealthy: boolean;
    blockers: string[];
    safeActionsAvailable: AdsAutomationMonitoringSafetyAction[];
    activeIncidentBlockingCount: number;
    staleImportAlerts: number;
    validateOnlyPreflightAlerts: number;
    telemetryRecordCount: number;
  }): string {
    return [
      '# Ads Automation Monitoring Incident Readiness',
      `Report date: ${input.reportDate}`,
      `Monitoring healthy: ${input.monitoringHealthy ? 'yes' : 'no'}`,
      `Telemetry records: ${input.telemetryRecordCount}`,
      `Active blocking incidents: ${input.activeIncidentBlockingCount}`,
      `Open stale import alerts: ${input.staleImportAlerts}`,
      `Failed validate/preflight alerts: ${input.validateOnlyPreflightAlerts}`,
      `Safe actions available: ${this.joinOrNone(input.safeActionsAvailable)}`,
      `Blockers: ${this.joinOrNone(input.blockers)}`,
      'Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false',
    ].join('\n');
  }

  private scopeKey(value: AdsAutomationSpendRateMonitorInput): string {
    return [
      value.scope,
      this.text(value.accountId) || this.text(value.customerId) || 'unmapped',
      this.text(value.campaignId),
      this.text(value.adGroupId),
    ].filter(Boolean).join('.');
  }

  private provider(value: unknown, field: string): 'google_ads' | 'facebook_ads' | 'tiktok_ads' {
    if (!['google_ads', 'facebook_ads', 'tiktok_ads'].includes(String(value || ''))) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as 'google_ads' | 'facebook_ads' | 'tiktok_ads';
  }

  private severity(value: unknown, field: string): 'info' | 'warning' | 'minor' | 'major' | 'critical' {
    if (!['info', 'warning', 'minor', 'major', 'critical'].includes(String(value || ''))) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as 'info' | 'warning' | 'minor' | 'major' | 'critical';
  }

  private alertStatus(value: unknown, field: string): 'open' | 'acknowledged' | 'resolved' {
    if (!['open', 'acknowledged', 'resolved'].includes(String(value || ''))) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as 'open' | 'acknowledged' | 'resolved';
  }

  private incidentStatus(value: unknown, field: string): 'open' | 'investigating' | 'mitigating' | 'resolved' {
    if (!['open', 'investigating', 'mitigating', 'resolved'].includes(String(value || ''))) {
      throw new BadRequestException(`${field} is unsupported`);
    }
    return value as 'open' | 'investigating' | 'mitigating' | 'resolved';
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

  private percent(numerator: number, denominator: number): number {
    if (!denominator) return 0;
    return Math.round((numerator / denominator) * 10000) / 100;
  }

  private nonNegativeNumber(value: unknown, field: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
    return number;
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
