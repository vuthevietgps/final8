import { Injectable } from "@nestjs/common";
import {
  AdsAutomationAdGroupInput,
  AdsAutomationDecisionSnapshotInput,
  AdsAutomationEvidenceWindow,
  AdsAutomationProductInput,
  AdsAutomationSupplierInput,
} from "./contracts/ads-automation-decision.contract";
import {
  AdsAutomationAdGroupReadRow,
  AdsAutomationCashflowPolicyReadRow,
  AdsAutomationDecisionErpSourceAdapterInput,
  AdsAutomationDecisionMissingFieldEvidence,
  AdsAutomationDecisionSourceAdapterInput,
  AdsAutomationDecisionSourceAdapterOptions,
  AdsAutomationDecisionSourceAdapterResult,
  AdsAutomationDecisionSourceEntityType,
  AdsAutomationDecisionSourceEvidence,
  AdsAutomationDecisionSourceFreshnessStatus,
  AdsAutomationDecisionSourceKey,
  AdsAutomationDecisionSourceMappingEvidence,
  AdsAutomationDecisionSpendReconciliationEvidence,
  AdsAutomationErpAdGroupRecord,
  AdsAutomationErpAdvertisingCostRecord,
  AdsAutomationErpCashflowSummarySnapshotRecord,
  AdsAutomationErpOrderRecord,
  AdsAutomationErpProductRecord,
  AdsAutomationErpSupplierPayableRecord,
  AdsAutomationErpSupplierQuoteRecord,
  AdsAutomationProductReadRow,
  AdsAutomationSourceStampedRow,
  AdsAutomationSupplierReadRow,
} from "./contracts/ads-automation-decision-source-adapter.contract";

const SOURCE_LABELS: Record<AdsAutomationDecisionSourceKey, string> = {
  ads_performance: "Ad group performance read rows",
  campaign_budgets: "Verified campaign budget read rows",
  product_performance: "Product performance and allocation rows",
  supplier_safety: "Supplier quote, fulfillment, and payment rows",
  pause_review: "Campaign/ad group pause review rows",
  cashflow_policy: "Cashflow and policy gate rows",
};

const DEFAULT_MAX_AGE_HOURS: Record<AdsAutomationDecisionSourceKey, number> = {
  ads_performance: 24,
  campaign_budgets: 24,
  product_performance: 48,
  supplier_safety: 72,
  pause_review: 72,
  cashflow_policy: 24,
};

const SAFETY = {
  read_only: true,
  db_connection_used: false,
  provider_api_used: false,
  google_ads_api_used: false,
  live_ads_execution_used: false,
  erp_mutation_used: false,
  payment_mutation_used: false,
  production_ready: false,
} as const;

type ErpRecord = any;

interface ErpEvidenceWindow {
  from: string;
  to: string;
  days: number;
  fromDate: Date;
  toDate: Date;
}

interface ErpOrderAllocation {
  productId: string;
  quantity: number;
  revenueVnd: number;
  grossProfitVnd: number;
  netProfitVnd: number;
}

interface ErpOrderRollup {
  order: AdsAutomationErpOrderRecord;
  orderId: string;
  orderDate: string | null;
  inWindow: boolean;
  adGroupId: string | undefined;
  productIds: string[];
  allocations: ErpOrderAllocation[];
  quantity: number;
  revenueVnd: number;
  grossProfitVnd: number;
  netProfitVnd: number;
  advertisingCostVnd: number;
  returnedOrCancelled: boolean;
  includedInProfit: boolean;
  blockers: string[];
}

@Injectable()
export class AdsAutomationDecisionSourceAdapterService {
  build(
    input: AdsAutomationDecisionSourceAdapterInput = {},
    options: AdsAutomationDecisionSourceAdapterOptions = {},
  ): AdsAutomationDecisionSourceAdapterResult {
    const snapshotDate =
      this.validDate(options.snapshotDate || input.snapshotDate) ||
      new Date().toISOString().slice(0, 10);
    const evidenceWindow =
      options.evidenceWindow ||
      input.evidenceWindow ||
      this.defaultEvidenceWindow(snapshotDate);
    const now = this.dateOrNow(options.now);
    const missingFieldEvidence = this.buildMissingFieldEvidence(input);
    const sourceEvidence = this.buildSourceEvidence(
      input,
      missingFieldEvidence,
      now,
      options,
    );
    const evidenceByKey = new Map(
      sourceEvidence.map((evidence) => [evidence.sourceKey, evidence]),
    );

    const snapshotInput: AdsAutomationDecisionSnapshotInput = {
      snapshotDate,
      evidenceWindow,
      policy: this.mapPolicy(
        input.policy,
        evidenceByKey.get("cashflow_policy"),
      ),
      adGroups: (input.adGroups || []).map((row) =>
        this.mapAdGroup(row, evidenceWindow, evidenceByKey),
      ),
      products: (input.products || []).map((row) =>
        this.mapProduct(row, evidenceByKey.get("product_performance")),
      ),
      suppliers: (input.suppliers || []).map((row) =>
        this.mapSupplier(row, evidenceByKey.get("supplier_safety")),
      ),
    };

    return {
      snapshotInput,
      sourceEvidence,
      missingFieldEvidence,
      mappingEvidence: this.emptyMappingEvidence(),
      safety: SAFETY,
    };
  }

  buildFromErpRecords(
    input: AdsAutomationDecisionErpSourceAdapterInput = {},
    options: AdsAutomationDecisionSourceAdapterOptions = {},
  ): AdsAutomationDecisionSourceAdapterResult {
    const snapshotDate =
      this.validDate(options.snapshotDate || input.snapshotDate) ||
      new Date().toISOString().slice(0, 10);
    const evidenceWindow =
      options.evidenceWindow ||
      input.evidenceWindow ||
      this.defaultEvidenceWindow(snapshotDate);
    const window = this.erpWindow(evidenceWindow);
    const orderRollups = (input.orders || []).map((order) =>
      this.erpOrderRollup(order, window),
    );
    const productRows = this.mapErpProductRows(input, window, orderRollups);
    const supplierRows = this.mapErpSupplierRows(input, window, orderRollups);
    const adGroupRows = this.mapErpAdGroupRows(
      input,
      window,
      orderRollups,
      productRows,
    );
    const policy = this.mapErpCashflowPolicy(input);
    const mappingEvidence = this.erpMappingEvidence(
      adGroupRows,
      productRows,
      orderRollups,
    );

    const result = this.build(
      {
        snapshotDate,
        evidenceWindow,
        policy,
        adGroups: adGroupRows,
        products: productRows,
        suppliers: supplierRows,
        sourceWatermarks: input.sourceWatermarks,
      },
      options,
    );

    return {
      ...result,
      mappingEvidence,
    };
  }

