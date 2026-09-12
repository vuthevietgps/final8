import { TestOrder2Service } from '../test-order2.service';
import { OrderCalculationService } from './order-calculation.service';
import { FINANCIAL_INPUT_CHANGED } from '../../advertising-cost/advertising-cost-refresh.module';

describe('COD and deposit update propagation through the order service', () => {
  it.each([{ codAmount: 150000 }, { depositAmount: 150000 }, { codAmount: 0, depositAmount: 0 }])(
    'persists %j and waits for financial refresh without changing recognized sale or payment evidence', async patch => {
      const doc: any = { _id: 'order', financialModelVersion: 2, productId: 'product', supplierId: 'supplier',
        orderDate: new Date('2026-09-04T17:30:00Z'), adGroupId: 'g1', quantity: 1, productSource: 'supplier',
        orderStatus: 'Giao thành công', productionStatus: 'Đã trả kết quả', trackingNumber: 'VN-1',
        shipments: [{ status: 'delivered', shippingCost: 20000, returnCost: 0 }],
        supplierQuoteId: 'quote', supplierAppliedPrice: 120000, retailSaleAmount: 300000,
        shippingFee: 20000, returnFee: 0, advertisingCost: 40000, laborCostAllocation: 10000, otherCostAllocation: 5000,
        codAmount: 200000, depositAmount: 100000, codCollectedBySupplier: 50000, supplierPaidAmount: 10000,
        toObject() { return { ...this }; }, save: jest.fn(async () => doc),
      };
      const model: any = { findById: async () => doc };
      const product: any = { findById: () => ({ populate: () => ({ lean: async () => null }) }) };
      const calc = new OrderCalculationService(model, product, {} as any, {} as any,
        { getReturnStatusNames: async () => ['Hàng hoàn'] } as any, {} as any);
      let release: () => void;
      const events: any = { emit: jest.fn(), emitAsync: jest.fn(() => new Promise(resolve => { release = () => resolve([]); })) };
      const service = new TestOrder2Service(model, product, calc, {} as any, {} as any, {} as any,
        { triggerSyncOnOrderChange: async () => {} } as any, events, {} as any);
      let completed = false;
      const updating = service.update('order', patch).then(value => { completed = true; return value; });
      await new Promise(resolve => setImmediate(resolve));
      expect(doc.save).toHaveBeenCalled();
      expect(doc).toMatchObject(patch);
      expect(events.emitAsync).toHaveBeenCalledWith(FINANCIAL_INPUT_CHANGED, { dates: ['2026-09-05'], revalue: false });
      expect(completed).toBe(false);
      release!();
      expect(await updating).toMatchObject({ recognizedRevenue: 300000, recognizedGoodsCost: 120000,
        netProfit: 105000, codCollectedBySupplier: 50000, supplierPaidAmount: 10000 });
    },
  );
});
