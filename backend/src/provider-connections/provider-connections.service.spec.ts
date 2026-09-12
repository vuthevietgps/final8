import { decryptToken, encryptToken } from '../api-token/crypto.util';
import { ProviderConnectionsService } from './provider-connections.service';

describe('Encrypted connection persistence and revision isolation', () => {
  const id = '64b000000000000000000001';
  const key = 'fixture-provider-key-not-real';
  const vault = process.env.API_TOKEN_SECRET;
  let model: any;
  let discovery: any;
  let service: ProviderConnectionsService;
  const input = () => ({ kind: 'windsor-facebook', name: 'Facebook ERP', state: 'configured', revision: 0, accountIds: ['123'], apiKey: key }) as any;
  const row = () => ({ _id: id, ...input(), revision: 1, secretsEnc: encryptToken(JSON.stringify({ apiKey: key })) });
  beforeEach(() => {
    process.env.API_TOKEN_SECRET = 'unit-test-vault-encryption-key-32-characters';
    model = { create: jest.fn(async value => ({ _id: id, ...value })), findOneAndUpdate: jest.fn(), findById: jest.fn() };
    discovery = { inspect: jest.fn().mockResolvedValue({ status: 'accessible', liveWriteEnabled: false }) };
    service = new ProviderConnectionsService(model, { exists: jest.fn().mockResolvedValue(true) } as any, discovery);
  });
  afterAll(() => { if (vault === undefined) delete process.env.API_TOKEN_SECRET; else process.env.API_TOKEN_SECRET = vault; });
  function existing(value: any) {
    const query = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(value) };
    model.findById.mockReturnValue(query);
  }

  it('encrypts persisted keys and never exposes them in the response', async () => {
    const result = await service.save(undefined, input(), 'director-id');
    const stored = model.create.mock.calls[0][0];
    expect(stored).not.toHaveProperty('apiKey');
    expect(stored.secretsEnc).not.toContain(key);
    expect(JSON.parse(decryptToken(stored.secretsEnc)!)).toEqual({ apiKey: key });
    expect(JSON.stringify(result)).not.toContain(key);
    expect(result).not.toHaveProperty('secretsEnc');
    expect(result).toMatchObject({ hasApiKey: true, liveWriteEnabled: false, revision: 1 });
    expect(stored.audit[0]).toMatchObject({ actor: 'director-id', operation: 'created' });
  });

  it('requires a real encryption key even in local development', async () => {
    delete process.env.API_TOKEN_SECRET;
    await expect(service.save(undefined, input(), 'director-id')).rejects.toThrow('API_TOKEN_SECRET');
    expect(model.create).not.toHaveBeenCalled();
  });

  it('does not persist provider keys with the preview sandbox ephemeral vault key', async () => {
    const previous = process.env.ERP_LOCAL_SANDBOX;
    process.env.ERP_LOCAL_SANDBOX = 'true';
    try {
      expect(service.configurationStatus()).toEqual({ storageEnabled: false, reason: 'PREVIEW_EPHEMERAL_VAULT' });
      await expect(service.save(undefined, input(), 'director-id')).rejects.toThrow('khóa mã hóa tạm thời');
      expect(model.create).not.toHaveBeenCalled();
    } finally { if (previous === undefined) delete process.env.ERP_LOCAL_SANDBOX; else process.env.ERP_LOCAL_SANDBOX = previous; }
  });

  it('preserves credentials when the update omits them and invalidates previous verification', async () => {
    existing(row());
    model.findOneAndUpdate.mockImplementation(async (_filter, update) => ({ _id: id, ...update.$set }));
    const dto = { ...input(), revision: 1 }; delete dto.apiKey;
    await service.save(id, dto, 'director-id');
    const [filter, update] = model.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: id, revision: 1 });
    expect(JSON.parse(decryptToken(update.$set.secretsEnc)!)).toEqual({ apiKey: key });
    expect(update.$unset).toHaveProperty('check');
    expect(update.$set.revision).toBe(2);
  });

  it('rejects a stale edit before changing credentials', async () => {
    existing(row());
    await expect(service.save(id, input(), 'director-id')).rejects.toThrow('Cấu hình đã thay đổi');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a concurrent save when compare-and-set loses the race', async () => {
    existing(row()); model.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.save(id, { ...input(), revision: 1 }, 'director-id')).rejects.toThrow('Cấu hình đã thay đổi');
  });

  it('does not attach a previous credential check to a newly rotated connection', async () => {
    existing(row());
    model.findOneAndUpdate.mockResolvedValueOnce(row()).mockResolvedValueOnce(null);
    await expect(service.check(id, 'director-id')).rejects.toThrow('Kết quả cũ đã bị bỏ');
    expect(model.findOneAndUpdate.mock.calls[1][0]).toMatchObject({ revision: 1, state: 'configured' });
  });

  it('does not make a provider call for disabled connections', async () => {
    existing({ ...row(), state: 'disabled' });
    await expect(service.check(id, 'director-id')).rejects.toThrow('đang tắt');
    expect(discovery.inspect).not.toHaveBeenCalled();
  });

  it('does not make concurrent discovery calls that spend provider quota', async () => {
    existing(row()); model.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.check(id, 'director-id')).rejects.toThrow('Chờ một phút');
    expect(discovery.inspect).not.toHaveBeenCalled();
  });

  it('does not return database exceptions containing the encrypted record', async () => {
    model.create.mockRejectedValue(new Error(`db failure ${key}`));
    await expect(service.save(undefined, input(), 'director-id')).rejects.toThrow('Không lưu được kết nối.');
  });
});
