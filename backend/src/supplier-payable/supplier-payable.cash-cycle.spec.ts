import { Types } from 'mongoose';
import { SupplierPayableService } from './supplier-payable.service';

describe('SupplierPayableService canonical cash-cycle forecast', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-10T02:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('prefers explicit due dates and uses FinancialControl SupplierCashCycleDays only as fallback', async () => {
    const explicitOrderId = new Types.ObjectId();
    const fallbackOrderId = new Types.ObjectId();
    const unlinkedPayableId = new Types.ObjectId();
    const supplierId = new Types.ObjectId();
    const explicitPayable = {
        supplierId,
        orderId: explicitOrderId,
        balance: 1_000,
        dueDate: new Date('2026-07-12T00:00:00.000Z'),
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      };
    const fallbackPayable = {
        supplierId,
        orderId: fallbackOrderId,
        balance: 2_000,
        createdAt: new Date('2026-06-21T00:00:00.000Z'),
      };
    const unlinkedPayable = {
      _id: unlinkedPayableId,
      supplierId,
      balance: 300,
      dueDate: new Date('2026-07-12T00:00:00.000Z'),
      createdAt: new Date('2026-07-02T00:00:00.000Z'),
    };
    const payables = [
      explicitPayable,
      { ...explicitPayable },
      fallbackPayable,
      { ...fallbackPayable },
      unlinkedPayable,
      { ...unlinkedPayable },
    ];
    const payableModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(payables) }),
      }),
    };
    const orderModel = {
      aggregate: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      }),
    };
    const statementModel = {
      aggregate: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    };
    const settingsModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ value: { SupplierCashCycleDays: 21 } }),
        }),
      }),
    };
    const service = new SupplierPayableService(
      payableModel as any,
      orderModel as any,
      statementModel as any,
      settingsModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getCashflowSummary();

    expect(settingsModel.findOne).toHaveBeenCalledWith({ key: 'financial_control' });
    expect(result.settlementCycleDays).toBe(21);
    expect(result.settlementCycleSource).toBe('financial_control.SupplierCashCycleDays');
    expect(result.dueDateFallbackCount).toBe(1);
    expect(result.expectedInflowByDay.find((day) => day.date === '2026-07-12')).toEqual(
      expect.objectContaining({
        grossAmount: 3_300,
        riskAdjustment: 0,
        onTimeAdjustment: -495,
        netAmount: 2_805,
        orderCount: 3,
      }),
    );
    expect(orderModel.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        $match: expect.objectContaining({
          _id: { $nin: [explicitOrderId, fallbackOrderId] },
        }),
      }),
    ]));
  });

  it('applies statement coverage per supplier and excludes late-created or unlinked covered payables', async () => {
    const supplierA = new Types.ObjectId();
    const coveredOrderId = new Types.ObjectId();
    const lateLinkedPayable = {
      _id: new Types.ObjectId(),
      supplierId: supplierA,
      orderId: coveredOrderId,
      balance: 700,
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      createdAt: new Date('2026-07-05T00:00:00.000Z'),
    };
    const unlinkedCoveredPayable = {
      _id: new Types.ObjectId(),
      supplierId: supplierA,
      balance: 900,
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      createdAt: new Date('2026-07-05T00:00:00.000Z'),
    };
    const payableModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([lateLinkedPayable, unlinkedCoveredPayable]),
        }),
      }),
    };
    const orderAggregate = jest.fn(async (pipeline: any[]) => {
      const match = pipeline?.[0]?.$match || {};
      if (match.updatedAt?.$lte) {
        const day = new Date(match.updatedAt.$lte).toISOString().slice(0, 10);
        return day === '2026-06-30' ? [{ amount: 500, orderCount: 1 }] : [];
      }
      return [];
    });
    const orderModel = {
      aggregate: orderAggregate,
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{
            _id: coveredOrderId,
            supplierId: supplierA,
            orderDate: new Date('2026-06-30T00:00:00.000Z'),
          }]),
        }),
      }),
    };
    const statementModel = {
      aggregate: jest.fn().mockResolvedValue([{
        totalStatements: 1,
        openStatements: 1,
        totalReceived: 0,
        totalGrossPayables: 1_000,
        totalStatementAdjustments: 0,
      }]),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{
        supplierId: supplierA,
        periodFrom: new Date('2026-06-01T00:00:00.000Z'),
        periodTo: new Date('2026-07-01T00:00:00.000Z'),
        closingBalance: 1_000,
        status: 'open',
      }]) }),
    };
    const settingsModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ value: { SupplierCashCycleDays: 10 } }),
        }),
      }),
    };
    const service = new SupplierPayableService(
      payableModel as any,
      orderModel as any,
      statementModel as any,
      settingsModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getCashflowSummary();

    const today = result.expectedInflowByDay.find((day) => day.date === '2026-07-10');
    expect(today).toEqual(expect.objectContaining({ grossAmount: 500, orderCount: 1 }));
    const dailyMatch = orderAggregate.mock.calls
      .map((call) => call[0]?.[0]?.$match)
      .find((match) => match?.updatedAt?.$lte && new Date(match.updatedAt.$lte).toISOString().slice(0, 10) === '2026-06-30');
    expect(dailyMatch).not.toHaveProperty('orderDate');
    expect(dailyMatch.$nor).toEqual([{
      supplierId: supplierA,
      $or: [
        { orderDate: { $lte: new Date('2026-07-01T00:00:00.000Z') } },
        {
          orderDate: null,
          updatedAt: { $lte: new Date('2026-07-01T00:00:00.000Z') },
        },
      ],
    }]);
    expect(dailyMatch._id).toEqual({ $nin: [coveredOrderId] });
  });
});
