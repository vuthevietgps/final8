import { BadRequestException, Injectable } from '@nestjs/common';
import type { AdsAutomationApprovalEvidenceIndexResponse } from './contracts/ads-automation-approval-evidence-index.contract';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './contracts/ads-automation-decision-draft-approval.contract';
import type { AdsAutomationDecisionDraftActionType } from './contracts/ads-automation-decision-draft-preview.contract';
import type {
  AdsAutomationExecutionPreflightDryRunRecord,
} from './contracts/ads-automation-execution-preflight-dry-run.contract';
import type { AdsAutomationLossLimitPolicyResponse } from './contracts/ads-automation-loss-limit-policy.contract';
import type {
  AdsAutomationMonitoringIncidentReadinessResponse,
} from './contracts/ads-automation-monitoring-incident-readiness.contract';
import type {
  AdsAutomationPolicyDecisionAuditLinkageGate,
  AdsAutomationPolicyDecisionAuditLinkageHumanApprovalEvidence,
  AdsAutomationPolicyDecisionAuditLinkageInput,
  AdsAutomationPolicyDecisionMonitoringEvidenceSnapshot,
  AdsAutomationPolicyDecisionAuditLinkagePolicySnapshot,
  AdsAutomationPolicyDecisionAuditLinkageRecommendation,
  AdsAutomationPolicyDecisionAuditLinkageRecord,
  AdsAutomationPolicyDecisionAuditLinkageResponse,
  AdsAutomationPolicyDecisionRollbackReadiness,
} from './contracts/ads-automation-policy-decision-audit-linkage.contract';
import type { AdsAutomationPolicyDecisionEvidenceRecord } from './contracts/ads-automation-policy-decision-evidence.contract';
import type {
  AdsAutomationProviderValidateOnlyActionPlan,
  AdsAutomationProviderValidateOnlyBeforeStateSnapshot,
} from './contracts/ads-automation-provider-validate-only.contract';
import type { AdsAutomationValidateOnlyEvidenceRecord } from './contracts/ads-automation-validate-only-evidence.contract';

const SUPPORTED_ROLLBACK_ACTIONS: AdsAutomationDecisionDraftActionType[] = [
  'update_campaign_budget',
  'pause_campaign',
  'pause_ad_group',
];

const REQUIRED_SCALE_SOURCE_KEYS = [
  'google_ads',
  'advertising_costs',
  'product_mapping',
  'inventory_profit',
  'supplier_safety',
];

