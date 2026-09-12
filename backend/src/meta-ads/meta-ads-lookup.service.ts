import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import {
  MetaAdsCampaign,
  MetaAdsCampaignDocument,
} from './schemas/meta-ads-campaign.schema';
import { MetaAdsAdSet, MetaAdsAdSetDocument } from './schemas/meta-ads-ad-set.schema';
import {
  MetaAdsAdCreative,
  MetaAdsAdCreativeDocument,
} from './schemas/meta-ads-ad-creative.schema';
import { MetaAdsAd, MetaAdsAdDocument } from './schemas/meta-ads-ad.schema';

export type MetaAdsAccountReadinessBlocker = {
  code:
    | 'NOT_ALLOWLISTED'
    | 'CURRENCY_NOT_VND'
    | 'TIMEZONE_NOT_VIETNAM'
    | 'PROVIDER_ACCOUNT_NOT_ACTIVE'
    | 'SYNC_NOT_SUCCESSFUL'
    | 'SYNC_TIMESTAMP_MISSING'
    | 'SYNC_TIMESTAMP_INVALID'
    | 'SYNC_TIMESTAMP_IN_FUTURE'
    | 'SYNC_STALE';
  message: string;
};

export type MetaAdsAccountLookupItem = {
  adAccountId: string;
  name: string;
  currency?: string;
  timezone?: string;
  accountStatus?: number;
  lastSyncAt?: string;
  lastSyncStatus?: 'ok' | 'error';
  eligible: boolean;
  readinessBlockers: MetaAdsAccountReadinessBlocker[];
};

type SafeAdAccountProjection = Pick<
  AdAccount,
  | 'accountId'
  | 'name'
  | 'currency'
  | 'timezoneId'
  | 'accountStatus'
  | 'lastSyncAt'
  | 'lastSyncStatus'
>;

export type MetaAdsCampaignLookupItem = {
  campaignId: string;
  name: string;
  objective: string;
  status: string;
  effectiveStatus?: string;
  budgetMode?: 'ABO' | 'CBO';
  budgetType?: 'NONE' | 'DAILY' | 'LIFETIME';
  dailyBudgetVnd?: number;
  lifetimeBudgetVnd?: number;
  lastReadbackAt?: string;
};

export type MetaAdsAdSetLookupItem = {
  adSetId: string;
  campaignId: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  budgetMode?: 'ABO' | 'CBO';
  internalAdGroupId?: string;
  internalProductIds: string[];
  lastReadbackAt?: string;
};

export type MetaAdsAdCreativeLookupItem = {
  creativeId: string;
  name: string;
  pageId: string;
  instagramActorId?: string;
  headline: string;
  destinationUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  lastReadbackAt?: string;
};

export type MetaAdsAdLookupItem = {
  adId: string;
  adSetId: string;
  creativeId: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  lastReadbackAt?: string;
};

@Injectable()
export class MetaAdsLookupService {
  constructor(
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(MetaAdsCampaign.name)
    private readonly campaignModel: Model<MetaAdsCampaignDocument>,
    @InjectModel(MetaAdsAdSet.name)
    private readonly adSetModel: Model<MetaAdsAdSetDocument>,
    @InjectModel(MetaAdsAdCreative.name)
    private readonly creativeModel: Model<MetaAdsAdCreativeDocument>,
    @InjectModel(MetaAdsAd.name)
    private readonly adModel: Model<MetaAdsAdDocument>,
  ) {}

  async listAdAccounts(): Promise<MetaAdsAccountLookupItem[]> {
    const accounts = await this.adAccountModel
      .find(
        { accountType: 'facebook', isActive: true },
        {
          _id: 0,
          accountId: 1,
          name: 1,
          currency: 1,
          timezoneId: 1,
          accountStatus: 1,
          lastSyncAt: 1,
          lastSyncStatus: 1,
        },
      )
      .lean()
      .exec() as SafeAdAccountProjection[];

    return accounts
      .map((account) => this.toLookupItem(account))
      .filter((account): account is MetaAdsAccountLookupItem => Boolean(account))
      .sort((left, right) =>
        left.name.localeCompare(right.name, 'vi')
        || left.adAccountId.localeCompare(right.adAccountId));
  }

