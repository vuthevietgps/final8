import { ProviderDiscoveryService } from './provider-discovery.service';
import { ProviderReadError } from './provider-read-http.service';

describe('Provider capability evidence', () => {
  const key = 'fixture-key-not-real';
  let http: { get: jest.Mock };
  let service: ProviderDiscoveryService;
  beforeEach(() => { http = { get: jest.fn() }; service = new ProviderDiscoveryService(http as any); });
  const google = { kind: 'windsor-google', accountIds: ['1234567890'] } as any;

  it('validates selected account access independently of write readiness', async () => {
    http.get.mockResolvedValueOnce([{ datasource: 'google_ads', account_id: '123-456-7890', account_name: 'Shop', status: 'active' }])
      .mockResolvedValueOnce([
        { id: 'pause_campaign', schema: { type: 'object' } },
        { id: 'delete_campaign', schema: { type: 'object' } },
      ]);
    const result = await service.inspect(google, key);
    expect(result).toMatchObject({ status: 'accessible', readAccessConfirmed: true, actions: ['pause_campaign'], providerValidation: 'unverified', liveWriteEnabled: false, messagingEnabled: false });
  });

  it('accepts connected accounts when the current Windsor response omits status', async () => {
    http.get.mockResolvedValueOnce([{ datasource: 'google_ads', account_id: '123-456-7890', account_name: 'Shop' }])
      .mockResolvedValueOnce([]);
    expect(await service.inspect(google, key)).toMatchObject({
      code: 'ACCOUNT_ACCESS_CONFIRMED', readAccessConfirmed: true,
      accounts: [{ id: '1234567890', name: 'Shop' }],
    });
  });

  it('does not consider an empty list a valid configured account', async () => {
    http.get.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect(await service.inspect(google, key)).toMatchObject({ status: 'needs_attention', code: 'NO_CONNECTED_ACCOUNTS' });
  });

  it('rejects cross-provider data instead of marking the configuration healthy', async () => {
    http.get.mockResolvedValueOnce([{ datasource: 'facebook', account_id: '1234567890', status: 'active' }]);
    expect(await service.inspect(google, key)).toMatchObject({ status: 'failed', code: 'INVALID_ACCOUNT_RESPONSE' });
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('keeps inactive or missing selections unverified', async () => {
    http.get.mockResolvedValueOnce([
      { datasource: 'google_ads', account_id: '1234567890', status: 'inactive' },
      { datasource: 'google_ads', account_id: '555', status: 'active' },
    ]).mockResolvedValueOnce([]);
    expect(await service.inspect(google, key)).toMatchObject({ code: 'ACCOUNT_NOT_CONNECTED', selectedAccountsMissing: ['1234567890'] });
  });

  it('preserves successful account inspection when action discovery fails', async () => {
    http.get.mockResolvedValueOnce([{ datasource: 'google_ads', account_id: '1234567890', status: 'active' }])
      .mockRejectedValueOnce(new ProviderReadError('ACCESS_DENIED'));
    expect(await service.inspect(google, key)).toMatchObject({ status: 'needs_attention', code: 'ACTION_DISCOVERY_FAILED', readAccessConfirmed: true, actions: [] });
  });

  it('does not treat Bird channel access as verified Messenger attribution', async () => {
    http.get.mockResolvedValue({ status: 'active' });
    const result = await service.inspect({ kind: 'bird-messenger', birdApi: 'bird-v1', workspaceId: 'workspace', channelId: 'channel' } as any, key);
    expect(result).toMatchObject({ status: 'needs_attention', tracking: 'unverified', messagingEnabled: false });
    expect(http.get.mock.calls[0][1]).toBe('/workspaces/workspace/channels/channel/conversational');
  });

  it('rejects a WhatsApp channel when Messenger was requested', async () => {
    http.get.mockResolvedValue({ id: 'channel', platformId: 'whatsapp', status: 'active' });
    expect(await service.inspect({ kind: 'bird-messenger', birdApi: 'messagebird-v1', channelId: 'channel' } as any, key))
      .toMatchObject({ status: 'failed', code: 'NOT_A_FACEBOOK_CHANNEL' });
  });
});
