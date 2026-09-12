import { FanpageService } from './fanpage.service';

describe('FanpageService credential storage', () => {
  const previousFetch = global.fetch;

  afterEach(() => {
    global.fetch = previousFetch;
    jest.restoreAllMocks();
  });

  it('creates a fanpage without persisting or returning a plaintext access token', async () => {
    const saved: any[] = [];
    const FanpageModel: any = jest.fn().mockImplementation((payload: any) => ({
      ...payload,
      _id: 'fanpage-id',
      save: jest.fn().mockImplementation(async function (this: any) {
        saved.push(this);
        return this;
      }),
    }));
    FanpageModel.exists = jest.fn().mockResolvedValue(false);
    FanpageModel.findByIdAndDelete = jest.fn().mockResolvedValue(undefined);
    const apiTokenService = { upsertFanpageAccessToken: jest.fn().mockResolvedValue(undefined) };
    const service = new FanpageService(
      FanpageModel,
      {} as any,
      apiTokenService as any,
    );

    const result = await service.create({
      pageId: '1234567890',
      name: 'Secure page',
      accessToken: 'page-access-token-value',
      openAIConfigId: '507f1f77bcf86cd799439011',
    } as any);

    const persisted = FanpageModel.mock.calls[0][0];
    expect(persisted.accessToken).toBeUndefined();
    expect(persisted.hasAccessToken).toBe(false);
    expect(apiTokenService.upsertFanpageAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        fanpageId: 'fanpage-id',
        accessToken: 'page-access-token-value',
      }),
    );
    expect((result as any).accessToken).toBeUndefined();
    expect((result as any).hasAccessToken).toBe(true);
    expect(saved).toHaveLength(1);
  });

  it('routes token updates through ApiToken instead of Fanpage', async () => {
    const FanpageModel: any = {
      findByIdAndUpdate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'fanpage-id',
          pageId: '1234567890',
          name: 'Secure page',
          status: 'active',
          hasAccessToken: false,
        }),
      }),
    };
    const apiTokenService = { upsertFanpageAccessToken: jest.fn().mockResolvedValue(undefined) };
    const service = new FanpageService(FanpageModel, {} as any, apiTokenService as any);

    const result = await service.update('fanpage-id', {
      name: 'Renamed page',
      accessToken: 'updated-page-token',
    } as any);

    const persistedUpdate = FanpageModel.findByIdAndUpdate.mock.calls[0][1];
    expect(persistedUpdate.accessToken).toBeUndefined();
    expect(apiTokenService.upsertFanpageAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'updated-page-token' }),
    );
    expect((result as any).accessToken).toBe('********');
  });

  it('refreshes a validated token into ApiToken and explicitly removes the legacy field', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ id: '1234567890', name: 'Secure page' }),
    } as any);
    const FanpageModel: any = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'fanpage-id',
          name: 'Secure page',
          status: 'active',
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const apiTokenService = { upsertFanpageAccessToken: jest.fn().mockResolvedValue(undefined) };
    const service = new FanpageService(FanpageModel, {} as any, apiTokenService as any);

    await service.refreshAccessToken('fanpage-id', 'refreshed-page-token');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.not.stringContaining('access_token='),
      {
        headers: { Authorization: 'Bearer refreshed-page-token' },
      },
    );
    expect(apiTokenService.upsertFanpageAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'refreshed-page-token',
        validated: true,
      }),
    );
    expect(FanpageModel.updateOne).toHaveBeenCalledWith(
      { _id: 'fanpage-id' },
      expect.objectContaining({ $unset: { accessToken: 1 } }),
    );
  });

  it('resolves a page token from the system token without putting the system token in the URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: '1234567890',
        name: 'Secure page',
        access_token: 'page-access-token',
      }),
    } as any);
    const apiTokenService = {
      getRawSystemUserToken: jest.fn().mockResolvedValue('system-user-token'),
    };
    const service = new FanpageService(
      {} as any,
      {} as any,
      apiTokenService as any,
    );

    const result = await (service as any).resolvePageAccessTokenFromSystemToken('1234567890');

    expect(result.accessToken).toBe('page-access-token');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.not.stringContaining('system-user-token'),
      {
        headers: { Authorization: 'Bearer system-user-token' },
      },
    );
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).not.toContain('access_token=');
  });
});
