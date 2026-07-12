import { BadRequestException } from '@nestjs/common';
import { AdsAutomationPolicyDecisionEvidenceRepository } from './ads-automation-policy-decision-evidence.repository';
import type {
  AdsAutomationPolicyDecisionEvidenceInput,
} from './contracts/ads-automation-policy-decision-evidence.contract';
import { AiDataPackAdsAutomationPolicyDecisionEvidenceSchema } from './schemas/ads-automation-policy-decision-evidence.schema';

function policyInput(
  overrides: Partial<AdsAutomationPolicyDecisionEvidenceInput> = {},
): AdsAutomationPolicyDecisionEvidenceInput {
  return {
    approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
    policy_allowed: true,
    policy_source: 'erp_cashflow_ads_policy',
    blockers: [],
    evaluatedAt: '2026-07-04T06:00:00.000Z',
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

describe('AdsAutomationPolicyDecisionEvidenceRepository', () => {
  let model: any;
  let repository: AdsAutomationPolicyDecisionEvidenceRepository;

  beforeEach(() => {
    model = {
      find: jest.fn().mockReturnValue(queryChain([])),
      findOne: jest.fn().mockReturnValue(queryChain(null)),
      create: jest.fn(),
    };
    repository = new AdsAutomationPolicyDecisionEvidenceRepository(model);
  });

  it('persists request-body policy evidence as a durable ERP-local policy decision record', async () => {
    const input = policyInput();
    const persistable = repository.toPersistableRecord(input, {
      requestId: 'REQ-POLICY-EVIDENCE',
      requestedByUserId: 'director-1',
      requestedByRole: 'director',
      createdAt: '2026-07-04T06:10:00.000Z',
    });
    model.create.mockImplementation(async (value: any) => ({ toObject: () => ({ ...value }) }));

    const result = await repository.createManyIdempotent([input], {
      requestId: 'REQ-POLICY-EVIDENCE',
      requestedByUserId: 'director-1',
      requestedByRole: 'director',
      createdAt: '2026-07-04T06:10:00.000Z',
    });

    expect(model.find).toHaveBeenCalledWith(
      {
        $or: [
          { policy_decision_id: { $in: [persistable.policy_decision_id] } },
          { idempotency_key: { $in: [persistable.idempotency_key] } },
        ],
      },
      { _id: 0, __v: 0 },
    );
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 'ads_automation_execution_policy_decision_evidence.v1',
      policy_decision_id: persistable.policy_decision_id,
      idempotency_key: 'ads-policy-decision:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:REQ-POLICY-EVIDENCE',
      approval_id: input.approval_id,
      policy_allowed: true,
      policy_source: 'erp_cashflow_ads_policy',
      blockers: [],
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
      requestId: 'REQ-POLICY-EVIDENCE',
      createdAt: '2026-07-04T06:10:00.000Z',
      persistedAt: expect.any(String),
    }));
    expect(result).toEqual(expect.objectContaining({
      created: 1,
      reused: 0,
      records: [
        expect.objectContaining({
          policy_decision_id: persistable.policy_decision_id,
          approval_id: input.approval_id,
          policy_decision_record_persisted: true,
          execution_allowed_now: false,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
        }),
      ],
    }));
  });

  it('reuses existing policy evidence records by durable id or request idempotency key', async () => {
    const persisted = repository.toPersistableRecord(policyInput(), {
      requestId: 'REQ-POLICY-EVIDENCE',
      createdAt: '2026-07-04T06:10:00.000Z',
    });
    model.find.mockReturnValueOnce(queryChain([persisted]));

    const result = await repository.createManyIdempotent([policyInput()], {
      requestId: 'REQ-POLICY-EVIDENCE',
      createdAt: '2026-07-04T06:10:00.000Z',
    });

    expect(model.create).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.reused).toBe(1);
    expect(result.records[0]).toEqual(expect.objectContaining({
      policy_decision_id: persisted.policy_decision_id,
      idempotency_key: persisted.idempotency_key,
      policy_decision_record_persisted: true,
      execution_allowed_now: false,
    }));
  });

  it('loads durable policy evidence by ids and normalizes unsafe stored flags to false', async () => {
    const persisted = repository.toPersistableRecord(policyInput({
      policy_decision_id: 'ADSPOLICY-DURABLE-2001',
    }));
    model.find.mockReturnValueOnce(queryChain([
      {
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
      },
    ]));

    const result = await repository.findByPolicyDecisionIds(['ADSPOLICY-DURABLE-2001']);

    expect(model.find).toHaveBeenCalledWith(
      { policy_decision_id: { $in: ['ADSPOLICY-DURABLE-2001'] } },
      { _id: 0, __v: 0 },
    );
    expect(result).toEqual([
      expect.objectContaining({
        policy_decision_id: 'ADSPOLICY-DURABLE-2001',
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
      }),
    ]);
  });

  it('reads one policy decision and lists approval history without widening filters', async () => {
    const first = repository.toPersistableRecord(policyInput({
      policy_decision_id: 'ADSPOLICY-APPROVAL-2001-REQ-1',
    }));
    const second = repository.toPersistableRecord(policyInput({
      policy_decision_id: 'ADSPOLICY-APPROVAL-2001-REQ-2',
      policy_allowed: false,
      blockers: ['daily_cap_exceeded'],
    }));

    model.findOne.mockReturnValueOnce(queryChain(first));
    await expect(repository.findByPolicyDecisionId(` ${first.policy_decision_id} `))
      .resolves.toEqual(expect.objectContaining({ policy_decision_id: first.policy_decision_id }));
    expect(model.findOne).toHaveBeenCalledWith(
      { policy_decision_id: first.policy_decision_id },
      { _id: 0, __v: 0 },
    );

    const chain = queryChain([second, first]);
    model.find.mockReturnValueOnce(chain);
    const history = await repository.listByApprovalId(` ${first.approval_id} `);

    expect(model.find).toHaveBeenCalledWith(
      { approval_id: first.approval_id },
      { _id: 0, __v: 0 },
    );
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, policy_decision_id: 1 });
    expect(history.map((record) => record.approval_id)).toEqual([first.approval_id, first.approval_id]);
  });

  it('rejects unsafe policy evidence flags before persistence', async () => {
    await expect(repository.createManyIdempotent([
      policyInput({ provider_api_called: true } as any),
    ])).rejects.toThrow(BadRequestException);
  });

  it('defines unique durable policy decision and idempotency indexes', () => {
    const indexes = AiDataPackAdsAutomationPolicyDecisionEvidenceSchema.indexes();

    expect(indexes).toEqual(expect.arrayContaining([
      [{ policy_decision_id: 1 }, expect.objectContaining({ unique: true })],
      [{ idempotency_key: 1 }, expect.objectContaining({ unique: true })],
      [{ approval_id: 1, createdAt: -1 }, expect.any(Object)],
      [{ policy_source: 1, createdAt: -1 }, expect.any(Object)],
    ]));
  });
});
