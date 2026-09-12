import { Injectable } from '@nestjs/common';

export type ReadHost = 'windsor' | 'windsor-accounts' | 'bird' | 'messagebird';
const HOSTS: Record<ReadHost, string> = {
  windsor: 'https://connectors.windsor.ai',
  'windsor-accounts': 'https://onboard.windsor.ai',
  bird: 'https://api.bird.com',
  messagebird: 'https://conversations.messagebird.com',
};
const PATHS: Record<ReadHost, RegExp> = {
  windsor: /^\/(facebook|google_ads)(?:\/(actions|fields|options))?$/,
  'windsor-accounts': /^\/api\/common\/ds-accounts$/,
  bird: /^\/workspaces\/[a-fA-F0-9-]{36}\/channels\/[a-fA-F0-9-]{36}\/conversational$/,
  messagebird: /^\/v1\/channels\/[a-fA-F0-9-]{32,36}$/,
};

export class ProviderReadError extends Error {
  constructor(readonly code: string) { super(code); }
}

/** Discovery only. No arbitrary URL, POST, automatic redirect, or mutation retry. */
@Injectable()
export class ProviderReadHttpService {
  async get(host: ReadHost, path: string, apiKey: string, query: Record<string, string> = {}): Promise<any> {
    if (!HOSTS[host] || !PATHS[host].test(path) || /[\r\n]/.test(apiKey)) {
      throw new ProviderReadError('INVALID_PROVIDER_REQUEST');
    }
    const url = new URL(path, HOSTS[host]);
    for (const [key, value] of Object.entries(query)) {
      if (!this.isAllowedQuery(host, path, key, value, query)) {
        throw new ProviderReadError('INVALID_PROVIDER_REQUEST');
      }
      url.searchParams.set(key, value);
    }
    const windsorDataRead = host === 'windsor' && ['/google_ads', '/facebook'].includes(path);
    // Windsor data endpoints require the credential as api_key; capability endpoints accept X-Api-Key.
    // The caller cannot supply or override this parameter, and all failures remain redacted below.
    if (windsorDataRead) url.searchParams.set('api_key', apiKey);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, {
        method: 'GET', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', ...(host.startsWith('windsor')
          ? windsorDataRead ? {} : { 'X-Api-Key': apiKey }
          : { Authorization: `AccessKey ${apiKey}` }) },
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ProviderReadError(response.status === 429 ? 'RATE_LIMITED'
          : [401, 403].includes(response.status) ? 'ACCESS_DENIED'
          : response.status === 404 ? 'RESOURCE_NOT_FOUND' : 'PROVIDER_UNAVAILABLE');
      }
      const limit = 2 * 1024 * 1024;
      const reader = response.body?.getReader();
      if (!reader) throw new ProviderReadError('INVALID_RESPONSE');
      let size = 0;
      const chunks: Buffer[] = [];
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) throw new ProviderReadError('RESPONSE_TOO_LARGE');
          chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => undefined); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      // Never propagate URL, headers, provider body or exceptions containing credentials.
      if (error instanceof ProviderReadError) throw error;
      throw new ProviderReadError(controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'INVALID_RESPONSE');
    } finally { clearTimeout(timer); }
  }

  private isAllowedQuery(
    host: ReadHost,
    path: string,
    key: string,
    value: string,
    query: Record<string, string>,
  ): boolean {
    if (host === 'windsor-accounts') {
      return key === 'datasource' && ['facebook', 'google_ads'].includes(value);
    }
    if (host !== 'windsor' || !['/google_ads', '/facebook'].includes(path)) return false;
    if (key === 'fields') {
      const fields = value.split(',');
      return fields.length > 0 && fields.length <= 40
        && fields.every(field => /^[a-z][a-z0-9_]{0,79}$/.test(field));
    }
    if (key === 'date_from' || key === 'date_to') return /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (key === '_renderer') return value === 'json';
    if (key === '_max_rows') {
      const count = Number(value);
      return Number.isInteger(count) && count >= 1 && count <= 5000;
    }
    if (key === 'include_inactive') return value === 'true';
    if (key === 'select_accounts') return /^\d{1,30}$/.test(value);
    // A data request always has a bounded field set and an explicit one-day range.
    return false;
  }
}
