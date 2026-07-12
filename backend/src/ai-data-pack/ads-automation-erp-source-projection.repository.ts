import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { AdGroup } from "../ad-group/schemas/ad-group.schema";
import { AdvertisingCost } from "../advertising-cost/schemas/advertising-cost.schema";
import { AvailableFundSnapshot } from "../finance/schemas/available-fund-snapshot.schema";
import { CashflowSummarySnapshot } from "../finance/schemas/cashflow-summary-snapshot.schema";
import { InventorySummary } from "../inventory/schemas/inventory-summary.schema";
import { Product } from "../product/schemas/product.schema";
import { SupplierPayable } from "../supplier-payable/schemas/supplier-payable.schema";
import { SupplierQuote } from "../supplier-quote/schemas/supplier-quote.schema";
import { TestOrder2 } from "../test-order2/schemas/test-order2.schema";
import { User } from "../user/user.schema";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import type { AdsAutomationDecisionReadModelQuery } from "./contracts/ads-automation-decision-read-model-query.contract";
import type {
  AdsAutomationDecisionErpSourceAdapterInput,
  AdsAutomationDecisionSourceAdapterResult,
  AdsAutomationDecisionSourceKey,
  AdsAutomationSourceStampedRow,
} from "./contracts/ads-automation-decision-source-adapter.contract";

type MongoRow = Record<string, any>;
type MongoFilter = Record<string, any>;
type MongoProjection = Record<string, 0 | 1>;

interface EvidenceWindow {
  from: string;
  to: string;
  days: number;
  fromDate: Date;
  toDate: Date;
}

@Injectable()
export class AdsAutomationErpSourceProjectionRepository {
  constructor(
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<any>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<any>,
    @InjectModel(AdvertisingCost.name)
    private readonly advertisingCostModel: Model<any>,
    @InjectModel(Product.name)
    private readonly productModel: Model<any>,
    @InjectModel(InventorySummary.name)
    private readonly inventorySummaryModel: Model<any>,
    @InjectModel(SupplierQuote.name)
    private readonly supplierQuoteModel: Model<any>,
    @InjectModel(SupplierPayable.name)
    private readonly supplierPayableModel: Model<any>,
    @InjectModel(User.name)
    private readonly userModel: Model<any>,
    @InjectModel(AvailableFundSnapshot.name)
    private readonly availableFundSnapshotModel: Model<any>,
    @InjectModel(CashflowSummarySnapshot.name)
    private readonly cashflowSummarySnapshotModel: Model<any>,
    private readonly adapter: AdsAutomationDecisionSourceAdapterService,
  ) {}

