import { createHash } from "crypto";
import { Types } from "mongoose";
import {
  DEMO_PREFIX,
  DIRECTOR_DEMO_ANCHOR_DATE,
  DIRECTOR_DEMO_REPORT_DATE,
} from "./director-demo-seed.config";
import {
  DemoCollectionDocs,
  DirectorDemoDataset,
  DirectorDemoSeedProfileConfig,
  ResetOperation,
} from "./director-demo-seed.types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BCRYPT_DISABLED_PASSWORD =
  "$2a$12$CwTycUXWue0Thq9StjUM0uJ8oC8xF4nM8kH1a5nEteSEFv0qZRY3O";

interface EntityRef {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  role?: string;
  code?: string;
}

interface BuildContext {
  cfg: DirectorDemoSeedProfileConfig;
  now: Date;
  suppliers: EntityRef[];
  agents: EntityRef[];
  employees: EntityRef[];
  lenders: EntityRef[];
  categories: EntityRef[];
  products: Array<EntityRef & {
    categoryId: Types.ObjectId;
    sku: string;
    importPrice: number;
    salePrice: number;
    supplierId: Types.ObjectId;
  }>;
  fanpages: EntityRef[];
  adAccounts: EntityRef[];
  adGroups: Array<EntityRef & {
    adGroupId: string;
    campaignId: string;
    productId: Types.ObjectId;
    categoryId: Types.ObjectId;
    platform: string;
  }>;
  orders: Array<any>;
}

export function generateDirectorDemoDataset(
  cfg: DirectorDemoSeedProfileConfig,
): DirectorDemoDataset {
  const now = new Date(DIRECTOR_DEMO_ANCHOR_DATE);
  const ctx: BuildContext = {
    cfg,
    now,
    suppliers: [],
    agents: [],
    employees: [],
    lenders: [],
    categories: [],
    products: [],
    fanpages: [],
    adAccounts: [],
    adGroups: [],
    orders: [],
  };

  const users = buildUsers(ctx);
  const categories = buildCategories(ctx);
  const products = buildProducts(ctx);
  const supplierQuotes = buildSupplierQuotes(ctx);
  const dealerQuotes = buildDealerQuotes(ctx);
  const purchaseOrders = buildPurchaseOrders(ctx);
  const inventory = buildInventory(ctx, purchaseOrders);
  const ads = buildAds(ctx);
  const orders = buildSalesOrders(ctx);
  const customers = buildCustomers(ctx);
  const leads = buildMarketingLeads(ctx);
  const receivablesPayables = buildReceivablePayableStatements(ctx);
  const finance = buildFinance(ctx);
  const labor = buildLabor(ctx);
  const returns = buildReturns(ctx);
  const operatingCosts = buildOtherCosts(ctx);
  const system = buildSystemSettings(ctx);

  const collections: DemoCollectionDocs[] = [
    c("users", users),
    c("productcategories", categories),
    c("products", products),
    c("supplierquotes", supplierQuotes),
    c("quotes", dealerQuotes),
    c("purchaseorders", purchaseOrders),
    c("inventorybatches", inventory.batches),
    c("inventorytransactions", inventory.transactions),
    c("inventorysummaries", inventory.summaries),
    c("fanpages", ads.fanpages),
    c("adaccounts", ads.adAccounts),
    c("adgroups", ads.legacyAdGroups),
    c("advertisingcosts", ads.advertisingCosts),
    c("ad_group_daily_reports", ads.adGroupDailyReports),
    c("google_ads_campaigns", ads.googleCampaigns),
    c("google_ads_ad_groups", ads.googleAdGroups),
    c("google_ads_keywords", ads.googleKeywords),
    c("google_ads_ads", ads.googleAds),
    c("google_ads_daily_metrics", ads.googleDailyMetrics),
    c("google_ads_sync_runs", ads.googleSyncRuns),
    c("ordertest2", orders),
    c("customers", customers),
    c("marketing_leads", leads),
    c("supplierpayables", receivablesPayables.supplierPayables),
    c("supplierstatements", receivablesPayables.supplierStatements),
    c("agentstatements", receivablesPayables.agentStatements),
    c("fundingsources", finance.fundingSources),
    c("budgetbuckets", finance.budgetBuckets),
    c("loancontracts", finance.loanContracts),
    c("loanrepayments", finance.loanRepayments),
    c("cashflowentries", finance.cashflowEntries),
    c("available_fund_snapshots", finance.availableFundSnapshots),
    c("cashflow_summary_snapshots", finance.cashflowSnapshots),
    c("finance_alert_events", finance.alerts),
    c("laborcost1", labor.entries),
    c("laborstatements", labor.statements),
    c("returnrequests", returns),
    c("othercosts", operatingCosts),
    c("system_settings", system),
  ];

  const counts = summarizeCollections(collections, {
    suppliers_created: ctx.suppliers.length,
    dealers_created: ctx.agents.length,
    products_created: ctx.products.length,
    variants_created: ctx.products.length,
    quotes_created: supplierQuotes.length + dealerQuotes.length,
    orders_created: orders.length,
    payments_created:
      receivablesPayables.supplierPayables.reduce(
        (sum, row) => sum + (row.payments?.length || 0),
        0,
      ) +
      receivablesPayables.agentStatements.reduce(
        (sum, row) => sum + (row.payments?.length || 0),
        0,
      ) +
      finance.cashflowEntries.length,
    loans_created: finance.loanContracts.length,
    workers_created: ctx.employees.length,
    labor_entries_created: labor.entries.length,
    ad_rows_created: ads.googleDailyMetrics.length + ads.advertisingCosts.length,
  });

  const anomalies = expectedDemoAnomalies();
  counts.anomalies_created = anomalies.length;

  return {
    batchId: "DEMO_DIRECTOR_AI_PACK_20260614",
    prefix: DEMO_PREFIX,
    profile: cfg.profile,
    generatedAt: now.toISOString(),
    reportDate: DIRECTOR_DEMO_REPORT_DATE,
    collections,
    counts,
    anomalies,
  };
}

export function summarizeDataset(dataset: DirectorDemoDataset) {
  return {
    profile: dataset.profile,
    batchId: dataset.batchId,
    prefix: dataset.prefix,
    reportDate: dataset.reportDate,
    counts: dataset.counts,
    collections: dataset.collections.map((entry) => ({
      collection: entry.collection,
      docs: entry.docs.length,
    })),
    expectedAiFindings: dataset.anomalies,
  };
}

export function buildResetOperations(
  dataset: DirectorDemoDataset,
): ResetOperation[] {
  return dataset.collections.map((entry) => ({
    collection: entry.collection,
    filter: {
      _id: {
        $in: entry.docs
          .filter((doc) => doc?._id)
          .map((doc) => doc._id),
      },
    },
  }));
}

export function expectedDemoAnomalies(): string[] {
  return [
    "supplier_cost_up_15_percent_without_matching_dealer_price_update",
    "ad_spend_spike_with_lower_lead_volume",
    "cash_gap_next_7_days_from_agent_receivable_delay",
    "overdue_dealer_receivables_for_high_revenue_agent",
    "best_selling_product_low_inventory",
    "labor_overtime_high_without_matching_revenue_growth",
    "negative_margin_product_group",
    "slow_reliability_supplier_with_good_cost",
    "high_sales_late_payment_agent",
    "return_rate_above_policy_for_single_offer",
    "google_ads_cost_present_without_campaign_name_mapping",
    "inventory_movement_without_matching_purchase_order",
  ];
}

