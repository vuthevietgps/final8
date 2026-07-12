import { BadRequestException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import { AdsAutomationApprovalEvidenceIndexService } from './ads-automation-approval-evidence-index.service';
import { AdsAutomationExecutionPreflightDryRunRepository } from './ads-automation-execution-preflight-dry-run.repository';
import { AdsAutomationPolicyDecisionEvidenceRepository } from './ads-automation-policy-decision-evidence.repository';
import { AdsAutomationValidateOnlyEvidenceRepository } from './ads-automation-validate-only-evidence.repository';
import type { AdsAutomationDecisionDraftPendingApprovalRecord } from './contracts/ads-automation-decision-draft-approval.contract';
import type { AdsAutomationExecutionPreflightDryRunRecord } from './contracts/ads-automation-execution-preflight-dry-run.contract';
import type { AdsAutomationPolicyDecisionEvidenceRecord } from './contracts/ads-automation-policy-decision-evidence.contract';
import type { AdsAutomationValidateOnlyEvidenceRecord } from './contracts/ads-automation-validate-only-evidence.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from './source-sync/source-sync-result.types';

const approvalId = 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001';

function validateOnlyEvidence(
  overrides: Partial<AdsAutomationValidateOnlyEvidenceRecord> = {},
): AdsAutomationValidateOnlyEvidenceRecord {
  return {
    schemaVersion: 'ads_automation_validate_only_evidence.v1',
    validation_id: 'ADSPROVIDERVALIDATE-ADSAPPROVAL-2001',
    idempotency_key: 'ads-validate-only-evidence:ADSAPPROVAL-2001:REQ-VALIDATE',
    pending_action_id: 'ADSPENDINGACTION-ADSAPPROVAL-2001',
    approval_id: approvalId,
    source_pending_action_status: 'pending_validation',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    customerId: '1234567890',
    campaignId: '1001',
    adGroupId: '2001',
    campaignBudgetId: '3001',
    campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
    requested_change: { campaignBudgetId: '3001', dailyBudget: 1200000 },
    status: 'validate_only_passed',
    providerValidationStatus: 'provider_validate_passed',
    providerRequestId: 'REQ-VALIDATE-MOCK',
    providerValidatedAt: '2026-07-04T06:00:00.000Z',
    providerValidationErrors: [],
    before_state_snapshot: {
      snapshot_status: 'mocked_boundary_snapshot',
      required_before_future_execution: true,
      source: 'erp_synced_google_ads_read_model',
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      snapshot: { syncedAt: '2026-07-04T05:55:00.000Z' },
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
      evidence: ['Mocked validate-only evidence stayed ERP-local.'],
    },
    blockers: [],
    approval_can_be_considered_executable: true,
    executable_now: false,
    execution_allowed_now: false,
    validate_only_required_before_execution: true,
    next_required_action: 'continue_human_approval_flow',
    source_pending_action: {} as any,
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
    requestId: 'REQ-VALIDATE',
    createdAt: '2026-07-04T06:10:00.000Z',
    persistedAt: '2026-07-04T06:10:01.000Z',
    ...overrides,
  };
}

function policyEvidence(
  overrides: Partial<AdsAutomationPolicyDecisionEvidenceRecord> = {},
): AdsAutomationPolicyDecisionEvidenceRecord {
  return {
    schemaVersion: 'ads_automation_execution_policy_decision_evidence.v1',
    policy_decision_id: 'ADSPOLICY-ADSAPPROVAL-2001-REQ-POLICY',
    idempotency_key: 'ads-policy-decision:ADSAPPROVAL-2001:REQ-POLICY',
    approval_id: approvalId,
    policy_allowed: true,
    policy_source: 'erp_cashflow_ads_policy',
    blockers: [],
    evaluatedAt: '2026-07-04T06:00:00.000Z',
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
    requestId: 'REQ-POLICY',
    createdAt: '2026-07-04T06:10:00.000Z',
    persistedAt: '2026-07-04T06:10:01.000Z',
    ...overrides,
  };
}

function executionRecord(
  overrides: Partial<AdsAutomationExecutionPreflightDryRunRecord> = {},
): AdsAutomationExecutionPreflightDryRunRecord {
  return {
    execution_record_id: 'ADSEXEC-DRYRUN-ADSAPPROVAL-2001-REQ-PREFLIGHT',
    idempotency_key: 'ads-execution-preflight:ADSAPPROVAL-2001:REQ-PREFLIGHT',
    approval_id: approvalId,
    source_draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
    source_decision_id: 'DEC-scale_amount-2001',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    accountId: '1234567890',
    platform: 'google',
    approval_status: 'approved',
    approval_decision_audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-approve',
    approval_decision_audit_persisted: true,
    source_readiness_safe: true,
    kill_switch_active: false,
    kill_switch_reason: null,
    validateOnly_validation_id: 'ADSPROVIDERVALIDATE-ADSAPPROVAL-2001',
    validateOnly_evidence_persisted: true,
    validateOnly_status: 'validate_only_passed',
    policy_decision_id: 'ADSPOLICY-ADSAPPROVAL-2001-REQ-POLICY',
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
    requested_change: {
      action_type: 'update_campaign_budget',
      campaignBudgetId: '3001',
      dailyBudget: 1200000,
    },
    identifiers: {
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
    },
    gates: [],
    blockers: ['GOOGLE_ADS_PRODUCTION_ENABLED'],
    next_required_action: 'fix_preflight_blockers_before_future_execution',
    source_pending_approval: {} as any,
    source_validateOnly_plan: null,
    policy_decision: {
      approval_id: approvalId,
      policy_allowed: true,
      policy_source: 'erp_cashflow_ads_policy',
      blockers: [],
    },
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-PREFLIGHT',
    createdAt: '2026-07-04T06:10:00.000Z',
    persistedAt: '2026-07-04T06:11:00.000Z',
    ...overrides,
  };
}

function pendingApproval(
  overrides: Partial<AdsAutomationDecisionDraftPendingApprovalRecord> = {},
): AdsAutomationDecisionDraftPendingApprovalRecord {
  return {
    approval_id: approvalId,
    source_schema_version: 'ads_automation_decision_draft_preview.v1',
    source_draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
    source_decision_id: 'DEC-scale_amount-2001',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    accountId: '1234567890',
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
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      dailyBudget: 1200000,
    },
    source_evidence_references: [],
    sourceSyncDecisionEvidence: [
      {
        sourceKey: 'google_ads',
        reportDate: '2026-07-04',
        freshnessStatus: 'stale',
        coverageStatus: 'covered',
        lastSuccessfulSyncAt: '2026-07-03T20:00:00.000Z',
        latestRecordDate: '2026-07-04',
        blockingReason: 'google_ads_not_ready_for_ads_automation_decision',
        blockingReasons: [
          'freshness_stale',
          'google_ads_not_ready_for_ads_automation_decision',
        ],
        canUseForAdsAutomationDecision: false,
      },
      {
        sourceKey: 'advertising_costs',
        reportDate: '2026-07-04',
        freshnessStatus: 'fresh',
        coverageStatus: 'covered',
        lastSuccessfulSyncAt: null,
        latestRecordDate: '2026-07-04',
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
    ],
    sourceSyncDecisionGates: {
      canRecommendAdsScale: false,
      canConcludeProfitStrongly: false,
      canEvaluateSalesToday: false,
      canEvaluateFinanceStrongly: false,
      canUseLtvStrongly: false,
      canGenerateActionDraft: false,
      canUseGoogleAdsDataClaim: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
    blockers: [],
    missing_data_blockers: [],
    idempotency_key: 'ads-draft:2026-07-04:update_campaign_budget:2001',
    rationale: 'Budget increase is capped by ERP policy and still requires approval.',
    createdAt: '2026-07-04T06:10:00.000Z',
    persistedAt: '2026-07-04T06:10:01.000Z',
    ...overrides,
  };
}

function completeUsableSourceSyncDecisionEvidence(): SourceSyncDecisionEvidence[] {
  return [
    'google_ads',
    'advertising_costs',
    'product_mapping',
    'inventory_profit',
    'supplier_safety',
  ].map((sourceKey) => ({
    sourceKey,
    reportDate: '2026-07-04',
    freshnessStatus: 'fresh',
    coverageStatus: sourceKey === 'product_mapping' ? 'not_applicable' : 'covered',
    lastSuccessfulSyncAt: sourceKey === 'advertising_costs' || sourceKey === 'product_mapping'
      ? null
      : '2026-07-04T05:30:00.000Z',
    latestRecordDate: sourceKey === 'product_mapping' ? null : '2026-07-04',
    blockingReason: null,
    blockingReasons: [],
    canUseForAdsAutomationDecision: true,
  }));
}

function readySourceSyncDecisionGates(
  overrides: Partial<SourceSyncDecisionGates> = {},
): Partial<SourceSyncDecisionGates> {
  return {
    canRecommendAdsScale: true,
    canConcludeProfitStrongly: true,
    canEvaluateSalesToday: true,
    canEvaluateFinanceStrongly: true,
    canUseLtvStrongly: true,
    canGenerateActionDraft: true,
    canUseGoogleAdsDataClaim: true,
    canImportActionFile: false,
    canDryRun: false,
    canExecuteLive: false,
    ...overrides,
  };
}

describe('AdsAutomationApprovalEvidenceIndexService', () => {
  let approvalRepository: jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
  let preflightRepository: jest.Mocked<AdsAutomationExecutionPreflightDryRunRepository>;
  let policyEvidenceRepository: jest.Mocked<AdsAutomationPolicyDecisionEvidenceRepository>;
  let validateOnlyEvidenceRepository: jest.Mocked<AdsAutomationValidateOnlyEvidenceRepository>;
  let service: AdsAutomationApprovalEvidenceIndexService;

  beforeEach(() => {
    approvalRepository = {
      findByApprovalId: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
    preflightRepository = {
      listByApprovalId: jest.fn(),
      createManyIdempotent: jest.fn(),
    } as unknown as jest.Mocked<AdsAutomationExecutionPreflightDryRunRepository>;
    policyEvidenceRepository = {
      listByApprovalId: jest.fn(),
      createManyIdempotent: jest.fn(),
    } as unknown as jest.Mocked<AdsAutomationPolicyDecisionEvidenceRepository>;
    validateOnlyEvidenceRepository = {
      listByApprovalId: jest.fn(),
      createManyIdempotent: jest.fn(),
    } as unknown as jest.Mocked<AdsAutomationValidateOnlyEvidenceRepository>;
    service = new AdsAutomationApprovalEvidenceIndexService(
      preflightRepository,
      policyEvidenceRepository,
      validateOnlyEvidenceRepository,
      approvalRepository,
    );
  });

  it('returns an empty read-only evidence index without performing persistence', async () => {
    validateOnlyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    policyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    preflightRepository.listByApprovalId.mockResolvedValueOnce([]);

    const response = await service.buildByApprovalId(' ADSAPPROVAL-empty ');

    expect(validateOnlyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty');
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty');
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty');
    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty');
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_approval_evidence_index.v1');
    expect(response.query).toEqual({ approval_id: 'ADSAPPROVAL-empty' });
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'empty',
      validateOnly_evidence_records_matched: 0,
      policy_decision_records_matched: 0,
      execution_preflight_records_matched: 0,
      pending_approval_record_matched: false,
      source_sync_decision_evidence_records_matched: 0,
      source_sync_gate_status: 'not_available',
      source_sync_can_generate_action_draft: null,
      source_sync_can_recommend_ads_scale: null,
      source_sync_can_use_google_ads_data_claim: null,
      linked_validateOnly_evidence_records: 0,
      linked_policy_decision_records: 0,
      approval_evidence_index_persistence_performed: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'verify_approval_id_or_generate_preflight_evidence',
    }));
    expect(response.validateOnlyEvidenceRecords).toEqual([]);
    expect(response.policyDecisionEvidenceRecords).toEqual([]);
    expect(response.executionPreflightDryRunRecords).toEqual([]);
    expect(response.pendingApproval).toBeNull();
    expect(response.sourceSyncDecisionEvidence).toEqual([]);
    expect(response.sourceSyncDecisionGates).toBeNull();
  });

  it('aggregates linked validate-only, policy, and preflight records for one ERP approval id', async () => {
    const validateOnly = validateOnlyEvidence();
    const policy = policyEvidence();
    const preflight = executionRecord();
    validateOnlyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([validateOnly]);
    policyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([policy]);
    preflightRepository.listByApprovalId.mockResolvedValueOnce([preflight]);

    const response = await service.buildByApprovalId(approvalId);

    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'listed',
      validateOnly_evidence_records_matched: 1,
      policy_decision_records_matched: 1,
      execution_preflight_records_matched: 1,
      linked_validateOnly_evidence_records: 1,
      linked_policy_decision_records: 1,
      unlinked_validateOnly_validation_ids: 0,
      unlinked_policy_decision_ids: 0,
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
      next_required_action: 'inspect_approval_evidence_index',
    }));
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      live_path_implemented: false,
      approval_evidence_index_readback: true,
      approval_evidence_index_persistence_performed: false,
    }));
    expect(response.links).toEqual({
      execution_record_ids: [preflight.execution_record_id],
      validateOnly_validation_ids_from_preflight: [validateOnly.validation_id],
      validateOnly_validation_ids_with_evidence: [validateOnly.validation_id],
      validateOnly_validation_ids_missing_evidence: [],
      policy_decision_ids_from_preflight: [policy.policy_decision_id],
      policy_decision_ids_with_evidence: [policy.policy_decision_id],
      policy_decision_ids_missing_evidence: [],
    });
    expect(response.validateOnlyEvidenceRecords).toEqual([validateOnly]);
    expect(response.policyDecisionEvidenceRecords).toEqual([policy]);
    expect(response.executionPreflightDryRunRecords).toEqual([preflight]);
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
  });

  it('includes preserved pending approval source-sync evidence and gates in the read-only index', async () => {
    const approval = pendingApproval();
    validateOnlyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    policyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    preflightRepository.listByApprovalId.mockResolvedValueOnce([]);
    approvalRepository.findByApprovalId.mockResolvedValueOnce(approval);

    const response = await service.buildByApprovalId(approvalId);

    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith(approvalId);
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'listed',
      pending_approval_record_matched: true,
      source_sync_decision_evidence_records_matched: 2,
      source_sync_decision_blocked_sources: 1,
      source_sync_gate_status: 'blocked',
      source_sync_can_generate_action_draft: false,
      source_sync_can_recommend_ads_scale: false,
      source_sync_can_use_google_ads_data_claim: false,
      source_sync_blocking_reasons: expect.arrayContaining([
        'source_sync_gate_blocked_action_draft',
        'source_sync_gate_blocked_ads_scale_recommendation',
        'source_sync_gate_blocked_google_ads_data_claim',
        'freshness_stale',
        'google_ads_not_ready_for_ads_automation_decision',
      ]),
      pending_action_review_evidence_records_matched: 1,
      provider_account_readiness_status: 'blocked',
      provider_account_readiness_blocked_actions: 1,
      provider_account_readiness_blocking_reasons: expect.arrayContaining([
        'account_mapping.erpAccountMappingId_missing',
        'credential_readiness.missing',
        'permission_scope.ads.manage_budgets_missing',
        'permission_scope.ads.validate_only_missing',
      ]),
      provider_account_readiness_campaignBudgetId_no_fallback: true,
      provider_account_readiness_scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_approval_evidence_index',
    }));
    expect(response.pendingApproval).toEqual(expect.objectContaining({
      approval_id: approvalId,
      sourceSyncDecisionEvidence: expect.any(Array),
    }));
    expect(response.sourceSyncDecisionEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        canUseForAdsAutomationDecision: false,
      }),
    ]));
    expect(response.sourceSyncDecisionGates).toEqual(expect.objectContaining({
      canGenerateActionDraft: false,
      canUseGoogleAdsDataClaim: false,
    }));
    expect(response.pendingActionReviewEvidence[0]).toEqual(expect.objectContaining({
      action_type: 'update_campaign_budget',
      sourceSyncDecisionEvidence: expect.arrayContaining([
        expect.objectContaining({ sourceKey: 'google_ads' }),
      ]),
      providerAccountReadiness: expect.objectContaining({
        status: 'blocked_before_provider_boundary',
        accountMappingBlockers: expect.arrayContaining([
          'account_mapping.erpAccountMappingId_missing',
        ]),
        permissionScopeBlockers: expect.arrayContaining([
          'permission_scope.ads.manage_budgets_missing',
        ]),
        campaignBudgetIdNoFallback: true,
        execution_allowed_now: false,
      }),
    }));
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
  });

  it('blocks approval evidence index readiness when only canRecommendAdsScale is false', async () => {
    const approval = pendingApproval({
      sourceSyncDecisionEvidence: completeUsableSourceSyncDecisionEvidence(),
      sourceSyncDecisionGates: readySourceSyncDecisionGates({
        canRecommendAdsScale: false,
      }),
    });
    validateOnlyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    policyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    preflightRepository.listByApprovalId.mockResolvedValueOnce([]);
    approvalRepository.findByApprovalId.mockResolvedValueOnce(approval);

    const response = await service.buildByApprovalId(approvalId);

    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'listed',
      pending_approval_record_matched: true,
      source_sync_decision_evidence_records_matched: 5,
      source_sync_decision_blocked_sources: 0,
      source_sync_gate_status: 'blocked',
      source_sync_can_generate_action_draft: true,
      source_sync_can_recommend_ads_scale: false,
      source_sync_can_use_google_ads_data_claim: true,
      source_sync_blocking_reasons: [
        'source_sync_gate_blocked_ads_scale_recommendation',
      ],
      pending_action_review_evidence_records_matched: 1,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.sourceSyncDecisionEvidence).toHaveLength(5);
    expect(response.sourceSyncDecisionEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        canUseForAdsAutomationDecision: true,
      }),
      expect.objectContaining({
        sourceKey: 'supplier_safety',
        canUseForAdsAutomationDecision: true,
      }),
    ]));
    expect(response.pendingActionReviewEvidence[0]).toEqual(expect.objectContaining({
      sourceSyncDecisionGates: expect.objectContaining({
        canGenerateActionDraft: true,
        canRecommendAdsScale: false,
        canUseGoogleAdsDataClaim: true,
      }),
      source_sync_blocking_reasons: [
        'source_sync_gate_blocked_ads_scale_recommendation',
      ],
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
  });

  it('surfaces preflight records whose linked evidence has not been persisted locally', async () => {
    const preflight = executionRecord({
      validateOnly_validation_id: 'ADSPROVIDERVALIDATE-missing',
      policy_decision_id: 'ADSPOLICY-missing',
    });
    validateOnlyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    policyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    preflightRepository.listByApprovalId.mockResolvedValueOnce([preflight]);

    const response = await service.buildByApprovalId(approvalId);

    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'listed',
      linked_validateOnly_evidence_records: 0,
      linked_policy_decision_records: 0,
      unlinked_validateOnly_validation_ids: 1,
      unlinked_policy_decision_ids: 1,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.links.validateOnly_validation_ids_missing_evidence).toEqual(['ADSPROVIDERVALIDATE-missing']);
    expect(response.links.policy_decision_ids_missing_evidence).toEqual(['ADSPOLICY-missing']);
  });

  it('rejects a blank approval id before repository readback', async () => {
    await expect(service.buildByApprovalId('   ')).rejects.toThrow(BadRequestException);

    expect(validateOnlyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(approvalRepository.findByApprovalId).not.toHaveBeenCalled();
  });
});