  private mapErpAdGroupRows(
    input: AdsAutomationDecisionErpSourceAdapterInput,
    window: ErpEvidenceWindow,
    orderRollups: ErpOrderRollup[],
    productRows: AdsAutomationProductReadRow[],
  ): AdsAutomationAdGroupReadRow[] {
    const costsByAdGroup = this.groupBy(
      input.advertisingCosts || [],
      (row) => this.stringOrUndefined(row.adGroupId) || "unknown",
    );
    const ordersByAdGroup = this.groupBy(
      orderRollups,
      (row) => row.adGroupId || "unknown",
    );
    const productsByAdGroup = this.productIdsByAdGroup(
      input.adGroups || [],
      productRows,
    );

    return (input.adGroups || []).map((adGroup) => {
      const adGroupId =
        this.stringOrUndefined(adGroup.adGroupId) || this.entityId(adGroup._id);
      const platformRows = (costsByAdGroup.get(adGroupId) || []).filter((row) =>
        this.dateInWindow(
          row.date || row.lastSyncAt || row.updatedAt || row.createdAt,
          window,
        ),
      );
      const attributedOrders = (ordersByAdGroup.get(adGroupId) || []).filter(
        (row) => row.inWindow,
      );
      const includedOrders = attributedOrders.filter(
        (row) => row.includedInProfit,
      );
      const excludedOrders = attributedOrders.filter(
        (row) => !row.includedInProfit,
      );
      const productIds = this.unique([
        ...this.stringArray(adGroup.productIds),
        ...this.stringArray(adGroup.internalProductIds),
        ...this.stringArray(adGroup.selectedProducts),
        ...(productsByAdGroup.get(adGroupId) || []),
        ...includedOrders.flatMap((row) => row.productIds),
      ]);
      const platformSpendVnd = this.sum(platformRows, (row) =>
        this.firstNumber(row.spendVnd, row.costVnd, row.spentAmount),
      );
      const orderAdvertisingCostVnd = this.sum(
        attributedOrders,
        (row) => row.advertisingCostVnd,
      );
      const spendStatus = this.spendReconciliationStatus(
        platformRows.length,
        attributedOrders.length,
        platformSpendVnd,
        orderAdvertisingCostVnd,
      );
      const spendMismatchVnd = platformRows.length
        ? this.round(platformSpendVnd - orderAdvertisingCostVnd, 2)
        : undefined;
      const revenueVnd = this.sum(includedOrders, (row) => row.revenueVnd);
      const grossProfitVnd = this.sum(
        includedOrders,
        (row) => row.grossProfitVnd,
      );
      const returnRatePercent = attributedOrders.length
        ? this.round((excludedOrders.length / attributedOrders.length) * 100, 2)
        : undefined;

      return {
        platform:
          this.stringOrUndefined(adGroup.platform) ||
          this.firstText(
            platformRows.map((row) => row.channel || row.platform),
          ),
        accountId: this.stringOrUndefined(
          adGroup.accountId || adGroup.customerId || adGroup.adAccountId,
        ),
        customerId: this.stringOrUndefined(
          adGroup.customerId || adGroup.accountId,
        ),
        campaignId: this.stringOrUndefined(adGroup.campaignId),
        campaignName: this.stringOrUndefined(adGroup.campaignName),
        adGroupId,
        adGroupName: this.stringOrUndefined(
          adGroup.adGroupName || adGroup.name,
        ),
        resourceName: this.stringOrUndefined(adGroup.resourceName),
        campaignBudgetId: this.stringOrUndefined(adGroup.campaignBudgetId),
        campaignBudgetResourceName: this.stringOrUndefined(
          adGroup.campaignBudgetResourceName,
        ),
        currentStatus:
          this.stringOrUndefined(
            adGroup.effectiveStatus || adGroup.remoteStatus || adGroup.status,
          ) || (adGroup.isActive === false ? "PAUSED" : "ENABLED"),
        currentBudgetVnd: this.numberOrUndefined(
          adGroup.currentBudgetVnd ?? adGroup.dailyBudget,
        ),
        spendVnd: platformRows.length ? platformSpendVnd : undefined,
        clicks: this.sum(platformRows, (row) =>
          this.numberOrUndefined(row.clicks),
        ),
        impressions: this.sum(platformRows, (row) =>
          this.numberOrUndefined(row.impressions),
        ),
        conversions: this.sum(platformRows, (row) =>
          this.numberOrUndefined(row.conversions),
        ),
        allConversions: this.sum(platformRows, (row) =>
          this.numberOrUndefined(row.allConversions),
        ),
        conversionValueVnd: this.sum(platformRows, (row) =>
          this.firstNumber(row.conversionValueVnd, row.conversionValue),
        ),
        orders: includedOrders.length,
        revenueVnd,
        grossProfitVnd,
        netProfitAfterAdsVnd: platformRows.length
          ? this.round(grossProfitVnd - platformSpendVnd, 2)
          : undefined,
        orderAdvertisingCostVnd,
        spendSourceOfTruth: "platform_spend",
        spendReconciliationStatus: spendStatus,
        spendMismatchVnd,
        spendMismatchPercent:
          platformSpendVnd > 0 && spendMismatchVnd !== undefined
            ? this.round(
                (Math.abs(spendMismatchVnd) / platformSpendVnd) * 100,
                2,
              )
            : undefined,
        attributedOrderIds: includedOrders.map((row) => row.orderId),
        excludedOrderIds: excludedOrders.map((row) => row.orderId),
        cancelledReturnedRefundedOrders: excludedOrders.length,
        returnRatePercent,
        dataQualityScore: this.erpAdGroupDataQuality({
          hasPlatformSpend: platformRows.length > 0,
          hasBudget: Boolean(
            adGroup.campaignBudgetId || adGroup.campaignBudgetResourceName,
          ),
          hasProductMapping: productIds.length > 0,
          hasOrders: attributedOrders.length > 0,
          spendStatus,
        }),
        labels: this.erpAdGroupLabels(adGroup),
        productIds,
        internalProductIds: productIds,
        bottlenecksChecked: adGroup.bottlenecksChecked === true,
        lastSyncAt: this.latestDate([
          adGroup,
          ...platformRows,
          ...attributedOrders.map((row) => row.order),
        ]),
        updatedAt: this.latestDate(
          [
            adGroup,
            ...platformRows,
            ...attributedOrders.map((row) => row.order),
          ],
          ["updatedAt"],
        ),
        createdAt: this.latestDate(
          [
            adGroup,
            ...platformRows,
            ...attributedOrders.map((row) => row.order),
          ],
          ["createdAt"],
        ),
      };
    });
  }

  private mapErpProductRows(
    input: AdsAutomationDecisionErpSourceAdapterInput,
    window: ErpEvidenceWindow,
    orderRollups: ErpOrderRollup[],
  ): AdsAutomationProductReadRow[] {
    const inventoryByProduct = this.indexBy(
      input.inventorySummaries || [],
      (row) => this.entityId(row.productId),
    );
    const supplierIdsByProduct = this.supplierIdsByProduct(
      input.products || [],
      input.supplierQuotes || [],
    );
    const mappedAdGroupsByProduct = this.mappedAdGroupsByProduct(
      input.adGroups || [],
    );

    return (input.products || []).map((product) => {
      const productId = this.entityId(product._id || product.productId);
      const productOrderRollups = orderRollups.filter(
        (row) => row.inWindow && row.productIds.includes(productId),
      );
      const includedOrderRollups = productOrderRollups.filter(
        (row) => row.includedInProfit,
      );
      const productAllocations = includedOrderRollups.flatMap((row) =>
        row.allocations.filter((item) => item.productId === productId),
      );
      const allAllocations = productOrderRollups.flatMap((row) =>
        row.allocations.filter((item) => item.productId === productId),
      );
      const revenueVnd = this.sum(
        productAllocations,
        (item) => item.revenueVnd,
      );
      const grossProfitVnd = this.sum(
        productAllocations,
        (item) => item.grossProfitVnd,
      );
      const platformSpendVnd = this.platformSpendForProduct(
        productId,
        input,
        window,
      );
      const netProfitVnd = this.round(grossProfitVnd - platformSpendVnd, 2);
      const inventory = inventoryByProduct.get(productId);
      const stockAvailable = this.numberOrUndefined(inventory?.onHand) ?? 0;
      const reservedQuantity = this.reservedQuantity(productOrderRollups);
      const availableQuantity = Math.max(0, stockAvailable - reservedQuantity);
      const soldQuantity = this.sum(
        productAllocations,
        (item) => item.quantity,
      );
      const returnedOrCancelled = productOrderRollups.filter(
        (row) => row.returnedOrCancelled,
      ).length;
      const returnRatePercent = productOrderRollups.length
        ? this.round(
            (returnedOrCancelled / productOrderRollups.length) * 100,
            2,
          )
        : this.numberOrUndefined(product.assumedReturnRatePercent);

      return {
        productId,
        sku: this.stringOrUndefined(product.sku),
        name: this.stringOrUndefined(product.name || product.productName),
        netProfitVnd,
        adAttributedNetProfitAfterAdsVnd: netProfitVnd,
        marginPercent: this.marginPercent(netProfitVnd, revenueVnd, product),
        returnCancelRefundRatePercent: returnRatePercent,
        stockAvailable,
        reservedQuantity,
        incomingQuantity: 0,
        daysOfCover: this.daysOfCover(
          availableQuantity,
          this.sum(allAllocations, (item) => item.quantity),
          window.days,
        ),
        mediaReady: Array.isArray(product.images) && product.images.length > 0,
        landingReady: this.activeProduct(product),
        offerReady: this.activeProduct(product),
        mappedAdGroupIds: mappedAdGroupsByProduct.get(productId) || [],
        supplierIds: supplierIdsByProduct.get(productId) || [],
        lastSyncAt: this.latestDate([
          product,
          inventory,
          ...productOrderRollups.map((row) => row.order),
        ]),
        updatedAt: this.latestDate(
          [product, inventory, ...productOrderRollups.map((row) => row.order)],
          ["updatedAt"],
        ),
        createdAt: this.latestDate(
          [product, inventory, ...productOrderRollups.map((row) => row.order)],
          ["createdAt"],
        ),
      };
    });
  }