function buildUsers(ctx: BuildContext) {
  const users: any[] = [];
  for (let i = 0; i < ctx.cfg.suppliers; i++) {
    const ref = refFor("supplier", i, `DEMO_AIDP28 Supplier ${pad(i)}`);
    ref.email = `demo-aidp28-supplier-${pad(i)}@example.test`;
    ref.role = i % 5 === 0 ? "internal_supplier" : "external_supplier";
    ctx.suppliers.push(ref);
    users.push(userDoc(ref, i, `supplier_type=${supplierType(i)}`));
  }
  for (let i = 0; i < ctx.cfg.agents; i++) {
    const ref = refFor("agent", i, `DEMO_AIDP28 Agent ${pad(i)}`);
    ref.email = `demo-aidp28-agent-${pad(i)}@example.test`;
    ref.role = i % 7 === 0 ? "internal_agent" : "external_agent";
    ctx.agents.push(ref);
    users.push(userDoc(ref, i, `agent_tier=${agentTier(i)} risk=${agentRisk(i)}`));
  }
  for (let i = 0; i < ctx.cfg.employees; i++) {
    const ref = refFor("employee", i, `DEMO_AIDP28 Worker ${pad(i)}`);
    ref.email = `demo-aidp28-worker-${pad(i)}@example.test`;
    ref.role = i % 9 === 0 ? "manager" : "employee";
    ctx.employees.push(ref);
    users.push(userDoc(ref, i, `worker_group=${i % 4}`));
  }
  const lenderCount = Math.max(3, Math.ceil(ctx.cfg.loans / 2));
  for (let i = 0; i < lenderCount; i++) {
    const ref = refFor("lender", i, `DEMO_AIDP28 Lender ${pad(i)}`);
    ref.email = `demo-aidp28-lender-${pad(i)}@example.test`;
    ref.role = "lender";
    ctx.lenders.push(ref);
    users.push(userDoc(ref, i, "synthetic lender"));
  }
  return users;
}

function userDoc(ref: EntityRef, index: number, notes: string) {
  return withTimestamps({
    _id: ref._id,
    fullName: ref.name,
    email: ref.email,
    password: BCRYPT_DISABLED_PASSWORD,
    phone: `0900${String(index).padStart(6, "0")}`,
    role: ref.role,
    address: `Demo Address ${pad(index)}`,
    isActive: true,
    departmentId: `${DEMO_PREFIX}_DEPT_${index % 5}`,
    managerId: "",
    notes: `${DEMO_PREFIX} ${notes}`,
  });
}

function buildCategories(ctx: BuildContext) {
  const baseNames = [
    "Service Card",
    "Basic Service",
    "Premium Service",
    "Product Combo",
    "Accessory",
    "High Margin",
    "Low Margin",
    "High Return",
    "Slow Supply",
  ];
  const docs: any[] = [];
  for (let i = 0; i < ctx.cfg.productGroups; i++) {
    const name = `${DEMO_PREFIX} ${baseNames[i % baseNames.length]} ${pad(i)}`;
    const ref = refFor("category", i, name);
    ref.code = `${DEMO_PREFIX}_CAT_${pad(i)}`;
    ctx.categories.push(ref);
    docs.push(
      withTimestamps({
        _id: ref._id,
        name,
        description: `${DEMO_PREFIX} category for director data pack demo`,
        color: color(i),
        icon: "BOX",
        isActive: true,
        order: i + 1,
        code: ref.code,
        productCount: 0,
        notes: `${DEMO_PREFIX} demo product group`,
      }),
    );
  }
  return docs;
}

function buildProducts(ctx: BuildContext) {
  const docs: any[] = [];
  const duration = [12, 24, 36];
  for (let i = 0; i < ctx.cfg.products; i++) {
    const category = ctx.categories[i % ctx.categories.length];
    const isCardVariant = i < 3;
    const suffix = isCardVariant
      ? `Service Card ${duration[i]}M`
      : `${productFamily(i)} ${pad(i)}`;
    const importPrice = isCardVariant
      ? [110000, 190000, 255000][i]
      : 80000 + ((i * 7300) % 260000);
    const salePrice = Math.round(importPrice * (1.42 + (i % 7) * 0.04));
    const supplier = ctx.suppliers[i % ctx.suppliers.length];
    const ref = refFor("product", i, `${DEMO_PREFIX} ${suffix}`);
    ref.code = `${DEMO_PREFIX}_SKU_${pad(i)}`;
    ctx.products.push({
      ...ref,
      categoryId: category._id,
      sku: ref.code,
      importPrice,
      salePrice,
      supplierId: supplier._id,
    });
    docs.push(
      withTimestamps({
        _id: ref._id,
        name: ref.name,
        categoryId: category._id,
        importPrice,
        shippingCost: 7000 + (i % 5) * 2000,
        packagingCost: 3000 + (i % 4) * 1000,
        minStock: i % 13 === 0 ? 40 : 10,
        maxStock: 500,
        estimatedDeliveryDays: i % 9 === 0 ? 9 : 3 + (i % 4),
        usageDurationMonths: isCardVariant ? duration[i] : duration[i % 3],
        status: "Hoat dong",
        color: color(i),
        notes: isCardVariant
          ? `${DEMO_PREFIX} same_creative_group=DEMO_CARD_TERM separate_price=true`
          : `${DEMO_PREFIX} ${productScenario(i)}`,
        resourceLink: "",
        isReturnable: i % 11 !== 0,
        assumedReturnRatePercent: i % 11 === 0 ? 38 : 8 + (i % 8),
        images: [],
        aiDescription: `${DEMO_PREFIX} synthetic product for Director AI Data Pack`,
        searchKeywords: [DEMO_PREFIX, productFamily(i).toLowerCase()],
        fanpageVariations: [],
        sku: ref.code,
        totalCost: importPrice + 10000,
        suppliers: [
          {
            supplierId: supplier._id,
            price1: importPrice,
            price2: Math.round(importPrice * 0.96),
            price3: Math.round(importPrice * 0.91),
            appliedLevel: 1,
            appliedPrice: importPrice,
            appliedAt: dateDays(ctx, -(i % ctx.cfg.timeRangeDays)),
            priority: 1,
            isDefault: true,
          },
        ],
      }),
    );
  }
  return docs;
}

function buildSupplierQuotes(ctx: BuildContext) {
  const docs: any[] = [];
  for (let i = 0; i < ctx.cfg.supplierQuotes; i++) {
    const product = ctx.products[i % ctx.products.length];
    const supplier = ctx.suppliers[(i * 7) % ctx.suppliers.length];
    const increase = i % 19 === 0 ? 1.18 : i % 11 === 0 ? 0.93 : 1;
    docs.push(
      withTimestamps({
        _id: oid("supplierquote", i),
        productId: product._id,
        supplierId: supplier._id,
        price: Math.round(product.importPrice * increase),
        isReturnableOverride: i % 13 !== 0,
        shippingFee: 5000 + (i % 9) * 1500,
        returnFee: i % 13 === 0 ? 45000 : 12000,
        currency: "VND",
        effectiveAt: dateDays(ctx, -(i % ctx.cfg.timeRangeDays)),
        note: `${DEMO_PREFIX} ${i % 19 === 0 ? "cost_up_15_18_percent" : "supplier_quote"}`,
      }),
    );
  }
  return docs;
}

function buildDealerQuotes(ctx: BuildContext) {
  const docs: any[] = [];
  for (let i = 0; i < ctx.cfg.dealerQuotes; i++) {
    const product = ctx.products[i % ctx.products.length];
    const agent = ctx.agents[(i * 5) % ctx.agents.length];
    const tierDiscount = agentTier((i * 5) % ctx.agents.length) === "vip_agent" ? 0.9 : 1;
    const lowMargin = i % 29 === 0 ? 0.92 : 1;
    docs.push(
      withTimestamps({
        _id: oid("dealerquote", i),
        productId: product._id,
        agentId: agent._id,
        product: product.name,
        agentName: agent.name,
        unitPrice: Math.round(product.salePrice * tierDiscount * lowMargin),
        status: "Da duyet",
        validFrom: dateDays(ctx, -ctx.cfg.timeRangeDays),
        validUntil: dateDays(ctx, 30),
        notes: `${DEMO_PREFIX} tier=${agentTier(i)} ${lowMargin < 1 ? "below_expected_margin" : ""}`,
        isActive: true,
      }),
    );
  }
  return docs;
}

