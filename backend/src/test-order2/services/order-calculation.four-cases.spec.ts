import { OrderCalculationService } from './order-calculation.service';
import { Types } from 'mongoose';

describe('Owner-confirmed four sale/delivery cases', () => {
  const service = () => new OrderCalculationService({} as any, {} as any, {} as any, {} as any, {
    getReturnStatusNames: async () => ['Hàng hoàn'],
    getPaymentTriggerStatusNames: async () => ['Giao thành công', 'Hàng hoàn', 'Hoàn thành'],
  } as any, { get: async () => undefined } as any);
  const input = () => ({ quantity: 2, productionStatus: 'Đã trả kết quả', trackingNumber: 'VN-1',
    supplierQuoteId: 'supplier-quote', supplierAppliedPrice: 120000, supplierQuote: 120000,
    agentQuoteId: 'dealer-quote', agentAppliedPrice: 250000,
    shippingFee: 20000, returnFee: 30000, codAmount: 600000, retailSaleAmount: 600000, packagingCostSnapshot: 0,
    supplierIsReturnableSnapshot: true, dealerShippingIncludedInPrice: true,
  });
  it.each([
    ['dealer delivered', 'dealer', 'Giao thành công', 500000, 260000, 520000, 260000],
    ['dealer returned', 'dealer', 'Hàng hoàn', 500000, 290000, 550000, 260000],
    ['retail delivered', undefined, 'Giao thành công', 600000, 260000, undefined, 340000],
    ['retail returned', undefined, 'Hàng hoàn', 0, 290000, undefined, -290000],
  ])('%s', async (_name, agentId, orderStatus, revenue, supplierObligation, dealerObligation, profit) => {
    const order: any = { ...input(), agentId, orderStatus };
    expect(await service().calculateGrossProfit(order)).toBe(profit);
    expect(order.recognizedRevenue).toBe(revenue);
    expect(order.recognizedGoodsCost).toBe(240000);
    expect(order.supplierContractAmount).toBe(supplierObligation);
    expect(order.dealerContractAmount).toBe(dealerObligation);
  });
  it.each([true, false, undefined])('retail return keeps full supplier cost with old isReturnable=%s', async flag => {
    const order: any = { ...input(), supplierIsReturnableSnapshot: flag, orderStatus: 'Hàng hoàn' };
    await service().applyCompletedStatusFinancials(order);
    expect(order.grossProfit).toBe(-290000);
    expect(order.recognizedRevenue).toBe(0);
    expect(order.recognizedGoodsCost).toBe(240000);
    expect(order.supplierContractAmount).toBe(290000);
  });
  it.each(['Đang giao', 'Hoàn thành'])('retail does not treat %s as delivery success or a final return', async orderStatus => {
    const order: any = { ...input(), orderStatus };
    expect(await service().calculateGrossProfit(order)).toBe(0);
    expect(order.retailProfitState).toBe('awaiting_delivery');
    expect(order.recognizedRevenue).toBe(0);
  });
  it('subtracts advertising and other allocated costs after the four-case calculation', async () => {
    const order: any = { ...input(), orderStatus: 'Hàng hoàn', advertisingCost: 30000,
      laborCostAllocation: 10000, otherCostAllocation: 5000 };
    expect(await service().calculateNetProfit(order)).toBe(-335000);
  });
  it('uses retail recognition when the assigned account is an internal company agent', async () => {
    const model = { db: { collection: () => ({ findOne: async () => ({ role: 'internal_agent' }) }) } };
    const calc = new OrderCalculationService(model as any, {} as any, {} as any, {} as any, {
      getReturnStatusNames: async () => ['Hàng hoàn'],
      getPaymentTriggerStatusNames: async () => ['Giao thành công'],
    } as any, { get: async () => undefined } as any);
    const order: any = { ...input(), agentId: new Types.ObjectId(), orderStatus: 'Giao thành công' };
    expect(await calc.calculateGrossProfit(order)).toBe(340000);
    expect(order).toEqual(expect.objectContaining({
      saleMode: 'retail',
      agentRoleSnapshot: 'internal_agent',
      recognizedRevenue: 600000,
      retailProfitState: 'recognized',
    }));
    expect(order.dealerProfitState).toBeUndefined();
    expect(order.dealerContractAmount).toBeUndefined();
  });
});
