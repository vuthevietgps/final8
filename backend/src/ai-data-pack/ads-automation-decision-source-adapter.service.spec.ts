import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import {
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
} from "./contracts/ads-automation-decision.contract";
import {
  AdsAutomationDecisionErpSourceAdapterInput,
  AdsAutomationDecisionSourceAdapterInput,
} from "./contracts/ads-automation-decision-source-adapter.contract";

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

function completeRows(): AdsAutomationDecisionSourceAdapterInput {
  const freshAt = "2026-07-04T04:00:00.000Z";
  return {
    snapshotDate: "2026-07-04",
    evidenceWindow: { from: "2026-06-21", to: "2026-07-04", days: 14 },
    policy: {
      availableAdsCashVnd: 500000,
      cashflowGatePassed: true,
      maxBudgetIncreasePercent: 20,
      mediumConfidenceIncreasePercent: 10,
      minOrdersForScale: 5,
      minDataQualityScore: 0.75,
      minSpendForPauseVnd: 200000,
      maxReturnRatePercent: 25,
      minMarginPercent: 20,
      lastSyncAt: freshAt,
    },
    adGroups: [
      {
        platform: "google",
        customerId: "1234567890",
        campaignId: "1001",
        campaignName: "Search - Scale",
        adGroupId: "2001",
        adGroupName: "Rice cooker winning ad group",
        resourceName: "customers/1234567890/adGroups/2001",
        campaignBudgetId: "3001",
        campaignBudgetResourceName: "customers/1234567890/campaignBudgets/3001",
        status: "ENABLED",
        currentBudgetVnd: 1000000,
        spendVnd: 300000,
        clicks: 120,
        impressions: 5000,
        conversions: 12,
        conversionValueVnd: 4000000,
        orders: 12,
        revenueVnd: 4000000,
        grossProfitVnd: 1600000,
        netProfitAfterAdsVnd: 700000,
        returnRatePercent: 8,
        dataQualityScore: 0.92,
        labels: [],
        internalProductIds: ["P_SCALE"],
        bottlenecksChecked: true,
        lastSyncAt: freshAt,
      },
      {
        platform: "google",
        customerId: "1234567890",
        campaignId: "1002",
        campaignName: "Search - Bad",
        adGroupId: "2002",
        adGroupName: "Refund-heavy ad group",
        resourceName: "customers/1234567890/adGroups/2002",
        campaignBudgetId: "3002",
        campaignBudgetResourceName: "customers/1234567890/campaignBudgets/3002",
        status: "ENABLED",
        currentBudgetVnd: 500000,
        spendVnd: 350000,
        clicks: 88,
        impressions: 4100,
        conversions: 0,
        conversionValueVnd: 0,
        orders: 0,
        revenueVnd: 0,
        grossProfitVnd: 0,
        netProfitAfterAdsVnd: -350000,
        returnRatePercent: 40,
        dataQualityScore: 0.88,
        labels: [],
        internalProductIds: ["P_BAD"],
        bottlenecksChecked: true,
        lastSyncAt: freshAt,
      },
    ],
    products: [
      {
        productId: "P_SCALE",
        sku: "SKU-SCALE",
        productName: "Profitable cooker",
        netProfitVnd: 1250000,
        adAttributedNetProfitAfterAdsVnd: 700000,
        marginPercent: 45,
        returnCancelRefundRatePercent: 8,
        stockAvailable: 120,
        daysOfCover: 20,
        mediaReady: true,
        landingReady: true,
        offerReady: true,
        mappedAdGroupIds: ["2001"],
        supplierIds: ["SUP_SAFE"],
        updatedAt: freshAt,
      },
      {
        productId: "P_BAD",
        sku: "SKU-BAD",
        productName: "Refund-heavy set",
        netProfitVnd: -450000,
        adAttributedNetProfitAfterAdsVnd: -350000,
        marginPercent: -5,
        returnCancelRefundRatePercent: 40,
        stockAvailable: 50,
        daysOfCover: 12,
        mediaReady: true,
        landingReady: true,
        offerReady: true,
        mappedAdGroupIds: ["2002"],
        supplierIds: ["SUP_WEAK_1", "SUP_WEAK_2"],
        updatedAt: freshAt,
      },
    ],
    suppliers: [
      {
        productId: "P_SCALE",
        supplierId: "SUP_SAFE",
        supplierName: "Safe Supplier",
        quoteApproved: true,
        currentQuoteVnd: 180000,
        priorQuoteVnd: 185000,
        marginAfterCostPercent: 42,
        leadTimeDays: 4,
        lateDeliveryRatePercent: 3,
        paymentFreshnessDays: 5,
        capacityStatus: "available",
        returnFaultRatePercent: 2,
        updatedAt: freshAt,
      },
      {
        productId: "P_BAD",
        supplierId: "SUP_WEAK_1",
        supplierName: "Weak Supplier 1",
        quoteApproved: true,
        currentQuoteVnd: 260000,
        priorQuoteVnd: 230000,
        marginAfterCostPercent: 8,
        leadTimeDays: 14,
        lateDeliveryRatePercent: 20,
        paymentFreshnessDays: 45,
        capacityStatus: "constrained",
        returnFaultRatePercent: 14,
        updatedAt: freshAt,
      },
      {
        productId: "P_BAD",
        supplierId: "SUP_WEAK_2",
        supplierName: "Weak Supplier 2",
        quoteApproved: false,
        currentQuoteVnd: 280000,
        priorQuoteVnd: 250000,
        marginAfterCostPercent: -2,
        leadTimeDays: 16,
        lateDeliveryRatePercent: 22,
        paymentFreshnessDays: 60,
        capacityStatus: "blocked",
        returnFaultRatePercent: 18,
        updatedAt: freshAt,
      },
    ],
  };
}