function buildPurchaseOrders(ctx: BuildContext) {
  const docs: any[] = [];
  for (let i = 0; i < ctx.cfg.purchaseOrders; i++) {
    const product = ctx.products[(i * 3) % ctx.products.length];
    const supplier = ctx.suppliers[(i * 5) % ctx.suppliers.length];
    const quantity = 10 + (i % 40);
    const unitPrice = Math.round(product.importPrice * (i % 23 === 0 ? 1.16 : 1));
    const status = i % 17 === 0 ? "partially_received" : i % 31 === 0 ? "cancelled" : "received";
    const itemsTotal = quantity * unitPrice;
    docs.push(
      withTimestamps({
        _id: oid("purchaseorder", i),
        poNumber: `${DEMO_PREFIX}_PO_${pad(i)}`,
        supplierId: supplier._id,
        supplierNameSnap: supplier.name,
        status,
        expectedDeliveryDate: dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 5),
        receivedDate: status === "received" ? dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 8) : null,
        items: [
          {
            productId: product._id,
            productNameSnap: product.name,
            quantity,
            unitPrice,
            currency: "VND",
            quantityReceived: status === "partially_received" ? Math.floor(quantity / 2) : quantity,
            notes: `${DEMO_PREFIX} purchase item`,
          },
        ],
        itemsTotal,
        tax: 0,
        shippingFee: 25000 + (i % 10) * 5000,
        discount: i % 9 === 0 ? 30000 : 0,
        grandTotal: itemsTotal + 25000 + (i % 10) * 5000 - (i % 9 === 0 ? 30000 : 0),
        notes: `${DEMO_PREFIX} ${i % 23 === 0 ? "supplier_cost_increase" : "purchase_order"}`,
      }),
    );
  }
  return docs;
}

function buildInventory(ctx: BuildContext, purchaseOrders: any[]) {
  const batches: any[] = [];
  const transactions: any[] = [];
  const onHand = new Map<string, { product: any; qty: number; cost: number }>();
  for (let i = 0; i < ctx.cfg.inventoryMovements; i++) {
    const product = ctx.products[(i * 11) % ctx.products.length];
    const supplier = ctx.suppliers[(i * 5) % ctx.suppliers.length];
    const po = purchaseOrders[i % purchaseOrders.length];
    const inbound = i % 4 === 0 || i < ctx.products.length;
    const qty = inbound ? 20 + (i % 30) : -(1 + (i % 6));
    const unitCost = Math.round(product.importPrice * (i % 17 === 0 ? 1.15 : 1));
    const current = onHand.get(String(product._id)) || { product, qty: 0, cost: unitCost };
    current.qty = Math.max(0, current.qty + qty);
    current.cost = unitCost;
    onHand.set(String(product._id), current);
    const batchId = oid("inventorybatch", i);
    if (inbound) {
      batches.push(
        withTimestamps({
          _id: batchId,
          productId: product._id,
          source: "purchase",
          supplierId: supplier._id,
          purchaseOrderId: po?._id,
          quantityRemaining: Math.max(0, qty - (i % 5)),
          unitCost,
          receivedAt: dateDays(ctx, -(i % ctx.cfg.timeRangeDays)),
          notes: `${DEMO_PREFIX} inventory batch`,
        }),
      );
    }
    transactions.push(
      withTimestamps({
        _id: oid("inventorytx", i),
        productId: product._id,
        type: inbound ? "receive" : i % 9 === 0 ? "return" : "sale",
        quantity: qty,
        unitCost: inbound ? unitCost : undefined,
        purchaseOrderId: i % 41 === 0 ? oid("missingpurchaseorder", i) : po?._id,
        batchId: inbound ? batchId : undefined,
        supplierId: supplier._id,
        occurredAt: dateDays(ctx, -(i % ctx.cfg.timeRangeDays)),
        notes: `${DEMO_PREFIX} ${
          i % 41 === 0
            ? "inventory_movement_without_matching_purchase_order"
            : i % 37 === 0
              ? "low_stock_watch"
              : "inventory_movement"
        }`,
      }),
    );
  }
  const summaries = Array.from(onHand.values()).map((entry, index) =>
    withTimestamps({
      _id: oid("inventorysummary", index),
      productId: entry.product._id,
      onHand: index % 37 === 0 ? 2 : entry.qty,
      avgCost: entry.cost,
    }),
  );
  return { batches, transactions, summaries };
}

