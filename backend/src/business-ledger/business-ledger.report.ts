import { ledgerCashAccounts } from './ledger-cash';
import { OrderContext, settlementStatus } from "./business-ledger.rules";
import { operationalEntries } from './operational-projection';
import { profitAssessment } from '../test-order2/profit-assessment';
import { isDealerSale } from '../test-order2/order-sale-mode';

import { businessDay } from '../common/business-day';
export { businessDay } from '../common/business-day';
export function rangeDates(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    throw new Error("Ngày phải có dạng YYYY-MM-DD.");
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(`${to}T23:59:59.999+07:00`);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    businessDay(start) !== from ||
    businessDay(end) !== to ||
    end < start ||
    +end - +start > 93 * 86_400_000
  ) {
    throw new Error("Chọn khoảng ngày hợp lệ, tối đa 93 ngày.");
  }
  return { start, end };
}

import { allocateVnd } from '../common/allocate-vnd';
export { allocateVnd } from '../common/allocate-vnd';

export function buildLedgerReport(input: {
  entries: any[];
  accounts: any[];
  profiles: any[];
  orders: any[];
  ads: any[];
  overhead?: { labor: any[]; other: any[] };
  from: string;
  to: string;
}) {
  const { start, end } = rangeDates(input.from, input.to);
  const entries = [...input.entries, ...operationalEntries(input.orders, !input.overhead)]
    .filter((e) => +new Date(e.occurredAt) <= +end);
  const confirmed = entries.filter((e) => e.status === "confirmed");
  // Fail rather than round financial totals when the bounded first-phase report
  // would exceed exact integer arithmetic.
  let magnitude = 0;
  for (const account of input.accounts) {
    if (
      !Number.isSafeInteger(account.openingBalance) ||
      account.openingBalance < 0
    )
      throw new Error("Số dư đầu kỳ không hợp lệ.");
    magnitude += account.openingBalance;
    if (!Number.isSafeInteger(magnitude))
      throw new Error("Tổng số dư vượt giới hạn số nguyên chính xác.");
  }
  for (const e of confirmed) {
    const values = [
      e.effects.revenue,
      e.effects.cogs,
      e.effects.expense,
      ...e.effects.debts.map((d) => d.amount),
      ...e.effects.cash.map((c) => c.amount),
    ];
    for (const value of values) {
      if (!Number.isSafeInteger(value))
        throw new Error("Bút toán có số tiền không hợp lệ.");
      magnitude += Math.abs(value);
      if (!Number.isSafeInteger(magnitude))
        throw new Error("Tổng tiền vượt giới hạn số nguyên chính xác.");
    }
  }
  const period = confirmed.filter((e) => +new Date(e.occurredAt) >= +start);
  const reversed = new Set(
    confirmed
      .filter((e) => e.kind === "reversal")
      .map((e) => String(e.reversalOf)),
  );
  const entriesByOrder = new Map<string, any[]>();
  for (const e of entries)
    if (e.orderId) {
      const bucket = entriesByOrder.get(e.orderId) || [];
      bucket.push(e);
      entriesByOrder.set(e.orderId, bucket);
    }
  const profiles = new Map(input.profiles.map((p) => [p.orderId, p]));
  const debts = new Map<
    string,
    {
      partyKey: string;
      receivable: number;
      payable: number;
      orderBalances: Map<string, number>;
    }
  >();
  const orderBalances = new Map<string, Map<string, number>>();
  for (const e of confirmed) {
    for (const d of e.effects.debts) {
      const bucket = debts.get(d.partyKey) || {
        partyKey: d.partyKey,
        receivable: 0,
        payable: 0,
        orderBalances: new Map(),
      };
      const orderId = e.orderId || "unallocated";
      bucket.orderBalances.set(
        orderId,
        (bucket.orderBalances.get(orderId) || 0) + d.amount,
      );
      debts.set(d.partyKey, bucket);
      if (e.orderId) {
        const b = orderBalances.get(e.orderId) || new Map<string, number>();
        b.set(d.partyKey, (b.get(d.partyKey) || 0) + d.amount);
        orderBalances.set(e.orderId, b);
      }
    }
  }
  const debtRows = [...debts.values()]
    .map((d) => {
      const balances = [...d.orderBalances.values()];
      return {
        partyKey: d.partyKey,
        receivable: balances.reduce((s, n) => s + Math.max(0, n), 0),
        payable: balances.reduce((s, n) => s + Math.max(0, -n), 0),
        net: balances.reduce((s, n) => s + n, 0),
        // A net across orders is a view, not evidence of an executed offset.
        orders: [...d.orderBalances].map(([orderId, balance]) => ({
          orderId,
          balance,
        })),
      };
    })
    .filter((d) => d.receivable || d.payable);

  const cashAccounts = ledgerCashAccounts(input.accounts, confirmed, end);

  const rows = new Map<string, any>();
  const ensure = (context: Partial<OrderContext>, name?: string) => {
    const key = context.orderId || "unallocated";
    if (!rows.has(key))
      rows.set(key, {
        orderId: key,
        productId: context.productId || "unallocated",
        productName: name || "Chưa phân bổ",
        productCategoryId: context.productCategoryId || "unallocated",
        productCategoryName: context.productCategoryName || "Chưa phân nhóm",
        productCategoryCode: context.productCategoryCode,
        agentId: context.agentId || "retail",
        adGroupId: context.adGroupId || "unallocated",
        quantity: context.quantity || 0,
        orderDay: context.orderDate ? businessDay(context.orderDate) : undefined,
        revenue: 0,
        cogs: 0,
        expense: 0,
        advertisingCost: 0,
        laborCostAllocation: 0,
        otherCostAllocation: 0,
        hasSale: false,
        hasCost: false,
        cashIn: 0,
        cashOut: 0,
        customerCashCollected: 0,
      });
    return rows.get(key);
  };
  for (const order of input.orders) {
    if (order.isActive === false) continue;
    if (order.orderDate && (+new Date(order.orderDate) < +start || +new Date(order.orderDate) > +end)) continue;
    const id = String(order._id);
    const profile = profiles.get(id);
    ensure(
      profile?.context || {
        orderId: id,
        productId: String(
          order.productId?._id || order.productId || "unallocated",
        ),
        productCategoryId: String(
          order.productCategoryIdSnapshot || order.productId?.categoryId?._id
            || order.productId?.categoryId || "unallocated",
        ),
        productCategoryName: order.productCategoryNameSnapshot
          || order.productId?.categoryId?.name || "Chưa phân nhóm",
        productCategoryCode: order.productCategoryCodeSnapshot
          || order.productId?.categoryId?.code,
        agentId: isDealerSale(order) && order.agentId ? String(order.agentId) : undefined,
        adGroupId:
          String(order.adGroupId || "").trim() === "0"
            ? undefined
            : order.adGroupId,
        quantity: Number(order.quantity || 0),
        orderDate: order.orderDate,
      },
      profile?.productName || order.productId?.name,
    );
    rows.get(id).profitAssessment = profitAssessment(order);
    rows.get(id).orderStatus = order.orderStatus;
    rows.get(id).productionStatus = order.productionStatus;
    rows.get(id).allocationEligible = true;
    rows.get(id).productColor = order.productId?.color || '#888888';
    if (!input.overhead) {
      rows.get(id).laborCostAllocation = Number(order.laborCostAllocation || 0);
      rows.get(id).otherCostAllocation = Number(order.otherCostAllocation || 0);
    }
  }
  for (const e of period) {
    if (e.orderId?.startsWith('purchase:')) continue; // Purchase assets and payments are not sales profit.
    if (!e.effects.revenue && !e.effects.cogs && !e.effects.expense && !e.effects.cash.length && e.kind !== 'sale' && e.kind !== 'inventory_cost') continue;
    if (
      !e.orderId &&
      !e.effects.revenue &&
      !e.effects.cogs &&
      !e.effects.expense
    )
      continue;
    const row = ensure(e.context || {}, e.productName);
    row.allocationEligible ||= Boolean(e.orderId && !e.orderId.startsWith('purchase:'));
    row.revenue += e.effects.revenue;
    row.cogs += e.effects.cogs;
    row.expense += e.effects.expense;
    row.hasSale ||= e.kind === "sale" && !reversed.has(String(e._id));
    row.hasCost ||=
      (e.kind === "direct_cost" || e.kind === "inventory_cost") &&
      !reversed.has(String(e._id));
    for (const c of e.effects.cash) {
      row.cashIn += Math.max(0, c.amount);
      row.cashOut += Math.max(0, -c.amount);
    }
  }
  // Recompute overhead from the same daily source used by OrderCalculation.
  // Do not also include the cached allocations on each operational order.
  let unallocatedOverhead = 0;
  if (input.overhead) for (const kind of ['labor', 'other'] as const) {
    const totals = new Map<string, number>();
    for (const cost of input.overhead[kind]) {
      const occurred = new Date(cost.date);
      const amount = Number(kind === 'labor' ? cost.cost : cost.amount);
      if (!Number.isFinite(+occurred) || !Number.isFinite(amount) || amount < 0 || amount > 1e12)
        throw new Error('Chi phí nhân công/vận hành không hợp lệ; cần kiểm tra dữ liệu nguồn.');
      if (+occurred < +start || +occurred > +end) continue;
      const day = businessDay(occurred);
      const total = (totals.get(day) || 0) + Math.round(amount);
      magnitude += Math.round(amount);
      if (!Number.isSafeInteger(total) || !Number.isSafeInteger(magnitude)) throw new Error('Tổng chi phí vượt giới hạn số nguyên chính xác.');
      totals.set(day, total);
    }
    const field = kind === 'labor' ? 'laborCostAllocation' : 'otherCostAllocation';
    for (const [day, amount] of totals) {
      if (!amount) continue;
      const targets = [...rows.values()].filter(r => r.allocationEligible && r.orderDay === day && r.quantity > 0)
        .sort((a, b) => a.orderId.localeCompare(b.orderId));
      if (targets.length) {
        const allocations = allocateVnd(amount, targets.map(r => r.quantity));
        targets.forEach((row, i) => { row[field] += allocations[i]; row.expense += allocations[i]; });
      } else {
        const row = ensure({ orderId: `overhead:${kind}:${day}`, adGroupId: 'unallocated',
          quantity: 0, orderDate: `${day}T00:00:00+07:00` }, 'Chi phí chung chưa phân bổ');
        row.costOnly = true;
        row[field] = amount;
        row.expense = amount;
        unallocatedOverhead += amount;
      }
    }
  }
  // Actual ads include spend without any order. Allocation is explicitly by quantity
  // within the requested window; it is not a claim of causal attribution per product.
  const adGroups = new Map<string, number>();
  const identities = new Map<string, Set<string>>();
  let invalidAds = 0;
  const invalidAdGroupIds = new Set<string>();
  for (const ad of input.ads) {
    const amount = Number(ad.spentAmount);
    const group = String(ad.adGroupId || "").trim() || "unallocated";
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1e12 ||
      (ad.currency && ad.currency !== "VND")
    ) {
      invalidAds++;
      invalidAdGroupIds.add(group);
      continue;
    }
    const identity = `${ad.channel || "unspecified"}:${ad.customerId || ""}`;
    const known = identities.get(group) || new Set<string>();
    known.add(identity);
    identities.set(group, known);
    magnitude += Math.round(amount);
    if (!Number.isSafeInteger(magnitude))
      throw new Error("Tổng chi phí vượt giới hạn số nguyên chính xác.");
    const day = ad.date ? businessDay(ad.date) : undefined;
    const key = `${group}|${day || 'undated'}`;
    adGroups.set(key, (adGroups.get(key) || 0) + Math.round(amount));
  }
  const ambiguousAdGroupIds = [...identities]
    .filter(([, values]) => values.size > 1)
    .map(([key]) => key);
  for (const [key, total] of adGroups) {
    const [group, day] = key.split('|');
    const targets = ambiguousAdGroupIds.includes(group)
      ? []
      : [...rows.values()].filter(
          (r) => r.allocationEligible && r.adGroupId === group && r.quantity > 0
            && (day === 'undated' || r.orderDay === day),
        ).sort((a,b) => a.orderId.localeCompare(b.orderId));
    if (!targets.length) {
      rows.set(`ads:${key}`, {
        orderId: `ads:${key}`,
        productId: "unallocated",
        productName: "Quảng cáo chưa phân bổ",
        productCategoryId: "unallocated",
        productCategoryName: "Chưa phân nhóm",
        agentId: "unallocated",
        adGroupId: group,
        quantity: 0,
        orderDay: day === 'undated' ? undefined : day,
        revenue: 0,
        cogs: 0,
        expense: 0,
        advertisingCost: total,
        laborCostAllocation: 0,
        otherCostAllocation: 0,
        hasSale: false,
        hasCost: false,
        cashIn: 0,
        cashOut: 0,
        customerCashCollected: 0,
        adsOnly: true,
      });
    } else {
      const allocations = allocateVnd(
        total,
        targets.map((r) => r.quantity),
      );
      targets.forEach((r, i) => (r.advertisingCost += allocations[i]));
    }
  }
  for (const row of rows.values()) {
    const allOrderEntries = entriesByOrder.get(row.orderId) || [];
    const orderConfirmed = allOrderEntries.filter(
      (e) => e.status === "confirmed",
    );
    const active = orderConfirmed.filter(
      (e) => !reversed.has(String(e._id)) && e.kind !== "reversal",
    );
    // Direct customer/dealer receipts less refunds, through the end of the report.
    // Reversed payments and supplier refunds must never inflate collection coverage.
    row.customerCashCollected = active.filter(e => e.kind === 'payment'
      && ([e.posting?.fromParty, e.posting?.toParty].some(p => p === 'customer' || p === 'agent')))
      .reduce((sum, e) => sum + e.effects.cash.reduce((s, movement) => s + movement.amount, 0), 0);
    row.pendingCount = allOrderEntries.filter(
      (e) => e.status === "draft",
    ).length;
    // Cash-only drafts require settlement review, not a downgrade of ad effectiveness.
    row.pendingProfitCount = allOrderEntries.filter(
      (e) => e.status === 'draft' &&
        [e.effects.revenue, e.effects.cogs, e.effects.expense].some(value => value !== 0),
    ).length;
    row.settlementStatus = settlementStatus(
      active.some((e) => e.kind === "sale") &&
        active.some((e) => ["direct_cost", "inventory_cost"].includes(e.kind)),
      [...(orderBalances.get(row.orderId)?.values() || [])],
      row.pendingCount,
      active.some((e) => e.kind === "payment"),
    );
    row.receivable = [
      ...(orderBalances.get(row.orderId)?.values() || []),
    ].reduce((s, n) => s + Math.max(0, n), 0);
    row.payable = [...(orderBalances.get(row.orderId)?.values() || [])].reduce(
      (s, n) => s + Math.max(0, -n),
      0,
    );
    row.recordedNetProfit =
      row.revenue - row.cogs - row.expense - row.advertisingCost;
    row.profitNeedsReview =
      !row.adsOnly && !row.costOnly &&
      ((row.profitAssessment && row.profitAssessment.state !== 'calculated') || !row.hasSale ||
        !row.hasCost ||
        row.pendingProfitCount > 0 ||
        row.revenue < 0 ||
        row.cogs < 0 ||
        ambiguousAdGroupIds.includes(row.adGroupId) || invalidAdGroupIds.has(row.adGroupId));
    row.needsReview = row.profitNeedsReview ||
      (!row.adsOnly && !row.costOnly && row.pendingCount > 0);
  }
  const orderRows = [...rows.values()];
  const groupBy = (field: string) => {
    const grouped = new Map<string, any>();
    for (const row of orderRows) {
      const key = row[field];
      const g = grouped.get(key) || {
        key,
        name: field === "productId"
          ? row.productName
          : field === "productCategoryId"
            ? row.productCategoryName
            : key,
        ...(field === "productCategoryId" && row.productCategoryCode
          ? { code: row.productCategoryCode }
          : {}),
        ...(field === "productId" ? { color: row.productColor || '#888888' } : {}),
        orders: 0,
        quantity: 0,
        revenue: 0,
        cogs: 0,
        expense: 0,
        advertisingCost: 0,
        laborCostAllocation: 0,
        otherCostAllocation: 0,
        recordedNetProfit: 0,
        cashIn: 0,
        cashOut: 0,
        customerCashCollected: 0,
        receivable: 0,
        payable: 0,
        unallocatedAdvertisingCost: 0,
        needsReview: 0,
        profitNeedsReview: 0,
      };
      if (!row.adsOnly && !row.costOnly && row.orderId !== "unallocated") g.orders++;
      for (const k of [
        "quantity",
        "revenue",
        "cogs",
        "expense",
        "advertisingCost",
        "laborCostAllocation",
        "otherCostAllocation",
        "recordedNetProfit",
        "cashIn",
        "cashOut",
        "customerCashCollected",
        "receivable",
        "payable",
      ])
        g[k] += row[k];
      if (row.adsOnly) g.unallocatedAdvertisingCost += row.advertisingCost;
      if (row.needsReview) g.needsReview++;
      if (row.profitNeedsReview) g.profitNeedsReview++;
      grouped.set(key, g);
    }
    return [...grouped.values()].sort(
      (a, b) => b.recordedNetProfit - a.recordedNetProfit,
    );
  };
  return {
    from: input.from,
    to: input.to,
    currency: "VND",
    basis: input.orders.some(o => o.financialModelVersion === 2)
      ? 'operational_order_snapshots_and_confirmed_payments' : 'confirmed_journal',
    cash: {
      accounts: cashAccounts,
      registeredAccountsBalance: cashAccounts.length
        ? cashAccounts.reduce((s, a) => s + a.balance, 0)
        : null,
      scope: "registered_accounts_only",
      includesPartnerHeldMoney: false,
    },
    debts: debtRows,
    totalReceivable: debtRows.reduce((s, d) => s + d.receivable, 0),
    totalPayable: debtRows.reduce((s, d) => s + d.payable, 0),
    productCategories: groupBy("productCategoryId"),
    products: groupBy("productId"),
    agents: groupBy("agentId"),
    adGroups: groupBy("adGroupId"),
    orders: orderRows,
    pendingCount: entries.filter((e) => e.status === "draft").length,
    quality: {
      estimatedAdsRows: input.ads.filter(ad => ad.isEstimated === true).length,
      estimatedAdsSpend: input.ads.filter(ad => ad.isEstimated === true).reduce((sum, ad) => sum + Number(ad.spentAmount || 0), 0),
      unreviewedOrders: orderRows.filter((r) => r.needsReview).length,
      invalidAds,
      invalidAdGroupIds: [...invalidAdGroupIds],
      unallocatedOverhead,
      ambiguousAdGroupIds,
      adsAllocation: "quantity_in_same_business_day_and_ad_group",
      automaticAdsDecisionsAllowed: false,
      notes: [
        "Số dư chỉ gồm tài khoản đã khai báo và giao dịch xác nhận sau mốc đầu kỳ.",
        "Lãi/lỗ gồm nghiệp vụ đã ghi nhận và chi phí quảng cáo đã nhập; cần ghi đủ giá vốn, phí, nhân công và vận hành.",
        "Công nợ là số dư đến cuối kỳ. Đơn mới: lãi/lỗ theo nhóm đơn có ngày đặt trong kỳ, cập nhật kết quả mới nhất; không phải sổ khóa kỳ kế toán. Tiền thực thu/chi không đồng nghĩa lợi nhuận.",
        "Chưa cộng dữ liệu thanh toán cũ vào sổ mới. Không ghi trùng chi phí quảng cáo tự lấy từ module quảng cáo.",
      ],
    },
  };
}
