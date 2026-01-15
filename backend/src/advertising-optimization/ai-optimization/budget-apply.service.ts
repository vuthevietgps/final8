/**
 * Service: BudgetApplyService
 * Purpose: Resolve ad group context and apply budget changes to providers (Facebook, Google, TikTok)
 * with safety helpers reused by AIOptimizationService.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { google } from 'googleapis';

import { AdGroup, AdGroupDocument } from '../../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountDocument } from '../../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenDocument } from '../../api-token/schemas/api-token.schema';
import { ApiTokenService } from '../../api-token/api-token.service';
import { AdvertisingCostSuggestionDocument } from '../../advertising-cost-suggestion/schemas/advertising-cost-suggestion.schema';

@Injectable()
export class BudgetApplyService {
  private readonly logger = new Logger(BudgetApplyService.name);

  constructor(
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(ApiToken.name) private readonly tokenModel: Model<ApiTokenDocument>,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  async resolveContext(adGroupId: string): Promise<{ adGroup?: AdGroup | null; adAccount?: AdAccount | null }> {
    if (!adGroupId) return {};
    const adGroup = await this.adGroupModel.findOne({ adGroupId }).lean();
    const adAccount = adGroup?.adAccountId ? await this.adAccountModel.findById(adGroup.adAccountId).lean() : null;
    return { adGroup, adAccount };
  }

  pickCurrentBudget(suggestion: AdvertisingCostSuggestionDocument, adGroup?: AdGroup | null): number {
    if (adGroup && typeof adGroup.dailyBudget === 'number' && adGroup.dailyBudget > 0) return adGroup.dailyBudget;
    return suggestion.suggestedCost || 0;
  }

  async applyBudgetToProvider(adGroup: AdGroup | null | undefined, adAccount: AdAccount | null, newBudget: number): Promise<boolean> {
    if (!adGroup) {
      this.logger.warn('applyBudgetToProvider: missing adGroup context');
      return false;
    }

    try {
      switch (adGroup.platform) {
        case 'facebook':
          return await this.applyFacebookBudget(adGroup, adAccount, newBudget);
        case 'google':
          return await this.applyGoogleBudget(adGroup, adAccount, newBudget);
        case 'tiktok':
          return await this.applyTiktokBudget(adGroup, adAccount, newBudget);
        default:
          this.logger.warn(`Platform ${adGroup.platform} not supported for budget apply`);
          return false;
      }
    } catch (err) {
      this.logger.error(`Apply budget failed for ${adGroup.adGroupId}`, err as any);
      return false;
    }
  }

  private async applyFacebookBudget(adGroup: AdGroup, adAccount: AdAccount | null, newBudget: number): Promise<boolean> {
    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(adAccount?.accountId);
    if (!token) {
      this.logger.warn(`Không tìm thấy token ads_management cho tài khoản Facebook ${adAccount?.accountId || 'unknown'}`);
      return false;
    }

    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(adGroup.adGroupId)}`;
    try {
      const params = new URLSearchParams({ daily_budget: Math.round(newBudget).toString(), access_token: token });
      await axios.post(url, params);
      await this.adGroupModel.updateMany({ adGroupId: adGroup.adGroupId }, { $set: { dailyBudget: Math.round(newBudget), lastSyncAt: new Date() } });
      this.logger.log(`💰 Applied Facebook budget for ${adGroup.adGroupId}: ${Math.round(newBudget)}`);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'UNKNOWN_ERROR';
      this.logger.warn(`Facebook apply budget failed for ${adGroup.adGroupId}: ${msg}`);
      return false;
    }
  }

  private sanitizeId(id?: string): string | undefined {
    if (!id) return undefined;
    const clean = id.replace(/[^0-9]/g, '');
    return clean || undefined;
  }

  private async getGoogleRefreshToken(account: AdAccount | null): Promise<string | undefined> {
    if (process.env.GOOGLE_ADS_REFRESH_TOKEN) return process.env.GOOGLE_ADS_REFRESH_TOKEN.trim();
    if (!account) return undefined;

    const variants = new Set<string>();
    if (account.accountId) {
      const clean = this.sanitizeId(String(account.accountId));
      if (clean) {
        variants.add(clean);
        variants.add(account.accountId);
      }
    }

    const tokenDoc = await this.tokenModel
      .findOne({ provider: 'google', status: 'active', adAccountId: { $in: Array.from(variants) } })
      .sort({ isPrimary: -1, updatedAt: -1 })
      .lean();
    if (!tokenDoc) return undefined;

    try {
      const { decryptToken } = await import('../../api-token/crypto.util');
      if ((tokenDoc as any).tokenEnc) {
        const raw = decryptToken((tokenDoc as any).tokenEnc);
        if (raw) return raw;
      }
    } catch {}
    return (tokenDoc as any).token;
  }

  private async getGoogleAccessToken(refreshToken: string | undefined): Promise<string | undefined> {
    if (!refreshToken) return undefined;
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    if (!clientId || !clientSecret) return undefined;
    const oauth2Client = new google.auth.OAuth2({ clientId, clientSecret });
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const token = await oauth2Client.getAccessToken();
    return token?.token || undefined;
  }

  private async applyGoogleBudget(adGroup: AdGroup, adAccount: AdAccount | null, newBudget: number): Promise<boolean> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      this.logger.warn('Thiếu GOOGLE_ADS_DEVELOPER_TOKEN - bỏ qua apply Google Ads');
      return false;
    }

    const refreshToken = await this.getGoogleRefreshToken(adAccount);
    if (!refreshToken) {
      this.logger.warn(`Không tìm thấy refresh token Google Ads cho account ${adAccount?.accountId}`);
      return false;
    }

    const accessToken = await this.getGoogleAccessToken(refreshToken);
    if (!accessToken) {
      this.logger.warn(`Không lấy được access token Google Ads cho account ${adAccount?.accountId}`);
      return false;
    }

    const customerId = this.sanitizeId(adAccount?.accountId);
    if (!customerId) {
      this.logger.warn(`accountId không hợp lệ cho Google Ads: ${adAccount?.accountId}`);
      return false;
    }

    const budgetId = this.sanitizeId(adGroup.campaignId || adGroup.adGroupId);
    if (!budgetId) {
      this.logger.warn(`Không xác định được campaign budget id cho adGroup ${adGroup.adGroupId}`);
      return false;
    }

    const loginCid = this.sanitizeId(String(adAccount?.loginCustomerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || customerId));
    const url = `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:mutate`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
    };
    if (loginCid) headers['login-customer-id'] = loginCid;

    const payload = {
      mutateOperations: [
        {
          campaignBudgetOperation: {
            updateMask: 'amount_micros',
            update: {
              resourceName: `customers/${customerId}/campaignBudgets/${budgetId}`,
              amountMicros: Math.round(newBudget * 1_000_000),
            },
          },
        },
      ],
    };

    try {
      await axios.post(url, payload, { headers });
      await this.adGroupModel.updateMany({ adGroupId: adGroup.adGroupId }, { $set: { dailyBudget: Math.round(newBudget), lastSyncAt: new Date() } });
      this.logger.log(`💰 Applied Google Ads budget for ${adGroup.adGroupId}: ${Math.round(newBudget)}`);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'UNKNOWN_ERROR';
      this.logger.warn(`Google Ads apply budget failed for ${adGroup.adGroupId}: ${msg}`);
      return false;
    }
  }

  private async getTiktokAccessToken(): Promise<string | undefined> {
    if (process.env.TIKTOK_ACCESS_TOKEN) return process.env.TIKTOK_ACCESS_TOKEN.trim();
    const tokenDoc = await this.tokenModel
      .findOne({ provider: 'tiktok', status: 'active' })
      .sort({ isPrimary: -1, updatedAt: -1 })
      .lean();
    if (!tokenDoc) return undefined;
    try {
      const { decryptToken } = await import('../../api-token/crypto.util');
      if ((tokenDoc as any).tokenEnc) {
        const raw = decryptToken((tokenDoc as any).tokenEnc);
        if (raw) return raw;
      }
    } catch {}
    return (tokenDoc as any).token;
  }

  private async applyTiktokBudget(adGroup: AdGroup, adAccount: AdAccount | null, newBudget: number): Promise<boolean> {
    const accessToken = await this.getTiktokAccessToken();
    if (!accessToken) {
      this.logger.warn('Thiếu TIKTOK_ACCESS_TOKEN hoặc ApiToken provider=tiktok - bỏ qua apply TikTok');
      return false;
    }

    const advertiserId = this.sanitizeId(adAccount?.accountId || (process.env.TIKTOK_ADVERTISER_ID as any));
    if (!advertiserId) {
      this.logger.warn(`Không xác định được advertiserId cho TikTok từ account ${adAccount?.accountId}`);
      return false;
    }

    const url = 'https://business-api.tiktok.com/open_api/v1.3/adgroup/update/';
    const body = {
      advertiser_id: advertiserId,
      adgroup_id: adGroup.adGroupId,
      budget: Math.round(newBudget),
      budget_mode: 'BUDGET_MODE_DAY',
    };

    try {
      await axios.post(url, body, { headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' } });
      await this.adGroupModel.updateMany({ adGroupId: adGroup.adGroupId }, { $set: { dailyBudget: Math.round(newBudget), lastSyncAt: new Date() } });
      this.logger.log(`💰 Applied TikTok budget for ${adGroup.adGroupId}: ${Math.round(newBudget)}`);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'UNKNOWN_ERROR';
      this.logger.warn(`TikTok apply budget failed for ${adGroup.adGroupId}: ${msg}`);
      return false;
    }
  }
}