function buildAds(ctx: BuildContext) {
  const fanpages: any[] = [];
  const adAccounts: any[] = [];
  const legacyAdGroups: any[] = [];
  const advertisingCosts: any[] = [];
  const adGroupDailyReports: any[] = [];
  const googleCampaigns: any[] = [];
  const googleAdGroups: any[] = [];
  const googleKeywords: any[] = [];
  const googleAds: any[] = [];
  const googleDailyMetrics: any[] = [];
  const googleSyncRuns: any[] = [];

  for (let i = 0; i < Math.max(2, Math.ceil(ctx.cfg.adAccounts / 2)); i++) {
    const page = refFor("fanpage", i, `${DEMO_PREFIX} Fanpage ${pad(i)}`);
    ctx.fanpages.push(page);
    fanpages.push(
      withTimestamps({
        _id: page._id,
        pageId: `${DEMO_PREFIX}_PAGE_${pad(i)}`,
        name: page.name,
        hasAccessToken: false,
        status: "active",
        connectedAt: dateDays(ctx, -120),
        lastRefreshAt: dateDays(ctx, -1),
        avatarUrl: "",
        defaultProductGroup: ctx.categories[i % ctx.categories.length]._id,
        description: `${DEMO_PREFIX} fake fanpage for demo seed`,
        subscriberCount: 15000 + i * 5000,
        messageQuota: 100000,
        sentThisMonth: 1000 + i * 50,
        subscribedWebhook: false,
        aiEnabled: false,
        timezone: "Asia/Ho_Chi_Minh",
      }),
    );
  }

  for (let i = 0; i < ctx.cfg.adAccounts; i++) {
    const ref = refFor("adaccount", i, `${DEMO_PREFIX} Ad Account ${pad(i)}`);
    ref.code = `28000000${String(i).padStart(2, "0")}`;
    ctx.adAccounts.push(ref);
    adAccounts.push(
      withTimestamps({
        _id: ref._id,
        name: ref.name,
        accountId: ref.code,
        accountType: i % 3 === 0 ? "google" : i % 3 === 1 ? "facebook" : "tiktok",
        managementMode: i % 3 === 0 ? "mcc" : "direct",
        isActive: true,
        notes: `${DEMO_PREFIX} synthetic ad account`,
        currency: "VND",
        timezoneId: "Asia/Ho_Chi_Minh",
        businessName: `${DEMO_PREFIX} Demo Business`,
        spendCap: 150000000,
        amountSpent: 30000000 + i * 1500000,
        lastSyncAt: dateDays(ctx, 0, 7),
        lastSyncStatus: "ok",
        tokenSource: "manual",
        adsManagerUserId: ctx.employees[i % ctx.employees.length]._id,
      }),
    );
  }

  for (let i = 0; i < ctx.cfg.adCampaigns; i++) {
    const customerId = `280${String(i % ctx.cfg.adAccounts).padStart(7, "0")}`;
    const campaignId = `90${String(i).padStart(8, "0")}`;
    googleCampaigns.push(
      withTimestamps({
        _id: oid("googlecampaign", i),
        customerId,
        campaignId,
        resourceName: `customers/${customerId}/campaigns/${campaignId}`,
        campaignName: `${DEMO_PREFIX} Search Campaign ${pad(i)}`,
        status: "PAUSED",
        advertisingChannelType: "SEARCH",
        biddingStrategyType: "MAXIMIZE_CONVERSIONS",
        campaignBudgetId: `77${String(i).padStart(8, "0")}`,
        campaignBudgetResourceName: `customers/${customerId}/campaignBudgets/77${String(i).padStart(8, "0")}`,
        startDate: isoDate(dateDays(ctx, -ctx.cfg.timeRangeDays)),
        internalProductId: String(ctx.products[i % ctx.products.length]._id),
        lastSyncAt: dateDays(ctx, 0, 7),
      }),
    );
  }

  for (let i = 0; i < ctx.cfg.adGroups; i++) {
    const account = ctx.adAccounts[i % ctx.adAccounts.length];
    const product = ctx.products[i % ctx.products.length];
    const category = ctx.categories[i % ctx.categories.length];
    const fanpage = ctx.fanpages[i % ctx.fanpages.length];
    const agent = ctx.agents[i % ctx.agents.length];
    const employee = ctx.employees[i % ctx.employees.length];
    const campaign = googleCampaigns[i % googleCampaigns.length];
    const adGroupId = `910${String(i).padStart(7, "0")}`;
    const ref = refFor("legacyadgroup", i, `${DEMO_PREFIX} Ad Group ${pad(i)}`);
    ctx.adGroups.push({
      ...ref,
      adGroupId,
      campaignId: campaign.campaignId,
      productId: product._id,
      categoryId: category._id,
      platform: "google",
    });
    legacyAdGroups.push(
      withTimestamps({
        _id: ref._id,
        name: ref.name,
        adGroupId,
        fanpageId: fanpage._id,
        productCategoryId: category._id,
        selectedProducts: [product._id],
        agentId: agent._id,
        adAccountId: account._id,
        assignedEmployeeId: employee._id,
        description: `${DEMO_PREFIX} synthetic legacy ad group`,
        platform: "google",
        isActive: true,
        notes: `${DEMO_PREFIX} ${i % 17 === 0 ? "spend_spike_watch" : "ad_group"}`,
        dailyBudget: 500000 + (i % 10) * 100000,
        campaignId: campaign.campaignId,
        campaignBudgetId: `77${String(i % googleCampaigns.length).padStart(8, "0")}`,
        lastSyncAt: dateDays(ctx, 0, 7),
        lastSyncStatus: "ok",
        testingPhase: i % 4 === 0 ? "GROWTH" : "TESTING",
        testingStartDate: dateDays(ctx, -60),
        frequency: 1.3 + (i % 7) * 0.3,
        reach: 2000 + i * 300,
      }),
    );

    googleAdGroups.push(
      withTimestamps({
        _id: oid("googleadgroup", i),
        customerId: campaign.customerId,
        campaignId: campaign.campaignId,
        adGroupId,
        resourceName: `customers/${campaign.customerId}/adGroups/${adGroupId}`,
        adGroupName: ref.name,
        status: i % 11 === 0 ? "PAUSED" : "ENABLED",
        type: "SEARCH_STANDARD",
        cpcBidMicros: 1500000 + i * 10000,
        internalAdGroupId: adGroupId,
        internalProductIds: [String(product._id)],
        lastSyncAt: dateDays(ctx, 0, 7),
      }),
    );
    googleKeywords.push(
      withTimestamps({
        _id: oid("googlekeyword", i),
        customerId: campaign.customerId,
        campaignId: campaign.campaignId,
        adGroupId,
        criterionId: `66${String(i).padStart(8, "0")}`,
        resourceName: `customers/${campaign.customerId}/adGroupCriteria/${adGroupId}~66${String(i).padStart(8, "0")}`,
        keywordText: `${DEMO_PREFIX.toLowerCase()} service ${i}`,
        matchType: i % 3 === 0 ? "EXACT" : i % 3 === 1 ? "PHRASE" : "BROAD",
        negative: false,
        status: "ENABLED",
        qualityScore: 4 + (i % 7),
        lastSyncAt: dateDays(ctx, 0, 7),
      }),
    );
    googleAds.push(
      withTimestamps({
        _id: oid("googlead", i),
        customerId: campaign.customerId,
        campaignId: campaign.campaignId,
        adGroupId,
        adId: `55${String(i).padStart(8, "0")}`,
        resourceName: `customers/${campaign.customerId}/adGroupAds/${adGroupId}~55${String(i).padStart(8, "0")}`,
        adType: "RESPONSIVE_SEARCH_AD",
        status: "ENABLED",
        headlines: [{ text: `${DEMO_PREFIX} offer ${i}` }],
        descriptions: [{ text: `${DEMO_PREFIX} synthetic ad copy` }],
        finalUrls: ["https://example.test/demo-aidp28"],
        creativeAssetId: `${DEMO_PREFIX}_CREATIVE_${pad(i)}`,
        lastSyncAt: dateDays(ctx, 0, 7),
      }),
    );
  }

  for (let i = 0; i < ctx.cfg.dailyAdMetricRows; i++) {
    const adGroup = ctx.adGroups[i % ctx.adGroups.length];
    const campaign = googleCampaigns[i % googleCampaigns.length];
    const day = i % ctx.cfg.timeRangeDays;
    const date = isoDate(dateDays(ctx, -day));
    const spike = i % 137 === 0;
    const cost = spike ? 4200000 : 150000 + (i % 19) * 45000;
    const revenue = i % 23 === 0 ? cost * 0.7 : cost * (1.8 + (i % 5) * 0.25);
    const netProfit = revenue - cost - (i % 17) * 25000;
    googleDailyMetrics.push(
      withTimestamps({
        _id: oid("googlemetric", i),
        date,
        level: "ad_group",
        customerId: campaign.customerId,
        campaignId: campaign.campaignId,
        adGroupId: adGroup.adGroupId,
        resourceName: `customers/${campaign.customerId}/adGroups/${adGroup.adGroupId}`,
        costMicros: cost * 1000000,
        costVnd: cost,
        impressions: 1000 + (i % 4000),
        clicks: 20 + (i % 120),
        ctr: 0.02 + (i % 8) / 1000,
        averageCpc: Math.round(cost / (20 + (i % 120))),
        conversions: i % 23 === 0 ? 1 : 3 + (i % 8),
        allConversions: i % 23 === 0 ? 1 : 4 + (i % 9),
        conversionValue: revenue,
        costPerConversion: cost / Math.max(1, i % 23 === 0 ? 1 : 3 + (i % 8)),
        revenue,
        grossProfit: Math.round(revenue * 0.38),
        netProfit: Math.round(netProfit),
        orders: i % 23 === 0 ? 1 : 2 + (i % 5),
        confirmedOrders: i % 23 === 0 ? 0 : 1 + (i % 5),
        cancelledOrders: i % 23 === 0 ? 2 : i % 4,
        profitPerSpend: cost ? netProfit / cost : 0,
        roas: cost ? revenue / cost : 0,
        lastSyncAt: dateDays(ctx, 0, 7),
      }),
    );
    advertisingCosts.push(
      withTimestamps({
        _id: oid("adcost", i),
        channel: "google",
        date: dateDays(ctx, -day),
        frequency: 1.5 + (i % 8) * 0.2,
        adGroupId: adGroup.adGroupId,
        customerId: campaign.customerId,
        managementMode: "mcc",
        spentAmount: cost,
        cpm: 25000,
        cpc: Math.round(cost / (20 + (i % 120))),
        impressions: 1000 + (i % 4000),
        clicks: 20 + (i % 120),
        conversions: i % 23 === 0 ? 1 : 3 + (i % 8),
        conversionValue: revenue,
        reach: 700 + (i % 2600),
        messagingConversationStarted7d: 5 + (i % 40),
        costPerMessagingConversation: Math.round(cost / (5 + (i % 40))),
        messagingFirstReply: 3 + (i % 30),
      }),
    );
    adGroupDailyReports.push(
      withTimestamps({
        _id: oid("adgroupdaily", i),
        date,
        adGroupId: adGroup.adGroupId,
        adGroupName: adGroup.name,
        platform: "google",
        adsCost: cost,
        netProfit: Math.round(netProfit),
        syncedAt: dateDays(ctx, 0, 7),
      }),
    );
  }
  googleSyncRuns.push(
    withTimestamps({
      _id: oid("googlesyncrun", 0),
      runId: `${DEMO_PREFIX}_SYNC_${DIRECTOR_DEMO_REPORT_DATE}`,
      status: "success",
      startedAt: dateDays(ctx, 0, 6),
      completedAt: dateDays(ctx, 0, 7),
      dateFrom: isoDate(dateDays(ctx, -ctx.cfg.timeRangeDays + 1)),
      dateTo: DIRECTOR_DEMO_REPORT_DATE,
      customerIds: googleCampaigns.slice(0, ctx.cfg.adAccounts).map((row) => row.customerId),
      counts: {
        campaigns: googleCampaigns.length,
        adGroups: googleAdGroups.length,
        metrics: googleDailyMetrics.length,
      },
      syncErrors: [],
    }),
  );

  return {
    fanpages,
    adAccounts,
    legacyAdGroups,
    advertisingCosts,
    adGroupDailyReports,
    googleCampaigns,
    googleAdGroups,
    googleKeywords,
    googleAds,
    googleDailyMetrics,
    googleSyncRuns,
  };
}