function erpRows(): AdsAutomationDecisionErpSourceAdapterInput {
  const freshAt = "2026-07-04T04:00:00.000Z";
  const orderDate = "2026-07-03T08:00:00.000Z";
  return {
    snapshotDate: "2026-07-04",
    evidenceWindow: { from: "2026-06-21", to: "2026-07-04", days: 14 },
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
    adGroups: [
      {
        platform: "google",
        customerId: "customer-demo",
        campaignId: "campaign-scale",
        campaignName: "Search scale fixture",
        adGroupId: "adg-scale",
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
      },
    ],
    advertisingCosts: [
      {
        channel: "google",
        customerId: "customer-demo",
        adGroupId: "adg-scale",
        date: "2026-07-03",
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
      orderDate,
      orderStatus: "completed",
      depositAmount: 100000,
      codAmount: 400000,
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
        effectiveAt: freshAt,
        updatedAt: freshAt,
      },
    ],
    supplierPayables: [
      {
        supplierId: "supplier-safe",
        supplierNameSnap: "Safe ERP Supplier",
        status: "paid",
        payments: [{ paidAt: "2026-06-30T02:00:00.000Z", amount: 1200000 }],
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
  };
}

function cloneErpRows(): AdsAutomationDecisionErpSourceAdapterInput {
  return JSON.parse(JSON.stringify(erpRows()));
}

describe("AdsAutomationDecisionSourceAdapterService", () => {
  const adapter = new AdsAutomationDecisionSourceAdapterService();
  const decisionService = new AdsAutomationDecisionService();
  const options = { now: "2026-07-04T05:00:00.000Z" };

  it("maps complete mocked ERP rows into all seven decision categories through the decision service", () => {
    const result = adapter.build(completeRows(), options);
    const snapshot = decisionService.build(result.snapshotInput);

    expect(result.safety).toEqual({
      read_only: true,
      db_connection_used: false,
      provider_api_used: false,
      google_ads_api_used: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
    });
    expect(
      result.sourceEvidence.every((evidence) => evidence.status === "fresh"),
    ).toBe(true);
    expect(Object.keys(snapshot.categories).sort()).toEqual([
      "campaign_or_ad_group_pause",
      "product_budget_allocation",
      "product_kill_or_stop_review",
      "scale_ads",
      "scale_amount",
      "supplier_gate",
      "target_ad_groups",
    ]);

    expect(findDecision(snapshot, "scale_ads", "2001").status).toBe(
      "scale_ready",
    );
    expect(
      findDecision(snapshot, "scale_amount", "2001").proposedValue,
    ).toEqual(
      expect.objectContaining({
        action: "update_campaign_budget_draft",
        campaignBudgetId: "3001",
        proposedBudgetVnd: 1200000,
      }),
    );
    expect(
      findDecision(snapshot, "scale_ads", "2001").evidence_metrics,
    ).toEqual(
      expect.objectContaining({
        clicks: 120,
        impressions: 5000,
        conversions: 12,
        conversionValueVnd: 4000000,
      }),
    );
    expect(
      findDecision(snapshot, "campaign_or_ad_group_pause", "2002")
        .evidence_metrics,
    ).toEqual(
      expect.objectContaining({
        clicks: 88,
        impressions: 4100,
        conversions: 0,
        conversionValueVnd: 0,
      }),
    );
    expect(findDecision(snapshot, "target_ad_groups", "2001").status).toBe(
      "scale_ready",
    );
    expect(
      findDecision(snapshot, "product_budget_allocation", "P_SCALE").status,
    ).toBe("scale_ready");
    expect(findDecision(snapshot, "supplier_gate", "SUP_SAFE").status).toBe(
      "safe",
    );
    expect(
      findDecision(snapshot, "product_kill_or_stop_review", "P_BAD")
        .proposedValue,
    ).toEqual(
      expect.objectContaining({
        action: "stop_ads_review",
      }),
    );
    expect(
      findDecision(snapshot, "campaign_or_ad_group_pause", "2002").status,
    ).toBe("needs_review");
  });

  it("blocks scale amount when campaign budget ID is missing and never falls back to campaign or ad group ID", () => {
    const rows = completeRows();
    rows.adGroups = [
      {
        ...rows.adGroups![0],
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: undefined,
        campaignBudgetResourceName: undefined,
      },
    ];
    rows.products = [rows.products![0]];
    rows.suppliers = [rows.suppliers![0]];

    const result = adapter.build(rows, options);
    const mappedGroup = result.snapshotInput.adGroups![0];
    const snapshot = decisionService.build(result.snapshotInput);
    const budgetEvidence = result.sourceEvidence.find(
      (evidence) => evidence.sourceKey === "campaign_budgets",
    );

    expect(mappedGroup.campaignBudgetId).toBeUndefined();
    expect(mappedGroup.campaignBudgetResourceName).toBeUndefined();
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.campaignId);
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.adGroupId);
    expect(budgetEvidence?.missingFields).toContain(
      "campaignBudgetId_or_campaignBudgetResourceName",
    );
    expect(budgetEvidence?.affectedEntityIds).toContain("2001");
    expect(findDecision(snapshot, "scale_ads", "2001").status).toBe(
      "insufficient_data",
    );
    expect(
      snapshot.decisions.some(
        (item) =>
          item.decision_type === "scale_amount" && item.entity_id === "2001",
      ),
    ).toBe(false);
  });

  it("emits insufficient-data evidence when supplier and product mappings are missing", () => {
    const rows = completeRows();
    rows.products = [
      {
        ...rows.products![0],
        mappedAdGroupIds: [],
        supplierIds: [],
      },
    ];
    rows.suppliers = [];
    rows.adGroups = [
      {
        ...rows.adGroups![0],
        internalProductIds: ["P_SCALE"],
      },
    ];

    const result = adapter.build(rows, options);
    const snapshot = decisionService.build(result.snapshotInput);
    const productEvidence = result.missingFieldEvidence.find(
      (item) =>
        item.sourceKey === "product_performance" && item.entityId === "P_SCALE",
    );
    const supplierSource = result.sourceEvidence.find(
      (item) => item.sourceKey === "supplier_safety",
    );

    expect(productEvidence?.missingFields).toEqual(
      expect.arrayContaining(["mappedAdGroupIds", "supplierIds"]),
    );
    expect(supplierSource?.status).toBe("missing");
    expect(supplierSource?.canUseForDecision).toBe("no");
    expect(
      findDecision(snapshot, "product_budget_allocation", "P_SCALE").status,
    ).toBe("insufficient_data");
    expect(snapshot.categories.supplier_gate.status).toBe("insufficient_data");
  });

  it("reflects stale and fresh source watermarks in adapter evidence", () => {
    const rows = completeRows();
    rows.products = rows.products!.map((product) => ({
      ...product,
      updatedAt: "2026-06-30T00:00:00.000Z",
    }));

    const result = adapter.build(rows, {
      now: "2026-07-04T05:00:00.000Z",
      maxAgeHours: {
        product_performance: 24,
      },
    });
    const adsEvidence = result.sourceEvidence.find(
      (item) => item.sourceKey === "ads_performance",
    );
    const productEvidence = result.sourceEvidence.find(
      (item) => item.sourceKey === "product_performance",
    );

    expect(adsEvidence).toEqual(
      expect.objectContaining({
        status: "fresh",
        canUseForDecision: "yes",
        latestObservedAt: "2026-07-04T04:00:00.000Z",
      }),
    );
    expect(productEvidence).toEqual(
      expect.objectContaining({
        status: "stale",
        canUseForDecision: "cautious",
        latestObservedAt: "2026-06-30T00:00:00.000Z",
        maxAgeHours: 24,
      }),
    );
    expect(productEvidence?.ageHours).toBeGreaterThan(24);
  });

  it("maps ERP-shaped ad group, product, order, platform spend, inventory, supplier, and cashflow records into a scale-ready decision chain", () => {
    const result = adapter.buildFromErpRecords(cloneErpRows(), options);
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
    expect(
      result.sourceEvidence.every((evidence) => evidence.status === "fresh"),
    ).toBe(true);
    expect(result.mappingEvidence.spendReconciliation).toContainEqual(
      expect.objectContaining({
        adGroupId: "adg-scale",
        platformSpendVnd: 300000,
        orderAdvertisingCostVnd: 300000,
        sourceOfTruth: "platform_spend",
        status: "matched",
        blockers: [],
      }),
    );

    const scaleDecision = findDecision(snapshot, "scale_ads", "adg-scale");
    expect(scaleDecision.status).toBe("scale_ready");
    expect(scaleDecision.evidence_metrics).toEqual(
      expect.objectContaining({
        spendVnd: 300000,
        platformSpendSourceOfTruth: "platform_spend",
        orderAdvertisingCostVnd: 300000,
        spendReconciliationStatus: "matched",
        orders: 6,
        netProfitAfterAdsVnd: 780000,
      }),
    );
    expect(
      findDecision(snapshot, "scale_amount", "adg-scale").proposedValue,
    ).toEqual(
      expect.objectContaining({
        action: "update_campaign_budget_draft",
        campaignBudgetId: "budget-scale",
      }),
    );
    expect(
      findDecision(snapshot, "product_budget_allocation", "product-scale")
        .status,
    ).toBe("scale_ready");
    expect(
      findDecision(snapshot, "supplier_gate", "supplier-safe").status,
    ).toBe("safe");
  });

  it("attributes multi-product ERP orders to each mapped product while reconciling ad group spend from platform rows", () => {
    const rows = cloneErpRows();
    rows.adGroups![0].selectedProducts = ["product-scale", "product-add-on"];
    rows.advertisingCosts![0].spentAmount = 375000;
    rows.orders!.push({
      _id: "order-multi-product",
      supplierId: "supplier-safe",
      adGroupId: "adg-scale",
      orderDate: "2026-07-03T08:00:00.000Z",
      orderStatus: "completed",
      revenueVnd: 800000,
      advertisingCost: 75000,
      isActive: true,
      items: [
        {
          productId: "product-scale",
          quantity: 1,
          revenueVnd: 500000,
          grossProfitVnd: 250000,
          netProfitVnd: 200000,
        },
        {
          productId: "product-add-on",
          quantity: 2,
          revenueVnd: 300000,
          grossProfitVnd: 130000,
          netProfitVnd: 100000,
        },
      ],
      updatedAt: "2026-07-04T04:00:00.000Z",
      createdAt: "2026-07-03T08:00:00.000Z",
    });
    rows.products!.push({
      _id: "product-add-on",
      sku: "ERP-ADDON",
      name: "ERP add-on product",
      importPrice: 90000,
      shippingCost: 10000,
      packagingCost: 5000,
      totalCost: 105000,
      estimatedDeliveryDays: 4,
      status: "Hoat dong",
      assumedReturnRatePercent: 5,
      images: [{ url: "/local-demo/add-on.jpg" }],
      fanpageVariations: [{ customPrice: 150000, isActive: true }],
      suppliers: [
        {
          supplierId: "supplier-safe",
          price1: 105000,
          appliedPrice: 105000,
          appliedAt: "2026-07-04T04:00:00.000Z",
          isDefault: true,
        },
      ],
      updatedAt: "2026-07-04T04:00:00.000Z",
    });
    rows.inventorySummaries!.push({
      productId: "product-add-on",
      onHand: 80,
      avgCost: 105000,
      updatedAt: "2026-07-04T04:00:00.000Z",
    });
    rows.supplierQuotes!.push({
      productId: "product-add-on",
      supplierId: "supplier-safe",
      supplierName: "Safe ERP Supplier",
      price: 105000,
      effectiveAt: "2026-07-04T04:00:00.000Z",
      updatedAt: "2026-07-04T04:00:00.000Z",
    });

    const result = adapter.buildFromErpRecords(rows, options);
    const attribution = result.mappingEvidence.orderAttribution.find(
      (item) => item.orderId === "order-multi-product",
    );
    const scaleProductMapping = result.mappingEvidence.productMappings.find(
      (item) => item.productId === "product-scale",
    );
    const addOnProductMapping = result.mappingEvidence.productMappings.find(
      (item) => item.productId === "product-add-on",
    );

    expect(attribution).toEqual(
      expect.objectContaining({
        adGroupId: "adg-scale",
        productIds: expect.arrayContaining(["product-scale", "product-add-on"]),
        includedInProfit: true,
        includedInReportWindow: true,
        revenueVnd: 800000,
        grossProfitVnd: 380000,
        advertisingCostVnd: 75000,
        blockers: [],
      }),
    );
    expect(attribution?.productIds).toHaveLength(2);
    expect(scaleProductMapping).toEqual(
      expect.objectContaining({
        mappedAdGroupIds: ["adg-scale"],
        orderIds: expect.arrayContaining(["order-multi-product"]),
        supplierIds: ["supplier-safe"],
        blockers: [],
      }),
    );
    expect(addOnProductMapping).toEqual(
      expect.objectContaining({
        mappedAdGroupIds: ["adg-scale"],
        orderIds: ["order-multi-product"],
        supplierIds: ["supplier-safe"],
        blockers: [],
      }),
    );
    expect(result.mappingEvidence.spendReconciliation).toContainEqual(
      expect.objectContaining({
        adGroupId: "adg-scale",
        platformSpendVnd: 375000,
        orderAdvertisingCostVnd: 375000,
        sourceOfTruth: "platform_spend",
        status: "matched",
        blockers: [],
      }),
    );
    expect(result.snapshotInput.adGroups![0]).toEqual(
      expect.objectContaining({
        productIds: expect.arrayContaining(["product-scale", "product-add-on"]),
        orders: 7,
        spendVnd: 375000,
        orderAdvertisingCostVnd: 375000,
        grossProfitVnd: 1460000,
        netProfitAfterAdsVnd: 1085000,
        spendReconciliationStatus: "matched",
      }),
    );
    expect(result.snapshotInput.adGroups![0].productIds).toHaveLength(2);
  });

  it("blocks ERP scale amount when campaignBudgetId is missing and does not fall back to campaignId or adGroupId", () => {
    const rows = cloneErpRows();
    rows.adGroups![0].campaignBudgetId = undefined;
    rows.adGroups![0].campaignBudgetResourceName = undefined;

    const result = adapter.buildFromErpRecords(rows, options);
    const snapshot = decisionService.build(result.snapshotInput);
    const mappedGroup = result.snapshotInput.adGroups![0];
    const budgetEvidence = result.sourceEvidence.find(
      (evidence) => evidence.sourceKey === "campaign_budgets",
    );

    expect(mappedGroup.campaignBudgetId).toBeUndefined();
    expect(mappedGroup.campaignBudgetResourceName).toBeUndefined();
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.campaignId);
    expect(mappedGroup.campaignBudgetId).not.toBe(mappedGroup.adGroupId);
    expect(budgetEvidence?.missingFields).toContain(
      "campaignBudgetId_or_campaignBudgetResourceName",
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

  it("marks unmapped ERP ad group/product and missing order adGroupId attribution as visible blockers", () => {
    const rows = cloneErpRows();
    rows.adGroups![0].selectedProducts = [];
    rows.orders!.push({
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
      updatedAt: "2026-07-04T04:00:00.000Z",
    });

    const result = adapter.buildFromErpRecords(rows, options);
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

  it("blocks scale when ERP orders are returned, refunded, or cancelled and preserves pause review evidence", () => {
    const rows = cloneErpRows();
    rows.orders = rows.orders!.map((order, index) => ({
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

    const result = adapter.buildFromErpRecords(rows, options);
    const snapshot = decisionService.build(result.snapshotInput);
    const scaleDecision = findDecision(snapshot, "scale_ads", "adg-scale");
    const pauseDecision = findDecision(
      snapshot,
      "campaign_or_ad_group_pause",
      "adg-scale",
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
    expect(pauseDecision.status).toBe("needs_review");
    expect(pauseDecision.proposedValue).toEqual(
      expect.objectContaining({ action: "pause_ad_group_draft" }),
    );
  });

  it("uses platform spend as source of truth and downgrades when order advertisingCost conflicts with platform spend", () => {
    const rows = cloneErpRows();
    rows.orders = rows.orders!.map((order) => ({
      ...order,
      advertisingCost: 10000,
    }));

    const result = adapter.buildFromErpRecords(rows, options);
    const snapshot = decisionService.build(result.snapshotInput);
    const scaleDecision = findDecision(snapshot, "scale_ads", "adg-scale");

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
    expect(result.snapshotInput.adGroups![0]).toEqual(
      expect.objectContaining({
        spendVnd: 300000,
        orderAdvertisingCostVnd: 60000,
        spendReconciliationStatus: "mismatch",
      }),
    );
    expect(scaleDecision.status).toBe("blocked");
    expect(scaleDecision.blockers).toContain(
      "platform_spend_order_ad_cost_mismatch",
    );
    expect(scaleDecision.proposedValue).toEqual(
      expect.objectContaining({ action: "monitor_only" }),
    );
  });

  it("downgrades growth to monitor_only when stock, supplier, and cashflow evidence are unsafe", () => {
    const rows = cloneErpRows();
    rows.inventorySummaries![0].onHand = 2;
    rows.supplierQuotes![0] = {
      ...rows.supplierQuotes![0],
      status: "pending",
      leadTimeDays: 20,
      lateDeliveryRatePercent: 35,
      returnFaultRatePercent: 20,
      capacityStatus: "blocked",
    };
    rows.availableFundSnapshots![0].available = 0;
    rows.cashflowSummarySnapshots![0].data = {
      ...rows.cashflowSummarySnapshots![0].data,
      freeCash: 2500000,
      survivalFloor: 3000000,
      availableAfterSurvival: 0,
      adsBudgetApproved: 0,
      daily_loss_limit_safe: false,
      monthly_loss_limit_safe: false,
    };

    const result = adapter.buildFromErpRecords(rows, options);
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
});
