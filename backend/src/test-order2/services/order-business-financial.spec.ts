import { OrderCalculationService } from './order-calculation.service';
import { dealerSaleAmounts } from '../dealer-sale';

describe('Purchase/resale accounting and independent collections', () => {
  const service = () => new OrderCalculationService({} as any, {} as any, {} as any, {} as any, {
    getReturnStatusNames: async () => ['Hàng hoàn'],
    getPaymentTriggerStatusNames: async () => ['Giao thành công', 'Hàng hoàn'],
  } as any, { get: async () => undefined } as any);
  const retail = (extra = {}) => ({ quantity: 1, supplierQuoteId: 'quote', supplierAppliedPrice: 120000,
    shippingFee: 20000, returnFee: 30000, retailSaleAmount: 300000, codAmount: 200000,
    depositAmount: 100000, orderStatus: 'Giao thành công', advertisingCost: 0,
    laborCostAllocation: 0, otherCostAllocation: 0, ...extra } as any);
  it('recognizes the full price, independent of deposit and the remaining COD', async () => {
    const row = retail();
    expect(await service().calculateGrossProfit(row)).toBe(160000);
    expect(row.recognizedRevenue).toBe(300000);
  });
  it('requires review when legacy retail price is unknown', async () => {
    const row = retail({ retailSaleAmount: undefined });
    await service().calculateGrossProfit(row);
    expect(row.retailProfitState).toBe('missing_sale_price');
    expect(row.recognizedRevenue).toBe(0);
  });
  it.each(['Giao thành công', 'Hàng hoàn'])('does not change a real receipt/payment on %s', async orderStatus => {
    const row = retail({ orderStatus, codCollectedBySupplier: 50000, supplierPaidAmount: 10000 });
    await service().applyCompletedStatusFinancials(row);
    expect(row.codCollectedBySupplier).toBe(50000);
    expect(row.supplierPaidAmount).toBe(10000);
  });
  it('recovers company stock value without reducing supplier obligation', async () => {
    const row = retail({ orderStatus: 'Hàng hoàn', recoveredInventoryValue: 120000 });
    expect(await service().calculateGrossProfit(row)).toBe(-50000);
    expect(row.supplierContractAmount).toBe(170000);
    expect(row.recognizedGoodsCost).toBe(0);
  });
  it('uses the old stock cost without another supplier obligation', async () => {
    const row = retail({ productSource: 'inventory', inventoryUnitCostSnapshot: 120000, supplierAppliedPrice: 900000 });
    expect(await service().calculateGrossProfit(row)).toBe(160000);
    expect(row.supplierContractAmount).toBe(0);
  });
  it('keeps different outbound and return charge rates for the dealer', () => {
    const row = { agentId: 'dealer', quantity: 1, productionStatus: 'Đã trả kết quả', trackingNumber: 'VN',
      agentQuoteId: 'a', agentAppliedPrice: 250000, supplierQuoteId: 's', supplierAppliedPrice: 120000,
      shippingFee: 20000, returnFee: 30000, dealerShippingFeeSnapshot: 25000, dealerReturnFeeSnapshot: 35000 };
    expect(dealerSaleAmounts(row, true).contractAmount).toBe(310000);
    expect(dealerSaleAmounts(row, true).grossProfit).toBe(140000);
    expect(dealerSaleAmounts({ ...row, dealerShippingFeeSnapshot: 0 }, false).contractAmount).toBe(250000);
  });
});