function buildSalesOrders(ctx: BuildContext) {
  const docs: any[] = [];
  for (let i = 0; i < ctx.cfg.salesOrders; i++) {
    const product = ctx.products[(i * 13) % ctx.products.length];
    const agent = ctx.agents[(i * 7) % ctx.agents.length];
    const supplier = ctx.suppliers[(i * 5) % ctx.suppliers.length];
    const adGroup = ctx.adGroups[i % ctx.adGroups.length];
    const quantity = 1 + (i % 3);
    const revenue = Math.round(product.salePrice * quantity * (i % 29 === 0 ? 0.82 : 1));
    const cost = Math.round(product.importPrice * quantity * (i % 41 === 0 ? 1.18 : 1));
    const adCost = 25000 + (i % 9) * 9000;
    const laborCost = 12000 + (i % 5) * 3000;
    const otherCost = 5000 + (i % 4) * 2000;
    const grossProfit = revenue - cost;
    const netProfit = grossProfit - adCost - laborCost - otherCost;
    const returned = i % 14 === 0;
    const cancelled = i % 47 === 0;
    const orderDate = dateDays(ctx, -(i % ctx.cfg.timeRangeDays), 10 + (i % 8));
    const doc = withTimestamps({
      _id: oid("order", i),
      productId: product._id,
      productUsageDurationMonths: 12 + (i % 3) * 12,
      customerName: `DEMO Customer ${pad(i)}`,
      quantity,
      agentId: agent._id,
      adGroupId: adGroup.adGroupId,
      isActive: !cancelled,
      productionStatus: cancelled ? "Cancelled" : returned ? "Returned" : "Completed",
      orderStatus: cancelled ? "cancelled" : returned ? "returned" : "completed",
      serviceDetails: `${DEMO_PREFIX} synthetic sales order`,
      trackingNumber: `${DEMO_PREFIX}_TRACK_${pad(i)}`,
      depositAmount: Math.round(revenue * 0.2),
      codAmount: Math.round(revenue * 0.75),
      manualPayment: Math.round(revenue * 0.05),
      shippingFee: 25000,
      returnFee: returned ? 35000 : 0,
      codCollectedBySupplier: returned ? 0 : revenue,
      supplierQuote: cost,
      agentQuoteId: String(oid("dealerquote", i % ctx.cfg.dealerQuotes)),
      agentAppliedPrice: product.salePrice,
      agentQuoteSnapshotAt: orderDate,
      agentPaymentDueDate: dateDays(ctx, 7 - (i % 21)),
      agentQuote: product.salePrice,
      agentCommissionAmount: Math.max(0, Math.round(netProfit * 0.18)),
      productType: product.name.includes("Service Card") ? "service_card" : "demo_product",
      supplierId: supplier._id,
      supplierPriceLevel: 1,
      supplierQuoteId: oid("supplierquote", i % ctx.cfg.supplierQuotes),
      supplierAppliedPrice: cost,
      supplierQuoteSnapshotAt: orderDate,
      supplierShippingFeeSnapshot: 12000,
      supplierReturnFeeSnapshot: returned ? 35000 : 0,
      supplierIsReturnableSnapshot: !returned || i % 28 !== 0,
      grossProfit,
      advertisingCost: adCost,
      laborCostAllocation: laborCost,
      otherCostAllocation: otherCost,
      netProfit,
      realizedGrossProfit: i % 5 === 0 ? undefined : grossProfit,
      realizedNetProfit: i % 5 === 0 ? undefined : netProfit,
      realizedAt: i % 5 === 0 ? undefined : dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 3),
      receiverName: `Demo Receiver ${pad(i)}`,
      receiverPhone: `0901${String(i).padStart(6, "0")}`,
      receiverAddress: `Demo Delivery Address ${pad(i)}`,
      orderDate,
      supplierPaymentStatus: i % 9 === 0 ? "pending" : "paid",
      supplierPaymentBatchId: `${DEMO_PREFIX}_SUP_PAY_${pad(i % 80)}`,
      supplierPaidAt: i % 9 === 0 ? undefined : dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 4),
      supplierPaidAmount: returned ? -Math.abs(grossProfit) : grossProfit,
      supplierPaymentNote: `${DEMO_PREFIX} supplier settlement`,
      supplierPaymentAttachments: [],
      agentPaymentStatus: i % 11 === 0 ? "pending" : "paid",
      agentPaymentBatchId: `${DEMO_PREFIX}_AG_PAY_${pad(i % 90)}`,
      agentPaidAt: i % 11 === 0 ? undefined : dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 6),
      agentPaidAmount: Math.max(0, Math.round(netProfit * 0.18)),
      agentPaymentNote: `${DEMO_PREFIX} agent commission`,
      agentPaymentAttachments: [],
      agentEligibleAt: dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 1),
      agentCommissionFinal: Math.max(0, Math.round(netProfit * 0.18)),
      confirmOverThreshold: revenue > 5000000,
      confirmedBy: revenue > 5000000 ? `${DEMO_PREFIX}_director` : undefined,
      confirmedAt: revenue > 5000000 ? dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 1) : undefined,
    });
    docs.push(doc);
    ctx.orders.push(doc);
  }
  return docs;
}

function buildCustomers(ctx: BuildContext) {
  const docs: any[] = [];
  for (let i = 0; i < ctx.cfg.customers; i++) {
    const order = ctx.orders[i % ctx.orders.length];
    const product = ctx.products[(i * 13) % ctx.products.length];
    docs.push(
      withTimestamps({
        _id: oid("customer", i),
        customerName: `DEMO Customer ${pad(i)}`,
        phoneNumber: `0902${String(i).padStart(6, "0")}`,
        address: `Demo Customer Address ${pad(i)}`,
        productId: product._id,
        latestPurchaseDate: order?.orderDate || dateDays(ctx, -1),
        usageDurationMonths: product.name.includes("36M") ? 36 : product.name.includes("24M") ? 24 : 12,
        remainingDays: 30 + (i % 900),
        isDisabled: false,
        notes: `${DEMO_PREFIX} customer record`,
        latestOrderId: order?._id,
        lastCalculated: dateDays(ctx, 0, 8),
      }),
    );
  }
  return docs;
}

