import { BadRequestException, Injectable } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import { AdsAutomationExecutionPreflightDryRunRepository } from './ads-automation-execution-preflight-dry-run.repository';
import { AdsAutomationPolicyDecisionEvidenceRepository } from './ads-automation-policy-decision-evidence.repository';
import { AdsAutomationProviderAccountReadinessService } from './ads-automation-provider-account-readiness.service';
import { AdsAutomationValidateOnlyEvidenceRepository } from './ads-automation-validate-only-evidence.repository';
import type {
  AdsAutomationApprovalEvidenceIndexLinks,
  AdsAutomationApprovalEvidencePendingActionProviderReadiness,
  AdsAutomationApprovalEvidencePendingActionReviewEvidence,
  AdsAutomationApprovalEvidenceProviderReadinessStatus,
  AdsAutomationApprovalEvidenceIndexResponse,
  AdsAutomationApprovalEvidenceIndexSafety,
  AdsAutomationApprovalEvidenceSourceSyncGateStatus,
} from './contracts/ads-automation-approval-evidence-index.contract';
import type { AdsAutomationDecisionDraftPendingApprovalRecord } from './contracts/ads-automation-decision-draft-approval.contract';
import type { AdsAutomationExecutionPreflightDryRunRecord } from './contracts/ads-automation-execution-preflight-dry-run.contract';
import type { AdsAutomationPolicyDecisionEvidenceRecord } from './contracts/ads-automation-policy-decision-evidence.contract';
import type {
  AdsAutomationProviderAccountInput,
  AdsAutomationProviderAccountReadinessResponse,
  AdsAutomationProviderPlatform,
  AdsAutomationProviderRequestedActionInput,
} from './contracts/ads-automation-provider-account-readiness.contract';
import type { AdsAutomationValidateOnlyEvidenceRecord } from './contracts/ads-automation-validate-only-evidence.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from './source-sync/source-sync-result.types';

interface SourceSyncApprovalEvidenceSummary {
  pending_approval_record_matched: boolean;
  source_sync_decision_evidence_records_matched: number;
  source_sync_decision_blocked_sources: number;
  source_sync_gate_status: AdsAutomationApprovalEvidenceSourceSyncGateStatus;
  source_sync_can_generate_action_draft: boolean | null;
  source_sync_can_recommend_ads_scale: boolean | null;
  source_sync_can_use_google_ads_data_claim: boolean | null;
  source_sync_blocking_reasons: string[];
  evidence: SourceSyncDecisionEvidence[];
  gates: Partial<SourceSyncDecisionGates> | null;
}

interface ProviderApprovalEvidenceSummary {
  provider_account_readiness_status: AdsAutomationApprovalEvidenceProviderReadinessStatus;
  provider_account_readiness_blocked_actions: number;
  provider_account_readiness_blocking_reasons: string[];
  provider_account_readiness_campaignBudgetId_no_fallback: boolean | null;
  provider_account_readiness_scale_up_execution_mode: 'monitor_only' | 'pending_validation' | null;
}

@Injectable()
export class AdsAutomationApprovalEvidenceIndexService {
  constructor(
    private readonly preflightRepository: AdsAutomationExecutionPreflightDryRunRepository,
    private readonly policyDecisionEvidenceRepository: AdsAutomationPolicyDecisionEvidenceRepository,
    private readonly validateOnlyEvidenceRepository: AdsAutomationValidateOnlyEvidenceRepository,
    private readonly pendingApprovalRepository?: AdsAutomationDecisionDraftApprovalRepository,
    private readonly providerAccountReadiness: AdsAutomationProviderAccountReadinessService =
      new AdsAutomationProviderAccountReadinessService(),
  ) {}

