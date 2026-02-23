import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { Model, Types } from 'mongoose';
import { ApiTokenService } from '../api-token/api-token.service';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';

interface FbAdAccountResponse {
  name?: string;
  account_status?: number;
  currency?: string;
  timezone_id?: string;
  business?: { name?: string };
  spend_cap?: number;
  amount_spent?: number;
}

interface FbAdset {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  bid_amount?: string | number;
  campaign_id?: string;
}

interface DiscoveredAdGroup {
  adGroupId: string;
  name: string;
  status: string;
  effectiveStatus: string;
  dailyBudget: number;
  campaignId?: string;
  existsInDb: boolean;
}

@Injectable()
export class AdGroupSyncService {
  private readonly logger = new Logger(AdGroupSyncService.name);

  constructor(
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  /** Cron mỗi giờ để đồng bộ metadata ad account + ad group từ Facebook */
  @Cron('0 * * * *')
  async cronSyncFacebook() {
    const accounts = await this.adAccountModel.find({ accountType: 'facebook', isActive: true }).lean();
    if (!accounts.length) return;

    for (const acc of accounts) {
      await this.syncAdAccount(acc);
      await this.syncAdsetsForAccount(acc);
    }
  }

  private async syncAdAccount(acc: any) {
    const started = Date.now();
    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(acc.accountId);
    if (!token) {
      await this.adAccountModel.updateOne(
        { _id: acc._id },
        {
          $set: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
            lastSyncError: 'Không tìm thấy token ads_management cho tài khoản',
            lastSyncDurationMs: Date.now() - started,
          },
        },
      );
      return;
    }

    const url = `https://graph.facebook.com/v19.0/act_${encodeURIComponent(acc.accountId)}`;
    try {
      const { data } = await axios.get<FbAdAccountResponse>(url, {
        params: {
          fields: 'name,account_status,currency,timezone_id,business{name},spend_cap,amount_spent',
          access_token: token,
        },
      });

      await this.adAccountModel.updateOne(
        { _id: acc._id },
        {
          $set: {
            name: data?.name || acc.name,
            accountStatus: data?.account_status,
            currency: data?.currency,
            timezoneId: data?.timezone_id?.toString(),
            businessName: data?.business?.name,
            spendCap: this.toNumber(data?.spend_cap),
            amountSpent: this.toNumber(data?.amount_spent),
            lastSyncAt: new Date(),
            lastSyncStatus: 'ok',
            lastSyncDurationMs: Date.now() - started,
          },
          $unset: { lastSyncError: '' },
        },
      );
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || 'UNKNOWN_ERROR';
      this.logger.warn(`Sync ad account ${acc.accountId} failed: ${message}`);
      await this.adAccountModel.updateOne(
        { _id: acc._id },
        {
          $set: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
            lastSyncError: message,
            lastSyncDurationMs: Date.now() - started,
          },
        },
      );
    }
  }

  private async syncAdsetsForAccount(acc: any) {
    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(acc.accountId);
    if (!token) return;

    let next: string | null = `https://graph.facebook.com/v19.0/act_${encodeURIComponent(acc.accountId)}/adsets?fields=id,name,status,effective_status,daily_budget,bid_amount,campaign_id&limit=50&access_token=${encodeURIComponent(token)}`;
    while (next) {
      try {
        const { data } = await axios.get<{ data: FbAdset[]; paging?: { next?: string } }>(next);
        const adsets = data?.data || [];
        for (const adset of adsets) {
          await this.upsertAdsetMetadata(adset);
        }
        next = data?.paging?.next || null;
      } catch (error: any) {
        const message = error?.response?.data?.error?.message || error?.message || 'UNKNOWN_ERROR';
        this.logger.warn(`Sync adsets for account ${acc.accountId} failed: ${message}`);
        break; // tránh loop vô hạn khi lỗi
      }
    }
  }

  private async upsertAdsetMetadata(adset: FbAdset) {
    const started = Date.now();
    const updateSet: any = {
      name: adset.name,
      remoteStatus: adset.status,
      effectiveStatus: adset.effective_status,
      dailyBudget: this.toNumber(adset.daily_budget),
      bidAmount: this.toNumber(adset.bid_amount),
      campaignId: adset.campaign_id,
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
      lastSyncDurationMs: Date.now() - started,
    };

    const res = await this.adGroupModel.updateMany(
      { adGroupId: adset.id },
      { $set: updateSet, $unset: { lastSyncError: '' } },
    );

    if (!res.matchedCount) {
      this.logger.debug(`Adset ${adset.id} không khớp adGroup nào trong DB`);
    }
  }

  private toNumber(v: unknown): number | undefined {
    if (v === null || v === undefined) return undefined;
    const num = Number(v);
    return Number.isFinite(num) ? num : undefined;
  }

  /**
   * Auto-discover: Lấy danh sách ad groups từ Facebook cho 1 ad account
   * Trả về danh sách để hiển thị, nhân viên chọn import
   */
  async discoverAdGroupsFromFacebook(adAccountId: string): Promise<{
    success: boolean;
    adAccountId: string;
    discovered: DiscoveredAdGroup[];
    error?: string;
  }> {
    const acc = await this.adAccountModel.findOne({ 
      $or: [
        { accountId: adAccountId },
        { accountId: `act_${adAccountId}` },
        { accountId: adAccountId.replace('act_', '') }
      ],
      accountType: 'facebook',
      isActive: true 
    }).lean();

    if (!acc) {
      return { success: false, adAccountId, discovered: [], error: 'Không tìm thấy Ad Account' };
    }

    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(acc.accountId);
    if (!token) {
      return { success: false, adAccountId, discovered: [], error: 'Không có token API. Vui lòng cấu hình token trong Cài Đặt API.' };
    }

    const cleanId = acc.accountId.replace('act_', '');
    const discovered: DiscoveredAdGroup[] = [];
    
    // Lấy danh sách adGroupId hiện có trong DB
    const existingGroups = await this.adGroupModel.find({ platform: 'facebook' }).select('adGroupId').lean();
    const existingIds = new Set(existingGroups.map(g => g.adGroupId));

    let next: string | null = `https://graph.facebook.com/v19.0/act_${encodeURIComponent(cleanId)}/adsets?fields=id,name,status,effective_status,daily_budget,campaign_id&limit=100&access_token=${encodeURIComponent(token)}`;
    
    while (next) {
      try {
        const { data } = await axios.get<{ data: FbAdset[]; paging?: { next?: string } }>(next);
        const adsets = data?.data || [];
        
        for (const adset of adsets) {
          discovered.push({
            adGroupId: adset.id,
            name: adset.name || `Adset ${adset.id}`,
            status: adset.status || 'UNKNOWN',
            effectiveStatus: adset.effective_status || 'UNKNOWN',
            dailyBudget: this.toNumber(adset.daily_budget) || 0,
            campaignId: adset.campaign_id,
            existsInDb: existingIds.has(adset.id),
          });
        }
        
        next = data?.paging?.next || null;
      } catch (error: any) {
        const message = error?.response?.data?.error?.message || error?.message || 'UNKNOWN_ERROR';
        this.logger.warn(`Discover adsets for account ${acc.accountId} failed: ${message}`);
        return { success: false, adAccountId, discovered, error: message };
      }
    }

    return { success: true, adAccountId, discovered };
  }

  /**
   * Auto-import: Tự động tạo ad groups từ danh sách discovered
   * Yêu cầu: fanpageId, productCategoryId, agentId để tạo
   */
  async autoImportAdGroups(params: {
    adAccountId: string;
    adGroupIds: string[];
    fanpageId: string;
    productCategoryId: string;
    agentId: string;
  }): Promise<{ success: boolean; imported: number; skipped: number; errors: string[] }> {
    const acc = await this.adAccountModel.findOne({ 
      $or: [
        { accountId: params.adAccountId },
        { accountId: `act_${params.adAccountId}` },
        { accountId: params.adAccountId.replace('act_', '') }
      ],
      accountType: 'facebook',
      isActive: true 
    }).lean();

    if (!acc) {
      return { success: false, imported: 0, skipped: 0, errors: ['Không tìm thấy Ad Account'] };
    }

    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(acc.accountId);
    if (!token) {
      return { success: false, imported: 0, skipped: 0, errors: ['Không có token API'] };
    }

    const existingGroups = await this.adGroupModel.find({ adGroupId: { $in: params.adGroupIds } }).select('adGroupId').lean();
    const existingIds = new Set(existingGroups.map(g => g.adGroupId));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const adGroupId of params.adGroupIds) {
      if (existingIds.has(adGroupId)) {
        skipped++;
        continue;
      }

      try {
        // Lấy thông tin từ Facebook
        const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(adGroupId)}?fields=id,name,status,effective_status,daily_budget,campaign_id&access_token=${encodeURIComponent(token)}`;
        const { data } = await axios.get<FbAdset>(url);

        // Tạo ad group mới
        await this.adGroupModel.create({
          name: data.name || `Adset ${adGroupId}`,
          adGroupId: adGroupId,
          fanpageId: new Types.ObjectId(params.fanpageId),
          productCategoryId: new Types.ObjectId(params.productCategoryId),
          agentId: new Types.ObjectId(params.agentId),
          adAccountId: acc._id,
          platform: 'facebook',
          isActive: true,
          remoteStatus: data.status,
          effectiveStatus: data.effective_status,
          dailyBudget: this.toNumber(data.daily_budget),
          campaignId: data.campaign_id,
          lastSyncAt: new Date(),
          lastSyncStatus: 'ok',
        });
        imported++;
      } catch (error: any) {
        const msg = error?.message || 'Lỗi không xác định';
        errors.push(`${adGroupId}: ${msg}`);
      }
    }

    return { success: true, imported, skipped, errors };
  }

  /**
   * Lấy trạng thái sync gần nhất của tất cả ad accounts
   */
  async getSyncStatus(): Promise<{
    accounts: Array<{
      accountId: string;
      name: string;
      accountType: string;
      lastSyncAt?: Date;
      lastSyncStatus?: string;
      lastSyncError?: string;
      adGroupCount: number;
    }>;
    lastCostSyncAt?: Date;
  }> {
    const accounts = await this.adAccountModel.find({ isActive: true }).lean();
    const result: any[] = [];

    for (const acc of accounts) {
      const adGroupCount = await this.adGroupModel.countDocuments({ adAccountId: acc._id });
      result.push({
        accountId: acc.accountId,
        name: acc.name,
        accountType: acc.accountType,
        lastSyncAt: acc.lastSyncAt,
        lastSyncStatus: acc.lastSyncStatus,
        lastSyncError: acc.lastSyncError,
        adGroupCount,
      });
    }

    return { accounts: result };
  }
}
