import { BadRequestException, Injectable } from '@nestjs/common';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import type {
  AdsAutomationPendingErpActionNormalizationResponse,
  AdsAutomationPendingErpActionRecord,
  AdsAutomationPendingErpActionType,
} from './contracts/ads-automation-pending-erp-action.contract';
import type {
  AdsAutomationProviderAccountReadinessResponse,
  AdsAutomationProviderRequestedActionReadiness,
} from './contracts/ads-automation-provider-account-readiness.contract';
import type {
  AdsAutomationProviderValidateOnlyActionPlan,
  AdsAutomationProviderValidateOnlyBeforeStateSnapshot,
  AdsAutomationProviderValidateOnlyBoundaryEvidence,
  AdsAutomationProviderValidateOnlyError,
  AdsAutomationProviderValidateOnlyLaneResponse,
  AdsAutomationProviderValidateOnlyMvpActionContract,
  AdsAutomationProviderValidateOnlyMockResult,
  AdsAutomationProviderValidateOnlyMockStatus,
  AdsAutomationProviderValidateOnlyNextAction,
  AdsAutomationProviderValidateOnlyOperationKind,
  AdsAutomationProviderValidateOnlyRequestRecord,
  AdsAutomationProviderValidateOnlyResultRecord,
  AdsAutomationProviderValidateOnlyStatus,
} from './contracts/ads-automation-provider-validate-only.contract';

const PROVIDER_ACTION_TYPES: AdsAutomationPendingErpActionType[] = [
  'update_campaign_budget',
  'pause_campaign',
  'pause_ad_group',
];

const MVP_ACTION_TYPES: AdsAutomationPendingErpActionType[] = [
  ...PROVIDER_ACTION_TYPES,
  'monitor_only',
];

type ProviderResultLookup = Map<string, AdsAutomationProviderValidateOnlyMockResult>;

@Injectable()
export class AdsAutomationProviderValidateOnlyPlannerService {
  planValidateOnlyLane(
    normalization: AdsAutomationPendingErpActionNormalizationResponse,
    mockedProviderResults: AdsAutomationProviderValidateOnlyMockResult[] = [],
    providerAccountReadiness: AdsAutomationProviderAccountReadinessResponse | null = null,
  ): AdsAutomationProviderValidateOnlyLaneResponse {
    this.assertNormalization(normalization);
    const resultsByKey = this.providerResultsByKey(mockedProviderResults);
    const generatedAt = new Date().toISOString();
    const validationPlans = normalization.pendingActions.map((action) => (
      this.toValidationPlan(action, resultsByKey, generatedAt, providerAccountReadiness)
    ));

    return {
      schemaVersion: 'ads_automation_provider_validate_only_lane.v1',
      generatedAt,
      sourceNormalizationSchemaVersion: normalization.schemaVersion,
      sourceNormalizationGeneratedAt: normalization.generatedAt,
      safety: {
        read_only: true,
        dry_run: true,
        in_memory_only: true,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_actions: true,
        approval_can_be_considered_executable_only_after_validateOnly_passed: true,
        execution_allowed_now: false,
        provider_validateOnly_lane_mocked: true,
        no_direct_google_ads_api_call: true,
        campaignBudgetId_no_fallback: true,
      },
      summary: {
        pending_actions_received: validationPlans.length,
        provider_actions_received: validationPlans.filter((plan) => plan.action_family === 'provider_google_ads').length,
        non_provider_actions_skipped: validationPlans.filter((plan) => plan.status === 'skipped_non_provider_action').length,
        validate_only_pending: validationPlans.filter((plan) => plan.status === 'validate_only_pending').length,
        validate_only_passed: validationPlans.filter((plan) => plan.status === 'validate_only_passed').length,
        validate_only_failed: validationPlans.filter((plan) => plan.status === 'validate_only_failed').length,
        blocked_before_validate_only: validationPlans.filter((plan) => plan.status === 'blocked_before_validate_only').length,
        approval_can_be_considered_executable: validationPlans.filter((plan) => plan.approval_can_be_considered_executable).length,
        executable_now: 0,
      },
      validationPlans,
    };
  }

