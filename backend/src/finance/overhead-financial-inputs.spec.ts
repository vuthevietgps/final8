import { LaborCost1Service } from '../labor-cost1/labor-cost1.service';
import { OtherCostService } from '../other-cost/other-cost.service';
import { FINANCIAL_INPUT_CHANGED } from '../advertising-cost/advertising-cost-refresh.module';

const query = (value: any) => ({ exec: async () => value });
const userId = '64b000000000000000000001';

describe.each(['labor', 'other'])('%s cost propagation', kind => {
  function fixture() {
    let row: any = { _id: 'cost', date: new Date('2026-09-04T17:30:00Z'), userId,
      startTime: '08:00', endTime: '10:00', hourlyRate: 100, cost: 200, amount: 200 };
    const events: any = { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) };
    const direct = { recalculateOrdersForDate: jest.fn() };
    const model: any = function(payload) { this.save = async () => (row = { _id: 'cost', ...payload }); };
    model.create = jest.fn(async payload => (row = { _id: 'cost', ...payload }));
    model.findById = () => query({ ...row });
    model.findByIdAndUpdate = jest.fn((_id, patch) => query(row = { ...row, ...(patch.$set || patch) }));
    model.findByIdAndDelete = jest.fn(() => query(row));
    const labor = new LaborCost1Service(model, { findOne: () => query({ hourlyRate: 100 }) } as any,
      {} as any, {} as any, direct as any, events);
    const other = new OtherCostService(model, direct as any, events);
    return { service: kind === 'labor' ? labor : other, events, direct, model, labor };
  }

  it('awaits durable refresh after create, and refreshes the source day again after deletion', async () => {
    const h = fixture();
    let release: () => void;
    h.events.emitAsync.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve([]); }));
    const payload: any = kind === 'labor'
      ? { date: '2026-09-05', userId, startTime: '08:00', endTime: '10:00' }
      : { date: '2026-09-05', dueDate: '2026-09-10', amount: 200 };
    let completed = false;
    const creating = h.service.create(payload).then(() => { completed = true; });
    await new Promise(resolve => setImmediate(resolve));
    expect(completed).toBe(false);
    expect(h.events.emitAsync).toHaveBeenCalledWith(FINANCIAL_INPUT_CHANGED, { dates: ['2026-09-05'], revalue: false });
    release!(); await creating;
    await h.service.remove('cost');
    expect(h.events.emitAsync).toHaveBeenCalledTimes(2);
    expect(h.events.emitAsync).toHaveBeenLastCalledWith(FINANCIAL_INPUT_CHANGED, { dates: ['2026-09-05'], revalue: false });
    expect(h.direct.recalculateOrdersForDate).not.toHaveBeenCalled();
  });

  it('refreshes both Vietnam days on move and propagates failures after the source is saved', async () => {
    const h = fixture();
    const update: any = kind === 'labor' ? { date: '2026-09-06', endTime: '12:00' } : { date: '2026-09-06', amount: 400 };
    h.events.emitAsync.mockRejectedValueOnce(new Error('projection pending'));
    await expect(h.service.update('cost', update)).rejects.toThrow('projection pending');
    expect(h.model.findByIdAndUpdate).toHaveBeenCalled();
    expect(h.events.emitAsync).toHaveBeenCalledWith(FINANCIAL_INPUT_CHANGED, { dates: ['2026-09-05', '2026-09-06'], revalue: false });
  });
});

describe('Labor input calendar on a UTC deployment', () => {
  const service: any = new LaborCost1Service({} as any, {} as any, {} as any, {} as any, {} as any);
  it('normalizes date-only and early-morning timestamps to Vietnam midnight', () => {
    for (const value of ['2026-09-05', '2026-09-04T17:30:00Z', new Date('2026-09-04T17:30:00Z')]) {
      expect(service.startOfDay(value).toISOString()).toBe('2026-09-04T17:00:00.000Z');
    }
    expect(service.formatTime(new Date('2026-09-04T17:30:00Z'))).toBe('00:30');
    expect(() => service.startOfDay('2026-02-30')).toThrow('Invalid date');
  });
});
