import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationErpSourceProjectionRepository } from "./ads-automation-erp-source-projection.repository";
import type {
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
} from "./contracts/ads-automation-decision.contract";

const evidenceWindow = { from: "2026-06-21", to: "2026-07-04", days: 14 };
const freshAt = "2026-07-04T04:00:00.000Z";
const oldAt = "2026-06-30T00:00:00.000Z";
const query = {
  snapshotDate: "2026-07-04",
  evidenceWindow,
  now: "2026-07-04T05:00:00.000Z",
};

interface FixtureRows {
  adGroups: any[];
  advertisingCosts: any[];
  orders: any[];
  products: any[];
  inventorySummaries: any[];
  supplierQuotes: any[];
  supplierPayables: any[];
  suppliers: any[];
  availableFundSnapshots: any[];
  cashflowSummarySnapshots: any[];
}

function findDecision(
  snapshot: AdsAutomationDecisionSnapshot,
  type: AdsAutomationDecisionItem["decision_type"],
  entityId: string,
): AdsAutomationDecisionItem {
  const decision = snapshot.decisions.find(
    (item) => item.decision_type === type && item.entity_id === entityId,
  );
  if (!decision) throw new Error(`Missing ${type} decision for ${entityId}`);
  return decision;
}

function erpModelRows(overrides: Partial<FixtureRows> = {}): FixtureRows {
  const orderDate = "2026-07-03T08:00:00.000Z";
  const base: FixtureRows = {
    adGroups: [
      {
        _id: "adgroup-doc-1",
        platform: "google",
        accountId: "customer-demo",
        customerId: "customer-demo",
        campaignId: "campaign-scale",
        campaignName: "Search scale fixture",
        adGroupId: "adg-scale",
        name: "ERP mapped ad group",
        adGroupName: "ERP mapped ad group",
        resourceName: "customers/customer-demo/adGroups/adg-scale",
        campaignBudgetId: "budget-scale",
        campaignBudgetResourceName:
          "customers/customer-demo/campaignBudgets/budget-scale",
        effectiveStatus: "ENABLED",
        dailyBudget: 1000000,
        selectedProducts: ["product-scale"],
        bottlenecksChecked: true,
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    advertisingCosts: [
      {
        channel: "google",
        customerId: "customer-demo",
        adGroupId: "adg-scale",
        date: new Date("2026-07-03T00:00:00.000Z"),
        spentAmount: 300000,
        clicks: 120,
        impressions: 5000,
        conversions: 12,
        conversionValue: 4200000,
        lastSyncAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    orders: Array.from({ length: 6 }, (_, index) => ({
      _id: `order-scale-${index + 1}`,
      productId: "product-scale",
      supplierId: "supplier-safe",
      quantity: 1,
      adGroupId: "adg-scale",
      orderDate: new Date(orderDate),
      orderStatus: "completed",
      depositAmount: 100000,
      codAmount: 400000,
      manualPayment: 0,
      grossProfit: 180000,
      netProfit: 130000,
      advertisingCost: 50000,
      isActive: true,
      updatedAt: freshAt,
      createdAt: orderDate,
    })),
    products: [
      {
        _id: "product-scale",
        sku: "ERP-SCALE",
        name: "ERP safe scale product",
        importPrice: 220000,
        shippingCost: 20000,
        packagingCost: 10000,
        totalCost: 250000,
        estimatedDeliveryDays: 4,
        status: "Hoat dong",
        assumedReturnRatePercent: 5,
        images: [{ url: "/local-demo/product.jpg" }],
        fanpageVariations: [{ customPrice: 500000, isActive: true }],
        suppliers: [
          {
            supplierId: "supplier-safe",
            price1: 250000,
            appliedPrice: 250000,
            appliedAt: freshAt,
            isDefault: true,
          },
        ],
        updatedAt: freshAt,
      },
    ],
    inventorySummaries: [
      {
        productId: "product-scale",
        onHand: 120,
        avgCost: 250000,
        updatedAt: freshAt,
      },
    ],
    supplierQuotes: [
      {
        productId: "product-scale",
        supplierId: "supplier-safe",
        supplierName: "Safe ERP Supplier",
        price: 250000,
        approvalStatus: "approved",
        status: "approved",
        effectiveAt: new Date("2026-07-01T00:00:00.000Z"),
        leadTimeDays: 4,
        lateDeliveryRatePercent: 3,
        returnFaultRatePercent: 2,
        capacityStatus: "available",
        updatedAt: freshAt,
      },
      {
        productId: "product-scale",
        supplierId: "supplier-safe",
        supplierName: "Safe ERP Supplier",
        price: 255000,
        approvalStatus: "approved",
        status: "approved",
        effectiveAt: new Date("2026-06-15T00:00:00.000Z"),
        updatedAt: oldAt,
      },
    ],
    supplierPayables: [
      {
        supplierId: "supplier-safe",
        supplierNameSnap: "Safe ERP Supplier",
        status: "paid",
        payments: [
          { paidAt: new Date("2026-06-30T02:00:00.000Z"), amount: 1200000 },
        ],
        updatedAt: "2026-06-30T02:00:00.000Z",
      },
    ],
    suppliers: [
      {
        _id: "supplier-safe",
        fullName: "Safe ERP Supplier",
        role: "external_supplier",
        updatedAt: freshAt,
      },
    ],
    availableFundSnapshots: [
      {
        capturedAt: new Date(freshAt),
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
  return { ...base, ...overrides };
}

function cloneRows(rows = erpModelRows()): FixtureRows {
  return JSON.parse(JSON.stringify(rows));
}

function createRepository(rows = erpModelRows()) {
  const adapter = new AdsAutomationDecisionSourceAdapterService();
  const models = {
    order: mockModel(rows.orders),
    adGroup: mockModel(rows.adGroups),
    advertisingCost: mockModel(rows.advertisingCosts),
    product: mockModel(rows.products),
    inventorySummary: mockModel(rows.inventorySummaries),
    supplierQuote: mockModel(rows.supplierQuotes),
    supplierPayable: mockModel(rows.supplierPayables),
    user: mockModel(rows.suppliers),
    availableFundSnapshot: mockModel(rows.availableFundSnapshots),
    cashflowSummarySnapshot: mockModel(rows.cashflowSummarySnapshots),
  };
  return {
    repository: new AdsAutomationErpSourceProjectionRepository(
      models.order.model as any,
      models.adGroup.model as any,
      models.advertisingCost.model as any,
      models.product.model as any,
      models.inventorySummary.model as any,
      models.supplierQuote.model as any,
      models.supplierPayable.model as any,
      models.user.model as any,
      models.availableFundSnapshot.model as any,
      models.cashflowSummarySnapshot.model as any,
      adapter,
    ),
    models,
  };
}

describe("AdsAutomationErpSourceProjectionRepository", () => {
  const decisionService = new AdsAutomationDecisionService();

  it("projects mocked ERP Mongoose rows into a scale-ready decision source without mutations", async () => {
    const { repository, models } = createRepository();
    const result = await repository.buildDecisionSource(query);
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        db_connection_used: false,
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        production_ready: false,
      }),
    );
    expect(result.sourceEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "ads_performance",
          status: "fresh",
        }),
        expect.objectContaining({
          sourceKey: "campaign_budgets",
          status: "fresh",
        }),
        expect.objectContaining({
          sourceKey: "product_performance",
          status: "fresh",
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          status: "fresh",
        }),
        expect.objectContaining({
          sourceKey: "cashflow_policy",
          status: "fresh",
        }),
      ]),
    );
    expect(result.snapshotInput.adGroups?.[0]).toEqual(
      expect.objectContaining({
        adGroupId: "adg-scale",
        campaignBudgetId: "budget-scale",
        spendVnd: 300000,
        orderAdvertisingCostVnd: 300000,
        spendSourceOfTruth: "platform_spend",
        spendReconciliationStatus: "matched",
      }),
    );
    expect(result.mappingEvidence.spendReconciliation).toContainEqual(
      expect.objectContaining({
        adGroupId: "adg-scale",
        platformSpendVnd: 300000,
        orderAdvertisingCostVnd: 300000,
        status: "matched",
        sourceOfTruth: "platform_spend",
      }),
    );
    expect(findDecision(snapshot, "scale_ads", "adg-scale").status).toBe(
      "scale_ready",
    );
    expect(
      findDecision(snapshot, "scale_amount", "adg-scale").proposedValue,
    ).toEqual(
      expect.objectContaining({
        action: "update_campaign_budget_draft",
        campaignBudgetId: "budget-scale",
        proposedBudgetVnd: 1100000,
      }),
    );
    expect(
      findDecision(snapshot, "supplier_gate", "supplier-safe").status,
    ).toBe("safe");
    expect(models.order.calls[0].filter.orderDate).toEqual(
      expect.objectContaining({
        $gte: new Date("2026-06-21T00:00:00.000Z"),
        $lte: new Date("2026-07-04T23:59:59.999Z"),
      }),
    );
    expect(models.user.calls[0].projection.password).toBeUndefined();
    expect(allMutationCalls(models)).toEqual([]);
  });

  it("blocks scale amount when campaignBudgetId is missing and never falls back to campaignId or adGroupId", async () => {
    const rows = cloneRows();
    rows.adGroups[0].campaignBudgetId = undefined;
    rows.adGroups[0].campaignBudgetResourceName = undefined;
    const { repository } = createRepository(rows);

    const result = await repository.buildDecisionSource(query);
    const snapshot = decisionService.build(result.snapshotInput);
    const mappedGroup = result.snapshotInput.adGroups![0];

    expect(mappedGroup.campaignBudgetId).toBeUndefined();
    expect(mappedGroup.campaignBudgetResourceName).toBeUndefined();
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.campaignId);
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.adGroupId);
    expect(
      result.sourceEvidence.find(
        (item) => item.sourceKey === "campaign_budgets",
      )?.missingFields,
    ).toContain("campaignBudgetId_or_campaignBudgetResourceName");
    expect(findDecision(snapshot, "scale_ads", "adg-scale").status).toBe(
      "insufficient_data",
    );
    expect(
      snapshot.decisions.some(
        (item) =>
          item.decision_type === "scale_amount" &&
          item.entity_id === "adg-scale",
      ),
    ).toBe(false);
  });

  it("surfaces unmapped product/ad-group evidence from projected ERP rows", async () => {
    const rows = cloneRows();
    rows.adGroups[0].selectedProducts = [];
    rows.orders.push({
      _id: "order-missing-adgroup",
      productId: "product-scale",
      supplierId: "supplier-safe",
      quantity: 1,
      orderDate: "2026-07-03T08:00:00.000Z",
      orderStatus: "completed",
      depositAmount: 100000,
      codAmount: 400000,
      grossProfit: 180000,
      advertisingCost: 50000,
      isActive: true,
      updatedAt: freshAt,
    });
    const { repository } = createRepository(rows);

    const result = await repository.buildDecisionSource(query);
    const snapshot = decisionService.build(result.snapshotInput);
    const productMapping = result.mappingEvidence.productMappings.find(
      (item) => item.productId === "product-scale",
    );
    const missingAdGroupOrder = result.mappingEvidence.orderAttribution.find(
      (item) => item.orderId === "order-missing-adgroup",
    );

    expect(productMapping?.blockers).toContain(
      "product_ad_group_mapping_missing",
    );
    expect(missingAdGroupOrder?.blockers).toContain("missing_order_adGroupId");
    expect(
      findDecision(snapshot, "product_budget_allocation", "product-scale")
        .status,
    ).toBe("insufficient_data");
    expect(findDecision(snapshot, "scale_ads", "adg-scale").blockers).toContain(
      "product_gate_insufficient_data",
    );
  });

  it("blocks projected scale decisions when ERP orders are returned, refunded, or cancelled", async () => {
    const rows = cloneRows();
    rows.orders = rows.orders.map((order, index) => ({
      ...order,
      orderStatus:
        index % 3 === 0
          ? "returned"
          : index % 3 === 1
            ? "refunded"
            : "cancelled",
      grossProfit: 0,
      netProfit: -50000,
    }));
    const { repository } = createRepository(rows);

    const result = await repository.buildDecisionSource(query);
    const snapshot = decisionService.build(result.snapshotInput);
    const scaleDecision = findDecision(snapshot, "scale_ads", "adg-scale");

    expect(result.mappingEvidence.orderAttribution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockers: expect.arrayContaining([
            "returned_refunded_cancelled_order",
          ]),
          includedInProfit: false,
        }),
      ]),
    );
    expect(scaleDecision.status).toBe("blocked");
    expect(scaleDecision.blockers).toEqual(
      expect.arrayContaining([
        "orders_below_minimum",
        "net_profit_after_ads_not_positive",
        "ad_group_return_cancel_refund_rate_too_high",
        "returned_refunded_cancelled_order_profit_blocker",
      ]),
    );
    expect(scaleDecision.proposedValue).toEqual(
      expect.objectContaining({ action: "monitor_only" }),
    );
  });

  it("keeps platform spend as source of truth when projected order advertisingCost mismatches", async () => {
    const rows = cloneRows();
    rows.orders = rows.orders.map((order) => ({
      ...order,
      advertisingCost: 10000,
    }));
    const { repository } = createRepository(rows);

    const result = await repository.buildDecisionSource(query);
    const snapshot = decisionService.build(result.snapshotInput);
    const scaleDecision = findDecision(snapshot, "scale_ads", "adg-scale");

    expect(result.snapshotInput.adGroups?.[0]).toEqual(
      expect.objectContaining({
        spendVnd: 300000,
        orderAdvertisingCostVnd: 60000,
        spendSourceOfTruth: "platform_spend",
        spendReconciliationStatus: "mismatch",
      }),
    );
    expect(result.mappingEvidence.spendReconciliation).toContainEqual(
      expect.objectContaining({
        adGroupId: "adg-scale",
        platformSpendVnd: 300000,
        orderAdvertisingCostVnd: 60000,
        mismatchVnd: 240000,
        status: "mismatch",
        blockers: ["platform_spend_order_ad_cost_mismatch"],
      }),
    );
    expect(scaleDecision.status).toBe("blocked");
    expect(scaleDecision.blockers).toContain(
      "platform_spend_order_ad_cost_mismatch",
    );
  });

  it("downgrades to monitor_only when projected stock, supplier, cashflow, and loss-limit evidence are unsafe", async () => {
    const rows = cloneRows();
    rows.inventorySummaries[0].onHand = 2;
    rows.supplierQuotes[0] = {
      ...rows.supplierQuotes[0],
      status: "pending",
      leadTimeDays: 20,
      lateDeliveryRatePercent: 35,
      returnFaultRatePercent: 20,
      capacityStatus: "blocked",
    };
    rows.availableFundSnapshots[0].available = 0;
    rows.cashflowSummarySnapshots[0].data = {
      ...rows.cashflowSummarySnapshots[0].data,
      freeCash: 2500000,
      survivalFloor: 3000000,
      availableAfterSurvival: 0,
      adsBudgetApproved: 0,
      daily_loss_limit_safe: false,
      monthly_loss_limit_safe: false,
    };
    const { repository } = createRepository(rows);

    const result = await repository.buildDecisionSource(query);
    const snapshot = decisionService.build(result.snapshotInput);
    const scaleDecision = findDecision(snapshot, "scale_ads", "adg-scale");
    const productDecision = findDecision(
      snapshot,
      "product_budget_allocation",
      "product-scale",
    );
    const supplierDecision = findDecision(
      snapshot,
      "supplier_gate",
      "supplier-safe",
    );

    expect(result.snapshotInput.policy).toEqual(
      expect.objectContaining({ cashflowGatePassed: false }),
    );
    expect(scaleDecision.status).toBe("blocked");
    expect(scaleDecision.blockers).toEqual(
      expect.arrayContaining(["cashflow_gate_blocked", "product_gate_blocked"]),
    );
    expect(scaleDecision.proposedValue).toEqual(
      expect.objectContaining({ action: "monitor_only" }),
    );
    expect(productDecision.blockers).toEqual(
      expect.arrayContaining([
        "stock_below_minimum",
        "no_safe_supplier_for_scale",
      ]),
    );
    expect(supplierDecision.status).toBe("blocked");
  });

  it("preserves stale ERP source watermarks so scale actions stay insufficient-data", async () => {
    const rows = cloneRows();
    rows.adGroups = rows.adGroups.map((row) => ({
      ...row,
      lastSyncAt: oldAt,
      updatedAt: oldAt,
    }));
    rows.advertisingCosts = rows.advertisingCosts.map((row) => ({
      ...row,
      lastSyncAt: oldAt,
      updatedAt: oldAt,
    }));
    rows.orders = rows.orders.map((row) => ({
      ...row,
      updatedAt: oldAt,
      createdAt: oldAt,
    }));
    const { repository } = createRepository(rows);

    const result = await repository.buildDecisionSource({
      ...query,
      maxAgeHours: {
        ads_performance: 24,
        campaign_budgets: 24,
        pause_review: 24,
      },
    });
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.sourceEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "ads_performance",
          status: "stale",
          canUseForDecision: "cautious",
          latestObservedAt: oldAt,
        }),
        expect.objectContaining({
          sourceKey: "campaign_budgets",
          status: "stale",
          canUseForDecision: "cautious",
          latestObservedAt: oldAt,
        }),
      ]),
    );
    expect(findDecision(snapshot, "scale_ads", "adg-scale").status).toBe(
      "insufficient_data",
    );
    expect(
      snapshot.decisions.some(
        (item) =>
          item.decision_type === "scale_amount" &&
          item.entity_id === "adg-scale",
      ),
    ).toBe(false);
  });
});