  async buildAdapterInput(
    query: AdsAutomationDecisionReadModelQuery = {},
  ): Promise<AdsAutomationDecisionErpSourceAdapterInput> {
    const window = this.window(query);
    const [
      adGroups,
      advertisingCosts,
      orders,
      products,
      inventorySummaries,
      supplierQuotes,
      supplierPayables,
      suppliers,
      availableFundSnapshots,
      cashflowSummarySnapshots,
    ] = await Promise.all([
      this.readMany(
        this.adGroupModel,
        this.adGroupFilter(query),
        AD_GROUP_PROJECTION,
      ),
      this.readMany(
        this.advertisingCostModel,
        this.advertisingCostFilter(query, window),
        ADVERTISING_COST_PROJECTION,
        { sort: { date: -1, updatedAt: -1 } },
      ),
      this.readMany(
        this.orderModel,
        this.orderFilter(query, window),
        ORDER_PROJECTION,
        { sort: { orderDate: -1, updatedAt: -1 } },
      ),
      this.readMany(
        this.productModel,
        this.productFilter("_id", query.productIds),
        PRODUCT_PROJECTION,
      ),
      this.readMany(
        this.inventorySummaryModel,
        this.productFilter("productId", query.productIds),
        INVENTORY_SUMMARY_PROJECTION,
      ),
      this.readMany(
        this.supplierQuoteModel,
        {
          ...this.productFilter("productId", query.productIds),
          approvalStatus: "approved",
        },
        SUPPLIER_QUOTE_PROJECTION,
        { sort: { effectiveAt: -1, updatedAt: -1, createdAt: -1 } },
      ),
      this.readMany(
        this.supplierPayableModel,
        {},
        SUPPLIER_PAYABLE_PROJECTION,
        { sort: { dueDate: -1, updatedAt: -1 } },
      ),
      this.readMany(
        this.userModel,
        SUPPLIER_USER_FILTER,
        SUPPLIER_USER_PROJECTION,
      ),
      this.readMany(
        this.availableFundSnapshotModel,
        {},
        AVAILABLE_FUND_SNAPSHOT_PROJECTION,
        { sort: { capturedAt: -1, updatedAt: -1 }, limit: 8 },
      ),
      this.readMany(
        this.cashflowSummarySnapshotModel,
        {},
        CASHFLOW_SUMMARY_SNAPSHOT_PROJECTION,
        { sort: { updatedAt: -1 } },
      ),
    ]);

    const input: AdsAutomationDecisionErpSourceAdapterInput = {
      snapshotDate: query.snapshotDate,
      evidenceWindow: query.evidenceWindow,
      adGroups: adGroups.map((row) => this.projectAdGroup(row)),
      advertisingCosts: advertisingCosts.map((row) =>
        this.projectAdvertisingCost(row),
      ),
      orders: orders.map((row) => this.projectOrder(row)),
      products: products.map((row) => this.projectProduct(row)),
      inventorySummaries: inventorySummaries.map((row) =>
        this.projectInventorySummary(row),
      ),
      supplierQuotes: supplierQuotes.map((row) =>
        this.projectSupplierQuote(row),
      ),
      supplierPayables: supplierPayables.map((row) =>
        this.projectSupplierPayable(row),
      ),
      suppliers: suppliers.map((row) => this.projectSupplier(row)),
      availableFundSnapshots: availableFundSnapshots.map((row) =>
        this.projectAvailableFundSnapshot(row),
      ),
      cashflowSummarySnapshots: cashflowSummarySnapshots.map((row) =>
        this.projectCashflowSummarySnapshot(row),
      ),
    };

    input.sourceWatermarks = this.sourceWatermarks(input);
    return input;
  }

  async buildDecisionSource(
    query: AdsAutomationDecisionReadModelQuery = {},
  ): Promise<AdsAutomationDecisionSourceAdapterResult> {
    const input = await this.buildAdapterInput(query);
    return this.adapter.buildFromErpRecords(input, {
      snapshotDate: query.snapshotDate,
      evidenceWindow: query.evidenceWindow,
      now: query.now,
      maxAgeHours: query.maxAgeHours,
    });
  }

