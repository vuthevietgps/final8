/**
 * Service: AdGroupAutoControlService
 * Chức năng: Theo dõi chi phí và hiệu quả theo ngày của từng ad group.
 * Khi vượt ngưỡng (chi tiêu/ngày hoặc chi phí trên hội thoại), tự động tạm dừng nhóm.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { AdvertisingCostService } from '../advertising-cost/advertising-cost.service';
import { AdvertisingCostFacebookSyncService } from '../advertising-cost/advertising-cost.facebook-sync.service';
import { ApiTokenService } from '../api-token/api-token.service';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import axios from 'axios';
import { getMetaGraphApiVersion } from '../common/ads-api-version';

const FB_GRAPH_API_VERSION = getMetaGraphApiVersion();

@Injectable()
export class AdGroupAutoControlService {
  private readonly logger = new Logger(AdGroupAutoControlService.name);
  private disabledWarningLogged = false;

  private isApprovalPolicyIntegrated(): boolean {
    return false;
  }

  constructor(
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    private readonly costService: AdvertisingCostService,
    private readonly facebookSync: AdvertisingCostFacebookSyncService,
    private readonly apiTokenService: ApiTokenService,
  ){}

  /** Tính CPR (cost per conversation) của 1 adGroup trong 1 ngày (UTC) */
  private async computeDailyCPR(adGroupId: string, dayISO: string){
    const r = await this.costService.getDailyConversationCost({ adGroupId, date: dayISO });
    return r.costPerConversation;
  }

  /**
   * Cron mỗi 10 phút: kiểm tra tất cả nhóm bật autoControlEnabled.
   * - Nếu chi tiêu hôm nay > spendThresholdDaily => pause
   * - Nếu CPR hôm nay > cprThresholdDaily và conversations >= minConversations => pause
   */
  @Cron('*/10 * * * *')
  async cronEnforceThresholds(){
    if (!this.isApprovalPolicyIntegrated()) {
      if (!this.disabledWarningLogged) {
        this.logger.warn('AdGroupAutoControlService is disabled until auto-control actions are routed through approval policy.');
        this.disabledWarningLogged = true;
      }
      return;
    }

    const start = Date.now();
    const todayISO = new Date().toISOString().slice(0,10);
    // Cập nhật nhanh chi phí hôm nay (partial) trước khi đánh giá
    try { await this.facebookSync.syncForDate(todayISO, { trackFailure: false }); } catch(err){ this.logger.warn(`Quick sync today failed: ${(err as any)?.message}`); }
    // Kiểm tra tất cả platform đang hoạt động (FB/Google/TikTok)
    const groups = await this.adGroupModel.find({ autoControlEnabled: true, isActive: true })
      .select('_id adGroupId name platform spendThresholdDaily cprThresholdDaily minConversations fanpageId adAccountId')
      .lean();
    if (!groups.length) return;

    let paused = 0;
    for(const g of groups){
      try{
        const adGroupId = (g as any).adGroupId;
        const todayStats = await this.costService.getDailyConversationCost({ adGroupId, date: todayISO });
        const spendToday = todayStats.spentAmount;
        const minConv = Math.max( (g as any).minConversations ?? 3, 0);
        const cprToday = await this.computeDailyCPR(adGroupId, todayISO);

        let reason: string | null = null;
        if ((g as any).spendThresholdDaily && spendToday > (g as any).spendThresholdDaily){
          reason = `Vượt ngân sách/ngày: ${Math.round(spendToday)} > ${Math.round((g as any).spendThresholdDaily)}`;
        } else if ((g as any).cprThresholdDaily && todayStats.conversationCount >= minConv && cprToday > (g as any).cprThresholdDaily){
          reason = `CPR cao: ${Math.round(cprToday)} > ${Math.round((g as any).cprThresholdDaily)} (>=${minConv} conv)`;
        }

        if (reason){
          await this.adGroupModel.updateOne({ _id: (g as any)._id }, { 
            $set: { isActive: false, lastAutoControlAt: new Date(), autoPausedReason: reason }
          });
          // Platform specific pause
          if ((g as any).platform === 'facebook') {
            try{
              await this.pauseFacebookAdsetByAdAccount(adGroupId, (g as any).adAccountId);
            } catch(err){ this.logger.warn(`Pause FB adset failed for ${adGroupId}: ${(err as any)?.message}`); }
          } else if ((g as any).platform === 'google') {
            try {
              await this.pauseGoogleAdGroup(adGroupId, (g as any).adAccountId);
            } catch(err) { this.logger.warn(`Pause Google adgroup failed for ${adGroupId}: ${(err as any)?.message}`); }
          } else if ((g as any).platform === 'tiktok') {
            try {
              await this.pauseTikTokAdGroup(adGroupId, (g as any).adAccountId);
            } catch(err) { this.logger.warn(`Pause TikTok adgroup failed for ${adGroupId}: ${(err as any)?.message}`); }
          } else {
            this.logger.warn(`Auto-control paused ${adGroupId} on ${(g as any).platform} locally (remote pause chưa hỗ trợ).`);
          }
          paused++;
        }
      }catch(err){
        this.logger.warn(`Check failed for ${(g as any).adGroupId}: ${(err as any)?.message}`);
      }
    }
    const dur = Date.now() - start;
    if (paused>0) this.logger.log(`Auto-control paused ${paused} groups in ${dur}ms`);
  }

  /** Tạm dừng adset trên Facebook bằng token có ads_management, ưu tiên token gắn với ad account */
  private async pauseFacebookAdsetByAdAccount(adsetId: string, adAccountRef?: any){
    // Resolve act_ id string from AdAccount reference
    let actId: string | undefined;
    if (adAccountRef) {
      try{
        const acc = await this.adAccountModel.findById(adAccountRef).lean();
        const rawId = (acc as any)?.accountId as string | undefined;
        if (rawId) {
          const m = String(rawId).trim().match(/^(?:act_)?(\d+)$/i);
          actId = m ? `act_${m[1]}` : String(rawId).trim();
        }
      }catch{}
    }

    const raw = await this.apiTokenService.getRawAccessTokenForAdsManagement(actId);
    if (!raw) { this.logger.warn(`No valid Facebook ads token available${actId?` for ${actId}`:''}`); return; }
    const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${encodeURIComponent(adsetId)}`;
    const params = { access_token: raw, status: 'PAUSED' } as any;
    try{
      const res = await axios.post(url, null, { params });
      if(res.status>=200 && res.status<300){ this.logger.log(`Paused FB adset ${adsetId} via Graph API`); }
    }catch(err: any){
      const msg = err?.response?.data?.error?.message || err?.message;
      this.logger.warn(`Graph API pause failed for ${adsetId}: ${msg}`);
    }
  }

  /** Tạm dừng adgroup trên Google Ads */
  private async pauseGoogleAdGroup(adGroupId: string, adAccountRef?: any){
    let customerId: string | undefined;
    let loginCustomerId: string | undefined;
    if (adAccountRef) {
      try {
        const acc = await this.adAccountModel.findById(adAccountRef).lean();
        const rawId = (acc as any)?.accountId as string | undefined;
        if (rawId) customerId = String(rawId).replace(/[^0-9]/g, '');
        loginCustomerId = (acc as any)?.loginCustomerId || undefined;
      } catch{}
    }
    if (!customerId) { this.logger.warn(`No customerId found for AdGroup ${adGroupId}`); return; }

    const googleConfig = await this.apiTokenService.getGoogleAdsRuntimeConfig({
      customerId,
      loginCustomerId: loginCustomerId ? String(loginCustomerId) : '',
    });

    const accessToken = await this.apiTokenService.getGoogleAdsAccessToken(googleConfig);
    if (!accessToken || !googleConfig.developerToken) {
      this.logger.warn(`Missing Google Ads token for ${customerId}`);
      return;
    }

    const url = `https://googleads.googleapis.com/${googleConfig.apiVersion}/customers/${customerId}/adGroups:mutate`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': googleConfig.developerToken,
      'Content-Type': 'application/json',
    };
    if (googleConfig.loginCustomerId) headers['login-customer-id'] = googleConfig.loginCustomerId;

    const body = {
      operations: [
        {
          updateMask: 'status',
          update: {
            resourceName: `customers/${customerId}/adGroups/${adGroupId}`,
            status: 'PAUSED'
          }
        }
      ]
    };

    try {
      const res = await axios.post(url, body, { headers });
      if(res.status >= 200 && res.status < 300) { this.logger.log(`Paused Google adgroup ${adGroupId} via API`); }
    } catch(err: any) {
      const msg = err?.response?.data?.error?.message || err?.message;
      this.logger.warn(`Google Ads API pause failed for ${adGroupId}: ${msg}`);
    }
  }

  /** Tạm dừng adgroup trên TikTok Ads */
  private async pauseTikTokAdGroup(adGroupId: string, adAccountRef?: any){
    let advertiserId: string | undefined;
    if (adAccountRef) {
      try {
        const acc = await this.adAccountModel.findById(adAccountRef).lean();
        const rawId = (acc as any)?.accountId as string | undefined;
        if (rawId) advertiserId = String(rawId).replace(/[^0-9]/g, '');
      } catch{}
    }
    if (!advertiserId) { this.logger.warn(`No advertiserId found for AdGroup ${adGroupId}`); return; }

    const runtime = await this.apiTokenService.getTikTokRuntimeConfig();
    if (!runtime.accessToken) {
      this.logger.warn(`Missing TikTok Ads access token, cannot pause ${adGroupId}`);
      return;
    }

    const url = 'https://business-api.tiktok.com/open_api/v1.3/adgroup/status/update/';
    const headers = {
      'Access-Token': runtime.accessToken,
      'Content-Type': 'application/json',
    };
    const body = {
      advertiser_id: advertiserId,
      adgroup_ids: [adGroupId],
      operation_status: 'DISABLE'
    };

    try {
      const res = await axios.post(url, body, { headers });
      const data = res.data;
      if (res.status >= 200 && res.status < 300 && data.code === 0) {
        this.logger.log(`Paused TikTok adgroup ${adGroupId} via API`);
      } else {
        throw new Error(data.message || 'Unknown TikTok API Error');
      }
    } catch(err: any) {
      const msg = err?.response?.data?.message || err?.message;
      this.logger.warn(`TikTok Ads API pause failed for ${adGroupId}: ${msg}`);
    }
  }
}
