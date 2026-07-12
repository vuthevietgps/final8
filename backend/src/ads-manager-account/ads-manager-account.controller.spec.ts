import { PERMISSIONS_KEY, ROLES_KEY } from '../auth/decorators/auth.decorator';
import { UserRole } from '../user/user.enum';
import { AdsManagerAccountController } from './ads-manager-account.controller';

describe('AdsManagerAccountController read-only verification authorization', () => {
  it('requires a Director with credential-write permission and passes the authenticated user ID', async () => {
    const service = {
      verifyAndImportReadOnly: jest.fn().mockResolvedValue({
        safety: { execution_allowed_now: false },
      }),
    };
    const controller = new AdsManagerAccountController(service as any);
    const handler = AdsManagerAccountController.prototype.verifyReadOnly;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.DIRECTOR]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      'google-ads.credentials.write',
    ]);

    await expect(controller.verifyReadOnly(
      { _id: 'director-user-id', role: UserRole.DIRECTOR },
      'manager-id',
    )).resolves.toEqual({ safety: { execution_allowed_now: false } });
    expect(service.verifyAndImportReadOnly).toHaveBeenCalledWith(
      'manager-id',
      'director-user-id',
    );
  });
});