function mockModel(rows: any[]) {
  const calls: Array<{
    filter: any;
    projection: any;
    sort?: any;
    limit?: number;
  }> = [];
  const mutationCalls: string[] = [];
  const model = {
    find: jest.fn((filter: any = {}, projection: any = {}) => {
      const call: { filter: any; projection: any; sort?: any; limit?: number } =
        { filter, projection };
      calls.push(call);
      let result = applyMongoFind(rows, filter, projection);
      const chain: any = {
        sort: jest.fn((sort: any) => {
          call.sort = sort;
          result = sortRows(result, sort);
          return chain;
        }),
        limit: jest.fn((limit: number) => {
          call.limit = limit;
          result = result.slice(0, limit);
          return chain;
        }),
        lean: jest.fn(() => chain),
        exec: jest.fn().mockResolvedValue(result),
      };
      return chain;
    }),
    create: jest.fn(() => mutationCalls.push("create")),
    updateOne: jest.fn(() => mutationCalls.push("updateOne")),
    findOneAndUpdate: jest.fn(() => mutationCalls.push("findOneAndUpdate")),
    deleteOne: jest.fn(() => mutationCalls.push("deleteOne")),
  };
  return { model, calls, mutationCalls };
}

function allMutationCalls(
  models: ReturnType<typeof createRepository>["models"],
) {
  return Object.values(models).flatMap((model) => model.mutationCalls);
}

