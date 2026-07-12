import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationErpSourceImportReadinessService } from "./ads-automation-erp-source-import-readiness.service";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import type { AdsAutomationDecisionReadModelQuery } from "./contracts/ads-automation-decision-read-model-query.contract";
import type { AdsAutomationDecisionErpSourceAdapterInput } from "./contracts/ads-automation-decision-source-adapter.contract";
import type { AdsAutomationPlatformSourceSyncStatusSourceKey } from "./contracts/ads-automation-platform-source-sync-status.contract";

const freshAt = "2026-07-04T04:30:00.000Z";
const oldAt = "2026-06-30T00:00:00.000Z";
const reportDate = "2026-07-04";
const query: AdsAutomationDecisionReadModelQuery = {
  snapshotDate: reportDate,
  evidenceWindow: { from: "2026-06-21", to: reportDate, days: 14 },
  now: "2026-07-04T05:00:00.000Z",
};

function buildService(input = erpProjectionInput()) {
  const projectionRepository = {
    buildAdapterInput: jest.fn().mockResolvedValue(input),
  };
  const adapter = new AdsAutomationDecisionSourceAdapterService();
  return {
    service: new AdsAutomationErpSourceImportReadinessService(
      projectionRepository as any,
      adapter,
      new AdsAutomationReadonlyPlatformImportReadinessService(adapter),
    ),
    projectionRepository,
  };
}

