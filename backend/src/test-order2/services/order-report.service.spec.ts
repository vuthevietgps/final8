import { Types } from "mongoose";
import { OrderReportService } from "./order-report.service";

describe("Legacy order report corrections", () => {
  it("keeps two populated products separate and does not charge dealer resale margin as company commission", async () => {
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    const rows = [
      {
        productId: { _id: a, name: "A" },
        quantity: 1,
        netProfit: 10,
        agentQuote: 400000,
        agentCommissionAmount: 100000,
      },
      {
        productId: { _id: b, name: "B" },
        quantity: 1,
        netProfit: 20,
        agentQuote: 450000,
        agentCommissionAmount: 50000,
      },
    ];
    const model = {
      find: () => ({ populate: () => ({ lean: async () => rows }) }),
    };
    const result = await new OrderReportService(
      model as any,
      { report: async () => ({
        products: rows.map((row: any) => ({ key: String(row.productId._id), name: row.productId.name,
          color: '#888888', orders: 1, quantity: row.quantity, revenue: 0, cogs: 0, advertisingCost: 0,
          laborCostAllocation: 0, otherCostAllocation: 0, recordedNetProfit: row.netProfit,
          needsReview: 0, unallocatedAdvertisingCost: 0 })),
        basis: 'test', quality: {},
      }) } as any,
    ).getProductProfitReport({ date: "2026-09-01" });
    expect(result.totals.totalProducts).toBe(2);
    expect(result.products.map((p) => p.productId)).toEqual(
      expect.arrayContaining([String(a), String(b)]),
    );
    expect(result.totals.totalAgentCommission).toBe(0);
  });
  it('reports recognized dealer revenue and cost even while shipping or returned', async () => {
    const p = new Types.ObjectId();
    const row = { productId: { _id: p }, quantity: 1, dealerProfitState: 'recognized',
      orderStatus: 'Đang giao', recognizedRevenue: 250000, recognizedGoodsCost: 120000,
      codAmount: 900000, depositAmount: 100000, grossProfit: 125000, netProfit: 95000 };
    const model = { find: jest.fn((_filter?: any) => ({ populate: () => ({ lean: async () => [row] }) })) };
    const report = await new OrderReportService(model as any, { report: async () => ({
      products: [{ key: String(p), name: 'P', color: '#888888', orders: 1, quantity: 1,
        revenue: 250000, cogs: 120000, advertisingCost: 30000, laborCostAllocation: 0,
        otherCostAllocation: 0, recordedNetProfit: 95000, needsReview: 0,
        unallocatedAdvertisingCost: 0 }], basis: 'test', quality: {},
    }) } as any).getProductProfitReport({ date: '2026-09-01' });
    expect(report.totals.totalRevenue).toBe(250000);
    expect(report.totals.totalProductCost).toBe(120000);
    expect(report.accountingBasis).toBe('test');
  });
  it("never presents profit as spendable cash", async () => {
    const model = {
      find: async () => [
        {
          orderStatus: "Giao thành công",
          realizedAt: new Date(),
          realizedNetProfit: 100000,
        },
      ],
    };
    const result = await new OrderReportService(
      model as any,
      { report: async () => ({
        orders: [], basis: 'test', quality: { unreviewedOrders: 0 },
      }) } as any,
    ).getDailyProfitReport("2026-09-01");
    expect(result.realized.totalNetProfit).toBe(100000);
    expect(result.cashAvailable).toBeNull();
    expect(result.cashAvailableStatus).toBe("requires_account_reconciliation");
  });
});
