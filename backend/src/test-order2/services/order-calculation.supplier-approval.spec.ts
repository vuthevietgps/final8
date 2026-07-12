import { Types } from 'mongoose';
import { OrderCalculationService } from './order-calculation.service';

describe('OrderCalculationService supplier quote approval boundary', () => {
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

    expect(supplierQueries).toHaveLength(2);
    for (const query of supplierQueries) {
      expect(query).toEqual(expect.objectContaining({
        productId: doc.productId,
        supplierId: doc.supplierId,
        approvalStatus: 'approved',
        $or: [
          { effectiveAt: { $lte: orderDate } },
          { effectiveAt: { $exists: false } },
        ],
      }));
    }
  });
});