function buildMarketingLeads(ctx: BuildContext) {
  const docs: any[] = [];
  const statuses = ["new", "contacted", "qualified", "quoted", "won", "lost", "no_response"];
  for (let i = 0; i < ctx.cfg.leadRows; i++) {
    const adGroup = ctx.adGroups[i % ctx.adGroups.length];
    const order = ctx.orders[i % ctx.orders.length];
    const employee = ctx.employees[i % ctx.employees.length];
    const slow = i % 23 === 0;
    docs.push(
      withTimestamps({
        _id: oid("lead", i),
        sourceLeadKey: `${DEMO_PREFIX}_LEAD_${pad(i)}`,
        sourcePlatform: adGroup.platform,
        leadCreatedAt: dateDays(ctx, -(i % ctx.cfg.timeRangeDays), 9),
        adAccountId: String(ctx.adAccounts[i % ctx.adAccounts.length].code),
        campaignId: adGroup.campaignId,
        adSetId: adGroup.adGroupId,
        adId: `55${String(i % ctx.cfg.adGroups).padStart(8, "0")}`,
        adGroupId: adGroup.adGroupId,
        creativeId: `${DEMO_PREFIX}_CREATIVE_${pad(i % ctx.cfg.adGroups)}`,
        customerId: oid("customer", i % ctx.cfg.customers),
        customerName: `DEMO Customer ${pad(i % ctx.cfg.customers)}`,
        phone: `0903${String(i).padStart(6, "0")}`,
        conversationId: `${DEMO_PREFIX}_CONV_${pad(i)}`,
        senderPsid: `${DEMO_PREFIX}_PSID_${pad(i)}`,
        assignedSaleId: employee._id,
        status: slow ? "no_response" : statuses[i % statuses.length],
        firstResponseAt: slow ? dateDays(ctx, -(i % ctx.cfg.timeRangeDays), 18) : dateDays(ctx, -(i % ctx.cfg.timeRangeDays), 10),
        lastFollowUpAt: dateDays(ctx, -(i % ctx.cfg.timeRangeDays), 16),
        responseSlaSeconds: slow ? 8 * 3600 : 600 + (i % 1200),
        qualificationReason: slow ? "slow_response" : "demo qualified",
        lostReason: i % 19 === 0 ? "price_objection" : undefined,
        orderId: i % 5 === 0 ? undefined : order?._id,
        revenue: order ? order.depositAmount + order.codAmount + order.manualPayment : 0,
        grossProfit: order?.grossProfit || 0,
        netProfit: order?.netProfit || 0,
        raw: { source: "synthetic_seed", prefix: DEMO_PREFIX },
      }),
    );
  }
  return docs;
}

function buildReceivablePayableStatements(ctx: BuildContext) {
  const supplierPayables: any[] = [];
  const supplierStatements: any[] = [];
  const agentStatements: any[] = [];
  const statementCount = Math.max(12, Math.ceil(ctx.cfg.timeRangeDays / 15));

  for (let i = 0; i < Math.min(ctx.cfg.salesOrders, ctx.suppliers.length * 10); i++) {
    const order = ctx.orders[i % ctx.orders.length];
    const supplier = ctx.suppliers[i % ctx.suppliers.length];
    const totalAmount = Math.max(0, order.grossProfit || 0);
    const paid = i % 8 !== 0;
    supplierPayables.push(
      withTimestamps({
        _id: oid("supplierpayable", i),
        supplierId: supplier._id,
        supplierNameSnap: supplier.name,
        orderId: order._id,
        status: paid ? "paid" : "partial",
        items: [
          {
            productId: order.productId,
            productNameSnap: `${DEMO_PREFIX} order item`,
            quantity: order.quantity,
            unitPrice: order.supplierAppliedPrice,
            amount: totalAmount,
          },
        ],
        totalAmount,
        amountPaid: paid ? totalAmount : Math.round(totalAmount * 0.35),
        balance: paid ? 0 : Math.round(totalAmount * 0.65),
        currency: "VND",
        dueDate: dateDays(ctx, 2 - (i % 21)),
        notes: `${DEMO_PREFIX} supplier settlement ${paid ? "paid" : "overdue"}`,
        payments: paid
          ? [
              {
                amount: totalAmount,
                paidAt: dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 4),
                method: "bank_transfer",
                reference: `${DEMO_PREFIX}_SUPPAY_${pad(i)}`,
                notes: `${DEMO_PREFIX} supplier paid demo`,
                createdBy: "synthetic_seed",
              },
            ]
          : [],
      }),
    );
  }

  for (let i = 0; i < Math.min(ctx.suppliers.length * statementCount, ctx.cfg.suppliers * 14); i++) {
    const supplier = ctx.suppliers[i % ctx.suppliers.length];
    const periodTo = dateDays(ctx, -(i % statementCount) * 15);
    const periodFrom = new Date(periodTo.getTime() - 14 * MS_PER_DAY);
    const periodPayables = 1500000 + (i % 11) * 320000;
    const payments = i % 5 === 0 ? Math.round(periodPayables * 0.4) : periodPayables;
    supplierStatements.push(
      withTimestamps({
        _id: oid("supplierstatement", i),
        supplierId: supplier._id,
        periodFrom,
        periodTo,
        status: payments >= periodPayables ? "closed" : "open",
        openingBalance: i % 5 === 0 ? 600000 : 0,
        periodPayables,
        periodPayments: payments,
        periodCodCollected: periodPayables * 3,
        statementPaymentTotal: payments,
        closingBalance: Math.max(0, periodPayables - payments),
        netAfterCod: periodPayables * 2,
        notes: `${DEMO_PREFIX} supplier statement`,
        payments:
          payments > 0
            ? [
                {
                  amount: payments,
                  paidAt: periodTo,
                  method: "bank_transfer",
                  reference: `${DEMO_PREFIX}_SUP_STMT_${pad(i)}`,
                  notes: `${DEMO_PREFIX} statement payment`,
                  createdBy: "synthetic_seed",
                  documents: [],
                },
              ]
            : [],
      }),
    );
  }

  for (let i = 0; i < Math.min(ctx.agents.length * statementCount, ctx.cfg.agents * 10); i++) {
    const agent = ctx.agents[i % ctx.agents.length];
    const periodTo = dateDays(ctx, -(i % statementCount) * 15);
    const periodFrom = new Date(periodTo.getTime() - 14 * MS_PER_DAY);
    const periodReceivables = 500000 + (i % 17) * 110000;
    const late = i % 13 === 0;
    agentStatements.push(
      withTimestamps({
        _id: oid("agentstatement", i),
        agentId: agent._id,
        periodFrom,
        periodTo,
        status: late ? "open" : "closed",
        openingBalance: late ? 700000 : 0,
        periodReceivables,
        periodCollected: periodReceivables * 4,
        statementPaymentTotal: late ? Math.round(periodReceivables * 0.25) : periodReceivables,
        closingBalance: late ? Math.round(periodReceivables * 0.75) : 0,
        netAfterDelivery: periodReceivables * 3,
        notes: `${DEMO_PREFIX} ${late ? "late_payment_agent" : "agent statement"}`,
        payments: late
          ? []
          : [
              {
                amount: periodReceivables,
                paidAt: periodTo,
                method: "bank_transfer",
                reference: `${DEMO_PREFIX}_AG_STMT_${pad(i)}`,
                notes: `${DEMO_PREFIX} agent payment`,
                createdBy: "synthetic_seed",
                documents: [],
              },
            ],
      }),
    );
  }
  return { supplierPayables, supplierStatements, agentStatements };
}

