import { BadRequestException } from '@nestjs/common';
import { AdsAutomationExecutionPreflightDryRunRepository } from './ads-automation-execution-preflight-dry-run.repository';
import type { AdsAutomationDecisionDraftPendingApprovalRecord } from './contracts/ads-automation-decision-draft-approval.contract';
import type { AdsAutomationExecutionPreflightDryRunRecord } from './contracts/ads-automation-execution-preflight-dry-run.contract';
import { AiDataPackAdsAutomationExecutionPreflightDryRunSchema } from './schemas/ads-automation-execution-preflight-dry-run.schema';

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
    status: 'approved',
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
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      dailyBudget: 1200000,
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

function preflightRecord(
  overrides: Partial<AdsAutomationExecutionPreflightDryRunRecord> = {},
): AdsAutomationExecutionPreflightDryRunRecord {
  const approval = pendingApproval();

  return {
    execution_record_id: 'ADSEXEC-DRYRUN-ADSAPPROVAL-2001-REQ-PREFLIGHT',
    idempotency_key: 'ads-execution-preflight:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:REQ-PREFLIGHT',
    approval_id: approval.approval_id,
    source_draft_id: approval.source_draft_id,
    source_decision_id: approval.source_decision_id,
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
    validateOnly_validation_id: 'ADSPROVIDERVALIDATE-ADSAPPROVAL-2001-REQ-PREFLIGHT',
    validateOnly_evidence_persisted: true,
    validateOnly_status: 'validate_only_passed',
    policy_decision_id: 'ADSPOLICY-ADSAPPROVAL-2001-REQ-PREFLIGHT',
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
    gates: [
      {
        key: 'campaignBudgetId',
        status: 'passed',
        detail: 'Budget updates require typedPayload.campaignBudgetId.',
      },
    ],
    blockers: ['GOOGLE_ADS_PRODUCTION_ENABLED'],
    next_required_action: 'fix_preflight_blockers_before_future_execution',
    source_pending_approval: approval,
    source_validateOnly_plan: null,
    policy_decision: {
      approval_id: approval.approval_id,
      policy_allowed: true,
      policy_source: 'erp_ads_policy',
      blockers: [],
      evaluatedAt: '2026-07-04T06:00:00.000Z',
    },
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-PREFLIGHT',
    createdAt: '2026-07-04T06:10:00.000Z',
    persistedAt: '2026-07-04T06:10:00.000Z',
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

describe('AdsAutomationExecutionPreflightDryRunRepository', () => {
  let model: any;
  let repository: AdsAutomationExecutionPreflightDryRunRepository;

  beforeEach(() => {
    model = {
      find: jest.fn().mockReturnValue(queryChain([])),
      findOne: jest.fn().mockReturnValue(queryChain(null)),
      create: jest.fn(),
    };
    repository = new AdsAutomationExecutionPreflightDryRunRepository(model);
  });

  it('persists a local execution preflight audit record without provider execution flags', async () => {
    const record = preflightRecord();
    model.create.mockImplementation(async (value: any) => ({ toObject: () => ({ ...value }) }));

    const result = await repository.createManyIdempotent([record]);

    expect(model.find).toHaveBeenCalledWith(
      {
        $or: [
          { execution_record_id: { $in: [record.execution_record_id] } },
          { idempotency_key: { $in: [record.idempotency_key] } },
        ],
      },
      { _id: 0, __v: 0 },
    );
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      execution_record_id: record.execution_record_id,
      idempotency_key: record.idempotency_key,
      approval_id: record.approval_id,
      action_type: 'update_campaign_budget',
      preflight_status: 'blocked_before_future_live_execution',
      validateOnly_validation_id: record.validateOnly_validation_id,
      validateOnly_evidence_persisted: true,
      policy_decision_id: record.policy_decision_id,
      policy_decision_evidence_persisted: true,
      preflight_record_persisted: true,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: 'erp_local_mongo',
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      live_path_implemented: false,
      campaignBudgetId_fallback_used: false,
      persistedAt: expect.any(String),
    }));
    expect(result).toEqual(expect.objectContaining({
      created: 1,
      reused: 0,
      createdExecutionRecordIds: [record.execution_record_id],
      createdIdempotencyKeys: [record.idempotency_key],
      reusedExecutionRecordIds: [],
      reusedIdempotencyKeys: [],
      records: [
        expect.objectContaining({
          execution_record_id: record.execution_record_id,
          idempotency_key: record.idempotency_key,
          validateOnly_validation_id: record.validateOnly_validation_id,
          validateOnly_evidence_persisted: true,
          policy_decision_id: record.policy_decision_id,
          policy_decision_evidence_persisted: true,
          preflight_record_persisted: true,
          execution_allowed_now: false,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
        }),
      ],
    }));
  });

  it('returns existing records for duplicate execution_record_id or request idempotency keys', async () => {
    const persisted = repository.toPersistableRecord(preflightRecord({
      persistedAt: '2026-07-04T06:11:00.000Z',
    }));
    model.find.mockReturnValueOnce(queryChain([persisted]));

    const result = await repository.createManyIdempotent([preflightRecord()]);

    expect(model.create).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.reused).toBe(1);
    expect(result.createdExecutionRecordIds).toEqual([]);
    expect(result.createdIdempotencyKeys).toEqual([]);
    expect(result.reusedExecutionRecordIds).toEqual([persisted.execution_record_id]);
    expect(result.reusedIdempotencyKeys).toEqual([persisted.idempotency_key]);
    expect(result.records[0]).toEqual(expect.objectContaining({
      execution_record_id: persisted.execution_record_id,
      idempotency_key: persisted.idempotency_key,
      preflight_record_persisted: true,
      execution_allowed_now: false,
    }));
  });

  it('normalizes readback rows back to safe false execution flags', async () => {
    const persisted = repository.toPersistableRecord(preflightRecord());
    model.findOne.mockReturnValueOnce(queryChain({
      ...persisted,
      provider_api_called: true,
      google_ads_api_called: true,
      validateOnly_called: true,
      live_ads_execution_used: true,
      erp_mutation_used: true,
      payment_mutation_used: true,
      execution_allowed_now: true,
      future_live_execution_allowed: true,
      campaignBudgetId_fallback_used: true,
      createdAt: new Date('2026-07-04T06:10:00.000Z'),
      persistedAt: new Date('2026-07-04T06:11:00.000Z'),
    }));

    const result = await repository.findByExecutionRecordId(` ${persisted.execution_record_id} `);

    expect(model.findOne).toHaveBeenCalledWith(
      { execution_record_id: persisted.execution_record_id },
      { _id: 0, __v: 0 },
    );
    expect(result).toEqual(expect.objectContaining({
      execution_record_id: persisted.execution_record_id,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      execution_allowed_now: false,
      future_live_execution_allowed: false,
      campaignBudgetId_fallback_used: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      createdAt: '2026-07-04T06:10:00.000Z',
      persistedAt: '2026-07-04T06:11:00.000Z',
    }));
  });

  it('lists persisted records by approval_id without widening the approval filter', async () => {
    const newer = repository.toPersistableRecord(preflightRecord({
      execution_record_id: 'ADSEXEC-DRYRUN-ADSAPPROVAL-2001-REQ-NEW',
      idempotency_key: 'ads-execution-preflight:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:REQ-NEW',
      requestId: 'REQ-NEW',
      createdAt: '2026-07-04T06:12:00.000Z',
    }));
    const older = repository.toPersistableRecord(preflightRecord({
      execution_record_id: 'ADSEXEC-DRYRUN-ADSAPPROVAL-2001-REQ-OLD',
      idempotency_key: 'ads-execution-preflight:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:REQ-OLD',
      requestId: 'REQ-OLD',
      createdAt: '2026-07-04T06:01:00.000Z',
    }));
    const chain = queryChain([newer, older]);
    model.find.mockReturnValueOnce(chain);

    const result = await repository.listByApprovalId(` ${newer.approval_id} `);

    expect(model.find).toHaveBeenCalledWith(
      { approval_id: newer.approval_id },
      { _id: 0, __v: 0 },
    );
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, execution_record_id: 1 });
    expect(result).toHaveLength(2);
    expect(result.map((record) => record.approval_id)).toEqual([newer.approval_id, newer.approval_id]);

    model.find.mockClear();
    await expect(repository.listByApprovalId('   ')).resolves.toEqual([]);
    expect(model.find).not.toHaveBeenCalled();
  });

  it('rejects unsupported action persistence and unsafe non-execution flags', async () => {
    await expect(repository.createManyIdempotent([
      preflightRecord({ action_type: 'delete_campaign' as any }),
    ])).rejects.toThrow('execution preflight persistence supports update_campaign_budget, pause_campaign, and pause_ad_group only');

    await expect(repository.createManyIdempotent([
      preflightRecord({ google_ads_api_called: true as any }),
    ])).rejects.toThrow(BadRequestException);
  });

  it('defines unique idempotency and readback indexes for preflight audit records', () => {
    const indexes = AiDataPackAdsAutomationExecutionPreflightDryRunSchema.indexes();

    expect(indexes).toEqual(expect.arrayContaining([
      [{ execution_record_id: 1 }, expect.objectContaining({ unique: true })],
      [{ idempotency_key: 1 }, expect.objectContaining({ unique: true })],
      [{ approval_id: 1, createdAt: -1 }, expect.any(Object)],
      [{ policy_decision_id: 1, createdAt: -1 }, expect.any(Object)],
      [{ validateOnly_validation_id: 1, createdAt: -1 }, expect.any(Object)],
      [{ action_family: 1, action_type: 1, createdAt: -1 }, expect.any(Object)],
    ]));
  });
});
