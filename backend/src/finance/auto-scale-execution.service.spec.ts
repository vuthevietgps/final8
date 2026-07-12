import { AutoScaleExecutionService } from './auto-scale-execution.service';

describe('AutoScaleExecutionService execution boundary', () => {
  it('rejects the legacy all-groups execution before reading or mutating state', async () => {
    const adGroupModel = {
      find: jest.fn(),
      updateOne: jest.fn(),
    };
    const capitalAllocationService = { computeAllocation: jest.fn() };
    const autoScaleDecisionService = { makeDecision: jest.fn() };
    const budgetApplyService = { applyBudgetToProvider: jest.fn() };
    const cashflowSafetyService = { getSystemLockStatus: jest.fn() };
    const service = new AutoScaleExecutionService(
      adGroupModel as any,
      autoScaleDecisionService as any,
      capitalAllocationService as any,
      cashflowSafetyService as any,
      budgetApplyService as any,
    );

    await expect(service.runDailyAutoScale()).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'CANONICAL_GOOGLE_ADS_V2_EXECUTION_REQUIRED',
      }),
    });

    expect(capitalAllocationService.computeAllocation).not.toHaveBeenCalled();
    expect(adGroupModel.find).not.toHaveBeenCalled();
    expect(adGroupModel.updateOne).not.toHaveBeenCalled();
    expect(budgetApplyService.applyBudgetToProvider).not.toHaveBeenCalled();
  });
});