  async listCampaigns(adAccountIdInput: string): Promise<MetaAdsCampaignLookupItem[]> {
    const adAccountId = this.allowlistedAccountId(adAccountIdInput);
    const campaigns: any[] = await this.campaignModel
      .find(
        { adAccountId, status: { $nin: ['ARCHIVED', 'DELETED'] } },
        {
          _id: 0,
          campaignId: 1,
          name: 1,
          objective: 1,
          status: 1,
          effectiveStatus: 1,
          budgetMode: 1,
          budgetType: 1,
          dailyBudgetVnd: 1,
          lifetimeBudgetVnd: 1,
          lastReadbackAt: 1,
        },
      )
      .sort({ lastReadbackAt: -1, campaignId: 1 })
      .limit(500)
      .lean()
      .exec();

    return campaigns.flatMap((campaign) => {
      const campaignId = this.numericAccountId(campaign?.campaignId);
      if (!campaignId) return [];
      const lastReadbackAt = this.validDate(campaign?.lastReadbackAt);
      return [{
        campaignId,
        name: String(campaign?.name || campaignId).trim(),
        objective: String(campaign?.objective || '').trim(),
        status: String(campaign?.status || '').trim().toUpperCase(),
        ...(campaign?.effectiveStatus
          ? { effectiveStatus: String(campaign.effectiveStatus).trim().toUpperCase() }
          : {}),
        ...(['ABO', 'CBO'].includes(campaign?.budgetMode)
          ? { budgetMode: campaign.budgetMode }
          : {}),
        ...(['NONE', 'DAILY', 'LIFETIME'].includes(campaign?.budgetType)
          ? { budgetType: campaign.budgetType }
          : {}),
        ...(Number.isSafeInteger(campaign?.dailyBudgetVnd)
          ? { dailyBudgetVnd: Number(campaign.dailyBudgetVnd) }
          : {}),
        ...(Number.isSafeInteger(campaign?.lifetimeBudgetVnd)
          ? { lifetimeBudgetVnd: Number(campaign.lifetimeBudgetVnd) }
          : {}),
        ...(lastReadbackAt ? { lastReadbackAt: lastReadbackAt.toISOString() } : {}),
      } as MetaAdsCampaignLookupItem];
    });
  }

  async listAdSets(adAccountIdInput: string): Promise<MetaAdsAdSetLookupItem[]> {
    const adAccountId = this.allowlistedAccountId(adAccountIdInput);
    const resources: any[] = await this.adSetModel
      .find(
        { adAccountId, status: { $nin: ['ARCHIVED', 'DELETED'] } },
        {
          _id: 0, adSetId: 1, campaignId: 1, name: 1, status: 1, effectiveStatus: 1,
          budgetMode: 1, internalAdGroupId: 1, internalProductIds: 1, lastReadbackAt: 1,
        },
      )
      .sort({ lastReadbackAt: -1, adSetId: 1 })
      .limit(500)
      .lean()
      .exec();
    return resources.flatMap((resource) => {
      const adSetId = this.numericAccountId(resource?.adSetId);
      const campaignId = this.numericAccountId(resource?.campaignId);
      if (!adSetId || !campaignId) return [];
      const lastReadbackAt = this.validDate(resource?.lastReadbackAt);
      return [{
        adSetId,
        campaignId,
        name: String(resource?.name || adSetId).trim(),
        status: String(resource?.status || '').trim().toUpperCase(),
        ...(resource?.effectiveStatus
          ? { effectiveStatus: String(resource.effectiveStatus).trim().toUpperCase() }
          : {}),
        ...(['ABO', 'CBO'].includes(resource?.budgetMode)
          ? { budgetMode: resource.budgetMode }
          : {}),
        ...(resource?.internalAdGroupId
          ? { internalAdGroupId: String(resource.internalAdGroupId).trim() }
          : {}),
        internalProductIds: Array.isArray(resource?.internalProductIds)
          ? resource.internalProductIds.map(String)
          : [],
        ...(lastReadbackAt ? { lastReadbackAt: lastReadbackAt.toISOString() } : {}),
      } as MetaAdsAdSetLookupItem];
    });
  }