  private assertNormalization(normalization: AdsAutomationPendingErpActionNormalizationResponse): void {
    if (!normalization || typeof normalization !== 'object') {
      throw new BadRequestException('pending action normalization payload is required');
    }
    if (normalization.schemaVersion !== 'ads_automation_pending_erp_action_normalization.v1') {
      throw new BadRequestException('payload must use ads_automation_pending_erp_action_normalization.v1');
    }
    if (!Array.isArray(normalization.pendingActions)) {
      throw new BadRequestException('pendingActions must be an array');
    }
    if (!normalization.safety || typeof normalization.safety !== 'object') {
      throw new BadRequestException('pending action normalization safety flags are required');
    }
    if (
      normalization.safety.provider_api_called !== false
      || normalization.safety.google_ads_api_called !== false
      || normalization.safety.validateOnly_called !== false
      || normalization.safety.live_ads_execution_used !== false
      || normalization.safety.execution_allowed_now !== false
    ) {
      throw new BadRequestException('validate-only planning requires a dry-run normalization with no provider activity');
    }
    if (
      normalization.safety.persistence_used !== false
      || normalization.safety.durable_storage_used !== false
      || normalization.safety.erp_local_persistence_used !== false
      || normalization.safety.provider_persistence_used !== false
    ) {
      throw new BadRequestException('validate-only planning is in-memory only');
    }
    for (const action of normalization.pendingActions) {
      this.assertPendingActionSafety(action);
    }
  }

  private assertPendingActionSafety(action: AdsAutomationPendingErpActionRecord): void {
    if (!action || typeof action !== 'object') {
      throw new BadRequestException('pending action records must be objects');
    }
    if (action.status !== 'pending_validation') {
      throw new BadRequestException(`pending action ${action.pending_action_id || '<unknown>'} must have pending_validation status`);
    }
    if (action.safety_flags?.approval_required !== true) {
      throw new BadRequestException(`pending action ${action.pending_action_id || '<unknown>'} must require approval`);
    }
    if (
      action.safety_flags?.execution_allowed_now !== false
      || action.safety_flags?.provider_api_called !== false
      || action.safety_flags?.google_ads_api_called !== false
      || action.safety_flags?.validateOnly_called !== false
      || action.safety_flags?.live_ads_execution_used !== false
      || action.safety_flags?.erp_mutation_used !== false
      || action.safety_flags?.payment_mutation_used !== false
      || action.safety_flags?.persistence_used !== false
      || action.safety_flags?.durable_storage_used !== false
      || action.safety_flags?.provider_persistence_used !== false
    ) {
      throw new BadRequestException(`pending action ${action.pending_action_id || '<unknown>'} has unsafe provider or execution flags`);
    }
  }

  private providerResultsByKey(results: AdsAutomationProviderValidateOnlyMockResult[]): ProviderResultLookup {
    const byKey: ProviderResultLookup = new Map();
    for (const result of results || []) {
      if (!result || typeof result !== 'object') {
        throw new BadRequestException('mocked provider results must be objects');
      }
      if (!['provider_validate_passed', 'provider_validate_failed'].includes(result.status)) {
        throw new BadRequestException(`unsupported mocked provider validation status: ${String((result as any).status || '')}`);
      }
      const keys = [
        this.text(result.pending_action_id),
        this.text(result.approval_id),
      ].filter((value): value is string => Boolean(value));
      if (!keys.length) {
        throw new BadRequestException('mocked provider result requires pending_action_id or approval_id');
      }
      for (const key of keys) {
        if (byKey.has(key)) {
          throw new BadRequestException(`duplicate mocked provider result key rejected: ${key}`);
        }
        byKey.set(key, result);
      }
    }
    return byKey;
  }

