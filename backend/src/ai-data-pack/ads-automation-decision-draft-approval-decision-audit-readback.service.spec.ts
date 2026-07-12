import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalDecisionAuditRepository } from './ads-automation-decision-draft-approval-decision-audit.repository';
import { AdsAutomationDecisionDraftApprovalDecisionAuditReadbackService } from './ads-automation-decision-draft-approval-decision-audit-readback.service';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
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
    blockers: [],
    missing_data_blockers: [],
    idempotency_key: 'ads-draft:2026-07-04:update_campaign_budget:2001',
    rationale: 'Budget increase is capped by ERP policy and still requires approval.',
    createdAt: '2026-07-04T05:00:00.000Z',
    persistedAt: '2026-07-04T05:00:00.000Z',
    ...overrides,
  };
}

function auditRecord(
  overrides: Partial<AdsAutomationDecisionDraftApprovalDecisionAuditRecord> = {},
): AdsAutomationDecisionDraftApprovalDecisionAuditRecord {
  const approval = pendingApproval();

  return {
    schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record.v1',
    audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-approve-REQ-AUDIT-APPROVE',
    idempotency_key: 'ads-decision-audit:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:approve:REQ-AUDIT-APPROVE',
    approval_id: approval.approval_id,
    source_draft_id: approval.source_draft_id,
    source_decision_id: approval.source_decision_id,
    action_type: approval.action_type,
    action_family: approval.action_family,
    provider: approval.provider,
    resource_type: approval.resource_type,
    entity_type: approval.entity_type,
    entity_id: approval.entity_id,
    accountId: approval.accountId,
    productId: approval.productId,
    supplierId: approval.supplierId,
    platform: approval.platform,
    previous_status: 'pending_approval',
    proposed_status: 'approved',
    decision: 'approve',
    reviewerUserId: 'director-1',
    reviewerRole: 'director',
    reason: 'Human reviewed ERP evidence and approved the capped budget change.',
    requestId: 'REQ-AUDIT-APPROVE',
    validation_status: 'eligible_for_human_decision',
    prerequisites_valid: 15,
    prerequisites_blocked: 0,
    blockers: [],
    prerequisites: [
      {
        key: 'typedPayload.campaignBudgetId',
        status: 'valid',
        detail: 'Budget update readiness requires typedPayload.campaignBudgetId and must not fall back to campaignId or adGroupId.',
      },
    ],
    pending_approval_snapshot: approval,
    audit_record_persisted: true,
    status_change_performed: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    execution_allowed_now: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    source_preview_createdAt: '2026-07-04T05:10:00.000Z',
    createdAt: '2026-07-04T05:10:00.000Z',
    persistedAt: '2026-07-04T05:11:00.000Z',
    ...overrides,
  };
}

