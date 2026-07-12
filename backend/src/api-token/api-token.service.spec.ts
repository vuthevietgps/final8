import { decryptToken, encryptToken } from './crypto.util';
import { ApiTokenService } from './api-token.service';
import { ApiTokenSchema } from './schemas/api-token.schema';

describe('ApiTokenService Google Ads secret storage', () => {
  const previousEnv = process.env;

  afterEach(() => {
    process.env = previousEnv;
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
});
