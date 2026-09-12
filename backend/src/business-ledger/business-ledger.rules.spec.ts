import {
  calculateEffects,
  OrderContext,
  Posting,
  reverseEffects,
} from "./business-ledger.rules";
import {
  allocateVnd,
  buildLedgerReport,
  rangeDates,
} from "./business-ledger.report";

const context: OrderContext = {
  orderId: "order-a",
  productId: "product-a",
  productCategoryId: "category-a",
  productCategoryName: "Thẻ tập huấn",
  productCategoryCode: "TTH",
  supplierId: "supplier-a",
  agentId: "agent-a",
  adGroupId: "ad-a",
  quantity: 1,
  orderDate: "2026-09-01T03:00:00Z",
  saleMode: "dealer",
  fulfillment: "supplier_direct",
};
let sequence = 0;
function entry(
  posting: Posting,
  ctx: OrderContext = context,
  status = "confirmed",
) {
  return {
    _id: `entry-${++sequence}`,
    ...posting,
    effects: calculateEffects(posting, ctx),
    context: ctx,
    orderId: ctx.orderId,
    occurredAt: new Date("2026-09-01T05:00:00Z"),
    status,
    productName: ctx.productId,
  };
}
function report(entries: any[], ads: any[] = [], accounts: any[] = []) {
  return buildLedgerReport({
    entries,
    ads: ads.map(ad => ({ date: context.orderDate, ...ad })), 
    accounts,
    profiles: [],
    orders: [],
    from: "2026-09-01",
    to: "2026-09-02",
  });
}
const account = {
  _id: "bank",
  code: "bank",
  name: "Ngân hàng",
  openingBalance: 1_000_000,
  openingAt: "2026-08-31T00:00:00Z",
};
const commercial = () => [
  entry({ kind: "sale", amount: 400_000 }),
  entry({ kind: "direct_cost", amount: 300_000 }),
  entry({
    kind: "expense",
    amount: 20_000,
    expenseParty: "other",
    otherParty: "shipper",
  }),
];
const pay = (
  amount: number,
  fromParty: Posting["fromParty"],
  toParty: Posting["toParty"],
) =>
  entry({
    kind: "payment",
    amount,
    fromParty,
    toParty,
    fromAccountId: fromParty === "company" ? "bank" : undefined,
    toAccountId: toParty === "company" ? "bank" : undefined,
  });

