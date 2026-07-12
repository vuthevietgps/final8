import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import type {
  AdsAutomationCampaignBudgetReadRow,
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelRepository,
} from './contracts/ads-automation-decision-read-model-query.contract';
import type {
  AdsAutomationAdGroupReadRow,
  AdsAutomationCashflowPolicyReadRow,
  AdsAutomationDecisionSourceKey,
  AdsAutomationProductReadRow,
  AdsAutomationSupplierReadRow,
} from './contracts/ads-automation-decision-source-adapter.contract';

type MongoRow = Record<string, any>;

export type ProfitEvidenceStatus = 'fresh' | 'stale' | 'missing' | 'unknown';

export interface ProfitFieldEvidence {
  status: ProfitEvidenceStatus;
  total?: number;
  latestObservedAt?: string;
  ageHours?: number;
  maxAgeHours: number;
  rowCount: number;
  provenanceRowCount: number;
}

export interface SupplierQuoteApprovalEvidence {
  approved: boolean;
  source:
    | 'approvalStatus'
    | 'status'
    | 'approved'
    | 'isApproved'
    | 'approvedAt_and_approvedBy'
    | 'missing';
}

const PROFIT_PROVENANCE_FIELDS = [
  'profitUpdatedAt',
  'profitCalculatedAt',
  'erpEnrichedAt',
  'profitEvidenceAt',
] as const;

function explicitFiniteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function evidenceTimestamp(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00.000Z`)
    : new Date(text);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function evidenceStatusKey(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

/**
 * A zero from google_ads_daily_metrics is not proof of ERP profit enrichment:
 * the Mongo schema defaults that field to zero. Zero is trusted only when an
 * explicit profit provenance marker is present.
 */
export function assessMetricProfitEvidence(
  rows: MongoRow[],
  options: { now?: string | Date; maxAgeHours?: number } = {},
): ProfitFieldEvidence {
  const maxAgeHours = Math.max(0, options.maxAgeHours ?? 24);
  const evidenceRows = rows.filter((row) => {
    const profit = explicitFiniteNumber(row.netProfit);
    if (profit === undefined) return false;
    if (profit !== 0) return true;
    return PROFIT_PROVENANCE_FIELDS.some((field) => evidenceTimestamp(row[field]) > 0)
      || row.profitDataAvailable === true;
  });

  if (!evidenceRows.length) {
    return {
      status: 'missing',
      maxAgeHours,
      rowCount: 0,
      provenanceRowCount: 0,
    };
  }

  const total = evidenceRows.reduce(
    (sum, row) => sum + (explicitFiniteNumber(row.netProfit) || 0),
    0,
  );
  const observedAtMs = evidenceRows
    .flatMap((row) => {
      const provenanceDates = PROFIT_PROVENANCE_FIELDS
        .map((field) => row[field])
        .filter((value) => evidenceTimestamp(value) > 0);
      // A fresh provider sync must not make stale ERP profit enrichment fresh.
      return provenanceDates.length
        ? provenanceDates
        : [row.lastSyncAt, row.updatedAt, row.createdAt, row.date];
    })
    .map(evidenceTimestamp)
    .filter((value) => value > 0)
    .sort((left, right) => right - left)[0];
  const provenanceRowCount = evidenceRows.filter((row) => (
    PROFIT_PROVENANCE_FIELDS.some((field) => evidenceTimestamp(row[field]) > 0)
      || row.profitDataAvailable === true
  )).length;

  if (!observedAtMs) {
    return {
      status: 'unknown',
      total,
      maxAgeHours,
      rowCount: evidenceRows.length,
      provenanceRowCount,
    };
  }

  const nowMs = evidenceTimestamp(options.now) || Date.now();
  const ageHours = Math.max(0, (nowMs - observedAtMs) / 3_600_000);
  return {
    status: ageHours <= maxAgeHours ? 'fresh' : 'stale',
    total,
    latestObservedAt: new Date(observedAtMs).toISOString(),
    ageHours: Math.round(ageHours * 100) / 100,
    maxAgeHours,
    rowCount: evidenceRows.length,
    provenanceRowCount,
  };
}

export function assessSupplierQuoteApproval(
  quote: MongoRow | undefined,
): SupplierQuoteApprovalEvidence {
  if (!quote) return { approved: false, source: 'missing' };

  for (const source of ['approvalStatus', 'status'] as const) {
    if (quote[source] === undefined || quote[source] === null || quote[source] === '') continue;
    return {
      approved: ['approved', 'daduyet'].includes(evidenceStatusKey(quote[source])),
      source,
    };
  }

  for (const source of ['approved', 'isApproved'] as const) {
    if (typeof quote[source] !== 'boolean') continue;
    return { approved: quote[source], source };
  }

  if (evidenceTimestamp(quote.approvedAt) > 0 && String(quote.approvedBy || '').trim()) {
    return { approved: true, source: 'approvedAt_and_approvedBy' };
  }

  return { approved: false, source: 'missing' };
}

interface EvidenceWindow {
  from: string;
  to: string;
  days: number;
  fromDate: Date;
  toDate: Date;
}

const COLLECTIONS = {
  campaigns: 'google_ads_campaigns',
  campaignBudgets: 'google_ads_campaign_budgets',
  googleAdGroups: 'google_ads_ad_groups',
  dailyMetrics: 'google_ads_daily_metrics',
  legacyAdGroups: 'adgroups',
  products: 'products',
  orders: 'ordertest2',
  inventorySummaries: 'inventorysummaries',
  supplierQuotes: 'supplierquotes',
  purchaseOrders: 'purchaseorders',
  supplierPayables: 'supplierpayables',
  supplierStatements: 'supplierstatements',
  users: 'users',
  availableFundSnapshots: 'available_fund_snapshots',
  capitalAllocationSnapshots: 'capital_allocation_snapshots',
  cashflowSummarySnapshots: 'cashflow_summary_snapshots',
  systemSettings: 'system_settings',
} as const;

@Injectable()
export class AdsAutomationDecisionMongoReadModelRepository
  implements AdsAutomationDecisionReadModelRepository {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async findAdGroupPerformanceRows(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationAdGroupReadRow[]> {
    const window = this.window(query);
    const customerFilter = this.customerFilter(query);
    const [campaigns, adGroups, metrics, legacyAdGroups] = await Promise.all([
      this.readMany(COLLECTIONS.campaigns, customerFilter, {
        customerId: 1,
        campaignId: 1,
        resourceName: 1,
        campaignName: 1,
        status: 1,
        campaignBudgetId: 1,
        campaignBudgetResourceName: 1,
        internalProductId: 1,
        lastSyncAt: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.googleAdGroups, customerFilter, {
        customerId: 1,
        campaignId: 1,
        adGroupId: 1,
        resourceName: 1,
        adGroupName: 1,
        status: 1,
        internalAdGroupId: 1,
        internalProductIds: 1,
        lastSyncAt: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.dailyMetrics, {
        ...customerFilter,
        level: 'ad_group',
        date: { $gte: window.from, $lte: window.to },
      }, {
        date: 1,
        level: 1,
        customerId: 1,
        campaignId: 1,
        adGroupId: 1,
        resourceName: 1,
        costMicros: 1,
        costVnd: 1,
        impressions: 1,
        clicks: 1,
        conversions: 1,
        conversionValue: 1,
        conversionValueVnd: 1,
        revenue: 1,
        grossProfit: 1,
        netProfit: 1,
        profitUpdatedAt: 1,
        profitCalculatedAt: 1,
        erpEnrichedAt: 1,
        profitEvidenceAt: 1,
        profitDataAvailable: 1,
        orders: 1,
        cancelledOrders: 1,
        lastSyncAt: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.legacyAdGroups, {}, {
        adGroupId: 1,
        name: 1,
        platform: 1,
        isActive: 1,
        remoteStatus: 1,
        effectiveStatus: 1,
        dailyBudget: 1,
        campaignId: 1,
        campaignBudgetId: 1,
        campaignBudgetResourceName: 1,
        selectedProducts: 1,
        isManualOverride: 1,
        notes: 1,
        lastOperatorActivityAt: 1,
        bottlenecksChecked: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
    ]);

    const campaignsByKey = this.indexBy(campaigns, (row) => this.key(row.customerId, row.campaignId));
    const legacyByAdGroupId = this.indexBy(legacyAdGroups, (row) => this.text(row.adGroupId));
    const metricsByKey = this.groupBy(metrics, (row) => this.key(row.customerId, row.adGroupId));

    return adGroups
      .map((adGroup) => {
        const campaign = campaignsByKey.get(this.key(adGroup.customerId, adGroup.campaignId));
        const legacy = legacyByAdGroupId.get(this.text(adGroup.adGroupId));
        const metricRows = metricsByKey.get(this.key(adGroup.customerId, adGroup.adGroupId)) || [];
        const totals = this.metricTotals(metricRows, {
          now: query.now,
          maxAgeHours: query.maxAgeHours?.ads_performance,
        });
        const productIds = this.unique([
          ...this.stringArray(adGroup.internalProductIds),
          ...this.stringArray(legacy?.selectedProducts),
          this.text(campaign?.internalProductId),
        ]);
        const labels = this.labelsFromLegacyAdGroup(legacy);
        const dataQualityScore = this.dataQualityScore({
          hasMetrics: metricRows.length > 0,
          hasBudgetRef: Boolean(campaign?.campaignBudgetId || campaign?.campaignBudgetResourceName),
          hasProductMapping: productIds.length > 0,
          hasProfit: totals.profitEvidence.status === 'fresh',
        });

        return {
          platform: this.text(legacy?.platform) || 'google',
          customerId: this.text(adGroup.customerId),
          accountId: this.text(adGroup.customerId),
          campaignId: this.text(adGroup.campaignId),
          campaignName: this.text(campaign?.campaignName),
          adGroupId: this.text(adGroup.adGroupId),
          adGroupName: this.text(adGroup.adGroupName || legacy?.name),
          resourceName: this.text(adGroup.resourceName),
          campaignBudgetId: this.text(campaign?.campaignBudgetId),
          campaignBudgetResourceName: this.text(campaign?.campaignBudgetResourceName),
          currentStatus: this.text(legacy?.effectiveStatus || legacy?.remoteStatus || adGroup.status || campaign?.status),
          currentBudgetVnd: this.numberOrUndefined(legacy?.dailyBudget),
          spendVnd: totals.spendVnd,
          clicks: totals.clicks,
          impressions: totals.impressions,
          conversions: totals.conversions,
          conversionValueVnd: totals.conversionValueVnd,
          orders: totals.orders,
          revenueVnd: totals.revenueVnd,
          grossProfitVnd: totals.grossProfitVnd,
          netProfitAfterAdsVnd: totals.netProfitAfterAdsVnd,
          returnRatePercent: totals.returnRatePercent,
          dataQualityScore,
          labels,
          productIds,
          internalProductIds: productIds,
          bottlenecksChecked: this.booleanOrUndefined(legacy?.bottlenecksChecked),
          lastSyncAt: this.latestDate([adGroup, campaign, legacy, ...metricRows]),
          updatedAt: this.latestDate([adGroup, campaign, legacy, ...metricRows], ['updatedAt']),
          createdAt: this.latestDate([adGroup, campaign, legacy, ...metricRows], ['createdAt']),
        };
      })
      .filter((row) => this.matchesProductQuery(row.productIds, query.productIds));
  }

  async findCampaignBudgetRows(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationCampaignBudgetReadRow[]> {
    return (await this.readMany(COLLECTIONS.campaignBudgets, this.customerFilter(query), {
      customerId: 1,
      accountId: 1,
      campaignBudgetId: 1,
      resourceName: 1,
      campaignBudgetResourceName: 1,
      amountVnd: 1,
      amountMicros: 1,
      status: 1,
      lastSyncAt: 1,
      updatedAt: 1,
      createdAt: 1,
    })).map((row) => ({
      customerId: this.text(row.customerId),
      accountId: this.text(row.accountId || row.customerId),
      campaignBudgetId: this.text(row.campaignBudgetId),
      resourceName: this.text(row.resourceName),
      campaignBudgetResourceName: this.text(row.campaignBudgetResourceName || row.resourceName),
      amountVnd: this.numberOrUndefined(row.amountVnd),
      amountMicros: this.numberOrUndefined(row.amountMicros),
      status: this.text(row.status),
      lastSyncAt: this.dateLike(row.lastSyncAt),
      updatedAt: this.dateLike(row.updatedAt),
      createdAt: this.dateLike(row.createdAt),
    }));
  }

  async findProductPerformanceRows(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationProductReadRow[]> {
    const window = this.window(query);
    const productFilter = this.productIdFilter('_id', query.productIds);
    const [products, inventory, orders, legacyAdGroups, googleAdGroups, supplierQuotes, purchaseOrders] = await Promise.all([
      this.readMany(COLLECTIONS.products, productFilter, {
        _id: 1,
        sku: 1,
        name: 1,
        productName: 1,
        importPrice: 1,
        shippingCost: 1,
        packagingCost: 1,
        totalCost: 1,
        salePrice: 1,
        minStock: 1,
        maxStock: 1,
        status: 1,
        assumedReturnRatePercent: 1,
        images: 1,
        aiDescription: 1,
        fanpageVariations: 1,
        suppliers: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.inventorySummaries, this.productIdFilter('productId', query.productIds), {
        productId: 1,
        onHand: 1,
        avgCost: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.orders, {
        ...this.productIdFilter('productId', query.productIds),
        orderDate: { $gte: window.fromDate, $lte: window.toDate },
        isActive: { $ne: false },
      }, {
        productId: 1,
        adGroupId: 1,
        quantity: 1,
        orderStatus: 1,
        depositAmount: 1,
        codAmount: 1,
        manualPayment: 1,
        grossProfit: 1,
        netProfit: 1,
        advertisingCost: 1,
        orderDate: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.legacyAdGroups, {}, {
        adGroupId: 1,
        selectedProducts: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.googleAdGroups, {}, {
        adGroupId: 1,
        internalProductIds: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.supplierQuotes, this.productIdFilter('productId', query.productIds), {
        productId: 1,
        supplierId: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.purchaseOrders, {}, {
        supplierId: 1,
        status: 1,
        items: 1,
        expectedDeliveryDate: 1,
        receivedDate: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
    ]);

    const inventoryByProduct = this.indexBy(inventory, (row) => this.id(row.productId));
    const ordersByProduct = this.groupBy(orders, (row) => this.id(row.productId));
    const quoteSuppliersByProduct = this.groupToValues(supplierQuotes, (row) => this.id(row.productId), (row) => this.id(row.supplierId));
    const incomingByProduct = this.incomingByProduct(purchaseOrders);
    const mappedAdGroupsByProduct = this.mappedAdGroupsByProduct(legacyAdGroups, googleAdGroups);

    return products.map((product) => {
      const productId = this.id(product._id || product.productId);
      const productOrders = ordersByProduct.get(productId) || [];
      const orderTotals = this.orderTotals(productOrders);
      const stockAvailable = this.numberOrUndefined(inventoryByProduct.get(productId)?.onHand) ?? 0;
      const reservedQuantity = this.reservedQuantity(productOrders);
      const availableQuantity = Math.max(0, stockAvailable - reservedQuantity);
      const daysOfCover = this.daysOfCover(availableQuantity, orderTotals.quantity, window.days);
      const supplierIds = this.unique([
        ...this.stringArray(product.suppliers?.map((item: MongoRow) => item?.supplierId)),
        ...(quoteSuppliersByProduct.get(productId) || []),
      ]);
      return {
        productId,
        sku: this.text(product.sku),
        name: this.text(product.name || product.productName),
        netProfitVnd: orderTotals.netProfitVnd,
        adAttributedNetProfitAfterAdsVnd: orderTotals.adAttributedNetProfitAfterAdsVnd,
        marginPercent: this.marginPercent(orderTotals.netProfitVnd, orderTotals.revenueVnd, product),
        returnCancelRefundRatePercent: orderTotals.returnCancelRefundRatePercent
          ?? this.numberOrUndefined(product.assumedReturnRatePercent),
        stockAvailable,
        reservedQuantity,
        incomingQuantity: incomingByProduct.get(productId) || 0,
        daysOfCover,
        mediaReady: Array.isArray(product.images) && product.images.length > 0,
        landingReady: this.activeProduct(product),
        offerReady: this.activeProduct(product),
        mappedAdGroupIds: mappedAdGroupsByProduct.get(productId) || [],
        supplierIds,
        lastSyncAt: this.latestDate([product, inventoryByProduct.get(productId), ...productOrders]),
        updatedAt: this.latestDate([product, inventoryByProduct.get(productId), ...productOrders], ['updatedAt']),
        createdAt: this.latestDate([product, inventoryByProduct.get(productId), ...productOrders], ['createdAt']),
      };
    });
  }

  async findSupplierSafetyRows(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationSupplierReadRow[]> {
    const window = this.window(query);
    const [products, quotes, purchaseOrders, payables, statements, orders, users, inventory] = await Promise.all([
      this.readMany(COLLECTIONS.products, this.productIdFilter('_id', query.productIds), {
        _id: 1,
        name: 1,
        importPrice: 1,
        salePrice: 1,
        totalCost: 1,
        estimatedDeliveryDays: 1,
        suppliers: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.supplierQuotes, this.productIdFilter('productId', query.productIds), {
        productId: 1,
        supplierId: 1,
        price: 1,
        status: 1,
        approvalStatus: 1,
        approved: 1,
        isApproved: 1,
        approvedAt: 1,
        approvedBy: 1,
        effectiveAt: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.purchaseOrders, {}, {
        supplierId: 1,
        supplierNameSnap: 1,
        status: 1,
        expectedDeliveryDate: 1,
        receivedDate: 1,
        items: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.supplierPayables, {}, {
        supplierId: 1,
        supplierNameSnap: 1,
        items: 1,
        balance: 1,
        payments: 1,
        status: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.supplierStatements, {}, {
        supplierId: 1,
        status: 1,
        periodTo: 1,
        closingBalance: 1,
        payments: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.orders, {
        ...this.productIdFilter('productId', query.productIds),
        orderDate: { $gte: window.fromDate, $lte: window.toDate },
        isActive: { $ne: false },
      }, {
        productId: 1,
        supplierId: 1,
        quantity: 1,
        orderStatus: 1,
        supplierAppliedPrice: 1,
        grossProfit: 1,
        netProfit: 1,
        orderDate: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.users, {}, {
        _id: 1,
        fullName: 1,
        email: 1,
        role: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
      this.readMany(COLLECTIONS.inventorySummaries, this.productIdFilter('productId', query.productIds), {
        productId: 1,
        onHand: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
    ]);

    const productsById = this.indexBy(products, (row) => this.id(row._id));
    const usersById = this.indexBy(users, (row) => this.id(row._id));
    const inventoryByProduct = this.indexBy(inventory, (row) => this.id(row.productId));
    const quotesByPair = this.groupBy(quotes, (row) => this.key(this.id(row.productId), this.id(row.supplierId)));
    const purchaseOrdersByPair = this.purchaseOrdersByPair(purchaseOrders);
    const ordersByPair = this.groupBy(orders, (row) => this.key(this.id(row.productId), this.id(row.supplierId)));
    const paymentRowsBySupplier = this.paymentRowsBySupplier(payables, statements);
    const pairs = this.supplierProductPairs(products, quotes, purchaseOrders, payables, orders);

    return pairs
      .filter((pair) => this.matchesProductQuery([pair.productId], query.productIds))
      .map((pair) => {
        const product = productsById.get(pair.productId);
        const quoteRows = [...(quotesByPair.get(this.key(pair.productId, pair.supplierId)) || [])]
          .sort((left, right) => this.timestamp(right.effectiveAt || right.createdAt) - this.timestamp(left.effectiveAt || left.createdAt));
        const currentQuote = quoteRows[0];
        const priorQuote = quoteRows[1];
        const pairPurchaseOrders = purchaseOrdersByPair.get(this.key(pair.productId, pair.supplierId)) || [];
        const pairOrders = ordersByPair.get(this.key(pair.productId, pair.supplierId)) || [];
        const paymentFreshnessDays = this.paymentFreshnessDays(paymentRowsBySupplier.get(pair.supplierId) || [], query.now);
        const leadTimeDays = this.averageLeadTimeDays(pairPurchaseOrders)
          ?? this.numberOrUndefined(product?.estimatedDeliveryDays);
        const lateDeliveryRatePercent = this.lateDeliveryRatePercent(pairPurchaseOrders, query.now);
        const returnFaultRatePercent = this.returnFaultRatePercent(pairOrders);
        const currentQuoteVnd = this.numberOrUndefined(currentQuote?.price)
          ?? this.appliedSupplierPrice(product, pair.supplierId);
        const marginAfterCostPercent = this.supplierMarginPercent(product, currentQuoteVnd);
        const stock = this.numberOrUndefined(inventoryByProduct.get(pair.productId)?.onHand) ?? 0;
        const quoteApproved = this.quoteApproved(currentQuote);
        const capacityStatus = this.capacityStatus({
          quoteApproved,
          stock,
          lateDeliveryRatePercent,
        });

        return {
          productId: pair.productId,
          supplierId: pair.supplierId,
          supplierName: this.text(pair.supplierName || usersById.get(pair.supplierId)?.fullName || usersById.get(pair.supplierId)?.email),
          quoteApproved,
          currentQuoteVnd,
          priorQuoteVnd: this.numberOrUndefined(priorQuote?.price),
          marginAfterCostPercent,
          leadTimeDays,
          lateDeliveryRatePercent,
          paymentFreshnessDays,
          capacityStatus,
          returnFaultRatePercent,
          lastSyncAt: this.latestDate([
            product,
            currentQuote,
            priorQuote,
            ...pairPurchaseOrders,
            ...pairOrders,
            ...(paymentRowsBySupplier.get(pair.supplierId) || []),
          ]),
          updatedAt: this.latestDate([product, currentQuote, ...pairPurchaseOrders], ['updatedAt']),
          createdAt: this.latestDate([product, currentQuote, ...pairPurchaseOrders], ['createdAt']),
        };
      });
  }

  async findCashflowPolicyRow(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationCashflowPolicyReadRow | undefined> {
    const [availableFund, capitalAllocation, cashflowSnapshots, settings] = await Promise.all([
      this.readLatest(COLLECTIONS.availableFundSnapshots, {}, {
        available: 1,
        capturedAt: 1,
        updatedAt: 1,
        createdAt: 1,
      }, { capturedAt: -1, updatedAt: -1 }),
      this.readLatest(COLLECTIONS.capitalAllocationSnapshots, {}, {
        date: 1,
        reinvestmentAmount: 1,
        reinvestmentUsed: 1,
        safetyReserveAmount: 1,
        updatedAt: 1,
        createdAt: 1,
      }, { date: -1, updatedAt: -1 }),
      this.readMany(COLLECTIONS.cashflowSummarySnapshots, {}, {
        domain: 1,
        windowDays: 1,
        data: 1,
        updatedAt: 1,
      }),
      this.readMany(COLLECTIONS.systemSettings, {}, {
        key: 1,
        value: 1,
        updatedAt: 1,
        createdAt: 1,
      }),
    ]);

    const settingMap = this.settingsMap(settings);
    const latestPolicySnapshot = cashflowSnapshots
      .filter((row) => ['financial_control', 'finance', 'ads_policy'].includes(this.text(row.domain) || ''))
      .sort((left, right) => this.timestamp(right.updatedAt) - this.timestamp(left.updatedAt))[0];
    const policyData = latestPolicySnapshot?.data || {};
    const capitalAdsCash = this.subtractNonNegative(capitalAllocation?.reinvestmentAmount, capitalAllocation?.reinvestmentUsed);
    const availableAdsCashVnd = this.firstNumber(
      policyData.availableAdsCashVnd,
      policyData.adsBudgetApproved,
      policyData.availableAfterSurvival,
      capitalAdsCash,
      availableFund?.available,
    );

    if (availableAdsCashVnd === undefined && !settings.length && !availableFund && !capitalAllocation && !latestPolicySnapshot) {
      return undefined;
    }

    return {
      availableAdsCashVnd,
      cashflowGatePassed: this.booleanOrUndefined(policyData.cashflowGatePassed)
        ?? this.booleanOrUndefined(policyData.safeToScaleAds)
        ?? Number(availableAdsCashVnd || 0) > 0,
      maxBudgetIncreasePercent: this.firstNumber(
        settingMap.get('max_budget_increase_percent'),
        policyData.maxBudgetIncreasePercent,
        this.upperCapToPercent(settingMap.get('financial_control.UpperCapMultiplier')),
        20,
      ),
      mediumConfidenceIncreasePercent: this.firstNumber(settingMap.get('medium_confidence_increase_percent'), 10),
      minOrdersForScale: this.firstNumber(settingMap.get('min_orders_for_scale'), 5),
      minDataQualityScore: this.firstNumber(settingMap.get('min_data_quality_score'), 0.75),
      minSpendForPauseVnd: this.firstNumber(settingMap.get('min_spend_for_pause_vnd'), 200000),
      maxReturnRatePercent: this.firstNumber(settingMap.get('max_return_rate_percent'), 25),
      minMarginPercent: this.firstNumber(settingMap.get('min_margin_percent'), 20),
      minStockAvailable: this.firstNumber(settingMap.get('min_stock_available'), 10),
      minDaysOfCover: this.firstNumber(settingMap.get('min_days_of_cover'), 7),
      maxSupplierLeadTimeDays: this.firstNumber(settingMap.get('max_supplier_lead_time_days'), 10),
      maxSupplierLateDeliveryRatePercent: this.firstNumber(settingMap.get('max_supplier_late_delivery_rate_percent'), 15),
      maxSupplierReturnFaultRatePercent: this.firstNumber(settingMap.get('max_supplier_return_fault_rate_percent'), 12),
      maxSupplierPaymentFreshnessDays: this.firstNumber(settingMap.get('max_supplier_payment_freshness_days'), 30),
      lastSyncAt: this.latestDate([availableFund, capitalAllocation, latestPolicySnapshot, ...settings]),
      updatedAt: this.latestDate([availableFund, capitalAllocation, latestPolicySnapshot, ...settings], ['updatedAt', 'capturedAt', 'date']),
      createdAt: this.latestDate([availableFund, capitalAllocation, latestPolicySnapshot, ...settings], ['createdAt']),
    };
  }

  async findSourceWatermarks(
    _query?: AdsAutomationDecisionReadModelQuery,
  ): Promise<Partial<Record<AdsAutomationDecisionSourceKey, string | Date>>> {
    const entries = await Promise.all([
      this.latestWatermark('ads_performance', [COLLECTIONS.dailyMetrics, COLLECTIONS.googleAdGroups, COLLECTIONS.campaigns]),
      this.latestWatermark('campaign_budgets', [COLLECTIONS.campaignBudgets]),
      this.latestWatermark('pause_review', [COLLECTIONS.legacyAdGroups, COLLECTIONS.googleAdGroups]),
      this.latestWatermark('product_performance', [COLLECTIONS.products, COLLECTIONS.inventorySummaries, COLLECTIONS.orders]),
      this.latestWatermark('supplier_safety', [
        COLLECTIONS.supplierQuotes,
        COLLECTIONS.purchaseOrders,
        COLLECTIONS.supplierPayables,
        COLLECTIONS.supplierStatements,
      ]),
      this.latestWatermark('cashflow_policy', [
        COLLECTIONS.availableFundSnapshots,
        COLLECTIONS.capitalAllocationSnapshots,
        COLLECTIONS.cashflowSummarySnapshots,
        COLLECTIONS.systemSettings,
      ]),
    ]);
    return entries.reduce((result, [key, value]) => {
      if (value) result[key] = value;
      return result;
    }, {} as Partial<Record<AdsAutomationDecisionSourceKey, string | Date>>);
  }

  private async readMany(
    collectionName: string,
    filter: MongoRow = {},
    projection: MongoRow = {},
    sort?: MongoRow,
    limit?: number,
  ): Promise<MongoRow[]> {
    const cursor = (this.connection.collection(collectionName) as any)
      .find(filter, { projection, sort, limit });
    return cursor.toArray();
  }

  private async readLatest(
    collectionName: string,
    filter: MongoRow,
    projection: MongoRow,
    sort: MongoRow,
  ): Promise<MongoRow | undefined> {
    const rows = await this.readMany(collectionName, filter, projection, sort, 1);
    return rows[0];
  }

  private async latestWatermark(
    sourceKey: AdsAutomationDecisionSourceKey,
    collectionNames: string[],
  ): Promise<[AdsAutomationDecisionSourceKey, string | undefined]> {
    const candidates = await Promise.all(collectionNames.map(async (collectionName) => {
      const rows = await this.readMany(collectionName, {}, {
        lastSyncAt: 1,
        updatedAt: 1,
        createdAt: 1,
        capturedAt: 1,
        date: 1,
        effectiveAt: 1,
        completedAt: 1,
      }, { updatedAt: -1, lastSyncAt: -1, capturedAt: -1, date: -1 }, 1);
      return this.latestDate(rows, ['lastSyncAt', 'updatedAt', 'capturedAt', 'completedAt', 'date', 'effectiveAt', 'createdAt']);
    }));
    const latest = candidates
      .map((value) => this.timestamp(value))
      .filter((value) => value > 0)
      .sort((left, right) => right - left)[0];
    return [sourceKey, latest ? new Date(latest).toISOString() : undefined];
  }

  private window(query: AdsAutomationDecisionReadModelQuery): EvidenceWindow {
    const to = query.evidenceWindow?.to || query.snapshotDate || new Date().toISOString().slice(0, 10);
    const days = Math.max(1, Number(query.evidenceWindow?.days) || 14);
    const from = query.evidenceWindow?.from || this.addDays(to, -(days - 1));
    return {
      from,
      to,
      days,
      fromDate: this.startOfDate(from),
      toDate: this.endOfDate(to),
    };
  }

  private customerFilter(query: AdsAutomationDecisionReadModelQuery): MongoRow {
    const customerIds = this.unique([...(query.customerIds || []), ...(query.accountIds || [])]);
    return customerIds.length ? { customerId: { $in: customerIds } } : {};
  }

  private productIdFilter(field: string, productIds?: string[]): MongoRow {
    const ids = this.unique(productIds || []);
    if (!ids.length) return {};
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    return { [field]: { $in: [...ids, ...objectIds] } };
  }

  private metricTotals(
    rows: MongoRow[],
    options: { now?: string | Date; maxAgeHours?: number } = {},
  ) {
    const spendVnd = this.sum(rows, (row) => this.numberOrUndefined(row.costVnd) ?? this.microsToUnits(row.costMicros));
    const clicks = this.sum(rows, (row) => this.numberOrUndefined(row.clicks));
    const impressions = this.sum(rows, (row) => this.numberOrUndefined(row.impressions));
    const conversions = this.sum(rows, (row) => this.numberOrUndefined(row.conversions));
    const conversionValueVnd = this.sum(rows, (row) => (
      this.numberOrUndefined(row.conversionValueVnd) ?? this.numberOrUndefined(row.conversionValue)
    ));
    const orders = this.sum(rows, (row) => this.numberOrUndefined(row.orders) ?? this.numberOrUndefined(row.conversions));
    const revenueVnd = this.sum(rows, (row) => this.numberOrUndefined(row.revenue));
    const grossProfitVnd = this.sum(rows, (row) => this.numberOrUndefined(row.grossProfit));
    const profitEvidence = assessMetricProfitEvidence(rows, options);
    const netProfitAfterAdsVnd = profitEvidence.total;
    const cancelledOrders = this.sum(rows, (row) => this.numberOrUndefined(row.cancelledOrders));
    return {
      spendVnd,
      clicks,
      impressions,
      conversions,
      conversionValueVnd,
      orders,
      revenueVnd,
      grossProfitVnd,
      netProfitAfterAdsVnd,
      profitEvidence,
      returnRatePercent: orders + cancelledOrders > 0
        ? this.round((cancelledOrders / (orders + cancelledOrders)) * 100, 2)
        : undefined,
    };
  }

  private orderTotals(rows: MongoRow[]) {
    const quantity = this.sum(rows, (row) => this.numberOrUndefined(row.quantity) ?? 1);
    const returned = rows.filter((row) => this.returnOrCancelStatus(row.orderStatus)).length;
    const revenueVnd = this.sum(rows, (row) => (
      this.numberOrUndefined(row.revenue)
      ?? this.sumFields(row, ['depositAmount', 'codAmount', 'manualPayment'])
    ));
    const grossProfitVnd = this.sum(rows, (row) => this.numberOrUndefined(row.grossProfit));
    const netProfitVnd = this.sum(rows, (row) => this.numberOrUndefined(row.netProfit));
    const adAttributedNetProfitAfterAdsVnd = this.sum(
      rows.filter((row) => this.text(row.adGroupId)),
      (row) => this.numberOrUndefined(row.netProfit),
    );
    return {
      quantity,
      revenueVnd,
      grossProfitVnd,
      netProfitVnd,
      adAttributedNetProfitAfterAdsVnd,
      returnCancelRefundRatePercent: rows.length ? this.round((returned / rows.length) * 100, 2) : undefined,
    };
  }

  private mappedAdGroupsByProduct(legacyAdGroups: MongoRow[], googleAdGroups: MongoRow[]): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const row of [...legacyAdGroups, ...googleAdGroups]) {
      const adGroupId = this.text(row.adGroupId);
      if (!adGroupId) continue;
      for (const productId of this.unique([
        ...this.stringArray(row.selectedProducts),
        ...this.stringArray(row.internalProductIds),
      ])) {
        result.set(productId, this.unique([...(result.get(productId) || []), adGroupId]));
      }
    }
    return result;
  }

  private incomingByProduct(purchaseOrders: MongoRow[]): Map<string, number> {
    const result = new Map<string, number>();
    for (const order of purchaseOrders) {
      if (['cancelled', 'received'].includes(this.statusKey(order.status))) continue;
      for (const item of order.items || []) {
        const productId = this.id(item.productId);
        const incoming = Math.max(0, Number(item.quantity || 0) - Number(item.quantityReceived || 0));
        result.set(productId, (result.get(productId) || 0) + incoming);
      }
    }
    return result;
  }

  private purchaseOrdersByPair(purchaseOrders: MongoRow[]): Map<string, MongoRow[]> {
    const result = new Map<string, MongoRow[]>();
    for (const order of purchaseOrders) {
      const supplierId = this.id(order.supplierId);
      for (const item of order.items || []) {
        const key = this.key(this.id(item.productId), supplierId);
        result.set(key, [...(result.get(key) || []), { ...order, item }]);
      }
    }
    return result;
  }

  private paymentRowsBySupplier(payables: MongoRow[], statements: MongoRow[]): Map<string, MongoRow[]> {
    const result = new Map<string, MongoRow[]>();
    for (const payable of payables) {
      const supplierId = this.id(payable.supplierId);
      result.set(supplierId, [
        ...(result.get(supplierId) || []),
        payable,
        ...(payable.payments || []).map((payment: MongoRow) => ({ ...payment, updatedAt: payment.paidAt })),
      ]);
    }
    for (const statement of statements) {
      const supplierId = this.id(statement.supplierId);
      result.set(supplierId, [
        ...(result.get(supplierId) || []),
        statement,
        ...(statement.payments || []).map((payment: MongoRow) => ({ ...payment, updatedAt: payment.paidAt })),
      ]);
    }
    return result;
  }

  private supplierProductPairs(
    products: MongoRow[],
    quotes: MongoRow[],
    purchaseOrders: MongoRow[],
    payables: MongoRow[],
    orders: MongoRow[],
  ): Array<{ productId: string; supplierId: string; supplierName?: string }> {
    const pairs = new Map<string, { productId: string; supplierId: string; supplierName?: string }>();
    const add = (productId: unknown, supplierId: unknown, supplierName?: unknown) => {
      const product = this.id(productId);
      const supplier = this.id(supplierId);
      if (!product || !supplier || product === 'unknown' || supplier === 'unknown') return;
      pairs.set(this.key(product, supplier), { productId: product, supplierId: supplier, supplierName: this.text(supplierName) });
    };
    for (const product of products) {
      for (const supplier of product.suppliers || []) {
        add(product._id, supplier.supplierId);
      }
    }
    for (const quote of quotes) add(quote.productId, quote.supplierId);
    for (const order of purchaseOrders) {
      for (const item of order.items || []) add(item.productId, order.supplierId, order.supplierNameSnap);
    }
    for (const payable of payables) {
      for (const item of payable.items || []) add(item.productId, payable.supplierId, payable.supplierNameSnap);
    }
    for (const order of orders) add(order.productId, order.supplierId);
    return Array.from(pairs.values());
  }

  private labelsFromLegacyAdGroup(row?: MongoRow): string[] {
    const labels = this.stringArray(row?.labels);
    if (row?.isManualOverride === true) labels.push('MANUAL_OVERRIDE');
    const notes = String(row?.notes || '').toUpperCase();
    if (notes.includes('NO_AUTO')) labels.push('NO_AUTO');
    if (notes.includes('BRAND_PROTECTED')) labels.push('BRAND_PROTECTED');
    return this.unique(labels);
  }

  private dataQualityScore(input: {
    hasMetrics: boolean;
    hasBudgetRef: boolean;
    hasProductMapping: boolean;
    hasProfit: boolean;
  }): number {
    let score = 0.55;
    if (input.hasMetrics) score += 0.15;
    if (input.hasBudgetRef) score += 0.1;
    if (input.hasProductMapping) score += 0.1;
    if (input.hasProfit) score += 0.1;
    // Profit is required for a scale decision. Without fresh explicit profit
    // evidence, cap confidence below the default minDataQualityScore (0.75).
    if (!input.hasProfit) score = Math.min(score, 0.7);
    return this.round(Math.min(0.98, score), 2);
  }

  private reservedQuantity(rows: MongoRow[]): number {
    return this.sum(
      rows.filter((row) => !this.finalOrderStatus(row.orderStatus)),
      (row) => this.numberOrUndefined(row.quantity) ?? 1,
    );
  }

  private daysOfCover(availableQuantity: number, soldQuantity: number, days: number): number {
    const velocity = soldQuantity / Math.max(1, days);
    if (velocity <= 0) return availableQuantity > 0 ? 999 : 0;
    return this.round(availableQuantity / velocity, 2);
  }

  private marginPercent(netProfitVnd: number, revenueVnd: number, product: MongoRow): number | undefined {
    if (revenueVnd > 0) return this.round((netProfitVnd / revenueVnd) * 100, 2);
    const salePrice = this.salePrice(product);
    const cost = this.productCost(product);
    return salePrice && cost !== undefined ? this.round(((salePrice - cost) / salePrice) * 100, 2) : undefined;
  }

  private appliedSupplierPrice(product: MongoRow | undefined, supplierId: string): number | undefined {
    const supplier = (product?.suppliers || []).find((item: MongoRow) => this.id(item.supplierId) === supplierId);
    return this.numberOrUndefined(supplier?.appliedPrice ?? supplier?.price1);
  }

  private supplierMarginPercent(product: MongoRow | undefined, currentQuoteVnd?: number): number | undefined {
    const salePrice = this.salePrice(product);
    const quote = currentQuoteVnd ?? this.productCost(product);
    if (!salePrice || quote === undefined) return undefined;
    return this.round(((salePrice - quote) / salePrice) * 100, 2);
  }

  private quoteApproved(quote: MongoRow | undefined): boolean {
    return assessSupplierQuoteApproval(quote).approved;
  }

  private averageLeadTimeDays(purchaseOrders: MongoRow[]): number | undefined {
    const values = purchaseOrders
      .map((order) => {
        const receivedAt = this.timestamp(order.receivedDate);
        const createdAt = this.timestamp(order.createdAt);
        if (!receivedAt || !createdAt) return undefined;
        return Math.max(0, Math.ceil((receivedAt - createdAt) / 86_400_000));
      })
      .filter((value): value is number => value !== undefined);
    return values.length ? this.round(this.sum(values, (value) => value) / values.length, 2) : undefined;
  }

  private lateDeliveryRatePercent(purchaseOrders: MongoRow[], now?: string | Date): number | undefined {
    if (!purchaseOrders.length) return undefined;
    const nowMs = this.timestamp(now) || Date.now();
    const late = purchaseOrders.filter((order) => {
      const expected = this.timestamp(order.expectedDeliveryDate);
      const received = this.timestamp(order.receivedDate);
      if (!expected) return false;
      return received ? received > expected : nowMs > expected;
    }).length;
    return this.round((late / purchaseOrders.length) * 100, 2);
  }

  private returnFaultRatePercent(rows: MongoRow[]): number | undefined {
    if (!rows.length) return undefined;
    const returned = rows.filter((row) => this.returnOrCancelStatus(row.orderStatus)).length;
    return this.round((returned / rows.length) * 100, 2);
  }

  private paymentFreshnessDays(rows: MongoRow[], now?: string | Date): number | undefined {
    const latest = this.timestamp(this.latestDate(rows, ['paidAt', 'updatedAt', 'periodTo', 'createdAt']));
    if (!latest) return undefined;
    const nowMs = this.timestamp(now) || Date.now();
    return Math.max(0, Math.floor((nowMs - latest) / 86_400_000));
  }

  private capacityStatus(input: {
    quoteApproved: boolean;
    stock: number;
    lateDeliveryRatePercent?: number;
  }): string {
    if (!input.quoteApproved) return 'blocked';
    if (input.stock <= 0 || Number(input.lateDeliveryRatePercent || 0) >= 30) return 'blocked';
    if (input.stock < 10 || Number(input.lateDeliveryRatePercent || 0) >= 15) return 'constrained';
    return 'available';
  }

  private settingsMap(rows: MongoRow[]): Map<string, unknown> {
    const result = new Map<string, unknown>();
    for (const row of rows) {
      const key = this.text(row.key);
      if (!key) continue;
      const value = row.value && typeof row.value === 'object' && 'value' in row.value
        ? row.value.value
        : row.value;
      result.set(key, value);
      if (key === 'financial_control' && value && typeof value === 'object') {
        for (const [nestedKey, nestedValue] of Object.entries(value as MongoRow)) {
          result.set(`financial_control.${nestedKey}`, nestedValue);
        }
      }
    }
    return result;
  }

  private upperCapToPercent(value: unknown): number | undefined {
    const numberValue = this.numberOrUndefined(value);
    if (numberValue === undefined) return undefined;
    return this.round(Math.max(0, numberValue - 1) * 100, 2);
  }

  private activeProduct(product: MongoRow): boolean {
    const status = this.statusKey(product.status);
    return !['paused', 'inactive', 'ngungban', 'tamdung'].includes(status);
  }

  private finalOrderStatus(value: unknown): boolean {
    const status = this.statusKey(value);
    return ['completed', 'delivered', 'returned', 'cancelled', 'canceled', 'boom', 'giao', 'giaothanhcong', 'hoan', 'huy'].some((key) => status.includes(key));
  }

  private returnOrCancelStatus(value: unknown): boolean {
    const status = this.statusKey(value);
    return ['returned', 'return', 'cancelled', 'canceled', 'boom', 'hoan', 'huy'].some((key) => status.includes(key));
  }

  private statusKey(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '')
      .toLowerCase();
  }

  private salePrice(product?: MongoRow): number | undefined {
    const direct = this.numberOrUndefined(product?.salePrice || product?.price);
    if (direct !== undefined) return direct;
    const variations = this.array(product?.fanpageVariations);
    return this.numberOrUndefined(variations.find((item) => item?.customPrice)?.customPrice);
  }

  private productCost(product?: MongoRow): number | undefined {
    return this.firstNumber(
      product?.totalCost,
      this.sumFields(product || {}, ['importPrice', 'shippingCost', 'packagingCost']),
      product?.importPrice,
    );
  }

  private matchesProductQuery(rowProductIds: string[] | undefined, queryProductIds?: string[]): boolean {
    if (!queryProductIds?.length) return true;
    const wanted = new Set(queryProductIds.map((id) => String(id)));
    return (rowProductIds || []).some((productId) => wanted.has(String(productId)));
  }

  private indexBy(rows: MongoRow[], keyFn: (row: MongoRow) => string | undefined): Map<string, MongoRow> {
    const result = new Map<string, MongoRow>();
    for (const row of rows) {
      const key = keyFn(row);
      if (key) result.set(key, row);
    }
    return result;
  }

  private groupBy(rows: MongoRow[], keyFn: (row: MongoRow) => string): Map<string, MongoRow[]> {
    const result = new Map<string, MongoRow[]>();
    for (const row of rows) {
      const key = keyFn(row);
      result.set(key, [...(result.get(key) || []), row]);
    }
    return result;
  }

  private groupToValues(
    rows: MongoRow[],
    keyFn: (row: MongoRow) => string,
    valueFn: (row: MongoRow) => string,
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const row of rows) {
      const key = keyFn(row);
      const value = valueFn(row);
      if (!value || value === 'unknown') continue;
      result.set(key, this.unique([...(result.get(key) || []), value]));
    }
    return result;
  }

  private key(left: unknown, right: unknown): string {
    return `${this.text(left) || 'unknown'}:${this.text(right) || 'unknown'}`;
  }

  private id(value: unknown): string {
    if (value === undefined || value === null || value === '') return 'unknown';
    return String(value);
  }

  private text(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    return text ? text : undefined;
  }

  private stringArray(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values.map((value) => this.text(value)).filter((value): value is string => Boolean(value));
  }

  private array(values: unknown): MongoRow[] {
    return Array.isArray(values) ? values : [];
  }

  private numberOrUndefined(value: unknown): number | undefined {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private firstNumber(...values: unknown[]): number | undefined {
    for (const value of values) {
      const numberValue = this.numberOrUndefined(value);
      if (numberValue !== undefined) return numberValue;
    }
    return undefined;
  }

  private booleanOrUndefined(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  private microsToUnits(value: unknown): number | undefined {
    const micros = this.numberOrUndefined(value);
    return micros === undefined ? undefined : micros / 1_000_000;
  }

  private sum<T>(rows: T[], valueFn: (row: T) => number | undefined): number {
    return rows.reduce((total, row) => total + (valueFn(row) || 0), 0);
  }

  private sumFields(row: MongoRow, fields: string[]): number {
    return fields.reduce((total, field) => total + (this.numberOrUndefined(row?.[field]) || 0), 0);
  }

  private subtractNonNegative(left: unknown, right: unknown): number | undefined {
    const leftNumber = this.numberOrUndefined(left);
    if (leftNumber === undefined) return undefined;
    return Math.max(0, leftNumber - (this.numberOrUndefined(right) || 0));
  }

  private unique(values: Array<string | undefined>): string[] {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value && value !== 'unknown'))));
  }

  private latestDate(rows: Array<MongoRow | undefined>, fields = ['lastSyncAt', 'updatedAt', 'createdAt']): string | undefined {
    const latest = rows
      .filter((row): row is MongoRow => Boolean(row))
      .flatMap((row) => fields.map((field) => row[field]))
      .map((value) => this.timestamp(value))
      .filter((value) => value > 0)
      .sort((left, right) => right - left)[0];
    return latest ? new Date(latest).toISOString() : undefined;
  }

  private dateLike(value: unknown): string | Date | undefined {
    return value instanceof Date || typeof value === 'string' ? value : undefined;
  }

  private timestamp(value: unknown): number {
    if (!value) return 0;
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
    const text = String(value);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? new Date(`${text}T00:00:00.000Z`)
      : new Date(text);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }

  private startOfDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private endOfDate(value: string): Date {
    return new Date(`${value}T23:59:59.999Z`);
  }

  private addDays(value: string, days: number): string {
    const date = this.startOfDate(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
