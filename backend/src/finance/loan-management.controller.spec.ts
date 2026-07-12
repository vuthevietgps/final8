import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { LoanManagementController } from './loan-management.controller';

describe('LoanManagementController production authorization', () => {
  it('requires JWT and role guards for every endpoint', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LoanManagementController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, LoanManagementController)).toEqual(['finance']);
  });

  it('requires granular loan-management permission for payment execution', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, LoanManagementController.prototype.createPayment),
    ).toEqual(['finance.loan.manage']);
  });
});