  async buildByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationApprovalEvidenceIndexResponse> {
    const normalizedApprovalId = this.requiredText(approvalId, 'approvalId');
    const [
      validateOnlyEvidenceRecords,
      policyDecisionEvidenceRecords,
      executionPreflightDryRunRecords,
      pendingApproval,
    ] = await Promise.all([
      this.validateOnlyEvidenceRepository.listByApprovalId(normalizedApprovalId),
      this.policyDecisionEvidenceRepository.listByApprovalId(normalizedApprovalId),
      this.preflightRepository.listByApprovalId(normalizedApprovalId),
      this.pendingApprovalRepository?.findByApprovalId(normalizedApprovalId) ?? Promise.resolve(null),
    ]);

    return this.buildFromRecords(
      normalizedApprovalId,
      validateOnlyEvidenceRecords,
      policyDecisionEvidenceRecords,
      executionPreflightDryRunRecords,
      undefined,
      pendingApproval,
    );
  }

  buildFromRecords(
    approvalId: string,
    validateOnlyEvidenceRecords: AdsAutomationValidateOnlyEvidenceRecord[],
    policyDecisionEvidenceRecords: AdsAutomationPolicyDecisionEvidenceRecord[],
    executionPreflightDryRunRecords: AdsAutomationExecutionPreflightDryRunRecord[],
    generatedAt = new Date().toISOString(),
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null = null,
  ): AdsAutomationApprovalEvidenceIndexResponse {
    const normalizedApprovalId = this.requiredText(approvalId, 'approvalId');
    const links = this.links(
      validateOnlyEvidenceRecords,
      policyDecisionEvidenceRecords,
      executionPreflightDryRunRecords,
    );
    const sourceSyncSummary = this.sourceSyncApprovalEvidence(pendingApproval);
    const pendingActionReviewEvidence = this.pendingActionReviewEvidence(
      pendingApproval,
      sourceSyncSummary,
    );
    const providerReadinessSummary = this.providerReadinessSummary(
      pendingActionReviewEvidence,
    );
    const pendingApprovalForResponse = this.clonePendingApproval(pendingApproval);
    const totalRecords = validateOnlyEvidenceRecords.length
      + policyDecisionEvidenceRecords.length
      + executionPreflightDryRunRecords.length
      + sourceSyncSummary.source_sync_decision_evidence_records_matched;
    const hasReadbackEvidence = totalRecords > 0 || Boolean(pendingApproval);

    return {
      schemaVersion: 'ads_automation_approval_evidence_index.v1',
      generatedAt,
      query: { approval_id: normalizedApprovalId },
      safety: this.readbackSafety(),
      summary: {
        readback_status: hasReadbackEvidence ? 'listed' : 'empty',
        approval_id_filter_applied: true,
        validateOnly_evidence_records_matched: validateOnlyEvidenceRecords.length,
        policy_decision_records_matched: policyDecisionEvidenceRecords.length,
        execution_preflight_records_matched: executionPreflightDryRunRecords.length,
        pending_approval_record_matched: sourceSyncSummary.pending_approval_record_matched,
        pending_action_review_evidence_records_matched: pendingActionReviewEvidence.length,
        source_sync_decision_evidence_records_matched: sourceSyncSummary.source_sync_decision_evidence_records_matched,
        source_sync_decision_blocked_sources: sourceSyncSummary.source_sync_decision_blocked_sources,
        source_sync_gate_status: sourceSyncSummary.source_sync_gate_status,
        source_sync_can_generate_action_draft: sourceSyncSummary.source_sync_can_generate_action_draft,
        source_sync_can_recommend_ads_scale: sourceSyncSummary.source_sync_can_recommend_ads_scale,
        source_sync_can_use_google_ads_data_claim: sourceSyncSummary.source_sync_can_use_google_ads_data_claim,
        source_sync_blocking_reasons: sourceSyncSummary.source_sync_blocking_reasons,
        provider_account_readiness_status: providerReadinessSummary.provider_account_readiness_status,
        provider_account_readiness_blocked_actions: providerReadinessSummary.provider_account_readiness_blocked_actions,
        provider_account_readiness_blocking_reasons: providerReadinessSummary.provider_account_readiness_blocking_reasons,
        provider_account_readiness_campaignBudgetId_no_fallback: providerReadinessSummary.provider_account_readiness_campaignBudgetId_no_fallback,
        provider_account_readiness_scale_up_execution_mode: providerReadinessSummary.provider_account_readiness_scale_up_execution_mode,
        linked_validateOnly_evidence_records: links.validateOnly_validation_ids_with_evidence.length,
        linked_policy_decision_records: links.policy_decision_ids_with_evidence.length,
        unlinked_validateOnly_validation_ids: links.validateOnly_validation_ids_missing_evidence.length,
        unlinked_policy_decision_ids: links.policy_decision_ids_missing_evidence.length,
        approval_required: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        approval_evidence_index_persistence_performed: false,
        validateOnly_evidence_persistence_performed: false,
        policy_decision_evidence_persistence_performed: false,
        preflight_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        next_required_action: hasReadbackEvidence
          ? 'inspect_approval_evidence_index'
          : 'verify_approval_id_or_generate_preflight_evidence',
      },
      links,
      pendingApproval: pendingApprovalForResponse,
      pendingActionReviewEvidence,
      sourceSyncDecisionEvidence: this.cloneSourceSyncEvidence(sourceSyncSummary.evidence),
      sourceSyncDecisionGates: this.cloneSourceSyncGates(sourceSyncSummary.gates),
      validateOnlyEvidenceRecords,
      policyDecisionEvidenceRecords,
      executionPreflightDryRunRecords,
    };
  }

