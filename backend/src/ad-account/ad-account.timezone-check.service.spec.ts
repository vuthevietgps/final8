import { AdAccountTimezoneCheckService } from './ad-account.timezone-check.service';

describe('AdAccountTimezoneCheckService Facebook authorization', () => {
  const previousEnv = process.env;
  const previousFetch = global.fetch;

  afterEach(() => {
    process.env = previousEnv;
    global.fetch = previousFetch;
    jest.restoreAllMocks();
  });

  it('reads timezone_name with a bearer token and never puts the token in the URL', async () => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      ENFORCE_AD_ACCOUNT_TIMEZONE: 'true',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        timezone_name: 'Asia/Ho_Chi_Minh',
      }),
    } as any);
    const apiTokenService = {
      getRawSystemUserToken: jest.fn().mockResolvedValue('system-user-token'),
      getRawAccessTokenForAdsManagement: jest.fn(),
    };
    const service = new AdAccountTimezoneCheckService(apiTokenService as any);

    await service.validateTimezone('facebook', 'act_123456789');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('fields=timezone_name'),
      {
        headers: { Authorization: 'Bearer system-user-token' },
      },
    );
    const requestedUrl = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(requestedUrl).not.toContain('system-user-token');
    expect(requestedUrl).not.toContain('access_token=');
  });
});
