import { BadRequestException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import { AdsAutomationApprovalEvidenceIndexService } from './ads-automation-approval-evidence-index.service';
import { AdsAutomationApprovalEvidenceReviewExportService } from './ads-automation-approval-evidence-review-export.service';
import { buildAdsAutomationApprovalEvidenceReviewFixtureRecords } from './ads-automation-approval-evidence-review-export.fixture';
import { AdsAutomationExecutionPreflightDryRunRepository } from './ads-automation-execution-preflight-dry-run.repository';
import { AdsAutomationPolicyDecisionEvidenceRepository } from './ads-automation-policy-decision-evidence.repository';
import { AdsAutomationValidateOnlyEvidenceRepository } from './ads-automation-validate-only-evidence.repository';

const approvalId = 'ADSAPPROVAL-review-export-20260704-update_campaign_budget-2001';

describe('AdsAutomationApprovalEvidenceReviewExportService', () => {
  let approvalRepository: jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
  let preflightRepository: jest.Mocked<AdsAutomationExecutionPreflightDryRunRepository>;
  let policyEvidenceRepository: jest.Mocked<AdsAutomationPolicyDecisionEvidenceRepository>;
  let validateOnlyEvidenceRepository: jest.Mocked<AdsAutomationValidateOnlyEvidenceRepository>;
  let service: AdsAutomationApprovalEvidenceReviewExportService;

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
    service = new AdsAutomationApprovalEvidenceReviewExportService(
      new AdsAutomationApprovalEvidenceIndexService(
        preflightRepository,
        policyEvidenceRepository,
        validateOnlyEvidenceRepository,
        approvalRepository,
      ),
    );
  });

  it('returns a linked in-memory reviewer demo fixture without repository reads or persistence', async () => {
    const response = await service.buildByApprovalId(approvalId, { fixture: 'linked' });

    expect(validateOnlyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(approvalRepository.findByApprovalId).not.toHaveBeenCalled();
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_approval_evidence_review_export.v1');
    expect(response.exportMode).toBe('local_demo_fixture');
    expect(response.query).toEqual({
      approval_id: approvalId,
      fixture: 'linked_budget_update_evidence',
    });
    expect(response.fixture).toEqual(expect.objectContaining({
      scenario: 'linked_budget_update_evidence',
      persisted_to_db: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      in_memory_only: true,
      persistence_used: false,
      durable_storage_used: false,
      erp_local_persistence_used: false,
      reviewer_export_persistence_performed: false,
      demo_fixture_used: true,
      demo_fixture_persistence_performed: false,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      live_path_implemented: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'ready_for_review',
      export_mode: 'local_demo_fixture',
      total_evidence_records_included: 8,
      validateOnly_evidence_records_included: 1,
      policy_decision_records_included: 1,
      execution_preflight_records_included: 1,
      pending_approval_record_included: true,
      pending_action_review_evidence_records_included: 1,
      source_sync_decision_evidence_records_included: 5,
      source_sync_decision_blocked_sources: 0,
      source_sync_gate_status: 'ready',
      source_sync_can_generate_action_draft: true,
      source_sync_can_recommend_ads_scale: true,
      source_sync_can_use_google_ads_data_claim: true,
      source_sync_blocking_reasons: [],
      provider_account_readiness_status: 'ready_for_local_validate_only',
      provider_account_readiness_blocked_actions: 0,
      provider_account_readiness_blocking_reasons: [],
      provider_account_readiness_campaignBudgetId_no_fallback: true,
      provider_account_readiness_scale_up_execution_mode: 'pending_validation',
      linked_validateOnly_evidence_records: 1,
      linked_policy_decision_records: 1,
      unlinked_validateOnly_validation_ids: 0,
      unlinked_policy_decision_ids: 0,
      reviewer_export_persistence_performed: false,
      demo_fixture_persistence_performed: false,
      next_required_action: 'inspect_reviewer_export',
    }));
    expect(response.reviewerGuide.review_route).toContain('/evidence-index/reviewer-export');
    expect(response.reviewerGuide.demo_fixture_route).toContain('fixture=linked_budget_update_evidence');
    expect(response.evidenceIndex.links.validateOnly_validation_ids_with_evidence).toHaveLength(1);
    expect(response.evidenceIndex.links.policy_decision_ids_with_evidence).toHaveLength(1);
    expect(response.evidenceIndex.sourceSyncDecisionEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        canUseForAdsAutomationDecision: true,
      }),
      expect.objectContaining({
        sourceKey: 'supplier_safety',
        canUseForAdsAutomationDecision: true,
      }),
    ]));
    expect(response.evidenceIndex.sourceSyncDecisionGates).toEqual(expect.objectContaining({
      canGenerateActionDraft: true,
      canUseGoogleAdsDataClaim: true,
    }));
    expect(response.evidenceIndex.pendingActionReviewEvidence[0]).toEqual(expect.objectContaining({
      action_type: 'update_campaign_budget',
      sourceSyncDecisionEvidence: expect.arrayContaining([
        expect.objectContaining({ sourceKey: 'inventory_profit' }),
        expect.objectContaining({ sourceKey: 'supplier_safety' }),
      ]),
      providerAccountReadiness: expect.objectContaining({
        status: 'ready_for_future_validate_only',
        accountReadinessStatus: 'ready_for_local_validate_only',
        missingScopes: [],
        blockers: [],
        campaignBudgetIdNoFallback: true,
        campaignBudgetIdMissingNoFallback: false,
        execution_allowed_now: false,
      }),
    }));
    expect(response.evidenceIndex.executionPreflightDryRunRecords[0]).toEqual(expect.objectContaining({
      approval_id: approvalId,
      campaignBudgetId_fallback_used: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
  });

  it('returns an empty in-memory reviewer demo fixture without persistence', async () => {
    const response = await service.buildByApprovalId(approvalId, { fixture: 'empty_approval_evidence' });

    expect(response.exportMode).toBe('local_demo_fixture');
    expect(response.fixture).toEqual(expect.objectContaining({
      scenario: 'empty_approval_evidence',
      persisted_to_db: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'empty',
      total_evidence_records_included: 0,
      validateOnly_evidence_records_included: 0,
      policy_decision_records_included: 0,
      execution_preflight_records_included: 0,
      pending_action_review_evidence_records_included: 0,
      provider_account_readiness_status: 'not_available',
      next_required_action: 'verify_approval_id_or_generate_preflight_evidence',
    }));
    expect(response.evidenceIndex.validateOnlyEvidenceRecords).toEqual([]);
    expect(response.evidenceIndex.policyDecisionEvidenceRecords).toEqual([]);
    expect(response.evidenceIndex.executionPreflightDryRunRecords).toEqual([]);
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
  });

  it('wraps empty repository readback for one approval id without creating evidence', async () => {
    validateOnlyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    policyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    preflightRepository.listByApprovalId.mockResolvedValueOnce([]);

    const response = await service.buildByApprovalId(' ADSAPPROVAL-empty-export ');

    expect(validateOnlyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty-export');
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty-export');
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty-export');
    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty-export');
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.exportMode).toBe('local_readback');
    expect(response.fixture).toBeNull();
    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'empty',
      evidence_index_readback_status: 'empty',
      total_evidence_records_included: 0,
      pending_approval_record_included: false,
      pending_action_review_evidence_records_included: 0,
      source_sync_decision_evidence_records_included: 0,
      source_sync_gate_status: 'not_available',
      source_sync_can_recommend_ads_scale: null,
      provider_account_readiness_status: 'not_available',
      reviewer_export_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'verify_approval_id_or_generate_preflight_evidence',
    }));
  });

  it('wraps linked repository evidence for one approval id without additional persistence', async () => {
    const fixtureRecords = buildAdsAutomationApprovalEvidenceReviewFixtureRecords(
      approvalId,
      'linked_budget_update_evidence',
    );
    validateOnlyEvidenceRepository.listByApprovalId.mockResolvedValueOnce(
      fixtureRecords.validateOnlyEvidenceRecords,
    );
    policyEvidenceRepository.listByApprovalId.mockResolvedValueOnce(
      fixtureRecords.policyDecisionEvidenceRecords,
    );
    preflightRepository.listByApprovalId.mockResolvedValueOnce(
      fixtureRecords.executionPreflightDryRunRecords,
    );
    approvalRepository.findByApprovalId.mockResolvedValueOnce(fixtureRecords.pendingApproval);

    const response = await service.buildByApprovalId(approvalId);

    expect(response.exportMode).toBe('local_readback');
    expect(response.fixture).toBeNull();
    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'ready_for_review',
      evidence_index_readback_status: 'listed',
      total_evidence_records_included: 8,
      validateOnly_evidence_records_included: 1,
      policy_decision_records_included: 1,
      execution_preflight_records_included: 1,
      pending_approval_record_included: true,
      pending_action_review_evidence_records_included: 1,
      source_sync_decision_evidence_records_included: 5,
      source_sync_decision_blocked_sources: 0,
      source_sync_gate_status: 'ready',
      source_sync_can_recommend_ads_scale: true,
      provider_account_readiness_status: 'ready_for_local_validate_only',
      provider_account_readiness_blocked_actions: 0,
      linked_validateOnly_evidence_records: 1,
      linked_policy_decision_records: 1,
      unlinked_validateOnly_validation_ids: 0,
      unlinked_policy_decision_ids: 0,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      live_path_implemented: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.evidenceIndex.links).toEqual(expect.objectContaining({
      validateOnly_validation_ids_with_evidence: [
        fixtureRecords.validateOnlyEvidenceRecords[0].validation_id,
      ],
      policy_decision_ids_with_evidence: [
        fixtureRecords.policyDecisionEvidenceRecords[0].policy_decision_id,
      ],
    }));
    expect(response.evidenceIndex.pendingApproval).toEqual(expect.objectContaining({
      approval_id: approvalId,
      sourceSyncDecisionEvidence: expect.any(Array),
    }));
    expect(response.evidenceIndex.sourceSyncDecisionGates).toEqual(expect.objectContaining({
      canGenerateActionDraft: true,
      canRecommendAdsScale: true,
    }));
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
  });

  it('returns a scale recommendation gate blocker fixture with complete usable source rows', async () => {
    const response = await service.buildByApprovalId(approvalId, {
      fixture: 'scale_gate_blocker',
    });

    expect(response.exportMode).toBe('local_demo_fixture');
    expect(response.query.fixture).toBe('scale_recommendation_gate_blocker_evidence');
    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'ready_for_review',
      validateOnly_evidence_records_included: 0,
      policy_decision_records_included: 0,
      execution_preflight_records_included: 0,
      pending_approval_record_included: true,
      pending_action_review_evidence_records_included: 1,
      source_sync_decision_evidence_records_included: 5,
      source_sync_decision_blocked_sources: 0,
      source_sync_gate_status: 'blocked',
      source_sync_can_generate_action_draft: true,
      source_sync_can_recommend_ads_scale: false,
      source_sync_can_use_google_ads_data_claim: true,
      source_sync_blocking_reasons: [
        'source_sync_gate_blocked_ads_scale_recommendation',
      ],
      provider_account_readiness_status: 'ready_for_local_validate_only',
      provider_account_readiness_blocked_actions: 0,
      provider_account_readiness_blocking_reasons: [],
      provider_account_readiness_scale_up_execution_mode: 'pending_validation',
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_reviewer_export',
    }));
    expect(response.evidenceIndex.sourceSyncDecisionEvidence).toHaveLength(5);
    expect(response.evidenceIndex.sourceSyncDecisionEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        canUseForAdsAutomationDecision: true,
      }),
      expect.objectContaining({
        sourceKey: 'inventory_profit',
        canUseForAdsAutomationDecision: true,
      }),
      expect.objectContaining({
        sourceKey: 'supplier_safety',
        canUseForAdsAutomationDecision: true,
      }),
    ]));
    expect(response.evidenceIndex.sourceSyncDecisionGates).toEqual(expect.objectContaining({
      canGenerateActionDraft: true,
      canRecommendAdsScale: false,
      canUseGoogleAdsDataClaim: true,
    }));
    expect(response.evidenceIndex.pendingActionReviewEvidence[0]).toEqual(expect.objectContaining({
      action_type: 'update_campaign_budget',
      source_sync_blocking_reasons: [
        'source_sync_gate_blocked_ads_scale_recommendation',
      ],
      providerAccountReadiness: expect.objectContaining({
        status: 'ready_for_future_validate_only',
        accountReadinessStatus: 'ready_for_local_validate_only',
        blockers: [],
        execution_allowed_now: false,
      }),
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(validateOnlyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
  });

  it('returns a pause blocker fixture with provider permission readiness evidence beside the pending action', async () => {
    const response = await service.buildByApprovalId(approvalId, { fixture: 'pause_blocker' });

    expect(response.exportMode).toBe('local_demo_fixture');
    expect(response.query.fixture).toBe('pause_ad_group_blocker_evidence');
    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'ready_for_review',
      validateOnly_evidence_records_included: 0,
      policy_decision_records_included: 0,
      execution_preflight_records_included: 0,
      pending_approval_record_included: true,
      pending_action_review_evidence_records_included: 1,
      source_sync_decision_evidence_records_included: 5,
      source_sync_decision_blocked_sources: 1,
      source_sync_gate_status: 'blocked',
      provider_account_readiness_status: 'blocked',
      provider_account_readiness_blocked_actions: 1,
      provider_account_readiness_blocking_reasons: expect.arrayContaining([
        'permission_scope.ads.pause_missing',
      ]),
      provider_account_readiness_scale_up_execution_mode: 'monitor_only',
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.evidenceIndex.pendingActionReviewEvidence[0]).toEqual(expect.objectContaining({
      action_type: 'pause_ad_group',
      entity_id: '2002',
      providerAccountReadiness: expect.objectContaining({
        status: 'blocked_before_provider_boundary',
        permissionScopeBlockers: expect.arrayContaining([
          'permission_scope.ads.pause_missing',
        ]),
        missingScopes: expect.arrayContaining(['ads.pause']),
        execution_allowed_now: false,
      }),
    }));
  });

  it('returns an internal stop-import review blocker fixture with source evidence and no provider boundary requirement', async () => {
    const response = await service.buildByApprovalId(approvalId, {
      fixture: 'supplier_product_stop_import_review_blocker_evidence',
    });

    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'ready_for_review',
      pending_approval_record_included: true,
      pending_action_review_evidence_records_included: 1,
      source_sync_decision_evidence_records_included: 5,
      source_sync_decision_blocked_sources: 2,
      source_sync_gate_status: 'blocked',
      source_sync_blocking_reasons: expect.arrayContaining([
        'supplier_safety_not_ready_for_ads_automation_decision',
        'inventory_profit_not_ready_for_ads_automation_decision',
      ]),
      provider_account_readiness_status: 'not_applicable_internal_action',
      provider_account_readiness_blocked_actions: 0,
      provider_account_readiness_blocking_reasons: [],
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.evidenceIndex.pendingActionReviewEvidence[0]).toEqual(expect.objectContaining({
      action_type: 'stop_import_review',
      productId: 'P_BAD',
      supplierId: 'SUP_WEAK',
      source_sync_blocking_reasons: expect.arrayContaining([
        'supplier_safety_not_ready_for_ads_automation_decision',
      ]),
      providerAccountReadiness: expect.objectContaining({
        status: 'not_applicable_internal_action',
        providerApiRequired: false,
        validateOnlyRequiredBeforeExecution: false,
        execution_allowed_now: false,
      }),
    }));
  });

  it('returns Google Ads mock import validateOnlyPreflight blockers in the reviewer export without provider calls', async () => {
    const response = await service.buildByApprovalId(approvalId, {
      fixture: 'mock_preflight_blockers',
    });

    expect(validateOnlyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(approvalRepository.findByApprovalId).not.toHaveBeenCalled();
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.exportMode).toBe('local_demo_fixture');
    expect(response.query.fixture).toBe('google_ads_mock_validate_only_preflight_blockers');
    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'ready_for_review',
      total_evidence_records_included: 2,
      validateOnly_evidence_records_included: 0,
      policy_decision_records_included: 0,
      execution_preflight_records_included: 0,
      pending_approval_record_included: false,
      pending_action_review_evidence_records_included: 0,
      validateOnly_preflight_source_status: 'blocked_before_validateOnly',
      validateOnly_preflight_candidates_included: 2,
      validateOnly_preflight_blocked_candidates: 2,
      validateOnly_preflight_campaignBudgetId_blockers: 1,
      validateOnly_preflight_source_freshness_blockers: 1,
      validateOnly_preflight_product_mapping_blockers: 1,
      validateOnly_preflight_inventory_profit_blockers: 1,
      validateOnly_preflight_supplier_safety_blockers: 1,
      validateOnly_preflight_read_model_blockers: 2,
      validateOnly_preflight_safety_flags_closed: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      next_required_action: 'inspect_reviewer_export',
    }));
    expect(response.validateOnlyPreflightReview).toEqual(expect.objectContaining({
      status: 'blocked_before_validateOnly',
      source: 'erp_mock_import_read_model',
      pending_action_candidate_status: 'blocked_before_pending_action',
      candidate_count: 2,
      pending_action_count: 0,
      blocked_candidate_count: 2,
      blocked_source_keys: expect.arrayContaining([
        'google_ads',
        'product_mapping',
        'inventory_profit',
        'supplier_safety',
      ]),
      next_required_action: 'inspect_blocked_validate_only_preflight_candidates',
    }));
    expect(response.validateOnlyPreflightReview.closedSafetyFlags).toEqual({
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    });
    expect(response.validateOnlyPreflightReview.blockerGroups).toEqual(expect.objectContaining({
      campaignBudgetId: expect.arrayContaining([
        'campaignBudgetId_missing_no_fallback',
        'campaignBudgetId',
      ]),
      product_mapping: expect.arrayContaining([
        'product_mapping_missing',
        'product_mapping_not_ready_for_ads_automation_decision',
      ]),
      inventory_profit: expect.arrayContaining([
        'inventory_profit_not_ready_for_ads_automation_decision',
      ]),
      supplier_safety: expect.arrayContaining([
        'supplier_safety_not_ready_for_ads_automation_decision',
      ]),
      read_model: expect.arrayContaining([
        'read_model.campaignBudgetId_or_campaignBudgetResourceName_missing',
        'read_model.inventory_profit_missing_or_unsafe',
        'read_model.supplier_safety_missing_or_unsafe',
      ]),
    }));

    const missingBudgetCandidate = response.validateOnlyPreflightReview.candidates.find((candidate) => (
      candidate.candidate_id === 'ADSPREFLIGHT-ADSDRAFT-20260704-update_campaign_budget-2001'
    ));
    expect(missingBudgetCandidate).toEqual(expect.objectContaining({
      campaignBudgetId: null,
      campaignBudgetId_missing_no_fallback: true,
      candidate_status: 'blocked_before_pending_action',
      provider_validateOnly_readiness: 'blocked_before_validateOnly',
    }));
    expect(missingBudgetCandidate?.blockerGroups.campaignBudgetId).toEqual(expect.arrayContaining([
      'campaignBudgetId_missing_no_fallback',
    ]));
    expect(missingBudgetCandidate?.sourceReadiness).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        freshnessStatus: 'stale',
        canUseForAdsAutomationDecision: false,
        blockingReasons: expect.arrayContaining([
          'freshness_stale',
        ]),
      }),
      expect.objectContaining({
        sourceKey: 'product_mapping',
        coverageStatus: 'missing',
        canUseForAdsAutomationDecision: false,
        blockingReasons: expect.arrayContaining([
          'product_mapping_missing',
        ]),
      }),
    ]));
    expect(missingBudgetCandidate?.closedSafetyFlags).toEqual(expect.objectContaining({
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));

    const supplierSafetyCandidate = response.validateOnlyPreflightReview.candidates.find((candidate) => (
      candidate.candidate_id === 'ADSPREFLIGHT-ADSDRAFT-20260704-update_campaign_budget-P_BAD'
    ));
    expect(supplierSafetyCandidate).toEqual(expect.objectContaining({
      campaignBudgetId: '3002',
      campaignBudgetId_missing_no_fallback: false,
      productId: 'P_BAD',
      supplierId: 'SUP_WEAK_1',
      read_model_blockers: expect.arrayContaining([
        'read_model.inventory_profit_missing_or_unsafe',
        'read_model.supplier_safety_missing_or_unsafe',
      ]),
    }));
    expect(supplierSafetyCandidate?.sourceReadiness).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'inventory_profit',
        coverageStatus: 'missing',
        canUseForAdsAutomationDecision: false,
      }),
      expect.objectContaining({
        sourceKey: 'supplier_safety',
        coverageStatus: 'missing',
        canUseForAdsAutomationDecision: false,
      }),
    ]));
  });

  it('rejects unsupported fixture scenario values', async () => {
    await expect(service.buildByApprovalId(approvalId, { fixture: 'live' }))
      .rejects.toThrow(BadRequestException);

    expect(validateOnlyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
  });
});
