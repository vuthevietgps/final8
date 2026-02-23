/**
 * Service: AdvertisingCostTiktokSyncService
 * Chức năng: Đồng bộ chi phí quảng cáo TikTok vào collection AdvertisingCost (channel = 'tiktok').
 * Yêu cầu: TIKTOK_ACCESS_TOKEN (hoặc ApiToken provider=tiktok), TIKTOK_ADVERTISER_IDS (tuỳ chọn),
 * hoặc dùng accountId của AdAccount type=tiktok.
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
import { TestOrder2Service } from '../test-order2/test-order2.service';

@Injectable()
export class AdvertisingCostTiktokSyncService {
  private readonly logger = new Logger(AdvertisingCostTiktokSyncService.name);

  constructor(
    @InjectModel(AdvertisingCost.name) private readonly costModel: Model<AdvertisingCostDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(ApiToken.name) private readonly tokenModel: Model<ApiTokenDocument>,
    private readonly testOrder2Service: TestOrder2Service,
  ) {}

  private normalizeDay(dayISO: string): Date {
    const d = new Date(dayISO);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private sanitizeId(id?: string): string | undefined {
    if (!id) return undefined;
    const clean = id.replace(/[^0-9]/g, '');
    return clean || undefined;
  }

  /** Lấy access token TikTok: ưu tiên env, sau đó ApiToken provider=tiktok */
  private async getAccessToken(): Promise<string | undefined> {
    if (process.env.TIKTOK_ACCESS_TOKEN) return process.env.TIKTOK_ACCESS_TOKEN.trim();
    const tokenDoc = await this.tokenModel
      .findOne({ provider: 'tiktok', status: 'active' })
      .sort({ isPrimary: -1, updatedAt: -1 })
      .lean();
    if (!tokenDoc) return undefined;
    try {
      const { decryptToken } = await import('../api-token/crypto.util');
      if ((tokenDoc as any).tokenEnc) {
        const raw = decryptToken((tokenDoc as any).tokenEnc);
        if (raw) return raw;
      }
    } catch {}
    return (tokenDoc as any).token;
  }

  private async upsertCost(adGroupId: string, day: string, doc: Partial<AdvertisingCost>) {
    const date = this.normalizeDay(day);
    const payload: Partial<AdvertisingCost> = {
      adGroupId,
      channel: 'tiktok',
      date,
      spentAmount: Number(doc.spentAmount || 0),
      cpm: Number(doc.cpm || 0),
      cpc: Number(doc.cpc || 0),
      impressions: Number((doc as any).impressions || 0),
      clicks: Number((doc as any).clicks || 0),
    };
    await this.costModel.updateOne({ adGroupId, date }, { $set: payload }, { upsert: true });
  }

  /** Gọi TikTok report API cho 1 advertiser + 1 ngày */
  private async fetchForAdvertiser(opts: { advertiserId: string; dayISO: string; accessToken: string; adGroupIdsFilter?: Set<string> }): Promise<number> {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/';
    let page = 1;
    let updated = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      try {
        const body = {
          advertiser_id: opts.advertiserId,
          report_type: 'BASIC',
          data_level: 'AUCTION_ADGROUP',
          dimensions: ['adgroup_id', 'stat_time_day'],
          metrics: ['spend', 'impressions', 'clicks', 'cpc', 'cpm'],
          time_range: { start_date: opts.dayISO, end_date: opts.dayISO },
          page_size: PAGE_SIZE,
          page: page,
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
          await this.upsertCost(adGroupId, day, {
            spentAmount: row.spend,
            impressions: row.impressions,
            clicks: row.clicks,
            cpc: row.cpc,
            cpm: row.cpm,
          });
          updated++;
        }

        const pageInfo = data?.page_info || {};
        const hasMore = pageInfo.total_number && PAGE_SIZE * page < pageInfo.total_number;
        if (!hasMore) break;
        page += 1;
      } catch (err: any) {
        this.logger.warn(`TikTok API error advertiser ${opts.advertiserId} day ${opts.dayISO}: ${err?.response?.status} ${err?.response?.data?.message || err?.message}`);
        break;
      }
    }

    return updated;
  }

  /** Đồng bộ 1 ngày cho các advertiser (TikTok) */
  async syncForDate(dayISO: string, opts?: { advertiserIds?: string[] }) {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      this.logger.warn('Thiếu TIKTOK_ACCESS_TOKEN hoặc ApiToken provider=tiktok. Bỏ qua đồng bộ.');
      return { date: dayISO, updated: 0, advertisers: 0 };
    }

    const accounts = await this.adAccountModel.find({ accountType: 'tiktok', isActive: true }).lean();
    const filteredAccounts = opts?.advertiserIds && opts.advertiserIds.length
      ? accounts.filter(a => opts.advertiserIds!.includes(String(this.sanitizeId(String(a.accountId)))) || opts.advertiserIds!.includes(String(a.accountId)))
      : accounts;

    if (!filteredAccounts.length) return { date: dayISO, updated: 0, advertisers: 0 };

    // Lọc adGroup theo account
    const accountIds = filteredAccounts.map(a => a._id);
    const adGroups = await this.adGroupModel.find({ platform: 'tiktok', isActive: true, adAccountId: { $in: accountIds } })
      .select('adGroupId adAccountId')
      .lean();

    let totalUpdated = 0;
    for (const acc of filteredAccounts) {
      const advertiserId = this.sanitizeId(String(acc.accountId));
      if (!advertiserId) continue;
      const groupsForAcc = adGroups.filter(g => String(g.adAccountId) === String(acc._id)).map(g => String(g.adGroupId));
      const filterSet = new Set(groupsForAcc);
      // eslint-disable-next-line no-await-in-loop
      const up = await this.fetchForAdvertiser({ advertiserId, dayISO, accessToken, adGroupIdsFilter: filterSet });
      totalUpdated += up;
    }

    return { date: dayISO, updated: totalUpdated, advertisers: filteredAccounts.length };
  }

  /** Đồng bộ N ngày lùi về trước (default hôm qua, tối đa 14) */
  async syncRange(opts?: { date?: string; days?: number; advertiserIds?: string[] }) {
    const base = opts?.date ? new Date(opts.date) : new Date();
    if (!opts?.date) { base.setDate(base.getDate() - 1); }
    const days = Math.max(1, Math.min(14, opts?.days ?? 1));
    const results: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      // eslint-disable-next-line no-await-in-loop
      const r = await this.syncForDate(iso, { advertiserIds: opts?.advertiserIds });
      results.push(r);
    }
    return results;
  }

  /** Cron 06:30 hằng ngày cho TikTok (ngày hôm qua) và recalculate orders */
  @Cron('30 6 * * *')
  async cronDailyTiktok() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayISO = yesterday.toISOString().slice(0,10);
      
      this.logger.log(`Starting TikTok Ads sync for ${dayISO} at 6:30 AM`);
      const res = await this.syncForDate(dayISO);
      this.logger.log(`TikTok Ads sync completed: updated ${res.updated} ad groups`);
      
      // Recalculate all orders for this date after sync
      if (res.updated > 0 && this.testOrder2Service) {
        this.logger.log(`Recalculating orders for ${dayISO}...`);
        const recalcResult = await this.testOrder2Service.recalculateOrdersForDate(dayISO);
        this.logger.log(`Recalculation completed: ${recalcResult.updated} orders updated`);
      }
    } catch (err) {
      this.logger.error('Cron TikTok Ads sync failed', err as any);
    }
  }
}