function erpProjectionInput(
  overrides: Partial<AdsAutomationDecisionErpSourceAdapterInput> = {},
): AdsAutomationDecisionErpSourceAdapterInput {
  const input: AdsAutomationDecisionErpSourceAdapterInput = {
    snapshotDate: reportDate,
    evidenceWindow: query.evidenceWindow,
    sourceWatermarks: {
      ads_performance: freshAt,
      campaign_budgets: freshAt,
      pause_review: freshAt,
      product_performance: freshAt,
      supplier_safety: freshAt,
      cashflow_policy: freshAt,
    },
    adGroups: [
      {
        _id: "adgroup-scale-doc",
        platform: "google_ads",
        accountId: "1234567890",
        customerId: "1234567890",
        campaignId: "1001",
        campaignName: "HTX ERP Search Scale",
        adGroupId: "2001",
        adGroupName: "ERP profitable cookware",
        resourceName: "customers/1234567890/adGroups/2001",
        campaignBudgetId: "3001",
        campaignBudgetResourceName: "customers/1234567890/campaignBudgets/3001",
        dailyBudget: 1000000,
        effectiveStatus: "ENABLED",
        selectedProducts: ["P_SCALE"],
        labels: [],
        bottlenecksChecked: true,
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
      {
        _id: "adgroup-pause-doc",
        platform: "google_ads",
        accountId: "1234567890",
        customerId: "1234567890",
        campaignId: "1002",
        campaignName: "HTX ERP Pause Review",
        adGroupId: "2002",
        adGroupName: "ERP refund heavy cookware",
        resourceName: "customers/1234567890/adGroups/2002",
        campaignBudgetId: "3002",
        campaignBudgetResourceName: "customers/1234567890/campaignBudgets/3002",
        dailyBudget: 500000,
        effectiveStatus: "ENABLED",
        selectedProducts: ["P_BAD"],
        labels: [],
        bottlenecksChecked: true,
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    advertisingCosts: [
      {
        platform: "google_ads",
        channel: "google_ads",
        accountId: "1234567890",
        customerId: "1234567890",
        adGroupId: "2001",
        date: `${reportDate}T00:00:00.000Z`,
        spendVnd: 320000,
        clicks: 132,
        impressions: 6200,
        conversions: 13,
        conversionValueVnd: 4300000,
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
      {
        platform: "google_ads",
        channel: "google_ads",
        accountId: "1234567890",
        customerId: "1234567890",
        adGroupId: "2002",
        date: `${reportDate}T00:00:00.000Z`,
        spendVnd: 350000,
        clicks: 88,
        impressions: 4100,
        conversions: 0,
        conversionValueVnd: 0,
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    orders: Array.from({ length: 6 }, (_, index) => ({
      _id: `order-scale-${index + 1}`,
      productId: "P_SCALE",
      supplierId: "SUP_SAFE",
      quantity: 1,
      adGroupId: "2001",
      orderDate: "2026-07-03T08:00:00.000Z",
      orderStatus: "completed",
      depositAmount: 100000,
      codAmount: 400000,
      grossProfit: 180000,
      advertisingCost: 53333.33,
      isActive: true,
      updatedAt: freshAt,
      createdAt: "2026-07-03T08:00:00.000Z",
    })),
    products: [
      {
        _id: "P_SCALE",
        sku: "ERP-SCALE",
        name: "Profitable cookware set",
        salePrice: 500000,
        importPrice: 180000,
        shippingCost: 20000,
        packagingCost: 10000,
        totalCost: 210000,
        estimatedDeliveryDays: 4,
        status: "active",
        assumedReturnRatePercent: 8,
        images: [{ url: "/local-demo/scale.jpg" }],
        fanpageVariations: [{ customPrice: 500000, isActive: true }],
        suppliers: [
          {
            supplierId: "SUP_SAFE",
            appliedPrice: 180000,
            appliedAt: freshAt,
            isDefault: true,
          },
        ],
        updatedAt: freshAt,
      },
      {
        _id: "P_BAD",
        sku: "ERP-BAD",
        name: "Refund heavy cookware set",
        salePrice: 250000,
        importPrice: 260000,
        shippingCost: 20000,
        packagingCost: 10000,
        totalCost: 290000,
        estimatedDeliveryDays: 14,
        status: "active",
        assumedReturnRatePercent: 40,
        images: [{ url: "/local-demo/bad.jpg" }],
        fanpageVariations: [{ customPrice: 250000, isActive: true }],
        suppliers: [
          {
            supplierId: "SUP_WEAK_1",
            appliedPrice: 260000,
            appliedAt: freshAt,
            isDefault: true,
          },
          {
            supplierId: "SUP_WEAK_2",
            appliedPrice: 280000,
            appliedAt: freshAt,
          },
        ],
        updatedAt: freshAt,
      },
    ],
    inventorySummaries: [
      {
        productId: "P_SCALE",
        onHand: 120,
        avgCost: 210000,
        updatedAt: freshAt,
      },
      {
        productId: "P_BAD",
        onHand: 50,
        avgCost: 290000,
        updatedAt: freshAt,
      },
    ],
    supplierQuotes: [
      {
        productId: "P_SCALE",
        supplierId: "SUP_SAFE",
        supplierName: "Safe ERP Supplier",
        price: 180000,
        status: "approved",
        effectiveAt: "2026-07-01T00:00:00.000Z",
        leadTimeDays: 4,
        lateDeliveryRatePercent: 3,
        returnFaultRatePercent: 2,
        capacityStatus: "available",
        updatedAt: freshAt,
      },
      {
        productId: "P_BAD",
        supplierId: "SUP_WEAK_1",
        supplierName: "Weak ERP Supplier 1",
        price: 260000,
        status: "approved",
        effectiveAt: "2026-07-01T00:00:00.000Z",
        leadTimeDays: 14,
        lateDeliveryRatePercent: 20,
        returnFaultRatePercent: 14,
        capacityStatus: "constrained",
        updatedAt: freshAt,
      },
      {
        productId: "P_BAD",
        supplierId: "SUP_WEAK_2",
        supplierName: "Weak ERP Supplier 2",
        price: 280000,
        status: "pending",
        effectiveAt: "2026-07-01T00:00:00.000Z",
        leadTimeDays: 16,
        lateDeliveryRatePercent: 22,
        returnFaultRatePercent: 18,
        capacityStatus: "blocked",
        updatedAt: freshAt,
      },
    ],
    supplierPayables: [
      {
        supplierId: "SUP_SAFE",
        supplierNameSnap: "Safe ERP Supplier",
        status: "paid",
        payments: [{ paidAt: "2026-06-30T02:00:00.000Z", amount: 1200000 }],
        updatedAt: "2026-06-30T02:00:00.000Z",
      },
      {
        supplierId: "SUP_WEAK_1",
        supplierNameSnap: "Weak ERP Supplier 1",
        status: "overdue",
        dueDate: "2026-05-10T00:00:00.000Z",
        payments: [{ paidAt: "2026-05-20T02:00:00.000Z", amount: 500000 }],
        updatedAt: freshAt,
      },
      {
        supplierId: "SUP_WEAK_2",
        supplierNameSnap: "Weak ERP Supplier 2",
        status: "overdue",
        dueDate: "2026-05-10T00:00:00.000Z",
        payments: [{ paidAt: "2026-05-15T02:00:00.000Z", amount: 500000 }],
        updatedAt: freshAt,
      },
    ],
    suppliers: [
      {
        _id: "SUP_SAFE",
        fullName: "Safe ERP Supplier",
        role: "external_supplier",
        updatedAt: freshAt,
      },
      {
        _id: "SUP_WEAK_1",
        fullName: "Weak ERP Supplier 1",
        role: "external_supplier",
        updatedAt: freshAt,
      },
      {
        _id: "SUP_WEAK_2",
        fullName: "Weak ERP Supplier 2",
        role: "external_supplier",
        updatedAt: freshAt,
      },
    ],
    availableFundSnapshots: [
      {
        capturedAt: freshAt,
        available: 500000,
        updatedAt: freshAt,
      },
    ],
    cashflowSummarySnapshots: [
      {
        domain: "financial_control",
        windowDays: 14,
        updatedAt: freshAt,
        data: {
          freeCash: 5000000,
          survivalFloor: 3000000,
          availableAfterSurvival: 2000000,
          adsBudgetApproved: 500000,
          daily_loss_limit_safe: true,
          monthly_loss_limit_safe: true,
          maxBudgetIncreasePercent: 20,
          mediumConfidenceIncreasePercent: 10,
          minOrdersForScale: 5,
          minDataQualityScore: 0.75,
          minSpendForPauseVnd: 200000,
          maxReturnRatePercent: 25,
          minMarginPercent: 20,
          minStockAvailable: 10,
          minDaysOfCover: 7,
          maxSupplierLeadTimeDays: 10,
          maxSupplierLateDeliveryRatePercent: 15,
          maxSupplierReturnFaultRatePercent: 12,
          maxSupplierPaymentFreshnessDays: 30,
        },
      },
    ],
  };

  return { ...input, ...overrides };
}

function cloneInput(
  input: AdsAutomationDecisionErpSourceAdapterInput = erpProjectionInput(),
): AdsAutomationDecisionErpSourceAdapterInput {
  return JSON.parse(JSON.stringify(input));
}

function staleStampedRows<T extends object>(rows: T[] | undefined): T[] {
  return (rows || []).map((row) => ({
    ...row,
    lastSyncAt: oldAt,
    lastSyncedAt: oldAt,
    sourceUpdatedAt: oldAt,
    updatedAt: oldAt,
    createdAt: oldAt,
  }));
}

describe("AdsAutomationErpSourceImportReadinessService", () => {
  it("builds readiness from ERP projected sources with scale, pause, product, and supplier evidence", async () => {
    const { service, projectionRepository } = buildService();
    const result = await service.build(query);

    expect(projectionRepository.buildAdapterInput).toHaveBeenCalledWith(query);
    expect(result.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        local_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        campaignBudgetId_no_fallback: true,
      }),
    );
    expect(result.sourceSyncStatus.summary).toEqual(
      expect.objectContaining({
        status: "ready",
        blocked_source_count: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.readonlyImportReadiness.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_local_decision_review",
        campaignBudgetId_missing_rows: 0,
        scale_up_execution_mode: "pending_validation",
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        may_increase_ads: true,
        ad_groups_to_increase: ["2001"],
        products_can_receive_budget: ["P_SCALE"],
        supplier_choice_safe: true,
        safe_supplier_choices: ["SUP_SAFE"],
        required_source_count: 5,
        required_source_ready_count: 5,
        required_source_blocked_count: 0,
        required_source_report_date_covered_count: 5,
        required_source_report_date_blocked_count: 0,
        missing_required_source_evidence: [],
        source_coverage_blocking_reasons: [],
        product_kill_or_stop_review_needed: true,
        product_kill_or_stop_review: ["P_BAD"],
        campaign_or_ad_group_pause_recommended: true,
        campaign_or_ad_group_pause: expect.arrayContaining(["2002"]),
        scale_up_execution_mode: "pending_validation",
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(
      result.readonlyImportReadiness.decisionReadiness.answers
        .blocked_product_budget_candidates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "P_BAD",
          blockers: expect.arrayContaining([
            "product_net_profit_not_positive",
            "no_safe_supplier_for_scale",
          ]),
        }),
      ]),
    );
    expect(
      result.readonlyImportReadiness.decisionReadiness.answers
        .blocked_supplier_choices,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "SUP_WEAK_1",
          blockers: expect.arrayContaining(["lead_time_too_high"]),
        }),
        expect.objectContaining({
          entityId: "SUP_WEAK_2",
          blockers: expect.arrayContaining(["quote_not_approved"]),
        }),
      ]),
    );
    expect(result.readonlyImportReadiness.platformEntityCoverage).toEqual(
      expect.objectContaining({
        metrics: expect.objectContaining({
          rows: 2,
          readyRows: 2,
          clicks: 220,
          impressions: 10300,
          conversions: 13,
        }),
        campaignBudgets: expect.objectContaining({
          campaignBudgetIds: ["3001", "3002"],
          campaignBudgetId_required: true,
          campaignBudgetId_no_fallback: true,
          campaignBudgetId_fallback_used: false,
          missingCampaignBudgetIdRows: 0,
        }),
      }),
    );
  });

  it("blocks readiness when campaignBudgetId is missing and does not fall back to campaignId or adGroupId", async () => {
    const input = cloneInput();
    input.adGroups![0].campaignBudgetId = undefined;
    input.adGroups![0].campaignBudgetResourceName = undefined;
    const { service } = buildService(input);

    const result = await service.build(query);

    expect(result.sourceSyncStatus.summary.blocked_sources).toContain(
      "google_ads",
    );
    expect(result.readonlyImportReadiness.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        campaignBudgetId_missing_rows: 1,
        scale_up_execution_mode: "monitor_only",
      }),
    );
    expect(result.readonlyImportReadiness.metricRows[0]).toEqual(
      expect.objectContaining({
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        blockers: expect.arrayContaining([
          "campaignBudgetId_missing_no_fallback",
        ]),
      }),
    );
    expect(result.adapterResult.snapshotInput.adGroups?.[0]).toEqual(
      expect.objectContaining({
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: undefined,
      }),
    );
    expect(
      result.readonlyImportReadiness.decisionReadiness.candidates
        .adGroupsToIncrease,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "2001" })]),
    );
    expect(result.summary.may_increase_ads).toBe(false);
  });

  it.each([
    {
      label: "missing google_ads ad group coverage",
      sourceKey: "google_ads" as const,
      expectedStatus: "missing_coverage",
      expectedBlocker: "google_ads_campaignBudgetId_missing_no_fallback",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.adGroups = [];
      },
    },
    {
      label: "stale google_ads",
      sourceKey: "google_ads" as const,
      expectedStatus: "stale",
      expectedBlocker: "freshness_stale",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.sourceWatermarks = {
          ...input.sourceWatermarks,
          ads_performance: oldAt,
          campaign_budgets: oldAt,
          pause_review: oldAt,
        };
        input.adGroups = staleStampedRows(input.adGroups);
        input.advertisingCosts = staleStampedRows(input.advertisingCosts);
      },
    },
    {
      label: "stale advertising_costs",
      sourceKey: "advertising_costs" as const,
      expectedStatus: "stale",
      expectedBlocker: "freshness_stale",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.advertisingCosts = staleStampedRows(input.advertisingCosts);
      },
    },
    {
      label: "missing advertising_costs",
      sourceKey: "advertising_costs" as const,
      expectedStatus: "not_synced",
      expectedBlocker: "advertising_costs_records_missing",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.advertisingCosts = [];
      },
    },
    {
      label: "stale product_mapping",
      sourceKey: "product_mapping" as const,
      expectedStatus: "stale",
      expectedBlocker: "freshness_stale",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.adGroups = staleStampedRows(input.adGroups);
        input.products = staleStampedRows(input.products);
      },
    },
    {
      label: "missing product_mapping",
      sourceKey: "product_mapping" as const,
      expectedStatus: "missing_coverage",
      expectedBlocker: "product_mapping_missing_mappedAdGroupIds",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.adGroups = input.adGroups!.map((row) => ({
          ...row,
          selectedProducts: [],
          productIds: [],
          internalProductIds: [],
        }));
      },
    },
    {
      label: "stale inventory_profit",
      sourceKey: "inventory_profit" as const,
      expectedStatus: "stale",
      expectedBlocker: "freshness_stale",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.products = staleStampedRows(input.products);
        input.inventorySummaries = staleStampedRows(input.inventorySummaries);
        input.orders = staleStampedRows(input.orders);
      },
    },
    {
      label: "missing inventory_profit",
      sourceKey: "inventory_profit" as const,
      expectedStatus: "missing_coverage",
      expectedBlocker: "inventory_profit_inventory_summary_missing",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.inventorySummaries = [];
      },
    },
    {
      label: "stale supplier_safety",
      sourceKey: "supplier_safety" as const,
      expectedStatus: "stale",
      expectedBlocker: "freshness_stale",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.supplierQuotes = staleStampedRows(input.supplierQuotes);
        input.supplierPayables = staleStampedRows(input.supplierPayables);
        input.suppliers = staleStampedRows(input.suppliers);
      },
    },
    {
      label: "missing supplier_safety",
      sourceKey: "supplier_safety" as const,
      expectedStatus: "missing_coverage",
      expectedBlocker: "supplier_safety_context_missing",
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => {
        input.supplierQuotes = [];
        input.suppliers = [];
      },
    },
  ])(
    "blocks decision readiness for $label source blockers",
    async (scenario: {
      label: string;
      sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey;
      expectedStatus: string;
      expectedBlocker: string;
      mutate: (input: AdsAutomationDecisionErpSourceAdapterInput) => void;
    }) => {
      const input = cloneInput();
      scenario.mutate(input);
      const { service } = buildService(input);

      const result = await service.build(query);

      expect(result.sourceSyncStatus.summary.status).toBe("blocked");
      expect(result.sourceSyncStatus.summary.blocked_sources).toContain(
        scenario.sourceKey,
      );
      const sourceStatus = result.sourceSyncStatus.sources.find(
        (source) => source.sourceKey === scenario.sourceKey,
      );
      const decisionEvidence = result.sourceSyncStatus.decisionEvidence.find(
        (source) => source.sourceKey === scenario.sourceKey,
      );
      const sourceCoverage =
        result.readonlyImportReadiness.sourceImportCoverage.find(
          (source) => source.sourceKey === scenario.sourceKey,
        );

      expect(sourceStatus).toEqual(
        expect.objectContaining({
          status: scenario.expectedStatus,
          canUseForAdsAutomationDecision: false,
        }),
      );
      expect(decisionEvidence).toEqual(
        expect.objectContaining({
          canUseForAdsAutomationDecision: false,
          blockingReasons: expect.arrayContaining([
            `${scenario.sourceKey}_not_ready_for_ads_automation_decision`,
            scenario.expectedBlocker,
          ]),
        }),
      );
      expect(sourceCoverage).toEqual(
        expect.objectContaining({
          canUseForAdsAutomationDecision: false,
          blockingReason: `${scenario.sourceKey}_not_ready_for_ads_automation_decision`,
          blockingReasons: expect.arrayContaining([scenario.expectedBlocker]),
        }),
      );
      expect(result.readonlyImportReadiness.decisionReadiness).toEqual(
        expect.objectContaining({
          status: "blocked",
          scale_up_execution_mode: "monitor_only",
          action_generation_allowed_for_review: false,
          can_generate_action_draft: false,
          can_increase_ads: false,
          execution_allowed_now: false,
        }),
      );
      expect(result.summary).toEqual(
        expect.objectContaining({
          may_increase_ads: false,
          scale_up_execution_mode: "monitor_only",
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
    },
  );
});
