import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdGroup, AdGroupDocument } from '../../ad-group/schemas/ad-group.schema';
import {
  ProviderConnection,
  ProviderConnectionDocument,
} from '../../provider-connections/provider-connection.schema';
import {
  WindsorAdsResource,
  WindsorAdsResourceDocument,
} from '../../provider-connections/schemas/windsor-ads-resource.schema';

export type AdsAttributionProvider = 'google' | 'facebook' | 'tiktok';
export type AdsAttributionSource = 'windsor' | 'erp_ad_group' | 'manual';

export interface AdsAttributionOption {
  selectionKey: string;
  source: Exclude<AdsAttributionSource, 'manual'>;
  provider: AdsAttributionProvider;
  adGroupId: string;
  adGroupName?: string;
  campaignId?: string;
  campaignName?: string;
  accountId?: string;
  accountName?: string;
  status?: string;
  lastSeenAt?: string;
  label: string;
}

export interface AdsAttributionSelection {
  adGroupId?: string;
  adsProvider?: AdsAttributionProvider;
  adAccountProviderId?: string;
  adCampaignId?: string;
}

export interface AdsAttributionSnapshot {
  adGroupId?: string;
  adsProvider?: AdsAttributionProvider;
  adAccountProviderId?: string;
  adCampaignId?: string;
  adAccountNameSnapshot?: string;
  adCampaignNameSnapshot?: string;
  adGroupNameSnapshot?: string;
  adsAttributionSource?: AdsAttributionSource;
  adsAttributionSyncedAt?: Date;
}

@Injectable()
export class AdsAttributionOptionsService {
  constructor(
    @InjectModel(WindsorAdsResource.name)
    private readonly resourceModel: Model<WindsorAdsResourceDocument>,
    @InjectModel(ProviderConnection.name)
    private readonly connectionModel: Model<ProviderConnectionDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
  ) {}

  async list(): Promise<{ items: AdsAttributionOption[]; syncedAt?: string }> {
    const [connections, localGroups] = await Promise.all([
      this.connectionModel
        .find({
          kind: 'windsor-google',
          state: 'configured',
          lastReadSyncStatus: { $in: ['success', 'partial'] },
          lastReadSyncAt: { $exists: true },
        })
        .select('_id lastReadSyncAt lastReadSyncRunId')
        .lean()
        .exec(),
      this.adGroupModel
        .find({})
        .select('adGroupId name platform campaignId remoteStatus isActive lastSyncAt')
        .lean()
        .exec(),
    ]);

    const latestRuns = connections
      .filter((connection: any) => connection.lastReadSyncRunId)
      .map((connection: any) => ({ connectionId: connection._id, lastSyncRunId: connection.lastReadSyncRunId }));
    const resources = latestRuns.length
      ? await this.resourceModel
          .find({ $or: latestRuns, resourceType: { $in: ['account', 'campaign', 'ad_group'] } })
          .select('connectionId resourceType accountId providerId campaignId name status lastSeenAt')
          .lean()
          .exec()
      : [];

    const accountNames = new Map<string, string>();
    const campaignNames = new Map<string, string>();
    for (const resource of resources as any[]) {
      const scope = `${String(resource.connectionId)}:${resource.accountId}`;
      if (resource.resourceType === 'account' && resource.name) accountNames.set(scope, resource.name);
      if (resource.resourceType === 'campaign' && resource.name) {
        campaignNames.set(`${scope}:${resource.providerId}`, resource.name);
      }
    }

    const bySelectionKey = new Map<string, AdsAttributionOption>();
    for (const resource of resources as any[]) {
      if (resource.resourceType !== 'ad_group') continue;
      const connectionId = String(resource.connectionId);
      const accountId = String(resource.accountId);
      const campaignId = String(resource.campaignId || '');
      const adGroupId = String(resource.providerId);
      const selectionKey = `google:${accountId}:${campaignId}:${adGroupId}`;
      const accountName = accountNames.get(`${connectionId}:${accountId}`);
      const campaignName = campaignNames.get(`${connectionId}:${accountId}:${campaignId}`);
      const option: AdsAttributionOption = {
        selectionKey,
        source: 'windsor',
        provider: 'google',
        accountId,
        accountName,
        campaignId,
        campaignName,
        adGroupId,
        adGroupName: resource.name,
        status: resource.status,
        lastSeenAt: resource.lastSeenAt ? new Date(resource.lastSeenAt).toISOString() : undefined,
        label: this.label('Google', accountName || accountId, campaignName || campaignId, resource.name || adGroupId, adGroupId),
      };
      const current = bySelectionKey.get(selectionKey);
      if (!current || String(current.lastSeenAt || '') < String(option.lastSeenAt || '')) {
        bySelectionKey.set(selectionKey, option);
      }
    }

    const windsorAdGroupIds = new Set([...bySelectionKey.values()].map((option) => option.adGroupId));
    for (const group of localGroups as any[]) {
      const adGroupId = String(group.adGroupId || '').trim();
      const provider = String(group.platform || '').toLowerCase() as AdsAttributionProvider;
      if (!adGroupId || !['google', 'facebook', 'tiktok'].includes(provider)) continue;
      if (provider === 'google' && windsorAdGroupIds.has(adGroupId)) continue;
      const selectionKey = `erp:${provider}:${adGroupId}`;
      bySelectionKey.set(selectionKey, {
        selectionKey,
        source: 'erp_ad_group',
        provider,
        adGroupId,
        adGroupName: group.name,
        campaignId: group.campaignId,
        status: group.remoteStatus || (group.isActive ? 'ACTIVE' : 'INACTIVE'),
        lastSeenAt: group.lastSyncAt ? new Date(group.lastSyncAt).toISOString() : undefined,
        label: this.label(provider.toUpperCase(), undefined, group.campaignId, group.name || adGroupId, adGroupId),
      });
    }

    const items = [...bySelectionKey.values()].sort((left, right) => left.label.localeCompare(right.label, 'vi'));
    const syncedAt = connections
      .map((connection: any) => connection.lastReadSyncAt ? new Date(connection.lastReadSyncAt).toISOString() : '')
      .sort()
      .at(-1) || undefined;
    return { items, syncedAt };
  }

