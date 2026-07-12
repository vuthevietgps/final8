import { ForbiddenException } from '@nestjs/common';
import { BudgetAllocationService } from './budget-allocation.service';

describe('BudgetAllocationService execution boundary', () => {
  const createService = () => {
    const capitalAllocationService = {
      getAvailableReinvestmentBudget: jest.fn().mockResolvedValue({
        available: 1_000_000,
        initialReinvestment: 1_000_000,
        totalAllocated: 1_000_000,
        totalUsed: 0,
        formula: 'test',
      }),
    };
    const adGroupProfitService = {
      getOptimalSpendSuggestions: jest.fn().mockResolvedValue([
        {
          adGroupId: 'ag-1',
          adGroupName: 'Ad group 1',
          lastProfit: 100_000,
          lastSpend: 100_000,
          appliedSpend: 120_000,
        },
      ]),
    };
    const budgetApplyService = {
      resolveContext: jest.fn(),
      applyBudgetToProvider: jest.fn(),
    };
    const cashflowSafetyService = {
      getCashflowHealthDashboard: jest.fn().mockResolvedValue({ CSI: 1 }),
    };
    const adGroupModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { adGroupId: 'ag-1', dailyBudget: 100_000 },
          ]),
        }),
      }),
    };

    const service = new BudgetAllocationService(
      capitalAllocationService as any,
      adGroupProfitService as any,
      budgetApplyService as any,
      cashflowSafetyService as any,
      adGroupModel as any,
    );

    return {
      service,
      capitalAllocationService,
      adGroupProfitService,
      budgetApplyService,
      cashflowSafetyService,
    };
  };

  it('rejects live allocation before reading data or resolving a provider context', async () => {
    const { service, capitalAllocationService, budgetApplyService, cashflowSafetyService } = createService();

    await expect(service.autoAllocateBudget({ dryRun: false })).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'CANONICAL_GOOGLE_ADS_V2_EXECUTION_REQUIRED',
      }),
    });

    expect(cashflowSafetyService.getCashflowHealthDashboard).not.toHaveBeenCalled();
    expect(capitalAllocationService.getAvailableReinvestmentBudget).not.toHaveBeenCalled();
    expect(budgetApplyService.resolveContext).not.toHaveBeenCalled();
    expect(budgetApplyService.applyBudgetToProvider).not.toHaveBeenCalled();
  });

  it('keeps dry-run allocation available without touching the provider', async () => {
    const { service, budgetApplyService, adGroupProfitService } = createService();

    const result = await service.autoAllocateBudget({ dryRun: true });

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual(expect.objectContaining({
      adGroupId: 'ag-1',
      allocatedBudget: 120_000,
    }));
    expect(adGroupProfitService.getOptimalSpendSuggestions).toHaveBeenCalled();
    expect(budgetApplyService.resolveContext).not.toHaveBeenCalled();
    expect(budgetApplyService.applyBudgetToProvider).not.toHaveBeenCalled();
  });

  it('uses the fail-closed environment default when dryRun is omitted', async () => {
    const previousDryRun = process.env.AI_MARKETING_DRY_RUN;
    process.env.AI_MARKETING_DRY_RUN = 'false';
    const { service } = createService();

    try {
      await expect(service.autoAllocateBudget()).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      if (previousDryRun === undefined) delete process.env.AI_MARKETING_DRY_RUN;
      else process.env.AI_MARKETING_DRY_RUN = previousDryRun;
    }
  });
});