  private mapErpSupplierRows(
    input: AdsAutomationDecisionErpSourceAdapterInput,
    window: ErpEvidenceWindow,
    orderRollups: ErpOrderRollup[],
  ): AdsAutomationSupplierReadRow[] {
    const productsById = this.indexBy(input.products || [], (row) =>
      this.entityId(row._id || row.productId),
    );
    const suppliersById = this.indexBy(input.suppliers || [], (row) =>
      this.entityId(row._id || row.id || row.supplierId),
    );
    const inventoryByProduct = this.indexBy(
      input.inventorySummaries || [],
      (row) => this.entityId(row.productId),
    );
    const quotesByPair = this.groupBy(input.supplierQuotes || [], (row) =>
      this.pairKey(row.productId, row.supplierId),
    );
    const payablesBySupplier = this.groupBy(
      input.supplierPayables || [],
      (row) => this.entityId(row.supplierId),
    );
    const pairs = this.supplierProductPairs(
      input.products || [],
      input.supplierQuotes || [],
      orderRollups,
    );

    return pairs.map((pair) => {
      const product = productsById.get(pair.productId);
      const quotes = [
        ...(quotesByPair.get(this.key(pair.productId, pair.supplierId)) || []),
      ].sort(
        (left, right) =>
          this.timestamp(right.effectiveAt || right.createdAt) -
          this.timestamp(left.effectiveAt || left.createdAt),
      );
      const currentQuote = quotes[0];
      const priorQuote = quotes[1];
      const pairOrders = orderRollups.filter(
        (row) =>
          row.inWindow &&
          row.productIds.includes(pair.productId) &&
          this.entityId(row.order.supplierId) === pair.supplierId,
      );
      const paymentRows = payablesBySupplier.get(pair.supplierId) || [];
      const currentQuoteVnd = this.firstNumber(
        currentQuote?.price,
        this.productSupplierPrice(product, pair.supplierId),
      );
      const quoteApproved = this.quoteApproved(
        currentQuote,
        product,
        pair.supplierId,
      );
      const stock =
        this.numberOrUndefined(
          inventoryByProduct.get(pair.productId)?.onHand,
        ) ?? 0;
      const lateDeliveryRatePercent =
        this.numberOrUndefined(currentQuote?.lateDeliveryRatePercent) ?? 0;
      const capacityStatus =
        this.stringOrUndefined(currentQuote?.capacityStatus) ||
        this.capacityStatus({ quoteApproved, stock, lateDeliveryRatePercent });
      return {
        productId: pair.productId,
        supplierId: pair.supplierId,
        supplierName: this.stringOrUndefined(
          pair.supplierName ||
            currentQuote?.supplierName ||
            suppliersById.get(pair.supplierId)?.fullName ||
            suppliersById.get(pair.supplierId)?.name ||
            suppliersById.get(pair.supplierId)?.email,
        ),
        quoteApproved,
        currentQuoteVnd,
        priorQuoteVnd: this.numberOrUndefined(priorQuote?.price),
        marginAfterCostPercent: this.supplierMarginPercent(
          product,
          currentQuoteVnd,
        ),
        leadTimeDays: this.firstNumber(
          currentQuote?.leadTimeDays,
          product?.estimatedDeliveryDays,
        ),
        lateDeliveryRatePercent,
        paymentFreshnessDays: this.paymentFreshnessDays(
          paymentRows,
          window.toDate,
        ),
        capacityStatus,
        returnFaultRatePercent:
          this.numberOrUndefined(currentQuote?.returnFaultRatePercent) ??
          this.returnFaultRatePercent(pairOrders),
        lastSyncAt: this.latestDate([
          product,
          currentQuote,
          priorQuote,
          ...paymentRows,
          ...pairOrders.map((row) => row.order),
        ]),
        updatedAt: this.latestDate(
          [product, currentQuote, ...paymentRows],
          ["updatedAt"],
        ),
        createdAt: this.latestDate(
          [product, currentQuote, ...paymentRows],
          ["createdAt"],
        ),
      };
    });
  }

  private mapErpCashflowPolicy(
    input: AdsAutomationDecisionErpSourceAdapterInput,
  ): AdsAutomationCashflowPolicyReadRow | undefined {
    if (input.cashflowPolicy) return input.cashflowPolicy;

    const latestFund = [...(input.availableFundSnapshots || [])].sort(
      (left, right) =>
        this.timestamp(right.capturedAt || right.updatedAt) -
        this.timestamp(left.capturedAt || left.updatedAt),
    )[0];
    const latestPolicySnapshot = [...(input.cashflowSummarySnapshots || [])]
      .filter((row) =>
        ["financial_control", "finance", "ads_policy"].includes(
          this.statusKey(row.domain),
        ),
      )
      .sort(
        (left, right) =>
          this.timestamp(right.updatedAt || right.createdAt) -
          this.timestamp(left.updatedAt || left.createdAt),
      )[0];
    const data = latestPolicySnapshot?.data || {};
    const freeCash = this.numberOrUndefined(data.freeCash);
    const survivalFloor = this.numberOrUndefined(data.survivalFloor);
    const availableAfterSurvival =
      this.numberOrUndefined(data.availableAfterSurvival) ??
      (freeCash !== undefined && survivalFloor !== undefined
        ? Math.max(0, freeCash - survivalFloor)
        : undefined);
    const adsBudgetApproved = this.numberOrUndefined(data.adsBudgetApproved);
    const availableAdsCashVnd = this.firstNumber(
      data.availableAdsCashVnd,
      availableAfterSurvival,
      adsBudgetApproved,
      latestFund?.available,
    );
    const cashflowGatePassed = this.erpCashflowGatePassed(data, {
      availableAdsCashVnd,
      availableAfterSurvival,
      adsBudgetApproved,
    });

    if (availableAdsCashVnd === undefined && !latestPolicySnapshot)
      return undefined;

    return {
      availableAdsCashVnd,
      cashflowGatePassed,
      maxBudgetIncreasePercent:
        this.numberOrUndefined(data.maxBudgetIncreasePercent) ?? 20,
      mediumConfidenceIncreasePercent:
        this.numberOrUndefined(data.mediumConfidenceIncreasePercent) ?? 10,
      minOrdersForScale: this.numberOrUndefined(data.minOrdersForScale) ?? 5,
      minDataQualityScore:
        this.numberOrUndefined(data.minDataQualityScore) ?? 0.75,
      minSpendForPauseVnd:
        this.numberOrUndefined(data.minSpendForPauseVnd) ?? 200000,
      maxReturnRatePercent:
        this.numberOrUndefined(data.maxReturnRatePercent) ?? 25,
      minMarginPercent: this.numberOrUndefined(data.minMarginPercent) ?? 20,
      minStockAvailable: this.numberOrUndefined(data.minStockAvailable) ?? 10,
      minDaysOfCover: this.numberOrUndefined(data.minDaysOfCover) ?? 7,
      maxSupplierLeadTimeDays:
        this.numberOrUndefined(data.maxSupplierLeadTimeDays) ?? 10,
      maxSupplierLateDeliveryRatePercent:
        this.numberOrUndefined(data.maxSupplierLateDeliveryRatePercent) ?? 15,
      maxSupplierReturnFaultRatePercent:
        this.numberOrUndefined(data.maxSupplierReturnFaultRatePercent) ?? 12,
      maxSupplierPaymentFreshnessDays:
        this.numberOrUndefined(data.maxSupplierPaymentFreshnessDays) ?? 30,
      lastSyncAt: this.latestDate([latestFund, latestPolicySnapshot]),
      updatedAt: this.latestDate(
        [latestFund, latestPolicySnapshot],
        ["updatedAt"],
      ),
      createdAt: this.latestDate(
        [latestFund, latestPolicySnapshot],
        ["createdAt"],
      ),
    };
  }

  private erpCashflowGatePassed(
    data: Record<string, unknown>,
    values: {
      availableAdsCashVnd?: number;
      availableAfterSurvival?: number;
      adsBudgetApproved?: number;
    },
  ): boolean {
    const explicitGate =
      this.booleanOrUndefined(data.cashflowGatePassed) ??
      this.booleanOrUndefined(data.cashflow_first_scale_all_safe);
    if (explicitGate !== undefined) return explicitGate;

    const dailyLossLimitSafe =
      this.booleanOrUndefined(data.daily_loss_limit_safe) ??
      this.booleanOrUndefined(data.dailyLossLimitSafe);
    const monthlyLossLimitSafe =
      this.booleanOrUndefined(data.monthly_loss_limit_safe) ??
      this.booleanOrUndefined(data.monthlyLossLimitSafe);
    if (dailyLossLimitSafe === false || monthlyLossLimitSafe === false)
      return false;
    if (values.adsBudgetApproved !== undefined)
      return values.adsBudgetApproved > 0;
    if (values.availableAfterSurvival !== undefined)
      return values.availableAfterSurvival > 0;
    return Number(values.availableAdsCashVnd || 0) > 0;
  }

