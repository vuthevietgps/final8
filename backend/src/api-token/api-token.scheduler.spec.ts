import { ApiTokenScheduler } from './api-token.scheduler';

describe('ApiTokenScheduler Meta freshness cadence', () => {
  const previousEnv = process.env;

  afterEach(() => {
    process.env = previousEnv;
    jest.restoreAllMocks();
  });

  it('defaults system-user sync to ten minutes', async () => {
    process.env = {
      ...previousEnv,
      FB_SYSTEM_USER_SYNC_INTERVAL_MINUTES: undefined,
    };
    const tokenService = {
      syncFanpagesFromSystemUserToken: jest.fn().mockResolvedValue({
        ok: true,
        created: 0,
        updated: 0,
        tokensUpserted: 0,
        adAccountsCreated: 0,
        adAccountsUpdated: 0,
      }),
    };
    const scheduler = new ApiTokenScheduler({} as any, tokenService as any);
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    await (scheduler as any).trySystemUserFanpageSync();
    now += 9 * 60 * 1000;
    await (scheduler as any).trySystemUserFanpageSync();
    now += 60 * 1000;
    await (scheduler as any).trySystemUserFanpageSync();

    expect(tokenService.syncFanpagesFromSystemUserToken).toHaveBeenCalledTimes(2);
    expect(tokenService.syncFanpagesFromSystemUserToken).toHaveBeenCalledWith({
      allowNoToken: true,
      upsertApiTokens: true,
    });
  });
});