  private toValidationPlan(
    action: AdsAutomationPendingErpActionRecord,
    resultsByKey: ProviderResultLookup,
    generatedAt: string,
    providerAccountReadiness: AdsAutomationProviderAccountReadinessResponse | null,
  ): AdsAutomationProviderValidateOnlyActionPlan {
    if (!this.isProviderAction(action)) {
      return this.skippedPlan(action, generatedAt);
    }

    const providerReadiness = this.providerReadinessForAction(action, providerAccountReadiness);
    const prerequisites = this.unique([
      ...this.providerPrerequisiteBlockers(action, providerReadiness),
      ...(providerAccountReadiness && !providerReadiness
        ? ['provider_account_readiness.missing_action_evidence']
        : []),
    ]);
    const sourceBlockers = [
      ...this.arrayText(action.evidence?.blockers),
      ...this.arrayText(action.evidence?.missing_data_blockers),
    ];
    const blockers = this.unique([...sourceBlockers, ...prerequisites]);
    const result = resultsByKey.get(action.pending_action_id) || resultsByKey.get(action.approval_id) || null;
    const status = this.validationStatus(blockers, result?.status || null);
    const providerValidationStatus = this.providerValidationStatus(status, result?.status || null);
    const approvalExecutable = status === 'validate_only_passed';
    const beforeStateSnapshot = this.beforeStateSnapshot(action, result);
    const validateOnlyRequest = this.validateOnlyRequest(action, blockers);
    const validateOnlyResult = this.validateOnlyResult(
      action,
      validateOnlyRequest,
      status,
      providerValidationStatus,
      result,
      beforeStateSnapshot,
      approvalExecutable,
    );

    return {
      validation_id: `ADSPROVIDERVALIDATE-${this.safeKey(action.pending_action_id)}`,
      pending_action_id: action.pending_action_id,
      approval_id: action.approval_id,
      source_pending_action_status: action.status,
      action_type: action.action_type,
      action_family: action.action_family,
      provider: action.provider,
      resource_type: action.resource_type,
      entity_type: action.entity_type,
      entity_id: action.entity_id,
      customerId: action.customerId,
      campaignId: action.campaignId,
      adGroupId: action.adGroupId,
      campaignBudgetId: action.campaignBudgetId,
      campaignBudgetResourceName: action.campaignBudgetResourceName,
      requested_change: this.cloneJson(action.requested_change || {}),
      status,
      providerValidationStatus,
      providerRequestId: this.text(result?.providerRequestId),
      providerValidatedAt: this.text(result?.providerValidatedAt),
      providerValidationErrors: status === 'validate_only_failed'
        ? this.providerErrors(result?.errors || [])
        : [],
      before_state_snapshot: beforeStateSnapshot,
      validateOnly_request: validateOnlyRequest,
      validateOnly_result: validateOnlyResult,
      provider_boundary_evidence: this.boundaryEvidence(action, status, result),
      mvp_action_contract: this.mvpActionContract(action),
      provider_account_readiness: providerReadiness
        ? {
            actionId: providerReadiness.actionId,
            status: providerReadiness.status,
            blockers: [...providerReadiness.blockers],
            missingScopes: [...providerReadiness.missingScopes],
            monitorOnlyDowngradeRequired: providerReadiness.monitorOnlyDowngradeRequired,
            safetyActionCandidateAvailable: providerReadiness.safetyActionCandidateAvailable,
            campaignBudgetIdNoFallback: providerReadiness.campaignBudgetIdNoFallback,
          }
        : null,
      blockers,
      approval_can_be_considered_executable: approvalExecutable,
      executable_now: false,
      execution_allowed_now: false,
      validate_only_required_before_execution: true,
      next_required_action: this.nextAction(status),
      source_pending_action: this.cloneJson(action),
    };
  }

  private skippedPlan(
    action: AdsAutomationPendingErpActionRecord,
    generatedAt: string,
  ): AdsAutomationProviderValidateOnlyActionPlan {
    const beforeStateSnapshot = this.beforeStateSnapshot(action, null);
    const validateOnlyRequest = this.validateOnlyRequest(action, []);
    const validateOnlyResult = this.validateOnlyResult(
      action,
      validateOnlyRequest,
      'skipped_non_provider_action',
      'not_applicable',
      null,
      beforeStateSnapshot,
      false,
    );

    return {
      validation_id: `ADSPROVIDERVALIDATE-${this.safeKey(action.pending_action_id || generatedAt)}`,
      pending_action_id: action.pending_action_id,
      approval_id: action.approval_id,
      source_pending_action_status: action.status,
      action_type: action.action_type,
      action_family: action.action_family,
      provider: action.provider,
      resource_type: action.resource_type,
      entity_type: action.entity_type,
      entity_id: action.entity_id,
      customerId: action.customerId,
      campaignId: action.campaignId,
      adGroupId: action.adGroupId,
      campaignBudgetId: action.campaignBudgetId,
      campaignBudgetResourceName: action.campaignBudgetResourceName,
      requested_change: this.cloneJson(action.requested_change || {}),
      status: 'skipped_non_provider_action',
      providerValidationStatus: 'not_applicable',
      providerRequestId: null,
      providerValidatedAt: null,
      providerValidationErrors: [],
      before_state_snapshot: beforeStateSnapshot,
      validateOnly_request: validateOnlyRequest,
      validateOnly_result: validateOnlyResult,
      provider_boundary_evidence: {
        boundary_mode: 'erp_local_mock_only',
        status_source: 'non_provider_action',
        mocked_provider_result_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        direct_google_ads_api_call: false,
        operation_builder_called: false,
        raw_provider_request_included: false,
        evidence: [
          'Action is not a Google Ads provider action.',
          'No provider validate-only plan is created for ERP-internal or monitoring records.',
        ],
      },
      mvp_action_contract: this.mvpActionContract(action),
      provider_account_readiness: null,
      blockers: [],
      approval_can_be_considered_executable: false,
      executable_now: false,
      execution_allowed_now: false,
      validate_only_required_before_execution: false,
      next_required_action: 'not_applicable_non_provider_action',
      source_pending_action: this.cloneJson(action),
    };
  }