describe('AdsAutomationDecisionDraftApprovalDecisionAuditReadbackService', () => {
  let repository: jest.Mocked<AdsAutomationDecisionDraftApprovalDecisionAuditRepository>;
  let service: AdsAutomationDecisionDraftApprovalDecisionAuditReadbackService;

  beforeEach(() => {
    repository = {
      findByAuditId: jest.fn(),
      listByApprovalId: jest.fn(),
      createFromPreview: jest.fn(),
      findExistingAuditIdentities: jest.fn(),
      toPersistableRecord: jest.fn(),
    } as unknown as jest.Mocked<AdsAutomationDecisionDraftApprovalDecisionAuditRepository>;
    service = new AdsAutomationDecisionDraftApprovalDecisionAuditReadbackService(repository);
  });

  it('wraps persisted audit_id readback in a read-only service response without mutations', async () => {
    const record = auditRecord();
    repository.findByAuditId.mockResolvedValueOnce(record);

    const response = await service.readByAuditId(` ${record.audit_id} `);

    expect(repository.findByAuditId).toHaveBeenCalledWith(record.audit_id);
    expect(repository.listByApprovalId).not.toHaveBeenCalled();
    expect(repository.createFromPreview).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_decision_draft_approval_decision_audit_record_readback.v1');
    expect(response.query).toEqual({ audit_id: record.audit_id });
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'found',
      audit_records_matched: 1,
      approval_id_filter_applied: false,
      approval_required: true,
      execution_allowed_now: false,
      status_change_performed: false,
      audit_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      next_required_action: 'future_human_review',
    }));
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      audit_record_readback: true,
      public_endpoint_added: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      execution_allowed_now: false,
      status_change_performed: false,
      audit_persistence_performed: false,
    }));
    expect(response.auditRecord).toEqual(expect.objectContaining({
      audit_id: record.audit_id,
      approval_id: record.approval_id,
      audit_record_persisted: true,
      status_change_performed: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.auditRecord?.pending_approval_snapshot.typedPayload).toEqual(expect.objectContaining({
      campaignBudgetId: '3001',
    }));
  });

  it('raises not found for a missing audit_id and rejects blank audit ids before repository access', async () => {
    repository.findByAuditId.mockResolvedValueOnce(null);

    await expect(service.readByAuditId('ADSAUDIT-missing')).rejects.toThrow(NotFoundException);
    expect(repository.findByAuditId).toHaveBeenCalledWith('ADSAUDIT-missing');

    repository.findByAuditId.mockClear();
    await expect(service.readByAuditId('   ')).rejects.toThrow(BadRequestException);
    expect(repository.findByAuditId).not.toHaveBeenCalled();
  });

  it('wraps approval_id audit history readback without widening the repository filter', async () => {
    const approved = auditRecord();
    const rejected = auditRecord({
      audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-reject-REQ-AUDIT-REJECT',
      idempotency_key: 'ads-decision-audit:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:reject:REQ-AUDIT-REJECT',
      proposed_status: 'rejected',
      decision: 'reject',
      reviewerUserId: 'manager-1',
      reviewerRole: 'manager',
      reason: 'Reject until ERP evidence is corrected.',
      requestId: 'REQ-AUDIT-REJECT',
      createdAt: '2026-07-04T05:09:00.000Z',
      persistedAt: '2026-07-04T05:10:00.000Z',
    });
    repository.listByApprovalId.mockResolvedValueOnce([approved, rejected]);

    const response = await service.listByApprovalId(` ${approved.approval_id} `);

    expect(repository.listByApprovalId).toHaveBeenCalledWith(approved.approval_id);
    expect(repository.findByAuditId).not.toHaveBeenCalled();
    expect(repository.createFromPreview).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_decision_draft_approval_decision_audit_record_history.v1');
    expect(response.query).toEqual({ approval_id: approved.approval_id });
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'listed',
      audit_records_matched: 2,
      approval_id_filter_applied: true,
      approval_required: true,
      execution_allowed_now: false,
      status_change_performed: false,
      audit_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_approval_audit_history',
    }));
    expect(response.auditRecords.map((record) => record.approval_id)).toEqual([
      approved.approval_id,
      approved.approval_id,
    ]);
    expect(response.auditRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        audit_id: approved.audit_id,
        decision: 'approve',
        audit_record_persisted: true,
        status_change_performed: false,
        execution_allowed_now: false,
      }),
      expect.objectContaining({
        audit_id: rejected.audit_id,
        decision: 'reject',
        audit_record_persisted: true,
        status_change_performed: false,
        execution_allowed_now: false,
      }),
    ]));
  });

  it('returns an empty approval history envelope for approval ids with no audit records', async () => {
    repository.listByApprovalId.mockResolvedValueOnce([]);

    const response = await service.listByApprovalId('ADSAPPROVAL-without-audits');

    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'not_found',
      audit_records_matched: 0,
      approval_id_filter_applied: true,
      execution_allowed_now: false,
      status_change_performed: false,
      audit_persistence_performed: false,
      next_required_action: 'verify_audit_id',
    }));
    expect(response.auditRecords).toEqual([]);
    expect(response.safety.public_endpoint_added).toBe(false);
  });
});
