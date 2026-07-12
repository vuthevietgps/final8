import { AdsAutomationApprovalEvidenceIndexService } from './ads-automation-approval-evidence-index.service';
import { AdsAutomationApprovalEvidenceReviewExportService } from './ads-automation-approval-evidence-review-export.service';
import { buildAdsAutomationApprovalEvidenceReviewFixtureRecords } from './ads-automation-approval-evidence-review-export.fixture';
import { AdsAutomationApprovalEvidenceReviewerDocsService } from './ads-automation-approval-evidence-reviewer-docs.service';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import { AdsAutomationExecutionPreflightDryRunRepository } from './ads-automation-execution-preflight-dry-run.repository';
import { AdsAutomationPolicyDecisionEvidenceRepository } from './ads-automation-policy-decision-evidence.repository';
import { AdsAutomationValidateOnlyEvidenceRepository } from './ads-automation-validate-only-evidence.repository';

const approvalId = 'ADSAPPROVAL-reviewer-docs-20260704-update_campaign_budget-2001';

describe('AdsAutomationApprovalEvidenceReviewerDocsService', () => {
  let approvalRepository: jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
  let preflightRepository: jest.Mocked<AdsAutomationExecutionPreflightDryRunRepository>;
  let policyEvidenceRepository: jest.Mocked<AdsAutomationPolicyDecisionEvidenceRepository>;
  let validateOnlyEvidenceRepository: jest.Mocked<AdsAutomationValidateOnlyEvidenceRepository>;
  let service: AdsAutomationApprovalEvidenceReviewerDocsService;

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
    service = new AdsAutomationApprovalEvidenceReviewerDocsService(
      new AdsAutomationApprovalEvidenceReviewExportService(
        new AdsAutomationApprovalEvidenceIndexService(
          preflightRepository,
          policyEvidenceRepository,
          validateOnlyEvidenceRepository,
          approvalRepository,
        ),
      ),
    );
  });

  it('renders linked in-memory reviewer docs without repository reads or persistence', async () => {
    const response = await service.buildByApprovalId(approvalId, { fixture: 'linked' });

    expect(validateOnlyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(approvalRepository.findByApprovalId).not.toHaveBeenCalled();
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_approval_evidence_reviewer_docs.v1');
    expect(response.docsMode).toBe('local_demo_fixture_docs');
    expect(response.query).toEqual({
      approval_id: approvalId,
      fixture: 'linked_budget_update_evidence',
    });
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      in_memory_only: true,
      persistence_used: false,
      durable_storage_used: false,
      erp_local_persistence_used: false,
      reviewer_docs_readback: true,
      reviewer_docs_persistence_performed: false,
      reviewer_export_persistence_performed: false,
      demo_fixture_used: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      live_path_implemented: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      docs_status: 'ready_for_review',
      docs_mode: 'local_demo_fixture_docs',
      source_export_mode: 'local_demo_fixture',
      total_evidence_records_rendered: 8,
      validateOnly_evidence_records_rendered: 1,
      policy_decision_records_rendered: 1,
      execution_preflight_records_rendered: 1,
      pending_approval_record_rendered: true,
      pending_action_review_evidence_records_rendered: 1,
      source_sync_decision_evidence_records_rendered: 5,
      source_sync_decision_blocked_sources_rendered: 0,
      source_sync_gate_status: 'ready',
      source_sync_can_generate_action_draft: true,
      source_sync_can_recommend_ads_scale: true,
      source_sync_can_use_google_ads_data_claim: true,
      source_sync_blocking_reasons_rendered: [],
      provider_account_readiness_status: 'ready_for_local_validate_only',
      provider_account_readiness_blocked_actions_rendered: 0,
      provider_account_readiness_blocking_reasons_rendered: [],
      provider_account_readiness_campaignBudgetId_no_fallback: true,
      provider_account_readiness_scale_up_execution_mode: 'pending_validation',
      linked_validateOnly_evidence_records: 1,
      linked_policy_decision_records: 1,
      route_examples_rendered: 2,
      sections_rendered: 6,
      reviewer_docs_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_reviewer_docs',
    }));
    expect(response.routeExamples).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Reviewer docs',
        method: 'GET',
        path: expect.stringContaining('/evidence-index/reviewer-docs'),
        query: 'fixture=linked_budget_update_evidence',
        provider_api_called: false,
        erp_mutation_used: false,
      }),
      expect.objectContaining({
        label: 'Reviewer export JSON',
        path: expect.stringContaining('/evidence-index/reviewer-export'),
        query: 'fixture=linked_budget_update_evidence',
      }),
    ]));
    expect(response.renderedSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section_id: 'linked_evidence',
        status: 'ready_for_review',
        evidence_record_ids: expect.arrayContaining([
          response.reviewerExport.evidenceIndex.executionPreflightDryRunRecords[0].execution_record_id,
          response.reviewerExport.evidenceIndex.validateOnlyEvidenceRecords[0].validation_id,
          response.reviewerExport.evidenceIndex.policyDecisionEvidenceRecords[0].policy_decision_id,
        ]),
      }),
      expect.objectContaining({
        section_id: 'safety_gates',
        lines: expect.arrayContaining([
          'execution_allowed_now=false',
          'provider_api_called=false',
          'google_ads_api_called=false',
          'validateOnly_called=false',
          'live_ads_execution_used=false',
        ]),
      }),
      expect.objectContaining({
        section_id: 'source_sync_evidence',
        status: 'ready_for_review',
        lines: expect.arrayContaining([
          'Pending approval source-sync record: found',
          'Source-sync evidence records: 5',
          'Blocked source-sync sources: 0',
          'Gate canGenerateActionDraft: true',
          'Gate canRecommendAdsScale: true',
          'Gate canUseGoogleAdsDataClaim: true',
          'Source-sync blocking reasons: none',
        ]),
        evidence_record_ids: expect.arrayContaining(['source-sync:google_ads']),
      }),
      expect.objectContaining({
        section_id: 'pending_action_readiness_evidence',
        status: 'ready_for_review',
        lines: expect.arrayContaining([
          'Pending action review evidence records: 1',
          'Provider account readiness status: ready_for_local_validate_only',
          'Provider readiness blocked actions: 0',
          'Provider campaignBudgetId no fallback: true',
          'Provider scale-up execution mode: pending_validation',
        ]),
        evidence_record_ids: expect.arrayContaining([`pending-action:${approvalId}`]),
      }),
    ]));
    expect(response.markdownPreview).toContain('Ads Approval Evidence Review');
    expect(response.markdownPreview).toContain('Source-sync gate status: ready');
    expect(response.markdownPreview).toContain('Gate canRecommendAdsScale: true');
    expect(response.markdownPreview).toContain('Provider readiness status: ready_for_local_validate_only');
    expect(response.markdownPreview).toContain('Safety gates: execution_allowed_now=false');
    expect(response.reviewerExport.summary.export_status).toBe('ready_for_review');
  });

  it('renders an empty repository readback docs shape without creating evidence', async () => {
    validateOnlyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    policyEvidenceRepository.listByApprovalId.mockResolvedValueOnce([]);
    preflightRepository.listByApprovalId.mockResolvedValueOnce([]);

    const response = await service.buildByApprovalId(' ADSAPPROVAL-empty-docs ');

    expect(validateOnlyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty-docs');
    expect(policyEvidenceRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty-docs');
    expect(preflightRepository.listByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty-docs');
    expect(approvalRepository.findByApprovalId).toHaveBeenCalledWith('ADSAPPROVAL-empty-docs');
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.docsMode).toBe('local_readback_docs');
    expect(response.summary).toEqual(expect.objectContaining({
      docs_status: 'empty',
      source_export_mode: 'local_readback',
      total_evidence_records_rendered: 0,
      validateOnly_evidence_records_rendered: 0,
      policy_decision_records_rendered: 0,
      execution_preflight_records_rendered: 0,
      pending_approval_record_rendered: false,
      pending_action_review_evidence_records_rendered: 0,
      source_sync_decision_evidence_records_rendered: 0,
      source_sync_gate_status: 'not_available',
      source_sync_can_recommend_ads_scale: null,
      provider_account_readiness_status: 'not_available',
      reviewer_docs_persistence_performed: false,
      reviewer_export_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'verify_approval_id_or_generate_preflight_evidence',
    }));
    expect(response.routeExamples[0].query).toBeNull();
    expect(response.renderedSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section_id: 'linked_evidence',
        status: 'empty',
        lines: expect.arrayContaining([
          'Execution records: none',
          'Linked validate-only evidence: none',
          'Linked policy decisions: none',
        ]),
        evidence_record_ids: [],
      }),
      expect.objectContaining({
        section_id: 'source_sync_evidence',
        status: 'empty',
        lines: expect.arrayContaining([
          'Pending approval source-sync record: missing',
          'Source-sync evidence records: 0',
          'Source-sync blocking reasons: none',
        ]),
      }),
    ]));
    expect(response.markdownPreview).toContain('Evidence records: 0');
    expect(response.reviewerExport.evidenceIndex.validateOnlyEvidenceRecords).toEqual([]);
    expect(response.reviewerExport.evidenceIndex.policyDecisionEvidenceRecords).toEqual([]);
    expect(response.reviewerExport.evidenceIndex.executionPreflightDryRunRecords).toEqual([]);
  });

  it('renders linked repository evidence docs without additional persistence', async () => {
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

    expect(response.docsMode).toBe('local_readback_docs');
    expect(response.summary).toEqual(expect.objectContaining({
      docs_status: 'ready_for_review',
      source_export_mode: 'local_readback',
      total_evidence_records_rendered: 8,
      linked_validateOnly_evidence_records: 1,
      linked_policy_decision_records: 1,
      pending_approval_record_rendered: true,
      pending_action_review_evidence_records_rendered: 1,
      source_sync_decision_evidence_records_rendered: 5,
      source_sync_gate_status: 'ready',
      source_sync_can_recommend_ads_scale: true,
      provider_account_readiness_status: 'ready_for_local_validate_only',
      reviewer_docs_persistence_performed: false,
      reviewer_export_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.renderedSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section_id: 'linked_evidence',
        lines: expect.arrayContaining([
          `Execution records: ${fixtureRecords.executionPreflightDryRunRecords[0].execution_record_id}`,
          `Linked validate-only evidence: ${fixtureRecords.validateOnlyEvidenceRecords[0].validation_id}`,
          `Linked policy decisions: ${fixtureRecords.policyDecisionEvidenceRecords[0].policy_decision_id}`,
        ]),
      }),
      expect.objectContaining({
        section_id: 'source_sync_evidence',
        status: 'ready_for_review',
        evidence_record_ids: expect.arrayContaining(['source-sync:google_ads']),
      }),
      expect.objectContaining({
        section_id: 'pending_action_readiness_evidence',
        lines: expect.arrayContaining([
          'Provider account readiness status: ready_for_local_validate_only',
        ]),
      }),
    ]));
    expect(validateOnlyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.createManyIdempotent).not.toHaveBeenCalled();
    expect(preflightRepository.createManyIdempotent).not.toHaveBeenCalled();
  });

  it('renders the scale recommendation gate blocker fixture with complete source rows', async () => {
    const response = await service.buildByApprovalId(approvalId, {
      fixture: 'scale_recommendation_gate_blocker_evidence',
    });

    expect(response.docsMode).toBe('local_demo_fixture_docs');
    expect(response.summary).toEqual(expect.objectContaining({
      docs_status: 'ready_for_review',
      source_export_mode: 'local_demo_fixture',
      total_evidence_records_rendered: 5,
      pending_approval_record_rendered: true,
      pending_action_review_evidence_records_rendered: 1,
      source_sync_decision_evidence_records_rendered: 5,
      source_sync_decision_blocked_sources_rendered: 0,
      source_sync_gate_status: 'blocked',
      source_sync_can_generate_action_draft: true,
      source_sync_can_recommend_ads_scale: false,
      source_sync_can_use_google_ads_data_claim: true,
      source_sync_blocking_reasons_rendered: [
        'source_sync_gate_blocked_ads_scale_recommendation',
      ],
      provider_account_readiness_status: 'ready_for_local_validate_only',
      provider_account_readiness_blocked_actions_rendered: 0,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.renderedSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section_id: 'source_sync_evidence',
        status: 'attention',
        lines: expect.arrayContaining([
          'Pending approval source-sync record: found',
          'Source-sync evidence records: 5',
          'Blocked source-sync sources: 0',
          'Gate canGenerateActionDraft: true',
          'Gate canRecommendAdsScale: false',
          'Gate canUseGoogleAdsDataClaim: true',
          'Source-sync blocking reasons: source_sync_gate_blocked_ads_scale_recommendation',
        ]),
        evidence_record_ids: expect.arrayContaining([
          'source-sync:google_ads',
          'source-sync:supplier_safety',
        ]),
      }),
    ]));
    expect(response.markdownPreview).toContain('Gate canRecommendAdsScale: false');
    expect(response.markdownPreview).toContain('Source-sync blockers: source_sync_gate_blocked_ads_scale_recommendation');
    expect(response.reviewerExport.evidenceIndex.sourceSyncDecisionEvidence).toHaveLength(5);
    expect(validateOnlyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(policyEvidenceRepository.listByApprovalId).not.toHaveBeenCalled();
    expect(preflightRepository.listByApprovalId).not.toHaveBeenCalled();
  });
});
