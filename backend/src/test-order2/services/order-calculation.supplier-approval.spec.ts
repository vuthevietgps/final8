import { Types } from 'mongoose';
import { OrderCalculationService } from './order-calculation.service';

describe('OrderCalculationService supplier quote approval boundary', () => {
  it('preserves a product fallback snapshot after dispatch even when the catalog price changes', async () => {
    const productModel = { findById: jest.fn() };
    const service: any = new OrderCalculationService({} as any, productModel as any, {} as any, {} as any, {} as any, {} as any);
    const order: any = { productId: new Types.ObjectId(), trackingNumber: 'dispatched', supplierQuoteSnapshotAt: new Date(),
      supplierPriceSource: 'product_fallback', supplierAppliedPrice: 100000, supplierQuote: 100000 };
    await service.calculateSupplierQuote(order);
    expect(order.supplierAppliedPrice).toBe(100000);
    expect(productModel.findById).not.toHaveBeenCalled();
  });
  it('queries only approved, effective quotes for both price and fee snapshots', async () => {
    const supplierQueries: any[] = [];
    const supplierQuoteModel = {
      findOne: jest.fn((query: any) => {
        supplierQueries.push(query);
        const chain: any = {
          sort: jest.fn(() => chain),
          lean: jest.fn().mockResolvedValue(null),
        };
        return chain;
      }),
    };
    const productModel = {
      findById: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({
          importPrice: 100_000,
          shippingCost: 20_000,
          packagingCost: 10_000,
          isReturnable: true,
        }),
      })),
    };
    const service = new OrderCalculationService(
      undefined as any,
      productModel as any,
      undefined as any,
      supplierQuoteModel as any,
      undefined as any,
      undefined as any,
    );
    const orderDate = new Date('2026-07-10T00:00:00.000Z');
    const doc: any = {
      productId: new Types.ObjectId(),
      supplierId: new Types.ObjectId(),
      orderDate,
      shippingFee: 0,
      returnFee: 0,
    };

    await (service as any).calculateSupplierQuote(doc);
    await (service as any).calculateShippingAndReturnFees(doc);

    // Fee calculation uses the same snapshot; it must not fetch a second quote.
    expect(supplierQueries).toHaveLength(1);
    for (const query of supplierQueries) {
      expect(query).toEqual(expect.objectContaining({
        productId: { $in: [String(doc.productId), doc.productId] },
        supplierId: { $in: [String(doc.supplierId), doc.supplierId] },
        approvalStatus: 'approved',
        $or: [
          { effectiveAt: { $lte: orderDate } },
          { effectiveAt: { $exists: false }, createdAt: { $lte: orderDate } },
        ],
      }));
    }
  });
});