  private providerPrerequisiteBlockers(
    action: AdsAutomationPendingErpActionRecord,
    providerReadiness: AdsAutomationProviderRequestedActionReadiness | null,
  ): string[] {
    const blockers: string[] = [];
    const add = (key: string, valid: boolean) => {
      if (!valid) blockers.push(key);
    };

    add('approval_required', action.safety_flags.approval_required === true);
    add('execution_allowed_now', action.safety_flags.execution_allowed_now === false);
    add('future_provider_validateOnly_required', action.safety_flags.future_provider_validateOnly_required === true);
    add('validate_only_required', action.safety_flags.validate_only_required === true);
    add('provider_api_called', action.safety_flags.provider_api_called === false);
    add('google_ads_api_called', action.safety_flags.google_ads_api_called === false);
    add('live_ads_execution_used', action.safety_flags.live_ads_execution_used === false);
    add('supported_provider_action_type', PROVIDER_ACTION_TYPES.includes(action.action_type));
    add('customerId', Boolean(this.text(action.customerId)));

    if (action.action_type === 'update_campaign_budget') {
      add('campaignBudgetId', Boolean(this.text(action.campaignBudgetId)));
      add('requested_change.dailyBudget', this.positiveNumber(action.requested_change?.dailyBudget));
    }
    if (action.action_type === 'pause_campaign') {
      add('campaignId', Boolean(this.text(action.campaignId)));
      add('requested_change.targetStatus', this.text(action.requested_change?.targetStatus) === 'PAUSED');
    }
    if (action.action_type === 'pause_ad_group') {
      add('adGroupId', Boolean(this.text(action.adGroupId)));
      add('requested_change.targetStatus', this.text(action.requested_change?.targetStatus) === 'PAUSED');
    }
    if (providerReadiness) {
      if (providerReadiness.status !== 'ready_for_future_validate_only') {
        blockers.push('provider_account_readiness');
      }
      blockers.push(...providerReadiness.blockers.map((blocker) => (
        `provider_account_readiness.${blocker}`
      )));
    }

    return blockers;
  }

