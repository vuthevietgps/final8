/**
 * File: emergency-action/emergency-action-verification.service.ts
 * Mục đích: Xác minh hành động khẩn cấp đã thực sự được thực hiện trên platform
 * (Facebook/Google/TikTok) sau khi user tick "Đã xong".
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenDocument } from '../api-token/schemas/api-token.schema';
import { ApiTokenService } from '../api-token/api-token.service';
import { getMetaGraphApiVersion } from '../common/ads-api-version';

export interface VerificationResult {
  status: 'verified' | 'failed' | 'skipped';
  details: string;
  actualValue?: any;
}

@Injectable()
export class EmergencyActionVerificationService {
  private readonly logger = new Logger(EmergencyActionVerificationService.name);

  constructor(
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(ApiToken.name) private readonly tokenModel: Model<ApiTokenDocument>,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  /**
   * Xác minh 1 task khẩn cấp trên platform tương ứng
   */
  async verify(task: {
    taskType: string;
    platform: string;
    adGroupId?: string;
    targetSpend?: number;
  }): Promise<VerificationResult> {
    // create-account / create-ad-group không thể tự verify
    if (task.taskType === 'create-account' || task.taskType === 'create-ad-group') {
      return { status: 'skipped', details: 'Xác minh thủ công - không thể auto-verify việc tạo mới' };
    }

    if (!task.adGroupId) {
      return { status: 'skipped', details: 'Thiếu adGroupId để xác minh' };
    }

    const platform = (task.platform || '').toLowerCase();
    try {
      if (platform === 'facebook') {
        return await this.verifyFacebook(task.taskType, task.adGroupId, task.targetSpend);
      } else if (platform === 'google') {
        return await this.verifyGoogle(task.taskType, task.adGroupId, task.targetSpend);
      } else if (platform === 'tiktok') {
        return await this.verifyTiktok(task.taskType, task.adGroupId, task.targetSpend);
      }
      return { status: 'skipped', details: `Platform "${platform}" chưa hỗ trợ verification` };
    } catch (err: any) {
      this.logger.warn(`Verification failed for ${task.adGroupId} on ${platform}: ${err?.message}`);
      return {
        status: 'failed',
        details: `Lỗi khi xác minh: ${err?.message || 'Unknown error'}`,
      };
    }
  }

  // ─── FACEBOOK ─────────────────────────────────────────────

  private async verifyFacebook(
    taskType: string,
    adGroupId: string,
    targetSpend?: number,
  ): Promise<VerificationResult> {
    // Resolve ad account to get token
    const adGroup = await this.adGroupModel.findOne({ adGroupId }).lean();
    const adAccountRef = (adGroup as any)?.adAccountId;

    let actId: string | undefined;
    if (adAccountRef) {
      const acc = await this.adAccountModel.findById(adAccountRef).lean();
      const rawId = (acc as any)?.accountId as string | undefined;
      if (rawId) {
        const m = String(rawId).trim().match(/^(?:act_)?(\d+)$/i);
        actId = m ? `act_${m[1]}` : String(rawId).trim();
      }
    }

    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(actId);
    if (!token) {
      return { status: 'skipped', details: 'Không có Facebook token hợp lệ để xác minh' };
    }

    if (taskType === 'pause-ad-group') {
      const url = `https://graph.facebook.com/${getMetaGraphApiVersion()}/${encodeURIComponent(adGroupId)}`;
      const res = await axios.get(url, {
        params: { access_token: token, fields: 'status,effective_status' },
      });
      const status = res.data?.status;
      const effectiveStatus = res.data?.effective_status;

      if (status === 'PAUSED' || effectiveStatus === 'PAUSED') {
        return { status: 'verified', details: `Facebook adset đã PAUSED (status=${status})`, actualValue: status };
      }
      return {
        status: 'failed',
        details: `Facebook adset chưa pause (status=${status}, effective=${effectiveStatus})`,
        actualValue: { status, effectiveStatus },
      };
    }

    if (taskType === 'change-budget') {
      const url = `https://graph.facebook.com/${getMetaGraphApiVersion()}/${encodeURIComponent(adGroupId)}`;
      const res = await axios.get(url, {
        params: { access_token: token, fields: 'daily_budget,lifetime_budget' },
      });
      // Facebook returns budget in cents (x100)
      const dailyBudget = Number(res.data?.daily_budget || 0) / 100;
      const target = targetSpend || 0;
      const tolerance = target * 0.05; // 5% tolerance

      if (Math.abs(dailyBudget - target) <= tolerance) {
        return {
          status: 'verified',
          details: `Budget Facebook khớp: ${dailyBudget} ≈ ${target}`,
          actualValue: dailyBudget,
        };
      }
      return {
        status: 'failed',
        details: `Budget Facebook chưa khớp: thực tế=${dailyBudget}, target=${target}`,
        actualValue: dailyBudget,
      };
    }

    return { status: 'skipped', details: `Task type "${taskType}" chưa hỗ trợ verify trên Facebook` };
  }

  // ─── GOOGLE ADS ───────────────────────────────────────────

  private async verifyGoogle(
    taskType: string,
    adGroupId: string,
    targetSpend?: number,
  ): Promise<VerificationResult> {
    const adGroup = await this.adGroupModel.findOne({ adGroupId }).lean();
    const adAccountRef = (adGroup as any)?.adAccountId;
    if (!adAccountRef) {
      return { status: 'skipped', details: 'Không tìm thấy ad account cho nhóm QC Google' };
    }

    const account = await this.adAccountModel.findById(adAccountRef).lean();
    if (!account) {
      return { status: 'skipped', details: 'Ad account không tồn tại' };
    }

    const customerId = this.sanitizeId(String((account as any).accountId));
    if (!customerId) {
      return { status: 'skipped', details: 'customerId Google Ads không hợp lệ' };
    }

    const googleConfig = await this.apiTokenService.getGoogleAdsRuntimeConfig({
      customerId,
      loginCustomerId: String((account as any).loginCustomerId || ''),
    });

    if (!googleConfig.refreshToken) {
      return { status: 'skipped', details: 'Không có Google refresh token để xác minh' };
    }

    const accessToken = await this.apiTokenService.getGoogleAdsAccessToken(googleConfig);
    if (!accessToken) {
      return { status: 'skipped', details: 'Không lấy được Google access token' };
    }

    const developerToken = googleConfig.developerToken;
    if (!developerToken) {
      return { status: 'skipped', details: 'Thiếu GOOGLE_ADS_DEVELOPER_TOKEN' };
    }

    const loginCid = this.sanitizeId(String(googleConfig.loginCustomerId || ''));

    if (taskType === 'pause-ad-group') {
      const gaql = `SELECT ad_group.status FROM ad_group WHERE ad_group.id = '${this.sanitizeId(adGroupId)}'`;
      const result = await this.queryGoogleAds(customerId!, gaql, accessToken, developerToken, loginCid);
      const status = result?.[0]?.adGroup?.status;

      if (status === 'PAUSED') {
        return { status: 'verified', details: `Google ad group đã PAUSED`, actualValue: status };
      }
      return {
        status: 'failed',
        details: `Google ad group chưa pause (status=${status || 'unknown'})`,
        actualValue: status,
      };
    }

    if (taskType === 'change-budget') {
      const gaql = `SELECT ad_group.id, campaign.id, campaign_budget.amount_micros FROM ad_group WHERE ad_group.id = '${this.sanitizeId(adGroupId)}'`;
      const result = await this.queryGoogleAds(customerId!, gaql, accessToken, developerToken, loginCid);
      const amountMicros = result?.[0]?.campaignBudget?.amountMicros;
      if (amountMicros == null) {
        return { status: 'skipped', details: 'Không lấy được budget từ Google Ads' };
      }
      const actualBudget = Number(amountMicros) / 1_000_000;
      const target = targetSpend || 0;
      const tolerance = target * 0.05;

      if (Math.abs(actualBudget - target) <= tolerance) {
        return {
          status: 'verified',
          details: `Budget Google khớp: ${actualBudget} ≈ ${target}`,
          actualValue: actualBudget,
        };
      }
      return {
        status: 'failed',
        details: `Budget Google chưa khớp: thực tế=${actualBudget}, target=${target}`,
        actualValue: actualBudget,
      };
    }

    return { status: 'skipped', details: `Task type "${taskType}" chưa hỗ trợ verify trên Google` };
  }

  private async queryGoogleAds(
    customerId: string,
    gaql: string,
    accessToken: string,
    developerToken: string,
    loginCid?: string,
  ): Promise<any[]> {
    const googleConfig = await this.apiTokenService.getGoogleAdsRuntimeConfig({ customerId, loginCustomerId: loginCid });
    const url = `https://googleads.googleapis.com/${googleConfig.apiVersion}/customers/${customerId}/googleAds:searchStream`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
    };
    if (loginCid) headers['login-customer-id'] = loginCid;

    const res = await axios.post(url, { query: gaql }, { headers });
    const results = res.data?.[0]?.results || [];
    return results;
  }

  // ─── TIKTOK ───────────────────────────────────────────────

  private async verifyTiktok(
    taskType: string,
    adGroupId: string,
    targetSpend?: number,
  ): Promise<VerificationResult> {
    const accessToken = await this.getTiktokAccessToken();
    if (!accessToken) {
      return { status: 'skipped', details: 'Không có TikTok token để xác minh' };
    }

    // Find advertiser_id from ad account
    const adGroup = await this.adGroupModel.findOne({ adGroupId }).lean();
    const adAccountRef = (adGroup as any)?.adAccountId;
    if (!adAccountRef) {
      return { status: 'skipped', details: 'Không tìm thấy ad account cho nhóm QC TikTok' };
    }
    const account = await this.adAccountModel.findById(adAccountRef).lean();
    const advertiserId = (account as any)?.accountId;
    if (!advertiserId) {
      return { status: 'skipped', details: 'Không có advertiser ID' };
    }

    if (taskType === 'pause-ad-group') {
      const url = 'https://business-api.tiktok.com/open_api/v1.3/adgroup/get/';
      const res = await axios.get(url, {
        headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ adgroup_ids: [adGroupId] }),
          fields: JSON.stringify(['operation_status', 'adgroup_name']),
        },
      });

      const list = res.data?.data?.list || [];
      const adgroup = list[0];
      if (!adgroup) {
        return { status: 'failed', details: 'Không tìm thấy ad group trên TikTok' };
      }

      const opStatus = adgroup.operation_status;
      if (opStatus === 'DISABLE' || opStatus === 'FROZEN') {
        return { status: 'verified', details: `TikTok ad group đã tắt (${opStatus})`, actualValue: opStatus };
      }
      return {
        status: 'failed',
        details: `TikTok ad group chưa tắt (operation_status=${opStatus})`,
        actualValue: opStatus,
      };
    }

    if (taskType === 'change-budget') {
      const url = 'https://business-api.tiktok.com/open_api/v1.3/adgroup/get/';
      const res = await axios.get(url, {
        headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ adgroup_ids: [adGroupId] }),
          fields: JSON.stringify(['budget', 'adgroup_name']),
        },
      });

      const list = res.data?.data?.list || [];
      const adgroup = list[0];
      if (!adgroup) {
        return { status: 'failed', details: 'Không tìm thấy ad group trên TikTok' };
      }

      const actualBudget = Number(adgroup.budget || 0);
      const target = targetSpend || 0;
      const tolerance = target * 0.05;

      if (Math.abs(actualBudget - target) <= tolerance) {
        return {
          status: 'verified',
          details: `Budget TikTok khớp: ${actualBudget} ≈ ${target}`,
          actualValue: actualBudget,
        };
      }
      return {
        status: 'failed',
        details: `Budget TikTok chưa khớp: thực tế=${actualBudget}, target=${target}`,
        actualValue: actualBudget,
      };
    }

    return { status: 'skipped', details: `Task type "${taskType}" chưa hỗ trợ verify trên TikTok` };
  }

  private async getTiktokAccessToken(): Promise<string | undefined> {
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

  private sanitizeId(id?: string): string | undefined {
    if (!id) return undefined;
    const clean = id.replace(/[^0-9]/g, '');
    return clean || undefined;
  }
}
