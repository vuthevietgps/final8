import { FinancialControlService } from './financial-control.service';
import { DEFAULT_CONFIG } from './interfaces/financial-control.interface';

describe('FinancialControlService core safety', () => {
  const utcDay = (offset = 0) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  const validTaxSnapshot = (overrides: Record<string, any> = {}) => ({
    totalTaxDue: 500,
    dueByDay7d: [{ date: utcDay(1), amount: 200 }],
    asOf: new Date().toISOString(),
    source: 'tax_filing',
    evidence: 'Tax filing reference TAX-2026-07',
    updatedBy: 'finance-user-1',
    ...overrides,
  });

  const validCanonicalAds = (overrides: Record<string, any> = {}) => ({
    suggestions: new Map(),
    adGroupSuggestions: [{
      adGroupId: 'ag-1',
      adGroupName: 'AG 1',
      spendYesterday: 100,
      currentAvgSpend: 90,
      baselineSpend: 100,
      suggestedSpend: 130,
      suggestedSpendWithCap: 120,
    }],
    totalSuggestedSpend: 130,
    totalSuggestedSpendWithCap: 120,
    totalCurrentSpend: 90,
    mode: 'legacy',
    defaultAssumedReturnRatePercent: 20,
    ...overrides,
  });

  const createService = (params: {
    config?: Record<string, any>;
    adsResult?: Record<string, any>;
    snapshotRead?: (domain: string, windowDays: number) => any;
    snapshotStaleness?: (domain: string, windowDays: number) => number;
  } = {}) => {
    let storedConfig = { ...DEFAULT_CONFIG, ...(params.config || {}) };
    const orderModel = { aggregate: jest.fn() };
    const adGroupDailyReportService = {
      getOptimalSpendSuggestions: jest.fn().mockImplementation(async () => (
        params.adsResult || validCanonicalAds()
      )),
    };
    const financeService = {
      calculateMasterBankBalance: jest.fn().mockResolvedValue(10_000),
      getDebtCashflowSummary: jest.fn().mockResolvedValue({ totalDebtDue14d: 300, dueByDay7d: [] }),
      getLoanSummary: jest.fn().mockResolvedValue({}),
    };
    const snapshotService = {
      read: jest.fn().mockImplementation(async (domain: string, windowDays: number) => (
        params.snapshotRead?.(domain, windowDays) ?? null
      )),
      getStaleness: jest.fn().mockImplementation(async (domain: string, windowDays: number) => (
        params.snapshotStaleness?.(domain, windowDays) ?? 0
      )),
      store: jest.fn().mockResolvedValue(undefined),
      storeTaxWithAudit: jest.fn().mockResolvedValue(undefined),
    };
    const settingsModel = {
      findOne: jest.fn().mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue({ key: 'financial_control', value: storedConfig }),
      })),
      findOneAndUpdate: jest.fn(),
    };
    const cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    const service = new FinancialControlService(
      orderModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      adGroupDailyReportService as any,
      financeService as any,
      snapshotService as any,
      settingsModel as any,
      cacheManager as any,
      { emitAsync: jest.fn() } as any,
    );
    return {
      service,
      orderModel,
      adGroupDailyReportService,
      financeService,
      snapshotService,
      setStoredConfig: (next: Record<string, any>) => { storedConfig = { ...DEFAULT_CONFIG, ...next }; },
    };
  };

  it('uses the canonical Ads optimizer with Financial Control caps and returns a finite weekly envelope', async () => {
    const { service, adGroupDailyReportService } = createService({
      config: { MinStartBudget: 80, UpperCapMultiplier: 1.2, LowerCapMultiplier: 0.7 },
    });

    const result = await service.getOptimalAdsSuggestion();

    expect(adGroupDailyReportService.getOptimalSpendSuggestions).toHaveBeenCalledWith({
      minStartBudget: 80,
      upperCapMultiplier: 1.2,
      lowerCapMultiplier: 0.7,
    });
    expect(result).toEqual(expect.objectContaining({
      totalOptimalDaily: 120,
      totalOptimalWeekly: 840,
      cappedCount: 1,
    }));
    expect(Number.isFinite(result.totalOptimalWeekly)).toBe(true);
  });

  it('rejects a malformed canonical Ads aggregate instead of propagating NaN', async () => {
    const { service } = createService({
      adsResult: validCanonicalAds({ totalSuggestedSpendWithCap: undefined }),
    });

    await expect(service.getOptimalAdsSuggestion()).rejects.toThrow(
      'Invalid financial value: ads.totalSuggestedSpendWithCap',
    );
  });

  it('does not count supplier AR as monthly burn and preserves the legacy field as zero', async () => {
    const { service, orderModel } = createService({
      snapshotRead: (domain, windowDays) => {
        if (windowDays !== 30) return null;
        if (domain === 'labor') return { totalPayrollDue14d: 100, dueByDay7d: [] };
        if (domain === 'ops') return {
          totalOpsDue14d: 200,
          byCategory: [{ category: 'rent', due14d: 200 }],
          dueByDay7d: [],
        };
        if (domain === 'agent') return { totalAgentDue14d: 400, byAgent: [] };
        return null;
      },
    });

    const result = await (service as any).getMonthlyBurn();

    expect(result).toEqual(expect.objectContaining({
      laborCore: 100,
      operationsMandatory: 200,
      loanPayment: 300,
      agentCommission: 400,
      supplierPendingPayment: 0,
      total: 1_000,
    }));
    expect(orderModel.aggregate).not.toHaveBeenCalled();
  });

  it('locks decisions when tax is unavailable or a required snapshot is stale', () => {
    const { service } = createService();
    const quality = (service as any).buildDataQuality(
      {
        labor: 0, operations: 0, agents: 0, tax: 0, loanPayment: 0, total: 0,
        windowDays: 14, isEstimated: true,
        estimationNotes: ['tax: chua co nguon nghia vu thue canonical'],
      },
      { laborCore: 0, operationsMandatory: 0, loanPayment: 0, total: 0 },
      { staleModules: ['supplier'] },
    );

    expect(quality.isDecisionLocked).toBe(true);
    expect(quality.missingModules).toContain('tax');
    expect(quality.staleModules).toContain('supplier');
    expect(quality.blockingReasons).toHaveLength(2);
  });

  it('profiles required snapshot freshness and schema instead of reporting false-green', async () => {
    const { service } = createService({
      snapshotRead: (domain) => {
        if (domain === 'labor') return { totalPayrollDue14d: 100, dueByDay7d: [] };
        if (domain === 'ops') return { totalOpsDue14d: 100, byCategory: [], dueByDay7d: [] };
        if (domain === 'agent') return { totalAgentDue14d: 100, byAgent: [] };
        if (domain === 'supplier') return { expectedInflowByDay: [] };
        if (domain === 'tax') return validTaxSnapshot();
        return null;
      },
      snapshotStaleness: (domain) => domain === 'supplier' ? 25 * 60 * 60 * 1000 : 0,
    });

    const quality = await (service as any).getSnapshotQualityState();

    expect(quality.invalidModules).toEqual([]);
    expect(quality.staleModules).toEqual(['supplier']);
  });

  it('stores an evidence-backed tax obligation with server-owned updatedBy metadata', async () => {
    const { service, snapshotService } = createService();
    const input = validTaxSnapshot();
    delete (input as any).updatedBy;

    const saved = await service.upsertTaxObligationSnapshot(input as any, {
      id: 'director-1',
      email: 'director@example.com',
    });

    expect(saved).toEqual(expect.objectContaining({
      totalTaxDue: 500,
      updatedBy: 'director-1',
      source: 'tax_filing',
    }));
    expect(snapshotService.storeTaxWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({ updatedBy: 'director-1', evidence: expect.any(String) }),
      'director-1',
    );
  });

  it('rejects stale, unsupported or internally inconsistent tax input', async () => {
    const { service } = createService();
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    await expect(service.upsertTaxObligationSnapshot(
      validTaxSnapshot({ asOf: stale }) as any,
      { id: 'director-1' },
    )).rejects.toThrow('older than 24 hours');
    await expect(service.upsertTaxObligationSnapshot(
      validTaxSnapshot({ source: 'unverified_spreadsheet' }) as any,
      { id: 'director-1' },
    )).rejects.toThrow('Invalid tax.source');
    await expect(service.upsertTaxObligationSnapshot(
      validTaxSnapshot({ totalTaxDue: 100 }) as any,
      { id: 'director-1' },
    )).rejects.toThrow('scheduled amount exceeds totalTaxDue');
  });

  it('includes canonical tax in committed cash and the exact forecast due date', async () => {
    const { service } = createService({
      snapshotRead: (domain, windowDays) => {
        if (domain === 'tax') return validTaxSnapshot();
        if (domain === 'labor') return { totalPayrollDue14d: 100, dueByDay7d: [] };
        if (domain === 'ops') return { totalOpsDue14d: 200, byCategory: [], dueByDay7d: [] };
        if (domain === 'agent') return { totalAgentDue14d: 300, byAgent: [], dueByDay7d: [] };
        return null;
      },
    });

    const committed = await (service as any).getCommittedCash();
    await (service as any).ensureOutflowCachePopulated();
    const outflow = await (service as any).getExpectedOutflow(
      new Date(`${utcDay(1)}T00:00:00.000Z`),
      0,
    );

    expect(committed.tax).toBe(500);
    expect(committed.total).toBe(1_400);
    expect(outflow.tax).toBe(200);
    expect(outflow.total).toBe(200);
  });

  it('reports tax module health from canonical freshness rather than a hard-coded error', async () => {
    const { service } = createService({
      snapshotRead: (domain) => {
        if (domain === 'tax') return validTaxSnapshot();
        if (domain === 'labor') return { totalPayrollDue14d: 100, dueByDay7d: [] };
        if (domain === 'ops') return { totalOpsDue14d: 100, byCategory: [], dueByDay7d: [] };
        if (domain === 'agent') return { totalAgentDue14d: 100, byAgent: [] };
        if (domain === 'supplier') return { expectedInflowByDay: [] };
        return null;
      },
      snapshotStaleness: (domain) => domain === 'tax' ? 25 * 60 * 60 * 1000 : 0,
    });

    const health = await service.getModuleHealth();

    expect(health.modules.tax).toEqual(expect.objectContaining({
      status: 'partial',
      error: 'Snapshot older than 24 hours',
    }));
    expect(health.overall).toBe('partial');
  });

  it('forecasts T..T+6 and does not classify reducible Ads-only spend as hard cash crunch', async () => {
    const { service } = createService();
    const expectedDates: string[] = [];
    (service as any).ensureInflowCachePopulated = jest.fn().mockResolvedValue(undefined);
    (service as any).ensureOutflowCachePopulated = jest.fn().mockResolvedValue(undefined);
    (service as any).getExpectedInflow = jest.fn().mockImplementation(async (date: Date) => {
      expectedDates.push(date.toISOString().slice(0, 10));
      return {
        supplierPayments: 0,
        loanDisbursement: 0,
        refunds: 0,
        other: 0,
        total: 0,
        adjustedTotal: 0,
      };
    });
    (service as any).getExpectedOutflow = jest.fn().mockResolvedValue({
      adsDaily: 60,
      labor: 0,
      operations: 0,
      agents: 0,
      tax: 0,
      loanPayment: 0,
      total: 60,
    });

    const result = await service.getForecast7D(100, 60, {
      laborCore: 0,
      operationsMandatory: 0,
      loanPayment: 0,
      total: 0,
    });

    expect(result.days.map((day) => day.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(expectedDates[0]).toBe(new Date().toISOString().slice(0, 10));
    expect(result.lowPoint).toBe(-320);
    expect(result.hardOutLowPoint).toBe(100);
    expect(result.isCashCrunch).toBe(false);
    expect(result.isSurvivalRisk).toBe(true);
  });

  it('reloads canonical policy before calculation with the same stable version on every pod', async () => {
    const first = createService({ config: { LowerCapMultiplier: 0.5 } });
    const second = createService({ config: { LowerCapMultiplier: 0.5 } });

    await first.service.getOptimalAdsSuggestion();
    await second.service.getOptimalAdsSuggestion();

    expect((await first.service.getConfig()).LowerCapMultiplier).toBe(0.5);
    expect((first.service as any).policyVersion).toBe((second.service as any).policyVersion);
  });
});
