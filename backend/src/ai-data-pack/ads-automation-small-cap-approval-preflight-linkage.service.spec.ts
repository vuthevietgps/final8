import { BadRequestException } from '@nestjs/common';
import { AdsAutomationApprovalEvidenceIndexService } from './ads-automation-approval-evidence-index.service';
import { ADS_AUTOMATION_SMALL_CAP_APPROVAL_PREFLIGHT_LINKAGE_FIXTURE } from './ads-automation-small-cap-approval-preflight-linkage.fixture';
import { AdsAutomationSmallCapApprovalPreflightLinkageService } from './ads-automation-small-cap-approval-preflight-linkage.service';
import type {
  AdsAutomationApprovalEvidenceIndexResponse,
} from './contracts/ads-automation-approval-evidence-index.contract';
import type {
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './contracts/ads-automation-decision-draft-approval.contract';
import type {
  AdsAutomationExecutionPreflightDryRunRecord,
} from './contracts/ads-automation-execution-preflight-dry-run.contract';
import type {
  AdsAutomationPolicyDecisionEvidenceRecord,
} from './contracts/ads-automation-policy-decision-evidence.contract';
import type {
  AdsAutomationProviderValidateOnlyActionPlan,
} from './contracts/ads-automation-provider-validate-only.contract';
import type {
  AdsAutomationSmallCapReadinessSimulatorResponse,
} from './contracts/ads-automation-small-cap-readiness-simulator.contract';
import type {
  AdsAutomationValidateOnlyEvidenceRecord,
} from './contracts/ads-automation-validate-only-evidence.contract';

describe('AdsAutomationSmallCapApprovalPreflightLinkageService', () => {
  const service = new AdsAutomationSmallCapApprovalPreflightLinkageService();
  const evidenceIndexBuilder = new AdsAutomationApprovalEvidenceIndexService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it('links a small-cap budget candidate to approval, validateOnly, policy, and preflight evidence while execution stays blocked', () => {
    const approval = pendingApproval({ status: 'approved' });
    const validateOnly = validateOnlyEvidenceRecord(approval);
    const policy = policyEvidenceRecord(approval);
    const preflight = executionPreflightRecord(approval, validateOnly, policy);
    const response = service.build({
      reportDate: fixture.reportDate,
      now: fixture.now,
      fixtureMode: fixture.fixtureMode,
      simulatorResponse: simulatorResponse(),
      approvalEvidenceIndexes: [
        evidenceIndex(approval, [validateOnly], [policy], [preflight]),
      ],
    });

    expect(response.schemaVersion).toBe('ads_automation_small_cap_approval_preflight_linkage.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
      approval_evidence_readback_reused: true,
      validateOnly_evidence_readback_reused: true,
      policy_decision_evidence_readback_reused: true,
      execution_preflight_readback_reused: true,
      linkage_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      campaignBudgetId_no_fallback: true,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      status: 'linked_blocked_before_execution',
      small_cap_candidates: 1,
      approval_evidence_indexes_received: 1,
      candidates_with_approval_link: 1,
      candidates_with_validateOnly_evidence: 1,
      candidates_with_policy_evidence: 1,
      candidates_with_preflight_evidence: 1,
      fully_linked_candidates: 1,
      requested_increase_vnd: 200000,
      simulated_capped_increase_vnd: fixture.simulatedCappedIncreaseVnd,
      approved_increase_vnd: 0,
      executable_now: 0,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.candidateLinks[0]).toEqual(expect.objectContaining({
      status: 'linked_blocked_before_execution',
      approval_id: fixture.approvalId,
      approval_status: 'approved',
      campaignBudgetId: fixture.campaignBudgetId,
      approvalCampaignBudgetId: fixture.campaignBudgetId,
      campaignBudgetIdMatched: true,
      campaignBudgetIdNoFallback: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      evidenceCounts: expect.objectContaining({
        validateOnly_evidence_records: 1,
        policy_decision_records: 1,
        execution_preflight_records: 1,
        linked_validateOnly_ids: [fixture.validationId],
        linked_policy_decision_ids: [fixture.policyDecisionId],
        linked_execution_record_ids: [fixture.executionRecordId],
      }),
      blockers: expect.arrayContaining([
        'execution_allowed_now_false',
        'future_live_execution_allowed_false',
        'preflight.GOOGLE_ADS_PRODUCTION_ENABLED',
      ]),
    }));
    expect(response.sourceDigest).toEqual(expect.objectContaining({
      approval_ids: [fixture.approvalId],
      validateOnly_validation_ids: [fixture.validationId],
      policy_decision_ids: [fixture.policyDecisionId],
      execution_record_ids: [fixture.executionRecordId],
      decision_snapshot_reused: true,
      draft_preview_reused: true,
    }));
  });

  it('reports missing validateOnly, policy, and preflight evidence without opening any execution gate', () => {
    const approval = pendingApproval({ status: 'pending_approval' });
    const response = service.build({
      reportDate: fixture.reportDate,
      now: fixture.now,
      simulatorResponse: simulatorResponse(),
      approvalEvidenceIndexes: [evidenceIndex(approval, [], [], [])],
    });

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked_missing_evidence',
      candidates_with_approval_link: 1,
      candidates_with_validateOnly_evidence: 0,
      candidates_with_policy_evidence: 0,
      candidates_with_preflight_evidence: 0,
      fully_linked_candidates: 0,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.candidateLinks[0]).toEqual(expect.objectContaining({
      status: 'linked_missing_validateOnly_evidence',
      approval_id: fixture.approvalId,
      approval_status: 'pending_approval',
      blockers: expect.arrayContaining([
        'validateOnly_evidence_missing_for_approval',
        'policy_decision_evidence_missing_for_approval',
        'execution_preflight_readback_missing_for_approval',
      ]),
    }));
  });

  it('fails closed when approval evidence does not match the simulator campaignBudgetId', () => {
    const approval = pendingApproval({
      typedPayload: {
        ...pendingApproval().typedPayload,
        campaignBudgetId: '1001',
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/1001',
      },
    });
    const response = service.build({
      reportDate: fixture.reportDate,
      now: fixture.now,
      simulatorResponse: simulatorResponse(),
      approvalEvidenceIndexes: [evidenceIndex(approval, [], [], [])],
    });

    expect(response.summary).toEqual(expect.objectContaining({
      status: 'blocked_campaignBudgetId_mismatch',
      campaignBudgetId_mismatch_candidates: 1,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.candidateLinks[0]).toEqual(expect.objectContaining({
      status: 'linked_campaignBudgetId_mismatch',
      campaignBudgetId: fixture.campaignBudgetId,
      approvalCampaignBudgetId: '1001',
      campaignBudgetIdMatched: false,
      campaignBudgetIdNoFallback: true,
      blockers: expect.arrayContaining(['campaignBudgetId_linkage_missing_or_mismatch']),
    }));
    expect(response.candidateLinks[0].campaignBudgetId)
      .not.toBe(response.candidateLinks[0].campaignId);
    expect(response.candidateLinks[0].campaignBudgetId)
      .not.toBe(response.candidateLinks[0].adGroupId);
  });

  it('rejects malformed simulator payloads', () => {
    expect(() => service.build({
      simulatorResponse: { schemaVersion: 'wrong' } as any,
    })).toThrow(BadRequestException);
  });

  function evidenceIndex(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord,
    validateOnlyRecords: AdsAutomationValidateOnlyEvidenceRecord[],
    policyRecords: AdsAutomationPolicyDecisionEvidenceRecord[],
    preflightRecords: AdsAutomationExecutionPreflightDryRunRecord[],
  ): AdsAutomationApprovalEvidenceIndexResponse {
    return evidenceIndexBuilder.buildFromRecords(
      approval.approval_id,
      validateOnlyRecords,
      policyRecords,
      preflightRecords,
      fixture.now,
      approval.status === 'pending_approval' ? approval : null,
    );
  }
});

const fixture = ADS_AUTOMATION_SMALL_CAP_APPROVAL_PREFLIGHT_LINKAGE_FIXTURE;

function simulatorResponse(): AdsAutomationSmallCapReadinessSimulatorResponse {
  return {
    schemaVersion: 'ads_automation_small_cap_readiness_simulator.v1',
    generatedAt: fixture.now,
    reportDate: fixture.reportDate,
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
      campaignBudgetId_no_fallback: true,
      approval_required_for_all_drafts: true,
      future_provider_validateOnly_required_before_execution: true,
      future_live_execution_allowed: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      execution_allowed_now: false,
      production_ready: false,
      erp_only_future_validator_approver_executor: true,
    },
    summary: {
      status: 'ready_for_human_approval_dry_run',
      fixture_mode: 'htx_ads_small_cap_readiness_demo',
      reportDate: fixture.reportDate,
      provider_action_drafts: 1,
      update_budget_drafts: 1,
      eligible_small_cap_candidates: 1,
      blocked_small_cap_candidates: 0,
      requested_increase_vnd: fixture.requestedDailyBudgetVnd - fixture.currentDailyBudgetVnd,
      simulated_capped_increase_vnd: fixture.simulatedCappedIncreaseVnd,
      approved_increase_vnd: 0,
      blocked_increase_vnd: fixture.requestedDailyBudgetVnd - fixture.currentDailyBudgetVnd,
      scale_up_execution_mode: 'pending_validation',
      local_dry_run_only: true,
      small_cap_live_test_allowed: false,
      provider_validateOnly_required_before_future_execution: true,
      human_approval_required_before_future_execution: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      next_required_action: 'review_human_approval_dry_run_packet',
    },
    sourceDigest: {
      foundation_snapshot_schema_version: 'ads_automation_decision_foundation_snapshot.v1',
      draft_preview_schema_version: 'ads_automation_decision_draft_preview.v1',
      loss_limit_policy_schema_version: 'ads_automation_loss_limit_policy.v1',
      provider_account_readiness_schema_version: 'ads_automation_provider_account_readiness.v1',
      production_readiness_bridge_schema_version: null,
      source_snapshot_date: fixture.reportDate,
      draft_preview_source: 'decision_snapshot',
      decision_snapshot_reused: true,
      read_model_snapshot_preserved: true,
      draft_preview_reused: true,
    },
    budgetCandidates: [{
      draft_id: fixture.sourceDraftId,
      source_decision_id: fixture.sourceDecisionId,
      accountId: fixture.accountId,
      campaignId: fixture.campaignId,
      adGroupId: fixture.adGroupId,
      campaignBudgetId: fixture.campaignBudgetId,
      campaignBudgetResourceName: fixture.campaignBudgetResourceName,
      productId: 'P_SCALE',
      currentDailyBudgetVnd: fixture.currentDailyBudgetVnd,
      requestedDailyBudgetVnd: fixture.requestedDailyBudgetVnd,
      requestedIncreaseVnd: fixture.requestedDailyBudgetVnd - fixture.currentDailyBudgetVnd,
      maxSmallCapIncreaseVnd: fixture.simulatedCappedIncreaseVnd,
      maxSmallCapIncreasePercent: 10,
      capByPercentVnd: fixture.simulatedCappedIncreaseVnd,
      simulatedCappedIncreaseVnd: fixture.simulatedCappedIncreaseVnd,
      simulatedCappedDailyBudgetVnd: fixture.currentDailyBudgetVnd + fixture.simulatedCappedIncreaseVnd,
      approvedIncreaseVnd: 0,
      blockedIncreaseVnd: fixture.requestedDailyBudgetVnd - fixture.currentDailyBudgetVnd,
      campaignBudgetIdNoFallback: true,
      status: 'eligible_for_small_cap_simulation',
      blockers: [],
    }],
    stages: [],
    readinessBlockers: [],
    cashflowAndLossLimitBlockers: [],
    providerReadinessBlockers: [],
    allowedSafeActions: ['monitor_only'],
    reviewedDrafts: [],
    markdownPreview: 'Small-cap simulator fixture for approval/preflight linkage.',
  };
}

function pendingApproval(
  overrides: Partial<AdsAutomationDecisionDraftPendingApprovalRecord> = {},
): AdsAutomationDecisionDraftPendingApprovalRecord {
  return {
    approval_id: fixture.approvalId,
    source_schema_version: 'ads_automation_decision_draft_preview.v1',
    source_draft_id: fixture.sourceDraftId,
    source_decision_id: fixture.sourceDecisionId,
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: fixture.adGroupId,
    accountId: fixture.accountId,
    productId: 'P_SCALE',
    supplierId: null,
    platform: 'google',
    status: 'pending_approval',
    approval_required: true,
    execution_allowed_now: false,
    validate_only_required: true,
    future_provider_validateOnly_required: true,
    provider_api_called: false,
    google_ads_api_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    typedPayload: {
      customerId: fixture.accountId,
      campaignId: fixture.campaignId,
      adGroupId: fixture.adGroupId,
      campaignBudgetId: fixture.campaignBudgetId,
      campaignBudgetResourceName: fixture.campaignBudgetResourceName,
      currentBudgetVnd: fixture.currentDailyBudgetVnd,
      dailyBudget: fixture.requestedDailyBudgetVnd,
    },
    source_evidence_references: [],
    sourceSyncDecisionEvidence: [],
    sourceSyncDecisionGates: {
      canGenerateActionDraft: true,
      canRecommendAdsScale: true,
      canUseGoogleAdsDataClaim: true,
    },
    blockers: [],
    missing_data_blockers: [],
    idempotency_key: 'ads-draft:small-cap-linkage:update_campaign_budget:2001',
    rationale: 'Small-cap increase candidate requires approval and dry-run evidence linkage.',
    createdAt: '2026-07-04T06:00:00.000Z',
    persistedAt: '2026-07-04T06:00:00.000Z',
    ...overrides,
  };
}

function validateOnlyEvidenceRecord(
  approval: AdsAutomationDecisionDraftPendingApprovalRecord,
): AdsAutomationValidateOnlyEvidenceRecord {
  const plan = validateOnlyPlan(approval);
  return {
    ...plan,
    schemaVersion: 'ads_automation_validate_only_evidence.v1',
    idempotency_key: 'ads-validate-only-evidence:small-cap-linkage-demo',
    validateOnly_evidence_persisted: true,
    future_live_execution_allowed: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    direct_google_ads_api_call: false,
    provider_mutation_used: false,
    live_path_implemented: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-small-cap-linkage-demo',
    createdAt: '2026-07-04T06:20:00.000Z',
    persistedAt: '2026-07-04T06:20:00.000Z',
  };
}

function validateOnlyPlan(
  approval: AdsAutomationDecisionDraftPendingApprovalRecord,
): AdsAutomationProviderValidateOnlyActionPlan {
  return {
    validation_id: fixture.validationId,
    pending_action_id: `ADSPENDINGACTION-${approval.approval_id}`,
    approval_id: approval.approval_id,
    source_pending_action_status: 'pending_validation',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: fixture.adGroupId,
    customerId: fixture.accountId,
    campaignId: fixture.campaignId,
    adGroupId: fixture.adGroupId,
    campaignBudgetId: fixture.campaignBudgetId,
    campaignBudgetResourceName: fixture.campaignBudgetResourceName,
    requested_change: approval.typedPayload,
    status: 'validate_only_passed',
    providerValidationStatus: 'provider_validate_passed',
    providerRequestId: 'REQ-VALIDATE-small-cap-linkage-demo',
    providerValidatedAt: '2026-07-04T06:15:00.000Z',
    providerValidationErrors: [],
    before_state_snapshot: {
      snapshot_status: 'mocked_boundary_snapshot',
      required_before_future_execution: true,
      source: 'erp_synced_google_ads_read_model',
      customerId: fixture.accountId,
      campaignId: fixture.campaignId,
      adGroupId: fixture.adGroupId,
      campaignBudgetId: fixture.campaignBudgetId,
      campaignBudgetResourceName: fixture.campaignBudgetResourceName,
      snapshot: { status: 'ENABLED' },
    },
    provider_boundary_evidence: {
      boundary_mode: 'erp_local_mock_only',
      status_source: 'mock_provider_result',
      mocked_provider_result_used: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      direct_google_ads_api_call: false,
      operation_builder_called: false,
      raw_provider_request_included: false,
      evidence: ['Local mocked validateOnly evidence only.'],
    },
    blockers: [],
    approval_can_be_considered_executable: true,
    executable_now: false,
    execution_allowed_now: false,
    validate_only_required_before_execution: true,
    next_required_action: 'continue_human_approval_flow',
    source_pending_action: {} as any,
  };
}

function policyEvidenceRecord(
  approval: AdsAutomationDecisionDraftPendingApprovalRecord,
): AdsAutomationPolicyDecisionEvidenceRecord {
  return {
    schemaVersion: 'ads_automation_execution_policy_decision_evidence.v1',
    policy_decision_id: fixture.policyDecisionId,
    idempotency_key: 'ads-policy-decision:small-cap-linkage-demo',
    approval_id: approval.approval_id,
    policy_allowed: true,
    policy_source: 'erp_cashflow_ads_loss_policy',
    blockers: [],
    evaluatedAt: '2026-07-04T06:25:00.000Z',
    policy_decision_record_persisted: true,
    future_live_execution_allowed: false,
    execution_allowed_now: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    direct_google_ads_api_call: false,
    provider_mutation_used: false,
    live_path_implemented: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-small-cap-linkage-demo',
    createdAt: '2026-07-04T06:25:00.000Z',
    persistedAt: '2026-07-04T06:25:00.000Z',
  };
}

function executionPreflightRecord(
  approval: AdsAutomationDecisionDraftPendingApprovalRecord,
  validateOnly: AdsAutomationValidateOnlyEvidenceRecord,
  policy: AdsAutomationPolicyDecisionEvidenceRecord,
): AdsAutomationExecutionPreflightDryRunRecord {
  return {
    execution_record_id: fixture.executionRecordId,
    idempotency_key: 'ads-execution-preflight:small-cap-linkage-demo',
    approval_id: approval.approval_id,
    source_draft_id: approval.source_draft_id,
    source_decision_id: approval.source_decision_id,
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: fixture.adGroupId,
    accountId: fixture.accountId,
    platform: 'google',
    approval_status: approval.status,
    approval_decision_audit_id: 'ADSAUDIT-small-cap-linkage-demo-approve',
    approval_decision_audit_persisted: true,
    source_readiness_safe: true,
    kill_switch_active: false,
    kill_switch_reason: null,
    validateOnly_validation_id: validateOnly.validation_id,
    validateOnly_evidence_persisted: true,
    validateOnly_status: validateOnly.status,
    policy_decision_id: policy.policy_decision_id,
    policy_decision_evidence_persisted: true,
    policy_allowed: true,
    google_ads_production_enabled: false,
    preflight_status: 'blocked_before_future_live_execution',
    dry_run_record_status: 'recorded_local_only',
    future_live_execution_allowed: false,
    execution_allowed_now: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    direct_google_ads_api_call: false,
    provider_mutation_used: false,
    live_path_implemented: false,
    campaignBudgetId_fallback_used: false,
    preflight_record_persisted: true,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requested_change: approval.typedPayload,
    identifiers: {
      customerId: fixture.accountId,
      campaignId: fixture.campaignId,
      adGroupId: fixture.adGroupId,
      campaignBudgetId: fixture.campaignBudgetId,
      campaignBudgetResourceName: fixture.campaignBudgetResourceName,
    },
    gates: [
      {
        key: 'GOOGLE_ADS_PRODUCTION_ENABLED',
        status: 'blocked',
        detail: 'Production flag remains false for local-only dry-run evidence.',
      },
    ],
    blockers: ['GOOGLE_ADS_PRODUCTION_ENABLED'],
    next_required_action: 'fix_preflight_blockers_before_future_execution',
    source_pending_approval: approval,
    source_validateOnly_plan: validateOnly,
    policy_decision: {
      policy_decision_id: policy.policy_decision_id,
      approval_id: policy.approval_id,
      policy_allowed: policy.policy_allowed,
      policy_source: policy.policy_source,
      blockers: policy.blockers,
      evaluatedAt: policy.evaluatedAt,
      policy_decision_record_persisted: true,
      storage: 'erp_local_mongo',
      persistedAt: policy.persistedAt,
    },
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-small-cap-linkage-demo',
    createdAt: '2026-07-04T06:30:00.000Z',
    persistedAt: '2026-07-04T06:30:00.000Z',
  };
}
