import { Types } from 'mongoose';
import { TestOrder2ImportService } from './test-order2-import.service';

describe('TestOrder2ImportService sale relationship', () => {
  it('maps internal agent to company retail and external agent to dealer', async () => {
    const internal = new Types.ObjectId();
    const external = new Types.ObjectId();
    let inserted: any[] = [];
    const users = [
      { _id: internal, role: 'internal_agent' },
      { _id: external, role: 'external_agent' },
    ];
    const model = {
      db: { collection: () => ({ find: () => ({ toArray: async () => users }) }) },
      insertMany: async (docs: any[]) => { inserted = docs; return docs; },
    };
    await new TestOrder2ImportService(model as any).importJson({ items: [
      { customerName: 'Retail', agentId: String(internal), retailSaleAmount: 300000 },
      { customerName: 'Dealer', agentId: String(external) },
      { customerName: 'Direct retail' },
    ] });
    expect(inserted.map(row => [row.saleMode, row.agentRoleSnapshot])).toEqual([
      ['retail', 'internal_agent'],
      ['dealer', 'external_agent'],
      ['retail', undefined],
    ]);
    expect(inserted.every(row => row.financialModelVersion === 2)).toBe(true);
  });

  it('rejects an agent id that is not a valid internal/external agent', async () => {
    const id = new Types.ObjectId();
    const model = {
      db: { collection: () => ({ find: () => ({ toArray: async () => [] }) }) },
      insertMany: jest.fn(),
    };
    await expect(new TestOrder2ImportService(model as any).importJson({
      items: [{ customerName: 'Invalid', agentId: String(id) }],
    })).rejects.toThrow('không tồn tại hoặc sai vai trò');
    expect(model.insertMany).not.toHaveBeenCalled();
  });
});