  async listAdCreatives(adAccountIdInput: string): Promise<MetaAdsAdCreativeLookupItem[]> {
    const adAccountId = this.allowlistedAccountId(adAccountIdInput);
    const resources: any[] = await this.creativeModel
      .find(
        { adAccountId },
        {
          _id: 0, creativeId: 1, name: 1, pageId: 1, instagramActorId: 1,
          headline: 1, destinationUrl: 1, imageHash: 1, videoId: 1, lastReadbackAt: 1,
        } as any,
      )
      .sort({ lastReadbackAt: -1, creativeId: 1 })
      .limit(500)
      .lean()
      .exec();
    return resources.flatMap((resource) => {
      const creativeId = this.numericAccountId(resource?.creativeId);
      const pageId = this.numericAccountId(resource?.pageId);
      if (!creativeId || !pageId || (!resource?.imageHash && !resource?.videoId)) return [];
      const lastReadbackAt = this.validDate(resource?.lastReadbackAt);
      return [{
        creativeId,
        name: String(resource?.name || creativeId).trim(),
        pageId,
        ...(this.numericAccountId(resource?.instagramActorId)
          ? { instagramActorId: this.numericAccountId(resource.instagramActorId) }
          : {}),
        headline: String(resource?.headline || '').trim(),
        destinationUrl: String(resource?.destinationUrl || '').trim(),
        mediaType: resource?.videoId ? 'VIDEO' : 'IMAGE',
        ...(lastReadbackAt ? { lastReadbackAt: lastReadbackAt.toISOString() } : {}),
      } as MetaAdsAdCreativeLookupItem];
    });
  }

  async listAds(adAccountIdInput: string): Promise<MetaAdsAdLookupItem[]> {
    const adAccountId = this.allowlistedAccountId(adAccountIdInput);
    const resources: any[] = await this.adModel
      .find(
        { adAccountId, status: { $nin: ['ARCHIVED', 'DELETED'] } },
        {
          _id: 0, adId: 1, adSetId: 1, creativeId: 1, name: 1,
          status: 1, effectiveStatus: 1, lastReadbackAt: 1,
        },
      )
      .sort({ lastReadbackAt: -1, adId: 1 })
      .limit(500)
      .lean()
      .exec();
    return resources.flatMap((resource) => {
      const adId = this.numericAccountId(resource?.adId);
      const adSetId = this.numericAccountId(resource?.adSetId);
      const creativeId = this.numericAccountId(resource?.creativeId);
      if (!adId || !adSetId || !creativeId) return [];
      const lastReadbackAt = this.validDate(resource?.lastReadbackAt);
      return [{
        adId,
        adSetId,
        creativeId,
        name: String(resource?.name || adId).trim(),
        status: String(resource?.status || '').trim().toUpperCase(),
        ...(resource?.effectiveStatus
          ? { effectiveStatus: String(resource.effectiveStatus).trim().toUpperCase() }
          : {}),
        ...(lastReadbackAt ? { lastReadbackAt: lastReadbackAt.toISOString() } : {}),
      } as MetaAdsAdLookupItem];
    });
  }

  private toLookupItem(
    account: SafeAdAccountProjection,
  ): MetaAdsAccountLookupItem | undefined {
    const adAccountId = this.numericAccountId(account.accountId);
    if (!adAccountId) return undefined;

    const blockers = this.readinessBlockers(account, adAccountId);
    const lastSyncAt = this.validDate(account.lastSyncAt);
    return {
      adAccountId,
      name: String(account.name || '').trim(),
      ...(account.currency ? { currency: String(account.currency).trim() } : {}),
      ...(account.timezoneId ? { timezone: String(account.timezoneId).trim() } : {}),
      ...(Number.isFinite(Number(account.accountStatus))
        ? { accountStatus: Number(account.accountStatus) }
        : {}),
      ...(lastSyncAt ? { lastSyncAt: lastSyncAt.toISOString() } : {}),
      ...(account.lastSyncStatus ? { lastSyncStatus: account.lastSyncStatus } : {}),
      eligible: blockers.length === 0,
      readinessBlockers: blockers,
    };
  }

