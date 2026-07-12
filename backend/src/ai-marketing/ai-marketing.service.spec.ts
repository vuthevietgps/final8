import { NotFoundException } from '@nestjs/common';
import { AiMarketingService } from './ai-marketing.service';

describe('AiMarketingService approval safety', () => {
  const createService = (overrides: Record<string, any> = {}) => {
    const leadModel = {};
    const planModel = {
      findById: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      ...overrides.planModel,
    };
    const executionLogModel = { create: jest.fn(), ...overrides.executionLogModel };
    const evaluationModel = { create: jest.fn(), find: jest.fn(), aggregate: jest.fn(), ...overrides.evaluationModel };
    const creativeModel = { aggregate: jest.fn(), find: jest.fn(), ...overrides.creativeModel };
    const modelWithAggregate = { aggregate: jest.fn() };
    const adGroupModel = { find: jest.fn(), ...overrides.adGroupModel };
    const profitReportService = {
      getOptimalSpendSuggestions: jest.fn(),
      getProfitSummary: jest.fn(),
      ...overrides.profitReportService,
    };
    const budgetApplyService = {
      resolveContext: jest.fn(),
      applyBudgetToProvider: jest.fn(),
      applyBudgetToProviderDetailed: jest.fn(),
      pauseAdGroupOnProvider: jest.fn(),
      resumeAdGroupOnProvider: jest.fn(),
      ...overrides.budgetApplyService,
    };

    const service = new AiMarketingService(
      leadModel as any,
      planModel as any,
      executionLogModel as any,
      evaluationModel as any,
      creativeModel as any,
      modelWithAggregate as any,
      modelWithAggregate as any,
      modelWithAggregate as any,
      modelWithAggregate as any,
      adGroupModel as any,
      profitReportService as any,
      budgetApplyService as any,
    );

    return { service, planModel, budgetApplyService, executionLogModel, evaluationModel };
  };

  it('approves a pending item and refreshes the plan status', async () => {
    const plan = {
      items: [
        {
          _id: 'item-1',
          actionType: 'increase_budget',
          status: 'pending',
          targetValue: 100000,
        },
      ],
      markModified: jest.fn(),
      save: jest.fn(),
    };
    const { service, planModel } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(plan) },
    });

    await service.approvePlanItem(
      { email: 'director@example.com' },
      'plan-1',
      'item-1',
      { approved: true, confirmedTargetValue: 120000, note: 'ok' },
    );

    const item = plan.items[0] as any;
    expect(item.status).toBe('approved');
    expect(item.approvedBy).toBe('director@example.com');
    expect(item.targetValue).toBe(120000);
    expect((plan as any).status).toBe('approved');
    expect(plan.markModified).toHaveBeenCalledWith('items');
    expect(plan.save).toHaveBeenCalled();
    expect(planModel.findById).toHaveBeenCalledWith('plan-1');
  });

  it('does not apply budget actions that have not been approved', async () => {
    const plan = {
      items: [
        {
          _id: 'item-1',
          actionType: 'increase_budget',
          status: 'pending',
          adGroupId: 'ag-1',
          targetValue: 120000,
        },
      ],
    };
    const { service, planModel, budgetApplyService } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(plan) },
    });

    const result = await service.applyPlan({ email: 'manager@example.com' }, 'plan-1', { dryRun: false });

    expect(result.applied).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(budgetApplyService.applyBudgetToProvider).not.toHaveBeenCalled();
    expect(planModel.findById).toHaveBeenCalledWith('plan-1');
  });

  it('keeps approved items approved after dry-run apply', async () => {
    const plan = {
      _id: 'plan-1',
      items: [
        {
          _id: 'item-1',
          actionType: 'increase_budget',
          status: 'approved',
          adGroupId: 'ag-1',
          targetValue: 120000,
        },
      ],
      markModified: jest.fn(),
      save: jest.fn(),
    };
    const { service, budgetApplyService, executionLogModel } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(plan) },
      executionLogModel: {
        create: jest.fn().mockResolvedValue({
          _id: 'log-1',
          status: 'dry_run',
          executedAt: new Date(),
          planId: 'plan-1',
          itemId: 'item-1',
        }),
      },
    });
    (service as any).captureActionSnapshot = jest.fn().mockResolvedValue({});
    (service as any).createEvaluationForLog = jest.fn();

    const result = await service.applyPlan({ email: 'manager@example.com' }, 'plan-1', { dryRun: true });

    expect(result.applied).toBe(0);
    expect(result.dryRun).toBe(1);
    expect(plan.items[0].status).toBe('approved');
    expect(budgetApplyService.applyBudgetToProvider).not.toHaveBeenCalled();
    expect((service as any).createEvaluationForLog).not.toHaveBeenCalled();
    expect(executionLogModel.create).toHaveBeenCalled();
  });

  it('blocks legacy live apply and records the canonical V2 boundary', async () => {
    const plan = {
      _id: 'plan-1',
      items: [
        {
          _id: 'item-1',
          actionType: 'increase_budget',
          status: 'approved',
          adGroupId: 'ag-1',
          currentValue: 100000,
          targetValue: 110000,
        },
      ],
      markModified: jest.fn(),
      save: jest.fn(),
    };
    const { service, budgetApplyService, executionLogModel } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(plan) },
      executionLogModel: {
        create: jest.fn().mockResolvedValue({
          _id: 'log-1',
          status: 'failed',
          executedAt: new Date(),
          planId: 'plan-1',
          itemId: 'item-1',
        }),
      },
    });
    (service as any).captureActionSnapshot = jest.fn().mockResolvedValue({});

    const result = await service.applyPlan({ email: 'manager@example.com' }, 'plan-1', { dryRun: false });

    expect(result.applied).toBe(0);
    expect(result.failed).toBe(1);
    expect(plan.items[0].status).toBe('failed');
    expect(budgetApplyService.applyBudgetToProvider).not.toHaveBeenCalled();
    expect(budgetApplyService.applyBudgetToProviderDetailed).not.toHaveBeenCalled();
    expect(budgetApplyService.pauseAdGroupOnProvider).not.toHaveBeenCalled();
    expect(budgetApplyService.resumeAdGroupOnProvider).not.toHaveBeenCalled();
    expect(executionLogModel.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      errorMessage: expect.stringContaining('validateOnly'),
      providerResponse: expect.objectContaining({
        code: 'CANONICAL_GOOGLE_ADS_V2_EXECUTION_REQUIRED',
      }),
    }));
  });

  it('fails approved budget actions that exceed the +20% safety cap', async () => {
    const plan = {
      _id: 'plan-1',
      items: [
        {
          _id: 'item-1',
          actionType: 'increase_budget',
          status: 'approved',
          adGroupId: 'ag-1',
          currentValue: 100000,
          targetValue: 150000,
        },
      ],
      markModified: jest.fn(),
      save: jest.fn(),
    };
    const { service, budgetApplyService, executionLogModel } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(plan) },
      executionLogModel: {
        create: jest.fn().mockResolvedValue({
          _id: 'log-1',
          status: 'failed',
          executedAt: new Date(),
          planId: 'plan-1',
          itemId: 'item-1',
        }),
      },
    });
    (service as any).captureActionSnapshot = jest.fn().mockResolvedValue({});

    const result = await service.applyPlan({ email: 'manager@example.com' }, 'plan-1', {});

    expect(result.applied).toBe(0);
    expect(result.failed).toBe(1);
    expect(plan.items[0].status).toBe('failed');
    expect(budgetApplyService.applyBudgetToProvider).not.toHaveBeenCalled();
    expect(executionLogModel.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      errorMessage: expect.stringContaining('+20%'),
    }));
  });

  it('throws when approving an item from a missing plan', async () => {
    const { service } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.approvePlanItem({ email: 'director@example.com' }, 'missing', 'item-1', { approved: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
