import { BadRequestException } from '@nestjs/common';
import { AdsAutomationValidateOnlyEvidenceRepository } from './ads-automation-validate-only-evidence.repository';
import type { AdsAutomationProviderValidateOnlyActionPlan } from './contracts/ads-automation-provider-validate-only.contract';
import { AiDataPackAdsAutomationValidateOnlyEvidenceSchema } from './schemas/ads-automation-validate-only-evidence.schema';

function validationPlan(
  overrides: Partial<AdsAutomationProviderValidateOnlyActionPlan> = {},
): AdsAutomationProviderValidateOnlyActionPlan {
  const beforeStateSnapshot = {
    snapshot_status: 'mocked_boundary_snapshot',
    required_before_future_execution: true,
    source: 'erp_synced_google_ads_read_model',
    customerId: '1234567890',
    campaignId: '1001',
    adGroupId: '2001',
    campaignBudgetId: '3001',
    campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
    snapshot: { syncedAt: '2026-07-04T05:55:00.000Z' },
  } as const;

  return {
    validation_id: 'ADSPROVIDERVALIDATE-ADSAPPROVAL-2001',
    pending_action_id: 'ADSPENDINGACTION-ADSAPPROVAL-2001',
    approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
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
    requested_change: {
      action_type: 'update_campaign_budget',
      campaignBudgetId: '3001',
      dailyBudget: 1200000,
    },
    status: 'validate_only_passed',
    providerValidationStatus: 'provider_validate_passed',
    providerRequestId: 'REQ-VALIDATE-ONLY-MOCK',
    providerValidatedAt: '2026-07-04T06:00:00.000Z',
    providerValidationErrors: [],
    before_state_snapshot: beforeStateSnapshot,
    validateOnly_request: {
      schemaVersion: 'ads_automation_provider_validate_only_request.v1',
      request_id: 'ADSPROVIDERVALIDATEREQ-ADSAPPROVAL-2001',
      pending_action_id: 'ADSPENDINGACTION-ADSAPPROVAL-2001',
      approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
      action_type: 'update_campaign_budget',
      operation_kind: 'campaign_budget_update',
      provider: 'google',
      boundary_mode: 'erp_local_mock_only',
      request_status: 'ready_for_future_validateOnly',
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      requested_change: {
        action_type: 'update_campaign_budget',
        campaignBudgetId: '3001',
        dailyBudget: 1200000,
      },
      required_identifiers: ['customerId', 'campaignBudgetId'],
      missing_identifiers: [],
      before_state_snapshot_required: true,
      raw_provider_request_included: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      execution_allowed_now: false,
    },
    validateOnly_result: {
      schemaVersion: 'ads_automation_provider_validate_only_result.v1',
      result_id: 'ADSPROVIDERVALIDATERESULT-ADSAPPROVAL-2001',
      request_id: 'ADSPROVIDERVALIDATEREQ-ADSAPPROVAL-2001',
      pending_action_id: 'ADSPENDINGACTION-ADSAPPROVAL-2001',
      approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
      action_type: 'update_campaign_budget',
      operation_kind: 'campaign_budget_update',
      status: 'validate_only_passed',
      providerValidationStatus: 'provider_validate_passed',
      providerRequestId: 'REQ-VALIDATE-ONLY-MOCK',
      providerValidatedAt: '2026-07-04T06:00:00.000Z',
      providerValidationErrors: [],
      before_state_snapshot: beforeStateSnapshot,
      mocked_provider_result_used: true,
      approval_can_be_considered_executable: true,
      executable_now: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
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

describe('AdsAutomationValidateOnlyEvidenceRepository', () => {
  let model: any;
  let repository: AdsAutomationValidateOnlyEvidenceRepository;

  beforeEach(() => {
    model = {
      find: jest.fn().mockReturnValue(queryChain([])),
      findOne: jest.fn().mockReturnValue(queryChain(null)),
      create: jest.fn(),
    };
    repository = new AdsAutomationValidateOnlyEvidenceRepository(model);
  });

  it('persists request-body validationPlans as durable ERP-local validate-only evidence', async () => {
    const input = validationPlan();
    model.create.mockImplementation(async (value: any) => ({ toObject: () => ({ ...value }) }));

    const result = await repository.createManyIdempotent([input], {
      requestId: 'REQ-VALIDATE-ONLY-EVIDENCE',
      requestedByUserId: 'director-1',
      requestedByRole: 'director',
      createdAt: '2026-07-04T06:10:00.000Z',
    });

    expect(model.find).toHaveBeenCalledWith(
      {
        $or: [
          { validation_id: { $in: [input.validation_id] } },
          { idempotency_key: { $in: ['ads-validate-only-evidence:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:REQ-VALIDATE-ONLY-EVIDENCE'] } },
        ],
      },
      { _id: 0, __v: 0 },
    );
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 'ads_automation_validate_only_evidence.v1',
      validation_id: input.validation_id,
      approval_id: input.approval_id,
      status: 'validate_only_passed',
      validateOnly_evidence_persisted: true,
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
      requestId: 'REQ-VALIDATE-ONLY-EVIDENCE',
      validateOnly_request: expect.objectContaining({
        schemaVersion: 'ads_automation_provider_validate_only_request.v1',
        operation_kind: 'campaign_budget_update',
        request_status: 'ready_for_future_validateOnly',
        required_identifiers: ['customerId', 'campaignBudgetId'],
        missing_identifiers: [],
        raw_provider_request_included: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        execution_allowed_now: false,
      }),
      validateOnly_result: expect.objectContaining({
        schemaVersion: 'ads_automation_provider_validate_only_result.v1',
        operation_kind: 'campaign_budget_update',
        status: 'validate_only_passed',
        providerValidationStatus: 'provider_validate_passed',
        providerRequestId: 'REQ-VALIDATE-ONLY-MOCK',
        providerValidationErrors: [],
        approval_can_be_considered_executable: true,
        executable_now: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
      createdAt: '2026-07-04T06:10:00.000Z',
      persistedAt: expect.any(String),
    }));
    expect(result).toEqual(expect.objectContaining({
      created: 1,
      reused: 0,
      records: [
        expect.objectContaining({
          validation_id: input.validation_id,
          approval_id: input.approval_id,
          validateOnly_evidence_persisted: true,
          execution_allowed_now: false,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          validateOnly_request: expect.objectContaining({
            operation_kind: 'campaign_budget_update',
            raw_provider_request_included: false,
          }),
          validateOnly_result: expect.objectContaining({
            status: 'validate_only_passed',
            execution_allowed_now: false,
          }),
        }),
      ],
    }));
  });

  it('reuses existing validate-only evidence by durable id or request idempotency key', async () => {
    const persisted = repository.toPersistableRecord(validationPlan(), {
      requestId: 'REQ-VALIDATE-ONLY-EVIDENCE',
      createdAt: '2026-07-04T06:10:00.000Z',
    });
    model.find.mockReturnValueOnce(queryChain([persisted]));

    const result = await repository.createManyIdempotent([validationPlan()], {
      requestId: 'REQ-VALIDATE-ONLY-EVIDENCE',
      createdAt: '2026-07-04T06:10:00.000Z',
    });

    expect(model.create).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.reused).toBe(1);
    expect(result.records[0]).toEqual(expect.objectContaining({
      validation_id: persisted.validation_id,
      idempotency_key: persisted.idempotency_key,
      validateOnly_evidence_persisted: true,
      execution_allowed_now: false,
    }));
  });

  it('loads durable evidence by validation ids and normalizes unsafe stored flags to false', async () => {
    const persisted = repository.toPersistableRecord(validationPlan({
      validation_id: 'ADSPROVIDERVALIDATE-DURABLE-2001',
    }));
    model.find.mockReturnValueOnce(queryChain([{
      ...persisted,
      provider_api_called: true,
      google_ads_api_called: true,
      validateOnly_called: true,
      live_ads_execution_used: true,
      erp_mutation_used: true,
      payment_mutation_used: true,
      direct_google_ads_api_call: true,
      provider_mutation_used: true,
      live_path_implemented: true,
      execution_allowed_now: true,
      provider_boundary_evidence: {
        ...persisted.provider_boundary_evidence,
        provider_api_called: true,
        google_ads_api_called: true,
        validateOnly_called: true,
      },
      validateOnly_request: {
        ...(persisted.validateOnly_request || {}),
        raw_provider_request_included: true,
        provider_api_called: true,
        google_ads_api_called: true,
        validateOnly_called: true,
        execution_allowed_now: true,
      },
      validateOnly_result: {
        ...(persisted.validateOnly_result || {}),
        provider_api_called: true,
        google_ads_api_called: true,
        validateOnly_called: true,
        live_ads_execution_used: true,
        execution_allowed_now: true,
        executable_now: true,
      },
    }]));

    const result = await repository.findByValidationIds(['ADSPROVIDERVALIDATE-DURABLE-2001']);

    expect(model.find).toHaveBeenCalledWith(
      { validation_id: { $in: ['ADSPROVIDERVALIDATE-DURABLE-2001'] } },
      { _id: 0, __v: 0 },
    );
    expect(result).toEqual([
      expect.objectContaining({
        validation_id: 'ADSPROVIDERVALIDATE-DURABLE-2001',
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        direct_google_ads_api_call: false,
        provider_mutation_used: false,
        live_path_implemented: false,
        execution_allowed_now: false,
        provider_boundary_evidence: expect.objectContaining({
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
        }),
        validateOnly_request: expect.objectContaining({
          raw_provider_request_included: false,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          execution_allowed_now: false,
        }),
        validateOnly_result: expect.objectContaining({
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          executable_now: false,
        }),
      }),
    ]);
  });

  it('reads one validation id and lists approval history without widening filters', async () => {
    const first = repository.toPersistableRecord(validationPlan({
      validation_id: 'ADSPROVIDERVALIDATE-APPROVAL-2001-REQ-1',
    }));
    const second = repository.toPersistableRecord(validationPlan({
      validation_id: 'ADSPROVIDERVALIDATE-APPROVAL-2001-REQ-2',
      status: 'validate_only_failed',
      providerValidationStatus: 'provider_validate_failed',
      approval_can_be_considered_executable: false,
      blockers: ['provider_validation_error'],
    }));

    model.findOne.mockReturnValueOnce(queryChain(first));
    await expect(repository.findByValidationId(` ${first.validation_id} `))
      .resolves.toEqual(expect.objectContaining({ validation_id: first.validation_id }));
    expect(model.findOne).toHaveBeenCalledWith(
      { validation_id: first.validation_id },
      { _id: 0, __v: 0 },
    );

    const chain = queryChain([second, first]);
    model.find.mockReturnValueOnce(chain);
    const history = await repository.listByApprovalId(` ${first.approval_id} `);

    expect(model.find).toHaveBeenCalledWith(
      { approval_id: first.approval_id },
      { _id: 0, __v: 0 },
    );
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, validation_id: 1 });
    expect(history.map((record) => record.approval_id)).toEqual([first.approval_id, first.approval_id]);
  });

  it('rejects unsafe validate-only evidence flags before persistence', async () => {
    await expect(repository.createManyIdempotent([
      validationPlan({ provider_api_called: true } as any),
    ])).rejects.toThrow(BadRequestException);

    await expect(repository.createManyIdempotent([
      validationPlan({
        validateOnly_request: {
          ...validationPlan().validateOnly_request!,
          raw_provider_request_included: true,
        },
      } as any),
    ])).rejects.toThrow(BadRequestException);

    await expect(repository.createManyIdempotent([
      validationPlan({
        validateOnly_result: {
          ...validationPlan().validateOnly_result!,
          validateOnly_called: true,
        },
      } as any),
    ])).rejects.toThrow(BadRequestException);
  });

  it('defines unique durable validation id and idempotency indexes', () => {
    const indexes = AiDataPackAdsAutomationValidateOnlyEvidenceSchema.indexes();

    expect(indexes).toEqual(expect.arrayContaining([
      [{ validation_id: 1 }, expect.objectContaining({ unique: true })],
      [{ idempotency_key: 1 }, expect.objectContaining({ unique: true })],
      [{ approval_id: 1, createdAt: -1 }, expect.any(Object)],
      [{ status: 1, providerValidationStatus: 1, createdAt: -1 }, expect.any(Object)],
    ]));
  });
});
