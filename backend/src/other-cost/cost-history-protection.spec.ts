import { ConflictException } from '@nestjs/common';
import { LaborCost1Service } from '../labor-cost1/labor-cost1.service';
import { OtherCostService } from './other-cost.service';

describe('Cost history protection', () => {
  it('does not edit or delete a confirmed operating cost', async () => {
    const row = { _id: 'cost-1', isConfirmed: true, date: new Date() };
    const model = {
      findById: () => ({ exec: async () => row }),
      findByIdAndDelete: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    const service = new OtherCostService(model as any, {} as any, { emit: jest.fn() } as any);
    await expect(service.update('cost-1', { notes: 'changed' })).rejects.toThrow(ConflictException);
    await expect(service.remove('cost-1')).rejects.toThrow(ConflictException);
    expect(model.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('does not edit or delete labor costs already included in a statement', async () => {
    const row = { _id: 'labor-1', paid: false, statementId: 'statement-1', paymentStatus: 'in_statement' };
    const model = {
      findById: () => ({ exec: async () => row }),
      findByIdAndDelete: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    const service = new LaborCost1Service(
      model as any, {} as any, {} as any, {} as any, {} as any,
    );
    await expect(service.update('labor-1', { notes: 'changed' })).rejects.toThrow(ConflictException);
    await expect(service.remove('labor-1')).rejects.toThrow(ConflictException);
    expect(model.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
