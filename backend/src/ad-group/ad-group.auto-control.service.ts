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

@Injectable()
export class AdGroupAutoControlService {
  private readonly logger = new Logger(AdGroupAutoControlService.name);

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
    const start = Date.now();
  const todayISO = new Date().toISOString().slice(0,10);
  // Cập nhật nhanh chi phí hôm nay (partial) trước khi đánh giá
  try { await this.facebookSync.syncForDate(todayISO); } catch(err){ this.logger.warn(`Quick sync today failed: ${(err as any)?.message}`); }
    // Chỉ Facebook + đang hoạt động để tránh pause lại nhóm đã dừng
    const groups = await this.adGroupModel.find({ autoControlEnabled: true, platform: 'facebook', isActive: true })
      .select('_id adGroupId name spendThresholdDaily cprThresholdDaily minConversations fanpageId adAccountId')
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
          // Thử pause trực tiếp adset trên Facebook nếu có token hợp lệ
          try{
            await this.pauseFacebookAdsetByAdAccount(adGroupId, (g as any).adAccountId);
          } catch(err){ this.logger.warn(`Pause FB adset failed for ${adGroupId}: ${(err as any)?.message}`); }
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
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(adsetId)}`;
    const params = { access_token: raw, status: 'PAUSED' } as any;
    try{
      const res = await axios.post(url, null, { params });
      if(res.status>=200 && res.status<300){ this.logger.log(`Paused FB adset ${adsetId} via Graph API`); }
    }catch(err: any){
      const msg = err?.response?.data?.error?.message || err?.message;
      this.logger.warn(`Graph API pause failed for ${adsetId}: ${msg}`);
    }
  }
}