  private async readMany(
    model: Model<any>,
    filter: MongoFilter,
    projection: MongoProjection,
    options: { sort?: MongoFilter; limit?: number } = {},
  ): Promise<MongoRow[]> {
    let request: any = model.find(filter, projection);
    if (options.sort && typeof request.sort === "function") {
      request = request.sort(options.sort);
    }
    if (options.limit && typeof request.limit === "function") {
      request = request.limit(options.limit);
    }
    if (typeof request.lean === "function") {
      request = request.lean();
    }
    const rows =
      typeof request.exec === "function" ? await request.exec() : await request;
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => this.toPlainRow(row));
  }

  private projectAdGroup(row: MongoRow) {
    return {
      _id: row._id,
      platform: row.platform,
      adAccountId: row.adAccountId,
      accountId: row.accountId,
      customerId: row.customerId,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      adGroupId: row.adGroupId,
      name: row.name,
      adGroupName: row.adGroupName,
      resourceName: row.resourceName,
      campaignBudgetId: row.campaignBudgetId,
      campaignBudgetResourceName: row.campaignBudgetResourceName,
      dailyBudget: row.dailyBudget,
      currentBudgetVnd: row.currentBudgetVnd,
      remoteStatus: row.remoteStatus,
      effectiveStatus: row.effectiveStatus,
      status: row.status,
      isActive: row.isActive,
      selectedProducts: row.selectedProducts,
      internalProductIds: row.internalProductIds,
      productIds: row.productIds,
      labels: row.labels,
      isManualOverride: row.isManualOverride,
      notes: row.notes,
      bottlenecksChecked: row.bottlenecksChecked,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectAdvertisingCost(row: MongoRow) {
    return {
      _id: row._id,
      channel: row.channel,
      platform: row.platform || row.channel,
      date: row.date,
      adGroupId: row.adGroupId,
      customerId: row.customerId,
      accountId: row.accountId || row.customerId || row.businessCenterId,
      spentAmount: row.spentAmount,
      spendVnd: row.spendVnd,
      costVnd: row.costVnd,
      clicks: row.clicks,
      impressions: row.impressions,
      conversions: row.conversions,
      allConversions: row.allConversions,
      conversionValue: row.conversionValue,
      conversionValueVnd: row.conversionValueVnd,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectOrder(row: MongoRow) {
    return {
      _id: row._id,
      id: row.id,
      productId: row.productId,
      items: row.items,
      quantity: row.quantity,
      adGroupId: row.adGroupId,
      supplierId: row.supplierId,
      orderDate: row.orderDate,
      orderStatus: row.orderStatus,
      isActive: row.isActive,
      depositAmount: row.depositAmount,
      codAmount: row.codAmount,
      manualPayment: row.manualPayment,
      revenueVnd: row.revenueVnd,
      revenue: row.revenue,
      grossProfit: row.grossProfit,
      grossProfitVnd: row.grossProfitVnd,
      netProfit: row.netProfit,
      netProfitVnd: row.netProfitVnd,
      advertisingCost: row.advertisingCost,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectProduct(row: MongoRow) {
    return {
      _id: row._id,
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      productName: row.productName,
      salePrice: row.salePrice,
      price: row.price,
      importPrice: row.importPrice,
      shippingCost: row.shippingCost,
      packagingCost: row.packagingCost,
      totalCost: row.totalCost,
      minStock: row.minStock,
      maxStock: row.maxStock,
      estimatedDeliveryDays: row.estimatedDeliveryDays,
      status: row.status,
      assumedReturnRatePercent: row.assumedReturnRatePercent,
      images: row.images,
      aiDescription: row.aiDescription,
      fanpageVariations: row.fanpageVariations,
      suppliers: row.suppliers,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectInventorySummary(row: MongoRow) {
    return {
      productId: row.productId,
      onHand: row.onHand,
      avgCost: row.avgCost,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectSupplierQuote(row: MongoRow) {
    return {
      productId: row.productId,
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      price: row.price,
      status: row.status,
      approvalStatus: row.approvalStatus,
      effectiveAt: row.effectiveAt,
      leadTimeDays: row.leadTimeDays,
      lateDeliveryRatePercent: row.lateDeliveryRatePercent,
      returnFaultRatePercent: row.returnFaultRatePercent,
      capacityStatus: row.capacityStatus,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectSupplierPayable(row: MongoRow) {
    return {
      supplierId: row.supplierId,
      supplierNameSnap: row.supplierNameSnap,
      status: row.status,
      dueDate: row.dueDate,
      items: row.items,
      payments: row.payments,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectSupplier(row: MongoRow) {
    return {
      _id: row._id,
      id: row.id,
      supplierId: row.supplierId,
      fullName: row.fullName,
      name: row.name,
      email: row.email,
      role: row.role,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectAvailableFundSnapshot(row: MongoRow) {
    return {
      capturedAt: row.capturedAt,
      available: row.available,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private projectCashflowSummarySnapshot(row: MongoRow) {
    return {
      domain: row.domain,
      windowDays: row.windowDays,
      data: row.data,
      lastSyncAt: row.lastSyncAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private sourceWatermarks(
    input: AdsAutomationDecisionErpSourceAdapterInput,
  ): Partial<Record<AdsAutomationDecisionSourceKey, string>> {
    return {
      ads_performance: this.latestObservedAt([
        ...(input.adGroups || []),
        ...(input.advertisingCosts || []),
        ...(input.orders || []),
      ]),
      campaign_budgets: this.latestObservedAt(input.adGroups || []),
      pause_review: this.latestObservedAt(input.adGroups || []),
      product_performance: this.latestObservedAt([
        ...(input.products || []),
        ...(input.inventorySummaries || []),
        ...(input.orders || []),
      ]),
      supplier_safety: this.latestObservedAt([
        ...(input.supplierQuotes || []),
        ...(input.supplierPayables || []),
        ...(input.suppliers || []),
      ]),
      cashflow_policy: this.latestObservedAt([
        ...(input.availableFundSnapshots || []),
        ...(input.cashflowSummarySnapshots || []),
      ]),
    };
  }

  private adGroupFilter(
    query: AdsAutomationDecisionReadModelQuery,
  ): MongoFilter {
    const filter: MongoFilter = {};
    const accountIds = this.idsWithObjectIds(query.accountIds || []);
    if (accountIds.length) filter.adAccountId = { $in: accountIds };
    const productIds = this.idsWithObjectIds(query.productIds || []);
    if (productIds.length) {
      filter.$or = [
        { selectedProducts: { $in: productIds } },
        { internalProductIds: { $in: query.productIds } },
        { productIds: { $in: query.productIds } },
      ];
    }
    return filter;
  }

  private advertisingCostFilter(
    query: AdsAutomationDecisionReadModelQuery,
    window: EvidenceWindow,
  ): MongoFilter {
    const filter: MongoFilter = {
      date: { $gte: window.fromDate, $lte: window.toDate },
    };
    const customerIds = this.unique([
      ...(query.customerIds || []),
      ...(query.accountIds || []),
    ]);
    if (customerIds.length) filter.customerId = { $in: customerIds };
    return filter;
  }

  private orderFilter(
    query: AdsAutomationDecisionReadModelQuery,
    window: EvidenceWindow,
  ): MongoFilter {
    return {
      ...this.productFilter("productId", query.productIds),
      orderDate: { $gte: window.fromDate, $lte: window.toDate },
    };
  }

  private productFilter(field: string, productIds?: string[]): MongoFilter {
    const ids = this.idsWithObjectIds(productIds || []);
    return ids.length ? { [field]: { $in: ids } } : {};
  }

  private idsWithObjectIds(ids: string[]): unknown[] {
    return this.unique(ids).flatMap((id) =>
      Types.ObjectId.isValid(id) ? [id, new Types.ObjectId(id)] : [id],
    );
  }

  private window(query: AdsAutomationDecisionReadModelQuery): EvidenceWindow {
    const to =
      query.evidenceWindow?.to ||
      query.snapshotDate ||
      new Date().toISOString().slice(0, 10);
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

  private toPlainRow(row: any): MongoRow {
    if (row && typeof row.toObject === "function") return row.toObject();
    return row || {};
  }

  private latestObservedAt(
    rows: AdsAutomationSourceStampedRow[],
  ): string | undefined {
    const latest = rows
      .flatMap((row) => [
        row.lastSyncAt,
        row.lastSyncedAt,
        row.sourceUpdatedAt,
        row.updatedAt,
        row.createdAt,
      ])
      .map((value) => this.timestamp(value))
      .filter((value) => value > 0)
      .sort((left, right) => right - left)[0];
    return latest ? new Date(latest).toISOString() : undefined;
  }

  private unique(values: string[]): string[] {
    return Array.from(
      new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    );
  }

  private timestamp(value: unknown): number {
    if (!value) return 0;
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value.getTime() : 0;
    }
    const timestamp = new Date(String(value)).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
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
}

const AD_GROUP_PROJECTION: MongoProjection = {
  _id: 1,
  platform: 1,
  adAccountId: 1,
  accountId: 1,
  customerId: 1,
  campaignId: 1,
  campaignName: 1,
  adGroupId: 1,
  name: 1,
  adGroupName: 1,
  resourceName: 1,
  campaignBudgetId: 1,
  campaignBudgetResourceName: 1,
  dailyBudget: 1,
  currentBudgetVnd: 1,
  remoteStatus: 1,
  effectiveStatus: 1,
  status: 1,
  isActive: 1,
  selectedProducts: 1,
  internalProductIds: 1,
  productIds: 1,
  labels: 1,
  isManualOverride: 1,
  notes: 1,
  bottlenecksChecked: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const ADVERTISING_COST_PROJECTION: MongoProjection = {
  _id: 1,
  channel: 1,
  platform: 1,
  date: 1,
  adGroupId: 1,
  customerId: 1,
  accountId: 1,
  businessCenterId: 1,
  spentAmount: 1,
  spendVnd: 1,
  costVnd: 1,
  clicks: 1,
  impressions: 1,
  conversions: 1,
  allConversions: 1,
  conversionValue: 1,
  conversionValueVnd: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const ORDER_PROJECTION: MongoProjection = {
  _id: 1,
  id: 1,
  productId: 1,
  items: 1,
  quantity: 1,
  adGroupId: 1,
  supplierId: 1,
  orderDate: 1,
  orderStatus: 1,
  isActive: 1,
  depositAmount: 1,
  codAmount: 1,
  manualPayment: 1,
  revenueVnd: 1,
  revenue: 1,
  grossProfit: 1,
  grossProfitVnd: 1,
  netProfit: 1,
  netProfitVnd: 1,
  advertisingCost: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const PRODUCT_PROJECTION: MongoProjection = {
  _id: 1,
  productId: 1,
  sku: 1,
  name: 1,
  productName: 1,
  salePrice: 1,
  price: 1,
  importPrice: 1,
  shippingCost: 1,
  packagingCost: 1,
  totalCost: 1,
  minStock: 1,
  maxStock: 1,
  estimatedDeliveryDays: 1,
  status: 1,
  assumedReturnRatePercent: 1,
  images: 1,
  aiDescription: 1,
  fanpageVariations: 1,
  suppliers: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const INVENTORY_SUMMARY_PROJECTION: MongoProjection = {
  productId: 1,
  onHand: 1,
  avgCost: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const SUPPLIER_QUOTE_PROJECTION: MongoProjection = {
  productId: 1,
  supplierId: 1,
  supplierName: 1,
  price: 1,
  status: 1,
  approvalStatus: 1,
  effectiveAt: 1,
  leadTimeDays: 1,
  lateDeliveryRatePercent: 1,
  returnFaultRatePercent: 1,
  capacityStatus: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const SUPPLIER_PAYABLE_PROJECTION: MongoProjection = {
  supplierId: 1,
  supplierNameSnap: 1,
  status: 1,
  dueDate: 1,
  items: 1,
  payments: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const SUPPLIER_USER_FILTER: MongoFilter = {
  role: { $in: ["internal_supplier", "external_supplier"] },
};

const SUPPLIER_USER_PROJECTION: MongoProjection = {
  _id: 1,
  id: 1,
  supplierId: 1,
  fullName: 1,
  name: 1,
  email: 1,
  role: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const AVAILABLE_FUND_SNAPSHOT_PROJECTION: MongoProjection = {
  capturedAt: 1,
  available: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};

const CASHFLOW_SUMMARY_SNAPSHOT_PROJECTION: MongoProjection = {
  domain: 1,
  windowDays: 1,
  data: 1,
  lastSyncAt: 1,
  updatedAt: 1,
  createdAt: 1,
};
