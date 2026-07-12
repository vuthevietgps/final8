import { BadRequestException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import type { AdsAutomationDecisionDraftPendingApprovalRecord } from './contracts/ads-automation-decision-draft-approval.contract';

function pendingRecord(overrides: Partial<AdsAutomationDecisionDraftPendingApprovalRecord> = {}): AdsAutomationDecisionDraftPendingApprovalRecord {
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
      campaignBudgetId: '3001',
      dailyBudget: 1200000,
    },
    source_evidence_references: [],
    sourceSyncDecisionEvidence: [{
      sourceKey: 'google_ads',
      reportDate: '2026-07-04',
      freshnessStatus: 'fresh',
      coverageStatus: 'covered',
      lastSuccessfulSyncAt: '2026-07-04T04:00:00.000Z',
      latestRecordDate: '2026-07-04',
      blockingReason: null,
      blockingReasons: [],
      canUseForAdsAutomationDecision: true,
    }],
    sourceSyncDecisionGates: {
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

function queryChain(result: any) {
  const chain: any = {
    sort: jest.fn(() => chain),
    lean: jest.fn(() => chain),
    exec: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

describe('AdsAutomationDecisionDraftApprovalRepository', () => {
  let model: any;
  let repository: AdsAutomationDecisionDraftApprovalRepository;

  beforeEach(() => {
    model = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      insertMany: jest.fn(),
      countDocuments: jest.fn(),
    };
    repository = new AdsAutomationDecisionDraftApprovalRepository(model);
  });

  it('creates durable pending approval records and preserves non-execution safety flags', async () => {
    const record = pendingRecord();
    model.insertMany.mockResolvedValue([{ toObject: () => ({ ...record }) }]);

    const result = await repository.createMany([record]);

    expect(model.insertMany).toHaveBeenCalledWith([record], { ordered: true });
    expect(result).toEqual([
      expect.objectContaining({
        approval_id: record.approval_id,
        approval_required: true,
        execution_allowed_now: false,
        persistence_used: true,
        durable_storage_used: true,
        storage: 'erp_local_mongo',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        sourceSyncDecisionEvidence: record.sourceSyncDecisionEvidence,
        sourceSyncDecisionGates: record.sourceSyncDecisionGates,
      }),
    ]);
  });

  it('lists pending approvals with exact ERP-local filters', async () => {
    const record = pendingRecord();
    const chain = queryChain([record]);
    model.find.mockReturnValue(chain);

    const result = await repository.listPendingApprovals({
      action_family: 'provider_google_ads',
      accountId: '1234567890',
    });

    expect(model.find).toHaveBeenCalledWith(
      {
        status: 'pending_approval',
        action_family: 'provider_google_ads',
        accountId: '1234567890',
      },
      { _id: 0, __v: 0 },
    );
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, approval_id: 1 });
    expect(result).toEqual([expect.objectContaining({
      approval_id: record.approval_id,
      accountId: '1234567890',
      approval_required: true,
      execution_allowed_now: false,
      sourceSyncDecisionEvidence: record.sourceSyncDecisionEvidence,
      sourceSyncDecisionGates: record.sourceSyncDecisionGates,
    })]);
  });

  it('reads a single pending approval by approval id', async () => {
    const record = pendingRecord();
    model.findOne.mockReturnValue(queryChain(record));

    const result = await repository.findByApprovalId(record.approval_id);

    expect(model.findOne).toHaveBeenCalledWith(
      { approval_id: record.approval_id, status: 'pending_approval' },
      { _id: 0, __v: 0 },
    );
    expect(result).toEqual(expect.objectContaining({
      approval_id: record.approval_id,
      approval_required: true,
      execution_allowed_now: false,
      sourceSyncDecisionEvidence: record.sourceSyncDecisionEvidence,
      sourceSyncDecisionGates: record.sourceSyncDecisionGates,
    }));
  });

  it('reads approved and rejected approval records by id for local execution preflight', async () => {
    const approved = pendingRecord({ status: 'approved' });
    const rejected = pendingRecord({
      approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_pause_campaign_1001',
      action_type: 'pause_campaign',
      status: 'rejected',
    });
    const chain = queryChain([approved, rejected]);
    model.find.mockReturnValue(chain);

    const result = await repository.findByApprovalIds([
      approved.approval_id,
      rejected.approval_id,
      approved.approval_id,
    ]);

    expect(model.find).toHaveBeenCalledWith(
      { approval_id: { $in: [approved.approval_id, rejected.approval_id] } },
      { _id: 0, __v: 0 },
    );
    expect(result).toEqual([
      expect.objectContaining({
        approval_id: approved.approval_id,
        status: 'approved',
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      }),
      expect.objectContaining({
        approval_id: rejected.approval_id,
        status: 'rejected',
        execution_allowed_now: false,
      }),
    ]);
  });

  it('transitions a pending approval to an approved or rejected local decision status only from pending state', async () => {
    const approved = pendingRecord({ status: 'approved' });
    const chain = queryChain(approved);
    model.findOneAndUpdate.mockReturnValue(chain);

    const result = await repository.transitionPendingApprovalStatus(approved.approval_id, 'approved');

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { approval_id: approved.approval_id, status: 'pending_approval' },
      { $set: { status: 'approved' } },
      { new: true, projection: { _id: 0, __v: 0 } },
    );
    expect(result).toEqual(expect.objectContaining({
      approval_id: approved.approval_id,
      status: 'approved',
      approval_required: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
    }));

    model.findOneAndUpdate.mockClear();
    await expect(repository.transitionPendingApprovalStatus('   ', 'rejected')).resolves.toBeNull();
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('detects existing durable idempotency keys and rejects duplicate insert races', async () => {
    const record = pendingRecord();
    model.find.mockReturnValue(queryChain([{ idempotency_key: record.idempotency_key }]));

    await expect(repository.findExistingIdempotencyKeys([record.idempotency_key]))
      .resolves.toEqual(new Set([record.idempotency_key]));

    model.insertMany.mockRejectedValue({
      code: 11000,
      keyValue: { idempotency_key: record.idempotency_key },
    });

    await expect(repository.createMany([record]))
      .rejects.toThrow(BadRequestException);
    await expect(repository.createMany([record]))
      .rejects.toThrow('duplicate idempotency_key rejected');
  });
});
