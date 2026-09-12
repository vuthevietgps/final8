import { ProviderReadHttpService } from './provider-read-http.service';

describe('Provider discovery transport boundary', () => {
  const secret = 'fixture-key-not-real-123';
  const http = new ProviderReadHttpService();
  let request: jest.SpyInstance;
  beforeEach(() => { request = jest.spyOn(global, 'fetch'); });
  afterEach(() => jest.restoreAllMocks());

  it('keeps credentials in headers, disables redirects and uses GET only', async () => {
    request.mockResolvedValue(new Response('[]', { status: 200 }));
    await http.get('windsor', '/facebook/actions', secret);
    const [url, options] = request.mock.calls[0];
    expect(String(url)).toBe('https://connectors.windsor.ai/facebook/actions');
    expect(String(url)).not.toContain(secret);
    expect(options).toMatchObject({ method: 'GET', redirect: 'error', headers: { 'X-Api-Key': secret } });
  });

  it.each([
    ['windsor', '//evil.test/actions', {}],
    ['windsor', '/facebook/actions?api_key=x', {}],
    ['windsor', '/facebook/actions', { api_key: secret }],
    ['bird', '/workspaces/../channels/abc', {}],
    ['messagebird', '/v1/channels/abc/messages', {}],
  ])('rejects unexpected URL or query %s %s before network', async (host, path, query) => {
    await expect(http.get(host as any, path as string, secret, query as any)).rejects.toThrow('INVALID_PROVIDER_REQUEST');
    expect(request).not.toHaveBeenCalled();
  });

  it('does not echo credentials from error responses or retry a 429', async () => {
    request.mockResolvedValue(new Response(JSON.stringify({ error: secret }), { status: 429 }));
    await expect(http.get('windsor', '/google_ads/actions', secret)).rejects.toThrow('RATE_LIMITED');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('uses Windsor query authentication only for a bounded account-scoped data read', async () => {
    request.mockResolvedValue(new Response('{"data":[]}', { status: 200 }));
    await http.get('windsor', '/google_ads', secret, {
      fields: 'date,account_id,campaign_id,ad_group_id,spend',
      date_from: '2026-09-05', date_to: '2026-09-05',
      select_accounts: '1396730688',
      include_inactive: 'true', _max_rows: '5000', _renderer: 'json',
    });
    const [url, options] = request.mock.calls[0];
    expect(url.searchParams.get('select_accounts')).toBe('1396730688');
    expect(url.searchParams.get('api_key')).toBe(secret);
    expect(options.headers).not.toHaveProperty('X-Api-Key');
  });

  it.each([
    { fields: 'date,spend', select_accounts: '../1' },
    { fields: 'date,spend', select_accounts: '1,2' },
    { fields: 'date,spend', api_key: secret },
    { fields: 'date,spend', _max_rows: '5001' },
    { fields: 'date,spend', include_inactive: 'false' },
    { fields: 'date,spend', arbitrary: 'true' },
  ])('rejects an unsafe Windsor data query before network', async query => {
    await expect(http.get('windsor', '/google_ads', secret, query as any)).rejects.toThrow('INVALID_PROVIDER_REQUEST');
    expect(request).not.toHaveBeenCalled();
  });

  it('does not expose fetch exceptions containing headers', async () => {
    request.mockRejectedValue(new Error(`Authorization ${secret}`));
    await expect(http.get('windsor', '/google_ads/fields', secret)).rejects.toThrow('INVALID_RESPONSE');
  });

  it('bounds streamed responses even without Content-Length', async () => {
    request.mockResolvedValue(new Response('x'.repeat(2 * 1024 * 1024 + 1)));
    await expect(http.get('windsor', '/facebook/fields', secret)).rejects.toThrow('RESPONSE_TOO_LARGE');
  });
});
