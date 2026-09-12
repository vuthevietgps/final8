import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { BusinessLedgerService } from './business-ledger.service';
import { CreateLedgerProfileDto } from './business-ledger.dto';
import { CreateProductDto } from '../product/dto/create-product.dto';

function fixture(policy?: string, terms?: string) {
  const product: any = { _id: new Types.ObjectId(), name: 'Synthetic product', dealerReturnPolicy: policy, dealerReturnTerms: terms };
  const order: any = { _id: new Types.ObjectId(), productId: product, agentId: new Types.ObjectId(), supplierId: new Types.ObjectId(), quantity: 1, orderDate: new Date('2026-09-01') };
  let saved: any;
  const query = (value: any): any => ({ populate: () => query(value), lean: async () => value });
  const orders: any = { findById: () => query(order) };
  const profiles: any = { findOne: () => query(saved), create: jest.fn(async value => (saved = value)) };
  const service = new BusinessLedgerService({} as any, {} as any, profiles, orders);
  const dto: CreateLedgerProfileDto = { orderId: String(order._id), saleMode: 'dealer', fulfillment: 'supplier_direct', returnPolicy: 'production_committed', evidence: 'Synthetic agreement' };
  return { service, product, dto, profiles, actor: String(new Types.ObjectId()) };
}

describe('Product-specific dealer return obligation', () => {
  it.each([undefined, 'unconfigured', 'no_goods_charge', 'supplier_cost', 'full_sale_price', 'by_agreement'])
  ('new dealer contract treats dealer as end customer despite old product setting: %s', async policy => {
    const f = fixture(policy, 'Old product terms');
    const profile = await f.service.createProfile(f.dto, f.actor);
    expect(profile.context.returnPolicy).toBe('production_committed');
    expect(profile.context.dealerReturnPolicy).toBe('full_sale_price');
    expect(profile.context.dealerReturnTerms).toContain('giữ hộ');
  });
  it('retail orders do not require or inherit dealer policy', async () => {
    const f = fixture();
    const profile = await f.service.createProfile({ ...f.dto, saleMode: 'retail' }, f.actor);
    expect(profile.context.dealerReturnPolicy).toBeUndefined();
  });
  it('product edits and retries do not rewrite the previously accepted dealer contract', async () => {
    const f = fixture('no_goods_charge', 'Original terms');
    const first = await f.service.createProfile(f.dto, f.actor);
    f.product.dealerReturnPolicy = 'full_sale_price';
    f.product.dealerReturnTerms = 'New terms';
    const retry = await f.service.createProfile(f.dto, f.actor);
    expect(retry).toBe(first);
    expect(retry.context.dealerReturnPolicy).toBe('full_sale_price');
    expect(retry.context.dealerReturnTerms).toContain('giữ hộ');
    expect(f.profiles.create).toHaveBeenCalledTimes(1);
  });
  it('clients cannot override the product policy through the ledger profile API', async () => {
    const f = fixture('no_goods_charge');
    const errors = await validate(Object.assign(new CreateLedgerProfileDto(), f.dto, { dealerReturnPolicy: 'full_sale_price' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some(error => error.property === 'dealerReturnPolicy')).toBe(true);
  });
  it('product API accepts configured policies and rejects invalid values', async () => {
    const dto = Object.assign(new CreateProductDto(), { name: 'Test', categoryId: String(new Types.ObjectId()), dealerReturnPolicy: 'supplier_cost' });
    expect(await validate(dto)).toHaveLength(0);
    dto.dealerReturnPolicy = 'invalid' as any;
    expect((await validate(dto)).some(error => error.property === 'dealerReturnPolicy')).toBe(true);
  });
});