  async resolve(selection: AdsAttributionSelection): Promise<AdsAttributionSnapshot> {
    const adGroupId = String(selection.adGroupId || '').trim();
    if (!adGroupId || adGroupId === '0') return this.emptySnapshot();

    const { items } = await this.list();
    const matches = items.filter((option) =>
      option.adGroupId === adGroupId
      && (!selection.adsProvider || option.provider === selection.adsProvider)
      && (!selection.adAccountProviderId || option.accountId === selection.adAccountProviderId)
      && (!selection.adCampaignId || option.campaignId === selection.adCampaignId),
    );

    if (matches.length > 1) {
      throw new BadRequestException('ID nhóm quảng cáo tồn tại ở nhiều tài khoản. Hãy chọn lại từ danh sách đồng bộ.');
    }
    if (matches.length === 0) {
      if (selection.adsProvider || selection.adAccountProviderId || selection.adCampaignId) {
        throw new BadRequestException('Nhóm quảng cáo không khớp dữ liệu đã đồng bộ. Hãy tải lại danh sách và chọn lại.');
      }
      return { ...this.emptySnapshot(), adGroupId, adsAttributionSource: 'manual' };
    }

    const option = matches[0];
    return {
      adGroupId: option.adGroupId,
      adsProvider: option.provider,
      adAccountProviderId: option.accountId,
      adCampaignId: option.campaignId,
      adAccountNameSnapshot: option.accountName,
      adCampaignNameSnapshot: option.campaignName,
      adGroupNameSnapshot: option.adGroupName,
      adsAttributionSource: option.source,
      adsAttributionSyncedAt: option.lastSeenAt ? new Date(option.lastSeenAt) : undefined,
    };
  }

  private emptySnapshot(): AdsAttributionSnapshot {
    return {
      adGroupId: undefined,
      adsProvider: undefined,
      adAccountProviderId: undefined,
      adCampaignId: undefined,
      adAccountNameSnapshot: undefined,
      adCampaignNameSnapshot: undefined,
      adGroupNameSnapshot: undefined,
      adsAttributionSource: undefined,
      adsAttributionSyncedAt: undefined,
    };
  }

  private label(provider: string, account: string | undefined, campaign: string | undefined, group: string, id: string): string {
    return [`[${provider}]`, account, campaign, `${group} (${id})`].filter(Boolean).join(' › ');
  }
}
