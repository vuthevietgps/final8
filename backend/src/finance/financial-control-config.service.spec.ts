import { BadRequestException } from '@nestjs/common';
import { FinancialControlService } from './financial-control.service';
import { DEFAULT_CONFIG } from './interfaces/financial-control.interface';

describe('FinancialControlService config persistence', () => {
  const createService = () => {
    let storedConfig = { ...DEFAULT_CONFIG };
    const settingsModel = {
      findOne: jest.fn().mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue({ key: 'financial_control', value: storedConfig }),
      })),
      create: jest.fn(),
      findOneAndUpdate: jest.fn().mockImplementation((_filter, update) => {
        storedConfig = { ...update.$set.value };
        return Promise.resolve({ value: storedConfig });
      }),
    };
    const cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn().mockResolvedValue(undefined) };
    const eventEmitter = { emitAsync: jest.fn().mockResolvedValue([]) };
    const service = new FinancialControlService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      settingsModel as any,
      cacheManager as any,
      eventEmitter as any,
    );
    return {
      service,
      settingsModel,
      cacheManager,
      eventEmitter,
      setStoredConfig: (next: typeof DEFAULT_CONFIG) => { storedConfig = { ...next }; },
    };
  };

  it('persists validated policy with authenticated actor and bounded audit history', async () => {
    const { service, settingsModel } = createService();

    const result = await service.updateConfig(
      { SurvivalMonths: 6, SafetyFactor: 0.7 },
      { id: 'director-1', email: 'director@example.com' },
    );

    expect(result).toEqual(expect.objectContaining({ SurvivalMonths: 6, SafetyFactor: 0.7 }));
    expect(settingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'financial_control' },
      expect.objectContaining({
        $set: expect.objectContaining({
          value: expect.objectContaining({ SurvivalMonths: 6, SafetyFactor: 0.7 }),
          updatedBy: 'director@example.com',
        }),
        $push: {
          auditHistory: expect.objectContaining({
            $each: [expect.objectContaining({
              changedBy: 'director@example.com',
              changedFields: ['SurvivalMonths', 'SafetyFactor'],
              previousValue: expect.objectContaining({ SurvivalMonths: 3 }),
            })],
            $slice: -100,
          }),
        },
      }),
      { upsert: true, new: true },
    );
  });

  it('requests a supplier forecast snapshot refresh when cash-cycle policy changes', async () => {
    const { service, eventEmitter } = createService();

    await service.updateConfig(
      { SupplierCashCycleDays: 21 },
      { id: 'director-1', email: 'director@example.com' },
    );

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'finance.financial_control_policy_updated',
      expect.objectContaining({
        changedFields: ['SupplierCashCycleDays'],
        changedBy: 'director@example.com',
      }),
    );
  });

  it.each([
    [{ CommittedWindowDays: 0 }, 'CommittedWindowDays'],
    [{ CommittedWindowDays: 21 }, 'CommittedWindowDays'],
    [{ SurvivalMonths: -1 }, 'SurvivalMonths'],
    [{ RiskAdjustInflow: 1.1 }, 'RiskAdjustInflow'],
    [{ MinStartBudget: -1 }, 'MinStartBudget'],
    [{ UpperCapMultiplier: 0.8 }, 'UpperCapMultiplier'],
    [{ LowerCapMultiplier: 1.2 }, 'LowerCapMultiplier'],
    [{ SafetyFactor: -0.1 }, 'SafetyFactor'],
    [{ UnsupportedPolicy: 1 }, 'unsupported field'],
  ])('rejects invalid config %j', async (partial, message) => {
    const { service, settingsModel } = createService();

    await expect(service.updateConfig(partial as any, { id: 'director-1' })).rejects.toThrow(message);
    expect(settingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not change in-memory policy when durable persistence fails', async () => {
    const { service, settingsModel } = createService();
    settingsModel.findOneAndUpdate.mockRejectedValue(new Error('database unavailable'));

    await expect(service.updateConfig(
      { SurvivalMonths: 8 },
      { email: 'director@example.com' },
    )).rejects.toThrow('database unavailable');

    expect((await service.getConfig()).SurvivalMonths).toBe(3);
  });

  it('merges an update against the latest database policy instead of stale pod memory', async () => {
    const { service, settingsModel, setStoredConfig } = createService();
    setStoredConfig({ ...DEFAULT_CONFIG, SafetyFactor: 0.55 });

    const result = await service.updateConfig(
      { SurvivalMonths: 6 },
      { email: 'director@example.com' },
    );

    expect(result).toEqual(expect.objectContaining({ SurvivalMonths: 6, SafetyFactor: 0.55 }));
    expect(settingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'financial_control' },
      expect.objectContaining({
        $set: expect.objectContaining({
          value: expect.objectContaining({ SurvivalMonths: 6, SafetyFactor: 0.55 }),
        }),
      }),
      { upsert: true, new: true },
    );
  });

  it('allows PATCH to repair a legacy unsupported committed window', async () => {
    const { service, settingsModel, setStoredConfig } = createService();
    setStoredConfig({ ...DEFAULT_CONFIG, CommittedWindowDays: 21 });

    const result = await service.updateConfig(
      { CommittedWindowDays: 14 },
      { email: 'director@example.com' },
    );

    expect(result.CommittedWindowDays).toBe(14);
    expect(settingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'financial_control' },
      expect.objectContaining({
        $set: expect.objectContaining({
          value: expect.objectContaining({ CommittedWindowDays: 14 }),
        }),
      }),
      { upsert: true, new: true },
    );
  });

  it('rejects an empty update', async () => {
    const { service } = createService();
    await expect(service.updateConfig({}, { id: 'director-1' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