  private erpMappingEvidence(
    adGroupRows: AdsAutomationAdGroupReadRow[],
    productRows: AdsAutomationProductReadRow[],
    orderRollups: ErpOrderRollup[],
  ): AdsAutomationDecisionSourceMappingEvidence {
    return {
      orderAttribution: orderRollups.map((row) => ({
        orderId: row.orderId,
        adGroupId: row.adGroupId || null,
        productIds: row.productIds,
        orderDate: row.orderDate,
        status: this.stringOrUndefined(row.order.orderStatus) || null,
        includedInProfit: row.includedInProfit,
        includedInReportWindow: row.inWindow,
        revenueVnd: row.revenueVnd,
        grossProfitVnd: row.grossProfitVnd,
        advertisingCostVnd: row.advertisingCostVnd,
        blockers: row.blockers,
      })),
      spendReconciliation: adGroupRows.map((row) => ({
        adGroupId: this.entityId(row.adGroupId),
        platformSpendVnd: row.spendVnd ?? null,
        orderAdvertisingCostVnd: row.orderAdvertisingCostVnd || 0,
        mismatchVnd: row.spendMismatchVnd ?? null,
        mismatchPercent: row.spendMismatchPercent ?? null,
        sourceOfTruth: "platform_spend",
        status: this.spendEvidenceStatus(row.spendReconciliationStatus),
        blockers:
          row.spendReconciliationStatus === "mismatch"
            ? ["platform_spend_order_ad_cost_mismatch"]
            : row.spendReconciliationStatus === "missing_platform_spend"
              ? ["platform_spend_missing"]
              : [],
      })),
      productMappings: productRows.map((row) => ({
        productId: this.entityId(row.productId),
        mappedAdGroupIds: row.mappedAdGroupIds || [],
        orderIds: orderRollups
          .filter((order) =>
            order.productIds.includes(this.entityId(row.productId)),
          )
          .map((order) => order.orderId),
        supplierIds: row.supplierIds || [],
        blockers: [
          ...(!row.mappedAdGroupIds?.length
            ? ["product_ad_group_mapping_missing"]
            : []),
          ...(!row.supplierIds?.length
            ? ["product_supplier_mapping_missing"]
            : []),
        ],
      })),
    };
  }

  private erpOrderRollup(
    order: AdsAutomationErpOrderRecord,
    window: ErpEvidenceWindow,
  ): ErpOrderRollup {
    const orderId = this.entityId(order._id || order.id);
    const orderDate = this.dateString(order.orderDate || order.createdAt);
    const inWindow = this.dateInWindow(
      order.orderDate || order.createdAt,
      window,
    );
    const adGroupId = this.stringOrUndefined(order.adGroupId);
    const returnedOrCancelled = this.returnOrCancelStatus(order.orderStatus);
    const allocations = this.orderAllocations(order);
    const revenueVnd =
      this.firstNumber(order.revenueVnd, order.revenue) ??
      this.sumFields(order, ["depositAmount", "codAmount", "manualPayment"]);
    const grossProfitVnd =
      this.firstNumber(order.grossProfitVnd, order.grossProfit) ??
      this.sum(allocations, (item) => item.grossProfitVnd);
    const netProfitVnd =
      this.firstNumber(order.netProfitVnd, order.netProfit) ??
      this.sum(allocations, (item) => item.netProfitVnd);
    const advertisingCostVnd =
      this.numberOrUndefined(order.advertisingCost) ?? 0;
    const blockers = [
      ...(!inWindow ? ["outside_report_date_coverage"] : []),
      ...(!adGroupId ? ["missing_order_adGroupId"] : []),
      ...(!allocations.length ? ["missing_order_product_mapping"] : []),
      ...(returnedOrCancelled ? ["returned_refunded_cancelled_order"] : []),
      ...(order.isActive === false ? ["inactive_order"] : []),
    ];

    return {
      order,
      orderId,
      orderDate,
      inWindow,
      adGroupId,
      productIds: this.unique(allocations.map((item) => item.productId)),
      allocations,
      quantity: this.sum(allocations, (item) => item.quantity),
      revenueVnd,
      grossProfitVnd,
      netProfitVnd,
      advertisingCostVnd,
      returnedOrCancelled,
      includedInProfit:
        inWindow &&
        Boolean(adGroupId) &&
        allocations.length > 0 &&
        !returnedOrCancelled &&
        order.isActive !== false,
      blockers,
    };
  }

  private emptyMappingEvidence(): AdsAutomationDecisionSourceMappingEvidence {
    return {
      orderAttribution: [],
      spendReconciliation: [],
      productMappings: [],
    };
  }

  private erpWindow(
    evidenceWindow: AdsAutomationEvidenceWindow,
  ): ErpEvidenceWindow {
    return {
      ...evidenceWindow,
      fromDate: new Date(`${evidenceWindow.from}T00:00:00.000Z`),
      toDate: new Date(`${evidenceWindow.to}T23:59:59.999Z`),
    };
  }

  private orderAllocations(
    order: AdsAutomationErpOrderRecord,
  ): ErpOrderAllocation[] {
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length) {
      const quantityTotal = this.sum(
        items,
        (item) => this.numberOrUndefined(item.quantity) ?? 1,
      );
      const orderRevenue =
        this.firstNumber(order.revenueVnd, order.revenue) ??
        this.sumFields(order, ["depositAmount", "codAmount", "manualPayment"]);
      const orderGrossProfit =
        this.firstNumber(order.grossProfitVnd, order.grossProfit) ?? 0;
      const orderNetProfit =
        this.firstNumber(order.netProfitVnd, order.netProfit) ??
        orderGrossProfit;

      return items
        .map((item) => {
          const productId = this.stringOrUndefined(item.productId);
          if (!productId) return null;
          const quantity = this.numberOrUndefined(item.quantity) ?? 1;
          const ratio =
            quantityTotal > 0 ? quantity / quantityTotal : 1 / items.length;
          return {
            productId,
            quantity,
            revenueVnd:
              this.firstNumber(item.revenueVnd, item.revenue) ??
              this.round(orderRevenue * ratio, 2),
            grossProfitVnd:
              this.firstNumber(item.grossProfitVnd, item.grossProfit) ??
              this.round(orderGrossProfit * ratio, 2),
            netProfitVnd:
              this.firstNumber(item.netProfitVnd, item.netProfit) ??
              this.round(orderNetProfit * ratio, 2),
          };
        })
        .filter((item): item is ErpOrderAllocation => Boolean(item));
    }