@Injectable()
export class AdsAutomationPolicyDecisionAuditLinkageService {
  build(
    input: AdsAutomationPolicyDecisionAuditLinkageInput,
  ): AdsAutomationPolicyDecisionAuditLinkageResponse {
    const generatedAt = new Date().toISOString();
    const index = this.approvalEvidenceIndex(input?.approvalEvidenceIndex);
    const approvalId = this.requiredText(
      input.approvalId || index.query?.approval_id,
      'approvalId',
    );
    const indexApprovalId = this.requiredText(index.query?.approval_id, 'approvalEvidenceIndex.query.approval_id');
    if (approvalId !== indexApprovalId) {
      throw new BadRequestException('approvalId must match approvalEvidenceIndex.query.approval_id');
    }

    const monitoringReadiness = this.monitoringReadiness(input.monitoringReadiness || null);
    const auditRecords = this.auditRecords(input.auditRecords || [], approvalId);
    const linkageRecords = (index.executionPreflightDryRunRecords || [])
      .filter((record) => record.approval_id === approvalId)
      .map((record) => this.linkageRecord(
        record,
        index,
        auditRecords,
        input.lossLimitPolicy || null,
        monitoringReadiness,
      ));
    const missingPreflightBlockers = linkageRecords.length ? [] : ['execution_preflight_record_missing'];
    const blockers = this.unique([
      ...missingPreflightBlockers,
      ...linkageRecords.flatMap((record) => record.blockers),
    ]);
    const blockedRecords = linkageRecords.filter((record) => record.blockers.length > 0).length;

    return {
      schemaVersion: 'ads_automation_policy_decision_audit_linkage.v1',
      generatedAt,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        in_memory_only: true,
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
        supported_rollback_actions_limited_to_update_budget_pause_campaign_pause_ad_group: true,
      },
      summary: {
        status: blockers.length ? 'blocked' : 'ready_for_future_executor_local_only',
        approval_id: approvalId,
        reportDate: this.text(input.reportDate),
        execution_records_received: linkageRecords.length,
        linked_records_ready: linkageRecords.length - blockedRecords,
        blocked_records: blockedRecords,
        monitor_only_downgrades: linkageRecords
          .filter((record) => record.recommendation === 'monitor_only').length,
        rollback_ready_records: linkageRecords
          .filter((record) => record.rollbackReadiness.status === 'ready').length,
        rollback_blocked_records: linkageRecords
          .filter((record) => record.rollbackReadiness.status === 'blocked').length,
        policy_decision_records_linked: linkageRecords
          .filter((record) => Boolean(record.linkedPolicyDecisionEvidence)).length,
        validateOnly_records_linked: linkageRecords
          .filter((record) => Boolean(record.linkedValidateOnlyEvidence)).length,
        audit_records_linked: linkageRecords
          .filter((record) => Boolean(record.linkedAuditRecord)).length,
        pending_action_ids_linked: linkageRecords
          .filter((record) => Boolean(record.pending_action_id)).length,
        human_approval_records_linked: linkageRecords
          .filter((record) => record.humanApprovalEvidence.human_approval_present).length,
        monitoring_ready_records: linkageRecords
          .filter((record) => record.monitoringEvidenceSnapshot.monitoring_healthy === true).length,
        monitoring_blocked_records: linkageRecords
          .filter((record) => record.monitoringEvidenceSnapshot.blockers.length > 0).length,
        active_incident_blocked_records: linkageRecords
          .filter((record) => (record.monitoringEvidenceSnapshot.active_incident_blocking_count || 0) > 0).length,
        safe_reduction_or_pause_actions_available: linkageRecords
          .filter((record) => record.recommendation === 'safety_action_available_local_only').length,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        future_live_execution_allowed: false,
        production_ready: false,
        next_required_action: blockers.length
          ? 'resolve_policy_decision_audit_or_rollback_blockers'
          : 'inspect_policy_decision_audit_linkage',
      },
      linkageRecords,
      blockers,
      markdownPreview: this.markdownPreview(approvalId, linkageRecords, blockers),
    };
  }

  private linkageRecord(
    executionRecord: AdsAutomationExecutionPreflightDryRunRecord,
    index: AdsAutomationApprovalEvidenceIndexResponse,
    auditRecords: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[],
    lossLimitPolicy: AdsAutomationLossLimitPolicyResponse | null,
    monitoringReadiness: AdsAutomationMonitoringIncidentReadinessResponse | null,
  ): AdsAutomationPolicyDecisionAuditLinkageRecord {
    const validateOnlyEvidence = this.validateOnlyEvidence(executionRecord, index);
    const policyDecisionEvidence = this.policyDecisionEvidence(executionRecord, index);
    const auditRecord = this.auditRecord(executionRecord, auditRecords);
    const validationPlan = executionRecord.source_validateOnly_plan;
    const pendingActionId = this.text(validationPlan?.pending_action_id)
      || this.text(validationPlan?.source_pending_action?.pending_action_id);
    const sourcePendingActionDecisionId = this.text(validationPlan?.source_pending_action?.source_decision_id);
    const approvalSnapshot = executionRecord.source_pending_approval;
    const gates: AdsAutomationPolicyDecisionAuditLinkageGate[] = [];
    const blockers: string[] = [];
    const addGate = (key: string, valid: boolean, detail: string, blocker = key) => {
      gates.push({ key, status: valid ? 'passed' : 'blocked', detail });
      if (!valid) blockers.push(blocker);
    };

    const rollbackReadiness = this.rollbackReadiness(executionRecord, validationPlan);
    const policySnapshot = this.policySnapshot(policyDecisionEvidence, lossLimitPolicy);
    const humanApprovalEvidence = this.humanApprovalEvidence(executionRecord, auditRecord);
    const monitoringEvidenceSnapshot = this.monitoringEvidenceSnapshot(monitoringReadiness);
    const monitoringReadinessForIncrease = this.monitoringReadyForIncrease(
      monitoringReadiness,
      executionRecord,
      policyDecisionEvidence,
      validateOnlyEvidence,
      lossLimitPolicy,
      rollbackReadiness,
    );
    const sourceScaleReadiness = this.sourceScaleReadiness(executionRecord, index);
    const lossPolicyReadiness = this.lossPolicyReadyForIncrease(executionRecord, lossLimitPolicy);
    const localPreflightBlockers = this.localPreflightBlockers(executionRecord);

    addGate(
      'supported_mvp_action_type',
      SUPPORTED_ROLLBACK_ACTIONS.includes(executionRecord.action_type),
      'Rollback readiness is limited to update_campaign_budget, pause_campaign, and pause_ad_group.',
    );
    addGate(
      'pending_action_id_linked',
      Boolean(pendingActionId)
        && pendingActionId === this.text(validateOnlyEvidence?.pending_action_id),
      'Preflight, validate-only evidence, and source pending action must share pending_action_id.',
    );
    addGate(
      'source_decision_id_linked',
      Boolean(this.text(executionRecord.source_decision_id))
        && executionRecord.source_decision_id === this.text(approvalSnapshot?.source_decision_id)
        && (!sourcePendingActionDecisionId || sourcePendingActionDecisionId === executionRecord.source_decision_id),
      'Source decision id must correlate across preflight, pending approval, and pending action evidence.',
    );
    addGate(
      'policy_decision_id_linked',
      Boolean(policyDecisionEvidence)
        && policyDecisionEvidence?.policy_decision_id === executionRecord.policy_decision_id
        && policyDecisionEvidence?.approval_id === executionRecord.approval_id,
      'Preflight policy_decision_id must resolve to durable ERP-local policy evidence for the same approval.',
    );
    addGate(
      'policy_decision_allowed',
      executionRecord.policy_allowed === true
        && policyDecisionEvidence?.policy_allowed === true
        && !this.arrayText(policyDecisionEvidence?.blockers).length,
      'ERP policy evidence must explicitly allow the action and carry no blockers.',
    );
    addGate(
      'validateOnly_preflight_linked',
      Boolean(validateOnlyEvidence)
        && validateOnlyEvidence?.validation_id === executionRecord.validateOnly_validation_id
        && validateOnlyEvidence?.approval_id === executionRecord.approval_id,
      'Preflight validateOnly id must resolve to durable ERP-local validate-only evidence for the same approval.',
    );
    addGate(
      'validateOnly_ready',
      executionRecord.validateOnly_evidence_persisted === true
        && executionRecord.validateOnly_status === 'validate_only_passed'
        && validateOnlyEvidence?.status === 'validate_only_passed'
        && validateOnlyEvidence?.providerValidationStatus === 'provider_validate_passed'
        && validateOnlyEvidence?.approval_can_be_considered_executable === true,
      'Validate-only evidence must be persisted, passed, and executable only in future gated flow.',
    );
    addGate(
      'human_approval_audit_correlated',
      humanApprovalEvidence.human_approval_present,
      'A status-changing approve audit record with reviewer and reason must correlate to the approved preflight record.',
    );
    addGate(
      'idempotency_keys_safe',
      this.safeIdempotencyKey(executionRecord.idempotency_key)
        && this.safeIdempotencyKey(approvalSnapshot?.idempotency_key)
        && this.safeIdempotencyKey(policyDecisionEvidence?.idempotency_key)
        && this.safeIdempotencyKey(validateOnlyEvidence?.idempotency_key),
      'Execution, approval, policy, and validate-only idempotency keys must be present and safe.',
    );
    addGate(
      'preflight_record_persisted',
      executionRecord.preflight_record_persisted === true
        && executionRecord.persistence_used === true
        && executionRecord.erp_local_persistence_used === true
        && executionRecord.provider_persistence_used === false,
      'Dry-run preflight evidence must be persisted in ERP-local storage only.',
    );
    addGate(
      'preflight_local_blockers_clear',
      localPreflightBlockers.length === 0,
      localPreflightBlockers.length
        ? `Local preflight blockers remain: ${localPreflightBlockers.join(', ')}.`
        : 'Only global production enablement and the unimplemented live executor may remain closed in this local-only report.',
    );
    addGate(
      'provider_and_live_flags_closed',
      this.providerAndLiveFlagsClosed(
        executionRecord,
        validateOnlyEvidence,
        policyDecisionEvidence,
        auditRecord,
        monitoringReadiness,
      ),
      'No provider API, Google Ads API, validateOnly provider call, live execution, or ERP/payment mutation flags may be true.',
    );
    addGate(
      'rollback_readiness',
      rollbackReadiness.status === 'ready',
      rollbackReadiness.status === 'ready'
        ? 'Rollback evidence is ready for this MVP action.'
        : `Rollback evidence is blocked: ${rollbackReadiness.blockers.join(', ')}.`,
    );

    if (executionRecord.action_type === 'update_campaign_budget') {
      addGate(
        'campaignBudgetId_no_fallback',
        Boolean(this.text(executionRecord.identifiers?.campaignBudgetId))
          && Boolean(this.text(approvalSnapshot?.typedPayload?.campaignBudgetId))
          && this.text(executionRecord.identifiers?.campaignBudgetId)
            === this.text(approvalSnapshot?.typedPayload?.campaignBudgetId),
        'Budget updates require campaignBudgetId from the approved ERP payload; campaignId/adGroupId are never fallback identifiers.',
        'campaignBudgetId',
      );
      addGate(
        'fresh_source_import_evidence',
        sourceScaleReadiness.ready,
        sourceScaleReadiness.ready
          ? 'Fresh source/import evidence is linked for increase-budget review.'
          : `Source/import evidence blocks increase-budget review: ${sourceScaleReadiness.blockers.join(', ')}.`,
      );
      addGate(
        'loss_limit_policy_safe_for_increase',
        lossPolicyReadiness.ready,
        lossPolicyReadiness.ready
          ? 'Loss-limit and spend-cap policy evidence is safe for the requested increase.'
          : `Loss-limit policy blocks increase: ${lossPolicyReadiness.blockers.join(', ')}.`,
      );
      addGate(
        'monitoring_health_safe_for_increase',
        monitoringReadinessForIncrease.ready,
        monitoringReadinessForIncrease.ready
          ? 'Monitoring health, rate-limit budget, import freshness, validate-only/preflight alerts, operator acknowledgements, and active incident evidence are safe for increase-budget review.'
          : `Monitoring evidence blocks increase: ${monitoringReadinessForIncrease.blockers.join(', ')}.`,
      );
    } else if (executionRecord.action_type === 'pause_campaign' || executionRecord.action_type === 'pause_ad_group') {
      addGate(
        'pause_or_reduce_safety_action_available',
        rollbackReadiness.status === 'ready',
        'Pause/reduce safety actions remain available when scale-up is unsafe, subject to approval, validate-only, preflight, idempotency, and rollback evidence.',
      );
      addGate(
        'monitoring_safety_action_available',
        this.monitoringSafetyActionAvailable(monitoringReadiness, executionRecord.action_type),
        'Monitoring incidents, stale imports, rate-limit pressure, and failed validation/preflight alerts must preserve pause/reduce/monitor-only safety actions.',
      );
    }

    const uniqueBlockers = this.unique(blockers);
    const recommendation = this.recommendation(executionRecord, uniqueBlockers);

    return {
      audit_correlation_id: this.auditCorrelationId(
        executionRecord.approval_id,
        pendingActionId,
        executionRecord.policy_decision_id,
        auditRecord?.audit_id || executionRecord.execution_record_id,
      ),
      approval_id: executionRecord.approval_id,
      execution_record_id: executionRecord.execution_record_id,
      pending_action_id: pendingActionId,
      source_decision_id: this.text(executionRecord.source_decision_id),
      policy_decision_id: this.text(executionRecord.policy_decision_id),
      validateOnly_validation_id: this.text(executionRecord.validateOnly_validation_id),
      audit_id: this.text(auditRecord?.audit_id),
      action_type: executionRecord.action_type,
      recommendation,
      policyEvaluationSnapshot: policySnapshot,
      humanApprovalEvidence,
      monitoringEvidenceSnapshot,
      rollbackReadiness,
      gates,
      blockers: uniqueBlockers,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      future_live_execution_allowed: false,
      campaignBudgetId_fallback_used: false,
      sourceExecutionRecord: this.cloneJson(executionRecord),
      linkedPolicyDecisionEvidence: policyDecisionEvidence ? this.cloneJson(policyDecisionEvidence) : null,
      linkedValidateOnlyEvidence: validateOnlyEvidence ? this.cloneJson(validateOnlyEvidence) : null,
      linkedAuditRecord: auditRecord ? this.cloneJson(auditRecord) : null,
    };
  }

  private recommendation(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    blockers: string[],
  ): AdsAutomationPolicyDecisionAuditLinkageRecommendation {
    if (record.action_type === 'update_campaign_budget') {
      return blockers.length ? 'monitor_only' : 'pending_future_executor_local_only';
    }
    if (record.action_type === 'pause_campaign' || record.action_type === 'pause_ad_group') {
      return blockers.length ? 'blocked_before_future_executor' : 'safety_action_available_local_only';
    }
    return blockers.length ? 'blocked_before_future_executor' : 'monitor_only';
  }

  private rollbackReadiness(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    validationPlan: AdsAutomationProviderValidateOnlyActionPlan | null,
  ): AdsAutomationPolicyDecisionRollbackReadiness {
    const supported = SUPPORTED_ROLLBACK_ACTIONS.includes(record.action_type);
    const snapshot = validationPlan?.before_state_snapshot || null;
    const snapshotBody = snapshot?.snapshot && typeof snapshot.snapshot === 'object'
      ? snapshot.snapshot
      : null;
    const rollbackPlanText = this.rollbackPlanText(record.source_pending_approval, validationPlan);
    const requiredIdentifiers = this.rollbackRequiredIdentifiers(record.action_type);
    const missingIdentifiers = requiredIdentifiers.filter((key) => !this.text((record.identifiers as any)?.[key]));
    const blockers: string[] = [];
    const evidence: string[] = [];

    if (!supported) blockers.push('unsupported_rollback_action_type');
    if (missingIdentifiers.length) blockers.push(...missingIdentifiers);
    if (!snapshotBody) blockers.push('before_state_snapshot_missing');
    if (!rollbackPlanText) blockers.push('rollback_plan_missing');

    const plan: Record<string, unknown> = {
      provider_boundary_mode: 'erp_local_readiness_only',
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      approval_id: record.approval_id,
      execution_record_id: record.execution_record_id,
      rollback_reason: rollbackPlanText || null,
    };
    let rollbackActionType: AdsAutomationPolicyDecisionRollbackReadiness['rollback_action_type'] = 'not_applicable';

    if (record.action_type === 'update_campaign_budget') {
      rollbackActionType = 'restore_campaign_budget';
      const previousBudget = this.numberOrNull(record.source_pending_approval?.typedPayload?.currentBudgetVnd)
        ?? this.numberOrNull(validationPlan?.requested_change?.currentBudgetVnd)
        ?? this.numberOrNull((snapshotBody as any)?.currentDailyBudgetVnd)
        ?? this.numberOrNull((snapshotBody as any)?.previousDailyBudgetVnd)
        ?? this.numberOrNull((snapshotBody as any)?.amountVnd)
        ?? this.numberOrNull((snapshotBody as any)?.budgetAmountMicros);
      if (previousBudget === null) blockers.push('previous_campaign_budget_missing');
      Object.assign(plan, {
        rollback_action_type: rollbackActionType,
        customerId: record.identifiers.customerId,
        campaignBudgetId: record.identifiers.campaignBudgetId,
        campaignBudgetResourceName: record.identifiers.campaignBudgetResourceName,
        restoreDailyBudgetVnd: previousBudget,
      });
      evidence.push('Rollback restores the ERP-synced campaign budget value captured before the proposed increase.');
    } else if (record.action_type === 'pause_campaign') {
      rollbackActionType = 'restore_campaign_status';
      const previousStatus = this.text((snapshotBody as any)?.status)
        || this.text(validationPlan?.requested_change?.previousStatus)
        || this.text(record.source_pending_approval?.typedPayload?.previousStatus);
      if (!previousStatus) blockers.push('previous_campaign_status_missing');
      Object.assign(plan, {
        rollback_action_type: rollbackActionType,
        customerId: record.identifiers.customerId,
        campaignId: record.identifiers.campaignId,
        restoreStatus: previousStatus,
      });
      evidence.push('Rollback restores the ERP-synced campaign status captured before the pause.');
    } else if (record.action_type === 'pause_ad_group') {
      rollbackActionType = 'restore_ad_group_status';
      const previousStatus = this.text((snapshotBody as any)?.status)
        || this.text(validationPlan?.requested_change?.previousStatus)
        || this.text(record.source_pending_approval?.typedPayload?.previousStatus);
      if (!previousStatus) blockers.push('previous_ad_group_status_missing');
      Object.assign(plan, {
        rollback_action_type: rollbackActionType,
        customerId: record.identifiers.customerId,
        adGroupId: record.identifiers.adGroupId,
        restoreStatus: previousStatus,
      });
      evidence.push('Rollback restores the ERP-synced ad group status captured before the pause.');
    }

    const uniqueBlockers = this.unique(blockers);
    return {
      action_type: record.action_type,
      supported_mvp_action: supported,
      status: uniqueBlockers.length ? 'blocked' : 'ready',
      rollback_plan_id: supported
        ? `ADSROLLBACK-${this.safeKey(record.approval_id)}-${this.safeKey(record.execution_record_id)}`
        : null,
      rollback_action_type: rollbackActionType,
      before_state_snapshot_status: this.text(snapshot?.snapshot_status),
      before_state_source: this.text(snapshot?.source),
      before_state_snapshot_present: Boolean(snapshotBody),
      rollback_plan_present: Boolean(rollbackPlanText),
      required_identifiers: requiredIdentifiers,
      missing_identifiers: missingIdentifiers,
      rollback_plan: uniqueBlockers.length ? null : plan,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      evidence: [
        ...evidence,
        'Rollback readiness is evidence-only and does not build or submit provider operations.',
      ],
      blockers: uniqueBlockers,
    };
  }

  private rollbackRequiredIdentifiers(actionType: AdsAutomationDecisionDraftActionType): string[] {
    if (actionType === 'update_campaign_budget') return ['customerId', 'campaignBudgetId'];
    if (actionType === 'pause_campaign') return ['customerId', 'campaignId'];
    if (actionType === 'pause_ad_group') return ['customerId', 'adGroupId'];
    return [];
  }

  private rollbackPlanText(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord,
    validationPlan: AdsAutomationProviderValidateOnlyActionPlan | null,
  ): string | null {
    const fromEvidence = (approval.source_evidence_references || [])
      .map((reference: any) => this.text(reference?.rollback_plan))
      .find(Boolean);
    return fromEvidence
      || this.text(approval.typedPayload?.rollbackPlan)
      || this.text(validationPlan?.requested_change?.rollbackPlan);
  }

  private sourceScaleReadiness(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    index: AdsAutomationApprovalEvidenceIndexResponse,
  ): { ready: boolean; blockers: string[] } {
    const approval = record.source_pending_approval || index.pendingApproval;
    const evidence = approval?.sourceSyncDecisionEvidence || index.sourceSyncDecisionEvidence || [];
    const gates = approval?.sourceSyncDecisionGates || index.sourceSyncDecisionGates || null;
    const evidenceByKey = new Map(evidence.map((item: any) => [this.text(item.sourceKey), item]));
    const blockers: string[] = [];

    for (const sourceKey of REQUIRED_SCALE_SOURCE_KEYS) {
      const item = evidenceByKey.get(sourceKey);
      if (!item) {
        blockers.push(`${sourceKey}_source_evidence_missing`);
        continue;
      }
      if (item.canUseForAdsAutomationDecision !== true) {
        blockers.push(`${sourceKey}_not_ready`);
      }
      blockers.push(...this.arrayText(item.blockingReasons).map((reason) => `${sourceKey}.${reason}`));
      const blockingReason = this.text(item.blockingReason);
      if (blockingReason) blockers.push(`${sourceKey}.${blockingReason}`);
    }

    if (gates?.canGenerateActionDraft === false) blockers.push('source_sync_gate_canGenerateActionDraft_false');
    if (gates?.canUseGoogleAdsDataClaim === false) blockers.push('source_sync_gate_canUseGoogleAdsDataClaim_false');

    return {
      ready: blockers.length === 0,
      blockers: this.unique(blockers),
    };
  }

  private lossPolicyReadyForIncrease(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    lossLimitPolicy: AdsAutomationLossLimitPolicyResponse | null,
  ): { ready: boolean; blockers: string[] } {
    if (record.action_type !== 'update_campaign_budget') {
      return { ready: true, blockers: [] };
    }
    if (!lossLimitPolicy) {
      return { ready: false, blockers: ['loss_limit_policy_missing'] };
    }

    const summary = lossLimitPolicy.summary;
    const blockers = [
      ...(summary.requested_action_type === 'update_campaign_budget' ? [] : ['loss_limit_policy_action_mismatch']),
      ...(summary.policy_allowed_for_requested_action ? [] : ['loss_limit_policy_requested_action_blocked']),
      ...(summary.all_safe_for_increase ? [] : ['loss_limit_policy_not_all_safe_for_increase']),
      ...(summary.human_approval_present ? [] : ['loss_limit_policy_human_approval_missing']),
      ...(summary.campaignBudgetId_missing ? ['loss_limit_policy_campaignBudgetId_missing'] : []),
      ...this.arrayText(lossLimitPolicy.scaleBlockers).map((blocker) => `loss_limit_policy.${blocker}`),
    ];

    return {
      ready: blockers.length === 0,
      blockers: this.unique(blockers),
    };
  }

  private monitoringReadyForIncrease(
    monitoringReadiness: AdsAutomationMonitoringIncidentReadinessResponse | null,
    executionRecord: AdsAutomationExecutionPreflightDryRunRecord,
    policyDecisionEvidence: AdsAutomationPolicyDecisionEvidenceRecord | null,
    validateOnlyEvidence: AdsAutomationValidateOnlyEvidenceRecord | null,
    lossLimitPolicy: AdsAutomationLossLimitPolicyResponse | null,
    rollbackReadiness: AdsAutomationPolicyDecisionRollbackReadiness,
  ): { ready: boolean; blockers: string[] } {
    if (!monitoringReadiness) {
      return {
        ready: false,
        blockers: ['monitoring_readiness_missing'],
      };
    }

    const summary = monitoringReadiness.summary;
    const telemetry = monitoringReadiness.telemetryEvidence;
    const binding = telemetry?.decisionBinding;
    const blockers = [
      ...(summary.monitoring_healthy ? [] : ['monitoring_health_not_healthy']),
      ...(summary.rate_limit_budget_safe ? [] : ['rate_limit_budget_not_safe']),
      ...(summary.spend_rate_safe ? [] : ['spend_rate_not_safe']),
      ...(summary.provider_error_rate_safe ? [] : ['provider_error_rate_not_safe']),
      ...(summary.import_freshness_safe ? [] : ['import_freshness_not_safe']),
      ...(summary.validateOnly_preflight_alerts_clear ? [] : ['validateOnly_preflight_alerts_not_clear']),
      ...(summary.active_incident_blocking_count > 0 ? ['active_incident_blocks_execution'] : []),
      ...(summary.unacknowledged_blocking_alerts > 0 ? ['operator_acknowledgement_missing'] : []),
      ...(telemetry?.durable_telemetry_read_model_used ? [] : ['durable_telemetry_read_model_missing']),
      ...(telemetry?.telemetry_fresh ? [] : ['durable_telemetry_not_fresh']),
      ...(telemetry?.telemetry_complete ? [] : ['durable_telemetry_not_complete']),
      ...(telemetry?.telemetry_trusted ? [] : ['durable_telemetry_not_trusted']),
      ...(telemetry?.policy_decision_linkage_present ? [] : ['durable_telemetry_policy_decision_linkage_missing']),
      ...this.telemetryBindingBlockers({
        binding,
        executionRecord,
        policyDecisionEvidence,
        validateOnlyEvidence,
        lossLimitPolicy,
        rollbackReadiness,
      }),
      ...this.arrayText(monitoringReadiness.blockers).map((blocker) => `monitoring.${blocker}`),
      ...this.arrayText(telemetry?.blockers).map((blocker) => `telemetry.${blocker}`),
    ];

    return {
      ready: blockers.length === 0,
      blockers: this.unique(blockers),
    };
  }

  private monitoringSafetyActionAvailable(
    monitoringReadiness: AdsAutomationMonitoringIncidentReadinessResponse | null,
    actionType: AdsAutomationDecisionDraftActionType,
  ): boolean {
    if (!monitoringReadiness) return true;
    const safeActions = new Set(this.arrayText(monitoringReadiness.summary.safe_actions_available));
    if (actionType === 'pause_campaign') return safeActions.has('pause_campaign') || safeActions.has('monitor_only');
    if (actionType === 'pause_ad_group') return safeActions.has('pause_ad_group') || safeActions.has('monitor_only');
    return safeActions.has('monitor_only');
  }

  private monitoringEvidenceSnapshot(
    monitoringReadiness: AdsAutomationMonitoringIncidentReadinessResponse | null,
  ): AdsAutomationPolicyDecisionMonitoringEvidenceSnapshot {
    if (!monitoringReadiness) {
      return {
        schemaVersion: null,
        telemetry_schemaVersion: null,
        durable_telemetry_read_model_used: null,
        durable_telemetry_fresh: null,
        durable_telemetry_complete: null,
        durable_telemetry_trusted: null,
        durable_telemetry_tied_to_policy_decision: null,
        telemetry_record_count: null,
        telemetry_evidence_record_ids: [],
        telemetry_decision_binding: null,
        monitoring_healthy: null,
        rate_limit_budget_safe: null,
        spend_rate_safe: null,
        provider_error_rate_safe: null,
        import_freshness_safe: null,
        validateOnly_preflight_alerts_clear: null,
        active_incident_blocking_count: null,
        unacknowledged_blocking_alerts: null,
        scale_up_execution_mode: null,
        safe_actions_available: [],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        blockers: ['monitoring_readiness_missing'],
      };
    }

    const summary = monitoringReadiness.summary;
    const telemetry = monitoringReadiness.telemetryEvidence;
    return {
      schemaVersion: monitoringReadiness.schemaVersion,
      telemetry_schemaVersion: telemetry?.schemaVersion || null,
      durable_telemetry_read_model_used: telemetry?.durable_telemetry_read_model_used ?? false,
      durable_telemetry_fresh: telemetry?.telemetry_fresh ?? false,
      durable_telemetry_complete: telemetry?.telemetry_complete ?? false,
      durable_telemetry_trusted: telemetry?.telemetry_trusted ?? false,
      durable_telemetry_tied_to_policy_decision: telemetry?.policy_decision_linkage_present ?? false,
      telemetry_record_count: telemetry?.telemetry_record_count ?? 0,
      telemetry_evidence_record_ids: this.arrayText(telemetry?.telemetry_evidence_record_ids),
      telemetry_decision_binding: telemetry?.decisionBinding || null,
      monitoring_healthy: summary.monitoring_healthy,
      rate_limit_budget_safe: summary.rate_limit_budget_safe,
      spend_rate_safe: summary.spend_rate_safe,
      provider_error_rate_safe: summary.provider_error_rate_safe,
      import_freshness_safe: summary.import_freshness_safe,
      validateOnly_preflight_alerts_clear: summary.validateOnly_preflight_alerts_clear,
      active_incident_blocking_count: summary.active_incident_blocking_count,
      unacknowledged_blocking_alerts: summary.unacknowledged_blocking_alerts,
      scale_up_execution_mode: summary.scale_up_execution_mode,
      safe_actions_available: this.arrayText(summary.safe_actions_available),
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      blockers: this.unique([
        ...this.arrayText(monitoringReadiness.blockers),
        ...this.arrayText(telemetry?.blockers).map((blocker) => `telemetry.${blocker}`),
      ]),
    };
  }

  private telemetryBindingBlockers(input: {
    binding: AdsAutomationMonitoringIncidentReadinessResponse['telemetryEvidence']['decisionBinding'] | undefined;
    executionRecord: AdsAutomationExecutionPreflightDryRunRecord;
    policyDecisionEvidence: AdsAutomationPolicyDecisionEvidenceRecord | null;
    validateOnlyEvidence: AdsAutomationValidateOnlyEvidenceRecord | null;
    lossLimitPolicy: AdsAutomationLossLimitPolicyResponse | null;
    rollbackReadiness: AdsAutomationPolicyDecisionRollbackReadiness;
  }): string[] {
    const binding = input.binding;
    if (!binding) return ['durable_telemetry_decision_binding_missing'];

    const expected: Record<string, string | null> = {
      approvalId: this.text(input.executionRecord.approval_id),
      policyDecisionId: this.text(input.policyDecisionEvidence?.policy_decision_id)
        || this.text(input.executionRecord.policy_decision_id),
      validateOnlyValidationId: this.text(input.validateOnlyEvidence?.validation_id)
        || this.text(input.executionRecord.validateOnly_validation_id),
      executionRecordId: this.text(input.executionRecord.execution_record_id),
      idempotencyKey: this.text(input.executionRecord.idempotency_key),
      rollbackPlanId: this.text(input.rollbackReadiness.rollback_plan_id),
      lossLimitPolicyReportDate: this.text(input.lossLimitPolicy?.reportDate),
      customerId: this.text(input.executionRecord.identifiers?.customerId),
      campaignId: this.text(input.executionRecord.identifiers?.campaignId),
      adGroupId: this.text(input.executionRecord.identifiers?.adGroupId),
      campaignBudgetId: this.text(input.executionRecord.identifiers?.campaignBudgetId),
    };
    const blockers: string[] = [];

    for (const [key, expectedValue] of Object.entries(expected)) {
      const actualValue = this.text((binding as any)[key]);
      if (!actualValue) {
        blockers.push(`durable_telemetry_binding.${key}_missing`);
        continue;
      }
      if (expectedValue && actualValue !== expectedValue) {
        blockers.push(`durable_telemetry_binding.${key}_mismatch`);
      }
    }
    if (binding.campaignBudgetId && (
      binding.campaignBudgetId === binding.campaignId
      || binding.campaignBudgetId === binding.adGroupId
    )) {
      blockers.push('durable_telemetry_binding.campaignBudgetId_no_fallback_violation');
    }

    return this.unique(blockers);
  }

  private humanApprovalEvidence(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    auditRecord: AdsAutomationDecisionDraftApprovalDecisionAuditRecord | null,
  ): AdsAutomationPolicyDecisionAuditLinkageHumanApprovalEvidence {
    const humanApprovalPresent = record.approval_status === 'approved'
      && auditRecord?.decision === 'approve'
      && auditRecord?.proposed_status === 'approved'
      && auditRecord?.status_change_performed === true
      && Boolean(this.text(auditRecord.reviewerUserId))
      && Boolean(this.text(auditRecord.reason));

    return {
      approval_id: record.approval_id,
      approval_status: this.text(record.approval_status),
      audit_id: this.text(auditRecord?.audit_id),
      audit_decision: this.text(auditRecord?.decision),
      audit_status_change_performed: auditRecord?.status_change_performed === true,
      reviewerUserId: this.text(auditRecord?.reviewerUserId),
      reviewerRole: this.text(auditRecord?.reviewerRole),
      reason: this.text(auditRecord?.reason),
      requestId: this.text(auditRecord?.requestId),
      human_approval_present: humanApprovalPresent,
    };
  }

  private policySnapshot(
    policyDecisionEvidence: AdsAutomationPolicyDecisionEvidenceRecord | null,
    lossLimitPolicy: AdsAutomationLossLimitPolicyResponse | null,
  ): AdsAutomationPolicyDecisionAuditLinkagePolicySnapshot {
    return {
      policy_decision_id: this.text(policyDecisionEvidence?.policy_decision_id),
      policy_allowed: policyDecisionEvidence?.policy_allowed === true,
      policy_source: this.text(policyDecisionEvidence?.policy_source),
      policy_blockers: this.arrayText(policyDecisionEvidence?.blockers),
      policy_evaluatedAt: this.text(policyDecisionEvidence?.evaluatedAt),
      policy_decision_record_persisted: policyDecisionEvidence?.policy_decision_record_persisted === true,
      loss_limit_policy_schemaVersion: lossLimitPolicy?.schemaVersion || null,
      loss_limit_policy_all_safe_for_increase: typeof lossLimitPolicy?.summary?.all_safe_for_increase === 'boolean'
        ? lossLimitPolicy.summary.all_safe_for_increase
        : null,
      loss_limit_policy_requested_action_type: this.text(lossLimitPolicy?.summary?.requested_action_type),
      loss_limit_policy_allowed_for_requested_action:
        typeof lossLimitPolicy?.summary?.policy_allowed_for_requested_action === 'boolean'
          ? lossLimitPolicy.summary.policy_allowed_for_requested_action
          : null,
      loss_limit_policy_scale_blockers: this.arrayText(lossLimitPolicy?.scaleBlockers),
      loss_limit_policy_safe_actions_available: this.arrayText(lossLimitPolicy?.safeActionsAvailable),
    };
  }

  private validateOnlyEvidence(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    index: AdsAutomationApprovalEvidenceIndexResponse,
  ): AdsAutomationValidateOnlyEvidenceRecord | null {
    const validationId = this.text(record.validateOnly_validation_id);
    if (!validationId) return null;
    return (index.validateOnlyEvidenceRecords || []).find((evidence) => (
      evidence.validation_id === validationId && evidence.approval_id === record.approval_id
    )) || null;
  }

  private policyDecisionEvidence(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    index: AdsAutomationApprovalEvidenceIndexResponse,
  ): AdsAutomationPolicyDecisionEvidenceRecord | null {
    const policyDecisionId = this.text(record.policy_decision_id);
    if (!policyDecisionId) return null;
    return (index.policyDecisionEvidenceRecords || []).find((evidence) => (
      evidence.policy_decision_id === policyDecisionId && evidence.approval_id === record.approval_id
    )) || null;
  }

  private auditRecord(
    record: AdsAutomationExecutionPreflightDryRunRecord,
    auditRecords: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[],
  ): AdsAutomationDecisionDraftApprovalDecisionAuditRecord | null {
    return auditRecords.find((audit) => (
      audit.approval_id === record.approval_id
      && audit.decision === 'approve'
      && audit.proposed_status === 'approved'
      && audit.status_change_performed === true
    )) || auditRecords.find((audit) => audit.approval_id === record.approval_id) || null;
  }

  private localPreflightBlockers(record: AdsAutomationExecutionPreflightDryRunRecord): string[] {
    return this.arrayText(record.blockers)
      .filter((blocker) => (
        blocker !== 'GOOGLE_ADS_PRODUCTION_ENABLED'
        && blocker !== 'live_path_not_implemented'
      ));
  }

  private providerAndLiveFlagsClosed(
    executionRecord: AdsAutomationExecutionPreflightDryRunRecord,
    validateOnlyEvidence: AdsAutomationValidateOnlyEvidenceRecord | null,
    policyDecisionEvidence: AdsAutomationPolicyDecisionEvidenceRecord | null,
    auditRecord: AdsAutomationDecisionDraftApprovalDecisionAuditRecord | null,
    monitoringReadiness: AdsAutomationMonitoringIncidentReadinessResponse | null,
  ): boolean {
    const records = [
      executionRecord,
      validateOnlyEvidence,
      policyDecisionEvidence,
      auditRecord,
      monitoringReadiness?.summary,
      monitoringReadiness?.telemetryEvidence,
    ]
      .filter(Boolean) as Array<Record<string, any>>;
    return records.every((record) => (
      record.provider_api_called === false
      && record.google_ads_api_called === false
      && record.validateOnly_called === false
      && record.live_ads_execution_used === false
      && record.execution_allowed_now === false
      && record.erp_mutation_used !== true
      && record.payment_mutation_used !== true
      && record.provider_mutation_used !== true
      && record.direct_google_ads_api_call !== true
      && record.live_path_implemented !== true
    ));
  }

  private approvalEvidenceIndex(
    value: AdsAutomationApprovalEvidenceIndexResponse,
  ): AdsAutomationApprovalEvidenceIndexResponse {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('approvalEvidenceIndex is required');
    }
    if (value.schemaVersion !== 'ads_automation_approval_evidence_index.v1') {
      throw new BadRequestException('approvalEvidenceIndex must use ads_automation_approval_evidence_index.v1');
    }
    if (
      value.safety?.provider_api_called !== false
      || value.safety?.google_ads_api_called !== false
      || value.safety?.validateOnly_called !== false
      || value.safety?.live_ads_execution_used !== false
      || value.safety?.execution_allowed_now !== false
    ) {
      throw new BadRequestException('approvalEvidenceIndex must preserve no-provider/no-live safety flags');
    }
    return value;
  }

  private monitoringReadiness(
    value: AdsAutomationMonitoringIncidentReadinessResponse | null,
  ): AdsAutomationMonitoringIncidentReadinessResponse | null {
    if (!value) return null;
    if (value.schemaVersion !== 'ads_automation_monitoring_incident_readiness.v1') {
      throw new BadRequestException('monitoringReadiness must use ads_automation_monitoring_incident_readiness.v1');
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
      || value.telemetryEvidence?.provider_api_called !== false
      || value.telemetryEvidence?.google_ads_api_called !== false
      || value.telemetryEvidence?.validateOnly_called !== false
      || value.telemetryEvidence?.live_ads_execution_used !== false
      || value.telemetryEvidence?.execution_allowed_now !== false
    ) {
      throw new BadRequestException('monitoringReadiness must preserve no-provider/no-live safety flags');
    }
    return value;
  }

  private auditRecords(
    records: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[],
    approvalId: string,
  ): AdsAutomationDecisionDraftApprovalDecisionAuditRecord[] {
    if (!Array.isArray(records)) {
      throw new BadRequestException('auditRecords must be an array');
    }
    return records.filter((record) => this.text(record?.approval_id) === approvalId);
  }

  private auditCorrelationId(
    approvalId: string,
    pendingActionId: string | null,
    policyDecisionId: string | null,
    auditIdentity: string | null,
  ): string {
    return [
      'ADSPOLICYLINK',
      this.safeKey(approvalId),
      this.safeKey(pendingActionId || 'missing-pending-action'),
      this.safeKey(policyDecisionId || 'missing-policy-decision'),
      this.safeKey(auditIdentity || 'missing-audit'),
    ].join('-');
  }

  private markdownPreview(
    approvalId: string,
    records: AdsAutomationPolicyDecisionAuditLinkageRecord[],
    blockers: string[],
  ): string {
    return [
      '# Ads Automation Policy Decision Audit Linkage',
      `Approval: ${approvalId}`,
      `Records: ${records.length}`,
      `Ready records: ${records.filter((record) => record.blockers.length === 0).length}`,
      `Monitor-only downgrades: ${records.filter((record) => record.recommendation === 'monitor_only').length}`,
      `Safety pause/reduce actions available: ${records.filter((record) => record.recommendation === 'safety_action_available_local_only').length}`,
      `Blockers: ${blockers.length ? blockers.join(', ') : 'none'}`,
      'Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false',
    ].join('\n');
  }

  private arrayText(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private requiredText(value: unknown, field: string): string {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private safeIdempotencyKey(value: unknown): boolean {
    const text = this.text(value);
    return Boolean(text && text.length <= 240 && /^[a-z0-9._:-]+$/i.test(text));
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort();
  }

  private safeKey(value: unknown): string {
    return String(value || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 96);
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
