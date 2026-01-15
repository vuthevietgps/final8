import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { Model } from 'mongoose';
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
}
