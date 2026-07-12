/**
 * Service: AdvertisingCostFacebookSyncService
 * Chức năng: Tự động đồng bộ chi phí nhóm quảng cáo (adGroup/adset) từ Facebook Marketing API.
 * Nguồn token: ưu tiên env FB_ADS_ACCESS_TOKEN; fallback token active trong collection api_tokens (provider=facebook).
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { Model } from 'mongoose';
import { AdvertisingCost, AdvertisingCostDocument } from './schemas/advertising-cost.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenDocument } from '../api-token/schemas/api-token.schema';
import { ApiTokenService } from '../api-token/api-token.service';
import { AdvertisingCostRecalculationQueueService } from './advertising-cost.recalculation-queue.service';
import { getMetaGraphApiVersion } from '../common/ads-api-version';

const FB_GRAPH_API_VERSION = getMetaGraphApiVersion();
const FB_SYNC_FAILURE_ALERT_THRESHOLD = Number(process.env.FB_SYNC_FAILURE_ALERT_THRESHOLD || 2);

@Injectable()
export class AdvertisingCostFacebookSyncService {
  private readonly logger = new Logger(AdvertisingCostFacebookSyncService.name);
  private consecutiveSyncFailures = 0;
  private lastSyncFailureAt?: Date;
  private lastSyncFailureReason?: string;

  constructor(
    @InjectModel(AdvertisingCost.name) private readonly costModel: Model<AdvertisingCostDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(ApiToken.name) private readonly tokenModel: Model<ApiTokenDocument>,
    private readonly recalculationQueue: AdvertisingCostRecalculationQueueService,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  /** Lấy access token Facebook ưu tiên từ env, sau đó từ ApiToken collection */
  private async getAccessToken(): Promise<string | undefined> {
    if (process.env.FB_ADS_ACCESS_TOKEN) return process.env.FB_ADS_ACCESS_TOKEN.trim();
    const systemRaw = await this.apiTokenService.getRawAccessTokenForAdsManagement();
    if (systemRaw) return systemRaw;
    // Ưu tiên token hợp lệ gần đây và đánh dấu primary
    const preferred = await this.tokenModel.findOne({ provider: 'facebook', status: 'active', lastCheckStatus: 'valid' })
      .sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
    const fallback = preferred ?? await this.tokenModel.findOne({ provider: 'facebook', status: 'active' })
      .sort({ isPrimary: -1, updatedAt: -1 }).lean();
    if (!fallback) return undefined;
    // Hỗ trợ cả lưu thô (token) và mã hoá (tokenEnc)
    try {
      const { decryptToken } = await import('../api-token/crypto.util');
      if (fallback.tokenEnc) {
        const raw = decryptToken(fallback.tokenEnc);
        if (raw) return raw;
      }
    } catch {}
    return (fallback as any).token;
  }

  private markSyncFailure(reason: string): void {
    this.consecutiveSyncFailures += 1;
    this.lastSyncFailureAt = new Date();
    this.lastSyncFailureReason = reason;

    if (this.consecutiveSyncFailures >= FB_SYNC_FAILURE_ALERT_THRESHOLD) {
      this.logger.error(
        `Facebook sync has failed ${this.consecutiveSyncFailures} consecutive run(s). Last reason: ${reason}`,
      );
    } else {
      this.logger.warn(`Facebook sync failed: ${reason}`);
    }
  }

  private markSyncSuccess(): void {
    if (this.consecutiveSyncFailures > 0) {
      this.logger.log(`Facebook sync recovered after ${this.consecutiveSyncFailures} failed run(s).`);
    }
    this.consecutiveSyncFailures = 0;
    this.lastSyncFailureAt = undefined;
    this.lastSyncFailureReason = undefined;
  }

  async getSyncHealth() {
    const now = Date.now();
    const envToken = process.env.FB_ADS_ACCESS_TOKEN?.trim();
    const dbToken = await this.tokenModel
      .findOne({ provider: 'facebook', status: 'active' })
      .sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 })
      .select('name isPrimary expireAt lastCheckStatus lastCheckMessage lastCheckedAt updatedAt')
      .lean();

    const latestRecord: any = await this.costModel
      .findOne({ channel: 'facebook' })
      .sort({ updatedAt: -1 })
      .select('date updatedAt adGroupId spentAmount')
      .lean();

    const tokenExpireAt = dbToken?.expireAt ? new Date(dbToken.expireAt).toISOString() : undefined;
    const tokenHoursToExpire = dbToken?.expireAt
      ? Math.round((new Date(dbToken.expireAt).getTime() - now) / (1000 * 60 * 60))
      : undefined;
    const lastSyncAt = latestRecord?.updatedAt ? new Date(latestRecord.updatedAt).toISOString() : undefined;
    const syncFreshnessHours = lastSyncAt ? Math.round((now - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60)) : null;

    return {
      platform: 'facebook',
      token: {
        source: envToken ? 'env' : (dbToken ? 'database' : 'none'),
        configured: Boolean(envToken || dbToken),
        envToken: Boolean(envToken),
        databaseTokenName: dbToken?.name || null,
        lastCheckStatus: dbToken?.lastCheckStatus || null,
        lastCheckMessage: dbToken?.lastCheckMessage || null,
        lastCheckedAt: dbToken?.lastCheckedAt ? new Date(dbToken.lastCheckedAt).toISOString() : null,
        expireAt: tokenExpireAt || null,
        expiresInHours: tokenHoursToExpire ?? null,
        isExpired: typeof tokenHoursToExpire === 'number' ? tokenHoursToExpire <= 0 : null,
      },
      sync: {
        lastRecordDate: latestRecord?.date ? new Date(latestRecord.date).toISOString().slice(0, 10) : null,
        lastSyncAt,
        freshnessHours: syncFreshnessHours,
      },
      failures: {
        consecutive: this.consecutiveSyncFailures,
        lastFailureAt: this.lastSyncFailureAt ? this.lastSyncFailureAt.toISOString() : null,
        lastFailureReason: this.lastSyncFailureReason || null,
      },
    };
  }

  /** Upsert 1 bản ghi chi phí cho adGroupId + date */
  private async upsertCost(adGroupId: string, day: Date, doc: Partial<AdvertisingCost>) {
    // Chuẩn hoá ngày về UTC 00:00:00 để đồng nhất toàn hệ thống
    const date = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const payload: Partial<AdvertisingCost> = {
      adGroupId,
      channel: 'facebook',
      date,
      spentAmount: Number(doc.spentAmount || 0),
      cpm: Number(doc.cpm || 0),
      cpc: Number(doc.cpc || 0),
      frequency: Number((doc as any).frequency || 0),
      impressions: Number((doc as any).impressions || 0),
      clicks: Number((doc as any).clicks || 0),
      reach: Number((doc as any).reach || 0),
      messagingConversationStarted7d: Number((doc as any).messagingConversationStarted7d || 0),
      costPerMessagingConversation: Number((doc as any).costPerMessagingConversation || 0),
      messagingFirstReply: Number((doc as any).messagingFirstReply || 0),
    };
    await this.costModel.updateOne({ channel: 'facebook', adGroupId, date }, { $set: payload }, { upsert: true });
  }

  /** Gọi Graph API lấy insights cho adset (adGroupId) trong 1 ngày */
  private async fetchAdsetInsights(adsetId: string, token: string, dayISO: string) {
    const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${encodeURIComponent(adsetId)}/insights`;
    const params = {
      // Use actions-based metrics to remain compatible with newer Marketing API versions
      // messaging_conversation_started_* and messaging_first_reply are exposed via actions/cost_per_action_type
      fields: 'spend,cpm,cpc,frequency,impressions,clicks,reach,actions,cost_per_action_type,date_start,date_stop',
      // time_range must be a JSON-encoded string for Graph API
      time_range: JSON.stringify({ since: dayISO, until: dayISO }),
      time_increment: 1,
      level: 'adset',
      // Align attribution with Ads Manager defaults for messaging objectives
      action_attribution_windows: '7d_click,1d_view',
      access_token: token,
    };
    try {
      const res = await axios.get(url, { params });
      const data = res.data?.data || [];
      if (!Array.isArray(data) || data.length === 0) return null;
      // Take first row (daily)
      const row = data[0] || {};

      // Parse actions arrays for messaging metrics
      const actions: Array<{ action_type?: string; value?: any }> = Array.isArray(row.actions) ? row.actions : [];
      const costPerActions: Array<{ action_type?: string; value?: any }> = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];

      // Helper to find numeric value by matching action_type substring
      const getActionValue = (substr: string): number => {
        const found = actions.find(a => typeof a?.action_type === 'string' && a.action_type.includes(substr));
        const v = Number((found as any)?.value ?? 0);
        return Number.isFinite(v) ? v : 0;
      };

      const getCostPerActionValue = (substr: string): number => {
        const found = costPerActions.find(a => typeof a?.action_type === 'string' && a.action_type.includes(substr));
        const v = Number((found as any)?.value ?? 0);
        return Number.isFinite(v) ? v : 0;
      };

      // Facebook historically used action_type keys like:
      //  - onsite_conversion.messaging_conversation_started_7d
      //  - messaging_first_reply (or onsite_conversion.messaging_first_reply)
      // We match by substring to be resilient to prefix changes.
      const messagingConversationStarted7d = getActionValue('messaging_conversation_started_7d');
      const messagingFirstReply = getActionValue('messaging_first_reply');
      const costPerMessagingConversation = getCostPerActionValue('messaging_conversation_started_7d');
      return {
        spend: Number(row.spend || 0),
        cpm: Number(row.cpm || 0),
        cpc: Number(row.cpc || 0),
        frequency: Number(row.frequency || 0),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        reach: Number(row.reach || 0),
        messagingConversationStarted7d,
        costPerMessagingConversation,
        messagingFirstReply,
      };
    } catch (err: any) {
      this.logger.warn(`FB insights error for ${adsetId} on ${dayISO}: ${err?.response?.status} ${err?.response?.data?.error?.message || err?.message}`);
      return null;
    }
  }

  /** Gọi Graph API lấy conversation metrics cho adset - tổng số cuộc hội thoại */
  async fetchAdsetConversationMetrics(adsetId: string): Promise<{ conversationCount: number; totalSpent: number } | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      // Lấy insights cho toàn bộ thời gian hoạt động của adset
      const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${encodeURIComponent(adsetId)}/insights`;
      const params = {
        // Use actions to derive messaging conversation counts
        fields: 'spend,actions',
        time_range: JSON.stringify({ since: '2024-01-01', until: new Date().toISOString().slice(0,10) }),
        level: 'adset',
        action_attribution_windows: '7d_click,1d_view',
        access_token: token,
      };
      
      const res = await axios.get(url, { params });
      const data = res.data?.data || [];
      if (!Array.isArray(data) || data.length === 0) return null;

      // Tính tổng từ tất cả các ngày
      let totalSpent = 0;
      let totalConversations = 0;
      
      for (const row of data) {
        totalSpent += Number(row.spend || 0);
        const actions: Array<{ action_type?: string; value?: any }> = Array.isArray(row.actions) ? row.actions : [];
        const found = actions.find(a => typeof a?.action_type === 'string' && a.action_type.includes('messaging_conversation_started_7d'));
        const v = Number((found as any)?.value ?? 0);
        totalConversations += Number.isFinite(v) ? v : 0;
      }

      return {
        conversationCount: totalConversations,
        totalSpent: totalSpent
      };
    } catch (err: any) {
      this.logger.warn(`FB conversation metrics error for ${adsetId}: ${err?.response?.status} ${err?.response?.data?.error?.message || err?.message}`);
      return null;
    }
  }

  /**
   * Lấy metrics frequency + reach cho một adset trong ngày cụ thể.
   * Public method dùng bởi FrequencySyncService để update adGroups collection.
   *
   * @param adsetId - Facebook adset ID (= adGroupId trong DB)
   * @param dayISO  - Ngày cần lấy dữ liệu, định dạng 'YYYY-MM-DD'
   */
  async fetchFrequencyMetrics(
    adsetId: string,
    dayISO: string,
  ): Promise<{ frequency: number; reach: number } | null> {
    const token = await this.getAccessToken();
    if (!token) {
      this.logger.warn(`Missing Facebook access token for frequency sync of adset ${adsetId}`);
      return null;
    }
    const ins = await this.fetchAdsetInsights(adsetId, token, dayISO);
    if (!ins) return null;
    return {
      frequency: ins.frequency,
      reach: ins.reach,
    };
  }

  /** Đồng bộ cho 1 ngày cố định (YYYY-MM-DD). Trả về số adGroup được lưu. */
  async syncForDate(dayISO: string, opts?: { trackFailure?: boolean }): Promise<{ date: string; updated: number }> {
    const trackFailure = opts?.trackFailure !== false;
    const token = await this.getAccessToken();
    if (!token) {
      if (trackFailure) this.markSyncFailure('Missing FB_ADS_ACCESS_TOKEN or active ApiToken for Facebook.');
      else this.logger.warn('Missing FB_ADS_ACCESS_TOKEN or active ApiToken for Facebook. Skip sync.');
      return { date: dayISO, updated: 0 };
    }

    // Lọc nhóm QC Facebook, active, có adAccount active
    const groups = await this.adGroupModel.find({ platform: 'facebook', isActive: true }).select('adGroupId adAccountId').lean();
    if (!groups.length) return { date: dayISO, updated: 0 };
    const accIds = Array.from(new Set(groups.map(g => String(g.adAccountId))));
    const activeAcc = await this.adAccountModel.find({ _id: { $in: accIds }, isActive: true, accountType: 'facebook' }).select('_id').lean();
    const activeAccSet = new Set(activeAcc.map(a => String(a._id)));
    const validGroups = groups.filter(g => activeAccSet.has(String(g.adAccountId)));
    if (!validGroups.length) {
      if (trackFailure) this.markSyncSuccess();
      return { date: dayISO, updated: 0 };
    }

    const day = new Date(dayISO);
    let updated = 0;
    for (const g of validGroups) {
      const adsetId = (g as any).adGroupId;
      if (!adsetId) continue;
      const ins = await this.fetchAdsetInsights(adsetId, token, dayISO);
      if (!ins) continue;
      await this.upsertCost(String(adsetId), day, { 
        spentAmount: ins.spend, 
        cpm: ins.cpm, 
        cpc: ins.cpc, 
        frequency: ins.frequency,
        impressions: ins.impressions,
        clicks: ins.clicks,
        reach: ins.reach,
        messagingConversationStarted7d: ins.messagingConversationStarted7d,
        costPerMessagingConversation: ins.costPerMessagingConversation,
        messagingFirstReply: ins.messagingFirstReply
      } as any);
      updated++;
    }
    if (trackFailure && updated === 0) {
      this.markSyncFailure(`No ad group updated for ${dayISO}.`);
    } else if (trackFailure) {
      this.markSyncSuccess();
    }
    return { date: dayISO, updated };
  }

  /**
   * Đồng bộ cho 1 ngày theo danh sách tài khoản quảng cáo (accountId: có thể có/không có tiền tố act_)
   * - Chỉ lấy nhóm quảng cáo thuộc các tài khoản chỉ định (và còn active)
   * - Sử dụng cùng cơ chế token hiện có (env hoặc token hợp lệ gần nhất)
   */
  async syncForDateByAdAccounts(dayISO: string, adAccountIds: string[], opts?: { cleanup?: boolean }): Promise<{ date: string; updated: number; accounts: number }> {
    const token = await this.getAccessToken();
    if (!token) {
      this.logger.warn('Missing FB_ADS_ACCESS_TOKEN or active ApiToken for Facebook. Skip sync by accounts.');
      return { date: dayISO, updated: 0, accounts: 0 };
    }

    if (!Array.isArray(adAccountIds) || adAccountIds.length === 0) {
      return { date: dayISO, updated: 0, accounts: 0 };
    }

    // Chuẩn hóa danh sách: tách lấy số và tạo cả 2 biến thể (123, act_123)
    const variants = new Set<string>();
    for (const raw of adAccountIds) {
      if (!raw) continue;
      const s = String(raw).trim();
      const m = s.match(/^(?:act_)?(\d+)$/i);
      if (m) {
        const digits = m[1];
        variants.add(digits);
        variants.add(`act_${digits}`);
      } else {
        // Giữ nguyên nếu không khớp mẫu số
        variants.add(s);
      }
    }
    const list = Array.from(variants);

    // Lọc tài khoản quảng cáo Facebook theo danh sách
    const adAccDocs = await this.adAccountModel
      .find({ accountType: 'facebook', isActive: true, accountId: { $in: list } })
      .select('_id accountId')
      .lean();
    const accObjectIds = adAccDocs.map(a => a._id);
    if (!accObjectIds.length) return { date: dayISO, updated: 0, accounts: 0 };

    // Lấy các ad group thuộc các ad account này
    const groups = await this.adGroupModel
      .find({ platform: 'facebook', isActive: true, adAccountId: { $in: accObjectIds } })
      .select('adGroupId')
      .lean();

    const day = new Date(dayISO);
    let updated = 0;
    for (const g of groups) {
      const adsetId = (g as any).adGroupId;
      if (!adsetId) continue;
      // eslint-disable-next-line no-await-in-loop
      const ins = await this.fetchAdsetInsights(adsetId, token, dayISO);
      if (!ins) continue;
      // eslint-disable-next-line no-await-in-loop
      await this.upsertCost(String(adsetId), day, {
        spentAmount: ins.spend,
        cpm: ins.cpm,
        cpc: ins.cpc,
        frequency: ins.frequency,
        impressions: ins.impressions,
        clicks: ins.clicks,
        reach: ins.reach,
        messagingConversationStarted7d: ins.messagingConversationStarted7d,
        costPerMessagingConversation: ins.costPerMessagingConversation,
        messagingFirstReply: ins.messagingFirstReply,
      } as any);
      updated++;
    }

    // Dọn dẹp orphan (optional)
    if (opts?.cleanup) {
      try {
        await this.cleanupOrphanCostsForDate(dayISO);
      } catch (e) {
        this.logger.warn(`Cleanup orphan costs failed for ${dayISO}: ${(e as any)?.message}`);
      }
    }

    return { date: dayISO, updated, accounts: adAccDocs.length };
  }

  /** Đồng bộ khoảng N ngày theo danh sách tài khoản quảng cáo */
  async syncRangeByAdAccounts(opts: { accounts: string[]; date?: string; days?: number; cleanup?: boolean }) {
    const base = opts?.date ? new Date(opts.date) : new Date();
    if (!opts?.date) { base.setDate(base.getDate() - 1); }
    const days = Math.max(1, Math.min(14, opts?.days ?? 1));
    const results: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      // eslint-disable-next-line no-await-in-loop
      const r = await this.syncForDateByAdAccounts(iso, opts.accounts, { cleanup: opts?.cleanup });
      results.push(r);
    }
    return results;
  }

  /**
   * Dọn dẹp dữ liệu orphan cho 1 ngày: xóa các chi phí mà adGroupId không còn tồn tại trong DB
   * (tránh sót dữ liệu cũ sau khi xóa nhóm quảng cáo).
   */
  async cleanupOrphanCostsForDate(dayISO: string) {
    const day = new Date(dayISO);
    const normalized = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const groups = await this.adGroupModel.find().select('adGroupId').lean();
    const validIds = new Set((groups || []).map(g => String((g as any).adGroupId)).filter(Boolean));
    // Xóa tất cả bản ghi của ngày này có adGroupId không thuộc tập hợp hợp lệ
    const res = await this.costModel.deleteMany({ date: normalized, adGroupId: { $nin: Array.from(validIds) } });
    this.logger.log(`Cleanup orphan costs for ${dayISO}: removed ${res?.deletedCount ?? 0}`);
    return { date: dayISO, removed: res?.deletedCount ?? 0 };
  }

  /** Đồng bộ N ngày lùi từ ngày đầu vào (mặc định hôm qua, N=1) */
  async syncRange(opts?: { date?: string; days?: number }) {
    const base = opts?.date ? new Date(opts.date) : new Date();
    if (!opts?.date) { base.setDate(base.getDate() - 1); }
    const days = Math.max(1, Math.min(14, opts?.days ?? 1));
    const results: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      // eslint-disable-next-line no-await-in-loop
      const r = await this.syncForDate(iso);
      results.push(r);
    }
    return results;
  }

  /**
   * Manual fallback only.
   * The primary 06:00 execution is handled by Finance/DataCollectionService.
   */
  async cronDaily() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayISO = yesterday.toISOString().slice(0,10);
      
      this.logger.log(`Starting Facebook Ads sync for ${dayISO} at 6:00 AM`);
      const res = await this.syncForDate(dayISO);
      this.logger.log(`Facebook Ads sync completed: updated ${res.updated} ad groups`);
      
      // Debounce recalculation để tránh race với Google/TikTok cron sau đó.
      if (res.updated > 0) {
        this.recalculationQueue.scheduleRecalculation(dayISO, 'facebook-cron');
      }
    } catch (err) {
      this.markSyncFailure((err as any)?.message || 'Cron daily sync failed');
      this.logger.error('Cron daily sync failed', err as any);
    }
  }
}
