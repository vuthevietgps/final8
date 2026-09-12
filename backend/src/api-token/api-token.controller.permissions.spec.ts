import { PERMISSIONS_KEY } from '../auth/decorators/auth.decorator';
import { ApiTokenController } from './api-token.controller';

describe('ApiTokenController Meta credential permissions', () => {
  it.each([
    ['syncFromSystemUser', 'meta-ads.credentials.write'],
    ['syncFromFanpages', 'meta-ads.credentials.write'],
    ['testAdAccount', 'meta-ads.credentials.read'],
  ])('protects %s with %s', (methodName, expectedPermission) => {
    const handler = (ApiTokenController.prototype as any)[methodName];
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      expectedPermission,
    ]);
  });
});