  private readinessBlockers(
    account: SafeAdAccountProjection,
    adAccountId: string,
  ): MetaAdsAccountReadinessBlocker[] {
    const blockers: MetaAdsAccountReadinessBlocker[] = [];
    const allowlist = this.accountAllowlist();
    if (!allowlist.has(adAccountId)) {
      blockers.push({
        code: 'NOT_ALLOWLISTED',
        message: 'Account is not in META_ADS_ACCOUNT_ID_ALLOWLIST.',
      });
    }
    if (String(account.currency || '').trim() !== 'VND') {
      blockers.push({ code: 'CURRENCY_NOT_VND', message: 'Account currency must be VND.' });
    }
    if (String(account.timezoneId || '').trim() !== 'Asia/Ho_Chi_Minh') {
      blockers.push({
        code: 'TIMEZONE_NOT_VIETNAM',
        message: 'Account timezone must be Asia/Ho_Chi_Minh.',
      });
    }
    if (Number(account.accountStatus) !== 1) {
      blockers.push({
        code: 'PROVIDER_ACCOUNT_NOT_ACTIVE',
        message: 'Provider account status is not active.',
      });
    }
    if (account.lastSyncStatus !== 'ok') {
      blockers.push({
        code: 'SYNC_NOT_SUCCESSFUL',
        message: 'The latest canonical account sync did not succeed.',
      });
    }

    const rawSync = account.lastSyncAt;
    if (rawSync === undefined || rawSync === null) {
      blockers.push({ code: 'SYNC_TIMESTAMP_MISSING', message: 'Account sync timestamp is missing.' });
      return blockers;
    }
    const lastSyncAt = this.validDate(rawSync);
    if (!lastSyncAt) {
      blockers.push({ code: 'SYNC_TIMESTAMP_INVALID', message: 'Account sync timestamp is invalid.' });
      return blockers;
    }
    const now = Date.now();
    if (lastSyncAt.getTime() > now + 60_000) {
      blockers.push({
        code: 'SYNC_TIMESTAMP_IN_FUTURE',
        message: 'Account sync timestamp is unexpectedly in the future.',
      });
    } else if (now - lastSyncAt.getTime() > this.accountSyncMaxAgeMs()) {
      blockers.push({ code: 'SYNC_STALE', message: 'Canonical account sync is stale.' });
    }
    return blockers;
  }

  private numericAccountId(value: unknown): string | undefined {
    const normalized = String(value || '').trim().replace(/^act_/i, '');
    return /^\d{1,32}$/.test(normalized) ? normalized : undefined;
  }

  private allowlistedAccountId(value: unknown): string {
    const adAccountId = this.numericAccountId(value);
    if (!adAccountId) {
      throw new BadRequestException('adAccountId must be a numeric Meta account ID.');
    }
    if (!this.accountAllowlist().has(adAccountId)) {
      throw new BadRequestException('Meta ad account is not allowlisted for canonical lookup.');
    }
    return adAccountId;
  }

  private accountAllowlist(): Set<string> {
    return new Set(
      String(process.env.META_ADS_ACCOUNT_ID_ALLOWLIST || '')
        .split(',')
        .map((value) => this.numericAccountId(value))
        .filter((value): value is string => Boolean(value)),
    );
  }

  private validDate(value: unknown): Date | undefined {
    const date = value instanceof Date ? value : new Date(value as any);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private accountSyncMaxAgeMs(): number {
    const configured = Number(process.env.META_ADS_ACCOUNT_SYNC_MAX_AGE_MS);
    if (!Number.isFinite(configured)) return 15 * 60 * 1000;
    return Math.min(24 * 60 * 60 * 1000, Math.max(60_000, Math.trunc(configured)));
  }
}