describe("Business ledger: commercial margin, custody and debt are independent", () => {
  it('keeps cash-only drafts in settlement review without flagging profit', () => {
    const pending = entry({ kind: 'payment', amount: 400_000,
      fromParty: 'agent', toParty: 'company', toAccountId: 'bank' }, context, 'draft');
    const result = report([...commercial(), pending]);
    expect(result.orders[0]).toMatchObject({ recordedNetProfit: 80_000,
      pendingCount: 1, pendingProfitCount: 0, needsReview: true, profitNeedsReview: false });
    expect(result.adGroups[0]).toMatchObject({ needsReview: 1, profitNeedsReview: 0 });
  });

  it('still flags pending expenses as incomplete profit data', () => {
    const pending = entry({ kind: 'expense', amount: 20_000,
      expenseParty: 'other', otherParty: 'shipper' }, context, 'draft');
    const result = report([...commercial(), pending]);
    expect(result.orders[0]).toMatchObject({ recordedNetProfit: 80_000,
      pendingCount: 1, pendingProfitCount: 1, needsReview: true, profitNeedsReview: true });
    expect(result.adGroups[0]).toMatchObject({ needsReview: 1, profitNeedsReview: 1 });
  });

  it.each([
    [
      "dealer collects",
      () => [
        pay(500_000, "customer", "agent"),
        pay(400_000, "agent", "company"),
        pay(300_000, "company", "supplier"),
      ],
    ],
    [
      "company collects",
      () => [
        pay(500_000, "customer", "company"),
        pay(100_000, "company", "agent"),
        pay(300_000, "company", "supplier"),
      ],
    ],
    [
      "supplier collects",
      () => [
        pay(500_000, "customer", "supplier"),
        pay(200_000, "supplier", "company"),
        pay(100_000, "company", "agent"),
      ],
    ],
  ])("same profit and final cash when %s", (_name, payments: () => any[]) => {
    const shipping = entry({
      kind: "payment",
      amount: 20_000,
      fromParty: "company",
      toParty: "other",
      fromAccountId: "bank",
      otherParty: "shipper",
    });
    const result = report(
      [...commercial(), ...payments(), shipping],
      [{ adGroupId: "ad-a", spentAmount: 50_000 }],
      [account],
    );
    expect(result.orders[0].recordedNetProfit).toBe(30_000);
    expect(result.cash.registeredAccountsBalance).toBe(1_080_000); // Ads incurred does not fabricate a cash payment.
    expect(result.totalReceivable).toBe(0);
    expect(result.totalPayable).toBe(0);
    expect(result.orders[0].settlementStatus).toBe("settled");
  });
  it("handles partial collections with a supplier receivable and dealer credit separately", () => {
    const result = report(
      [
        ...commercial(),
        pay(100_000, "customer", "company"),
        pay(250_000, "customer", "supplier"),
        pay(150_000, "customer", "agent"),
      ],
      [],
      [account],
    );
    expect(result.cash.registeredAccountsBalance).toBe(1_100_000);
    expect(result.debts.find((d) => d.partyKey === "agent:agent-a")?.net).toBe(
      50_000,
    );
    expect(
      result.debts.find((d) => d.partyKey === "supplier:supplier-a")?.net,
    ).toBe(-50_000);
    expect(result.orders[0].recordedNetProfit).toBe(80_000);
  });
  it("draft payments change neither cash nor outstanding balances", () => {
    const receipt = pay(400_000, "agent", "company");
    receipt.status = "draft";
    const result = report([...commercial(), receipt], [], [account]);
    expect(result.totalReceivable).toBe(400_000);
    expect(result.cash.registeredAccountsBalance).toBe(1_000_000);
    expect(result.orders[0].settlementStatus).toBe("pending_confirmation");
  });
  it("recognizes a loss on an accepted return without inventing dealer clawback income", () => {
    const result = report(
      [
        ...commercial(),
        entry({ kind: "sale_credit", amount: 400_000 }),
        entry({ kind: "supplier_credit", amount: 300_000 }),
        entry({
          kind: "expense",
          amount: 20_000,
          expenseParty: "other",
          otherParty: "shipper",
        }),
      ],
      [{ adGroupId: "ad-a", spentAmount: 50_000 }],
    );
    expect(result.orders[0].recordedNetProfit).toBe(-90_000);
    expect(result.debts.some((d) => d.partyKey.startsWith("agent:"))).toBe(
      false,
    );
    expect(result.totalPayable).toBe(40_000);
    expect(result.cash.registeredAccountsBalance).toBeNull();
  });
  it("a paid sale return creates a refund payable, not a second cash receipt", () => {
    const result = report(
      [
        ...commercial(),
        pay(400_000, "agent", "company"),
        entry({ kind: "sale_credit", amount: 400_000 }),
      ],
      [],
      [account],
    );
    expect(
      result.debts.find((d) => d.partyKey === "agent:agent-a")?.payable,
    ).toBe(400_000);
    expect(result.cash.registeredAccountsBalance).toBe(1_400_000);
  });
  it("inventory COGS does not create a second supplier payable", () => {
    const ctx = { ...context, fulfillment: "inventory" as const };
    const effect = calculateEffects(
      { kind: "inventory_cost", amount: 300_000 },
      ctx,
    );
    expect(effect.cogs).toBe(300_000);
    expect(effect.debts).toEqual([]);
    expect(effect.cash).toEqual([]);
    expect(() =>
      calculateEffects({ kind: "direct_cost", amount: 300_000 }, ctx),
    ).toThrow();
  });
  it("opening debts carry the unpaid balance without creating sales, costs or cash", () => {
    const effects = calculateEffects(
      { kind: "opening_receivable", amount: 80_000, expenseParty: "agent" },
      context,
    );
    expect(effects).toEqual({
      revenue: 0,
      cogs: 0,
      expense: 0,
      debts: [{ partyKey: "agent:agent-a", amount: 80_000 }],
      cash: [],
    });
    const supplier = calculateEffects(
      { kind: "opening_payable", amount: 50_000, expenseParty: "supplier" },
      context,
    );
    expect(supplier.debts[0].amount).toBe(-50_000);
  });
  it("retail collections settle the customer, not the dealer linked for reporting", () => {
    const ctx = { ...context, saleMode: "retail" as const };
    const sale = calculateEffects({ kind: "sale", amount: 500_000 }, ctx);
    expect(sale.debts).toEqual([
      { partyKey: "customer:order-a", amount: 500_000 },
    ]);
  });
  it("capital receipts and own-account transfers are cash only", () => {
    const capital = calculateEffects({
      kind: "payment",
      amount: 100,
      fromParty: "other",
      toParty: "company",
      otherParty: "owner",
      toAccountId: "bank",
    });
    expect(capital.debts).toEqual([]);
    expect(capital.revenue).toBe(0);
    const transfer = calculateEffects({
      kind: "payment",
      amount: 100,
      fromParty: "company",
      toParty: "company",
      fromAccountId: "bank",
      toAccountId: "cash",
    });
    expect(transfer.cash.reduce((s, c) => s + c.amount, 0)).toBe(0);
    expect(transfer.debts).toEqual([]);
  });
  it("cash-count corrections adjust the balance without fabricating receipts, revenue or debt", () => {
    const posting: Posting = {
      kind: "cash_adjustment_out",
      amount: 50_000,
      fromAccountId: "bank",
    };
    const effects = calculateEffects(posting);
    const correction = {
      _id: "correction",
      kind: posting.kind,
      effects,
      occurredAt: "2026-09-01T05:00:00Z",
      status: "confirmed",
    };
    const result = report([correction], [], [account]);
    expect(result.cash.accounts[0]).toMatchObject({
      receipts: 0,
      payments: 0,
      adjustments: -50_000,
      balance: 950_000,
    });
    expect(result.totalReceivable).toBe(0);
    expect(result.totalPayable).toBe(0);
    expect(result.products).toHaveLength(0);
    expect(() => calculateEffects(posting, context)).toThrow();
  });
  it("reversal restores cash/debt and retains the original history", () => {
    const original = pay(100_000, "agent", "company");
    const reversal = {
      ...original,
      _id: "reverse",
      kind: "reversal",
      reversalOf: original._id,
      effects: reverseEffects(original.effects),
    };
    const result = report([...commercial(), original, reversal], [], [account]);
    expect(result.cash.registeredAccountsBalance).toBe(1_000_000);
    expect(
      result.debts.find((d) => d.partyKey.startsWith("agent:"))?.receivable,
    ).toBe(400_000);
  });
  it("opposite balances on separate orders stay separately payable and receivable", () => {
    const second = { ...context, orderId: "order-b" };
    const result = report([
      entry({ kind: "sale", amount: 100_000 }),
      entry({ kind: "sale", amount: 100_000 }, second),
      entry(
        {
          kind: "payment",
          amount: 200_000,
          fromParty: "agent",
          toParty: "company",
          toAccountId: "bank",
        },
        second,
      ),
    ]);
    const dealer = result.debts[0];
    expect(dealer.net).toBe(0);
    expect(dealer.receivable).toBe(100_000);
    expect(dealer.payable).toBe(100_000);
  });
  it("keeps loss-making zero-order ads and makes all grouping totals reconcile", () => {
    const second = {
      ...context,
      orderId: "order-b",
      productId: "product-b",
      agentId: "agent-b",
      quantity: 2,
    };
    const result = report(
      [
        ...commercial(),
        entry({ kind: "sale", amount: 400_000 }, second),
        entry({ kind: "direct_cost", amount: 300_000 }, second),
      ],
      [
        { adGroupId: "ad-a", spentAmount: 100_001 },
        { adGroupId: "no-orders", spentAmount: 80_000 },
      ],
    );
    expect(result.products).toHaveLength(3);
    expect(
      result.adGroups.find((g) => g.key === "no-orders")?.recordedNetProfit,
    ).toBe(-80_000);
    const total = (rows: any[], field: string) =>
      rows.reduce((s, r) => s + r[field], 0);
    expect(result.productCategories).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "category-a", name: "Thẻ tập huấn", code: "TTH" }),
    ]));
    for (const rows of [result.productCategories, result.products, result.agents, result.adGroups]) {
      expect(total(rows, "advertisingCost")).toBe(180_001);
      expect(total(rows, "recordedNetProfit")).toBe(-1);
    }
  });
  it("flags missing cost and malformed/non-VND ad spend instead of pretending completeness", () => {
    const result = report(
      [entry({ kind: "sale", amount: 100 })],
      [{ spentAmount: -1 }, { spentAmount: 3, currency: "USD" }],
    );
    expect(result.quality.unreviewedOrders).toBe(1);
    expect(result.quality.invalidAds).toBe(2);
    expect(result.quality.automaticAdsDecisionsAllowed).toBe(false);
  });
  it("does not allocate ambiguous provider/account IDs to a product", () => {
    const result = report(commercial(), [
      {
        adGroupId: "ad-a",
        channel: "google",
        customerId: "one",
        spentAmount: 100,
      },
      {
        adGroupId: "ad-a",
        channel: "google",
        customerId: "two",
        spentAmount: 200,
      },
    ]);
    expect(result.quality.ambiguousAdGroupIds).toEqual(["ad-a"]);
    expect(
      result.products.find((p) => p.key === "product-a")?.advertisingCost,
    ).toBe(0);
    expect(
      result.products.find((p) => p.key === "unallocated")?.advertisingCost,
    ).toBe(300);
    expect(result.adGroups[0].advertisingCost).toBe(300);
  });
  it("cannot mark an entirely reversed commercial record as settled", () => {
    const original = commercial();
    const reversals = original.map((e) => ({
      ...e,
      _id: `reverse-${e._id}`,
      kind: "reversal",
      reversalOf: e._id,
      effects: reverseEffects(e.effects),
    }));
    const result = report([...original, ...reversals]);
    expect(result.orders[0].settlementStatus).toBe("unreviewed");
    expect(result.orders[0].needsReview).toBe(true);
  });
  it("uses Vietnam day boundaries and excludes later entries from cash/debt", () => {
    expect(rangeDates("2026-09-01", "2026-09-01").start.toISOString()).toBe(
      "2026-08-31T17:00:00.000Z",
    );
    const future = pay(100_000, "agent", "company");
    future.occurredAt = new Date("2026-09-02T17:00:00Z");
    expect(report([future], [], [account]).cash.registeredAccountsBalance).toBe(
      1_000_000,
    );
    expect(() => rangeDates("2026-02-30", "2026-03-01")).toThrow();
    expect(allocateVnd(100_001, [1, 2])).toEqual([33334, 66667]);
  });
  it.each([-1, 0.5, NaN, Infinity, 1e13])(
    "rejects invalid VND amount %s",
    (amount) => {
      expect(() =>
        calculateEffects({ kind: "sale", amount }, context),
      ).toThrow();
    },
  );
});