function buildFinance(ctx: BuildContext) {
  const fundingSources: any[] = [];
  const budgetBuckets: any[] = [];
  const loanContracts: any[] = [];
  const loanRepayments: any[] = [];
  const cashflowEntries: any[] = [];
  const availableFundSnapshots: any[] = [];
  const cashflowSnapshots: any[] = [];
  const alerts: any[] = [];

  for (let i = 0; i < ctx.cfg.loans; i++) {
    const lender = ctx.lenders[i % ctx.lenders.length];
    const principal = 50000000 + i * 15000000;
    const remaining = i % 4 === 0 ? principal * 0.8 : principal * 0.45;
    const loanId = oid("loan", i);
    loanContracts.push(
      withTimestamps({
        _id: loanId,
        name: `${DEMO_PREFIX} Loan ${pad(i)}`,
        lenderName: lender.name,
        principal,
        principalRemaining: remaining,
        interestRate: 10 + (i % 5) * 1.5,
        repaymentCycle: "monthly",
        startDate: dateDays(ctx, -120 + i),
        endDate: dateDays(ctx, 240 + i * 10),
        restricted: i % 5 === 0,
        status: "active",
        notes: `${DEMO_PREFIX} ${i % 3 === 0 ? "ads_financing" : "inventory_financing"}`,
        disbursementStatus: i % 6 === 0 ? "partial" : "fully",
        disbursedAmount: i % 6 === 0 ? principal * 0.7 : principal,
        disbursedDate: dateDays(ctx, -110 + i),
        totalPrincipalPaid: principal - remaining,
        totalInterestPaid: Math.round(principal * 0.04),
      }),
    );
    fundingSources.push(
      withTimestamps({
        _id: oid("fundingsource", i),
        name: `${DEMO_PREFIX} Funding Source ${pad(i)}`,
        type: "loan",
        lenderOrInvestor: lender.name,
        principal,
        availableBalance: Math.round(principal * 0.22),
        interestRate: 10 + (i % 5) * 1.5,
        repaymentCycle: "monthly",
        startDate: dateDays(ctx, -120 + i),
        endDate: dateDays(ctx, 240 + i * 10),
        targetProductGroups: [String(ctx.categories[i % ctx.categories.length]._id)],
        restricted: i % 5 === 0,
        status: "active",
        notes: `${DEMO_PREFIX} funding source`,
      }),
    );
  }

  for (let i = 0; i < ctx.cfg.loanRepayments; i++) {
    const loan = loanContracts[i % loanContracts.length];
    const dueDate = dateDays(ctx, -20 + (i % 90));
    const late = i % 17 === 0 && dueDate < ctx.now;
    loanRepayments.push(
      withTimestamps({
        _id: oid("loanrepayment", i),
        loanId: loan._id,
        amountPrincipal: 1500000 + (i % 7) * 250000,
        amountInterest: 250000 + (i % 5) * 90000,
        dueDate,
        paid: !late && i % 6 !== 0,
        paidDate: !late && i % 6 !== 0 ? new Date(dueDate.getTime() + 2 * MS_PER_DAY) : undefined,
        fundingSource: i % 4 === 0 ? "owner_fund" : "bank",
        referenceId: `${DEMO_PREFIX}_LOAN_REPAY_${pad(i)}`,
        notes: `${DEMO_PREFIX} ${late ? "late_repayment" : "scheduled repayment"}`,
      }),
    );
  }

  for (let i = 0; i < 8; i++) {
    const source = fundingSources[i % fundingSources.length];
    budgetBuckets.push(
      withTimestamps({
        _id: oid("budgetbucket", i),
        name: `${DEMO_PREFIX} Budget Bucket ${pad(i)}`,
        code: `${DEMO_PREFIX}_BUDGET_${pad(i)}`,
        productGroupIds: [String(ctx.categories[i % ctx.categories.length]._id)],
        dailyCap: 1500000 + i * 200000,
        weeklyCap: 9000000 + i * 1000000,
        monthlyCap: 35000000 + i * 3000000,
        linkedSources: [{ sourceId: source._id, allocated: 20000000, restricted: i % 4 === 0 }],
        active: true,
        notes: `${DEMO_PREFIX} ads fund bucket`,
      }),
    );
  }

  const cashflowCount = Math.max(500, Math.ceil(ctx.cfg.salesOrders * 0.7));
  for (let i = 0; i < cashflowCount; i++) {
    const inflow = i % 3 !== 0;
    cashflowEntries.push(
      withTimestamps({
        _id: oid("cashflow", i),
        direction: inflow ? "in" : "out",
        sourceType: inflow ? (i % 5 === 0 ? "loan" : "cod") : i % 4 === 0 ? "owner_fund" : "other",
        amount: inflow ? 600000 + (i % 20) * 50000 : 300000 + (i % 16) * 75000,
        date: dateDays(ctx, -(i % ctx.cfg.timeRangeDays)),
        bucketId: budgetBuckets[i % budgetBuckets.length]?._id,
        fundingSourceId: fundingSources[i % fundingSources.length]?._id,
        category: inflow ? "demo_inflow" : "demo_outflow",
        referenceId: `${DEMO_PREFIX}_CASH_${pad(i)}`,
        description: `${DEMO_PREFIX} synthetic cashflow ${i % 29 === 0 ? "cash_gap_watch" : ""}`,
      }),
    );
  }
  for (let i = 0; i < Math.min(ctx.cfg.timeRangeDays, 180); i++) {
    availableFundSnapshots.push(
      withTimestamps({
        _id: oid("fundsnapshot", i),
        capturedAt: dateDays(ctx, -i),
        available: 85000000 - i * 120000 + (i % 9) * 1000000,
        collectedRevenue: 150000000 + i * 500000,
        loanAvailable: 70000000,
        actualSpent: 65000000 + i * 250000,
        reservedPayroll: 12000000,
        reservedInterest: 4000000,
        reservedPayables: 18000000,
        reservedSuppliers: 24000000,
        reservedAgents: 9000000,
        reservedOther: 6000000,
        note: `${DEMO_PREFIX} available fund snapshot`,
      }),
    );
  }
  for (const [index, item] of [
    ["labor", 7],
    ["labor", 14],
    ["labor", 30],
    ["ops", 7],
    ["agent", 14],
    ["supplier", -1],
    ["debt", 30],
  ].entries()) {
    cashflowSnapshots.push({
      _id: oid("cashflowsnapshot", index),
      domain: item[0],
      windowDays: item[1],
      data: {
        source: "synthetic_seed",
        totalDue: 12000000 + index * 3000000,
        warning: index % 2 === 0 ? "cash gap pressure" : "normal",
      },
      updatedAt: dateDays(ctx, 0, 7),
    });
  }
  for (let i = 0; i < 8; i++) {
    alerts.push({
      _id: oid("financealert", i),
      code: `${DEMO_PREFIX}_ALERT_${pad(i)}`,
      dateString: DIRECTOR_DEMO_REPORT_DATE,
      severity: i % 3 === 0 ? "CRITICAL" : i % 3 === 1 ? "DANGER" : "WARNING",
      message: `${DEMO_PREFIX} expected AI finding ${expectedDemoAnomalies()[i % expectedDemoAnomalies().length]}`,
      value: 1000000 + i * 500000,
      threshold: 800000,
      isResolved: false,
      createdAt: dateDays(ctx, 0, 7),
      updatedAt: dateDays(ctx, 0, 7),
    });
  }

  return {
    fundingSources,
    budgetBuckets,
    loanContracts,
    loanRepayments,
    cashflowEntries,
    availableFundSnapshots,
    cashflowSnapshots,
    alerts,
  };
}