  private pendingActionReviewEvidence(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null,
    sourceSyncSummary: SourceSyncApprovalEvidenceSummary,
  ): AdsAutomationApprovalEvidencePendingActionReviewEvidence[] {
    if (!pendingApproval) return [];

    return [{
      pending_action_id: this.pendingActionId(pendingApproval),
      approval_id: pendingApproval.approval_id,
      action_type: pendingApproval.action_type,
      action_family: pendingApproval.action_family,
      provider: pendingApproval.provider,
      entity_type: pendingApproval.entity_type,
      entity_id: pendingApproval.entity_id,
      accountId: pendingApproval.accountId,
      productId: pendingApproval.productId,
      supplierId: pendingApproval.supplierId,
      platform: pendingApproval.platform,
      status: pendingApproval.status,
      sourceSyncDecisionEvidence: this.cloneSourceSyncEvidence(sourceSyncSummary.evidence),
      sourceSyncDecisionGates: this.cloneSourceSyncGates(sourceSyncSummary.gates),
      source_sync_blocking_reasons: [...sourceSyncSummary.source_sync_blocking_reasons],
      providerAccountReadiness: this.providerAccountReadinessEvidence(pendingApproval),
      approval_required: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }];
  }

  private providerReadinessSummary(
    evidence: AdsAutomationApprovalEvidencePendingActionReviewEvidence[],
  ): ProviderApprovalEvidenceSummary {
    if (!evidence.length) {
      return {
        provider_account_readiness_status: 'not_available',
        provider_account_readiness_blocked_actions: 0,
        provider_account_readiness_blocking_reasons: [],
        provider_account_readiness_campaignBudgetId_no_fallback: null,
        provider_account_readiness_scale_up_execution_mode: null,
      };
    }

    const providerReadiness = evidence.map((item) => item.providerAccountReadiness);
    const statuses = providerReadiness.map((item) => item.accountReadinessStatus);
    const blockedActions = providerReadiness.filter((item) => (
      item.status === 'blocked_before_provider_boundary'
      || item.accountReadinessStatus === 'blocked'
      || item.blockers.length > 0
    ));
    const campaignBudgetNoFallback = providerReadiness
      .some((item) => item.campaignBudgetIdNoFallback === true)
      ? true
      : providerReadiness.some((item) => item.campaignBudgetIdNoFallback === false)
        ? false
        : null;
    const readinessStatus: AdsAutomationApprovalEvidenceProviderReadinessStatus =
      statuses.includes('blocked')
        ? 'blocked'
        : statuses.includes('ready_for_local_validate_only')
          ? 'ready_for_local_validate_only'
          : statuses.includes('not_applicable_internal_action')
            ? 'not_applicable_internal_action'
            : 'not_available';
    const scaleUpMode = providerReadiness.some((item) => item.monitorOnlyDowngradeRequired)
      || readinessStatus === 'blocked'
      ? 'monitor_only'
      : providerReadiness.some((item) => item.status === 'ready_for_future_validate_only')
        ? 'pending_validation'
        : null;

    return {
      provider_account_readiness_status: readinessStatus,
      provider_account_readiness_blocked_actions: blockedActions.length,
      provider_account_readiness_blocking_reasons: this.uniqueText(
        providerReadiness.flatMap((item) => item.blockers),
      ),
      provider_account_readiness_campaignBudgetId_no_fallback: campaignBudgetNoFallback,
      provider_account_readiness_scale_up_execution_mode: scaleUpMode,
    };
  }

