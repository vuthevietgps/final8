import { Injectable } from '@nestjs/common';
import { ProviderConnection } from './provider-connection.schema';
import { ProviderReadError, ProviderReadHttpService } from './provider-read-http.service';

export type DiscoveryCheck = {
  status: 'accessible' | 'needs_attention' | 'failed';
  code: string;
  accounts?: Array<{ id: string; name: string }>;
  selectedAccountsMissing?: string[];
  actions?: string[];
  actionDiscovery?: 'available' | 'failed';
  readAccessConfirmed?: boolean;
  providerValidation: 'unverified' | 'not_applicable';
  tracking: 'not_applicable' | 'unverified';
  liveWriteEnabled: false;
  messagingEnabled: false;
};

const ALLOWED_ACTIONS = new Set([
  'pause_campaign', 'enable_campaign', 'pause_adset', 'enable_adset', 'pause_ad_group',
  'enable_ad_group', 'pause_ad', 'enable_ad', 'set_campaign_budget', 'set_adset_budget',
]);

@Injectable()
export class ProviderDiscoveryService {
  constructor(private readonly http: ProviderReadHttpService) {}

  async inspect(connection: ProviderConnection, apiKey: string): Promise<DiscoveryCheck> {
    const base = {
      liveWriteEnabled: false as const, messagingEnabled: false as const,
      providerValidation: connection.kind === 'bird-messenger' ? 'not_applicable' as const : 'unverified' as const,
      tracking: connection.kind === 'bird-messenger' ? 'unverified' as const : 'not_applicable' as const,
    };
    try {
      if (connection.kind !== 'bird-messenger') {
        const connector = connection.kind === 'windsor-facebook' ? 'facebook' : 'google_ads';
        const raw = await this.http.get('windsor-accounts', '/api/common/ds-accounts', apiKey, { datasource: connector });
        if (!Array.isArray(raw) || raw.length > 1000) throw new ProviderReadError('INVALID_ACCOUNT_RESPONSE');
        const accounts: Array<{ id: string; name: string }> = [];
        for (const row of raw) {
          if (!row || row.datasource !== connector) throw new ProviderReadError('INVALID_ACCOUNT_RESPONSE');
          const id = typeof row.account_id === 'string' ? row.account_id.replace(/-/g, '').replace(/^act_/, '') : '';
          if (!/^\d{1,30}$/.test(id)) throw new ProviderReadError('INVALID_ACCOUNT_RESPONSE');
          const name = typeof row.account_name === 'string' ? row.account_name.split(apiKey).join('[REDACTED]').slice(0, 150) : id;
          // The current Windsor ds-accounts response omits status for connected accounts.
          // Preserve the older explicit inactive signal, while accepting a missing status.
          if (!row.status || row.status === 'active') accounts.push({ id, name });
        }
        const missing = connection.accountIds.filter(id => !accounts.some(account => account.id === id));
        let actions: string[] = [];
        let actionDiscovery: 'available' | 'failed' = 'failed';
        try {
          const catalog = await this.http.get('windsor', `/${connector}/actions`, apiKey);
          if (!Array.isArray(catalog) || catalog.length > 500) throw new ProviderReadError('INVALID_ACTION_RESPONSE');
          actions = [...new Set<string>(catalog.filter(row => row && ALLOWED_ACTIONS.has(row.id)
            && row.schema?.type === 'object').map(row => row.id))];
          actionDiscovery = 'available';
        } catch { /* Account access and action discovery are independent capabilities. */ }
        return { ...base, accounts, selectedAccountsMissing: missing, actions, actionDiscovery,
          readAccessConfirmed: Boolean(accounts.length && connection.accountIds.length && !missing.length),
          status: accounts.length && connection.accountIds.length && !missing.length && actionDiscovery === 'available' ? 'accessible' : 'needs_attention',
          code: !accounts.length ? 'NO_CONNECTED_ACCOUNTS' : missing.length ? 'ACCOUNT_NOT_CONNECTED'
            : !connection.accountIds.length ? 'SELECT_ACCOUNTS' : actionDiscovery === 'failed' ? 'ACTION_DISCOVERY_FAILED' : 'ACCOUNT_ACCESS_CONFIRMED',
        };
      }
      if (connection.birdApi === 'bird-v1') {
        // A read-only, documented endpoint. It verifies access, NOT the Page/referral binding.
        const result = await this.http.get('bird', `/workspaces/${connection.workspaceId}/channels/${connection.channelId}/conversational`, apiKey);
        if (!['active', 'inactive'].includes(result?.status)) throw new ProviderReadError('INVALID_CHANNEL_RESPONSE');
        return { ...base, status: 'needs_attention', code: result.status === 'active' ? 'CHANNEL_ACCESS_TRACKING_UNVERIFIED' : 'CONVERSATIONS_INACTIVE' };
      }
      const result = await this.http.get('messagebird', `/v1/channels/${connection.channelId}`, apiKey);
      if (result?.id !== connection.channelId || result?.platformId !== 'facebook') throw new ProviderReadError('NOT_A_FACEBOOK_CHANNEL');
      return { ...base, status: 'needs_attention', code: result.status === 'active' ? 'CHANNEL_ACCESS_TRACKING_UNVERIFIED' : 'CHANNEL_INACTIVE' };
    } catch (error) {
      return { ...base, status: 'failed', code: error instanceof ProviderReadError ? error.code : 'PROVIDER_UNAVAILABLE' };
    }
  }
}