function buildLabor(ctx: BuildContext) {
  const entries: any[] = [];
  const statements: any[] = [];
  for (let i = 0; i < ctx.cfg.laborEntries; i++) {
    const employee = ctx.employees[i % ctx.employees.length];
    const overtime = i % 19 === 0;
    const hours = overtime ? 11 : 7 + (i % 3);
    const rate = 45000 + (i % 6) * 5000;
    entries.push(
      withTimestamps({
        _id: oid("laborentry", i),
        date: dateDays(ctx, -(i % ctx.cfg.timeRangeDays)),
        userId: employee._id,
        startTime: overtime ? "07:00" : "08:00",
        endTime: overtime ? "20:00" : "17:00",
        workHours: hours,
        sessionCount: 1,
        hourlyRate: rate,
        cost: hours * rate,
        notes: `${DEMO_PREFIX} ${overtime ? "overtime_high" : "labor_entry"}`,
        paid: i % 6 !== 0,
        paidAt: i % 6 !== 0 ? dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 7) : undefined,
        paymentStatus: i % 6 !== 0 ? "paid" : "unpaid",
      }),
    );
  }
  const statementCount = Math.min(ctx.employees.length * 8, Math.max(24, ctx.employees.length * 4));
  for (let i = 0; i < statementCount; i++) {
    const employee = ctx.employees[i % ctx.employees.length];
    const periodTo = dateDays(ctx, -(i % 8) * 15);
    const periodFrom = new Date(periodTo.getTime() - 14 * MS_PER_DAY);
    const periodCost = 4500000 + (i % 9) * 400000;
    const unpaid = i % 7 === 0;
    statements.push(
      withTimestamps({
        _id: oid("laborstatement", i),
        employeeId: employee._id,
        periodFrom,
        periodTo,
        status: unpaid ? "open" : "closed",
        openingBalance: unpaid ? 1200000 : 0,
        periodCost,
        totalWorkHours: 96 + (i % 30),
        sessionCount: 12 + (i % 8),
        kpiPercent: 70 + (i % 31),
        attendanceBonus: i % 4 === 0 ? 300000 : 0,
        kpiBonus: i % 5 === 0 ? 500000 : 0,
        punctualityBonus: i % 6 === 0 ? -100000 : 200000,
        onTimeDays: 10 + (i % 5),
        lateDays: i % 6,
        kpiUpdatedBy: "synthetic_seed",
        kpiUpdatedAt: periodTo,
        bonus: i % 5 === 0 ? 200000 : 0,
        deduction: i % 6 === 0 ? 100000 : 0,
        statementPaymentTotal: unpaid ? Math.round(periodCost * 0.35) : periodCost,
        closingBalance: unpaid ? Math.round(periodCost * 0.65) : 0,
        notes: `${DEMO_PREFIX} ${unpaid ? "labor_cost_pressure" : "labor statement"}`,
        payments: unpaid
          ? []
          : [
              {
                amount: periodCost,
                paidAt: periodTo,
                method: "bank_transfer",
                reference: `${DEMO_PREFIX}_LABORPAY_${pad(i)}`,
                notes: `${DEMO_PREFIX} labor payment`,
                createdBy: "synthetic_seed",
                documents: [],
              },
            ],
        laborCostIds: entries
          .slice(i * 2, i * 2 + 5)
          .filter(Boolean)
          .map((row) => row._id),
        confirmedAt: periodTo,
        confirmedBy: "synthetic_seed",
        closedAt: unpaid ? undefined : periodTo,
        closedBy: unpaid ? undefined : "synthetic_seed",
        dueDate: new Date(periodTo.getTime() + 7 * MS_PER_DAY),
      }),
    );
  }
  return { entries, statements };
}

function buildReturns(ctx: BuildContext) {
  const returnedOrders = ctx.orders.filter((row, index) => row.orderStatus === "returned" || index % 37 === 0);
  return returnedOrders.slice(0, Math.max(20, Math.floor(ctx.cfg.salesOrders / 18))).map((order, index) =>
    withTimestamps({
      _id: oid("returnrequest", index),
      orderId: order._id,
      supplierId: order.supplierId,
      status: index % 5 === 0 ? "pending" : "resolved",
      items: [
        {
          productId: order.productId,
          quantityReturned: order.quantity || 1,
          decision: index % 6 === 0 ? "scrap" : "restock",
          processedQuantity: index % 5 === 0 ? 0 : order.quantity || 1,
          recoveryUnitCost: index % 6 === 0 ? 0 : order.supplierAppliedPrice,
          notes: `${DEMO_PREFIX} return item`,
        },
      ],
      reason: `${DEMO_PREFIX} ${index % 6 === 0 ? "high_return_product" : "return demo"}`,
      resolvedAt: index % 5 === 0 ? undefined : dateDays(ctx, -index),
    }),
  );
}

function buildOtherCosts(ctx: BuildContext) {
  const docs: any[] = [];
  const categories = ["rent", "utilities", "internet", "tools", "shipping-fee", "packaging", "marketing", "other"];
  const count = Math.max(180, Math.floor(ctx.cfg.timeRangeDays * 2));
  for (let i = 0; i < count; i++) {
    const amount = 250000 + (i % 20) * 80000;
    docs.push(
      withTimestamps({
        _id: oid("othercost", i),
        date: dateDays(ctx, -(i % ctx.cfg.timeRangeDays)),
        amount,
        dueDate: dateDays(ctx, 3 - (i % 12)),
        category: categories[i % categories.length],
        notes: `${DEMO_PREFIX} operating cost ${i % 18 === 0 ? "unpaid_pressure" : ""}`,
        documentLink: "",
        isConfirmed: i % 9 !== 0,
        confirmedAt: i % 9 !== 0 ? dateDays(ctx, -(i % ctx.cfg.timeRangeDays) + 3) : undefined,
      }),
    );
  }
  return docs;
}

function buildSystemSettings(ctx: BuildContext) {
  const keys = [
    ["minimum_cash_reserve", 50000000],
    ["target_survival_months", 3],
    ["max_daily_ads_budget", 8000000],
    ["max_budget_increase_percent", 15],
    ["max_test_budget", 20000000],
    ["max_test_loss", 6000000],
    ["monthly_revenue_target", 1200000000],
    ["monthly_profit_target", 180000000],
    ["director_note_today", `${DEMO_PREFIX} watch cash gap, overdue agents, ad spend spike`],
  ];
  return keys.map(([key, value], index) =>
    withTimestamps({
      _id: oid("systemsetting", index),
      key,
      value: { value, source: "synthetic_seed", prefix: DEMO_PREFIX },
      description: `${DEMO_PREFIX} director manual input`,
      updatedBy: "synthetic_seed",
    }),
  );
}

function c(collection: string, docs: any[]): DemoCollectionDocs {
  return { collection, docs };
}

function summarizeCollections(
  collections: DemoCollectionDocs[],
  base: Record<string, number>,
) {
  const result = { ...base };
  for (const entry of collections) {
    result[`${entry.collection}_docs`] = entry.docs.length;
  }
  return result;
}

function refFor(kind: string, index: number, name: string): EntityRef {
  return { _id: oid(kind, index), name };
}

function oid(kind: string, index: number): Types.ObjectId {
  const hex = createHash("sha1")
    .update(`DEMO_DIRECTOR_AI_PACK_20260614:${kind}:${index}`)
    .digest("hex")
    .slice(0, 24);
  return new Types.ObjectId(hex);
}

function withTimestamps<T extends Record<string, any>>(doc: T): T {
  const now = new Date(DIRECTOR_DEMO_ANCHOR_DATE);
  return {
    ...doc,
    createdAt: doc.createdAt || now,
    updatedAt: doc.updatedAt || now,
  };
}

function dateDays(ctx: BuildContext, deltaDays: number, hour = 12): Date {
  const date = new Date(ctx.now.getTime() + deltaDays * MS_PER_DAY);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pad(index: number): string {
  return String(index + 1).padStart(4, "0");
}

function color(index: number): string {
  const colors = ["#2563EB", "#16A34A", "#DC2626", "#9333EA", "#EA580C", "#0891B2"];
  return colors[index % colors.length];
}

function supplierType(index: number): string {
  return [
    "supplier_product",
    "supplier_service",
    "supplier_shipping",
    "supplier_marketing",
    "supplier_labor",
  ][index % 5];
}

function agentTier(index: number): string {
  return [
    "tier_1",
    "tier_2",
    "tier_3",
    "new_agent",
    "vip_agent",
    "late_payment_agent",
    "high_return_agent",
  ][index % 7];
}

function agentRisk(index: number): string {
  return index % 13 === 0 ? "late_payment" : index % 17 === 0 ? "high_return" : "normal";
}

function productFamily(index: number): string {
  return [
    "Basic Package",
    "Premium Package",
    "Combo Kit",
    "Accessory Addon",
    "High Margin Offer",
    "Low Margin Offer",
    "High Return Offer",
    "Slow Supply Offer",
  ][index % 8];
}

function productScenario(index: number): string {
  if (index % 29 === 0) return "negative_margin_watch";
  if (index % 23 === 0) return "supplier_slow_delivery";
  if (index % 19 === 0) return "low_inventory_bestseller";
  if (index % 11 === 0) return "high_return_rate";
  return "normal_demo_product";
}