  private mvpActionContract(
    action: AdsAutomationPendingErpActionRecord,
  ): AdsAutomationProviderValidateOnlyMvpActionContract {
    const providerAction = this.isProviderAction(action);
    const monitorOnly = action.action_type === 'monitor_only';
    const supportedMvpAction = MVP_ACTION_TYPES.includes(action.action_type);

    return {
      supported_mvp_action: supportedMvpAction,
      action_scope: providerAction
        ? 'provider_validateOnly_required'
        : monitorOnly
          ? 'monitor_only_safety_action'
          : 'out_of_scope_non_provider_action',
      preflight_treatment: providerAction
        ? 'eligible_for_future_provider_preflight'
        : monitorOnly
          ? 'visible_non_executable_safety_action'
          : 'not_in_mvp_validateOnly_contract',
      provider_validateOnly_required_before_future_execution: providerAction,
      monitor_only_safety_action: monitorOnly,
      visible_as_safety_action: monitorOnly,
      approval_required_before_execution: true,
      future_live_execution_allowed: false,
      executable_now: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private providerReadinessForAction(
    action: AdsAutomationPendingErpActionRecord,
    providerAccountReadiness: AdsAutomationProviderAccountReadinessResponse | null,
  ): AdsAutomationProviderRequestedActionReadiness | null {
    if (!providerAccountReadiness) return null;
    return providerAccountReadiness.requestedActions.find((candidate) => (
      candidate.sourcePendingActionId === action.pending_action_id
      || candidate.approvalId === action.approval_id
      || (
        candidate.actionType === action.action_type
        && candidate.customerId === action.customerId
        && candidate.campaignId === action.campaignId
        && candidate.adGroupId === action.adGroupId
        && candidate.campaignBudgetId === action.campaignBudgetId
      )
    )) || null;
  }

  private validationStatus(
    blockers: string[],
    resultStatus: AdsAutomationProviderValidateOnlyMockStatus | null,
  ): AdsAutomationProviderValidateOnlyStatus {
    if (blockers.length) return 'blocked_before_validate_only';
    if (resultStatus === 'provider_validate_passed') return 'validate_only_passed';
    if (resultStatus === 'provider_validate_failed') return 'validate_only_failed';
    return 'validate_only_pending';
  }

  private providerValidationStatus(
    status: AdsAutomationProviderValidateOnlyStatus,
    resultStatus: AdsAutomationProviderValidateOnlyMockStatus | null,
  ): AdsAutomationProviderValidateOnlyActionPlan['providerValidationStatus'] {
    if (status === 'validate_only_passed' || status === 'validate_only_failed') {
      return resultStatus || 'pending';
    }
    if (status === 'skipped_non_provider_action') return 'not_applicable';
    return 'pending';
  }

  private nextAction(status: AdsAutomationProviderValidateOnlyStatus): AdsAutomationProviderValidateOnlyNextAction {
    switch (status) {
      case 'validate_only_passed':
        return 'continue_human_approval_flow';
      case 'validate_only_failed':
        return 'fix_provider_validation_errors';
      case 'blocked_before_validate_only':
        return 'fix_blockers_before_validateOnly';
      case 'skipped_non_provider_action':
        return 'not_applicable_non_provider_action';
      default:
        return 'run_future_erp_validateOnly';
    }
  }

  private beforeStateSnapshot(
    action: AdsAutomationPendingErpActionRecord,
    result: AdsAutomationProviderValidateOnlyMockResult | null,
  ): AdsAutomationProviderValidateOnlyBeforeStateSnapshot {
    const snapshot = result?.beforeStateSnapshot && typeof result.beforeStateSnapshot === 'object'
      ? this.cloneJson(result.beforeStateSnapshot)
      : null;

    return {
      snapshot_status: snapshot ? 'mocked_boundary_snapshot' : 'placeholder_pending_erp_synced_read',
      required_before_future_execution: true,
      source: 'erp_synced_google_ads_read_model',
      customerId: action.customerId,
      campaignId: action.campaignId,
      adGroupId: action.adGroupId,
      campaignBudgetId: action.campaignBudgetId,
      campaignBudgetResourceName: action.campaignBudgetResourceName,
      snapshot,
    };
  }

  private boundaryEvidence(
    action: AdsAutomationPendingErpActionRecord,
    status: AdsAutomationProviderValidateOnlyStatus,
    result: AdsAutomationProviderValidateOnlyMockResult | null,
  ): AdsAutomationProviderValidateOnlyBoundaryEvidence {
    const statusSource = status === 'blocked_before_validate_only'
      ? 'preflight_blockers'
      : result
        ? 'mock_provider_result'
        : 'no_mock_result';

    return {
      boundary_mode: 'erp_local_mock_only',
      status_source: statusSource,
      mocked_provider_result_used: Boolean(result),
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      direct_google_ads_api_call: false,
      operation_builder_called: false,
      raw_provider_request_included: false,
      evidence: [
        `Pending action ${action.pending_action_id} stayed inside ai-data-pack dry-run planning.`,
        'No direct Google Ads API, provider adapter, operation builder, or live execution was invoked.',
        result
          ? `Mocked provider validation result mapped to ${status}.`
          : 'Provider validation remains pending until a future ERP-owned validate-only executor supplies a result.',
      ],
    };
  }

  private providerErrors(errors: AdsAutomationProviderValidateOnlyError[]): AdsAutomationProviderValidateOnlyError[] {
    return (errors || []).map((error) => ({
      ...(this.text(error.code) ? { code: this.text(error.code) } : {}),
      message: redactSecretString(String(error.message || 'Provider validation failed.')),
      ...(this.text(error.fieldPath) ? { fieldPath: this.text(error.fieldPath) } : {}),
    }));
  }

  private validateOnlyRequest(
    action: AdsAutomationPendingErpActionRecord,
    blockers: string[],
  ): AdsAutomationProviderValidateOnlyRequestRecord {
    const operationKind = this.operationKind(action.action_type);
    const nonProviderAction = operationKind === 'not_applicable_non_provider_action';
    return {
      schemaVersion: 'ads_automation_provider_validate_only_request.v1',
      request_id: `ADSPROVIDERVALIDATEREQ-${this.safeKey(action.pending_action_id)}`,
      pending_action_id: action.pending_action_id,
      approval_id: action.approval_id,
      action_type: action.action_type,
      operation_kind: operationKind,
      provider: action.provider,
      boundary_mode: 'erp_local_mock_only',
      request_status: nonProviderAction
        ? 'not_applicable_non_provider_action'
        : blockers.length
          ? 'blocked_before_validateOnly'
          : 'ready_for_future_validateOnly',
      customerId: action.customerId,
      campaignId: action.campaignId,
      adGroupId: action.adGroupId,
      campaignBudgetId: action.campaignBudgetId,
      campaignBudgetResourceName: action.campaignBudgetResourceName,
      requested_change: this.cloneJson(action.requested_change || {}),
      required_identifiers: this.requiredIdentifiers(action.action_type),
      missing_identifiers: this.missingIdentifiers(action),
      before_state_snapshot_required: true,
      raw_provider_request_included: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      execution_allowed_now: false,
    };
  }

  private validateOnlyResult(
    action: AdsAutomationPendingErpActionRecord,
    request: AdsAutomationProviderValidateOnlyRequestRecord,
    status: AdsAutomationProviderValidateOnlyStatus,
    providerValidationStatus: AdsAutomationProviderValidateOnlyActionPlan['providerValidationStatus'],
    result: AdsAutomationProviderValidateOnlyMockResult | null,
    beforeStateSnapshot: AdsAutomationProviderValidateOnlyBeforeStateSnapshot,
    approvalExecutable: boolean,
  ): AdsAutomationProviderValidateOnlyResultRecord {
    return {
      schemaVersion: 'ads_automation_provider_validate_only_result.v1',
      result_id: `ADSPROVIDERVALIDATERESULT-${this.safeKey(action.pending_action_id)}`,
      request_id: request.request_id,
      pending_action_id: action.pending_action_id,
      approval_id: action.approval_id,
      action_type: action.action_type,
      operation_kind: request.operation_kind,
      status,
      providerValidationStatus,
      providerRequestId: this.text(result?.providerRequestId),
      providerValidatedAt: this.text(result?.providerValidatedAt),
      providerValidationErrors: result?.status === 'provider_validate_failed'
        ? this.providerErrors(result?.errors || [])
        : [],
      before_state_snapshot: this.cloneJson(beforeStateSnapshot),
      mocked_provider_result_used: Boolean(result),
      approval_can_be_considered_executable: approvalExecutable,
      executable_now: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private operationKind(actionType: AdsAutomationPendingErpActionType): AdsAutomationProviderValidateOnlyOperationKind {
    if (actionType === 'update_campaign_budget') return 'campaign_budget_update';
    if (actionType === 'pause_campaign') return 'campaign_pause';
    if (actionType === 'pause_ad_group') return 'ad_group_pause';
    return 'not_applicable_non_provider_action';
  }

  private requiredIdentifiers(actionType: AdsAutomationPendingErpActionType): string[] {
    if (actionType === 'update_campaign_budget') return ['customerId', 'campaignBudgetId'];
    if (actionType === 'pause_campaign') return ['customerId', 'campaignId'];
    if (actionType === 'pause_ad_group') return ['customerId', 'adGroupId'];
    return [];
  }

  private missingIdentifiers(action: AdsAutomationPendingErpActionRecord): string[] {
    return this.requiredIdentifiers(action.action_type).filter((key) => {
      if (key === 'customerId') return !this.text(action.customerId);
      if (key === 'campaignId') return !this.text(action.campaignId);
      if (key === 'adGroupId') return !this.text(action.adGroupId);
      if (key === 'campaignBudgetId') return !this.text(action.campaignBudgetId);
      return false;
    });
  }

  private isProviderAction(action: AdsAutomationPendingErpActionRecord): boolean {
    return action.action_family === 'provider_google_ads'
      && action.provider === 'google'
      && PROVIDER_ACTION_TYPES.includes(action.action_type);
  }

  private positiveNumber(value: unknown): boolean {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0;
  }

  private arrayText(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private safeKey(value: string): string {
    return String(value || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 96);
  }
}
