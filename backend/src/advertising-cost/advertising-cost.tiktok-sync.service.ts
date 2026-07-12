/**
 * Sync TikTok advertising costs into AdvertisingCost.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { Model } from 'mongoose';
import { AdvertisingCost, AdvertisingCostDocument } from './schemas/advertising-cost.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenDocument } from '../api-token/schemas/api-token.schema';
import { AdvertisingCostRecalculationQueueService } from './advertising-cost.recalculation-queue.service';
import { ApiTokenService, TikTokRuntimeConfig } from '../api-token/api-token.service';

@Injectable()
export class AdvertisingCostTiktokSyncService {
  private readonly logger = new Logger(AdvertisingCostTiktokSyncService.name);

  constructor(
    @InjectModel(AdvertisingCost.name) private readonly costModel: Model<AdvertisingCostDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(ApiToken.name) private readonly tokenModel: Model<ApiTokenDocument>,
    private readonly recalculationQueue: AdvertisingCostRecalculationQueueService,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  private normalizeDay(dayISO: string): Date {
    const d = new Date(dayISO);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private sanitizeId(id?: string): string | undefined {
    if (!id) return undefined;
    const clean = String(id).replace(/[^0-9]/g, '');
    return clean || undefined;
  }

  private async getRuntimeConfig(): Promise<TikTokRuntimeConfig> {
    return this.apiTokenService.getTikTokRuntimeConfig();
  }

  async getSyncHealth() {
    const now = Date.now();
    const runtime = await this.getRuntimeConfig();
    const tokenDoc = await this.tokenModel
      .findOne({ provider: 'tiktok', status: 'active' })
      .sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 })
      .select('name lastCheckStatus lastCheckMessage lastCheckedAt lastUsedAt businessCenterId businessCenterName updatedAt')
      .lean();

    const latestRecord: any = await this.costModel
      .findOne({ channel: 'tiktok' })
      .sort({ updatedAt: -1 })
      .select('date updatedAt adGroupId spentAmount customerId businessCenterId')
      .lean();

    const lastSyncAt = latestRecord?.updatedAt ? new Date(latestRecord.updatedAt).toISOString() : undefined;
    const syncFreshnessHours = lastSyncAt ? Math.round((now - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60)) : null;

    return {
      platform: 'tiktok',
      token: {
        source: runtime.configSource,
        configured: runtime.configured,
        databaseTokenName: tokenDoc?.name || null,
        lastCheckStatus: tokenDoc?.lastCheckStatus || null,
        lastCheckMessage: tokenDoc?.lastCheckMessage || null,
        lastCheckedAt: tokenDoc?.lastCheckedAt ? new Date(tokenDoc.lastCheckedAt).toISOString() : null,
        lastUsedAt: tokenDoc?.lastUsedAt ? new Date(tokenDoc.lastUsedAt).toISOString() : null,
      },
      businessCenter: {
        id: runtime.businessCenterId || tokenDoc?.businessCenterId || latestRecord?.businessCenterId || null,
        name: runtime.businessCenterName || tokenDoc?.businessCenterName || null,
        advertisers: runtime.advertiserIds || [],
      },
      sync: {
        lastRecordDate: latestRecord?.date ? new Date(latestRecord.date).toISOString().slice(0, 10) : null,
        lastSyncAt,
        freshnessHours: syncFreshnessHours,
        lastAdvertiserId: latestRecord?.customerId || null,
      },
    };
  }

  private async markSystemTokenUsed(): Promise<void> {
    await this.tokenModel.updateMany(
      { provider: 'tiktok', status: 'active', name: 'TikTok Ads System Settings' },
      { $set: { lastUsedAt: new Date() } },
    );
  }

  private async getAccessToken(): Promise<string | undefined> {
    const runtime = await this.getRuntimeConfig();
    if (!runtime.accessToken) return undefined;
    if (runtime.configSource !== 'env' && runtime.configSource !== 'none') {
      await this.markSystemTokenUsed();
    }
    return runtime.accessToken;
  }

  private async upsertCost(params: {
    advertiserId: string;
    businessCenterId?: string;
    managementMode?: 'direct' | 'bm' | 'mcc' | 'bc';
    adGroupId: string;
    day: string;
    doc: Partial<AdvertisingCost>;
  }) {
    const date = this.normalizeDay(params.day);
    const payload: Partial<AdvertisingCost> = {
      adGroupId: params.adGroupId,
      customerId: params.advertiserId,
      businessCenterId: params.businessCenterId,
      managementMode: params.managementMode || 'bc',
      channel: 'tiktok',
      date,
      spentAmount: Number(params.doc.spentAmount || 0),
      cpm: Number(params.doc.cpm || 0),
      cpc: Number(params.doc.cpc || 0),
      frequency: Number((params.doc as any).frequency || 0),
      impressions: Number((params.doc as any).impressions || 0),
      reach: Number((params.doc as any).reach || 0),
      messagingConversationStarted7d: Number((params.doc as any).messagingConversationStarted7d || 0),
      costPerMessagingConversation: Number((params.doc as any).costPerMessagingConversation || 0),
    };
    await this.costModel.updateOne(
      { channel: 'tiktok', customerId: params.advertiserId, adGroupId: params.adGroupId, date },
      { $set: payload },
      { upsert: true },
    );
  }

  private async fetchForAdvertiser(opts: {
    advertiserId: string;
    businessCenterId?: string;
    managementMode?: 'direct' | 'bm' | 'mcc' | 'bc';
    dayISO: string;
    accessToken: string;
    adGroupIdsFilter?: Set<string>;
  }): Promise<number> {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/';
    let page = 1;
    let updated = 0;
    const pageSize = 1000;

    while (true) {
      try {
        const body = {
          advertiser_id: opts.advertiserId,
          report_type: 'BASIC',
          data_level: 'AUCTION_ADGROUP',
          dimensions: ['adgroup_id', 'stat_time_day'],
          metrics: ['spend', 'impressions', 'clicks', 'cpc', 'cpm', 'reach', 'frequency', 'conversion'],
          time_range: { start_date: opts.dayISO, end_date: opts.dayISO },
          page_size: pageSize,
          page,
        };

        const res = await axios.post(url, body, {
          headers: {
            'Access-Token': opts.accessToken,
            'Content-Type': 'application/json',
          },
        });

        const data = res.data?.data;
        const list: any[] = Array.isArray(data?.list) ? data.list : [];
        for (const row of list) {
          const adGroupId = String(row.adgroup_id || row.ad_group_id || '').trim();
          if (!adGroupId) continue;
          if (opts.adGroupIdsFilter && opts.adGroupIdsFilter.size > 0 && !opts.adGroupIdsFilter.has(adGroupId)) continue;
          const day = row.stat_time_day || opts.dayISO;
          const impressions = Number(row.impressions || 0);
          const reach = Number(row.reach || 0);
          const conversions = Number(row.conversion || 0);
          const costPerConv = conversions > 0 ? Number(row.spend) / conversions : 0;
          const frequency = Number(row.frequency || 0) || (reach > 0 ? impressions / reach : 0);
          await this.upsertCost({
            advertiserId: opts.advertiserId,
            businessCenterId: opts.businessCenterId,
            managementMode: opts.managementMode,
            adGroupId,
            day,
            doc: {
              spentAmount: row.spend,
              impressions,
              clicks: row.clicks,
              cpc: row.cpc,
              cpm: row.cpm,
              reach,
              frequency,
              messagingConversationStarted7d: conversions,
              costPerMessagingConversation: costPerConv,
            } as any,
          });
          updated += 1;
        }

        const pageInfo = data?.page_info || {};
        const hasMore = pageInfo.total_number && pageSize * page < pageInfo.total_number;
        if (!hasMore) break;
        page += 1;
      } catch (err: any) {
        this.logger.warn(`TikTok API error advertiser ${opts.advertiserId} day ${opts.dayISO}: ${err?.response?.status} ${err?.response?.data?.message || err?.message}`);
        break;
      }
    }

    return updated;
  }

  async syncForDate(dayISO: string, opts?: { advertiserIds?: string[] }) {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      this.logger.warn('Thieu TIKTOK_ACCESS_TOKEN hoac TikTok Ads System Settings. Bo qua dong bo.');
      return { date: dayISO, updated: 0, advertisers: 0, businessCenterId: null };
    }

    const runtime = await this.getRuntimeConfig();
    const accounts = await this.adAccountModel.find({ accountType: 'tiktok', isActive: true }).lean();
    const desiredAdvertisers = Array.from(new Set([
      ...(opts?.advertiserIds || []).map((item) => this.sanitizeId(item)).filter(Boolean) as string[],
      ...(runtime.advertiserIds || []).map((item) => this.sanitizeId(item)).filter(Boolean) as string[],
    ]));

    const filteredAccounts = desiredAdvertisers.length
      ? accounts.filter((account) => desiredAdvertisers.includes(this.sanitizeId(String(account.accountId)) || ''))
      : accounts;

    if (!filteredAccounts.length) {
      return {
        date: dayISO,
        updated: 0,
        advertisers: 0,
        businessCenterId: runtime.businessCenterId || null,
      };
    }

    const accountIds = filteredAccounts.map((account) => account._id);
    const adGroups = await this.adGroupModel.find({
      platform: 'tiktok',
      isActive: true,
      adAccountId: { $in: accountIds },
    })
      .select('adGroupId adAccountId')
      .lean();

    let totalUpdated = 0;
    for (const acc of filteredAccounts) {
      const advertiserId = this.sanitizeId(String(acc.accountId));
      if (!advertiserId) continue;
      const groupsForAcc = adGroups
        .filter((group) => String(group.adAccountId) === String(acc._id))
        .map((group) => String(group.adGroupId));
      const filterSet = new Set(groupsForAcc);
      // eslint-disable-next-line no-await-in-loop
      const updated = await this.fetchForAdvertiser({
        advertiserId,
        businessCenterId: this.sanitizeId(acc.businessCenterId) || runtime.businessCenterId,
        managementMode: (acc.managementMode as any) || 'bc',
        dayISO,
        accessToken,
        adGroupIdsFilter: filterSet,
      });
      totalUpdated += updated;
    }

    return {
      date: dayISO,
      updated: totalUpdated,
      advertisers: filteredAccounts.length,
      businessCenterId: runtime.businessCenterId || null,
    };
  }

  async syncRange(opts?: { date?: string; days?: number; advertiserIds?: string[] }) {
    const base = opts?.date ? new Date(opts.date) : new Date();
    if (!opts?.date) { base.setDate(base.getDate() - 1); }
    const days = Math.max(1, Math.min(14, opts?.days ?? 1));
    const results: any[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      // eslint-disable-next-line no-await-in-loop
      const result = await this.syncForDate(iso, { advertiserIds: opts?.advertiserIds });
      results.push(result);
    }
    return results;
  }

  /**
   * Manual fallback only.
   * The primary 06:00 execution is handled by Finance/DataCollectionService.
   */
  async cronDailyTiktok() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayISO = yesterday.toISOString().slice(0, 10);

      this.logger.log(`Starting TikTok Ads sync for ${dayISO} at 6:30 AM`);
      const res = await this.syncForDate(dayISO);
      this.logger.log(`TikTok Ads sync completed: updated ${res.updated} ad groups`);

      if (res.updated > 0) {
        this.recalculationQueue.scheduleRecalculation(dayISO, 'tiktok-cron');
      }
    } catch (err) {
      this.logger.error('Cron TikTok Ads sync failed', err as any);
    }
  }

  /**
   * Lấy frequency + reach mới nhất cho một TikTok ad group từ collection advertisingcosts.
   * TikTok sync tại 00:00 đã lưu các giá trị này — không cần gọi thêm API.
   * Public method dùng bởi FrequencySyncService để update adGroups collection.
   *
   * @param adGroupId - TikTok ad group ID (= adGroupId trong DB)
   * @param dayISO    - Ngày cần lấy dữ liệu, định dạng 'YYYY-MM-DD'
   */
  async fetchFrequencyMetrics(
    adGroupId: string,
    dayISO: string,
  ): Promise<{ frequency: number; reach: number } | null> {
    const date = this.normalizeDay(dayISO);
    const record = await this.costModel
      .findOne({ channel: 'tiktok', adGroupId, date })
      .select('frequency reach')
      .lean();
    if (!record) return null;
    const frequency = Number((record as any).frequency || 0);
    const reach = Number((record as any).reach || 0);
    if (frequency === 0 && reach === 0) return null;
    return { frequency, reach };
  }
}