  private providerAccountReadinessEvidence(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord,
  ): AdsAutomationApprovalEvidencePendingActionProviderReadiness {
    if (!this.isProviderAction(pendingApproval)) {
      return this.internalProviderReadinessEvidence();
    }

    const readiness = this.providerAccountReadiness.build(
      this.providerReadinessInput(pendingApproval),
    );
    const action = readiness.requestedActions[0];
    const account = readiness.accounts.find((item) => (
      (action.accountId && item.accountId === action.accountId)
      || (action.customerId && item.customerId === action.customerId)
    )) || readiness.accounts[0] || null;
    const blockers = this.uniqueText([
      ...(account?.blockers || []),
      ...(action?.blockers || []),
    ]);
    const warnings = this.uniqueText([
      ...(account?.warnings || []),
      ...(action?.warnings || []),
    ]);

    return {
      status: action?.status || 'not_available',
      accountReadinessStatus: readiness.summary.status,
      platform: action?.platform || account?.platform || null,
      accountId: action?.accountId || account?.accountId || null,
      customerId: action?.customerId || account?.customerId || null,
      erpAccountMappingId: account?.erpAccountMappingId || null,
      credentialStatus: account?.credentialReadiness.status || 'not_available',
      oauthConnectionStatus: account?.credentialReadiness.oauthConnectionStatus || 'not_available',
      credentialReferenceId: account?.credentialReadiness.credentialReferenceId || null,
      redactedCredentialReference: account?.credentialReadiness.redactedCredentialReference || null,
      requiredScopes: action?.requiredScopes || [],
      grantedScopes: account?.credentialReadiness.grantedScopes || [],
      missingScopes: action?.missingScopes || [],
      blockers,
      warnings,
      accountMappingBlockers: blockers.filter((blocker) =>
        blocker.startsWith('account_mapping.') || blocker.startsWith('account.account_mapping.')),
      oauthMetadataBlockers: blockers.filter((blocker) =>
        blocker.startsWith('credential_readiness.') || blocker.startsWith('account.credential_readiness.')),
      permissionScopeBlockers: blockers.filter((blocker) =>
        blocker.startsWith('permission_scope.') || blocker.startsWith('account.permission_scope.')),
      capabilityBlockers: blockers.filter((blocker) => blocker.startsWith('capability.')),
      campaignBudgetIdNoFallback: action?.campaignBudgetIdNoFallback ?? null,
      campaignBudgetIdMissingNoFallback: blockers.includes('campaignBudgetId_missing_no_fallback'),
      providerApiRequired: action?.providerApiRequired ?? true,
      validateOnlyRequiredBeforeExecution: action?.validateOnlyRequiredBeforeExecution ?? true,
      monitorOnlyDowngradeRequired: action?.monitorOnlyDowngradeRequired ?? false,
      safetyActionCandidateAvailable: action?.safetyActionCandidateAvailable ?? false,
      approval_can_be_considered_executable: false,
      execution_allowed_now: false,
      next_required_action: action?.next_required_action || 'verify_provider_readiness_payload',
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private providerReadinessInput(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord,
  ) {
    const payload = this.record(pendingApproval.typedPayload);
    const accountOverride = this.record(payload.providerAccountReadinessAccount);
    const requestedActionOverride = this.record(payload.providerAccountReadinessRequestedAction);
    const customerId = this.text(payload.customerId) || this.customerId(pendingApproval.accountId);
    const accountId = this.text(accountOverride.accountId) || pendingApproval.accountId;
    const account: AdsAutomationProviderAccountInput = {
      platform: 'google_ads',
      accountId,
      customerId: this.text(accountOverride.customerId) || customerId,
      loginCustomerId: this.text(accountOverride.loginCustomerId),
      managerCustomerId: this.text(accountOverride.managerCustomerId),
      erpAccountMappingId: this.text(accountOverride.erpAccountMappingId),
      accountName: this.text(accountOverride.accountName),
      adapterRegistered: accountOverride.adapterRegistered === true,
      adapterMode: accountOverride.adapterMode === 'contract_only' ? 'contract_only' : 'not_registered',
      isActive: accountOverride.isActive === true,
      approvedForProviderActions: accountOverride.approvedForProviderActions === true,
      approvedForReadOnlyImport: accountOverride.approvedForReadOnlyImport === true,
      googleAdsProductionEnabled: accountOverride.googleAdsProductionEnabled === true,
      credentialMetadata: this.recordOrNull(accountOverride.credentialMetadata),
    };
    const requestedAction: AdsAutomationProviderRequestedActionInput = {
      actionId: this.text(requestedActionOverride.actionId)
        || `PROVIDER-READINESS-${pendingApproval.approval_id}`,
      sourcePendingActionId: this.pendingActionId(pendingApproval),
      approvalId: pendingApproval.approval_id,
      platform: 'google_ads',
      channel: this.text(payload.channel) || this.text(requestedActionOverride.channel) || 'search',
      actionType: pendingApproval.action_type,
      accountId: this.text(requestedActionOverride.accountId) || account.accountId,
      customerId: this.text(requestedActionOverride.customerId) || account.customerId,
      campaignId: this.text(payload.campaignId) || this.text(requestedActionOverride.campaignId),
      adGroupId: this.text(payload.adGroupId) || this.text(requestedActionOverride.adGroupId),
      campaignBudgetId: this.text(payload.campaignBudgetId) || this.text(requestedActionOverride.campaignBudgetId),
      campaignBudgetResourceName: this.text(payload.campaignBudgetResourceName)
        || this.text(requestedActionOverride.campaignBudgetResourceName),
      currentDailyBudgetVnd: this.numberOrNull(payload.currentBudgetVnd)
        ?? this.numberOrNull(payload.currentDailyBudgetVnd)
        ?? this.numberOrNull(requestedActionOverride.currentDailyBudgetVnd),
      requestedDailyBudgetVnd: this.numberOrNull(payload.dailyBudget)
        ?? this.numberOrNull(payload.requestedDailyBudgetVnd)
        ?? this.numberOrNull(requestedActionOverride.requestedDailyBudgetVnd),
      targetStatus: this.text(payload.targetStatus) || this.text(requestedActionOverride.targetStatus),
    };

    return {
      reportDate: this.reportDate(pendingApproval),
      now: pendingApproval.createdAt,
      fixtureMode: 'custom_local_payload' as const,
      accounts: [account],
      requestedActions: [requestedAction],
    };
  }

  private internalProviderReadinessEvidence(): AdsAutomationApprovalEvidencePendingActionProviderReadiness {
    return {
      status: 'not_applicable_internal_action',
      accountReadinessStatus: 'not_applicable_internal_action',
      platform: null,
      accountId: null,
      customerId: null,
      erpAccountMappingId: null,
      credentialStatus: 'not_applicable',
      oauthConnectionStatus: 'not_applicable',
      credentialReferenceId: null,
      redactedCredentialReference: null,
      requiredScopes: [],
      grantedScopes: [],
      missingScopes: [],
      blockers: [],
      warnings: [],
      accountMappingBlockers: [],
      oauthMetadataBlockers: [],
      permissionScopeBlockers: [],
      capabilityBlockers: [],
      campaignBudgetIdNoFallback: null,
      campaignBudgetIdMissingNoFallback: false,
      providerApiRequired: false,
      validateOnlyRequiredBeforeExecution: false,
      monitorOnlyDowngradeRequired: false,
      safetyActionCandidateAvailable: true,
      approval_can_be_considered_executable: false,
      execution_allowed_now: false,
      next_required_action: 'review_internal_task_evidence',
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private links(
    validateOnlyEvidenceRecords: AdsAutomationValidateOnlyEvidenceRecord[],
    policyDecisionEvidenceRecords: AdsAutomationPolicyDecisionEvidenceRecord[],
    executionPreflightDryRunRecords: AdsAutomationExecutionPreflightDryRunRecord[],
  ): AdsAutomationApprovalEvidenceIndexLinks {
    const validationIdsFromPreflight = this.uniqueText(
      executionPreflightDryRunRecords.map((record) => record.validateOnly_validation_id),
    );
    const validationEvidenceIds = new Set(
      this.uniqueText(validateOnlyEvidenceRecords.map((record) => record.validation_id)),
    );
    const policyDecisionIdsFromPreflight = this.uniqueText(
      executionPreflightDryRunRecords.map((record) => record.policy_decision_id),
    );
    const policyEvidenceIds = new Set(
      this.uniqueText(policyDecisionEvidenceRecords.map((record) => record.policy_decision_id)),
    );

    return {
      execution_record_ids: this.uniqueText(
        executionPreflightDryRunRecords.map((record) => record.execution_record_id),
      ),
      validateOnly_validation_ids_from_preflight: validationIdsFromPreflight,
      validateOnly_validation_ids_with_evidence: validationIdsFromPreflight
        .filter((validationId) => validationEvidenceIds.has(validationId)),
      validateOnly_validation_ids_missing_evidence: validationIdsFromPreflight
        .filter((validationId) => !validationEvidenceIds.has(validationId)),
      policy_decision_ids_from_preflight: policyDecisionIdsFromPreflight,
      policy_decision_ids_with_evidence: policyDecisionIdsFromPreflight
        .filter((policyDecisionId) => policyEvidenceIds.has(policyDecisionId)),
      policy_decision_ids_missing_evidence: policyDecisionIdsFromPreflight
        .filter((policyDecisionId) => !policyEvidenceIds.has(policyDecisionId)),
    };
  }

  private readbackSafety(): AdsAutomationApprovalEvidenceIndexSafety {
    return {
      read_only: true,
      dry_run: true,
      in_memory_only: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_records: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      live_path_implemented: false,
      provider_mutation_used: false,
      direct_google_ads_api_call: false,
      approval_evidence_index_readback: true,
      approval_evidence_index_persistence_performed: false,
      validateOnly_evidence_persistence_performed: false,
      policy_decision_evidence_persistence_performed: false,
      preflight_persistence_performed: false,
    };
  }

  private sourceSyncApprovalEvidence(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null,
  ): SourceSyncApprovalEvidenceSummary {
    const evidence = Array.isArray(pendingApproval?.sourceSyncDecisionEvidence)
      ? pendingApproval.sourceSyncDecisionEvidence
      : [];
    const gates = pendingApproval?.sourceSyncDecisionGates
      && typeof pendingApproval.sourceSyncDecisionGates === 'object'
      && !Array.isArray(pendingApproval.sourceSyncDecisionGates)
      ? pendingApproval.sourceSyncDecisionGates
      : null;
    const blockedSources = evidence.filter((record) => (
      record.canUseForAdsAutomationDecision === false
      || Boolean(this.text(record.blockingReason))
      || (Array.isArray(record.blockingReasons) && record.blockingReasons.length > 0)
    ));
    const actionDraftGateBlocked = gates?.canGenerateActionDraft === false;
    const adsScaleRecommendationGateBlocked = gates?.canRecommendAdsScale === false;
    const googleAdsDataClaimGateBlocked = gates?.canUseGoogleAdsDataClaim === false;
    const gateBlocked = actionDraftGateBlocked
      || adsScaleRecommendationGateBlocked
      || googleAdsDataClaimGateBlocked;
    const sourceSyncGateStatus: AdsAutomationApprovalEvidenceSourceSyncGateStatus =
      gateBlocked || blockedSources.length
        ? 'blocked'
        : evidence.length || gates
          ? 'ready'
          : 'not_available';
    const blockingReasons = this.uniqueText([
      ...(actionDraftGateBlocked ? ['source_sync_gate_blocked_action_draft'] : []),
      ...(adsScaleRecommendationGateBlocked ? ['source_sync_gate_blocked_ads_scale_recommendation'] : []),
      ...(googleAdsDataClaimGateBlocked ? ['source_sync_gate_blocked_google_ads_data_claim'] : []),
      ...evidence.flatMap((record) => [
        record.blockingReason,
        ...(Array.isArray(record.blockingReasons) ? record.blockingReasons : []),
      ]),
    ]);

    return {
      pending_approval_record_matched: Boolean(pendingApproval),
      source_sync_decision_evidence_records_matched: evidence.length,
      source_sync_decision_blocked_sources: blockedSources.length,
      source_sync_gate_status: sourceSyncGateStatus,
      source_sync_can_generate_action_draft: this.booleanOrNull(gates?.canGenerateActionDraft),
      source_sync_can_recommend_ads_scale: this.booleanOrNull(gates?.canRecommendAdsScale),
      source_sync_can_use_google_ads_data_claim: this.booleanOrNull(gates?.canUseGoogleAdsDataClaim),
      source_sync_blocking_reasons: blockingReasons,
      evidence,
      gates,
    };
  }

  private clonePendingApproval(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null,
  ): AdsAutomationDecisionDraftPendingApprovalRecord | null {
    if (!pendingApproval) return null;

    return {
      ...pendingApproval,
      source_evidence_references: Array.isArray(pendingApproval.source_evidence_references)
        ? pendingApproval.source_evidence_references.map((item) => ({ ...item }))
        : [],
      sourceSyncDecisionEvidence: this.cloneSourceSyncEvidence(
        pendingApproval.sourceSyncDecisionEvidence || [],
      ),
      sourceSyncDecisionGates: this.cloneSourceSyncGates(
        pendingApproval.sourceSyncDecisionGates || null,
      ),
      blockers: Array.isArray(pendingApproval.blockers)
        ? [...pendingApproval.blockers]
        : [],
      missing_data_blockers: Array.isArray(pendingApproval.missing_data_blockers)
        ? [...pendingApproval.missing_data_blockers]
        : [],
    };
  }

  private cloneSourceSyncEvidence(
    evidence: SourceSyncDecisionEvidence[],
  ): SourceSyncDecisionEvidence[] {
    return evidence.map((record) => ({
      ...record,
      blockingReasons: Array.isArray(record.blockingReasons)
        ? [...record.blockingReasons]
        : [],
    }));
  }

  private cloneSourceSyncGates(
    gates: Partial<SourceSyncDecisionGates> | null,
  ): Partial<SourceSyncDecisionGates> | null {
    return gates ? { ...gates } : null;
  }

  private isProviderAction(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord,
  ): boolean {
    return pendingApproval.action_family === 'provider_google_ads'
      && pendingApproval.provider === 'google'
      && ['update_campaign_budget', 'pause_campaign', 'pause_ad_group', 'monitor_only']
        .includes(pendingApproval.action_type);
  }

  private pendingActionId(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord,
  ): string {
    return this.text(pendingApproval.typedPayload?.pending_action_id)
      || `PENDING-APPROVAL:${pendingApproval.approval_id}`;
  }

  private reportDate(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord,
  ): string {
    const payload = this.record(pendingApproval.typedPayload);
    const sourceDate = this.text(payload.reportDate)
      || pendingApproval.createdAt.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(sourceDate)
      ? sourceDate
      : new Date(pendingApproval.createdAt).toISOString().slice(0, 10);
  }

  private requiredText(value: unknown, field: string): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }
    return normalized;
  }

  private uniqueText(values: unknown[]): string[] {
    return [...new Set(values.map((value) => this.text(value)).filter((value): value is string => Boolean(value)))];
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private recordOrNull(value: unknown): Record<string, unknown> | null {
    const record = this.record(value);
    return Object.keys(record).length ? record : null;
  }

  private booleanOrNull(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private customerId(value: unknown): string | null {
    const text = this.text(value);
    if (!text) return null;
    const digits = text.replace(/\D/g, '');
    return /^\d{10}$/.test(digits) ? digits : null;
  }

  private numberOrNull(value: unknown): number | null {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }
}
