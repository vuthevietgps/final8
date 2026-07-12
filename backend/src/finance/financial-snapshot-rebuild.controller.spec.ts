import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { FinancialSnapshotRebuildController } from './financial-snapshot-rebuild.controller';

describe('FinancialSnapshotRebuildController authorization', () => {
  it('requires authenticated finance policy management', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, FinancialSnapshotRebuildController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(
      PERMISSIONS_KEY,
      FinancialSnapshotRebuildController.prototype.rebuild,
    )).toEqual(['finance.policy.manage']);
  });
});