function applyMongoFind(rows: any[], filter: any, projection: any) {
  return rows
    .filter((row) => matchesMongoFilter(row, filter))
    .map((row) => projectRow(row, projection));
}

function projectRow(row: any, projection: any) {
  const included = Object.entries(projection || {})
    .filter(([, value]) => Number(value) === 1)
    .map(([field]) => field);
  if (!included.length) return { ...row };
  return included.reduce((projected, field) => {
    if (field in row) projected[field] = row[field];
    return projected;
  }, {} as any);
}

function matchesMongoFilter(row: any, filter: any): boolean {
  return Object.entries(filter || {}).every(([field, expected]) => {
    if (field === "$or" && Array.isArray(expected)) {
      return expected.some((branch) => matchesMongoFilter(row, branch));
    }
    return matchesMongoValue(row[field], expected);
  });
}

function matchesMongoValue(actual: any, expected: any): boolean {
  if (
    expected &&
    typeof expected === "object" &&
    !Array.isArray(expected) &&
    !(expected instanceof Date)
  ) {
    if ("$in" in expected) {
      const expectedValues = expected.$in.map((value: unknown) =>
        String(value),
      );
      return Array.isArray(actual)
        ? actual.some((value) => expectedValues.includes(String(value)))
        : expectedValues.includes(String(actual));
    }
    if ("$gte" in expected && compareMongoValues(actual, expected.$gte) < 0)
      return false;
    if ("$lte" in expected && compareMongoValues(actual, expected.$lte) > 0)
      return false;
    if ("$ne" in expected && String(actual) === String(expected.$ne))
      return false;
    return true;
  }
  return String(actual) === String(expected);
}

function sortRows(rows: any[], sort: any) {
  return [...rows].sort((left, right) => {
    for (const [field, direction] of Object.entries(sort || {})) {
      const compared =
        compareMongoValues(left[field], right[field]) *
        (Number(direction) < 0 ? -1 : 1);
      if (compared !== 0) return compared;
    }
    return 0;
  });
}

function compareMongoValues(left: any, right: any): number {
  const leftTime =
    left instanceof Date ? left.getTime() : new Date(left).getTime();
  const rightTime =
    right instanceof Date ? right.getTime() : new Date(right).getTime();
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime;
  }
  return String(left ?? "").localeCompare(String(right ?? ""));
}
