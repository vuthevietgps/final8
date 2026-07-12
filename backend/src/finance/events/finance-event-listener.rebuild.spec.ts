import { ServiceUnavailableException } from '@nestjs/common';
import { FinanceEventListenerService } from './finance-event-listener.service';

describe('FinanceEventListenerService snapshot bootstrap', () => {
  const subject = (staleness = 0) => {
    const service: any = Object.create(FinanceEventListenerService.prototype);
    service.refreshLaborSnapshots = jest.fn().mockResolvedValue(undefined);
    service.refreshOpsSnapshots = jest.fn().mockResolvedValue(undefined);
    service.refreshAgentSnapshots = jest.fn().mockResolvedValue(undefined);
    service.refreshSupplierSnapshot = jest.fn().mockResolvedValue(undefined);
    service.snapshotService = { getStaleness: jest.fn().mockResolvedValue(staleness) };
    service.invalidateFinanceCaches = jest.fn();
    return service as FinanceEventListenerService;
  };

  it('rebuilds and verifies all required non-tax canonical snapshots', async () => {
    const service: any = subject();
    const result = await service.rebuildCanonicalSnapshots();

    expect(result.schemaVersion).toBe('financial_snapshot_rebuild.v1');
    expect(result.refreshed).toHaveLength(10);
    expect(service.invalidateFinanceCaches).toHaveBeenCalledWith('financial-snapshot-rebuild');
  });

  it('fails closed when any rebuilt snapshot is missing or stale', async () => {
    const service = subject(Infinity);
    await expect(service.rebuildCanonicalSnapshots())
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
