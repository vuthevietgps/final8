import { ProductService } from '../product/product.service';
import { SupplierQuoteService } from '../supplier-quote/supplier-quote.service';
import { QuoteService } from '../quote/quote.service';
import { DeliveryStatusService } from '../delivery-status/delivery-status.service';
import { FINANCIAL_INPUT_CHANGED } from '../advertising-cost/advertising-cost-refresh.module';
import { Types } from 'mongoose';

const productId = '64b000000000000000000001';
const query = (value: any): any => ({ populate: () => query(value), exec: async () => value, lean: async () => value });

describe('financial source mutation events', () => {
  it('awaits propagation after a product update, including forecast-only assumptions', async () => {
    const model: any = { findByIdAndUpdate: () => query({ _id: productId }) };
    let release: () => void;
    const events: any = { emitAsync: jest.fn(() => new Promise<void>(resolve => { release = resolve; })) };
    const service = new ProductService(model, {} as any, events);
    let complete = false;
    const updating = service.update(productId, { assumedReturnRatePercent: 30 } as any).then(() => { complete = true; });
    await new Promise(resolve => setImmediate(resolve));
    expect(complete).toBe(false);
    expect(events.emitAsync).toHaveBeenCalledWith(FINANCIAL_INPUT_CHANGED, { productIds: [productId] });
    release!(); await updating;
    expect(complete).toBe(true);
  });

  it('publishes supplier quote approval only after the authenticated approval is persisted', async () => {
    const maker = new Types.ObjectId(); const director = new Types.ObjectId();
    const doc: any = { _id: new Types.ObjectId(), productId: new Types.ObjectId(productId),
      createdBy: maker, lastCommercialEditedBy: maker, price: 100, approvalStatus: 'pending', approvalHistory: [],
      markModified: jest.fn(), save: jest.fn(), toObject() { return { approvalStatus: this.approvalStatus }; } };
    const events: any = { emitAsync: jest.fn(async () => { expect(doc.save).toHaveBeenCalled(); expect(doc.approvalStatus).toBe('approved'); }) };
    const service = new SupplierQuoteService({ findById: async () => doc } as any, events);
    await service.approve(String(doc._id), { id: String(director), fullName: 'Fixture director' });
    expect(events.emitAsync).toHaveBeenCalledWith(FINANCIAL_INPUT_CHANGED, { productIds: [productId] });
  });

  it('refreshes both affected products when an agent quote changes product', async () => {
    const nextProduct = '64b000000000000000000002';
    const original = { _id: 'q', productId, agentId: 'a', validFrom: '2026-09-01', validUntil: '2026-10-01', status: 'Đã duyệt' };
    const model: any = { findById: () => query(original), findOneAndUpdate: () => query({ ...original, productId: nextProduct }) };
    const events: any = { emitAsync: jest.fn() };
    const service = new QuoteService(model, { findById: () => query({ name: 'Product' }) } as any, {} as any, events);
    await service.update('q', { productId: nextProduct } as any);
    expect(events.emitAsync).toHaveBeenCalledWith(FINANCIAL_INPUT_CHANGED, { productIds: [productId, nextProduct] });
  });

  it('re-evaluates orders when a delivery status changes its financial meaning', async () => {
    const old = { name: 'Carrier delivered', isFinal: false };
    const model: any = { findById: () => query(old), findByIdAndUpdate: () => query({ ...old, isFinal: true }) };
    const events: any = { emitAsync: jest.fn() };
    const service = new DeliveryStatusService(model, {} as any, events);
    await service.update('status', { isFinal: true } as any);
    expect(events.emitAsync).toHaveBeenCalledWith(FINANCIAL_INPUT_CHANGED, { statuses: [old.name, old.name] });
  });
});
