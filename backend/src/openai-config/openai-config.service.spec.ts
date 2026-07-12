import { NotFoundException } from '@nestjs/common';
import { decryptToken, encryptToken } from '../api-token/crypto.util';
import { OpenAIConfigService } from './openai-config.service';
import { OpenAIConfigSchema } from './schemas/openai-config.schema';

describe('OpenAIConfigService secret handling', () => {
  const realKey = 'sk-test-1234567890abcdef';

  const createModel = (overrides: Record<string, any> = {}) => {
    const ctor: any = jest.fn(function (this: any, payload: any) {
      this.payload = payload;
      this.save = jest.fn().mockResolvedValue({ _id: 'created-id', ...payload });
    });
    Object.assign(ctor, {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      ...overrides,
    });
    return ctor;
  };

  const queryReturning = <T>(value: T) => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  const baseDto = {
    name: 'Default OpenAI',
    model: 'gpt-4o-mini',
    apiKey: realKey,
    systemPrompt: 'You are an ERP assistant.',
    scopeType: 'global' as const,
    status: 'active' as const,
    isDefault: true,
  };

  it('keeps the legacy apiKey field excluded from normal queries', () => {
    expect((OpenAIConfigSchema.path('apiKey') as any)?.options?.select).toBe(false);
  });

  it('encrypts apiKey when creating a config and does not save the plain key', async () => {
    const model = createModel();
    const service = new OpenAIConfigService(model as any);

    const result = await service.create(baseDto);
    const storedPayload = model.mock.calls[0][0];

    expect(storedPayload.apiKey).toBeUndefined();
    expect(storedPayload.apiKeyEnc).toBeTruthy();
    expect(storedPayload.apiKeyEnc).not.toBe(realKey);
    expect(decryptToken(storedPayload.apiKeyEnc)).toBe(realKey);
    expect(result).toEqual(expect.objectContaining({
      _id: 'created-id',
      apiKeyEnc: storedPayload.apiKeyEnc,
    }));
  });

  it('masks public configs and never returns apiKeyEnc', () => {
    const service = new OpenAIConfigService(createModel() as any);
    const encrypted = encryptToken(realKey);

    const publicConfig = service.toPublicConfig({
      _id: 'cfg-1',
      name: 'Default OpenAI',
      apiKeyEnc: encrypted,
      model: 'gpt-4o-mini',
    });

    expect(publicConfig.apiKey).toBe('sk-test...cdef');
    expect(publicConfig.apiKeyEnc).toBeUndefined();
  });

  it('returns a usable decrypted apiKey for runtime pickConfig', async () => {
    const encrypted = encryptToken(realKey);
    const model = createModel({
      find: jest.fn().mockReturnValue(queryReturning([
        { _id: 'cfg-1', scopeType: 'global', status: 'active', apiKeyEnc: encrypted },
      ])),
    });
    const service = new OpenAIConfigService(model as any);

    const config = await service.pickConfig({});

    expect(config).toEqual(expect.objectContaining({
      _id: 'cfg-1',
      apiKey: realKey,
    }));
    expect(config?.apiKeyEnc).toBeUndefined();
    expect(model.find).toHaveBeenCalledWith({
      $and: [
        expect.objectContaining({
          $or: [{ purpose: 'customer-chatbot' }, { purpose: { $exists: false } }],
          scopeType: 'global',
          isDefault: true,
        }),
        expect.objectContaining({
          status: 'active',
        }),
      ],
    });
  });

  it('filters admin assistant configs independently from chatbot configs', async () => {
    const encrypted = encryptToken(realKey);
    const model = createModel({
      find: jest.fn().mockReturnValue(queryReturning([
        { _id: 'cfg-admin', purpose: 'admin-assistant', scopeType: 'global', status: 'active', apiKeyEnc: encrypted },
      ])),
    });
    const service = new OpenAIConfigService(model as any);

    const config = await service.pickConfig({ purpose: 'admin-assistant' });

    expect(config).toEqual(expect.objectContaining({
      _id: 'cfg-admin',
      purpose: 'admin-assistant',
      apiKey: realKey,
    }));
    expect(model.find).toHaveBeenCalledWith({
      $and: [
        expect.objectContaining({
          purpose: 'admin-assistant',
          scopeType: 'global',
          isDefault: true,
        }),
        expect.objectContaining({
          status: 'active',
        }),
      ],
    });
  });

  it('falls back to legacy plain apiKey and migrates it on update without apiKey input', async () => {
    const legacyConfig = {
      _id: 'cfg-legacy',
      name: 'Legacy',
      apiKey: realKey,
      model: 'gpt-4o-mini',
      scopeType: 'global',
    };
    const model = createModel({
      findById: jest.fn().mockReturnValue(queryReturning(legacyConfig)),
      findByIdAndUpdate: jest.fn().mockReturnValue(queryReturning({
        ...legacyConfig,
        apiKey: undefined,
        apiKeyEnc: encryptToken(realKey),
      })),
    });
    const service = new OpenAIConfigService(model as any);

    const updated = await service.update('cfg-legacy', { name: 'Legacy renamed' } as any);
    const updatePayload = model.findByIdAndUpdate.mock.calls[0][1];

    expect(updatePayload.$set.name).toBe('Legacy renamed');
    expect(updatePayload.$set.apiKeyEnc).toBeTruthy();
    expect(decryptToken(updatePayload.$set.apiKeyEnc)).toBe(realKey);
    expect(updatePayload.$unset.apiKey).toBe(1);
    expect(updated.apiKey).toBe(realKey);
    expect(updated.apiKeyEnc).toBeUndefined();
  });

  it('does not overwrite an existing key when update receives a masked key', async () => {
    const encrypted = encryptToken(realKey);
    const existing = {
      _id: 'cfg-1',
      name: 'Config',
      apiKeyEnc: encrypted,
      model: 'gpt-4o-mini',
    };
    const model = createModel({
      findById: jest.fn().mockReturnValue(queryReturning(existing)),
      findByIdAndUpdate: jest.fn(),
    });
    const service = new OpenAIConfigService(model as any);

    const updated = await service.update('cfg-1', { apiKey: 'sk-test...cdef' } as any);

    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(updated.apiKey).toBe(realKey);
    expect(updated.apiKeyEnc).toBeUndefined();
  });

  it('excludes a legacy placeholder-key from runtime pickConfig', async () => {
    const model = createModel({
      find: jest.fn().mockReturnValue(queryReturning([
        { _id: 'placeholder', scopeType: 'global', status: 'active', apiKey: 'placeholder-key' },
      ])),
    });
    const service = new OpenAIConfigService(model as any);

    const config = await service.pickConfig({});

    expect(config).toBeNull();
  });

  it('does not persist placeholder-key as credential material', async () => {
    const model = createModel();
    const service = new OpenAIConfigService(model as any);

    await service.create({ ...baseDto, apiKey: 'placeholder-key' });

    const storedPayload = model.mock.calls[0][0];
    expect(storedPayload.apiKey).toBeUndefined();
    expect(storedPayload.apiKeyEnc).toBeUndefined();
  });

  it('migrates legacy plaintext keys at startup and unsets placeholder values', async () => {
    const legacyQuery = (items: any[]) => ({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(items) }),
      }),
    });
    const model = createModel({
      find: jest
        .fn()
        .mockReturnValueOnce(legacyQuery([{
          _id: 'legacy-real',
          apiKey: realKey,
        }, {
          _id: 'legacy-placeholder',
          apiKey: 'placeholder-key',
        }]))
        .mockReturnValueOnce(legacyQuery([])),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    const service = new OpenAIConfigService(model as any);

    const migrated = await service.migrateLegacyPlaintextApiKeys();

    expect(migrated).toBe(2);
    const realUpdate = model.updateOne.mock.calls[0][1];
    expect(realUpdate.$unset.apiKey).toBe(1);
    expect(decryptToken(realUpdate.$set.apiKeyEnc)).toBe(realKey);
    const placeholderUpdate = model.updateOne.mock.calls[1][1];
    expect(placeholderUpdate.$unset).toEqual({ apiKey: 1, apiKeyEnc: 1 });
    expect(placeholderUpdate.$set).toBeUndefined();
  });

  it('lazy-migrates a legacy key when resolving one config for runtime', async () => {
    const legacyConfig = {
      _id: 'legacy-runtime',
      name: 'Legacy runtime config',
      apiKey: realKey,
      model: 'gpt-4o-mini',
      scopeType: 'global',
      status: 'active',
    };
    const model = createModel({
      findById: jest.fn().mockReturnValue(queryReturning(legacyConfig)),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    const service = new OpenAIConfigService(model as any);

    const config = await service.findOne('legacy-runtime');

    expect(config?.apiKey).toBe(realKey);
    expect(config?.apiKeyEnc).toBeUndefined();
    const rewrite = model.updateOne.mock.calls[0][1];
    expect(rewrite.$unset.apiKey).toBe(1);
    expect(decryptToken(rewrite.$set.apiKeyEnc)).toBe(realKey);
  });

  it('throws when updating a missing config', async () => {
    const model = createModel({
      findById: jest.fn().mockReturnValue(queryReturning(null)),
    });
    const service = new OpenAIConfigService(model as any);

    await expect(service.update('missing', { name: 'Nope' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
