import { BadRequestException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalDecisionAuditRepository } from './ads-automation-decision-draft-approval-decision-audit.repository';
import { AdsAutomationDecisionDraftApprovalDecisionMutationService } from './ads-automation-decision-draft-approval-decision-mutation.service';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import { AdsAutomationDecisionDraftApprovalQueueService } from './ads-automation-decision-draft-approval-queue.service';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
  AdsAutomationDecisionDraftApprovalFinalDecisionStatus,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './contracts/ads-automation-decision-draft-approval.contract';

function pendingApproval(
  overrides: Partial<AdsAutomationDecisionDraftPendingApprovalRecord> = {},
): AdsAutomationDecisionDraftPendingApprovalRecord {
  return {
    approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
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
      currentBudgetVnd: 1000000,
      increasePercent: 20,
    },
    source_evidence_references: [],
    sourceSyncDecisionEvidence: [
      {
        sourceKey: 'google_ads',
        reportDate: '2026-07-04',
        freshnessStatus: 'fresh',
        coverageStatus: 'covered',
        lastSuccessfulSyncAt: '2026-07-04T04:00:00.000Z',
        latestRecordDate: '2026-07-04',
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
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
      {
        sourceKey: 'product_mapping',
        reportDate: '2026-07-04',
        freshnessStatus: 'fresh',
        coverageStatus: 'not_applicable',
        lastSuccessfulSyncAt: null,
        latestRecordDate: null,
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: 'inventory_profit',
        reportDate: '2026-07-04',
        freshnessStatus: 'fresh',
        coverageStatus: 'covered',
        lastSuccessfulSyncAt: '2026-07-04T04:00:00.000Z',
        latestRecordDate: '2026-07-04',
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
      {
        sourceKey: 'supplier_safety',
        reportDate: '2026-07-04',
        freshnessStatus: 'fresh',
        coverageStatus: 'covered',
        lastSuccessfulSyncAt: '2026-07-04T04:00:00.000Z',
        latestRecordDate: '2026-07-04',
        blockingReason: null,
        blockingReasons: [],
        canUseForAdsAutomationDecision: true,
      },
    ],
    sourceSyncDecisionGates: {
      canRecommendAdsScale: true,
      canConcludeProfitStrongly: false,
      canEvaluateSalesToday: false,
      canEvaluateFinanceStrongly: false,
      canUseLtvStrongly: false,
      canGenerateActionDraft: true,
      canUseGoogleAdsDataClaim: true,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
    blockers: [],
    missing_data_blockers: [],
    idempotency_key: 'ads-draft:2026-07-04:update_campaign_budget:2001',
    rationale: 'Budget increase is capped by ERP policy and still requires approval.',
    createdAt: '2026-07-04T05:00:00.000Z',
    persistedAt: '2026-07-04T05:00:00.000Z',
    ...overrides,
  };
}

function persistedAudit(
  payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
  statusChangePerformed: boolean,
): AdsAutomationDecisionDraftApprovalDecisionAuditRecord {
  return {
    ...payload,
    idempotency_key: [
      'ads-decision-audit',
      payload.approval_id,
      payload.decision,
      payload.requestId || payload.audit_id,
    ].join(':'),
    audit_record_persisted: true,
    status_change_performed: statusChangePerformed,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    source_preview_createdAt: payload.createdAt,
    persistedAt: '2026-07-04T05:11:00.000Z',
  };
}

function createApprovalRepositoryMock(initialRecord = pendingApproval()) {
  const recordsByApprovalId = new Map<string, AdsAutomationDecisionDraftPendingApprovalRecord>([
    [initialRecord.approval_id, initialRecord],
  ]);
  return {
    findExistingIdempotencyKeys: jest.fn(),
    createMany: jest.fn(),
    listPendingApprovals: jest.fn(),
    countPendingApprovals: jest.fn(),
    findByApprovalId: jest.fn(async (approvalId: string) => {
      const record = recordsByApprovalId.get(approvalId);
      return record?.status === 'pending_approval' ? record : null;
    }),
    transitionPendingApprovalStatus: jest.fn(async (
      approvalId: string,
      status: AdsAutomationDecisionDraftApprovalFinalDecisionStatus,
    ) => {
      const record = recordsByApprovalId.get(approvalId);
      if (!record || record.status !== 'pending_approval') return null;
      const updated = { ...record, status };
      recordsByApprovalId.set(approvalId, updated);
      return updated;
    }),
  } as unknown as jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
}

describe('AdsAutomationDecisionDraftApprovalDecisionMutationService', () => {
  let approvalRepository: jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
  let auditRepository: jest.Mocked<AdsAutomationDecisionDraftApprovalDecisionAuditRepository>;
  let service: AdsAutomationDecisionDraftApprovalDecisionMutationService;

  beforeEach(() => {
    approvalRepository = createApprovalRepositoryMock();
    auditRepository = {
      createFromDecision: jest.fn(async (payload, statusChangePerformed) => (
        persistedAudit(payload, statusChangePerformed)
      )),
      createFromPreview: jest.fn(async (payload) => persistedAudit(payload, false)),
    } as unknown as jest.Mocked<AdsAutomationDecisionDraftApprovalDecisionAuditRepository>;
    const queueService = new AdsAutomationDecisionDraftApprovalQueueService(approvalRepository);
    service = new AdsAutomationDecisionDraftApprovalDecisionMutationService(
      queueService,
      approvalRepository,
      auditRepository,
    );
  });

  it('approves a validation-eligible provider draft with persisted audit and no ads execution', async () => {
    const response = await service.decidePendingApproval(pendingApproval().approval_id, {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Director reviewed ERP evidence and approves the capped budget change.',
      requestId: 'REQ-APPROVE-LOCAL-DRY-RUN',
    });

    expect(auditRepository.createFromDecision).toHaveBeenCalledWith(expect.objectContaining({
      decision: 'approve',
      proposed_status: 'approved',
      validation_status: 'eligible_for_human_decision',
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }), true);
    expect(approvalRepository.transitionPendingApprovalStatus).toHaveBeenCalledWith(
      pendingApproval().approval_id,
      'approved',
    );
    expect(response.schemaVersion).toBe('ads_automation_decision_draft_approval_decision_mutation.v1');
    expect(response.summary).toEqual(expect.objectContaining({
      mutation_status: 'approved',
      proposed_decision: 'approve',
      validation_status: 'eligible_for_human_decision',
      resulting_status: 'approved',
      audit_record_persisted: true,
      status_change_performed: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'future_validateOnly_before_execution',
    }));
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: false,
      dry_run: true,
      persistence_used: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      execution_allowed_now: false,
      audit_record_persisted: true,
      status_change_performed: true,
      approval_status_mutation_used: true,
      approved_record_executable: false,
      rejected_record_executable: false,
      duplicate_decision_rejected: true,
    }));
    expect(response.auditRecord).toEqual(expect.objectContaining({
      decision: 'approve',
      audit_record_persisted: true,
      status_change_performed: true,
      execution_allowed_now: false,
    }));
    expect(response.approvalBefore.status).toBe('pending_approval');
    expect(response.approvalAfter).toEqual(expect.objectContaining({
      approval_id: pendingApproval().approval_id,
      status: 'approved',
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
    }));
  });

  it('rejects a malformed provider draft while keeping the rejected record non-executable', async () => {
    const malformed = pendingApproval({
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        dailyBudget: 1200000,
      },
      blockers: ['typedPayload.campaignBudgetId'],
      missing_data_blockers: ['campaign_budget_source_missing'],
    });
    approvalRepository = createApprovalRepositoryMock(malformed);
    const queueService = new AdsAutomationDecisionDraftApprovalQueueService(approvalRepository);
    service = new AdsAutomationDecisionDraftApprovalDecisionMutationService(
      queueService,
      approvalRepository,
      auditRepository,
    );

    const response = await service.decidePendingApproval(malformed.approval_id, {
      decision: 'reject',
      reviewerUserId: 'manager-1',
      reviewerRole: 'manager',
      reason: 'Reject malformed draft until ERP evidence is corrected.',
      requestId: 'REQ-REJECT-MALFORMED-LOCAL',
    });

    expect(response.summary).toEqual(expect.objectContaining({
      mutation_status: 'rejected',
      proposed_decision: 'reject',
      validation_status: 'eligible_for_human_decision',
      resulting_status: 'rejected',
      status_change_performed: true,
      execution_allowed_now: false,
      next_required_action: 'decision_complete_no_execution',
    }));
    expect(response.decisionValidation.blockers).toEqual([]);
    expect(response.decisionValidation.prerequisites.some((item) => item.key === 'typedPayload.campaignBudgetId')).toBe(false);
    expect(response.approvalAfter).toEqual(expect.objectContaining({
      status: 'rejected',
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
    }));
  });

  it('persists a blocked approve audit without changing approval status when validation blockers remain', async () => {
    const malformed = pendingApproval({
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        dailyBudget: 1200000,
      },
    });
    approvalRepository = createApprovalRepositoryMock(malformed);
    const queueService = new AdsAutomationDecisionDraftApprovalQueueService(approvalRepository);
    service = new AdsAutomationDecisionDraftApprovalDecisionMutationService(
      queueService,
      approvalRepository,
      auditRepository,
    );

    const response = await service.decidePendingApproval(malformed.approval_id, {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Director attempted approval but required budget evidence is missing.',
      requestId: 'REQ-BLOCKED-APPROVE-LOCAL',
    });

    expect(auditRepository.createFromPreview).toHaveBeenCalledWith(expect.objectContaining({
      decision: 'approve',
      proposed_status: 'approved',
      validation_status: 'blocked',
      status_change_performed: false,
      blockers: expect.arrayContaining(['typedPayload.campaignBudgetId']),
    }));
    expect(auditRepository.createFromDecision).not.toHaveBeenCalled();
    expect(approvalRepository.transitionPendingApprovalStatus).not.toHaveBeenCalled();
    expect(response.summary).toEqual(expect.objectContaining({
      mutation_status: 'blocked',
      proposed_decision: 'approve',
      validation_status: 'blocked',
      resulting_status: null,
      audit_record_persisted: true,
      status_change_performed: false,
      execution_allowed_now: false,
      next_required_action: 'fix_blockers_before_decision',
    }));
    expect(response.safety).toEqual(expect.objectContaining({
      audit_record_persisted: true,
      status_change_performed: false,
      approval_status_mutation_used: false,
      execution_allowed_now: false,
      live_ads_execution_used: false,
    }));
    expect(response.approvalAfter).toBeNull();
  });

  it('rejects duplicate decision audit identities before transitioning status', async () => {
    auditRepository.createFromDecision.mockRejectedValueOnce(
      new BadRequestException('duplicate audit record rejected: ads-decision-audit:duplicate'),
    );

    await expect(service.decidePendingApproval(pendingApproval().approval_id, {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Duplicate request should be rejected before status transition.',
      requestId: 'REQ-DUPLICATE-APPROVE',
    })).rejects.toThrow('duplicate audit record rejected');

    expect(approvalRepository.transitionPendingApprovalStatus).not.toHaveBeenCalled();
  });
});
