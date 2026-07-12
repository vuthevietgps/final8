import { BadRequestException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalDecisionAuditRepository } from './ads-automation-decision-draft-approval-decision-audit.repository';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './contracts/ads-automation-decision-draft-approval.contract';
import { AiDataPackAdsAutomationDecisionAuditRecordSchema } from './schemas/ads-automation-decision-draft-approval-decision-audit.schema';

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

function auditPayload(
  overrides: Partial<AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload> = {},
): AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload {
  const approval = pendingApproval();

  return {
    schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record.v1',
    audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-approve-REQ-AUDIT-APPROVE',
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
    audit_record_persisted: false,
    status_change_performed: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    execution_allowed_now: false,
    createdAt: '2026-07-04T05:10:00.000Z',
    ...overrides,
  };
}

function queryChain(result: any) {
  const chain: any = {
    sort: jest.fn(() => chain),
    lean: jest.fn(() => chain),
    exec: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

describe('AdsAutomationDecisionDraftApprovalDecisionAuditRepository', () => {
  let model: any;
  let repository: AdsAutomationDecisionDraftApprovalDecisionAuditRepository;

  beforeEach(() => {
    model = {
      find: jest.fn().mockReturnValue(queryChain([])),
      findOne: jest.fn().mockReturnValue(queryChain(null)),
      create: jest.fn(),
    };
    repository = new AdsAutomationDecisionDraftApprovalDecisionAuditRepository(model);
  });

  it('maps an approve audit preview payload into an ERP-local persisted audit record contract', async () => {
    const payload = auditPayload();
    const persistable = repository.toPersistableRecord(payload);
    model.create.mockImplementation(async (record: any) => ({ toObject: () => ({ ...record }) }));

    const result = await repository.createFromPreview(payload);

    expect(model.find).toHaveBeenCalledWith(
      {
        $or: [
          { audit_id: { $in: [payload.audit_id] } },
          { idempotency_key: { $in: [persistable.idempotency_key] } },
        ],
      },
      { _id: 0, audit_id: 1, idempotency_key: 1 },
    );
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record.v1',
      audit_id: payload.audit_id,
      idempotency_key: 'ads-decision-audit:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:approve:REQ-AUDIT-APPROVE',
      approval_id: payload.approval_id,
      action_type: 'update_campaign_budget',
      action_family: 'provider_google_ads',
      provider: 'google',
      previous_status: 'pending_approval',
      proposed_status: 'approved',
      decision: 'approve',
      validation_status: 'eligible_for_human_decision',
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
      persistedAt: expect.any(String),
    }));
    expect(result).toEqual(expect.objectContaining({
      audit_id: payload.audit_id,
      audit_record_persisted: true,
      status_change_performed: false,
      execution_allowed_now: false,
      pending_approval_snapshot: expect.objectContaining({
        status: 'pending_approval',
        typedPayload: expect.objectContaining({ campaignBudgetId: '3001' }),
      }),
    }));
  });

  it('maps an accepted approve decision into a status-changing ERP-local audit record without provider calls', async () => {
    const payload = auditPayload({
      requestId: 'REQ-AUDIT-APPROVE-DECISION',
      audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-approve-REQ-AUDIT-APPROVE-DECISION',
    });
    const persistable = repository.toPersistableDecisionRecord(payload, true);
    model.create.mockImplementation(async (record: any) => ({ toObject: () => ({ ...record }) }));

    const result = await repository.createFromDecision(payload, true);

    expect(model.find).toHaveBeenCalledWith(
      {
        $or: [
          { audit_id: { $in: [payload.audit_id] } },
          { idempotency_key: { $in: [persistable.idempotency_key] } },
        ],
      },
      { _id: 0, audit_id: 1, idempotency_key: 1 },
    );
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      audit_id: payload.audit_id,
      decision: 'approve',
      proposed_status: 'approved',
      validation_status: 'eligible_for_human_decision',
      audit_record_persisted: true,
      status_change_performed: true,
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
    }));
    expect(result).toEqual(expect.objectContaining({
      audit_id: payload.audit_id,
      audit_record_persisted: true,
      status_change_performed: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
    }));
  });

  it('detects duplicate audit ids and idempotency keys before create and on insert races', async () => {
    const payload = auditPayload();
    const persistable = repository.toPersistableRecord(payload);
    model.find.mockReturnValueOnce(queryChain([{
      audit_id: payload.audit_id,
      idempotency_key: persistable.idempotency_key,
    }]));

    const existing = await repository.findExistingAuditIdentities([persistable]);
    expect(existing.auditIds).toEqual(new Set([payload.audit_id]));
    expect(existing.idempotencyKeys).toEqual(new Set([persistable.idempotency_key]));

    model.find.mockReturnValueOnce(queryChain([{
      audit_id: payload.audit_id,
      idempotency_key: persistable.idempotency_key,
    }]));
    await expect(repository.createFromPreview(payload))
      .rejects.toThrow('duplicate audit record rejected');
    expect(model.create).not.toHaveBeenCalled();

    model.find.mockReturnValueOnce(queryChain([]));
    model.create.mockRejectedValueOnce({
      code: 11000,
      keyValue: { idempotency_key: persistable.idempotency_key },
    });
    const insertRace = repository.createFromPreview(payload);
    await expect(insertRace).rejects.toThrow(BadRequestException);
    await expect(insertRace).rejects.toThrow('duplicate audit record rejected');
  });

  it('reads a persisted audit record by audit_id through the contract mapper', async () => {
    const payload = auditPayload();
    const persisted = repository.toPersistableRecord(payload);
    model.findOne.mockReturnValueOnce(queryChain({
      ...persisted,
      audit_record_persisted: false,
      status_change_performed: true,
      provider_api_called: true,
      google_ads_api_called: true,
      validateOnly_called: true,
      live_ads_execution_used: true,
      erp_mutation_used: true,
      payment_mutation_used: true,
      execution_allowed_now: true,
      createdAt: new Date('2026-07-04T05:10:00.000Z'),
      persistedAt: new Date('2026-07-04T05:11:00.000Z'),
    }));

    const result = await repository.findByAuditId(` ${payload.audit_id} `);

    expect(model.findOne).toHaveBeenCalledWith(
      { audit_id: payload.audit_id },
      { _id: 0, __v: 0 },
    );
    expect(result).toEqual(expect.objectContaining({
      audit_id: payload.audit_id,
      approval_id: payload.approval_id,
      idempotency_key: persisted.idempotency_key,
      audit_record_persisted: true,
      status_change_performed: true,
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
      createdAt: '2026-07-04T05:10:00.000Z',
      persistedAt: '2026-07-04T05:11:00.000Z',
    }));
    expect(result?.pending_approval_snapshot).toEqual(expect.objectContaining({
      status: 'pending_approval',
      typedPayload: expect.objectContaining({ campaignBudgetId: '3001' }),
    }));
  });

  it('returns null for missing audit_id readback and skips blank audit ids', async () => {
    model.findOne.mockReturnValueOnce(queryChain(null));

    await expect(repository.findByAuditId('ADSAUDIT-missing')).resolves.toBeNull();
    expect(model.findOne).toHaveBeenCalledWith(
      { audit_id: 'ADSAUDIT-missing' },
      { _id: 0, __v: 0 },
    );

    model.findOne.mockClear();
    await expect(repository.findByAuditId('   ')).resolves.toBeNull();
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it('lists persisted audit records by approval_id without widening the approval filter', async () => {
    const approved = repository.toPersistableRecord(auditPayload({
      audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-approve-REQ-AUDIT-APPROVE-NEW',
      requestId: 'REQ-AUDIT-APPROVE-NEW',
      createdAt: '2026-07-04T06:10:00.000Z',
    }));
    const rejected = repository.toPersistableRecord(auditPayload({
      audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-reject-REQ-AUDIT-REJECT-OLD',
      proposed_status: 'rejected',
      decision: 'reject',
      reviewerUserId: 'manager-1',
      reviewerRole: 'manager',
      reason: 'Reject until ERP evidence is corrected.',
      requestId: 'REQ-AUDIT-REJECT-OLD',
      createdAt: '2026-07-04T05:10:00.000Z',
    }));
    const chain = queryChain([approved, rejected]);
    model.find.mockReturnValueOnce(chain);

    const results = await repository.listByApprovalId(` ${approved.approval_id} `);

    expect(model.find).toHaveBeenCalledWith(
      { approval_id: approved.approval_id },
      { _id: 0, __v: 0 },
    );
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, audit_id: 1 });
    expect(results).toHaveLength(2);
    expect(results.map((record) => record.approval_id)).toEqual([
      approved.approval_id,
      approved.approval_id,
    ]);
    expect(results.map((record) => record.decision)).toEqual(['approve', 'reject']);
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        audit_id: approved.audit_id,
        audit_record_persisted: true,
        status_change_performed: false,
        execution_allowed_now: false,
      }),
      expect.objectContaining({
        audit_id: rejected.audit_id,
        audit_record_persisted: true,
        status_change_performed: false,
        execution_allowed_now: false,
      }),
    ]));

    model.find.mockClear();
    await expect(repository.listByApprovalId('')).resolves.toEqual([]);
    expect(model.find).not.toHaveBeenCalled();
  });

  it('keeps blocked approve audit payloads compatible when campaignBudgetId is missing', () => {
    const malformedApproval = pendingApproval({
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
    const record = repository.toPersistableRecord(auditPayload({
      audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-approve-REQ-MISSING-CAMPAIGN-BUDGET',
      requestId: 'REQ-MISSING-CAMPAIGN-BUDGET',
      validation_status: 'blocked',
      prerequisites_valid: 14,
      prerequisites_blocked: 1,
      blockers: ['typedPayload.campaignBudgetId'],
      prerequisites: [
        {
          key: 'typedPayload.campaignBudgetId',
          status: 'blocked',
          detail: 'Budget update readiness requires typedPayload.campaignBudgetId and must not fall back to campaignId or adGroupId.',
        },
      ],
      pending_approval_snapshot: malformedApproval,
    }));

    expect(record.validation_status).toBe('blocked');
    expect(record.proposed_status).toBe('approved');
    expect(record.audit_record_persisted).toBe(true);
    expect(record.status_change_performed).toBe(false);
    expect(record.blockers).toEqual(['typedPayload.campaignBudgetId']);
    expect(record.pending_approval_snapshot.typedPayload).toEqual(expect.objectContaining({
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: null,
      dailyBudget: 1200000,
    }));
  });

  it('keeps reject audit payloads compatible for malformed pending approvals without readiness blockers', () => {
    const malformedApproval = pendingApproval({
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
    const record = repository.toPersistableRecord(auditPayload({
      audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-reject-REQ-REJECT-MALFORMED',
      proposed_status: 'rejected',
      decision: 'reject',
      reviewerUserId: 'manager-1',
      reviewerRole: 'manager',
      reason: 'Reject malformed draft until ERP evidence is corrected.',
      requestId: 'REQ-REJECT-MALFORMED',
      validation_status: 'eligible_for_human_decision',
      blockers: [],
      prerequisites: [
        {
          key: 'proposed_decision',
          status: 'valid',
          detail: 'Decision validation accepts only approve or reject.',
        },
      ],
      pending_approval_snapshot: malformedApproval,
    }));

    expect(record.decision).toBe('reject');
    expect(record.proposed_status).toBe('rejected');
    expect(record.validation_status).toBe('eligible_for_human_decision');
    expect(record.blockers).toEqual([]);
    expect(record.prerequisites.some((item) => item.key === 'typedPayload.campaignBudgetId')).toBe(false);
    expect(record.provider_api_called).toBe(false);
    expect(record.google_ads_api_called).toBe(false);
    expect(record.validateOnly_called).toBe(false);
    expect(record.live_ads_execution_used).toBe(false);
    expect(record.pending_approval_snapshot.status).toBe('pending_approval');
  });

  it('defines unique audit identity indexes and query indexes for future review reads', () => {
    const indexes = AiDataPackAdsAutomationDecisionAuditRecordSchema.indexes();

    expect(indexes).toEqual(expect.arrayContaining([
      [{ audit_id: 1 }, expect.objectContaining({ unique: true })],
      [{ idempotency_key: 1 }, expect.objectContaining({ unique: true })],
      [{ approval_id: 1, createdAt: -1 }, expect.any(Object)],
      [{ action_family: 1, action_type: 1, createdAt: -1 }, expect.any(Object)],
      [{ validation_status: 1, decision: 1, createdAt: -1 }, expect.any(Object)],
    ]));
  });
});
