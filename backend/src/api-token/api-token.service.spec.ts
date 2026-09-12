import { decryptToken, encryptToken } from './crypto.util';
import { ApiTokenService } from './api-token.service';
import { ApiTokenSchema } from './schemas/api-token.schema';

describe('ApiTokenService Google Ads secret storage', () => {
  const previousEnv = process.env;
  const previousFetch = global.fetch;

  afterEach(() => {
    process.env = previousEnv;
    global.fetch = previousFetch;
    jest.restoreAllMocks();
  });

  it('stores new Google Ads settings without a plaintext token', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    await service.saveGoogleAdsSettings({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: '1//refresh-token-value',
      developerToken: 'developer-token',
      loginCustomerId: '123-456-7890',
    });

    const payload = model.create.mock.calls[0][0];
    expect(payload.token).toBeUndefined();
    expect(payload.tokenEnc).toBeTruthy();
    expect(payload.tokenEnc).not.toContain('1//refresh-token-value');
    expect(decryptToken(payload.tokenEnc)).toBe('1//refresh-token-value');
    expect(payload.providerConfigEnc).not.toContain('client-secret');
    expect(payload.notes).not.toContain('client-secret');
    expect(payload.notes).not.toContain('developer-token');
  });

  it('resolves an explicitly linked Google credential by active provider-scoped ID without fallback', async () => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      API_TOKEN_SECRET: 'unit-test-secret',
      GOOGLE_ADS_CLIENT_ID: undefined,
      GOOGLE_ADS_CLIENT_SECRET: undefined,
      GOOGLE_ADS_REFRESH_TOKEN: undefined,
      GOOGLE_ADS_DEVELOPER_TOKEN: undefined,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: undefined,
    };
    const linkedId = '507f1f77bcf86cd799439011';
    const linkedToken = {
      _id: linkedId,
      tokenEnc: encryptToken('linked-refresh-token'),
      providerConfigEnc: encryptToken(JSON.stringify({
        clientId: 'linked-client',
        clientSecret: 'linked-secret',
        developerToken: 'linked-developer',
        loginCustomerId: '1234567890',
        apiVersion: 'v24',
      })),
    };
    const model = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(linkedToken),
        }),
      }),
    };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    const runtime = await service.getGoogleAdsRuntimeConfig({
      loginCustomerId: '1234567890',
      credentialReferenceId: linkedId,
    });

    expect(model.findOne).toHaveBeenCalledTimes(1);
    expect(model.findOne).toHaveBeenCalledWith({
      _id: linkedId,
      provider: 'google',
      status: 'active',
    });
    expect(runtime).toEqual(expect.objectContaining({
      clientId: 'linked-client',
      clientSecret: 'linked-secret',
      refreshToken: 'linked-refresh-token',
      developerToken: 'linked-developer',
      loginCustomerId: '1234567890',
      configSource: 'database',
      refreshTokenSource: 'database',
      credentialReferenceId: linkedId,
    }));
  });

  it('fails closed when an explicit Google credential reference is missing even if env credentials exist', async () => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      API_TOKEN_SECRET: 'unit-test-secret',
      GOOGLE_ADS_CLIENT_ID: 'env-client',
      GOOGLE_ADS_CLIENT_SECRET: 'env-secret',
      GOOGLE_ADS_REFRESH_TOKEN: 'env-refresh',
      GOOGLE_ADS_DEVELOPER_TOKEN: 'env-developer',
    };
    const model = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
    };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    await expect(service.getGoogleAdsRuntimeConfig({
      credentialReferenceId: '507f1f77bcf86cd799439011',
    })).rejects.toThrow('missing or inactive');
  });

  it('never mixes a partial environment credential with a complete database credential', async () => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      API_TOKEN_SECRET: 'unit-test-secret',
      GOOGLE_ADS_CLIENT_ID: 'partial-env-client',
      GOOGLE_ADS_CLIENT_SECRET: undefined,
      GOOGLE_ADS_REFRESH_TOKEN: undefined,
      GOOGLE_ADS_DEVELOPER_TOKEN: undefined,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: undefined,
    };
    const databaseId = '507f1f77bcf86cd799439012';
    const tokenDoc = {
      _id: databaseId,
      tokenEnc: encryptToken('database-refresh-token'),
      providerConfigEnc: encryptToken(JSON.stringify({
        clientId: 'database-client',
        clientSecret: 'database-secret',
        developerToken: 'database-developer',
        loginCustomerId: '1234567890',
        apiVersion: 'v24',
      })),
    };
    const sort = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(tokenDoc) });
    const select = jest.fn().mockReturnValue({ sort });
    const model = { findOne: jest.fn().mockReturnValue({ select }) };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    const runtime = await service.getGoogleAdsRuntimeConfig();

    expect(runtime).toEqual(expect.objectContaining({
      clientId: 'database-client',
      clientSecret: 'database-secret',
      refreshToken: 'database-refresh-token',
      developerToken: 'database-developer',
      configSource: 'database',
      refreshTokenSource: 'database',
      credentialReferenceId: databaseId,
    }));
  });

  it('uses an explicit env credential without querying or mixing database fields', async () => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      API_TOKEN_SECRET: 'unit-test-secret',
      GOOGLE_ADS_CLIENT_ID: 'env-client',
      GOOGLE_ADS_CLIENT_SECRET: 'env-secret',
      GOOGLE_ADS_REFRESH_TOKEN: 'env-refresh',
      GOOGLE_ADS_DEVELOPER_TOKEN: 'env-developer',
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: '1234567890',
    };
    const model = { findOne: jest.fn() };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    const runtime = await service.getGoogleAdsRuntimeConfig({
      customerId: '9876543210',
      credentialReferenceId: 'env',
    });

    expect(model.findOne).not.toHaveBeenCalled();
    expect(runtime).toEqual(expect.objectContaining({
      clientId: 'env-client',
      refreshToken: 'env-refresh',
      configSource: 'env',
      refreshTokenSource: 'env',
      credentialReferenceId: 'env',
    }));
  });

  it('stores generic provider tokens encrypted and never writes the plaintext field', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const savedDocuments: any[] = [];
    const TokenModel: any = jest.fn().mockImplementation((payload: any) => ({
      ...payload,
      _id: 'created-token-id',
      save: jest.fn().mockImplementation(async function (this: any) {
        savedDocuments.push(this);
        return this;
      }),
      toObject: jest.fn().mockReturnValue({ ...payload, _id: 'created-token-id' }),
    }));
    const auditModel = { create: jest.fn().mockResolvedValue({}) };
    const service = new ApiTokenService(TokenModel, auditModel as any, {} as any, {} as any);

    await service.create({
      name: 'Facebook token',
      provider: 'facebook',
      token: 'facebook-access-token-value',
    } as any);

    const persisted = TokenModel.mock.calls[0][0];
    expect(persisted.token).toBeUndefined();
    expect(decryptToken(persisted.tokenEnc)).toBe('facebook-access-token-value');
    expect(persisted.tokenHash).toBeTruthy();
    expect(savedDocuments).toHaveLength(1);
  });

  it('unsets legacy plaintext when updating or rotating a token', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const current: any = {
      _id: 'old-token-id',
      name: 'Existing token',
      provider: 'facebook',
      status: 'active',
      notes: 'safe note',
      save: jest.fn().mockResolvedValue(undefined),
    };
    const TokenModel: any = jest.fn().mockImplementation((payload: any) => ({
      ...payload,
      _id: 'rotated-token-id',
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({ ...payload, _id: 'rotated-token-id' }),
    }));
    TokenModel.findById = jest.fn().mockResolvedValue(current);
    TokenModel.findByIdAndUpdate = jest.fn().mockResolvedValue({
      _id: 'old-token-id',
      provider: 'facebook',
      toObject: () => ({ _id: 'old-token-id', provider: 'facebook' }),
    });
    const auditModel = { create: jest.fn().mockResolvedValue({}) };
    const service = new ApiTokenService(TokenModel, auditModel as any, {} as any, {} as any);

    await service.update('old-token-id', { token: 'updated-token-value' } as any);
    const update = TokenModel.findByIdAndUpdate.mock.calls[0][1];
    expect(update.$set.token).toBeUndefined();
    expect(decryptToken(update.$set.tokenEnc)).toBe('updated-token-value');
    expect(update.$unset).toEqual({ token: 1 });

    await service.rotate('old-token-id', { newToken: 'rotated-token-value' } as any);
    const rotatedPayload = TokenModel.mock.calls[0][0];
    expect(rotatedPayload.token).toBeUndefined();
    expect(decryptToken(rotatedPayload.tokenEnc)).toBe('rotated-token-value');
  });

  it('stores TikTok access and provider secrets encrypted and removes legacy plaintext', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const existing = { _id: 'tiktok-settings-id' };
    const model = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(existing),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    await service.saveTikTokSettings({
      accessToken: 'tiktok-access-token-value',
      refreshToken: 'tiktok-refresh-token-value',
      appId: 'app-id',
      appSecret: 'app-secret',
      authCode: 'auth-code',
    });

    const update = model.updateOne.mock.calls[0][1];
    expect(update.$set.token).toBeUndefined();
    expect(decryptToken(update.$set.tokenEnc)).toBe('tiktok-access-token-value');
    expect(update.$unset).toEqual({ token: 1 });
    const encryptedConfig = JSON.parse(decryptToken(update.$set.providerConfigEnc) || '{}');
    expect(encryptedConfig.refreshToken).toBe('tiktok-refresh-token-value');
    expect(encryptedConfig.appSecret).toBe('app-secret');
    expect(update.$set.notes).not.toContain('tiktok-refresh-token-value');
    expect(update.$set.notes).not.toContain('app-secret');
  });

  it('excludes the legacy plaintext token from normal queries', () => {
    expect((ApiTokenSchema.path('token') as any).options.select).toBe(false);
  });

  it('migrates legacy plaintext token and provider config without returning their values', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const tokenQuery = (items: any[]) => ({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(items) }),
      }),
    });
    const find = jest
      .fn()
      .mockReturnValueOnce(tokenQuery([{
        _id: 'legacy-token-id',
        token: 'legacy-plaintext-token',
      }]))
      .mockReturnValueOnce(tokenQuery([]))
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([{
          _id: 'legacy-google-id',
          provider: 'google',
          notes: JSON.stringify({
            clientId: 'client-id',
            clientSecret: 'legacy-client-secret',
            developerToken: 'legacy-developer-token',
            loginCustomerId: '123-456-7890',
          }),
        }]),
      });
    const model = {
      find,
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    const result = await service.migrateLegacyPlaintextSecrets();

    expect(result).toEqual({ tokensMigrated: 1, providerConfigsMigrated: 1 });
    const tokenRewrite = model.updateOne.mock.calls[0][1];
    expect(tokenRewrite.$unset).toEqual({ token: 1 });
    expect(tokenRewrite.$set.token).toBeUndefined();
    expect(decryptToken(tokenRewrite.$set.tokenEnc)).toBe('legacy-plaintext-token');
    const configRewrite = model.updateOne.mock.calls[1][1];
    expect(configRewrite.$set.notes).not.toContain('legacy-client-secret');
    expect(configRewrite.$set.notes).not.toContain('legacy-developer-token');
    const migratedConfig = JSON.parse(decryptToken(configRewrite.$set.providerConfigEnc) || '{}');
    expect(migratedConfig.clientSecret).toBe('legacy-client-secret');
    expect(migratedConfig.developerToken).toBe('legacy-developer-token');
  });

  it('upserts a fanpage token into ApiToken and removes Fanpage plaintext', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const model = {
      findOne: jest.fn().mockResolvedValue({
        _id: 'api-token-id',
        name: 'Old page token',
        status: 'active',
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const fanpageModel = { updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) };
    const service = new ApiTokenService(model as any, {} as any, fanpageModel as any, {} as any);

    await service.upsertFanpageAccessToken({
      fanpageId: 'fanpage-id',
      name: 'Secure page',
      status: 'active',
      accessToken: 'page-access-token-value',
      validated: true,
    });

    const tokenUpdate = model.updateOne.mock.calls[0][1];
    expect(tokenUpdate.$set.token).toBeUndefined();
    expect(decryptToken(tokenUpdate.$set.tokenEnc)).toBe('page-access-token-value');
    expect(tokenUpdate.$unset.token).toBe(1);
    expect(fanpageModel.updateOne).toHaveBeenCalledWith(
      { _id: 'fanpage-id' },
      { $set: { hasAccessToken: true }, $unset: { accessToken: 1 } },
    );
  });

  it('migrates legacy Fanpage accessToken into encrypted ApiToken storage', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const fanpageQuery = (items: any[]) => ({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(items) }),
      }),
    });
    const fanpageModel = {
      find: jest
        .fn()
        .mockReturnValueOnce(fanpageQuery([{
          _id: 'legacy-fanpage-id',
          name: 'Legacy page',
          status: 'active',
          accessToken: 'legacy-page-access-token',
        }]))
        .mockReturnValueOnce(fanpageQuery([])),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ _id: 'new-api-token-id' }),
    };
    const service = new ApiTokenService(model as any, {} as any, fanpageModel as any, {} as any);

    const migrated = await service.migrateLegacyFanpagePlaintextSecrets();

    expect(migrated).toBe(1);
    const tokenPayload = model.create.mock.calls[0][0];
    expect(tokenPayload.token).toBeUndefined();
    expect(decryptToken(tokenPayload.tokenEnc)).toBe('legacy-page-access-token');
    expect(fanpageModel.updateOne).toHaveBeenCalledWith(
      { _id: 'legacy-fanpage-id' },
      { $set: { hasAccessToken: true }, $unset: { accessToken: 1 } },
    );
  });

  it('validates Facebook tokens with bearer authorization and schedules a fresh recheck', async () => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      API_TOKEN_SECRET: 'unit-test-secret',
      FB_APP_ACCESS_TOKEN: undefined,
      FACEBOOK_APP_TOKEN: undefined,
    };
    const tokenDoc: any = {
      _id: 'facebook-token-id',
      provider: 'facebook',
      tokenEnc: encryptToken('facebook-validator-token'),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const model = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(tokenDoc),
      }),
    };
    const auditModel = { create: jest.fn().mockResolvedValue({}) };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'user-id', name: 'User' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ permission: 'ads_management', status: 'granted' }],
        }),
      } as any);
    const before = Date.now();
    const service = new ApiTokenService(
      model as any,
      auditModel as any,
      {} as any,
      {} as any,
    );

    await service.validate('facebook-token-id', {} as any);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    for (const [url, init] of (global.fetch as jest.Mock).mock.calls) {
      expect(String(url)).not.toContain('access_token=');
      expect(init).toEqual(expect.objectContaining({
        headers: { Authorization: 'Bearer facebook-validator-token' },
      }));
    }
    expect(tokenDoc.scopes).toEqual(['ads_management']);
    expect(tokenDoc.nextCheckAt.getTime()).toBeGreaterThanOrEqual(before + 9 * 60 * 1000);
    expect(tokenDoc.nextCheckAt.getTime()).toBeLessThanOrEqual(Date.now() + 11 * 60 * 1000);
  });

  it('requires a business ID before system-user ad-account sync makes provider calls', async () => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      API_TOKEN_SECRET: 'unit-test-secret',
      FB_BUSINESS_ID: undefined,
    };
    const model = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              tokenEnc: encryptToken('system-user-token'),
            }),
          }),
        }),
      }),
    };
    global.fetch = jest.fn();
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    await expect(service.syncFanpagesFromSystemUserToken())
      .rejects.toThrow('FB_BUSINESS_ID is required');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('syncs Meta accounts with bearer auth and preserves raw provider IANA timezone names', async () => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      API_TOKEN_SECRET: 'unit-test-secret',
      FB_BUSINESS_ID: '123456789',
    };
    const model = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              tokenEnc: encryptToken('system-user-token'),
            }),
          }),
        }),
      }),
    };
    const createdAccounts: any[] = [];
    const adAccountModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (payload: any) => {
        createdAccounts.push(payload);
        return payload;
      }),
    };
    global.fetch = jest.fn().mockImplementation(async (input: any) => {
      const url = String(input);
      const data = url.includes('/me/accounts')
        ? []
        : url.includes('/owned_ad_accounts')
          ? [
            {
              id: 'act_111',
              account_id: '111',
              name: 'Vietnam account',
              account_status: 1,
              currency: 'VND',
              timezone_name: ' Asia/Ho_Chi_Minh ',
            },
            {
              id: 'act_222',
              account_id: '222',
              name: 'Non-canonical account',
              account_status: 1,
              currency: 'VND',
              timezone_name: 'Asia/Bangkok',
            },
          ]
          : [];
      return {
        ok: true,
        json: jest.fn().mockResolvedValue({ data }),
      } as any;
    });
    const service = new ApiTokenService(
      model as any,
      {} as any,
      {} as any,
      adAccountModel as any,
    );

    const result = await service.syncFanpagesFromSystemUserToken();

    expect(result.adAccountsCreated).toBe(2);
    expect(createdAccounts.map((item) => item.timezoneId)).toEqual([
      'Asia/Ho_Chi_Minh',
      'Asia/Bangkok',
    ]);
    for (const [url, init] of (global.fetch as jest.Mock).mock.calls) {
      expect(String(url)).not.toContain('system-user-token');
      expect(String(url)).not.toContain('access_token=');
      expect(init).toEqual(expect.objectContaining({
        headers: { Authorization: 'Bearer system-user-token' },
      }));
    }
  });

  it('resolves a Meta execution credential only from the exact encrypted account binding', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const lean = jest.fn().mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      tokenEnc: encryptToken('exact-meta-token'),
      adAccountId: 'act_123456789',
      lastCheckedAt: new Date(),
    });
    const sort = jest.fn().mockReturnValue({ lean });
    const select = jest.fn().mockReturnValue({ sort });
    const model = { findOne: jest.fn().mockReturnValue({ select }) };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    const credential = await service.getMetaAdsExecutionCredential('act_123456789');

    expect(credential).toEqual(expect.objectContaining({
      accessToken: 'exact-meta-token',
      credentialReferenceId: '507f1f77bcf86cd799439011',
      adAccountId: '123456789',
    }));
    expect(model.findOne).toHaveBeenCalledTimes(1);
    expect(model.findOne.mock.calls[0][0]).toEqual(expect.objectContaining({
      provider: 'facebook',
      status: 'active',
      tokenEnc: { $type: 'string', $ne: '' },
      adAccountId: { $in: ['123456789', 'act_123456789'] },
      scopes: { $in: ['ads_management'] },
    }));
  });

  it('does not fall back to another or plaintext Meta token for live execution', async () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const lean = jest.fn().mockResolvedValue(null);
    const model = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({ lean }),
        }),
      }),
    };
    const service = new ApiTokenService(model as any, {} as any, {} as any, {} as any);

    await expect(service.getMetaAdsExecutionCredential('999')).resolves.toBeUndefined();
    expect(model.findOne).toHaveBeenCalledTimes(1);
    await expect(service.getMetaAdsExecutionCredential('not-an-account')).resolves.toBeUndefined();
    expect(model.findOne).toHaveBeenCalledTimes(1);
  });
});