    const productId = this.stringOrUndefined(order.productId);
    if (!productId) return [];
    const revenueVnd =
      this.firstNumber(order.revenueVnd, order.revenue) ??
      this.sumFields(order, ["depositAmount", "codAmount", "manualPayment"]);
    const grossProfitVnd =
      this.firstNumber(order.grossProfitVnd, order.grossProfit) ?? 0;
    return [
      {
        productId,
        quantity: this.numberOrUndefined(order.quantity) ?? 1,
        revenueVnd,
        grossProfitVnd,
        netProfitVnd:
          this.firstNumber(order.netProfitVnd, order.netProfit) ??
          grossProfitVnd,
      },
    ];
  }

  private productIdsByAdGroup(
    adGroups: AdsAutomationErpAdGroupRecord[],
    products: AdsAutomationProductReadRow[],
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const adGroup of adGroups) {
      const adGroupId =
        this.stringOrUndefined(adGroup.adGroupId) || this.entityId(adGroup._id);
      result.set(
        adGroupId,
        this.unique([
          ...this.stringArray(adGroup.selectedProducts),
          ...this.stringArray(adGroup.internalProductIds),
          ...this.stringArray(adGroup.productIds),
        ]),
      );
    }
    for (const product of products) {
      for (const adGroupId of product.mappedAdGroupIds || []) {
        result.set(
          adGroupId,
          this.unique([
            ...(result.get(adGroupId) || []),
            this.entityId(product.productId),
          ]),
        );
      }
    }
    return result;
  }

  private mappedAdGroupsByProduct(
    adGroups: AdsAutomationErpAdGroupRecord[],
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const adGroup of adGroups) {
      const adGroupId =
        this.stringOrUndefined(adGroup.adGroupId) || this.entityId(adGroup._id);
      for (const productId of this.unique([
        ...this.stringArray(adGroup.selectedProducts),
        ...this.stringArray(adGroup.internalProductIds),
        ...this.stringArray(adGroup.productIds),
      ])) {
        result.set(
          productId,
          this.unique([...(result.get(productId) || []), adGroupId]),
        );
      }
    }
    return result;
  }

  private supplierIdsByProduct(
    products: AdsAutomationErpProductRecord[],
    quotes: AdsAutomationErpSupplierQuoteRecord[],
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const product of products) {
      const productId = this.entityId(product._id || product.productId);
      const supplierIds = (product.suppliers || [])
        .map((supplier) => this.stringOrUndefined(supplier.supplierId))
        .filter((supplierId): supplierId is string => Boolean(supplierId));
      result.set(
        productId,
        this.unique([...(result.get(productId) || []), ...supplierIds]),
      );
    }
    for (const quote of quotes) {
      const productId = this.entityId(quote.productId);
      const supplierId = this.stringOrUndefined(quote.supplierId);
      if (!supplierId || productId === "unknown") continue;
      result.set(
        productId,
        this.unique([...(result.get(productId) || []), supplierId]),
      );
    }
    return result;
  }

  private supplierProductPairs(
    products: AdsAutomationErpProductRecord[],
    quotes: AdsAutomationErpSupplierQuoteRecord[],
    orderRollups: ErpOrderRollup[],
  ): Array<{ productId: string; supplierId: string; supplierName?: string }> {
    const pairs = new Map<
      string,
      { productId: string; supplierId: string; supplierName?: string }
    >();
    const add = (
      productId: unknown,
      supplierId: unknown,
      supplierName?: string,
    ) => {
      const product = this.stringOrUndefined(productId);
      const supplier = this.stringOrUndefined(supplierId);
      if (!product || !supplier) return;
      pairs.set(this.key(product, supplier), {
        productId: product,
        supplierId: supplier,
        supplierName,
      });
    };
    for (const product of products) {
      const productId = this.entityId(product._id || product.productId);
      for (const supplier of product.suppliers || [])
        add(productId, supplier.supplierId);
    }
    for (const quote of quotes)
      add(quote.productId, quote.supplierId, quote.supplierName);
    for (const order of orderRollups) {
      for (const productId of order.productIds)
        add(productId, order.order.supplierId);
    }
    return Array.from(pairs.values());
  }

  private platformSpendForProduct(
    productId: string,
    input: AdsAutomationDecisionErpSourceAdapterInput,
    window: ErpEvidenceWindow,
  ): number {
    const adGroupIds = (input.adGroups || [])
      .filter((adGroup) =>
        this.unique([
          ...this.stringArray(adGroup.selectedProducts),
          ...this.stringArray(adGroup.internalProductIds),
          ...this.stringArray(adGroup.productIds),
        ]).includes(productId),
      )
      .map(
        (adGroup) =>
          this.stringOrUndefined(adGroup.adGroupId) ||
          this.entityId(adGroup._id),
      );
    const wanted = new Set(adGroupIds);
    return this.sum(
      (input.advertisingCosts || []).filter(
        (row) =>
          wanted.has(this.stringOrUndefined(row.adGroupId) || "") &&
          this.dateInWindow(
            row.date || row.lastSyncAt || row.updatedAt || row.createdAt,
            window,
          ),
      ),
      (row) => this.firstNumber(row.spendVnd, row.costVnd, row.spentAmount),
    );
  }

  private spendReconciliationStatus(
    platformRows: number,
    attributedOrders: number,
    platformSpendVnd: number,
    orderAdvertisingCostVnd: number,
  ): AdsAutomationDecisionSpendReconciliationEvidence["status"] {
    if (!platformRows) return "missing_platform_spend";
    if (!attributedOrders) return "missing_order_attribution";
    const mismatch = Math.abs(platformSpendVnd - orderAdvertisingCostVnd);
    const tolerance = Math.max(1, platformSpendVnd * 0.05);
    return mismatch > tolerance ? "mismatch" : "matched";
  }

  private spendEvidenceStatus(
    status: string | undefined,
  ): AdsAutomationDecisionSpendReconciliationEvidence["status"] {
    if (
      status === "matched" ||
      status === "mismatch" ||
      status === "missing_platform_spend" ||
      status === "missing_order_attribution"
    ) {
      return status;
    }
    return "missing_platform_spend";
  }

  private erpAdGroupDataQuality(input: {
    hasPlatformSpend: boolean;
    hasBudget: boolean;
    hasProductMapping: boolean;
    hasOrders: boolean;
    spendStatus: string;
  }): number {
    let score = 0.55;
    if (input.hasPlatformSpend) score += 0.15;
    if (input.hasBudget) score += 0.1;
    if (input.hasProductMapping) score += 0.1;
    if (input.hasOrders) score += 0.1;
    if (input.spendStatus === "mismatch") score -= 0.2;
    if (input.spendStatus === "missing_order_attribution") score -= 0.1;
    return this.round(Math.max(0.1, Math.min(0.98, score)), 2);
  }

  private erpAdGroupLabels(row: AdsAutomationErpAdGroupRecord): string[] {
    const labels = this.stringArray(row.labels);
    if (row.isManualOverride === true) labels.push("MANUAL_OVERRIDE");
    const notes = String(row.notes || "").toUpperCase();
    if (notes.includes("NO_AUTO")) labels.push("NO_AUTO");
    if (notes.includes("BRAND_PROTECTED")) labels.push("BRAND_PROTECTED");
    return this.unique(labels);
  }

  private reservedQuantity(rows: ErpOrderRollup[]): number {
    return this.sum(
      rows.filter(
        (row) =>
          !this.finalOrderStatus(row.order.orderStatus) &&
          row.order.isActive !== false,
      ),
      (row) => row.quantity,
    );
  }

  private daysOfCover(
    availableQuantity: number,
    soldQuantity: number,
    days: number,
  ): number {
    const velocity = soldQuantity / Math.max(1, days);
    if (velocity <= 0) return availableQuantity > 0 ? 999 : 0;
    return this.round(availableQuantity / velocity, 2);
  }

  private marginPercent(
    netProfitVnd: number,
    revenueVnd: number,
    product: AdsAutomationErpProductRecord,
  ): number | undefined {
    if (revenueVnd > 0) return this.round((netProfitVnd / revenueVnd) * 100, 2);
    const salePrice = this.salePrice(product);
    const cost = this.productCost(product);
    return salePrice && cost !== undefined
      ? this.round(((salePrice - cost) / salePrice) * 100, 2)
      : undefined;
  }

  private productSupplierPrice(
    product: AdsAutomationErpProductRecord | undefined,
    supplierId: string,
  ): number | undefined {
    const supplier = (product?.suppliers || []).find(
      (item) => this.entityId(item.supplierId) === supplierId,
    );
    return this.firstNumber(
      supplier?.appliedPrice,
      supplier?.price1,
      supplier?.price2,
      supplier?.price3,
    );
  }

  private supplierMarginPercent(
    product: AdsAutomationErpProductRecord | undefined,
    currentQuoteVnd?: number,
  ): number | undefined {
    const salePrice = this.salePrice(product);
    const quote = currentQuoteVnd ?? this.productCost(product);
    if (!salePrice || quote === undefined) return undefined;
    return this.round(((salePrice - quote) / salePrice) * 100, 2);
  }

  private quoteApproved(
    quote: AdsAutomationErpSupplierQuoteRecord | undefined,
    product: AdsAutomationErpProductRecord | undefined,
    supplierId: string,
  ): boolean {
    const status = this.statusKey(quote?.approvalStatus || quote?.status);
    if (status)
      return ["approved", "active", "daduyet", "applied"].includes(status);
    const productSupplier = (product?.suppliers || []).find(
      (item) => this.entityId(item.supplierId) === supplierId,
    );
    return Boolean(
      quote || productSupplier?.appliedAt || productSupplier?.isDefault,
    );
  }

  private paymentFreshnessDays(
    rows: AdsAutomationErpSupplierPayableRecord[],
    now: Date,
  ): number | undefined {
    const latest = this.timestamp(
      this.latestDate([
        ...rows,
        ...rows
          .flatMap((row) => row.payments || [])
          .map((payment) => ({ updatedAt: payment.paidAt })),
      ]),
    );
    if (!latest) return undefined;
    return Math.max(0, Math.floor((now.getTime() - latest) / 86_400_000));
  }

  private returnFaultRatePercent(rows: ErpOrderRollup[]): number | undefined {
    if (!rows.length) return undefined;
    return this.round(
      (rows.filter((row) => row.returnedOrCancelled).length / rows.length) *
        100,
      2,
    );
  }

  private capacityStatus(input: {
    quoteApproved: boolean;
    stock: number;
    lateDeliveryRatePercent?: number;
  }): string {
    if (!input.quoteApproved) return "blocked";
    if (input.stock <= 0 || Number(input.lateDeliveryRatePercent || 0) >= 30)
      return "blocked";
    if (input.stock < 10 || Number(input.lateDeliveryRatePercent || 0) >= 15)
      return "constrained";
    return "available";
  }

  private activeProduct(product: AdsAutomationErpProductRecord): boolean {
    const status = this.statusKey(product.status);
    return !["paused", "inactive", "ngungban", "tamdung"].includes(status);
  }

  private salePrice(
    product?: AdsAutomationErpProductRecord,
  ): number | undefined {
    const direct = this.firstNumber(product?.salePrice, product?.price);
    if (direct !== undefined) return direct;
    return this.numberOrUndefined(
      (product?.fanpageVariations || []).find((item) => item?.customPrice)
        ?.customPrice,
    );
  }

  private productCost(
    product?: AdsAutomationErpProductRecord,
  ): number | undefined {
    return this.firstNumber(
      product?.totalCost,
      this.sumFields(product || {}, [
        "importPrice",
        "shippingCost",
        "packagingCost",
      ]),
      product?.importPrice,
    );
  }

  private groupBy<T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]> {
    const result = new Map<string, T[]>();
    for (const row of rows) {
      const key = keyFn(row);
      result.set(key, [...(result.get(key) || []), row]);
    }
    return result;
  }

  private indexBy<T>(rows: T[], keyFn: (row: T) => string): Map<string, T> {
    const result = new Map<string, T>();
    for (const row of rows) {
      const key = keyFn(row);
      if (key && key !== "unknown") result.set(key, row);
    }
    return result;
  }

  private key(left: unknown, right: unknown): string {
    return `${this.entityId(left)}:${this.entityId(right)}`;
  }

  private pairKey(left: unknown, right: unknown): string {
    return this.key(left, right);
  }

  private dateInWindow(value: unknown, window: ErpEvidenceWindow): boolean {
    const timestamp = this.timestamp(value);
    return (
      timestamp >= window.fromDate.getTime() &&
      timestamp <= window.toDate.getTime()
    );
  }

  private dateString(value: unknown): string | null {
    const timestamp = this.timestamp(value);
    return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : null;
  }

  private latestDate(
    rows: Array<ErpRecord | undefined>,
    fields = ["lastSyncAt", "updatedAt", "createdAt"],
  ): string | undefined {
    const latest = rows
      .filter((row): row is ErpRecord => Boolean(row))
      .flatMap((row) => fields.map((field) => row[field]))
      .map((value) => this.timestamp(value))
      .filter((value) => value > 0)
      .sort((left, right) => right - left)[0];
    return latest ? new Date(latest).toISOString() : undefined;
  }

  private statusKey(value: unknown): string {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "")
      .toLowerCase();
  }

  private returnOrCancelStatus(value: unknown): boolean {
    const status = this.statusKey(value);
    return [
      "returned",
      "return",
      "refunded",
      "refund",
      "cancelled",
      "canceled",
      "boom",
      "hoan",
      "huy",
    ].some((key) => status.includes(key));
  }

  private finalOrderStatus(value: unknown): boolean {
    const status = this.statusKey(value);
    return [
      "completed",
      "delivered",
      "returned",
      "return",
      "refunded",
      "refund",
      "cancelled",
      "canceled",
      "boom",
      "giao",
      "hoan",
      "huy",
    ].some((key) => status.includes(key));
  }

  private firstText(values: unknown[]): string | undefined {
    for (const value of values) {
      const text = this.stringOrUndefined(value);
      if (text) return text;
    }
    return undefined;
  }

  private firstNumber(...values: unknown[]): number | undefined {
    for (const value of values) {
      const numberValue = this.numberOrUndefined(value);
      if (numberValue !== undefined) return numberValue;
    }
    return undefined;
  }

  private booleanOrUndefined(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
  }

  private sum<T>(rows: T[], valueFn: (row: T) => number | undefined): number {
    return rows.reduce((total, row) => total + (valueFn(row) || 0), 0);
  }

  private sumFields(row: ErpRecord, fields: string[]): number {
    return fields.reduce(
      (total, field) => total + (this.numberOrUndefined(row?.[field]) || 0),
      0,
    );
  }

  private round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  private buildMissingFieldEvidence(
    input: AdsAutomationDecisionSourceAdapterInput,
  ): AdsAutomationDecisionMissingFieldEvidence[] {
    const evidence: AdsAutomationDecisionMissingFieldEvidence[] = [];

    for (const row of input.adGroups || []) {
      const entityId = this.entityId(
        row.adGroupId || row.resourceName || row.campaignId,
      );
      this.pushMissing(evidence, "ads_performance", "ad_group", entityId, [
        this.missingAlias(row, "platform"),
        this.missingAny(row, ["accountId", "customerId"], "accountId"),
        this.missingAlias(row, "campaignId"),
        this.missingAlias(row, "adGroupId"),
        this.missingAlias(row, "resourceName"),
        this.missingAny(row, ["currentStatus", "status"], "currentStatus"),
        this.missingAny(row, ["spendVnd", "costVnd"], "spendVnd"),
        this.missingAlias(row, "orders"),
        this.missingAny(row, ["revenueVnd", "revenue"], "revenueVnd"),
        this.missingAny(
          row,
          ["grossProfitVnd", "grossProfit"],
          "grossProfitVnd",
        ),
        this.missingAny(
          row,
          ["netProfitAfterAdsVnd", "netProfit"],
          "netProfitAfterAdsVnd",
        ),
        this.missingAny(
          row,
          ["dataQualityScore", "attributionConfidence"],
          "dataQualityScore",
        ),
        this.missingArrayAny(
          row,
          ["productIds", "internalProductIds", "mappedProductIds"],
          "productIds",
        ),
      ]);
      this.pushMissing(evidence, "campaign_budgets", "ad_group", entityId, [
        !this.present(row.campaignBudgetId) &&
        !this.present(row.campaignBudgetResourceName)
          ? "campaignBudgetId_or_campaignBudgetResourceName"
          : null,
        this.missingAny(
          row,
          ["currentBudgetVnd", "dailyBudgetVnd", "campaignBudgetAmountVnd"],
          "currentBudgetVnd",
        ),
      ]);
      this.pushMissing(evidence, "pause_review", "ad_group", entityId, [
        this.missingAlias(row, "adGroupId"),
        this.missingAny(row, ["currentStatus", "status"], "currentStatus"),
        this.missingAny(row, ["spendVnd", "costVnd"], "spendVnd"),
        this.missingAlias(row, "orders"),
        this.missingAny(
          row,
          ["netProfitAfterAdsVnd", "netProfit"],
          "netProfitAfterAdsVnd",
        ),
        this.missingAny(
          row,
          ["dataQualityScore", "attributionConfidence"],
          "dataQualityScore",
        ),
        Array.isArray(row.labels) ? null : "labels",
        this.missingAlias(row, "bottlenecksChecked"),
      ]);
    }

    for (const row of input.products || []) {
      const entityId = this.entityId(row.productId || row.sku || row.name);
      this.pushMissing(evidence, "product_performance", "product", entityId, [
        this.missingAlias(row, "productId"),
        this.missingAny(row, ["name", "productName"], "name"),
        this.missingAlias(row, "netProfitVnd"),
        this.missingAlias(row, "marginPercent"),
        this.missingAlias(row, "returnCancelRefundRatePercent"),
        this.missingAlias(row, "stockAvailable"),
        this.missingAlias(row, "daysOfCover"),
        this.missingArray(row.mappedAdGroupIds, "mappedAdGroupIds"),
        this.missingArray(row.supplierIds, "supplierIds"),
      ]);
    }

    for (const row of input.suppliers || []) {
      const entityId = this.entityId(
        row.supplierId || row.supplierName || row.productId,
      );
      this.pushMissing(evidence, "supplier_safety", "supplier", entityId, [
        this.missingAlias(row, "productId"),
        this.missingAlias(row, "supplierId"),
        this.missingAlias(row, "quoteApproved"),
        this.missingAlias(row, "marginAfterCostPercent"),
        this.missingAlias(row, "leadTimeDays"),
        this.missingAlias(row, "lateDeliveryRatePercent"),
        this.missingAlias(row, "paymentFreshnessDays"),
        this.missingAlias(row, "capacityStatus"),
        this.missingAlias(row, "returnFaultRatePercent"),
      ]);
    }

    if (input.policy) {
      this.pushMissing(
        evidence,
        "cashflow_policy",
        "policy",
        "cashflow_policy",
        [
          this.missingAlias(input.policy, "availableAdsCashVnd"),
          this.missingAlias(input.policy, "cashflowGatePassed"),
        ],
      );
    }

    return evidence;
  }

  private buildSourceEvidence(
    input: AdsAutomationDecisionSourceAdapterInput,
    missingFieldEvidence: AdsAutomationDecisionMissingFieldEvidence[],
    now: Date,
    options: AdsAutomationDecisionSourceAdapterOptions,
  ): AdsAutomationDecisionSourceEvidence[] {
    return (Object.keys(SOURCE_LABELS) as AdsAutomationDecisionSourceKey[]).map(
      (sourceKey) => {
        const rows = this.rowsForSource(input, sourceKey);
        const maxAgeHours =
          options.maxAgeHours?.[sourceKey] || DEFAULT_MAX_AGE_HOURS[sourceKey];
        const latestObservedAt = this.latestObservedAt(
          rows,
          input.sourceWatermarks?.[sourceKey],
        );
        const ageHours = latestObservedAt
          ? this.ageHours(latestObservedAt, now)
          : null;
        const status = this.freshnessStatus(
          rows.length,
          latestObservedAt,
          ageHours,
          maxAgeHours,
        );
        const sourceMissing = missingFieldEvidence.filter(
          (item) => item.sourceKey === sourceKey,
        );
        const missingFields = this.unique(
          sourceMissing.flatMap((item) => item.missingFields),
        );
        const affectedEntityIds = this.unique(
          sourceMissing.map((item) => item.entityId),
        );

        return {
          sourceKey,
          sourceLabel: SOURCE_LABELS[sourceKey],
          status,
          canUseForDecision: this.canUseForDecision(status, missingFields),
          latestObservedAt,
          maxAgeHours,
          ageHours,
          rowCount: rows.length,
          missingFields,
          affectedEntityIds,
        };
      },
    );
  }

  private mapPolicy(
    row: AdsAutomationCashflowPolicyReadRow | undefined,
    evidence: AdsAutomationDecisionSourceEvidence | undefined,
  ) {
    if (!row) return undefined;
    const sourceUsable =
      evidence?.status === "fresh" && !evidence.missingFields.length;
    return {
      availableAdsCashVnd: this.numberOrUndefined(row.availableAdsCashVnd),
      cashflowGatePassed: sourceUsable ? row.cashflowGatePassed : false,
      maxBudgetIncreasePercent: this.numberOrUndefined(
        row.maxBudgetIncreasePercent,
      ),
      mediumConfidenceIncreasePercent: this.numberOrUndefined(
        row.mediumConfidenceIncreasePercent,
      ),
      minOrdersForScale: this.numberOrUndefined(row.minOrdersForScale),
      minDataQualityScore: this.numberOrUndefined(row.minDataQualityScore),
      minSpendForPauseVnd: this.numberOrUndefined(row.minSpendForPauseVnd),
      maxReturnRatePercent: this.numberOrUndefined(row.maxReturnRatePercent),
      minMarginPercent: this.numberOrUndefined(row.minMarginPercent),
      minStockAvailable: this.numberOrUndefined(row.minStockAvailable),
      minDaysOfCover: this.numberOrUndefined(row.minDaysOfCover),
      maxSupplierLeadTimeDays: this.numberOrUndefined(
        row.maxSupplierLeadTimeDays,
      ),
      maxSupplierLateDeliveryRatePercent: this.numberOrUndefined(
        row.maxSupplierLateDeliveryRatePercent,
      ),
      maxSupplierReturnFaultRatePercent: this.numberOrUndefined(
        row.maxSupplierReturnFaultRatePercent,
      ),
      maxSupplierPaymentFreshnessDays: this.numberOrUndefined(
        row.maxSupplierPaymentFreshnessDays,
      ),
    };
  }

  private mapAdGroup(
    row: AdsAutomationAdGroupReadRow,
    evidenceWindow: AdsAutomationEvidenceWindow,
    evidenceByKey: Map<
      AdsAutomationDecisionSourceKey,
      AdsAutomationDecisionSourceEvidence
    >,
  ): AdsAutomationAdGroupInput {
    const baseDataQuality = this.numberOrUndefined(
      row.dataQualityScore ?? row.attributionConfidence,
    );
    const performanceUsable = this.sourceUsable(
      evidenceByKey.get("ads_performance"),
    );
    const budgetUsable = this.sourceUsable(
      evidenceByKey.get("campaign_budgets"),
    );
    const pauseReviewUsable = this.sourceUsable(
      evidenceByKey.get("pause_review"),
    );
    const productIds = this.stringArray(
      row.productIds || row.internalProductIds || row.mappedProductIds,
    );
    return {
      platform: this.stringOrUndefined(row.platform),
      accountId: this.stringOrUndefined(row.accountId || row.customerId),
      campaignId: this.stringOrUndefined(row.campaignId),
      campaignName: this.stringOrUndefined(row.campaignName),
      adGroupId: this.stringOrUndefined(row.adGroupId),
      adGroupName: this.stringOrUndefined(row.adGroupName),
      resourceName: this.stringOrUndefined(row.resourceName),
      campaignBudgetId: budgetUsable
        ? this.stringOrUndefined(row.campaignBudgetId)
        : undefined,
      campaignBudgetResourceName: budgetUsable
        ? this.stringOrUndefined(row.campaignBudgetResourceName)
        : undefined,
      currentStatus: performanceUsable
        ? this.stringOrUndefined(row.currentStatus || row.status)
        : undefined,
      currentBudgetVnd: budgetUsable
        ? this.numberOrUndefined(
            row.currentBudgetVnd ??
              row.dailyBudgetVnd ??
              row.campaignBudgetAmountVnd,
          )
        : undefined,
      spendVnd: performanceUsable
        ? this.numberOrUndefined(row.spendVnd ?? row.costVnd)
        : undefined,
      clicks: performanceUsable
        ? this.numberOrUndefined(row.clicks)
        : undefined,
      impressions: performanceUsable
        ? this.numberOrUndefined(row.impressions)
        : undefined,
      conversions: performanceUsable
        ? this.numberOrUndefined(row.conversions)
        : undefined,
      conversionValueVnd: performanceUsable
        ? this.numberOrUndefined(row.conversionValueVnd ?? row.conversionValue)
        : undefined,
      orders: performanceUsable
        ? this.numberOrUndefined(row.orders)
        : undefined,
      revenueVnd: performanceUsable
        ? this.numberOrUndefined(row.revenueVnd ?? row.revenue)
        : undefined,
      grossProfitVnd: performanceUsable
        ? this.numberOrUndefined(row.grossProfitVnd ?? row.grossProfit)
        : undefined,
      netProfitAfterAdsVnd: performanceUsable
        ? this.numberOrUndefined(row.netProfitAfterAdsVnd ?? row.netProfit)
        : undefined,
      orderAdvertisingCostVnd: performanceUsable
        ? this.numberOrUndefined(row.orderAdvertisingCostVnd)
        : undefined,
      spendSourceOfTruth: performanceUsable
        ? this.stringOrUndefined(row.spendSourceOfTruth)
        : undefined,
      spendReconciliationStatus: performanceUsable
        ? this.stringOrUndefined(row.spendReconciliationStatus)
        : undefined,
      spendMismatchVnd: performanceUsable
        ? this.numberOrUndefined(row.spendMismatchVnd)
        : undefined,
      spendMismatchPercent: performanceUsable
        ? this.numberOrUndefined(row.spendMismatchPercent)
        : undefined,
      attributedOrderIds: performanceUsable
        ? this.stringArray(row.attributedOrderIds)
        : undefined,
      excludedOrderIds: performanceUsable
        ? this.stringArray(row.excludedOrderIds)
        : undefined,
      cancelledReturnedRefundedOrders: performanceUsable
        ? this.numberOrUndefined(row.cancelledReturnedRefundedOrders)
        : undefined,
      returnRatePercent: performanceUsable
        ? this.numberOrUndefined(row.returnRatePercent)
        : undefined,
      dataQualityScore:
        performanceUsable && budgetUsable
          ? baseDataQuality
          : performanceUsable
            ? this.capDataQuality(baseDataQuality, 0.5)
            : undefined,
      labels:
        pauseReviewUsable && Array.isArray(row.labels)
          ? [...row.labels]
          : undefined,
      productIds: productIds.length ? productIds : undefined,
      bottlenecksChecked: pauseReviewUsable
        ? row.bottlenecksChecked
        : undefined,
      evidenceWindow,
    };
  }

  private mapProduct(
    row: AdsAutomationProductReadRow,
    evidence: AdsAutomationDecisionSourceEvidence | undefined,
  ): AdsAutomationProductInput {
    const sourceUsable = evidence?.status === "fresh";
    return {
      productId: this.stringOrUndefined(row.productId),
      sku: this.stringOrUndefined(row.sku),
      name: this.stringOrUndefined(row.name || row.productName),
      netProfitVnd: sourceUsable
        ? this.numberOrUndefined(row.netProfitVnd)
        : undefined,
      adAttributedNetProfitAfterAdsVnd: sourceUsable
        ? this.numberOrUndefined(row.adAttributedNetProfitAfterAdsVnd)
        : undefined,
      marginPercent: sourceUsable
        ? this.numberOrUndefined(row.marginPercent)
        : undefined,
      returnCancelRefundRatePercent: sourceUsable
        ? this.numberOrUndefined(row.returnCancelRefundRatePercent)
        : undefined,
      stockAvailable: sourceUsable
        ? this.numberOrUndefined(row.stockAvailable)
        : undefined,
      reservedQuantity: sourceUsable
        ? this.numberOrUndefined(row.reservedQuantity)
        : undefined,
      incomingQuantity: sourceUsable
        ? this.numberOrUndefined(row.incomingQuantity)
        : undefined,
      daysOfCover: sourceUsable
        ? this.numberOrUndefined(row.daysOfCover)
        : undefined,
      mediaReady: row.mediaReady,
      landingReady: row.landingReady,
      offerReady: row.offerReady,
      mappedAdGroupIds: this.stringArray(row.mappedAdGroupIds),
      supplierIds: this.stringArray(row.supplierIds),
    };
  }

  private mapSupplier(
    row: AdsAutomationSupplierReadRow,
    evidence: AdsAutomationDecisionSourceEvidence | undefined,
  ): AdsAutomationSupplierInput {
    const sourceUsable = evidence?.status === "fresh";
    return {
      productId: this.stringOrUndefined(row.productId),
      supplierId: this.stringOrUndefined(row.supplierId),
      supplierName: this.stringOrUndefined(row.supplierName),
      quoteApproved: sourceUsable ? row.quoteApproved : undefined,
      currentQuoteVnd: sourceUsable
        ? this.numberOrUndefined(row.currentQuoteVnd)
        : undefined,
      priorQuoteVnd: sourceUsable
        ? this.numberOrUndefined(row.priorQuoteVnd)
        : undefined,
      marginAfterCostPercent: sourceUsable
        ? this.numberOrUndefined(row.marginAfterCostPercent)
        : undefined,
      leadTimeDays: sourceUsable
        ? this.numberOrUndefined(row.leadTimeDays)
        : undefined,
      lateDeliveryRatePercent: sourceUsable
        ? this.numberOrUndefined(row.lateDeliveryRatePercent)
        : undefined,
      paymentFreshnessDays: sourceUsable
        ? this.numberOrUndefined(row.paymentFreshnessDays)
        : undefined,
      capacityStatus: sourceUsable ? row.capacityStatus : undefined,
      returnFaultRatePercent: sourceUsable
        ? this.numberOrUndefined(row.returnFaultRatePercent)
        : undefined,
    };
  }

  private rowsForSource(
    input: AdsAutomationDecisionSourceAdapterInput,
    sourceKey: AdsAutomationDecisionSourceKey,
  ): AdsAutomationSourceStampedRow[] {
    if (
      sourceKey === "ads_performance" ||
      sourceKey === "campaign_budgets" ||
      sourceKey === "pause_review"
    ) {
      return input.adGroups || [];
    }
    if (sourceKey === "product_performance") return input.products || [];
    if (sourceKey === "supplier_safety") return input.suppliers || [];
    if (sourceKey === "cashflow_policy")
      return input.policy ? [input.policy] : [];
    return [];
  }

  private latestObservedAt(
    rows: AdsAutomationSourceStampedRow[],
    watermark?: string | Date,
  ): string | null {
    const sourceWatermark = this.timestamp(watermark);
    if (sourceWatermark !== null)
      return new Date(sourceWatermark).toISOString();

    const timestamps = [
      ...rows.flatMap((row) => [
        row.lastSyncAt,
        row.lastSyncedAt,
        row.sourceUpdatedAt,
        row.updatedAt,
        row.createdAt,
      ]),
    ]
      .map((value) => this.timestamp(value))
      .filter((value): value is number => value !== null);
    return timestamps.length
      ? new Date(Math.max(...timestamps)).toISOString()
      : null;
  }

  private freshnessStatus(
    rowCount: number,
    latestObservedAt: string | null,
    ageHours: number | null,
    maxAgeHours: number,
  ): AdsAutomationDecisionSourceFreshnessStatus {
    if (rowCount <= 0) return "missing";
    if (!latestObservedAt || ageHours === null) return "unknown";
    return ageHours <= maxAgeHours ? "fresh" : "stale";
  }

  private canUseForDecision(
    status: AdsAutomationDecisionSourceFreshnessStatus,
    missingFields: string[],
  ) {
    if (status === "fresh" && missingFields.length === 0) return "yes";
    if (status === "fresh" || status === "stale") return "cautious";
    return "no";
  }

  private sourceUsable(
    evidence: AdsAutomationDecisionSourceEvidence | undefined,
  ): boolean {
    return evidence?.status === "fresh" && evidence.canUseForDecision === "yes";
  }

  private pushMissing(
    evidence: AdsAutomationDecisionMissingFieldEvidence[],
    sourceKey: AdsAutomationDecisionSourceKey,
    entityType: AdsAutomationDecisionSourceEntityType,
    entityId: string,
    fields: Array<string | null>,
  ) {
    const missingFields = this.unique(
      fields.filter((field): field is string => Boolean(field)),
    );
    if (!missingFields.length) return;
    evidence.push({ sourceKey, entityType, entityId, missingFields });
  }

  private missingAlias(row: any, field: string): string | null {
    return this.present(row[field]) ? null : field;
  }

  private missingAny(row: any, fields: string[], label: string): string | null {
    return fields.some((field) => this.present(row[field])) ? null : label;
  }

  private missingArray(values: unknown, label: string): string | null {
    return Array.isArray(values) && values.length > 0 ? null : label;
  }

  private missingArrayAny(
    row: any,
    fields: string[],
    label: string,
  ): string | null {
    return fields.some(
      (field) =>
        Array.isArray(row[field]) && (row[field] as unknown[]).length > 0,
    )
      ? null
      : label;
  }

  private present(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== "";
  }

  private stringOrUndefined(value: unknown): string | undefined {
    return this.present(value) ? String(value) : undefined;
  }

  private stringArray(values: unknown): string[] {
    return Array.isArray(values)
      ? values
          .map((value) => String(value))
          .filter((value) => value.trim().length > 0)
      : [];
  }

  private numberOrUndefined(value: unknown): number | undefined {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private capDataQuality(
    value: number | undefined,
    cap: number,
  ): number | undefined {
    return value === undefined ? undefined : Math.min(value, cap);
  }

  private entityId(value: unknown): string {
    return this.stringOrUndefined(value) || "unknown";
  }

  private unique(values: string[]): string[] {
    return Array.from(
      new Set(values.filter((value) => value.trim().length > 0)),
    ).sort();
  }

  private timestamp(value?: unknown): number | null {
    if (!value) return null;
    const timestamp =
      value instanceof Date
        ? value.getTime()
        : new Date(String(value)).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  private ageHours(value: string, now: Date): number {
    return (
      Math.round(
        ((now.getTime() - new Date(value).getTime()) / 3_600_000) * 100,
      ) / 100
    );
  }

  private dateOrNow(value?: string | Date): Date {
    const timestamp = this.timestamp(value);
    return timestamp === null ? new Date() : new Date(timestamp);
  }

  private validDate(value?: string): string | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
      ? null
      : value;
  }

  private defaultEvidenceWindow(
    snapshotDate: string,
  ): AdsAutomationEvidenceWindow {
    const to = new Date(`${snapshotDate}T00:00:00.000Z`);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 13);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      days: 14,
    };
  }
}
