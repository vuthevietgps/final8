import { AdsAutomationPolicyDecisionAuditLinkageService } from './ads-automation-policy-decision-audit-linkage.service';
import { ADS_AUTOMATION_POLICY_DECISION_AUDIT_LINKAGE_FIXTURE } from './ads-automation-policy-decision-audit-linkage.fixture';
import type { AdsAutomationPolicyDecisionAuditLinkageInput } from './contracts/ads-automation-policy-decision-audit-linkage.contract';

describe('AdsAutomationPolicyDecisionAuditLinkageService', () => {
  let service: AdsAutomationPolicyDecisionAuditLinkageService;

  beforeEach(() => {
    service = new AdsAutomationPolicyDecisionAuditLinkageService();
  });

  it('links policy_decision_id, pending_action_id, audit, validate-only, preflight, and rollback evidence without opening execution', () => {
    const input = fixture();

    const response = service.build(input);

    expect(response.schemaVersion).toBe('ads_automation_policy_decision_audit_linkage.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
      in_memory_only: true,
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
      live_path_implemented: false,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      production_ready: false,
      approval_required_for_all_actions: true,
      campaignBudgetId_no_fallback: true,
      policy_decision_id_linkage_required: true,
      pending_action_id_linkage_required: true,
      validateOnly_preflight_linkage_required: true,
      human_approval_audit_required: true,
      rollback_readiness_required: true,
      safe_idempotency_required: true,
      monitoring_health_required_before_increase: true,
      rate_limit_budget_required_before_increase: true,
      active_incident_blocks_increase: true,
      operator_acknowledgement_required_for_blocking_alerts: true,
      durable_telemetry_read_model_required_before_increase: true,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      status: 'ready_for_future_executor_local_only',
      execution_records_received: 1,
      linked_records_ready: 1,
      blocked_records: 0,
      monitor_only_downgrades: 0,
      rollback_ready_records: 1,
      policy_decision_records_linked: 1,
      validateOnly_records_linked: 1,
      audit_records_linked: 1,
      pending_action_ids_linked: 1,
      human_approval_records_linked: 1,
      monitoring_ready_records: 1,
      monitoring_blocked_records: 0,
      active_incident_blocked_records: 0,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.blockers).toEqual([]);
    expect(response.linkageRecords[0]).toEqual(expect.objectContaining({
      pending_action_id: 'ADSPENDINGACTION-ads_policy_linkage_demo_budget',
      source_decision_id: 'DEC-scale_amount-2001',
      policy_decision_id: 'ADSPOLICY-ads_policy_linkage_demo_budget',
      validateOnly_validation_id: 'ADSPROVIDERVALIDATE-ads_policy_linkage_demo_budget',
      audit_id: 'ADSAUDIT-ads_policy_linkage_demo_budget-approve-REQ-DEMO',
      action_type: 'update_campaign_budget',
      recommendation: 'pending_future_executor_local_only',
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      future_live_execution_allowed: false,
      campaignBudgetId_fallback_used: false,
      blockers: [],
    }));
    expect(response.linkageRecords[0].sourceExecutionRecord.blockers).toEqual(expect.arrayContaining([
      'GOOGLE_ADS_PRODUCTION_ENABLED',
      'live_path_not_implemented',
    ]));
    expect(response.linkageRecords[0].audit_correlation_id).toContain('ADSPOLICYLINK');
    expect(response.linkageRecords[0].policyEvaluationSnapshot).toEqual(expect.objectContaining({
      policy_decision_id: 'ADSPOLICY-ads_policy_linkage_demo_budget',
      policy_allowed: true,
      policy_decision_record_persisted: true,
      loss_limit_policy_all_safe_for_increase: true,
      loss_limit_policy_allowed_for_requested_action: true,
      loss_limit_policy_scale_blockers: [],
    }));
    expect(response.linkageRecords[0].humanApprovalEvidence).toEqual(expect.objectContaining({
      audit_status_change_performed: true,
      human_approval_present: true,
      reviewerUserId: 'director-1',
    }));
    expect(response.linkageRecords[0].monitoringEvidenceSnapshot).toEqual(expect.objectContaining({
      schemaVersion: 'ads_automation_monitoring_incident_readiness.v1',
      telemetry_schemaVersion: 'ads_automation_monitoring_telemetry_read_model.v1',
      durable_telemetry_read_model_used: true,
      durable_telemetry_fresh: true,
      durable_telemetry_complete: true,
      durable_telemetry_trusted: true,
      durable_telemetry_tied_to_policy_decision: true,
      telemetry_record_count: 9,
      monitoring_healthy: true,
      rate_limit_budget_safe: true,
      import_freshness_safe: true,
      validateOnly_preflight_alerts_clear: true,
      active_incident_blocking_count: 0,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      blockers: [],
    }));
    expect(response.linkageRecords[0].monitoringEvidenceSnapshot.telemetry_decision_binding)
      .toEqual(expect.objectContaining({
        approvalId: 'ADSAPPROVAL-ads_policy_linkage_demo_budget',
        policyDecisionId: 'ADSPOLICY-ads_policy_linkage_demo_budget',
        validateOnlyValidationId: 'ADSPROVIDERVALIDATE-ads_policy_linkage_demo_budget',
        executionRecordId: 'ADSEXEC-DRYRUN-ads_policy_linkage_demo_budget-REQ-DEMO',
        campaignBudgetId: '3001',
      }));
    expect(response.linkageRecords[0].rollbackReadiness).toEqual(expect.objectContaining({
      status: 'ready',
      supported_mvp_action: true,
      rollback_action_type: 'restore_campaign_budget',
      before_state_snapshot_present: true,
      rollback_plan_present: true,
      missing_identifiers: [],
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(response.linkageRecords[0].rollbackReadiness.rollback_plan).toEqual(expect.objectContaining({
      rollback_action_type: 'restore_campaign_budget',
      customerId: '1234567890',
      campaignBudgetId: '3001',
      restoreDailyBudgetVnd: 1000000,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
  });

  it('downgrades increase-budget actions to monitor_only when monitoring, rate-limit, stale import, or incident evidence is unsafe', () => {
    const input = fixture();
    input.monitoringReadiness!.summary.monitoring_healthy = false;
    input.monitoringReadiness!.summary.rate_limit_budget_safe = false;
    input.monitoringReadiness!.summary.import_freshness_safe = false;
    input.monitoringReadiness!.summary.validateOnly_preflight_alerts_clear = false;
    input.monitoringReadiness!.summary.active_incident_blocking_count = 1;
    input.monitoringReadiness!.summary.unacknowledged_blocking_alerts = 1;
    input.monitoringReadiness!.summary.scale_up_execution_mode = 'monitor_only';
    input.monitoringReadiness!.summary.safe_actions_available = [
      'pause_campaign',
      'pause_ad_group',
      'reduce_campaign_budget',
      'monitor_only',
    ];
    input.monitoringReadiness!.blockers = [
      'google_ads.rate_limit_remaining_below_threshold',
      'stale_import.google_ads.stale',
      'validateOnly_alert.ADSALERT-validateOnly-failed',
      'active_incident.ADSINC-google-ads-rate-limit-20260704',
      'operator_acknowledgement_missing.incident.ADSINC-google-ads-rate-limit-20260704',
    ];

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      monitor_only_downgrades: 1,
      monitoring_ready_records: 0,
      monitoring_blocked_records: 1,
      active_incident_blocked_records: 1,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.linkageRecords[0]).toEqual(expect.objectContaining({
      action_type: 'update_campaign_budget',
      recommendation: 'monitor_only',
      execution_allowed_now: false,
      future_live_execution_allowed: false,
    }));
    expect(response.linkageRecords[0].blockers).toEqual(expect.arrayContaining([
      'monitoring_health_safe_for_increase',
    ]));
    expect(response.linkageRecords[0].monitoringEvidenceSnapshot).toEqual(expect.objectContaining({
      monitoring_healthy: false,
      rate_limit_budget_safe: false,
      import_freshness_safe: false,
      validateOnly_preflight_alerts_clear: false,
      active_incident_blocking_count: 1,
      unacknowledged_blocking_alerts: 1,
      scale_up_execution_mode: 'monitor_only',
      blockers: expect.arrayContaining([
        'google_ads.rate_limit_remaining_below_threshold',
        'stale_import.google_ads.stale',
        'validateOnly_alert.ADSALERT-validateOnly-failed',
        'active_incident.ADSINC-google-ads-rate-limit-20260704',
      ]),
    }));
    expect(response.linkageRecords[0].gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'monitoring_health_safe_for_increase',
        status: 'blocked',
      }),
    ]));
  });

  it('downgrades increase-budget actions to monitor_only when durable telemetry is stale, incomplete, untrusted, or not tied to policy evidence', () => {
    const input = fixture();
    input.monitoringReadiness!.summary.durable_telemetry_fresh = false;
    input.monitoringReadiness!.summary.durable_telemetry_complete = false;
    input.monitoringReadiness!.summary.durable_telemetry_trusted = false;
    input.monitoringReadiness!.summary.durable_telemetry_tied_to_policy_decision = false;
    input.monitoringReadiness!.telemetryEvidence.telemetry_fresh = false;
    input.monitoringReadiness!.telemetryEvidence.telemetry_complete = false;
    input.monitoringReadiness!.telemetryEvidence.telemetry_trusted = false;
    input.monitoringReadiness!.telemetryEvidence.policy_decision_linkage_present = false;
    input.monitoringReadiness!.telemetryEvidence.decisionBinding.policyDecisionId =
      'ADSPOLICY-different';
    input.monitoringReadiness!.telemetryEvidence.decisionBinding.campaignBudgetId =
      '1001';
    input.monitoringReadiness!.telemetryEvidence.blockers = [
      'telemetry.ADSTELEMETRY-import-freshness-20260704.stale',
      'telemetry_linkage.policyDecisionId_mismatch',
      'telemetry_linkage.campaignBudgetId_no_fallback_violation',
    ];
    input.monitoringReadiness!.blockers = [
      'durable_telemetry.telemetry_not_fresh',
      'durable_telemetry.telemetry_policy_decision_linkage_missing',
    ];

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      monitor_only_downgrades: 1,
      monitoring_blocked_records: 1,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.linkageRecords[0]).toEqual(expect.objectContaining({
      action_type: 'update_campaign_budget',
      recommendation: 'monitor_only',
      execution_allowed_now: false,
      future_live_execution_allowed: false,
    }));
    expect(response.linkageRecords[0].blockers).toEqual(expect.arrayContaining([
      'monitoring_health_safe_for_increase',
    ]));
    expect(response.linkageRecords[0].gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'monitoring_health_safe_for_increase',
        status: 'blocked',
        detail: expect.stringContaining('durable_telemetry_not_fresh'),
      }),
    ]));
    expect(response.linkageRecords[0].gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'monitoring_health_safe_for_increase',
        detail: expect.stringContaining('durable_telemetry_binding.policyDecisionId_mismatch'),
      }),
    ]));
    expect(response.linkageRecords[0].monitoringEvidenceSnapshot).toEqual(expect.objectContaining({
      durable_telemetry_fresh: false,
      durable_telemetry_complete: false,
      durable_telemetry_trusted: false,
      durable_telemetry_tied_to_policy_decision: false,
      telemetry_decision_binding: expect.objectContaining({
        policyDecisionId: 'ADSPOLICY-different',
        campaignBudgetId: '1001',
      }),
      blockers: expect.arrayContaining([
        'durable_telemetry.telemetry_not_fresh',
        'telemetry.telemetry.ADSTELEMETRY-import-freshness-20260704.stale',
      ]),
    }));
  });

  it('blocks future execution when human approval audit evidence is missing', () => {
    const input = fixture();
    input.auditRecords = [];

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      blocked_records: 1,
      audit_records_linked: 0,
      human_approval_records_linked: 0,
      execution_allowed_now: false,
    }));
    expect(response.linkageRecords[0].blockers).toEqual(expect.arrayContaining([
      'human_approval_audit_correlated',
    ]));
    expect(response.linkageRecords[0].humanApprovalEvidence).toEqual(expect.objectContaining({
      audit_id: null,
      human_approval_present: false,
    }));
  });

  it('downgrades increase-budget actions to monitor_only when loss-limit or rollback readiness is unsafe', () => {
    const input = fixture();
    input.lossLimitPolicy!.summary.all_safe_for_increase = false;
    input.lossLimitPolicy!.summary.policy_allowed_for_requested_action = false;
    input.lossLimitPolicy!.scaleBlockers = ['daily_loss_limit_breached'];
    input.approvalEvidenceIndex.executionPreflightDryRunRecords[0].source_pending_approval.typedPayload.currentBudgetVnd = null;
    input.approvalEvidenceIndex.executionPreflightDryRunRecords[0].source_validateOnly_plan!.requested_change.currentBudgetVnd = null;
    input.approvalEvidenceIndex.executionPreflightDryRunRecords[0].source_validateOnly_plan!.before_state_snapshot.snapshot = {
      syncedAt: '2026-07-04T06:05:00.000Z',
    };

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      monitor_only_downgrades: 1,
      rollback_blocked_records: 1,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
    }));
    expect(response.linkageRecords[0]).toEqual(expect.objectContaining({
      action_type: 'update_campaign_budget',
      recommendation: 'monitor_only',
      future_live_execution_allowed: false,
      execution_allowed_now: false,
    }));
    expect(response.linkageRecords[0].blockers).toEqual(expect.arrayContaining([
      'loss_limit_policy_safe_for_increase',
      'rollback_readiness',
    ]));
    expect(response.linkageRecords[0].rollbackReadiness.blockers).toEqual(expect.arrayContaining([
      'previous_campaign_budget_missing',
    ]));
  });

  it('keeps pause safety actions available when scale-up policy is blocked but pause rollback evidence is ready', () => {
    const input = pauseCampaignFixture();
    input.monitoringReadiness!.summary.monitoring_healthy = false;
    input.monitoringReadiness!.summary.active_incident_blocking_count = 1;
    input.monitoringReadiness!.summary.scale_up_execution_mode = 'monitor_only';
    input.monitoringReadiness!.summary.safe_actions_available = [
      'pause_campaign',
      'pause_ad_group',
      'reduce_campaign_budget',
      'monitor_only',
    ];
    input.monitoringReadiness!.blockers = [
      'active_incident.ADSINC-google-ads-rate-limit-20260704',
    ];

    const response = service.build(input);

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'ready_for_future_executor_local_only',
      safe_reduction_or_pause_actions_available: 1,
      execution_allowed_now: false,
      future_live_execution_allowed: false,
    }));
    expect(response.linkageRecords[0]).toEqual(expect.objectContaining({
      action_type: 'pause_campaign',
      recommendation: 'safety_action_available_local_only',
      blockers: [],
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(response.linkageRecords[0].gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'monitoring_safety_action_available',
        status: 'passed',
      }),
    ]));
    expect(response.linkageRecords[0].monitoringEvidenceSnapshot).toEqual(expect.objectContaining({
      monitoring_healthy: false,
      active_incident_blocking_count: 1,
      safe_actions_available: expect.arrayContaining(['pause_campaign', 'monitor_only']),
    }));
    expect(response.linkageRecords[0].rollbackReadiness).toEqual(expect.objectContaining({
      status: 'ready',
      rollback_action_type: 'restore_campaign_status',
      rollback_plan: expect.objectContaining({
        restoreStatus: 'ENABLED',
        campaignId: '1001',
      }),
    }));
  });

  it('does not fall back to campaignId or adGroupId when campaignBudgetId is missing', () => {
    const input = fixture();
    const record = input.approvalEvidenceIndex.executionPreflightDryRunRecords[0];
    record.identifiers.campaignId = '1001';
    record.identifiers.adGroupId = '2001';
    record.identifiers.campaignBudgetId = null;
    record.identifiers.campaignBudgetResourceName = null;
    record.source_pending_approval.typedPayload.campaignBudgetId = null;
    record.source_validateOnly_plan!.campaignBudgetId = '1001';
    record.source_validateOnly_plan!.campaignBudgetResourceName = 'customers/1234567890/campaignBudgets/1001';
    input.approvalEvidenceIndex.validateOnlyEvidenceRecords[0].campaignBudgetId = '1001';
    input.approvalEvidenceIndex.validateOnlyEvidenceRecords[0].campaignBudgetResourceName =
      'customers/1234567890/campaignBudgets/1001';

    const response = service.build(input);

    expect(response.linkageRecords[0].recommendation).toBe('monitor_only');
    expect(response.linkageRecords[0].sourceExecutionRecord.identifiers).toEqual(expect.objectContaining({
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: null,
      campaignBudgetResourceName: null,
    }));
    expect(response.linkageRecords[0].sourceExecutionRecord.identifiers.campaignBudgetId)
      .not.toBe(response.linkageRecords[0].sourceExecutionRecord.identifiers.campaignId);
    expect(response.linkageRecords[0].sourceExecutionRecord.identifiers.campaignBudgetId)
      .not.toBe(response.linkageRecords[0].sourceExecutionRecord.identifiers.adGroupId);
    expect(response.linkageRecords[0].blockers).toEqual(expect.arrayContaining([
      'campaignBudgetId',
      'rollback_readiness',
    ]));
    expect(response.linkageRecords[0].rollbackReadiness.missing_identifiers)
      .toEqual(['campaignBudgetId']);
    expect(response.linkageRecords[0].campaignBudgetId_fallback_used).toBe(false);
  });

  it('blocks unsafe idempotency evidence while preserving no-provider/no-live flags', () => {
    const input = fixture();
    input.approvalEvidenceIndex.executionPreflightDryRunRecords[0].idempotency_key =
      'unsafe idempotency whitespace';

    const response = service.build(input);

    expect(response.summary.status).toBe('blocked');
    expect(response.linkageRecords[0].blockers).toEqual(expect.arrayContaining([
      'idempotency_keys_safe',
    ]));
    expect(response.linkageRecords[0]).toEqual(expect.objectContaining({
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      future_live_execution_allowed: false,
    }));
    expect(response.safety).toEqual(expect.objectContaining({
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
  });

  function fixture(): AdsAutomationPolicyDecisionAuditLinkageInput {
    return JSON.parse(JSON.stringify(ADS_AUTOMATION_POLICY_DECISION_AUDIT_LINKAGE_FIXTURE));
  }

  function pauseCampaignFixture(): AdsAutomationPolicyDecisionAuditLinkageInput {
    const input = fixture();
    const approvalId = 'ADSAPPROVAL-ads_policy_linkage_demo_pause_campaign';
    const executionRecordId = 'ADSEXEC-DRYRUN-ads_policy_linkage_demo_pause_campaign-REQ-DEMO';
    const validationId = 'ADSPROVIDERVALIDATE-ads_policy_linkage_demo_pause_campaign';
    const policyDecisionId = 'ADSPOLICY-ads_policy_linkage_demo_pause_campaign';
    const pendingActionId = 'ADSPENDINGACTION-ads_policy_linkage_demo_pause_campaign';
    input.approvalId = approvalId;
    input.approvalEvidenceIndex.query.approval_id = approvalId;
    input.approvalEvidenceIndex.links.execution_record_ids = [executionRecordId];
    input.approvalEvidenceIndex.links.validateOnly_validation_ids_from_preflight = [validationId];
    input.approvalEvidenceIndex.links.validateOnly_validation_ids_with_evidence = [validationId];
    input.approvalEvidenceIndex.links.policy_decision_ids_from_preflight = [policyDecisionId];
    input.approvalEvidenceIndex.links.policy_decision_ids_with_evidence = [policyDecisionId];

    const validateOnlyEvidence = input.approvalEvidenceIndex.validateOnlyEvidenceRecords[0];
    validateOnlyEvidence.validation_id = validationId;
    validateOnlyEvidence.pending_action_id = pendingActionId;
    validateOnlyEvidence.approval_id = approvalId;
    validateOnlyEvidence.action_type = 'pause_campaign';
    validateOnlyEvidence.resource_type = 'campaign';
    validateOnlyEvidence.entity_type = 'campaign';
    validateOnlyEvidence.entity_id = '1001';
    validateOnlyEvidence.campaignBudgetId = null;
    validateOnlyEvidence.campaignBudgetResourceName = null;
    validateOnlyEvidence.requested_change = {
      action_type: 'pause_campaign',
      customerId: '1234567890',
      campaignId: '1001',
      targetStatus: 'PAUSED',
      previousStatus: 'ENABLED',
      rollbackPlan: 'Restore previous campaign status from ERP synced read model.',
    };
    validateOnlyEvidence.before_state_snapshot.campaignBudgetId = null;
    validateOnlyEvidence.before_state_snapshot.campaignBudgetResourceName = null;
    validateOnlyEvidence.before_state_snapshot.snapshot = {
      status: 'ENABLED',
      syncedAt: '2026-07-04T06:05:00.000Z',
    };
    validateOnlyEvidence.source_pending_action = {
      pending_action_id: pendingActionId,
      source_decision_id: 'DEC-pause_campaign-1001',
    } as any;

    const policyEvidence = input.approvalEvidenceIndex.policyDecisionEvidenceRecords[0];
    policyEvidence.policy_decision_id = policyDecisionId;
    policyEvidence.approval_id = approvalId;

    const record = input.approvalEvidenceIndex.executionPreflightDryRunRecords[0];
    record.execution_record_id = executionRecordId;
    record.idempotency_key = 'ads-execution-preflight:demo:pause-campaign:REQ-DEMO';
    record.approval_id = approvalId;
    record.source_decision_id = 'DEC-pause_campaign-1001';
    record.action_type = 'pause_campaign';
    record.resource_type = 'campaign';
    record.entity_type = 'campaign';
    record.entity_id = '1001';
    record.validateOnly_validation_id = validationId;
    record.policy_decision_id = policyDecisionId;
    record.requested_change = {
      action_type: 'pause_campaign',
      targetStatus: 'PAUSED',
      previousStatus: 'ENABLED',
    };
    record.identifiers = {
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: null,
      campaignBudgetId: null,
      campaignBudgetResourceName: null,
    };
    record.source_pending_approval.approval_id = approvalId;
    record.source_pending_approval.source_decision_id = 'DEC-pause_campaign-1001';
    record.source_pending_approval.idempotency_key = 'ads-draft:demo:pause-campaign';
    record.source_pending_approval.action_type = 'pause_campaign';
    record.source_pending_approval.resource_type = 'campaign';
    record.source_pending_approval.entity_type = 'campaign';
    record.source_pending_approval.entity_id = '1001';
    record.source_pending_approval.typedPayload = {
      customerId: '1234567890',
      campaignId: '1001',
      targetStatus: 'PAUSED',
      previousStatus: 'ENABLED',
    };
    record.source_pending_approval.source_evidence_references = [{
      decision_id: 'DEC-pause_campaign-1001',
      rollback_plan: 'Restore previous campaign status from ERP synced read model.',
    }] as any;
    record.source_validateOnly_plan = JSON.parse(JSON.stringify(validateOnlyEvidence)) as any;

    input.auditRecords![0].audit_id = 'ADSAUDIT-ads_policy_linkage_demo_pause_campaign-approve-REQ-DEMO';
    input.auditRecords![0].approval_id = approvalId;
    input.auditRecords![0].source_decision_id = 'DEC-pause_campaign-1001';
    input.auditRecords![0].action_type = 'pause_campaign';
    input.auditRecords![0].resource_type = 'campaign';
    input.auditRecords![0].entity_type = 'campaign';
    input.auditRecords![0].entity_id = '1001';

    input.lossLimitPolicy!.summary.all_safe_for_increase = false;
    input.lossLimitPolicy!.summary.policy_allowed_for_requested_action = false;
    input.lossLimitPolicy!.summary.requested_action_type = 'update_campaign_budget';
    input.lossLimitPolicy!.scaleBlockers = ['daily_loss_limit_breached'];
    input.lossLimitPolicy!.safeActionsAvailable = ['pause_campaign', 'monitor_only'];
    return input;
  }
});
