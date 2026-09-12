import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/auth.guard';
import { ProviderConnectionsController } from './provider-connections.controller';
import { SaveProviderConnectionDto } from './provider-connection.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Provider connection access boundary', () => {
  const guard = new RolesGuard(new Reflector());
  const context = (method: string, role: string) => ({
    getClass: () => ProviderConnectionsController,
    getHandler: () => ProviderConnectionsController.prototype[method],
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  }) as any;

  it.each(['create', 'update', 'check', 'list', 'pages'])('only allows credential administrators to %s', method => {
    expect(guard.canActivate(context(method, 'director'))).toBe(true);
    expect(guard.canActivate(context(method, 'manager'))).toBe(false);
    expect(guard.canActivate(context(method, 'employee'))).toBe(false);
  });

  it.each(['syncAdsRead', 'syncCatalog', 'adsSnapshot', 'adsSyncRuns'])('allows ads managers to use read-only Windsor data via %s', method => {
    expect(guard.canActivate(context(method, 'director'))).toBe(true);
    expect(guard.canActivate(context(method, 'manager'))).toBe(true);
    expect(guard.canActivate(context(method, 'employee'))).toBe(false);
  });

  it('rejects caller-supplied URL, live flags, and malformed account IDs', async () => {
    const input = plainToInstance(SaveProviderConnectionDto, {
      kind: 'windsor-google', name: 'Example', revision: 0, state: 'configured',
      accountIds: ['../another-account'], apiKey: 'fixture-key', url: 'https://evil.test', liveWriteEnabled: true,
    });
    const errors = await validate(input, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map(error => error.property)).toEqual(expect.arrayContaining(['accountIds', 'url', 'liveWriteEnabled']));
  });
});
