import { BadRequestException, ConflictException } from '@nestjs/common';
import axios from 'axios';
import { GoogleAdsExecutionService } from './google-ads-execution.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const action = (overrides: Record<string, any> = {}) => ({
  actionId: 'ACT001',
  idempotencyKey: 'PLAN-001:ACT001',
  actionType: 'create_search_campaign',
  customerId: '1234567890',
  loginCustomerId: '4345552613',
  status: 'approved',
  providerValidationStatus: 'provider_validate_passed',
  providerValidatedAt: new Date(),
  requireExecutionConfirmation: true,
  approvedBy: 'director@example.com',
  approvedByUserId: 'approver-user-2',
  ...overrides,
});

const plan = (items: any[]) => ({
  planId: 'PLAN-001',
  status: 'approved',
  items,
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
});

const logDocument = (value: Record<string, any>) => ({
  ...value,
  save: jest.fn().mockResolvedValue(undefined),
  toObject() {
    const { save, toObject, ...plain } = this as any;
    return plain;
  },
});

describe('GoogleAdsExecutionService', () => {
  let storedSuccessfulLog: any = null;
  const actionPlanModel = { findOne: jest.fn() };
  const executionLogModel = {
    findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(storedSuccessfulLog) })),
    create: jest.fn(async (value) => logDocument(value)),
    collection: {
      indexes: jest.fn().mockResolvedValue([{
        name: 'uniq_google_ads_reserved_idempotency_key',
        unique: true,
        key: { idempotencyKey: 1 },
        partialFilterExpression: { idempotencyReserved: true },
      }]),
      dropIndex: jest.fn().mockResolvedValue(undefined),
      createIndex: jest.fn().mockResolvedValue('uniq_google_ads_reserved_idempotency_key'),
    },
  };
  const apiTokenService = {
    getGoogleAdsRuntimeConfig: jest.fn().mockResolvedValue({
      developerToken: 'developer-secret',
      refreshToken: 'refresh-secret',
      loginCustomerId: '4345552613',
      apiVersion: 'v20',
    }),
    getGoogleAdsAccessToken: jest.fn().mockResolvedValue('access-secret'),
  };
  const executionPolicy = {
    preflight: jest.fn(async (_plan, actions) => actions.map((item: any) => ({
      action: item,
      beforeState: undefined,
      operations: [
        { campaignBudgetOperation: { create: { resourceName: 'customers/1234567890/campaignBudgets/-1' } } },
        { campaignOperation: { create: { status: 'PAUSED', advertisingChannelType: 'SEARCH' } } },
      ],
    }))),
    hasSpendIncreasingExposure: jest.fn().mockResolvedValue(true),
    evaluateFinancialControl: jest.fn().mockResolvedValue({
      checked: true,
      required: true,
      allowed: true,
    }),
  };
  const financialExecutionLease = {
    acquire: jest.fn().mockResolvedValue('lease-token'),
    renew: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const postExecutionService = {
    handleSuccessfulExecution: jest.fn().mockResolvedValue({
      syncResult: { status: 'success' },
      evaluationJobs: [{ evaluationDays: 3 }, { evaluationDays: 7 }],
    }),
  };
  const service = new GoogleAdsExecutionService(
    actionPlanModel as any,
    executionLogModel as any,
    apiTokenService as any,
    executionPolicy as any,
    financialExecutionLease as any,
    postExecutionService as any,
  );
  const director = { id: 'user-1', email: 'director@example.com', role: 'director' };
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    storedSuccessfulLog = null;
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'false';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'false';
    process.env.AI_MARKETING_DRY_RUN = 'true';
    executionPolicy.hasSpendIncreasingExposure.mockResolvedValue(true);
    executionPolicy.evaluateFinancialControl.mockResolvedValue({
      checked: true,
      required: true,
      allowed: true,
    });
    financialExecutionLease.acquire.mockResolvedValue('lease-token');
    financialExecutionLease.renew.mockResolvedValue(undefined);
    financialExecutionLease.release.mockResolvedValue(undefined);
    executionLogModel.collection.indexes.mockResolvedValue([{
      name: 'uniq_google_ads_reserved_idempotency_key',
      unique: true,
      key: { idempotencyKey: 1 },
      partialFilterExpression: { idempotencyReserved: true },
    }]);
    executionLogModel.collection.dropIndex.mockResolvedValue(undefined);
    executionLogModel.collection.createIndex.mockResolvedValue('uniq_google_ads_reserved_idempotency_key');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('runs a dry-run without calling Google Ads or consuming idempotency', async () => {
    const document = plan([action()]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);

    const result = await service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: true,
      source: 'codex_operator',
    });

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(apiTokenService.getGoogleAdsRuntimeConfig).not.toHaveBeenCalled();
    expect(postExecutionService.handleSuccessfulExecution).not.toHaveBeenCalled();
    expect(executionLogModel.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'dry_run',
      idempotencyReserved: false,
    }));
    expect(document.items[0].status).toBe('approved');
    expect(executionPolicy.preflight).toHaveBeenCalledWith(document, [document.items[0]], {
      enforceFinancialControl: false,
    });
    expect(result).toEqual(expect.objectContaining({ success: true, dryRun: true, executed: 0 }));
    expect((result as any).financialControl).toEqual(expect.objectContaining({ checked: true, allowed: true }));
    expect((result as any).separationOfDuties).toEqual({ allowed: true });
    expect(financialExecutionLease.acquire).not.toHaveBeenCalled();
  });

  it('blocks live execution when production is disabled before loading the plan', async () => {
    await expect(service.execute(director, 'PLAN-001', {
      actionIds: ['ACT001'],
      dryRun: false,
      validateOnly: false,
      source: 'codex_operator',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(actionPlanModel.findOne).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('reports separation-of-duties failure in dry-run without calling the provider', async () => {
    const document = plan([action({ approvedByUserId: director.id })]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);

    const result = await service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: true,
      source: 'codex_operator',
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      liveEligible: false,
      separationOfDuties: expect.objectContaining({
        allowed: false,
        reason: expect.stringContaining('different user'),
      }),
    }));
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('blocks live execution when approver and executor are the same user', async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.AI_MARKETING_DRY_RUN = 'false';
    const document = plan([action({ approvedByUserId: director.id })]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);

    await expect(service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: false,
      validateOnly: false,
      source: 'codex_operator',
    })).rejects.toThrow('different user than its approver');

    expect(executionPolicy.preflight).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('blocks live execution when canonical approver identity is missing', async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.AI_MARKETING_DRY_RUN = 'false';
    const document = plan([action({ approvedByUserId: undefined })]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);

    await expect(service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: false,
      validateOnly: false,
      source: 'codex_operator',
    })).rejects.toThrow('no canonical approver user ID');

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('blocks an already executed idempotencyKey', async () => {
    const document = plan([action()]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);
    storedSuccessfulLog = { idempotencyKey: 'PLAN-001:ACT001', status: 'success' };

    await expect(service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: true,
      source: 'codex_operator',
    })).rejects.toBeInstanceOf(ConflictException);

    expect(executionPolicy.preflight).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('executes server-built PAUSED campaign operations and stores provider request ID', async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.AI_MARKETING_DRY_RUN = 'false';
    const document = plan([action()]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);
    mockedAxios.post.mockResolvedValueOnce({
      headers: { 'request-id': 'provider-request-123' },
      data: { mutateOperationResponses: [{ campaignResult: { resourceName: 'customers/123/campaigns/456' } }] },
    } as any);

    const result = await service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: false,
      validateOnly: false,
      source: 'codex_operator',
    });

    const providerBody: any = mockedAxios.post.mock.calls[0][1];
    expect(providerBody).toEqual(expect.objectContaining({ validateOnly: false, partialFailure: false }));
    expect(executionPolicy.preflight).toHaveBeenCalledWith(document, [document.items[0]], {
      enforceFinancialControl: true,
    });
    expect(financialExecutionLease.acquire).toHaveBeenCalledTimes(1);
    expect(financialExecutionLease.renew).toHaveBeenCalledWith('lease-token');
    expect(financialExecutionLease.release).toHaveBeenCalledWith('lease-token');
    expect(providerBody.mutateOperations[1].campaignOperation.create.status).toBe('PAUSED');
    expect(document.items[0].status).toBe('executed');
    expect(postExecutionService.handleSuccessfulExecution).toHaveBeenCalledWith(expect.objectContaining({
      planId: document.planId,
      action: document.items[0],
    }));
    expect(result.logs[0]).toEqual(expect.objectContaining({
      status: 'success',
      providerRequestId: 'provider-request-123',
      idempotencyReserved: true,
      syncedRemoteState: expect.objectContaining({
        evaluationJobs: [{ evaluationDays: 3 }, { evaluationDays: 7 }],
      }),
    }));
  });

  it('stores redacted provider errors and releases idempotency after provider failure', async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.AI_MARKETING_DRY_RUN = 'false';
    const document = plan([action()]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        headers: { 'request-id': 'provider-request-failed' },
        data: { error: { code: 400, message: 'developer_token=real-secret invalid request' } },
      },
    });

    const result = await service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: false,
      validateOnly: false,
      source: 'codex_operator',
    });

    expect(result).toEqual(expect.objectContaining({ success: false, failed: 1 }));
    expect(result.logs[0]).toEqual(expect.objectContaining({
      status: 'failed',
      idempotencyReserved: false,
      providerRequestId: 'provider-request-failed',
    }));
    expect(result.logs[0].providerErrors[0].message).toContain('[REDACTED]');
    expect(result.logs[0].providerErrors[0].message).not.toContain('real-secret');
  });

  it('keeps a successful live mutation successful when post-execution processing fails', async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.AI_MARKETING_DRY_RUN = 'false';
    const document = plan([action()]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);
    mockedAxios.post.mockResolvedValueOnce({
      headers: { 'request-id': 'provider-request-post-failed' },
      data: { mutateOperationResponses: [{ campaignResult: { resourceName: 'customers/123/campaigns/456' } }] },
    } as any);
    postExecutionService.handleSuccessfulExecution.mockRejectedValueOnce(
      new Error('refresh_token=real-secret sync failed'),
    );

    const result = await service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: false,
      validateOnly: false,
      source: 'codex_operator',
    });

    expect(result).toEqual(expect.objectContaining({ success: true, executed: 1, failed: 0 }));
    expect(result.logs[0]).toEqual(expect.objectContaining({
      status: 'success',
      idempotencyReserved: true,
      postExecutionErrors: [{
        step: 'post_execution',
        message: expect.stringContaining('[REDACTED]'),
      }],
    }));
    expect(result.logs[0].postExecutionErrors[0].message).not.toContain('real-secret');
  });

  it('reports a Financial Control blocker in dry-run without calling the provider', async () => {
    const document = plan([action()]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);
    executionPolicy.evaluateFinancialControl.mockResolvedValueOnce({
      checked: true,
      required: true,
      allowed: false,
      reason: 'Google Ads sync is stale',
    });

    const result = await service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: true,
      source: 'codex_operator',
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      liveEligible: false,
      financialControl: expect.objectContaining({
        checked: true,
        allowed: false,
        reason: 'Google Ads sync is stale',
      }),
    }));
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(financialExecutionLease.acquire).not.toHaveBeenCalled();
  });

  it('does not acquire the spend-increase lease for rescue actions', async () => {
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    process.env.AI_MARKETING_DRY_RUN = 'false';
    const document = plan([action({ actionType: 'pause_campaign' })]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);
    executionPolicy.hasSpendIncreasingExposure.mockResolvedValueOnce(false);
    mockedAxios.post.mockResolvedValueOnce({ headers: {}, data: {} } as any);

    await service.execute(director, document.planId, {
      actionIds: ['ACT001'],
      dryRun: false,
      validateOnly: false,
      source: 'codex_operator',
    });

    expect(financialExecutionLease.acquire).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('fails backend initialization closed when the idempotency unique index cannot be verified', async () => {
    executionLogModel.collection.indexes.mockRejectedValueOnce(new Error('index permission denied'));

    await expect(service.onModuleInit()).rejects.toThrow(
      'idempotency protection is unavailable; backend startup is blocked',
    );
  });

  it('accepts only the expected unique partial idempotency index at startup', async () => {
    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(executionLogModel.collection.dropIndex).not.toHaveBeenCalled();
    expect(executionLogModel.collection.createIndex).not.toHaveBeenCalled();
  });
});
