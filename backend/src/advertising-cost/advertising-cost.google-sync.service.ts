/**
 * Service: AdvertisingCostGoogleSyncService
 * Chức năng: Đồng bộ chi phí quảng cáo Google Ads vào collection AdvertisingCost (channel="google").
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';
import { AdvertisingCost, AdvertisingCostDocument } from './schemas/advertising-cost.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { AdvertisingCostRecalculationQueueService } from './advertising-cost.recalculation-queue.service';
import { ApiTokenService } from '../api-token/api-token.service';

@Injectable()
export class AdvertisingCostGoogleSyncService {
  private readonly logger = new Logger(AdvertisingCostGoogleSyncService.name);

  constructor(
    @InjectModel(AdvertisingCost.name) private readonly costModel: Model<AdvertisingCostDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    private readonly apiTokenService: ApiTokenService,
    private readonly recalculationQueue: AdvertisingCostRecalculationQueueService,
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

  private async upsertCost(customerId: string, adGroupId: string, day: Date, doc: Partial<AdvertisingCost>) {
    const payload: Partial<AdvertisingCost> = {
      adGroupId,
      customerId,
      channel: 'google',
      date: day,
      spentAmount: Number(doc.spentAmount || 0),
      cpm: Number(doc.cpm || 0),
      cpc: Number(doc.cpc || 0),
      impressions: Number((doc as any).impressions || 0),
      clicks: Number((doc as any).clicks || 0),
      conversions: Number(doc.conversions || 0),
      allConversions: Number(doc.allConversions || 0),
      conversionValue: Number(doc.conversionValue || 0),
      costPerConversion: Number(doc.costPerConversion || 0),
    };
    await this.costModel.updateOne(
      { channel: 'google', customerId, adGroupId, date: day },
      { $set: payload },
      { upsert: true },
    );
  }

  private buildGaql(adGroupIds: string[], dayISO: string): string {
    const ids = adGroupIds
      .map(id => this.sanitizeId(String(id)))
      .filter(Boolean) as string[];
    const idList = ids.map(i => i).join(',');
    return `SELECT segments.date, ad_group.id, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.average_cpc, metrics.average_cpm, metrics.conversions, metrics.all_conversions, metrics.conversions_value, metrics.cost_per_conversion
      FROM ad_group
      WHERE segments.date BETWEEN '${dayISO}' AND '${dayISO}'
      ${ids.length ? `AND ad_group.id IN (${idList})` : ''}`;
  }

  private parseNumber(val: any, scale: number = 1): number {
    const num = Number(val || 0);
    return Number.isFinite(num) ? num / scale : 0;
  }

  async getSyncHealth() {
    const now = Date.now();
    const googleConfig = await this.apiTokenService.getGoogleAdsRuntimeConfig();

    const latestRecord: any = await this.costModel
      .findOne({ channel: 'google' })
      .sort({ updatedAt: -1 })
      .select('date updatedAt adGroupId spentAmount customerId')
      .lean();

    const lastSyncAt = latestRecord?.updatedAt ? new Date(latestRecord.updatedAt).toISOString() : undefined;
    const syncFreshnessHours = lastSyncAt ? Math.round((now - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60)) : null;

    return {
      platform: 'google',
      token: {
        source: googleConfig.configSource,
        configured: Boolean(googleConfig.refreshToken || googleConfig.clientId || googleConfig.clientSecret || googleConfig.developerToken),
        developerTokenConfigured: Boolean(googleConfig.developerToken),
        oauthClientConfigured: Boolean(googleConfig.clientId && googleConfig.clientSecret),
        refreshTokenSource: googleConfig.refreshTokenSource,
        loginCustomerId: googleConfig.loginCustomerId || null,
        apiVersion: googleConfig.apiVersion,
      },
      sync: {
        lastRecordDate: latestRecord?.date ? new Date(latestRecord.date).toISOString().slice(0, 10) : null,
        lastSyncAt,
        freshnessHours: syncFreshnessHours,
        lastCustomerId: latestRecord?.customerId || null,
      },
    };
  }

  private async fetchCostForAccount(params: {
    account: AdAccountDocument;
    adGroupIds: string[];
    dayISO: string;
  }): Promise<number> {
    const customerId = this.sanitizeId(String(params.account.accountId));
    if (!customerId) {
      this.logger.warn(`accountId không hợp lệ cho Google Ads: ${params.account?.accountId}`);
      return 0;
    }

    const googleConfig = await this.apiTokenService.getGoogleAdsRuntimeConfig({
      customerId,
      loginCustomerId: String(params.account.loginCustomerId || ''),
    });

    const developerToken = googleConfig.developerToken;
    if (!developerToken) {
      this.logger.warn('Thiếu GOOGLE_ADS_DEVELOPER_TOKEN - bỏ qua đồng bộ Google Ads');
      return 0;
    }

    if (!googleConfig.refreshToken) {
      this.logger.warn(`Không tìm thấy refresh token cho account ${params.account?.accountId}`);
      return 0;
    }

    const accessToken = await this.apiTokenService.getGoogleAdsAccessToken(googleConfig);
    if (!accessToken) {
      this.logger.warn(`Không lấy được access token Google Ads cho account ${params.account?.accountId}`);
      return 0;
    }

    const loginCid = this.sanitizeId(String(googleConfig.loginCustomerId || customerId));
    const gaql = this.buildGaql(params.adGroupIds, params.dayISO);
    const url = `https://googleads.googleapis.com/${googleConfig.apiVersion}/customers/${customerId}/googleAds:searchStream`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
    };
    if (loginCid) headers['login-customer-id'] = loginCid;

    try {
      const res = await axios.post(url, { query: gaql }, { headers });
      const streams: any[] = Array.isArray(res.data) ? res.data : [];
      let updated = 0;
      for (const stream of streams) {
        const rows: any[] = Array.isArray(stream.results) ? stream.results : [];
        for (const row of rows) {
          const adGroupId = String(row?.adGroup?.id || row?.ad_group?.id || '');
          if (!adGroupId) continue;
          const metrics = row.metrics || row?.metrics;
          const impressions = this.parseNumber(metrics?.impressions);
          const clicks = this.parseNumber(metrics?.clicks);
          const costMicros = this.parseNumber(metrics?.costMicros ?? metrics?.cost_micros, 1_000_000);
          const avgCpcMicros = this.parseNumber(metrics?.averageCpc ?? metrics?.average_cpc, 1_000_000);
          const avgCpmMicros = this.parseNumber(metrics?.averageCpm ?? metrics?.average_cpm, 1_000_000);

          const conversions = this.parseNumber(metrics?.conversions);
          const allConversions = this.parseNumber(metrics?.allConversions ?? metrics?.all_conversions);
          const conversionValue = this.parseNumber(metrics?.conversionsValue ?? metrics?.conversions_value);
          const costPerConversion = this.parseNumber(
            metrics?.costPerConversion ?? metrics?.cost_per_conversion,
            1_000_000,
          );

          await this.upsertCost(customerId, adGroupId, this.normalizeDay(params.dayISO), {
            spentAmount: costMicros,
            cpc: avgCpcMicros,
            cpm: avgCpmMicros,
            impressions,
            clicks,
            conversions,
            allConversions,
            conversionValue,
            costPerConversion,
          } as any);
          updated++;
        }
      }
      return updated;
    } catch (err: any) {
      this.logger.warn(`Google Ads API lỗi cho account ${params.account?.accountId}: ${err?.response?.status} ${err?.response?.data?.error?.message || err?.message}`);
      return 0;
    }
  }

  /** Đồng bộ cho 1 ngày. customerIds: danh sách customer id (tuỳ chọn) */
  async syncForDate(dayISO: string, opts?: { customerIds?: string[] }) {
    const accounts = await this.adAccountModel.find({ accountType: 'google', isActive: true }).lean();
    const filteredAccounts = (opts?.customerIds && opts.customerIds.length)
      ? accounts.filter(a => opts.customerIds!.includes(String(a.accountId)) || opts.customerIds!.includes(this.sanitizeId(String(a.accountId)) || ''))
      : accounts;
    if (!filteredAccounts.length) return { date: dayISO, updated: 0, accounts: 0 };

    const accountIds = filteredAccounts.map(a => a._id);
    const adGroups = await this.adGroupModel
      .find({ platform: 'google', isActive: true, adAccountId: { $in: accountIds } })
      .select('adGroupId adAccountId')
      .lean();

    let updated = 0;
    for (const acc of filteredAccounts) {
      const groups = adGroups.filter(g => String(g.adAccountId) === String(acc._id)).map(g => String(g.adGroupId));
      if (!groups.length) continue;
      // eslint-disable-next-line no-await-in-loop
      updated += await this.fetchCostForAccount({ account: acc as any, adGroupIds: groups, dayISO });
    }

    return { date: dayISO, updated, accounts: filteredAccounts.length };
  }

  /** Đồng bộ N ngày lùi về trước (default hôm qua, tối đa 14 ngày) */
  async syncRange(opts?: { date?: string; days?: number; customerIds?: string[] }) {
    const base = opts?.date ? new Date(opts.date) : new Date();
    if (!opts?.date) { base.setDate(base.getDate() - 1); }
    const days = Math.max(1, Math.min(14, opts?.days ?? 1));
    const results: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      // eslint-disable-next-line no-await-in-loop
      const r = await this.syncForDate(iso, { customerIds: opts?.customerIds });
      results.push(r);
    }
    return results;
  }

  /**
   * Manual fallback only.
   * The primary 06:00 execution is handled by Finance/DataCollectionService.
   */
  async cronDailyGoogle() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayISO = yesterday.toISOString().slice(0,10);
      
      this.logger.log(`Starting Google Ads sync for ${dayISO} at 6:15 AM`);
      const res = await this.syncForDate(dayISO);
      this.logger.log(`Google Ads sync completed: updated ${res.updated} ad groups`);
      
      // Debounce recalculation để tránh chạy trùng với các cron sync khác.
      if (res.updated > 0) {
        this.recalculationQueue.scheduleRecalculation(dayISO, 'google-cron');
      }
    } catch (err) {
      this.logger.error('Cron Google Ads sync failed', err as any);
    }
  }
}
