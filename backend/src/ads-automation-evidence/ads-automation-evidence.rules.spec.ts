import { evaluateAdGroupEvidence, summarizeReadiness } from './ads-automation-evidence.rules';

describe('Ads automation evidence rules', () => {
  const baseInput = {
    adGroupId: 'ag-001',
    campaignBudgetId: 'budget-001',
    productIds: ['64b64b64b64b64b64b64b64b'],
    commerce: {
      orders: 5,
      revenue: 5_000_000,
      grossProfit: 2_000_000,
      netProfitAfterAds: 1_000_000,
      dataFreshness: 'fresh' as const,
    },
    inventory: {
      stockOnHand: 20,
      minStock: 5,
      dataFreshness: 'fresh' as const,
    },
    supplier: {
      supplierIds: ['supplier-001'],
      quoteCount: 1,
      openPayableBalance: 0,
      dataFreshness: 'fresh' as const,
    },
    finance: {
      availableCash: 20_000_000,
      dailyCap: 5_000_000,
      monthlyCap: 100_000_000,
      currentDailySpend: 1_000_000,
      currentMonthlySpend: 20_000_000,
      dataFreshness: 'fresh' as const,
    },
    adsGate: {
      productionEnabled: true,
      providerExecutionEnabled: true,
      dryRun: false,
      killSwitchActive: false,
      providerValidateOnlyPassed: true,
      approved: true,
      idempotencyReady: true,
      beforeStateSnapshotReady: true,
      auditReady: true,
    },
  };

  it('marks missing product mapping as needs_mapping', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      productIds: [],
      mappingStatus: 'missing',
    });

    expect(result.readinessStatus).toBe('needs_mapping');
    expect(result.blockers.map((item) => item.code)).toContain('MAPPING_PRODUCT_MISSING');
  });

  it('blocks budget scale when campaignBudgetId is missing without fallback', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      campaignBudgetId: undefined,
      campaignId: 'campaign-001',
      adGroupId: 'ag-001',
    });

    expect(result.readinessStatus).toBe('blocked');
    expect(result.blockers.map((item) => item.code)).toContain('BUDGET_CAMPAIGN_BUDGET_ID_MISSING');
    expect(result.campaignBudgetId).toBeUndefined();
  });

  it('blocks negative profit after ads and recommends pause review', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      commerce: {
        ...baseInput.commerce,
        netProfitAfterAds: -500_000,
      },
    });

    expect(result.readinessStatus).toBe('blocked');
    expect(result.recommendedActionFamily).toBe('pause_review');
    expect(result.blockers.map((item) => item.code)).toContain('COMMERCE_NET_PROFIT_AFTER_ADS_NEGATIVE');
  });

  it('blocks when loss limit is hit', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      finance: {
        ...baseInput.finance,
        lossLimit: 1_000_000,
        realizedLoss: 1_200_000,
      },
    });

    expect(result.readinessStatus).toBe('blocked');
    expect(result.financeGate.status).toBe('block');
    expect(result.blockers.map((item) => item.code)).toContain('FINANCE_LOSS_LIMIT_HIT');
  });

  it('blocks when cashflow evidence is unavailable', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      finance: {
        currentDailySpend: 1_000_000,
        currentMonthlySpend: 20_000_000,
        dataFreshness: 'missing' as const,
      },
    });

    expect(result.readinessStatus).toBe('blocked');
    expect(result.financeGate.status).toBe('unknown');
    expect(result.blockers.map((item) => item.code)).toContain('FINANCE_AVAILABLE_CASH_MISSING');
  });

  it('holds when order or profit evidence is stale', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      commerce: {
        ...baseInput.commerce,
        dataFreshness: 'stale',
      },
    });

    expect(result.readinessStatus).toBe('hold');
    expect(result.blockers.map((item) => item.code)).toContain('COMMERCE_DATA_NOT_FRESH');
  });

  it('holds when stock or supplier data is stale', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      inventory: {
        ...baseInput.inventory,
        dataFreshness: 'stale',
      },
      supplier: {
        ...baseInput.supplier,
        dataFreshness: 'stale',
        supplierRisk: 'review',
      },
    });

    expect(result.readinessStatus).toBe('hold');
    expect(result.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'INVENTORY_DATA_NOT_FRESH',
      'SUPPLIER_NEEDS_REVIEW',
    ]));
  });

  it('blocks live-capable action when production flag is false', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      adsGate: {
        ...baseInput.adsGate,
        productionEnabled: false,
      },
    });

    expect(result.decisionReadiness).toBe('scale_ready');
    expect(result.readinessStatus).toBe('scale_ready');
    expect(result.executionReadiness).toBe('execution_blocked');
    expect(result.adsGate.executable).toBe(false);
    expect(result.decisionBlockers.map((item) => item.code)).not.toContain('ADS_PRODUCTION_DISABLED');
    expect(result.executionBlockers.map((item) => item.code)).toContain('ADS_PRODUCTION_DISABLED');
    expect(result.blockers.map((item) => item.code)).toContain('ADS_PRODUCTION_DISABLED');
  });

  it('blocks live-capable action when provider validateOnly is missing', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      adsGate: {
        ...baseInput.adsGate,
        providerValidateOnlyPassed: false,
      },
    });

    expect(result.readinessStatus).toBe('scale_ready');
    expect(result.executionReadiness).toBe('execution_blocked');
    expect(result.adsGate.executable).toBe(false);
    expect(result.executionBlockers.map((item) => item.code)).toContain('ADS_VALIDATE_ONLY_MISSING');
  });

  it('blocks live-capable action when human approval is missing', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      adsGate: {
        ...baseInput.adsGate,
        approved: false,
      },
    });

    expect(result.readinessStatus).toBe('scale_ready');
    expect(result.executionReadiness).toBe('execution_blocked');
    expect(result.adsGate.executable).toBe(false);
    expect(result.executionBlockers.map((item) => item.code)).toContain('ADS_APPROVAL_MISSING');
  });

  it('blocks all live-capable actions when kill switch is active', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      adsGate: {
        ...baseInput.adsGate,
        killSwitchActive: true,
      },
    });

    expect(result.readinessStatus).toBe('scale_ready');
    expect(result.executionReadiness).toBe('execution_blocked');
    expect(result.adsGate.executable).toBe(false);
    expect(result.executionBlockers.map((item) => item.code)).toContain('ADS_KILL_SWITCH_ACTIVE');
  });

  it('holds the decision when finance data is stale and computes strict budget headroom', () => {
    const result = evaluateAdGroupEvidence({
      ...baseInput,
      finance: {
        ...baseInput.finance,
        dataFreshness: 'stale',
      },
    });

    expect(result.decisionReadiness).toBe('hold');
    expect(result.decisionBlockers.map((item) => item.code)).toContain('FINANCE_DATA_NOT_FRESH');
    expect(result.financeGate.cappedBudgetIncrease).toBe(4_000_000);
  });

  it('summarizes decision and execution readiness independently', () => {
    const ready = evaluateAdGroupEvidence(baseInput);
    const executionBlocked = evaluateAdGroupEvidence({
      ...baseInput,
      adsGate: { ...baseInput.adsGate, approved: false },
    });

    expect(summarizeReadiness([ready, executionBlocked])).toEqual(expect.objectContaining({
      totalAdGroups: 2,
      scaleReady: 2,
      blocked: 0,
      executionReady: 1,
      executionBlocked: 1,
    }));
  });
});
